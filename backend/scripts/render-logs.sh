#!/usr/bin/env bash
# Reads the logs of the backend service on Render through Render's API, so they can be read from a
# terminal without opening the dashboard.
#
# The API key is read from a file only you can read and is never printed, never put on a command
# line (where other users could see it in the process list) and never written anywhere else.
#
#   mkdir -p ~/.config/render
#   ( read -rsp "Render API key: " KEY && printf '%s' "$KEY" > ~/.config/render/api-key )
#   chmod 600 ~/.config/render/api-key
#
# Create the key in Render under Account Settings, API Keys.
set -euo pipefail

KEY_FILE="${RENDER_API_KEY_FILE:-$HOME/.config/render/api-key}"
SERVICE_NAME="${RENDER_SERVICE_NAME:-Super-AI-App}"
API="${RENDER_API_BASE:-https://api.render.com/v1}"

usage() {
  cat <<'USAGE'
Usage:
  render-logs.sh services
      List the services the key can see (name, id, owner id, type).
  render-logs.sh logs [--minutes N] [--limit N] [--text WORDS] [--level warn|error|info|debug] [--dry-run]
      Print the newest log lines of the backend service, oldest first.
      Defaults: the last 60 minutes, at most 100 lines.
      --dry-run prints the request that would be sent and sends nothing.

Environment:
  RENDER_SERVICE_NAME   service to read (default: Super-AI-App)
  RENDER_SERVICE_ID and RENDER_OWNER_ID   skip the lookup by name
  RENDER_API_KEY_FILE   where the key is stored (default: ~/.config/render/api-key)
  RENDER_API_BASE       API address (default: https://api.render.com/v1; changed only by tests)
USAGE
}

die() {
  echo "error: $*" >&2
  exit 1
}

require_key_file() {
  [[ -f "$KEY_FILE" ]] || die "no API key found at $KEY_FILE. Create a key in Render (Account Settings, API Keys), then save it with: mkdir -p ~/.config/render && ( read -rsp 'Render API key: ' KEY && printf '%s' \"\$KEY\" > ~/.config/render/api-key ) && chmod 600 ~/.config/render/api-key"
  local mode
  mode=$(stat -c %a "$KEY_FILE")
  [[ "$mode" == "600" || "$mode" == "400" ]] || die "$KEY_FILE must be readable only by you (it is $mode). Run: chmod 600 $KEY_FILE"
}

# The key goes in through a header file descriptor, not through the command line.
api_get() {
  curl -fsS --max-time 30 -H 'Accept: application/json' \
    -H @<(printf 'Authorization: Bearer %s\n' "$(<"$KEY_FILE")") "$API$1"
}

whole_number_between() {
  local name=$1 value=$2 low=$3 high=$4
  [[ "$value" =~ ^[0-9]+$ ]] || die "$name must be a whole number, got '$value'"
  (( value >= low && value <= high )) || die "$name must be between $low and $high, got $value"
}

url_encode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

cmd_services() {
  require_key_file
  api_get "/services?limit=50" | python3 -c '
import json, sys
for item in json.load(sys.stdin):
    s = item["service"]
    print(f'"'"'{s["name"]:<30} {s["id"]:<28} owner={s["ownerId"]:<28} {s["type"]}'"'"')
'
}

resolve_service() {
  [[ -n "${RENDER_SERVICE_ID:-}" && -n "${RENDER_OWNER_ID:-}" ]] && return
  local found
  found=$(api_get "/services?limit=50" | python3 -c '
import json, sys
name = sys.argv[1]
services = [item["service"] for item in json.load(sys.stdin)]
match = [s for s in services if s["name"] == name]
if not match:
    sys.exit("no service named %r; the key can see: %s" % (name, ", ".join(s["name"] for s in services)))
print(match[0]["id"], match[0]["ownerId"])
' "$SERVICE_NAME") || die "could not find the service"
  read -r RENDER_SERVICE_ID RENDER_OWNER_ID <<<"$found"
}

cmd_logs() {
  local minutes=60 limit=100 text="" level="" dry_run=0
  while (( $# > 0 )); do
    case "$1" in
      --minutes) minutes=${2:-}; shift 2 ;;
      --limit) limit=${2:-}; shift 2 ;;
      --text) text=${2:-}; shift 2 ;;
      --level) level=${2:-}; shift 2 ;;
      --dry-run) dry_run=1; shift ;;
      *) die "unknown option '$1' (see --help)" ;;
    esac
  done
  whole_number_between "--minutes" "$minutes" 1 10080
  whole_number_between "--limit" "$limit" 1 1000
  [[ -z "$level" || "$level" =~ ^(info|warn|warning|error|debug)$ ]] || die "--level must be info, warn, error or debug, got '$level'"
  # Render labels warnings "warning", so the short name is translated.
  [[ "$level" != "warn" ]] || level="warning"

  require_key_file
  if (( dry_run )); then
    [[ -n "${RENDER_SERVICE_ID:-}" && -n "${RENDER_OWNER_ID:-}" ]] || die "--dry-run needs RENDER_SERVICE_ID and RENDER_OWNER_ID"
  else
    resolve_service
  fi

  local start end query
  start=$(date -u -d "-${minutes} minutes" +%Y-%m-%dT%H:%M:%SZ)
  end=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  query="ownerId=${RENDER_OWNER_ID}&resource=${RENDER_SERVICE_ID}&startTime=${start}&endTime=${end}&direction=backward&limit=${limit}"
  [[ -z "$text" ]] || query+="&text=$(url_encode "$text")"
  [[ -z "$level" ]] || query+="&level=${level}"

  if (( dry_run )); then
    echo "GET $API/logs?$query"
    return
  fi

  api_get "/logs?$query" | python3 -c '
import json, sys
body = json.load(sys.stdin)
logs = body.get("logs", [])
for entry in reversed(logs):
    labels = {l["name"]: l["value"] for l in entry.get("labels", [])}
    print(entry.get("timestamp", ""), labels.get("level", "-"), entry.get("message", "").rstrip())
if body.get("hasMore"):
    print("-- more lines exist; narrow the time window or raise --limit", file=sys.stderr)
if not logs:
    print("-- no log lines in this window", file=sys.stderr)
'
}

case "${1:-}" in
  services) shift; cmd_services "$@" ;;
  logs) shift; cmd_logs "$@" ;;
  -h|--help|help) usage ;;
  *) usage >&2; die "Usage: unknown or missing command '${1:-}'" ;;
esac

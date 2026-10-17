#!/usr/bin/env bash
# Runs a command against the LOCAL development database and Redis.
#   ./scripts/local-env.sh npm run dev
#   ./scripts/local-env.sh npx prisma db push
# Loads .env.local (gitignored) into the environment; dotenv in the app never
# overrides existing variables, so these win over the cloud values in .env.
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE (see docs: local development database)" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Safety net: never let a Prisma or app command run against a remote database from here.
for variable in DATABASE_URL DIRECT_URL REDIS_URL; do
  value="${!variable:-}"
  case "$value" in
    *@127.0.0.1:*|*@localhost:*|redis://127.0.0.1:*|redis://localhost:*) ;;
    *) echo "Refusing to run: $variable in $ENV_FILE is not a local address." >&2; exit 1 ;;
  esac
done

exec "$@"

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import { AddressInfo } from "node:net";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const script = path.resolve(__dirname, "../scripts/render-logs.sh");
const SECRET = "rnd_TESTKEYDONOTUSE1234567890";

function run(args: string[], options: { keyMode?: number; withKey?: boolean; env?: Record<string, string> } = {}) {
  const home = mkdtempSync(path.join(tmpdir(), "render-logs-"));
  try {
    if (options.withKey !== false) {
      mkdirSync(path.join(home, ".config/render"), { recursive: true });
      const keyFile = path.join(home, ".config/render/api-key");
      writeFileSync(keyFile, `${SECRET}\n`);
      chmodSync(keyFile, options.keyMode ?? 0o600);
    }
    const result = spawnSync("bash", [script, ...args], {
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", HOME: home, ...options.env },
    });
    return { status: result.status, out: result.stdout, err: result.stderr, both: result.stdout + result.stderr };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

const IDS = { RENDER_OWNER_ID: "tea-123", RENDER_SERVICE_ID: "srv-456" };

function withoutAKeyItExplainsHowToCreateOne() {
  const result = run(["logs", "--dry-run"], { withKey: false, env: IDS });
  assert.notEqual(result.status, 0);
  assert.match(result.err, /api-key/);
  assert.match(result.err, /API Keys/i);
}

function aKeyOthersCanReadIsRefused() {
  for (const mode of [0o644, 0o640, 0o666]) {
    const result = run(["logs", "--dry-run"], { keyMode: mode, env: IDS });
    assert.notEqual(result.status, 0, mode.toString(8));
    assert.match(result.err, /chmod 600/);
    assert.ok(!result.both.includes(SECRET), "the key is never echoed");
  }
}

function aDryRunBuildsTheRequestAndNeverShowsTheKey() {
  const result = run(
    ["logs", "--dry-run", "--minutes", "15", "--limit", "20", "--text", "boom x&y", "--level", "error"],
    { env: IDS },
  );
  assert.equal(result.status, 0, result.err);
  assert.match(result.out, /^GET https:\/\/api\.render\.com\/v1\/logs\?/m);
  assert.match(result.out, /ownerId=tea-123/);
  assert.match(result.out, /resource=srv-456/);
  assert.match(result.out, /limit=20/);
  assert.match(result.out, /direction=backward/);
  assert.match(result.out, /level=error/);
  assert.match(result.out, /text=boom%20x%26y/, "text is URL-encoded");
  assert.match(result.out, /startTime=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/);
  assert.ok(!result.both.includes(SECRET), "the key is never printed");
}

function renderCallsAWarningWarningSoTheShortNameIsTranslated() {
  const asked = (level: string) => run(["logs", "--dry-run", "--level", level], { env: IDS }).out;
  assert.match(asked("warn"), /level=warning(&|$|\s)/, "warn is sent as Render's own label");
  assert.match(asked("warning"), /level=warning(&|$|\s)/);
  assert.match(asked("error"), /level=error(&|$|\s)/);
}

function numbersAreValidatedBeforeAnythingIsSent() {
  for (const bad of [["--minutes", "abc"], ["--limit", "0"], ["--limit", "5000"], ["--minutes", "-5"], ["--level", "loud"]]) {
    const result = run(["logs", "--dry-run", ...bad], { env: IDS });
    assert.notEqual(result.status, 0, bad.join(" "));
    assert.match(result.err, /error:/);
  }
}

function helpAndUnknownCommandsPrintUsage() {
  assert.equal(run(["--help"], { withKey: false }).status, 0);
  assert.match(run(["--help"], { withKey: false }).out, /logs/);
  const unknown = run(["frobnicate"], { withKey: false });
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.err, /Usage|usage/);
}

// The live path against a fake Render API on this machine: the key must arrive as a header, the
// service is found by name, and the lines are printed oldest first with their level.
async function theLiveRequestUsesTheKeyAsAHeaderAndFormatsTheLines() {
  const seen: Array<{ url: string; authorization?: string }> = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url ?? "", authorization: req.headers.authorization });
    res.setHeader("Content-Type", "application/json");
    if (req.url?.startsWith("/v1/services")) {
      res.end(JSON.stringify([
        { service: { id: "srv-other", name: "Other", ownerId: "tea-9", type: "web_service" } },
        { service: { id: "srv-456", name: "Super-AI-App", ownerId: "tea-123", type: "web_service" } },
      ]));
    } else {
      res.end(JSON.stringify({
        hasMore: false,
        logs: [
          { timestamp: "2026-10-31T17:41:02Z", message: "second line\n", labels: [{ name: "level", value: "error" }] },
          { timestamp: "2026-10-31T17:41:01Z", message: "first line", labels: [] },
        ],
      }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  const home = mkdtempSync(path.join(tmpdir(), "render-logs-live-"));
  try {
    mkdirSync(path.join(home, ".config/render"), { recursive: true });
    const keyFile = path.join(home, ".config/render/api-key");
    writeFileSync(keyFile, SECRET);
    chmodSync(keyFile, 0o600);

    const child = spawn("bash", [script, "logs", "--minutes", "5"], {
      env: { PATH: process.env.PATH ?? "", HOME: home, RENDER_API_BASE: `http://127.0.0.1:${port}/v1` },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    const status = await new Promise((resolve) => child.on("close", resolve));

    assert.equal(status, 0, err);
    assert.deepEqual(out.trim().split("\n"), [
      "2026-10-31T17:41:01Z - first line",
      "2026-10-31T17:41:02Z error second line",
    ]);
    assert.equal(seen.length, 2);
    assert.ok(seen.every((request) => request.authorization === `Bearer ${SECRET}`), "key sent as a bearer header");
    assert.match(seen[1].url, /ownerId=tea-123/, "the owner of the named service");
    assert.match(seen[1].url, /resource=srv-456/);
    assert.ok(!(out + err).includes(SECRET), "the key is never printed");
  } finally {
    rmSync(home, { recursive: true, force: true });
    server.close();
  }
}

withoutAKeyItExplainsHowToCreateOne();
aKeyOthersCanReadIsRefused();
aDryRunBuildsTheRequestAndNeverShowsTheKey();
renderCallsAWarningWarningSoTheShortNameIsTranslated();
numbersAreValidatedBeforeAnythingIsSent();
helpAndUnknownCommandsPrintUsage();
theLiveRequestUsesTheKeyAsAHeaderAndFormatsTheLines().then(
  () => console.log("renderLogs tests passed"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

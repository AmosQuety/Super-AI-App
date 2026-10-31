import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const backend = path.resolve(__dirname, "..");

// Runs the real logger as a production process would, from a scratch folder so the logger's
// own files do not land in the repository, and returns what it printed on standard output.
function printedByProductionLogger(statements: string): Array<Record<string, any>> {
  const scratch = mkdtempSync(path.join(tmpdir(), "prod-logging-"));
  try {
    const script = `
      const { logger } = require(${JSON.stringify(path.join(backend, "src/utils/logger"))});
      ${statements}
      setTimeout(() => process.exit(0), 400);
    `;
    const run = spawnSync(
      process.execPath,
      ["-r", path.join(backend, "node_modules/ts-node/register"), "-e", script],
      {
        cwd: scratch,
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "production",
          TS_NODE_PROJECT: path.join(backend, "tsconfig.json"),
          TS_NODE_TRANSPILE_ONLY: "true",
        },
      },
    );
    assert.equal(run.status, 0, run.stderr);
    return run.stdout
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function warningsAndErrorsReachStandardOutputAsJson() {
  const lines = printedByProductionLogger(`
    logger.info("routine-info");
    logger.debug("routine-debug");
    logger.warn("needs-attention", { reason: "example" });
    logger.error("something-failed", { code: 42 });
  `);
  const messages = lines.map((line) => line.message);
  assert.deepEqual(messages, ["needs-attention", "something-failed"], "only warnings and errors");

  const [warning, failure] = lines;
  assert.equal(warning.level, "warn");
  assert.equal(failure.level, "error");
  assert.equal(failure.code, 42, "structured fields stay fields");
  assert.equal(failure.service, "backend-api");
  assert.ok(Date.parse(failure.timestamp) > 0, "every line carries a time");
}

function anErrorObjectKeepsItsMessageAndStack() {
  const [line] = printedByProductionLogger(`logger.error("job failed", new Error("boom"));`);
  assert.equal(line.level, "error");
  assert.match(String(line.stack ?? line.message), /boom/);
}

warningsAndErrorsReachStandardOutputAsJson();
anErrorObjectKeepsItsMessageAndStack();
console.log("productionLogging tests passed");

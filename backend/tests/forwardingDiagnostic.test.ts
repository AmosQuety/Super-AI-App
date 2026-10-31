import assert from "node:assert/strict";
import {
  MAX_DIAGNOSTIC_LINES,
  createForwardingDiagnostic,
} from "../src/middleware/forwardingDiagnostic";

const request = (headers: Record<string, string>, ip = "10.0.0.7") =>
  ({ ip, headers, socket: { remoteAddress: "10.0.0.7" } }) as any;

function run(middleware: any, req: any) {
  let calledNext = false;
  middleware(req, {}, () => (calledNext = true));
  return calledNext;
}

function itDoesNothingUnlessSwitchedOn() {
  const lines: string[] = [];
  const middleware = createForwardingDiagnostic(undefined, (line) => lines.push(line));
  assert.ok(run(middleware, request({ "x-forwarded-for": "1.1.1.1" })));
  assert.deepEqual(lines, []);
  const offLines: string[] = [];
  const off = createForwardingDiagnostic("false", (line) => offLines.push(line));
  run(off, request({}));
  assert.deepEqual(offLines, []);
}

function whenOnItWritesTheWhatExpressChoseNextToTheRawHeaders() {
  const lines: string[] = [];
  const middleware = createForwardingDiagnostic("true", (line) => lines.push(line));
  assert.ok(run(middleware, request({ "x-forwarded-for": "6.6.6.6, 203.0.113.9", "cf-connecting-ip": "6.6.6.6" })));
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.diagnostic, "forwarding-headers");
  assert.equal(entry.expressIp, "10.0.0.7");
  assert.equal(entry.peer, "10.0.0.7");
  assert.equal(entry.forwardedFor, "6.6.6.6, 203.0.113.9");
  assert.equal(entry.cfConnectingIp, "6.6.6.6");
}

function itStopsAfterAFewLinesSoItCannotFloodTheLogs() {
  const lines: string[] = [];
  const middleware = createForwardingDiagnostic("true", (line) => lines.push(line));
  for (let i = 0; i < MAX_DIAGNOSTIC_LINES + 50; i++) run(middleware, request({}));
  assert.equal(lines.length, MAX_DIAGNOSTIC_LINES);
}

function aCallerCannotStartANewLineOrFillTheLog() {
  const lines: string[] = [];
  const middleware = createForwardingDiagnostic("true", (line) => lines.push(line));
  run(middleware, request({ "x-forwarded-for": "1.1.1.1\r\n{\"fake\":true}" + "9".repeat(5000) }));
  assert.equal(lines[0].split("\n").length, 2, "one line plus the final newline");
  assert.ok(lines[0].length < 800);
}

itDoesNothingUnlessSwitchedOn();
whenOnItWritesTheWhatExpressChoseNextToTheRawHeaders();
itStopsAfterAFewLinesSoItCannotFloodTheLogs();
aCallerCannotStartANewLineOrFillTheLog();
console.log("forwardingDiagnostic tests passed");

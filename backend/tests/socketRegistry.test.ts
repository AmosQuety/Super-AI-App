import "./support/testEnvironment";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { closeUserSockets, trackUserSocket, trackedSocketCount } from "../src/auth/socketRegistry";

// Live subscriptions are authenticated once, when they start. When a user's password changes
// their open sockets are closed so that a stolen token cannot keep receiving data.

class FakeSocket extends EventEmitter {
  closed: { code?: number; reason?: string } | null = null;
  close(code?: number, reason?: string) {
    this.closed = { code, reason };
    this.emit("close");
  }
}

function closesOnlyTheSocketsOfThatUser() {
  const mine = new FakeSocket();
  const mineToo = new FakeSocket();
  const theirs = new FakeSocket();
  trackUserSocket("user_1", mine);
  trackUserSocket("user_1", mineToo);
  trackUserSocket("user_2", theirs);

  closeUserSockets("user_1");

  assert.deepEqual(mine.closed, { code: 4499, reason: "Session ended" });
  assert.equal(mineToo.closed?.code, 4499);
  assert.equal(theirs.closed, null);
  closeUserSockets("user_2");
}

function trackingTheSameSocketTwiceClosesItOnce() {
  const socket = new FakeSocket();
  let closeCalls = 0;
  const original = socket.close.bind(socket);
  socket.close = (code?: number, reason?: string) => (closeCalls++, original(code, reason));
  trackUserSocket("user_3", socket);
  trackUserSocket("user_3", socket);
  closeUserSockets("user_3");
  assert.equal(closeCalls, 1);
}

function aSocketThatClosedByItselfIsForgotten() {
  const before = trackedSocketCount();
  const socket = new FakeSocket();
  trackUserSocket("user_4", socket);
  assert.equal(trackedSocketCount(), before + 1);
  socket.emit("close");
  assert.equal(trackedSocketCount(), before);
}

function aSocketThatFailsToCloseDoesNotStopTheOthers() {
  const broken = new FakeSocket();
  broken.close = () => {
    throw new Error("socket already gone");
  };
  const healthy = new FakeSocket();
  trackUserSocket("user_5", broken);
  trackUserSocket("user_5", healthy);
  closeUserSockets("user_5");
  assert.equal(healthy.closed?.code, 4499);
}

function closingForAUserWithNoSocketsIsHarmless() {
  assert.doesNotThrow(() => closeUserSockets("nobody"));
}

closesOnlyTheSocketsOfThatUser();
trackingTheSameSocketTwiceClosesItOnce();
aSocketThatClosedByItselfIsForgotten();
aSocketThatFailsToCloseDoesNotStopTheOthers();
closingForAUserWithNoSocketsIsHarmless();
console.log("socketRegistry tests passed");
process.exit(0);

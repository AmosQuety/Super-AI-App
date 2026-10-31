import "./support/testEnvironment";
import assert from "node:assert/strict";
import { FaceRecognitionService } from "../src/services/faceRecognitionService";
import { faceAuthMutations } from "../src/resolvers/mutations/faceAuthMutations";
import { resetAllFailedAttempts } from "../src/auth/passwordAttempts";
import { MAX_FACE_LOGIN_ATTEMPTS } from "../src/auth/faceLoginAttempts";
import { setSecurityMetricSink } from "../src/utils/securityMetrics";

const account = {
  id: "me_1",
  email: "me@example.test",
  name: "Me",
  isActive: true,
  role: "USER",
  sessionVersion: 0,
};

let healthy = true;
let recognised: string | null = null;
let verifyCalls = 0;
let verifyOutcome: "normal" | "unavailable" | "throws" = "normal";
FaceRecognitionService.prototype.checkHealth = async () =>
  ({ isOnline: healthy }) as any;
FaceRecognitionService.prototype.verifyFace = async () => {
  verifyCalls++;
  if (verifyOutcome === "unavailable")
    return { success: false, unavailable: true, error: "Service warming up, please try again." } as any;
  if (verifyOutcome === "throws") throw new Error("Could not connect to biometric engine.");
  return recognised
    ? ({ success: true, matchedUser: recognised, emotion: "neutral" } as any)
    : ({ success: false } as any);
};

function makeContext(ip = "10.0.0.1") {
  const audits: any[] = [];
  return {
    context: {
      user: null,
      prisma: {
        user: {
          findUnique: async () => ({ ...account }),
          update: async () => ({}),
        },
        securityAuditLog: { create: async ({ data }: any) => audits.push(data) },
      },
      req: { ip, headers: {} },
    } as any,
    audits,
  };
}

const attempt = (context: any) =>
  (faceAuthMutations as any).loginWithFace(null, { image: Promise.resolve({}) }, context);

function reset() {
  resetAllFailedAttempts();
  healthy = true;
  recognised = null;
  verifyCalls = 0;
  verifyOutcome = "normal";
}

async function repeatedFailuresFromOneAddressAreStopped() {
  reset();
  const { context } = makeContext();
  for (let i = 0; i < MAX_FACE_LOGIN_ATTEMPTS; i++) {
    assert.match((await attempt(context)).message, /not recognized/i);
  }
  const callsBefore = verifyCalls;
  const refused = await attempt(context);
  assert.equal(refused.success, false);
  assert.match(refused.message, /too many/i);
  assert.match(refused.message, /password/i, "tells the user what to do instead");
  assert.equal(verifyCalls, callsBefore, "no face is compared while locked");

  recognised = account.email;
  assert.equal(
    (await attempt(context)).success,
    false,
    "a recognised face is refused too while locked",
  );
}

async function anotherAddressIsNotAffected() {
  reset();
  const stranger = makeContext("203.0.113.9").context;
  for (let i = 0; i < MAX_FACE_LOGIN_ATTEMPTS; i++) await attempt(stranger);
  recognised = account.email;
  const owner = await attempt(makeContext("198.51.100.7").context);
  assert.equal(owner.success, true);
  assert.ok(owner.token);
}

async function aSuccessGivesBackOnlyItsOwnAttempt() {
  reset();
  const { context } = makeContext();
  for (let i = 0; i < MAX_FACE_LOGIN_ATTEMPTS - 1; i++) await attempt(context);
  recognised = account.email;
  assert.equal((await attempt(context)).success, true);
  recognised = null;
  assert.match((await attempt(context)).message, /not recognized/i, "one guess is left");
  assert.match((await attempt(context)).message, /too many/i, "the earlier guesses still count");
}

async function anOfflineServiceIsNotAGuess() {
  reset();
  const { context } = makeContext();
  healthy = false;
  for (let i = 0; i < MAX_FACE_LOGIN_ATTEMPTS + 3; i++) {
    assert.match((await attempt(context)).message, /offline/i);
  }
  healthy = true;
  assert.match((await attempt(context)).message, /not recognized/i);
}

async function failuresAndLocksAreCountedAndTheLockIsAudited() {
  reset();
  const counted: string[] = [];
  setSecurityMetricSink((name, attributes) =>
    counted.push(`${name}:${JSON.stringify(attributes)}`),
  );
  try {
    const { context, audits } = makeContext();
    for (let i = 0; i < MAX_FACE_LOGIN_ATTEMPTS + 1; i++) await attempt(context);
    assert.equal(
      counted.filter((c) => c === 'auth.face_login.failed:{"reason":"not_recognized"}').length,
      MAX_FACE_LOGIN_ATTEMPTS,
    );
    assert.ok(counted.includes("auth.face_login.locked:{}"));
    const locks = audits.filter((a) => a.event === "FACE_LOGIN_LOCKED");
    assert.equal(locks.length, 1);
    assert.equal(locks[0].userId, null);
    assert.equal(locks[0].ipAddress, "10.0.0.1");
  } finally {
    setSecurityMetricSink(undefined);
  }
}

async function addressesInOneIpv6NetworkShareOneFaceCount() {
  reset();
  for (let i = 0; i < MAX_FACE_LOGIN_ATTEMPTS; i++) {
    await attempt(makeContext(`2001:db8:5:6::${i + 1}`).context);
  }
  const next = await attempt(makeContext("2001:db8:5:6:abcd::1").context);
  assert.match(next.message, /too many/i, "rotating addresses inside a /64 gives no new bucket");
  recognised = account.email;
  assert.equal((await attempt(makeContext("2001:db8:5:7::1").context)).success, true);
}

async function aSuccessDoesNotForgiveTheGuessesBeforeIt() {
  reset();
  const { context } = makeContext();
  let wrongGuesses = 0;
  // Someone with their own enrolled face alternates guesses at others with a genuine login.
  for (let round = 0; round < 40; round++) {
    recognised = null;
    const guess = await attempt(context);
    if (/not recognized/i.test(guess.message)) wrongGuesses++;
    recognised = account.email;
    await attempt(context);
  }
  assert.equal(
    wrongGuesses,
    MAX_FACE_LOGIN_ATTEMPTS,
    "a genuine login does not reset the count for guesses at other faces",
  );
}

async function aLockIsAuditedOnlyWhenTheLimitReachingAttemptFails() {
  reset();
  const offline = makeContext();
  for (let i = 0; i < MAX_FACE_LOGIN_ATTEMPTS - 1; i++) await attempt(offline.context);
  healthy = false;
  await attempt(offline.context);
  await attempt(offline.context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(offline.audits, [], "an offline service is not a lockout");

  reset();
  const winner = makeContext();
  for (let i = 0; i < MAX_FACE_LOGIN_ATTEMPTS - 1; i++) await attempt(winner.context);
  recognised = account.email;
  assert.equal((await attempt(winner.context)).success, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(winner.audits, [], "a successful login is not a lockout");
}

async function aServiceThatIsUpButCannotAnswerIsNotAGuess() {
  for (const outcome of ["unavailable", "throws"] as const) {
    reset();
    verifyOutcome = outcome;
    const { context, audits } = makeContext();
    for (let i = 0; i < MAX_FACE_LOGIN_ATTEMPTS + 3; i++) {
      const result = await attempt(context);
      assert.equal(result.success, false);
      assert.match(result.message, /temporarily unavailable|password/i);
      assert.doesNotMatch(result.message, /not recognized/i, "the user is not told their face was wrong");
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(audits, [], `${outcome}: no lockout from a service failure`);
    verifyOutcome = "normal";
    assert.match((await attempt(context)).message, /not recognized/i, `${outcome}: the count was never used`);
  }
}

async function main() {
  await aServiceThatIsUpButCannotAnswerIsNotAGuess();
  await addressesInOneIpv6NetworkShareOneFaceCount();
  await aSuccessDoesNotForgiveTheGuessesBeforeIt();
  await aLockIsAuditedOnlyWhenTheLimitReachingAttemptFails();
  await repeatedFailuresFromOneAddressAreStopped();
  await anotherAddressIsNotAffected();
  await aSuccessGivesBackOnlyItsOwnAttempt();
  await anOfflineServiceIsNotAGuess();
  await failuresAndLocksAreCountedAndTheLockIsAudited();
  console.log("faceLoginLimit tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

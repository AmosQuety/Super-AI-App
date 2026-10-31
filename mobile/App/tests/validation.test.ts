import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  changePasswordSchema,
  signInSchema,
  signUpSchema,
  utf8ByteLength,
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
} from '../libs/validation-schemas';

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? undefined : result.error?.issues[0]?.message;
}

test('the minimum password length matches the backend rule', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
});

test('sign-up rejects a password shorter than the backend accepts', () => {
  const result = signUpSchema.safeParse({
    name: 'Ada',
    email: 'ada@example.test',
    password: '1234567',
  });
  assert.equal(result.success, false);
  assert.match(String(firstMessage(result)), /at least 8/);
});

test('sign-up accepts an 8 character password and needs a real name and email', () => {
  assert.equal(
    signUpSchema.safeParse({ name: 'Ada', email: 'ada@example.test', password: '12345678' })
      .success,
    true
  );
  assert.equal(
    signUpSchema.safeParse({ name: 'A', email: 'ada@example.test', password: '12345678' }).success,
    false
  );
  assert.equal(
    signUpSchema.safeParse({ name: 'Ada', email: 'not-an-email', password: '12345678' }).success,
    false
  );
});

test('sign-in only requires a password to be present, so older shorter passwords still work', () => {
  assert.equal(
    signInSchema.safeParse({ email: 'ada@example.test', password: 'short' }).success,
    true
  );
  const empty = signInSchema.safeParse({ email: 'ada@example.test', password: '' });
  assert.equal(empty.success, false);
  assert.match(String(firstMessage(empty)), /required/i);
  assert.equal(signInSchema.safeParse({ email: 'nope', password: 'x' }).success, false);
});

const validChange = {
  currentPassword: 'old-password-1',
  newPassword: 'new-password-2',
  confirmPassword: 'new-password-2',
};

test('change password accepts a valid new password that matches its confirmation', () => {
  assert.equal(changePasswordSchema.safeParse(validChange).success, true);
});

test('change password requires the current password', () => {
  const result = changePasswordSchema.safeParse({ ...validChange, currentPassword: '' });
  assert.equal(result.success, false);
  assert.match(String(firstMessage(result)), /current password/i);
});

test('change password enforces the backend length rule on the new password', () => {
  const result = changePasswordSchema.safeParse({
    ...validChange,
    newPassword: '1234567',
    confirmPassword: '1234567',
  });
  assert.equal(result.success, false);
  assert.match(String(firstMessage(result)), /at least 8/);
});

test('change password rejects a confirmation that differs from the new password', () => {
  const result = changePasswordSchema.safeParse({
    ...validChange,
    confirmPassword: 'something-else-3',
  });
  assert.equal(result.success, false);
  assert.match(String(firstMessage(result)), /do not match/i);
});

test('change password rejects reusing the current password', () => {
  const result = changePasswordSchema.safeParse({
    currentPassword: 'same-password-1',
    newPassword: 'same-password-1',
    confirmPassword: 'same-password-1',
  });
  assert.equal(result.success, false);
  assert.match(String(firstMessage(result)), /different/i);
});

function firstIssue(result: {
  success: boolean;
  error?: { issues: { message: string; path: PropertyKey[] }[] };
}) {
  return result.success ? undefined : result.error?.issues[0];
}

test('change password accepts a short current password, because older accounts may have one', () => {
  assert.equal(
    changePasswordSchema.safeParse({ ...validChange, currentPassword: 'abc' }).success,
    true
  );
});

test('each change password error lands on the field the user has to fix', () => {
  const mismatch = firstIssue(
    changePasswordSchema.safeParse({ ...validChange, confirmPassword: 'other-password-3' })
  );
  assert.deepEqual(mismatch?.path, ['confirmPassword']);

  const reused = firstIssue(
    changePasswordSchema.safeParse({
      currentPassword: 'same-password-1',
      newPassword: 'same-password-1',
      confirmPassword: 'same-password-1',
    })
  );
  assert.deepEqual(reused?.path, ['newPassword']);

  const tooShort = firstIssue(
    changePasswordSchema.safeParse({
      ...validChange,
      newPassword: '1234567',
      confirmPassword: '1234567',
    })
  );
  assert.deepEqual(tooShort?.path, ['newPassword']);

  const noConfirmation = firstIssue(
    changePasswordSchema.safeParse({ ...validChange, confirmPassword: '' })
  );
  assert.deepEqual(noConfirmation?.path, ['confirmPassword']);
  assert.match(String(noConfirmation?.message), /confirm/i);
});

test('passwords are not trimmed on the client, matching what the backend accepts', () => {
  for (const password of ['1234567 ', '        ', '😀😀😀😀']) {
    assert.equal(
      signUpSchema.safeParse({ name: 'Ada', email: 'ada@example.test', password }).success,
      true,
      `sign-up with ${JSON.stringify(password.slice(0, 12))}`
    );
    assert.equal(
      changePasswordSchema.safeParse({
        currentPassword: 'old-password-1',
        newPassword: password,
        confirmPassword: password,
      }).success,
      true,
      `change with ${JSON.stringify(password.slice(0, 12))}`
    );
  }
});

test('the maximum password size matches the backend rule and is counted in bytes', () => {
  assert.equal(MAX_PASSWORD_BYTES, 72);
});

test('utf8ByteLength counts bytes the way the backend does, without TextEncoder', () => {
  assert.equal(utf8ByteLength(''), 0);
  assert.equal(utf8ByteLength('abc'), 3);
  assert.equal(utf8ByteLength('é'), 2);
  assert.equal(utf8ByteLength('€'), 3);
  assert.equal(utf8ByteLength('😀'), 4);
  // A lone surrogate is encoded as the 3 byte replacement character.
  assert.equal(utf8ByteLength('\ud83d'), 3);
  for (const sample of ['x'.repeat(100), 'é€😀 mixed ünïcode', '\ud83dabc']) {
    assert.equal(utf8ByteLength(sample), Buffer.byteLength(sample, 'utf8'), sample);
  }
});

const AT_LIMIT = ['a'.repeat(72), 'é'.repeat(36), '😀'.repeat(18)];
const OVER_LIMIT = ['a'.repeat(73), 'é'.repeat(37), '😀'.repeat(19)];

test('a new password of exactly 72 bytes is accepted and one byte more is refused', () => {
  for (const password of AT_LIMIT) {
    assert.equal(
      signUpSchema.safeParse({ name: 'Ada', email: 'ada@example.test', password }).success,
      true,
      `sign-up with ${utf8ByteLength(password)} bytes`
    );
    assert.equal(
      changePasswordSchema.safeParse({
        currentPassword: 'old-password-1',
        newPassword: password,
        confirmPassword: password,
      }).success,
      true,
      `change with ${utf8ByteLength(password)} bytes`
    );
  }
  for (const password of OVER_LIMIT) {
    const signUp = signUpSchema.safeParse({ name: 'Ada', email: 'ada@example.test', password });
    assert.equal(signUp.success, false, `sign-up with ${utf8ByteLength(password)} bytes`);
    assert.match(String(firstMessage(signUp)), /72 bytes/);

    const change = changePasswordSchema.safeParse({
      currentPassword: 'old-password-1',
      newPassword: password,
      confirmPassword: password,
    });
    assert.deepEqual(firstIssue(change)?.path, ['newPassword']);
    assert.match(String(firstMessage(change)), /72 bytes/);
  }
});

test('sign-in and the current password are not capped, so older long passwords still work', () => {
  const longOldPassword = 'b'.repeat(100);
  assert.equal(
    signInSchema.safeParse({ email: 'ada@example.test', password: longOldPassword }).success,
    true
  );
  assert.equal(
    changePasswordSchema.safeParse({ ...validChange, currentPassword: longOldPassword }).success,
    true
  );
});

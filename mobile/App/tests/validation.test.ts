import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  changePasswordSchema,
  signInSchema,
  signUpSchema,
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

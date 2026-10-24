import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  newPasswordSchema,
  signInSchema,
  signUpSchema,
} from "../src/lib/validation-schemas.ts";

const signUp = (password: string) =>
  signUpSchema.safeParse({ name: "Ada", email: "ada@example.test", password });

test("the password limits match the backend rules", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.equal(MAX_PASSWORD_BYTES, 72);
});

test("sign-up needs at least 8 characters, as the backend does", () => {
  assert.equal(signUp("1234567").success, false);
  assert.equal(signUp("12345678").success, true);
});

test("a new password of exactly 72 bytes is accepted and one byte more is refused", () => {
  for (const password of ["a".repeat(72), "é".repeat(36), "😀".repeat(18)]) {
    assert.equal(signUp(password).success, true, `${password.length} chars`);
    assert.equal(newPasswordSchema.safeParse(password).success, true);
  }
  for (const password of ["a".repeat(73), "é".repeat(37), "😀".repeat(19)]) {
    const result = signUp(password);
    assert.equal(result.success, false, `${password.length} chars`);
    assert.match(String(result.error?.issues[0]?.message), /72 bytes/);
    assert.equal(newPasswordSchema.safeParse(password).success, false);
  }
});

test("sign-in is not capped, so older long passwords still work", () => {
  assert.equal(signInSchema.safeParse({ email: "ada@example.test", password: "b".repeat(100) }).success, true);
});

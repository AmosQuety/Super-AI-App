import { z } from 'zod';

// The backend rejects a new password shorter than this (register and changePassword),
// so the app must not tell users that anything shorter is acceptable.
export const MIN_PASSWORD_LENGTH = 8;

// bcrypt reads only the first 72 bytes, so the backend refuses longer NEW passwords. The limit
// is in bytes, not characters: an emoji is 4 bytes and an accented letter usually 2.
export const MAX_PASSWORD_BYTES = 72;

// Counts UTF-8 bytes the way the backend does. TextEncoder is not guaranteed on Hermes.
// A lone surrogate counts as 3 bytes (the replacement character), as in Node.
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 0x80) bytes += 1;
    else if (codePoint < 0x800) bytes += 2;
    else if (codePoint < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

// Only new passwords are capped. Sign-in and the current password are not, because an older
// account may hold a longer password that still works.
const newPasswordRule = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .refine((password) => utf8ByteLength(password) <= MAX_PASSWORD_BYTES, {
    message: `Password must be at most ${MAX_PASSWORD_BYTES} bytes (fewer characters if you use emoji or accented letters)`,
  });

export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters, up to ${MAX_PASSWORD_BYTES} bytes (fewer characters if you use emoji or accented letters)`;

// Sign-in only checks that a password was typed: the server decides whether it is correct,
// and an older account may predate the length rule.
export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: newPasswordRule,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: newPasswordRule,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'The new passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: 'The new password must be different from the current one',
    path: ['newPassword'],
  });

export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

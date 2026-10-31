// src/lib/validation-schemas.ts
import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

// The backend rejects a new password outside these limits (register and changePassword).
export const MIN_PASSWORD_LENGTH = 8;

// bcrypt reads only the first 72 bytes. The limit is in bytes, not characters: an emoji is
// 4 bytes and an accented letter usually 2. Sign-in is deliberately not capped, because an
// older account may hold a longer password that still works.
export const MAX_PASSWORD_BYTES = 72;

export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters, up to ${MAX_PASSWORD_BYTES} bytes (fewer characters if you use emoji or accented letters)`;

export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`)
  .refine((password) => new TextEncoder().encode(password).length <= MAX_PASSWORD_BYTES, {
    message: `Password must be at most ${MAX_PASSWORD_BYTES} bytes (fewer characters if you use emoji or accented letters)`
  });

export const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: newPasswordSchema
});

export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
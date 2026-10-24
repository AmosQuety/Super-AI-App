import { z } from 'zod';

// The backend rejects a new password shorter than this (register and changePassword),
// so the app must not tell users that anything shorter is acceptable.
export const MIN_PASSWORD_LENGTH = 8;

const newPasswordRule = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);

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

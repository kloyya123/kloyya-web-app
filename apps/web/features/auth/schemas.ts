import { z } from 'zod';

/**
 * Client-side validation mirrors what the server will enforce; it never
 * replaces it. KAS: "Every request validates: Schema, Required fields, Data
 * types, Length, Format, Permissions, Business rules, Unknown fields."
 *
 * KDS: validation is "Real-time, Accessible, Helpful, Never punitive." The
 * messages below say what is expected, not what the user did wrong.
 */

const email = z
  .email('Enter a valid email address.')
  .min(1, 'Enter your email address.')
  .max(254, 'That email address is too long.')
  .transform((value) => value.trim().toLowerCase());

/**
 * 12 characters, no composition rules.
 *
 * NIST SP 800-63B recommends length over character-class requirements: forced
 * symbols produce `Password1!` and a sticky note. KESM mandates passkeys and
 * MFA, which is where real strength comes from.
 */
const password = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'That password is too long.');

export const signInSchema = z.object({
  email,
  // Deliberately not `password`: an existing account may predate the current
  // rule, and rejecting it at the login form locks the user out of their own
  // account. Length is validated at sign-up and at reset, not at sign-in.
  password: z.string().min(1, 'Enter your password.'),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Enter your name.')
    .max(120, 'That name is too long.')
    .transform((value) => value.trim()),
  email,
  password,
});
export type SignUpValues = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/**
 * Setting a new password after following a reset link.
 *
 * Confirmation is required here but not at sign-up, and the asymmetry is
 * deliberate: at sign-up a typo is recoverable — you reset. At reset, a typo
 * locks you out of the account you were in the middle of recovering, and the
 * only way back is another reset email. The second field is worth the friction
 * exactly once.
 */
export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string().min(1, 'Re-enter your new password.') })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Those passwords do not match.',
    path: ['confirmPassword'],
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the six-digit code from your email.'),
});
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;

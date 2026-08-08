'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
} from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { pwnedPasswordCount } from '@/lib/pwned-password';
import { breachedPasswordError } from '../breached-password-error';
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas';
import { FormError } from './form-error';
import { PasswordInput } from './password-input';
import { PasswordStrengthMeter } from './password-strength-meter';

/**
 * Set a new password, after following the emailed reset link.
 *
 * This screen did not exist. `resetPasswordForEmail` was called without a
 * `redirectTo`, so Supabase sent people to the site root and there was nowhere
 * to actually type a new password — the email arrived, the link worked, and the
 * reset was impossible to finish.
 *
 * Following the link establishes a short-lived RECOVERY session, which is what
 * `updatePassword` spends. That session is also why middleware exempts this
 * route in both directions: without the exemption an authenticated visitor
 * would be forwarded to /dashboard before seeing this form.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const breachCount = await pwnedPasswordCount(values.password).catch(() => 0);
      if (breachCount > 0) {
        setSubmitError(breachedPasswordError(breachCount));
        return;
      }

      await updatePassword(values.password);
      setDone(true);
    } catch (error) {
      setSubmitError(error);
    }
  });

  const password = watch('password');

  if (done) {
    return (
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <div
            aria-hidden="true"
            className="bg-success/12 text-positive mb-3 flex size-12 items-center justify-center rounded-full"
          >
            <CheckCircle2 className="size-6" />
          </div>
          <CardTitle as="h1">Password updated</CardTitle>
          <CardDescription>
            You&rsquo;re signed in with your new password. Anywhere else you were signed in
            will need it from now on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" className="w-full" onClick={() => router.replace('/dashboard')}>
            Continue to Kloyya
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle as="h1">Choose a new password</CardTitle>
        <CardDescription>
          Pick something you haven&rsquo;t used before. You&rsquo;ll stay signed in once it&rsquo;s set.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError error={submitError} />

          <FormField
            label="New password"
            description="At least 12 characters, with a mix of letters and numbers."
            error={errors.password?.message}
            isRequired
          >
            {(field) => (
              <>
                <PasswordInput
                  {...field}
                  {...register('password')}
                  autoComplete="new-password"
                  isInvalid={Boolean(errors.password)}
                />
                <PasswordStrengthMeter password={password ?? ''} />
              </>
            )}
          </FormField>

          <FormField
            label="Confirm new password"
            error={errors.confirmPassword?.message}
            isRequired
          >
            {(field) => (
              <PasswordInput
                {...field}
                {...register('confirmPassword')}
                autoComplete="new-password"
                isInvalid={Boolean(errors.confirmPassword)}
              />
            )}
          </FormField>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
            loadingLabel="Saving your new password"
          >
            Save new password
          </Button>
        </form>

        <p className="text-caption text-muted-foreground mt-6 text-center">
          Link expired?{' '}
          <Link href="/forgot-password" className="text-link rounded-sm font-medium hover:underline">
            Send a new one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

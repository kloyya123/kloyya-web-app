'use client';

import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
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
  Input,
} from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas';
import { FormError } from './form-error';

export function ForgotPasswordForm() {
  const { requestPasswordReset } = useAuth();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await requestPasswordReset(values.email);
      setSentTo(values.email);
    } catch (error) {
      // Only a transport failure reaches here. An unknown address resolves
      // successfully by design — see AuthService.requestPasswordReset.
      setSubmitError(error);
    }
  });

  if (sentTo) return <ResetLinkSent email={sentTo} />;

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle as="h1">Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we&rsquo;ll send you a link to set a new password.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError error={submitError} />

          <FormField label="Email" error={errors.email?.message} isRequired>
            {(field) => (
              <Input
                {...field}
                {...register('email')}
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                leadingIcon={<Mail />}
                isInvalid={Boolean(errors.email)}
              />
            )}
          </FormField>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
            loadingLabel="Sending reset link"
          >
            Send reset link
          </Button>
        </form>

        <BackToSignIn />
      </CardContent>
    </Card>
  );
}

/**
 * Shown for every submitted address, whether or not an account exists.
 *
 * The copy is deliberately conditional — "If an account exists" — because the
 * screen genuinely does not know, and saying "we sent you an email" for an
 * address with no account would be a lie the user acts on by waiting.
 */
function ResetLinkSent({ email }: { email: string }) {
  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <div
          aria-hidden="true"
          className="bg-success/12 text-positive mb-3 flex size-12 items-center justify-center rounded-full"
        >
          <MailCheck className="size-6" />
        </div>
        <CardTitle as="h1">Check your email</CardTitle>
        <CardDescription>
          If an account exists for{' '}
          <span className="text-foreground font-medium">{email}</span>, a reset link
          is on its way. It expires in one hour.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <p className="text-caption text-muted-foreground">
          Nothing arrived? Check your spam folder, or confirm you used your work
          address.
        </p>
        <BackToSignIn />
      </CardContent>
    </Card>
  );
}

function BackToSignIn() {
  return (
    <div className="mt-6 flex justify-center">
      <Link
        href="/login"
        className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        Back to sign in
      </Link>
    </div>
  );
}

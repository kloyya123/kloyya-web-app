'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MailOpen } from 'lucide-react';
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
  Input,
  toast,
} from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { DEMO_VERIFICATION_CODE } from '@/services/auth/mock-auth-service';
import { verifyEmailSchema, type VerifyEmailValues } from '../schemas';
import { FormError } from './form-error';

export function VerifyEmailForm() {
  const router = useRouter();
  const { session, verifyEmail, resendVerificationCode } = useAuth();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await verifyEmail(values.code);
      // Connect tools first, then personalize — the workspace is created last.
      router.replace('/onboarding/connect-tools');
    } catch (error) {
      setSubmitError(error);
    }
  });

  async function onResend() {
    setIsResending(true);
    try {
      await resendVerificationCode();
      toast.success('A new code is on its way.');
    } catch {
      toast.error('Could not send a new code. Try again in a moment.');
    } finally {
      setIsResending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <div
          aria-hidden="true"
          className="bg-intelligence-blue/12 text-link mb-3 flex size-12 items-center justify-center rounded-full"
        >
          <MailOpen className="size-6" />
        </div>
        <CardTitle as="h1">Verify your email</CardTitle>
        <CardDescription>
          We sent a six-digit code to{' '}
          <span className="text-foreground font-medium">
            {session?.user.email ?? 'your email address'}
          </span>
          . Enter it below to secure your workspace.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError error={submitError} />

          <FormField label="Verification code" error={errors.code?.message} isRequired>
            {(field) => (
              <Input
                {...field}
                {...register('code')}
                // `one-time-code` lets iOS and Android offer the SMS/email code
                // straight from the keyboard. inputMode surfaces a numeric pad.
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoFocus
                isInvalid={Boolean(errors.code)}
                className="text-center font-mono text-2xl tracking-[0.4em]"
              />
            )}
          </FormField>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
            loadingLabel="Verifying your code"
          >
            Verify email
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Button
            variant="link"
            onClick={onResend}
            isLoading={isResending}
            loadingLabel="Sending a new code"
            className="text-caption"
          >
            Send a new code
          </Button>
        </div>

        <div className="border-border mt-6 rounded-sm border border-dashed px-3 py-2.5">
          <p className="text-caption text-muted-foreground">
            <span className="text-foreground font-medium">Demo.</span> The code is{' '}
            <span className="font-mono">{DEMO_VERIFICATION_CODE}</span>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

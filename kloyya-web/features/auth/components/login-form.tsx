'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
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
  Input,
} from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { DEMO_CREDENTIALS } from '@/services/auth/mock-auth-service';
import { signInSchema, type SignInValues } from '../schemas';
import { FormError } from './form-error';
import { PasswordInput } from './password-input';

export interface LoginFormProps {
  /**
   * Where to go after a successful sign-in. Already validated by the page —
   * this component must not receive a raw query parameter.
   */
  redirectTo: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const { signIn } = useAuth();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    // Validate on blur, re-validate on change. Validating on every keystroke of
    // a fresh field scolds the user for a half-typed email they are still typing.
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signIn(values);
      router.replace(redirectTo);
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle as="h1">Sign in to Kloyya</CardTitle>
        <CardDescription>
          Your workspace is waiting, with today&rsquo;s briefing prepared.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* noValidate: our messages are more helpful than the browser's, and
            the browser's are not announced consistently. */}
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError error={submitError} />

          <FormField label="Work email" error={errors.email?.message} isRequired>
            {(field) => (
              <Input
                {...field}
                {...register('email')}
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                leadingIcon={<Mail />}
                isInvalid={Boolean(errors.email)}
              />
            )}
          </FormField>

          <FormField label="Password" error={errors.password?.message} isRequired>
            {(field) => (
              <PasswordInput
                {...field}
                {...register('password')}
                autoComplete="current-password"
                isInvalid={Boolean(errors.password)}
              />
            )}
          </FormField>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-caption text-link rounded-sm hover:underline"
            >
              Forgot your password?
            </Link>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
            loadingLabel="Signing in"
          >
            Sign in
          </Button>
        </form>

        <p className="text-caption text-muted-foreground mt-6 text-center">
          New to Kloyya?{' '}
          <Link
            href="/signup"
            className="text-link rounded-sm font-medium hover:underline"
          >
            Create an account
          </Link>
        </p>

        <DemoCredentials />
      </CardContent>
    </Card>
  );
}

/**
 * The mock backend has one seeded account, and a demo nobody can sign into is
 * not a demo. This block is scoped to the mock service and disappears with it.
 */
function DemoCredentials() {
  return (
    <div className="border-border mt-6 rounded-sm border border-dashed px-3 py-2.5">
      <p className="text-caption text-muted-foreground">
        <span className="text-foreground font-medium">Demo account.</span> Sign in
        with <span className="font-mono">{DEMO_CREDENTIALS.email}</span> and{' '}
        <span className="font-mono">{DEMO_CREDENTIALS.password}</span>.
      </p>
    </div>
  );
}

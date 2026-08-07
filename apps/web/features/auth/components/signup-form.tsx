'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, User } from 'lucide-react';
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
import { signUpSchema, type SignUpValues } from '../schemas';
import { FormError } from './form-error';
import { PasswordInput } from './password-input';

export function SignUpForm() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signUp(values);
      // A new account is unverified. Middleware would force this anyway; going
      // there directly avoids a redirect the user can see.
      router.replace('/verify-email');
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="flex-col items-center gap-1.5 text-center">
        <CardTitle as="h1" className="font-serif text-heading-l font-normal">
          Welcome to Kloyya
        </CardTitle>
        <CardDescription>Kloyya learns your work, then prepares your day around it.</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError error={submitError} />

          <FormField label="Full name" error={errors.fullName?.message} isRequired>
            {(field) => (
              <Input
                {...field}
                {...register('fullName')}
                autoComplete="name"
                placeholder="Amara Osei"
                leadingIcon={<User />}
                isInvalid={Boolean(errors.fullName)}
              />
            )}
          </FormField>

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

          <FormField
            label="Password"
            description="At least 12 characters. Length matters more than symbols."
            error={errors.password?.message}
            isRequired
          >
            {(field) => (
              <PasswordInput
                {...field}
                {...register('password')}
                autoComplete="new-password"
                isInvalid={Boolean(errors.password)}
              />
            )}
          </FormField>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
            loadingLabel="Creating your account"
          >
            Create account
          </Button>
        </form>

        <p className="text-caption text-muted-foreground mt-6 text-center">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-link rounded-sm font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

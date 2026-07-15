'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use, useMemo, type ReactNode } from 'react';
import { services } from '@/services';
import type {
  OnboardingProfile,
  Session,
  SettingsPatch,
  SignInInput,
  SignUpInput,
} from '@/services/auth/types';

/**
 * The session is server state, not global state: it is owned by the backend and
 * merely cached here. Modelling it in TanStack Query rather than Zustand means
 * invalidation, refetch, and loading states come for free, and there is exactly
 * one place the cache is cleared on sign-out.
 */
const SESSION_KEY = ['session'] as const;

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  signIn: (input: SignInInput) => Promise<Session>;
  signUp: (input: SignUpInput) => Promise<Session>;
  signOut: () => Promise<void>;
  verifyEmail: (code: string) => Promise<Session>;
  resendVerificationCode: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  completeOnboarding: (profile: OnboardingProfile) => Promise<Session>;
  updateSettings: (patch: SettingsPatch) => Promise<Session>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  /**
   * The session read from the cookie on the server, if any.
   *
   * Seeding the query with it lets authenticated pages render their real content
   * during SSR rather than shipping the shell skeleton and hydrating into it.
   * Without this, `getSession` returns null on the server (no `document`), and
   * every page below the shell is client-only.
   */
  initialSession: Session | null;
}

export function AuthProvider({ children, initialSession }: AuthProviderProps) {
  const queryClient = useQueryClient();

  const { data: session = null, isPending } = useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => services.auth.getSession(),
    // The server already read the cookie. Trust that value on first paint rather
    // than flashing a skeleton while the client re-reads the same cookie.
    initialData: initialSession,
    // The session cookie is the source of truth and only this provider writes
    // it. Refetching on mount would race the mutation that just set it.
    staleTime: Number.POSITIVE_INFINITY,
  });

  /** Write the authoritative session straight into the cache, skipping a refetch. */
  const commit = (next: Session) => queryClient.setQueryData(SESSION_KEY, next);

  const signInMutation = useMutation({
    mutationFn: (input: SignInInput) => services.auth.signIn(input),
    onSuccess: commit,
  });

  const signUpMutation = useMutation({
    mutationFn: (input: SignUpInput) => services.auth.signUp(input),
    onSuccess: commit,
  });

  const verifyEmailMutation = useMutation({
    mutationFn: (code: string) => services.auth.verifyEmail(code),
    onSuccess: commit,
  });

  const onboardingMutation = useMutation({
    mutationFn: (profile: OnboardingProfile) => services.auth.completeOnboarding(profile),
    onSuccess: commit,
  });

  // Settings edits the session itself, so committing the result is what makes a
  // renamed user appear in the top bar without a refetch.
  const settingsMutation = useMutation({
    mutationFn: (patch: SettingsPatch) => services.auth.updateSettings(patch),
    onSuccess: commit,
  });

  const signOutMutation = useMutation({
    mutationFn: () => services.auth.signOut(),
    onSuccess: () => {
      // Clear everything, not just the session. Any cached task, project, or
      // recommendation belongs to the user who just left.
      queryClient.clear();
      queryClient.setQueryData(SESSION_KEY, null);
    },
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading: isPending,
      signIn: signInMutation.mutateAsync,
      signUp: signUpMutation.mutateAsync,
      signOut: signOutMutation.mutateAsync,
      verifyEmail: verifyEmailMutation.mutateAsync,
      // Neither of these mutates cached state, so they need no mutation wrapper.
      resendVerificationCode: () => services.auth.resendVerificationCode(),
      requestPasswordReset: (email: string) =>
        services.auth.requestPasswordReset(email),
      completeOnboarding: onboardingMutation.mutateAsync,
      updateSettings: settingsMutation.mutateAsync,
    }),
    [
      session,
      isPending,
      signInMutation.mutateAsync,
      signUpMutation.mutateAsync,
      signOutMutation.mutateAsync,
      verifyEmailMutation.mutateAsync,
      onboardingMutation.mutateAsync,
      settingsMutation.mutateAsync,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}

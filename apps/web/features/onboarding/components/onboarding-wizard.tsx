'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Info, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CheckCard,
  ChoiceCard,
  Input,
  Progress,
  RadioGroup,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { DURATION, EASE } from '@/lib/motion';
import { useAuth } from '@/providers/auth-provider';
import type { Goal } from '@/services/auth/types';
import { FormError } from '@/features/auth/components/form-error';
import {
  GOAL_OPTIONS,
  PROACTIVENESS_OPTIONS,
  ROLE_OPTIONS,
  STEPS,
} from '@/lib/preference-options';
import { onboardingSchema, STEP_FIELDS, type OnboardingValues } from '../schemas';
import { useOnboardingDraft } from '../use-onboarding-draft';

/**
 * The private-beta onboarding — fast, guided, one question per screen.
 *
 * The user's name arrives from sign-up, so the wizard never asks for it; it only
 * personalizes (role, what to help with, priorities, proactiveness). Each step
 * still explains *why* it asks — that transparency is what makes this a
 * conversation rather than a form — but the whole thing is meant to take a
 * minute, not five.
 *
 * There is no plan step: nothing is for sale until a processor that accepts
 * Zambian cards is in place, so `plan` is submitted as 'free' for everyone.
 */
export function OnboardingWizard() {
  const router = useRouter();
  const { session, completeOnboarding } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const { draft, saveDraft, clearDraft } = useOnboardingDraft();

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      fullName: '',
      role: '',
      goals: [],
      priorities: [],
      proactiveness: 'balanced',
      plan: 'free',
    },
  });

  const { control, trigger, getValues, handleSubmit, reset, formState } = form;
  const { errors, isSubmitting } = formState;

  // Restore a draft, and seed the name we already know from sign-up.
  useEffect(() => {
    const seeded = { ...draft };
    if (!seeded.fullName && session?.user.fullName) {
      seeded.fullName = session.user.fullName;
    }
    if (Object.keys(seeded).length > 0) {
      reset((current) => ({ ...current, ...seeded }), { keepDefaultValues: true });
    }
    // Runs once, on mount: re-running would stomp what the user is choosing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = STEPS[stepIndex];
  // Unreachable: setStepIndex clamps. Rendering nothing beats throwing during
  // render, which would take the whole tree down over an impossible index.
  if (!step) return null;

  const isLastStep = stepIndex === STEPS.length - 1;
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  async function goNext() {
    const current = STEPS[stepIndex];
    if (!current) return;

    // Validate only the fields this step owns.
    const valid = await trigger([...STEP_FIELDS[current.id]], { shouldFocus: true });
    if (!valid) return;

    saveDraft(getValues());
    setDirection(1);
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }

  function goBack() {
    saveDraft(getValues());
    setDirection(-1);
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await completeOnboarding(values);
      clearDraft();
      // Personalization done → connect tools, then build the workspace. Nobody
      // passes through a paywall: there is no plan to pick and nothing to charge
      // until billing exists. Route a Pro pick to '/onboarding/paywall' again
      // once it does.
      router.replace('/onboarding/connect-tools');
    } catch (error) {
      setSubmitError(error);
    }
  });

  // Reduced motion collapses the slide to a plain crossfade.
  const slide = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: direction * 16 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction * -16 },
      };

  return (
    <Card>
      <CardHeader className="flex-col items-stretch gap-4">
        <div className="space-y-2">
          <p className="text-caption text-muted-foreground">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <Progress
            value={progress}
            label={`Onboarding progress: step ${stepIndex + 1} of ${STEPS.length}`}
          />
        </div>
        <CardTitle as="h1">{step.title}</CardTitle>
      </CardHeader>

      <CardContent>
        {/* The "why we ask" panel — the reason onboarding is a conversation. */}
        <div className="bg-surface border-border mb-6 flex items-start gap-2.5 rounded-sm border px-3 py-2.5">
          <Info aria-hidden="true" className="text-notice mt-0.5 size-4 shrink-0" />
          <p className="text-caption text-muted-foreground">{step.why}</p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isLastStep) void onSubmit(event);
            else void goNext();
          }}
          noValidate
        >
          <FormError error={submitError} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step.id}
              {...slide}
              transition={{ duration: DURATION.normal, ease: EASE.out }}
              className="space-y-5"
            >
              {step.id === 'role' ? (
                <Controller
                  control={control}
                  name="role"
                  render={({ field }) => {
                    const isCustom = field.value !== '' && !ROLE_OPTIONS.includes(field.value as never);
                    return (
                      <fieldset>
                        <legend className="sr-only">Your role</legend>
                        <div className="grid grid-cols-2 gap-2">
                          {ROLE_OPTIONS.map((role) => (
                            <SelectButton
                              key={role}
                              label={role}
                              isSelected={field.value === role}
                              onSelect={() => field.onChange(role)}
                            />
                          ))}
                        </div>
                        <Input
                          className="mt-3"
                          value={isCustom ? field.value : ''}
                          onChange={(event) => field.onChange(event.target.value)}
                          placeholder="Or type your own…"
                          aria-label="Type your own role"
                        />
                        <p role="alert" className="text-caption text-critical mt-2">
                          {errors.role?.message ?? ''}
                        </p>
                      </fieldset>
                    );
                  }}
                />
              ) : null}

              {step.id === 'help' ? (
                <Controller
                  control={control}
                  name="goals"
                  render={({ field }) => (
                    <fieldset>
                      <legend className="text-small text-foreground mb-3 font-medium">
                        Choose everything that applies.
                      </legend>
                      <div className="grid gap-2">
                        {GOAL_OPTIONS.map((option) => {
                          const isSelected = field.value.includes(option.value);
                          return (
                            <CheckCard
                              key={option.value}
                              label={option.label}
                              description={option.description}
                              isSelected={isSelected}
                              onToggle={() =>
                                field.onChange(
                                  isSelected
                                    ? field.value.filter((g: Goal) => g !== option.value)
                                    : [...field.value, option.value],
                                )
                              }
                            />
                          );
                        })}
                      </div>
                      <p role="alert" className="text-caption text-critical mt-2">
                        {errors.goals?.message ?? ''}
                      </p>
                    </fieldset>
                  )}
                />
              ) : null}

              {step.id === 'priorities' ? (
                <Controller
                  control={control}
                  name="priorities"
                  render={({ field }) => (
                    <PrioritiesInput value={field.value} onChange={field.onChange} />
                  )}
                />
              ) : null}

              {step.id === 'proactiveness' ? (
                <Controller
                  control={control}
                  name="proactiveness"
                  render={({ field }) => (
                    <fieldset>
                      <legend className="sr-only">How proactive should Kloyya be?</legend>
                      <RadioGroup value={field.value} onValueChange={field.onChange}>
                        {PROACTIVENESS_OPTIONS.map((option) => (
                          <ChoiceCard
                            key={option.value}
                            value={option.value}
                            label={option.label}
                            description={option.description}
                            isSelected={field.value === option.value}
                          />
                        ))}
                      </RadioGroup>
                    </fieldset>
                  )}
                />
              ) : null}

            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              isDisabled={stepIndex === 0}
              leadingIcon={<ArrowLeft aria-hidden="true" />}
            >
              Back
            </Button>

            <Button
              type="submit"
              size="lg"
              isLoading={isSubmitting}
              loadingLabel="Setting up your workspace"
              trailingIcon={!isLastStep ? <ArrowRight aria-hidden="true" /> : undefined}
            >
              {isLastStep ? 'Enter Kloyya' : 'Continue'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** A single-select pill/card used by the role grid. */
function SelectButton({
  label,
  isSelected,
  onSelect,
}: {
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        'flex items-center justify-between gap-2 rounded-sm border px-3 py-2.5 text-left',
        'text-small transition-colors duration-150',
        isSelected
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:border-muted hover:text-foreground',
      )}
    >
      <span className="truncate">{label}</span>
      {isSelected ? <Check aria-hidden="true" className="text-primary size-4 shrink-0" /> : null}
    </button>
  );
}

/** A small tag input for the free-form priorities step. */
function PrioritiesInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed) || value.length >= 20) return;
    onChange([...value, trimmed]);
    setDraft('');
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder="e.g. Close the Series A"
          aria-label="Add a priority"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={add}
          isDisabled={draft.trim().length === 0}
          leadingIcon={<Plus aria-hidden="true" />}
        >
          Add
        </Button>
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((priority) => (
            <li key={priority}>
              <span className="bg-surface border-border text-small text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
                {priority}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((p) => p !== priority))}
                  className="text-subtle hover:text-foreground -mr-1"
                  aria-label={`Remove ${priority}`}
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-subtle">
          Add a few, or skip — you can tell Kloyya your priorities anytime.
        </p>
      )}
    </div>
  );
}

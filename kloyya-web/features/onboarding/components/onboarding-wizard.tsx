'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
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
  FormField,
  Input,
  Progress,
  RadioGroup,
  Select,
} from '@/components/ui';
import { DURATION, EASE } from '@/lib/motion';
import { useAuth } from '@/providers/auth-provider';
import type { Goal } from '@/services/auth/types';
import { FormError } from '@/features/auth/components/form-error';
import {
  BRIEFING_TIME_OPTIONS,
  GOAL_OPTIONS,
  INDUSTRY_OPTIONS,
  NOTIFICATION_LEVEL_OPTIONS,
  STEPS,
  TEAM_SIZE_OPTIONS,
  WORK_STYLE_OPTIONS,
} from '@/lib/preference-options';
import {
  onboardingSchema,
  STEP_FIELDS,
  type OnboardingValues,
} from '../schemas';
import { useOnboardingDraft } from '../use-onboarding-draft';

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
      jobTitle: '',
      companyName: '',
      industry: '',
      teamSize: '11-50',
      goals: [],
      workStyle: 'deep_focus',
      briefingTime: '07:00',
      notificationLevel: 'important_only',
    },
  });

  const { register, control, trigger, getValues, handleSubmit, reset, formState } = form;
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
    // Runs once, on mount: re-running would stomp what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = STEPS[stepIndex];
  // Unreachable: setStepIndex clamps. Rendering nothing beats throwing during
  // render, which would take the whole tree down over an impossible index.
  if (!step) return null;

  const isLastStep = stepIndex === STEPS.length - 1;
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  async function goNext() {
    // Re-read rather than closing over the narrowed `step`: TypeScript will not
    // carry a narrowing into a hoisted function declaration, since nothing stops
    // it being called before the guard above runs.
    const current = STEPS[stepIndex];
    if (!current) return;

    // Validate only the fields this step owns. Validating the whole form would
    // flag questions the user has not been asked yet.
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
      // Connect-tools takes over from here: the user can wire up their existing
      // tools (or skip) before workspace initialization runs its first sync.
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
        {/*
          The "why we ask" panel. Required by the build instructions, and the
          reason onboarding is a conversation rather than a data-entry form.
        */}
        <div className="bg-surface border-border mb-6 flex items-start gap-2.5 rounded-sm border px-3 py-2.5">
          <Info aria-hidden="true" className="text-notice mt-0.5 size-4 shrink-0" />
          <p className="text-caption text-muted-foreground">{step.why}</p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            // Enter on an intermediate step should advance, never submit early.
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
              {step.id === 'about-you' ? (
                <>
                  <FormField label="Your name" error={errors.fullName?.message} isRequired>
                    {(field) => (
                      <Input
                        {...field}
                        {...register('fullName')}
                        autoComplete="name"
                        placeholder="Amara Osei"
                        isInvalid={Boolean(errors.fullName)}
                      />
                    )}
                  </FormField>

                  <FormField
                    label="Your role"
                    description="Used to decide what Kloyya shows you first."
                    error={errors.jobTitle?.message}
                    isRequired
                  >
                    {(field) => (
                      <Input
                        {...field}
                        {...register('jobTitle')}
                        autoComplete="organization-title"
                        placeholder="Chief Operating Officer"
                        isInvalid={Boolean(errors.jobTitle)}
                      />
                    )}
                  </FormField>
                </>
              ) : null}

              {step.id === 'your-company' ? (
                <>
                  <FormField
                    label="Company"
                    error={errors.companyName?.message}
                    isRequired
                  >
                    {(field) => (
                      <Input
                        {...field}
                        {...register('companyName')}
                        autoComplete="organization"
                        placeholder="Northwind Robotics"
                        isInvalid={Boolean(errors.companyName)}
                      />
                    )}
                  </FormField>

                  <FormField label="Industry" error={errors.industry?.message} isRequired>
                    {(field) => (
                      <Select
                        {...field}
                        {...register('industry')}
                        isInvalid={Boolean(errors.industry)}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Choose an industry
                        </option>
                        {INDUSTRY_OPTIONS.map((industry) => (
                          <option key={industry} value={industry}>
                            {industry}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>

                  <FormField label="Team size" error={errors.teamSize?.message} isRequired>
                    {(field) => (
                      <Select
                        {...field}
                        {...register('teamSize')}
                        isInvalid={Boolean(errors.teamSize)}
                      >
                        {TEAM_SIZE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>
                </>
              ) : null}

              {step.id === 'your-goals' ? (
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

              {step.id === 'how-you-work' ? (
                <>
                  <Controller
                    control={control}
                    name="workStyle"
                    render={({ field }) => (
                      <fieldset>
                        <legend className="text-small text-foreground mb-3 font-medium">
                          Which is closest to your week?
                        </legend>
                        <RadioGroup value={field.value} onValueChange={field.onChange}>
                          {WORK_STYLE_OPTIONS.map((option) => (
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

                  <FormField
                    label="Morning briefing"
                    description="Kloyya prepares your day before it starts."
                  >
                    {(field) => (
                      <Select {...field} {...register('briefingTime')}>
                        {BRIEFING_TIME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>

                  <Controller
                    control={control}
                    name="notificationLevel"
                    render={({ field }) => (
                      <fieldset>
                        <legend className="text-small text-foreground mb-3 font-medium">
                          When should Kloyya interrupt you?
                        </legend>
                        <RadioGroup value={field.value} onValueChange={field.onChange}>
                          {NOTIFICATION_LEVEL_OPTIONS.map((option) => (
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
                </>
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
              {isLastStep ? 'Build my workspace' : 'Continue'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

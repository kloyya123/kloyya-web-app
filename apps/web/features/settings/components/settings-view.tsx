'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, PlugZap } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CheckCard,
  ChoiceCard,
  FormField,
  Input,
  RadioGroup,
  Select,
  Skeleton,
  Switch,
  toast,
} from '@/components/ui';
import { useConnectionSummary } from '@/hooks/use-integrations';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import {
  BRIEFING_TIME_OPTIONS,
  GOAL_OPTIONS,
  INDUSTRY_OPTIONS,
  NOTIFICATION_LEVEL_OPTIONS,
  TEAM_SIZE_OPTIONS,
  WORK_STYLE_OPTIONS,
} from '@/lib/preference-options';
import { toErrorPresentation } from '@/lib/error-presentation';
import { useAuth } from '@/providers/auth-provider';
import { settingsSchema, type SettingsValues } from '../schemas';

/**
 * Settings: the answers onboarding collected, now editable.
 *
 * One form, saved as a patch — untouched fields are not sent, so Settings cannot
 * silently clear something it never showed. The preference vocabulary is shared
 * with onboarding, so the two can never offer different choices for the same
 * question.
 */
export function SettingsView() {
  const { session, updateSettings } = useAuth();
  const [isSaved, setIsSaved] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    // The shell only renders this behind a session, so the values are present.
    defaultValues: {
      fullName: session?.user.fullName ?? '',
      jobTitle: session?.user.jobTitle ?? '',
      companyName: session?.organization.name ?? '',
      industry: session?.organization.industry ?? '',
      teamSize: session?.preferences.teamSize ?? '51-200',
      goals: session?.preferences.goals ?? [],
      workStyle: session?.preferences.workStyle ?? 'deep_focus',
      briefingTime: session?.preferences.briefingTime ?? '07:00',
      notificationLevel: session?.preferences.notificationLevel ?? 'important_only',
      aiDraftingEnabled: session?.preferences.aiDraftingEnabled ?? true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateSettings({
        fullName: values.fullName,
        jobTitle: values.jobTitle,
        companyName: values.companyName,
        industry: values.industry,
        preferences: {
          teamSize: values.teamSize,
          goals: values.goals,
          workStyle: values.workStyle,
          briefingTime: values.briefingTime,
          notificationLevel: values.notificationLevel,
          aiDraftingEnabled: values.aiDraftingEnabled,
        },
      });
      // Re-baseline the form, so isDirty is false again after a successful save.
      reset(values);
      setIsSaved(true);
      toast.success('Settings saved.');
    } catch (error) {
      toast.error(toErrorPresentation(error).title);
    }
  });

  if (!session) return null;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-heading-m text-foreground font-semibold">Settings</h1>
        <p className="text-small text-muted-foreground">
          How Kloyya works for you. Change any of it, any time.
        </p>
      </header>

      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <CardTitle as="h2">Profile</CardTitle>
          <CardDescription>How you appear across the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" error={errors.fullName?.message}>
            {(field) => <Input {...field} {...register('fullName')} />}
          </FormField>
          <FormField label="Role" error={errors.jobTitle?.message}>
            {(field) => <Input {...field} {...register('jobTitle')} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <CardTitle as="h2">Organization</CardTitle>
          <CardDescription>
            Kloyya uses your industry to read your documents in the right context.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Company" error={errors.companyName?.message}>
            {(field) => <Input {...field} {...register('companyName')} />}
          </FormField>
          <FormField label="Industry" error={errors.industry?.message}>
            {(field) => (
              <Select {...field} {...register('industry')}>
                {INDUSTRY_OPTIONS.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Team size" error={errors.teamSize?.message}>
            {(field) => (
              <Select {...field} {...register('teamSize')}>
                {TEAM_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <CardTitle as="h2">What you want from Kloyya</CardTitle>
          <CardDescription>
            These steer what gets surfaced first. Pick as many as apply.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="goals"
            render={({ field }) => (
              <div className="grid gap-3 sm:grid-cols-2">
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
                            ? field.value.filter((goal) => goal !== option.value)
                            : [...field.value, option.value],
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <CardTitle as="h2">How you work</CardTitle>
          <CardDescription>
            Kloyya protects your time differently depending on how you answer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Controller
            control={control}
            name="workStyle"
            render={({ field }) => (
              <fieldset>
                <legend className="text-small text-foreground mb-3 font-medium">
                  Your working style
                </legend>
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3">
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Daily briefing"
              description="When Kloyya sends your morning brief."
              error={errors.briefingTime?.message}
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

            <FormField
              label="Notifications"
              description="Kloyya only interrupts when something deserves it."
              error={errors.notificationLevel?.message}
            >
              {(field) => (
                <Select {...field} {...register('notificationLevel')}>
                  {NOTIFICATION_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
        </CardContent>
      </Card>

      <DesktopNotificationsCard />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle as="h2">AI-assisted drafting</CardTitle>
            <CardDescription>
              Let Kloyya write a first pass in Drafts from an idea you give it. You always review
              and edit before it&rsquo;s yours.
            </CardDescription>
          </div>
          <Controller
            control={control}
            name="aiDraftingEnabled"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label="AI-assisted drafting"
              />
            )}
          />
        </CardHeader>
      </Card>

      <ConnectedToolsCard />

      <div className="flex items-center justify-end gap-3">
        {isSaved && !isDirty ? (
          <p className="text-caption text-positive inline-flex items-center gap-1.5" role="status">
            <Check aria-hidden="true" className="size-3.5" />
            Saved
          </p>
        ) : null}
        {/* Nothing to save until something changes — a live Save button that does
            nothing is a lie about state. */}
        <Button type="submit" isLoading={isSubmitting} isDisabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

/**
 * Desktop push — a real OS notification, not the in-app bell. Kept separate
 * from the "Notifications" select above (which governs the in-app list):
 * that field controls what gets *recorded*, this controls whether the
 * highest tier of it also interrupts the desktop. Per KDSE, only a Critical
 * item ever triggers a push regardless of this toggle — turning it on
 * cannot make Kloyya noisier, only reachable when something truly does.
 */
function DesktopNotificationsCard() {
  const { support, isBusy, enable, disable } = usePushNotifications();

  if (support === 'unsupported') return null;

  const isOn = support === 'granted';

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle as="h2">Desktop notifications</CardTitle>
          <CardDescription>
            {support === 'denied'
              ? 'Blocked in your browser. Allow notifications for Kloyya in your browser settings to turn this on.'
              : 'Get a desktop alert for the rare thing that truly can’t wait — everything else stays in the notification list.'}
          </CardDescription>
        </div>
        <Switch
          checked={isOn}
          onCheckedChange={(checked) => void (checked ? enable() : disable())}
          disabled={isBusy || support === 'denied'}
          aria-label="Desktop notifications"
        />
      </CardHeader>
    </Card>
  );
}

/**
 * The tools this workspace draws its intelligence from. Read-only here — the
 * Connection Manager owns connect/disconnect — so this card is a count and a
 * door, not a second place connection state can be edited.
 */
function ConnectedToolsCard() {
  const { data: summary, isPending } = useConnectionSummary();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle as="h2">Connected tools</CardTitle>
          {isPending || !summary ? (
            // Not inside CardDescription: a div inside a <p> is invalid HTML.
            <Skeleton className="h-4 w-44" />
          ) : (
            <CardDescription>
              {summary.connected === 0
                ? 'Nothing connected yet — Kloyya works, but starts smarter with your tools.'
                : `${summary.connected} of ${summary.total} connected${
                    summary.needsAttention > 0
                      ? ` · ${summary.needsAttention} need attention`
                      : ''
                  }`}
            </CardDescription>
          )}
        </div>
        <Link
          href="/connections"
          className="text-small text-link inline-flex shrink-0 items-center gap-1.5 rounded-sm font-medium"
        >
          <PlugZap aria-hidden="true" className="size-4" />
          Manage
        </Link>
      </CardHeader>
    </Card>
  );
}

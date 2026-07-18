'use client';

import { Bug, Copy, Linkedin, Lightbulb, Mail, MessageSquare, Send, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FEEDBACK_CATEGORIES, type FeedbackCategory, type FeedbackSummary } from '@kloyya/core/feedback';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Select,
  Textarea,
  toast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { toErrorPresentation } from '@/lib/error-presentation';
import { useAuth } from '@/providers/auth-provider';
import { services } from '@/services';

/**
 * Community & Feedback.
 *
 * Kloyya is built alongside its users, so this section is deliberately personal:
 * submit an idea, report a bug, leave a note, invite a friend, and see the mark
 * you've already made. Three feedback modes share one form and one submit path;
 * the beta-status counters read the same tallies the API keeps, so "3 ideas
 * submitted" is true, not decorative.
 */
type Mode = 'feature_request' | 'bug' | 'general';

const MODES: { id: Mode; label: string; icon: typeof Lightbulb }[] = [
  { id: 'feature_request', label: 'Feature request', icon: Lightbulb },
  { id: 'bug', label: 'Report a bug', icon: Bug },
  { id: 'general', label: 'General feedback', icon: MessageSquare },
];

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  ai: 'AI',
  search: 'Search',
  workspace: 'Workspace',
  tasks: 'Tasks',
  projects: 'Projects',
  documents: 'Documents',
  integrations: 'Integrations',
  mobile: 'Mobile',
  performance: 'Performance',
  design: 'Design',
  other: 'Other',
};

export function CommunityFeedback() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('feature_request');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('ai');
  const [steps, setSteps] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [summary, setSummary] = useState<FeedbackSummary | null>(null);

  useEffect(() => {
    services.feedback.summary().then(setSummary).catch(() => setSummary(null));
  }, []);

  function reset() {
    setTitle('');
    setBody('');
    setSteps('');
    setRating(0);
  }

  async function submit() {
    if (body.trim().length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await services.feedback.submit({
        type: mode,
        title: title.trim(),
        body: body.trim(),
        ...(mode !== 'general' ? { category } : {}),
        ...(mode === 'general' && rating > 0 ? { rating } : {}),
        ...(mode === 'bug' && steps.trim() ? { details: { steps: steps.trim() } } : {}),
      });
      toast.success('Thanks for helping improve Kloyya. We’ve received your feedback.');
      reset();
      setSummary(await services.feedback.summary().catch(() => summary));
    } catch (error) {
      toast.error(toErrorPresentation(error).title);
    } finally {
      setSubmitting(false);
    }
  }

  const referralLink = `https://kloyya.com/invite/${(session?.user.id ?? 'beta').slice(0, 8)}`;
  const shareText = 'I’m using Kloyya — an AI chief of staff for your work. Join the beta:';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Invite link copied.');
    } catch {
      toast.error('Could not copy — select the link and copy it manually.');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <CardTitle as="h2">Help shape the future of Kloyya</CardTitle>
          <CardDescription>
            Your ideas and feedback directly influence what we build next.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Feedback type">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-small transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          <FormField label={mode === 'general' ? 'Title (optional)' : 'Title'}>
            {(field) => (
              <Input
                {...field}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={
                  mode === 'feature_request'
                    ? 'A short name for the idea'
                    : mode === 'bug'
                      ? 'What went wrong, briefly'
                      : 'What’s on your mind'
                }
              />
            )}
          </FormField>

          {mode !== 'general' ? (
            <FormField label="Category">
              {(field) => (
                <Select
                  {...field}
                  value={category}
                  onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                >
                  {FEEDBACK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          ) : null}

          <FormField
            label={
              mode === 'feature_request'
                ? 'Describe it — and why it would help you'
                : mode === 'bug'
                  ? 'What happened, and what did you expect?'
                  : 'How can Kloyya become your favorite tool?'
            }
          >
            {(field) => (
              <Textarea
                {...field}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={4}
              />
            )}
          </FormField>

          {mode === 'bug' ? (
            <FormField label="Steps to reproduce (optional)">
              {(field) => (
                <Textarea
                  {...field}
                  value={steps}
                  onChange={(event) => setSteps(event.target.value)}
                  rows={3}
                  placeholder="1. …&#10;2. …"
                />
              )}
            </FormField>
          ) : null}

          {mode === 'general' ? (
            <div>
              <span className="text-small text-foreground mb-1.5 block">
                How would you rate Kloyya so far?
              </span>
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                    onClick={() => setRating(n)}
                    className="text-subtle hover:text-warning rounded-sm p-0.5"
                  >
                    <Star
                      aria-hidden="true"
                      className={cn('size-6', n <= rating && 'fill-warning text-warning')}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <Button
            onClick={() => void submit()}
            isDisabled={body.trim().length === 0}
            isLoading={submitting}
            loadingLabel="Sending"
            leadingIcon={<Send aria-hidden="true" />}
          >
            Submit
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <CardTitle as="h2">Refer a friend</CardTitle>
          <CardDescription>Know someone who’d love Kloyya? Invite them to the beta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={referralLink} readOnly aria-label="Your invite link" className="font-mono" />
            <Button variant="secondary" onClick={() => void copyLink()} leadingIcon={<Copy aria-hidden="true" />}>
              Copy
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <a href={`mailto:?subject=Join me on Kloyya&body=${encodeURIComponent(`${shareText} ${referralLink}`)}`}>
                <Mail aria-hidden="true" className="size-4" /> Email
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Linkedin aria-hidden="true" className="size-4" /> LinkedIn
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referralLink)}`}
                target="_blank"
                rel="noreferrer"
              >
                Share on X
              </a>
            </Button>
          </div>
          <p className="text-caption text-subtle">
            Beta referrals earn early access and a say in the roadmap — no monetary rewards yet.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <CardTitle as="h2">Your beta status</CardTitle>
          <CardDescription>The mark you’ve made so far.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Ideas submitted" value={summary?.featureRequests} />
            <Stat label="Bugs reported" value={summary?.bugsReported} />
            <Stat label="Feedback left" value={summary?.generalFeedback} />
            <Stat label="Total" value={summary?.total} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <dd className="text-heading-s text-foreground font-semibold">{value ?? '—'}</dd>
      <dt className="text-caption text-subtle">{label}</dt>
    </div>
  );
}

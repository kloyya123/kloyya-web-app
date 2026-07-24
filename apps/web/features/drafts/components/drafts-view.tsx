'use client';

import { Check, FileText, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, EmptyState, Input, Textarea, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { toErrorPresentation } from '@/lib/error-presentation';
import { useAuth } from '@/providers/auth-provider';
import { services, type Draft, type DraftType } from '@/services';

/**
 * Drafts.
 *
 * A list of what you're writing on the left, an editor on the right. The editor
 * autosaves — a debounced PATCH on every keystroke pause — so the "Save" button
 * that would be here on any other product is absent on purpose: there is nothing
 * to press, and nothing you can lose. The save indicator tells the truth about
 * where each keystroke stands.
 */
const TYPE_LABEL: Record<DraftType, string> = {
  email: 'Email',
  note: 'Note',
  report: 'Report',
  document: 'Document',
  meeting_summary: 'Meeting summary',
};

type SaveState = 'idle' | 'saving' | 'saved';

const AUTOSAVE_MS = 800;

export function DraftsView() {
  const { session } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [idea, setIdea] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const select = useCallback((draft: Draft) => {
    setSelectedId(draft.id);
    setTitle(draft.title);
    setBody(draft.body);
    setSaveState('idle');
  }, []);

  useEffect(() => {
    let alive = true;
    services.drafts
      .list()
      .then((list) => {
        if (!alive) return;
        setDrafts(list);
        setLoading(false);
        if (list[0]) select(list[0]);
      })
      .catch((error) => {
        if (!alive) return;
        setLoadError(error);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [select]);

  // Debounced autosave. Every edit reschedules; a pause commits the patch.
  const scheduleSave = useCallback(
    (patch: { title: string; body: string }) => {
      if (!selectedId) return;
      setSaveState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          const updated = await services.drafts.update(selectedId, patch);
          setDrafts((prev) =>
            prev
              .map((d) => (d.id === updated.id ? updated : d))
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          );
          setSaveState('saved');
        } catch {
          setSaveState('idle');
        }
      }, AUTOSAVE_MS);
    },
    [selectedId],
  );

  async function newDraft() {
    const created = await services.drafts.create({ type: 'note' });
    setDrafts((prev) => [created, ...prev]);
    select(created);
  }

  const aiDraftingEnabled = session?.preferences.aiDraftingEnabled ?? false;

  // Give Kloyya an idea, watch it draft, then edit — the created draft is
  // selected so the user lands straight in the editor, not on a toast.
  async function generate() {
    const value = idea.trim();
    if (value.length === 0 || isGenerating) return;
    setIsGenerating(true);
    try {
      const created = await services.drafts.generate({ type: 'note', idea: value });
      setDrafts((prev) => [created, ...prev]);
      select(created);
      setIdea('');
    } catch (error) {
      toast.error(toErrorPresentation(error).title);
    } finally {
      setIsGenerating(false);
    }
  }

  async function remove(id: string) {
    await services.drafts.remove(id);
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (id === selectedId) {
        if (next[0]) select(next[0]);
        else {
          setSelectedId(null);
          setTitle('');
          setBody('');
        }
      }
      return next;
    });
  }

  const selected = drafts.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-m text-foreground font-semibold">Drafts</h1>
          <p className="text-small text-muted-foreground">
            Everything you’re writing, saved as you type.
          </p>
        </div>
        <Button size="sm" onClick={() => void newDraft()} leadingIcon={<Plus aria-hidden="true" />}>
          New draft
        </Button>
      </header>

      {aiDraftingEnabled ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void generate();
          }}
          className="border-border bg-surface focus-within:border-muted flex items-center gap-2 rounded-lg border p-2"
        >
          <Sparkles aria-hidden="true" className="text-primary ml-1 size-4 shrink-0" />
          <Input
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder="Give Kloyya an idea to draft — “a follow-up email to the Acme team about the Q3 timeline”"
            aria-label="Draft from an idea"
            className="min-w-0 flex-1 border-0 bg-transparent focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="sm"
            isLoading={isGenerating}
            loadingLabel="Drafting"
            isDisabled={idea.trim().length === 0}
          >
            Draft it
          </Button>
        </form>
      ) : null}

      {loading ? (
        <p className="text-small text-subtle">Loading your drafts…</p>
      ) : loadError ? (
        <p role="alert" className="text-small text-critical">
          {toErrorPresentation(loadError).title}
        </p>
      ) : drafts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No drafts yet"
          description="Start a draft, or ask Kloyya to write one for you."
          action={
            <Button size="sm" onClick={() => void newDraft()} leadingIcon={<Plus aria-hidden="true" />}>
              New draft
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* The list. */}
          <ul className="space-y-1" aria-label="Your drafts">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <button
                  type="button"
                  onClick={() => select(draft)}
                  aria-current={draft.id === selectedId}
                  className={cn(
                    'w-full rounded-md border px-3 py-2.5 text-left transition-colors',
                    draft.id === selectedId
                      ? 'border-border bg-hover'
                      : 'border-transparent hover:bg-hover',
                  )}
                >
                  <span className="text-small text-foreground block truncate font-medium">
                    {draft.title.trim() || 'Untitled'}
                  </span>
                  <span className="text-caption text-subtle">
                    {TYPE_LABEL[draft.type]} · {formatRelativeTime(draft.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* The editor. */}
          {selected ? (
            <div className="border-border bg-surface min-w-0 space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-caption text-subtle">{TYPE_LABEL[selected.type]}</span>
                <div className="flex items-center gap-3">
                  <SaveIndicator state={saveState} />
                  <button
                    type="button"
                    onClick={() => void remove(selected.id)}
                    className="text-subtle hover:text-critical rounded-sm p-1"
                    aria-label="Delete draft"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>

              <Input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  scheduleSave({ title: event.target.value, body });
                }}
                placeholder="Title"
                aria-label="Draft title"
                className="text-body border-0 px-0 font-medium focus-visible:ring-0"
              />

              <Textarea
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  scheduleSave({ title, body: event.target.value });
                }}
                placeholder="Start writing…"
                aria-label="Draft body"
                rows={16}
                className="resize-none border-0 px-0 focus-visible:ring-0"
              />
            </div>
          ) : (
            <div className="border-border text-subtle text-small flex items-center justify-center rounded-lg border border-dashed p-10">
              Select a draft, or start a new one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <span className="text-caption text-subtle flex items-center gap-1.5">
        <Loader2 aria-hidden="true" className="size-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="text-caption text-subtle flex items-center gap-1.5">
        <Check aria-hidden="true" className="size-3" /> Saved
      </span>
    );
  }
  return null;
}

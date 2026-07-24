/**
 * Drafts — the writing-in-progress contract.
 *
 * Emails, notes, reports, documents, meeting summaries. The editor autosaves via
 * `update`, so a draft is something you cannot lose; `remove` is a soft delete on
 * the server, recoverable, but from the UI it simply goes away.
 */
export const DRAFT_TYPES = ['email', 'note', 'report', 'document', 'meeting_summary'] as const;
export type DraftType = (typeof DRAFT_TYPES)[number];

export const DRAFT_STATUSES = ['active', 'archived'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export interface Draft {
  id: string;
  type: DraftType;
  title: string;
  body: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ListDraftsQuery {
  status?: DraftStatus;
  type?: DraftType;
}

export interface CreateDraftInput {
  type: DraftType;
  title?: string;
  body?: string;
}

export interface UpdateDraftInput {
  title?: string;
  body?: string;
  type?: DraftType;
  status?: DraftStatus;
}

export interface GenerateDraftInput {
  type: DraftType;
  /** The one-line idea Kloyya writes a first pass from. */
  idea: string;
}

export interface DraftService {
  list(query?: ListDraftsQuery): Promise<Draft[]>;
  create(input: CreateDraftInput): Promise<Draft>;
  get(id: string): Promise<Draft>;
  /** Autosave — a patch. Throws ApiError 404 if the draft is gone. */
  update(id: string, patch: UpdateDraftInput): Promise<Draft>;
  remove(id: string): Promise<void>;
  /** Throws ApiError — `ai_drafting_disabled` (403) or `ai_unconfigured`/`ai_unavailable` (503). */
  generate(input: GenerateDraftInput): Promise<Draft>;
}

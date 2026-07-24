import { now } from '@/lib/clock';
import { API_STATUS } from '@/types/api';
import { mockError, mockRespond } from '../http/mock-transport';
import type {
  CreateDraftInput,
  Draft,
  DraftService,
  GenerateDraftInput,
  ListDraftsQuery,
  UpdateDraftInput,
} from './types';

/**
 * The mock DraftService — an in-memory store.
 *
 * Real drafts live behind the HTTP service; this one keeps the feature demoable
 * and testable without a backend. It is genuinely stateful (create, autosave,
 * delete all persist for the session) so the editor's save loop is exercised for
 * real, and it rides the shared mock transport for latency and failure injection.
 */
function seed(): Draft[] {
  const ts = now().toISOString();
  return [
    {
      id: 'draft-welcome',
      type: 'note',
      title: 'Welcome to Drafts',
      body: 'Anything you start writing lands here and saves as you type. Ask Kloyya can draft for you too.',
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
    },
  ];
}

export class MockDraftService implements DraftService {
  private store = new Map<string, Draft>(seed().map((d) => [d.id, d]));

  async list(query: ListDraftsQuery = {}): Promise<Draft[]> {
    const status = query.status ?? 'active';
    const all = [...this.store.values()]
      .filter((d) => d.status === status && (!query.type || d.type === query.type))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return (await mockRespond(all)).data;
  }

  async create(input: CreateDraftInput): Promise<Draft> {
    const ts = now().toISOString();
    const draft: Draft = {
      id: `draft-${crypto.randomUUID()}`,
      type: input.type,
      title: input.title ?? '',
      body: input.body ?? '',
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(draft.id, draft);
    return (await mockRespond(draft)).data;
  }

  async get(id: string): Promise<Draft> {
    const draft = this.store.get(id);
    if (!draft) {
      return mockError(API_STATUS.NotFound, 'not_found', 'Draft not found.', 'It may have been deleted.', 'Pick another draft.');
    }
    return (await mockRespond(draft)).data;
  }

  async update(id: string, patch: UpdateDraftInput): Promise<Draft> {
    const existing = this.store.get(id);
    if (!existing) {
      return mockError(API_STATUS.NotFound, 'not_found', 'Draft not found.', 'It may have been deleted.', 'Pick another draft.');
    }
    const updated: Draft = { ...existing, ...patch, updatedAt: now().toISOString() };
    this.store.set(id, updated);
    return (await mockRespond(updated)).data;
  }

  async remove(id: string): Promise<void> {
    if (!this.store.delete(id)) {
      return mockError(API_STATUS.NotFound, 'not_found', 'Draft not found.', 'It may already be gone.', 'Refresh the list.');
    }
    await mockRespond(undefined);
  }

  /** No real model here — a plausible-looking first pass from the idea, so the
   *  demo shows the idea → generate → edit flow without a network or API key. */
  async generate(input: GenerateDraftInput): Promise<Draft> {
    const ts = now().toISOString();
    const draft: Draft = {
      id: `draft-${crypto.randomUUID()}`,
      type: input.type,
      title: input.idea.length > 60 ? `${input.idea.slice(0, 57)}...` : input.idea,
      body: `${input.idea}\n\n(A demo draft — connect a real AI provider to have Kloyya actually write this.)`,
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(draft.id, draft);
    return (await mockRespond(draft)).data;
  }
}

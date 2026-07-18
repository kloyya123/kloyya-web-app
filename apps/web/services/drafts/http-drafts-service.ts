import { apiFetch } from '../http/transport';
import type {
  CreateDraftInput,
  Draft,
  DraftService,
  ListDraftsQuery,
  UpdateDraftInput,
} from './types';

/** The real DraftService — maps one-to-one onto /v1/drafts/*. */
export class HttpDraftService implements DraftService {
  async list(query: ListDraftsQuery = {}): Promise<Draft[]> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.type) params.set('type', query.type);
    const qs = params.toString();
    return apiFetch<Draft[]>(`/v1/drafts${qs ? `?${qs}` : ''}`);
  }

  async create(input: CreateDraftInput): Promise<Draft> {
    return apiFetch<Draft>('/v1/drafts', { method: 'POST', body: input });
  }

  async get(id: string): Promise<Draft> {
    return apiFetch<Draft>(`/v1/drafts/${encodeURIComponent(id)}`);
  }

  async update(id: string, patch: UpdateDraftInput): Promise<Draft> {
    return apiFetch<Draft>(`/v1/drafts/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
  }

  async remove(id: string): Promise<void> {
    await apiFetch<void>(`/v1/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

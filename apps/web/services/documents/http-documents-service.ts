import { apiFetch, apiUpload } from '../http/transport';
import type { DocumentItem, DocumentList, DocumentService } from './types';

/** The real documents service — list/delete over JSON, upload over multipart. */
export class HttpDocumentService implements DocumentService {
  async list(): Promise<DocumentList> {
    return apiFetch<DocumentList>('/v1/documents');
  }

  async upload(file: File): Promise<DocumentItem> {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiUpload<DocumentItem>('/v1/documents', form);
  }

  async remove(id: string): Promise<void> {
    await apiFetch<{ id: string }>(`/v1/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

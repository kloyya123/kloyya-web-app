import { supabaseBrowser } from '@/lib/supabase/browser';
import { apiFetch, apiUpload } from '../http/transport';
import type { DocumentItem, DocumentList, DocumentService } from './types';

/**
 * The real documents service.
 *
 * Small files go through the API as multipart (simple). Larger ones use the
 * signed-URL flow — the browser uploads straight to Supabase Storage, past the
 * serverless function's ~4.5MB request-body limit, then a JSON finalize call
 * lands the row. The threshold sits comfortably under that limit.
 */
const DOCUMENTS_BUCKET = 'documents';
const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024; // 4MB — under Vercel's ~4.5MB cap

interface SignedUpload {
  path: string;
  token: string;
}

export class HttpDocumentService implements DocumentService {
  async list(): Promise<DocumentList> {
    return apiFetch<DocumentList>('/v1/documents');
  }

  async upload(file: File): Promise<DocumentItem> {
    if (file.size <= DIRECT_UPLOAD_THRESHOLD) {
      const form = new FormData();
      form.append('file', file, file.name);
      return apiUpload<DocumentItem>('/v1/documents', form);
    }
    return this.uploadViaSignedUrl(file);
  }

  /** Direct browser→storage upload, then a JSON finalize to land the row. */
  private async uploadViaSignedUrl(file: File): Promise<DocumentItem> {
    // 1. Ask the API for a one-time signed upload URL. The plan cap, the size,
    //    and the file type are all checked there, so an unsupported file is
    //    refused before the browser spends time uploading it.
    const signed = await apiFetch<SignedUpload>('/v1/documents/upload-url', {
      method: 'POST',
      body: { filename: file.name, size: file.size, mimeType: file.type },
    });

    // 2. PUT the bytes straight to Supabase Storage.
    const { error } = await supabaseBrowser()
      .storage.from(DOCUMENTS_BUCKET)
      .uploadToSignedUrl(signed.path, signed.token, file, {
        contentType: file.type || 'application/octet-stream',
      });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    // 3. Finalize: the server reads the bytes back, extracts text, lands the row.
    return apiFetch<DocumentItem>('/v1/documents', {
      method: 'POST',
      body: {
        path: signed.path,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await apiFetch<{ id: string }>(`/v1/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

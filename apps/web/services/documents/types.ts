/**
 * Documents — upload, list, delete. The bytes live in storage; the app sees this.
 */
export interface DocumentItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: 'processing' | 'ready' | 'failed';
  createdAt: string;
}

/** Where the workspace stands against its document allowance. */
export interface DocumentUsage {
  used: number;
  /** `null` = unlimited (Pro). */
  limit: number | null;
  remaining: number | null;
}

export interface DocumentList {
  items: DocumentItem[];
  usage: DocumentUsage;
}

export interface DocumentService {
  list(): Promise<DocumentList>;
  /** Throws ApiError — `document_limit_reached` (403) and `storage_unconfigured` (503) are handled by the UI. */
  upload(file: File): Promise<DocumentItem>;
  remove(id: string): Promise<void>;
}

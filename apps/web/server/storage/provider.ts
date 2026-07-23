import { createClient } from '@supabase/supabase-js';

/**
 * Object storage, behind one seam.
 *
 * Uploaded documents' bytes live here, not in Postgres. The rest of the app
 * knows only this interface: put bytes at a path, remove them later. Supabase
 * Storage is the beta implementation; a null one stands in when it isn't
 * configured, so the API boots and document upload degrades to an honest "not
 * configured" instead of crashing.
 */
export interface SignedUpload {
  /** The object path the client must upload to. */
  path: string;
  /** The one-time token that authorizes the client's direct upload to `path`. */
  token: string;
}

export interface StorageProvider {
  /** False when no backing store is configured — callers surface this, not a 500. */
  readonly configured: boolean;
  upload(params: { path: string; bytes: Buffer; contentType: string }): Promise<void>;
  remove(path: string): Promise<void>;
  /**
   * Mint a one-time signed upload URL so the BROWSER can PUT the bytes straight
   * to storage, bypassing the serverless function's request-body limit. The
   * server then reads them back with `download` to extract text.
   */
  createSignedUpload(path: string): Promise<SignedUpload>;
  /** Read an object's bytes back (server-side text extraction after a direct upload). */
  download(path: string): Promise<Buffer>;
}

/** Storage isn't set up on this server. A clear 503, never a stack trace. */
export class StorageUnconfiguredError extends Error {
  constructor() {
    super('Object storage is not configured on this server.');
    this.name = 'StorageUnconfiguredError';
  }
}

/** The bytes couldn't be written or removed. Transient — worth a retry. */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export interface StorageConfig {
  supabaseUrl?: string | undefined;
  serviceRoleKey?: string | undefined;
  bucket: string;
}

/** The no-store fallback. Every write is an honest refusal. */
const nullStorage: StorageProvider = {
  configured: false,
  async upload() {
    throw new StorageUnconfiguredError();
  },
  async remove() {
    // Nothing was stored, so nothing to remove — a no-op, not an error.
  },
  async createSignedUpload() {
    throw new StorageUnconfiguredError();
  },
  async download() {
    throw new StorageUnconfiguredError();
  },
};

function supabaseStorage(url: string, key: string, bucket: string): StorageProvider {
  // Service-role client: server-only, bypasses Storage RLS. Never reaches a browser.
  const client = createClient(url, key, { auth: { persistSession: false } });
  const store = client.storage.from(bucket);

  return {
    configured: true,
    async upload({ path, bytes, contentType }) {
      const { error } = await store.upload(path, bytes, { contentType, upsert: false });
      if (error) throw new StorageError(`Upload failed: ${error.message}`);
    },
    async remove(path) {
      const { error } = await store.remove([path]);
      if (error) throw new StorageError(`Remove failed: ${error.message}`);
    },
    async createSignedUpload(path) {
      const { data, error } = await store.createSignedUploadUrl(path);
      if (error || !data) throw new StorageError(`Could not sign upload: ${error?.message}`);
      return { path: data.path, token: data.token };
    },
    async download(path) {
      const { data, error } = await store.download(path);
      if (error || !data) throw new StorageError(`Download failed: ${error?.message}`);
      return Buffer.from(await data.arrayBuffer());
    },
  };
}

export function resolveStorageProvider(config: StorageConfig): StorageProvider {
  if (config.supabaseUrl && config.serviceRoleKey) {
    return supabaseStorage(config.supabaseUrl, config.serviceRoleKey, config.bucket);
  }
  return nullStorage;
}

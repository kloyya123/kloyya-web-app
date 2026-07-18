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
export interface StorageProvider {
  /** False when no backing store is configured — callers surface this, not a 500. */
  readonly configured: boolean;
  upload(params: { path: string; bytes: Buffer; contentType: string }): Promise<void>;
  remove(path: string): Promise<void>;
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
  };
}

export function resolveStorageProvider(config: StorageConfig): StorageProvider {
  if (config.supabaseUrl && config.serviceRoleKey) {
    return supabaseStorage(config.supabaseUrl, config.serviceRoleKey, config.bucket);
  }
  return nullStorage;
}

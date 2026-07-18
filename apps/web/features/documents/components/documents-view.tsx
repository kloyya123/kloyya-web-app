'use client';

import { FileText, Loader2, Search, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, EmptyState, Input } from '@/components/ui';
import { formatRelativeTime } from '@/lib/format';
import { toErrorPresentation } from '@/lib/error-presentation';
import { services, isApiError, type DocumentList } from '@/services';

/**
 * Documents.
 *
 * Upload files, see them listed, search them, delete them — and every uploaded
 * document becomes something Ask Kloyya can answer from. The plan's document cap
 * is shown plainly ("3 of 5") and the upload control disables at the limit, so
 * the boundary is visible before it's hit rather than as a surprise error. The
 * two honest failure modes — the cap, and storage not being configured — get real
 * copy, not a red box.
 *
 * Camera scan / OCR is deliberately absent for the beta (upload only); it lands
 * later without changing this surface.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsView() {
  const [data, setData] = useState<DocumentList | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    try {
      setData(await services.documents.list());
      setLoading(false);
    } catch (error) {
      setLoadError(error);
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onFile(file: File | undefined) {
    if (!file || uploading) return;
    setUploadError(null);
    setUploading(true);
    try {
      await services.documents.upload(file);
      await refresh();
    } catch (error) {
      if (isApiError(error) && error.errorCode === 'document_limit_reached') {
        setUploadError('You’ve reached your plan’s document limit. Delete one to add another.');
      } else if (isApiError(error) && error.errorCode === 'storage_unconfigured') {
        setUploadError('Uploads aren’t switched on here yet — storage isn’t configured.');
      } else {
        setUploadError(isApiError(error) ? error.message : 'Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function remove(id: string) {
    try {
      await services.documents.remove(id);
      await refresh();
    } catch (error) {
      setUploadError(isApiError(error) ? error.message : 'Could not delete that document.');
    }
  }

  if (loadError) {
    const presented = toErrorPresentation(loadError);
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-heading-m text-foreground mb-4 font-semibold">Documents</h1>
        <div role="alert" className="border-border rounded-lg border p-6 text-center">
          <p className="text-body text-foreground">{presented.title}</p>
          <p className="text-small text-muted-foreground mt-1">{presented.description}</p>
          <Button className="mt-4" variant="secondary" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const usage = data?.usage;
  const atLimit = usage?.remaining === 0;
  const items = (data?.items ?? []).filter((doc) =>
    doc.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading-m text-foreground font-semibold">Documents</h1>
          <p className="text-small text-muted-foreground">
            Upload files so Kloyya can search and answer from them.
          </p>
        </div>
        {usage ? (
          <p className="text-caption text-subtle">
            {usage.limit === null
              ? `${usage.used} uploaded`
              : `${usage.used} of ${usage.limit} used`}
          </p>
        ) : null}
      </header>

      <div>
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          onChange={(event) => void onFile(event.target.files?.[0])}
          aria-label="Upload a document"
        />
        <Button
          onClick={() => fileInput.current?.click()}
          isDisabled={atLimit || uploading}
          isLoading={uploading}
          loadingLabel="Uploading"
          leadingIcon={<Upload aria-hidden="true" />}
        >
          Upload a document
        </Button>
        {atLimit ? (
          <p className="text-caption text-subtle mt-2">
            You’ve reached your plan’s limit. Delete a document to upload another.
          </p>
        ) : null}
        {uploadError ? (
          <p role="alert" className="text-caption text-critical mt-2">
            {uploadError}
          </p>
        ) : null}
      </div>

      {(data?.items.length ?? 0) > 0 ? (
        <div className="relative">
          <Search
            aria-hidden="true"
            className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents"
            className="pl-9"
            aria-label="Search documents"
          />
        </div>
      ) : null}

      {loading ? (
        <div className="text-subtle flex items-center gap-2 py-8">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          <span className="text-small">Loading your documents…</span>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={query ? 'No documents match' : 'No documents yet'}
          description={
            query
              ? 'Try a different search.'
              : 'Upload a PDF, doc, or note and Kloyya will make it searchable.'
          }
        />
      ) : (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {items.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <FileText aria-hidden="true" className="text-subtle size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="text-small text-foreground block truncate">{doc.name}</span>
                <span className="text-caption text-subtle">
                  {formatBytes(doc.sizeBytes)} · added {formatRelativeTime(doc.createdAt)}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void remove(doc.id)}
                aria-label={`Delete ${doc.name}`}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

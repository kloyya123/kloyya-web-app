import { googleGet, SyncTokenExpiredError } from './google-http';

/**
 * The Google Drive API, metadata-only.
 *
 * The scope is drive.metadata.readonly — we can see that a file exists, its name,
 * type, owners and when it changed, but NOT open its contents. That is
 * deliberate: the card promises "index the documents your decisions depend on",
 * and knowing a file's shape is enough for search and context. Reading every
 * byte would be a far larger permission for data the pipeline doesn't yet use.
 *
 * Drive's incremental model is a single opaque page token, not a per-resource
 * cursor like Calendar. `changes.getStartPageToken` gives you "now"; on the next
 * sync `changes.list` from that token returns everything that changed since,
 * ending with a fresh token. An expired token is a 410, which the shared request
 * path already turns into SyncTokenExpiredError — the sync re-reads in full.
 */
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/** The fields we ask for — the metadata a file is, never its contents. */
const FILE_FIELDS = 'id,name,mimeType,modifiedTime,createdTime,trashed,webViewLink,owners(displayName,emailAddress),parents,size';

/** A file, exactly as Drive returns it. */
export interface RawDriveFile {
  id: string;
  name?: string;
  mimeType?: string;
  trashed?: boolean;
  [key: string]: unknown;
}

/** The token where the NEXT incremental sync should resume. */
export async function getDriveStartPageToken(params: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const body = await googleGet<{ startPageToken?: string }>(
    `${DRIVE_API}/changes/startPageToken`,
    params.accessToken,
    params.fetchImpl ?? fetch,
  );
  return body.startPageToken ?? null;
}

interface FilesListResponse {
  files?: RawDriveFile[];
  nextPageToken?: string;
}

/**
 * The current files, for a first sync.
 *
 * Only non-trashed files a user can actually reach are enumerated, newest first
 * and page-bounded — connecting Drive should surface what matters now, not spend
 * an hour paging a decade of archive before anything appears. Shared drives are
 * included so a team's files are not invisible just because no one person owns
 * them.
 */
export async function listDriveFiles(params: {
  accessToken: string;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}): Promise<RawDriveFile[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const files: RawDriveFile[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < (params.maxPages ?? 10); page += 1) {
    const url = new URL(`${DRIVE_API}/files`);
    url.searchParams.set('q', 'trashed = false');
    url.searchParams.set('orderBy', 'modifiedTime desc');
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('fields', `nextPageToken,files(${FILE_FIELDS})`);
    // A file in a shared drive belongs to the team, not one person; excluding it
    // would hide exactly the documents a workspace most needs indexed.
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    url.searchParams.set('supportsAllDrives', 'true');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const body = await googleGet<FilesListResponse>(url.toString(), params.accessToken, doFetch);
    for (const file of body.files ?? []) files.push(file);

    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }

  return files;
}

export interface DriveChange {
  fileId: string;
  removed: boolean;
  file: RawDriveFile | null;
}

export interface DriveChanges {
  changes: DriveChange[];
  /** Where the next incremental sync resumes. */
  nextPageToken: string | null;
}

/**
 * Everything that changed since `pageToken`.
 *
 * Drive marks a deletion two ways — `removed: true` for a file that left the
 * user's view entirely, and `file.trashed: true` for one moved to the bin. Both
 * are tombstones as far as Kloyya is concerned; the sync treats either as "gone".
 * `newStartPageToken` arrives only on the final page, so pagination is followed
 * to the end or the cursor is lost.
 */
export async function listDriveChanges(params: {
  accessToken: string;
  pageToken: string;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}): Promise<DriveChanges> {
  const doFetch = params.fetchImpl ?? fetch;
  const changes: DriveChange[] = [];
  let cursor: string | undefined = params.pageToken;
  let nextPageToken: string | null = null;

  for (let page = 0; page < (params.maxPages ?? 25); page += 1) {
    const url = new URL(`${DRIVE_API}/changes`);
    url.searchParams.set('pageToken', cursor!);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('includeRemoved', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set(
      'fields',
      `nextPageToken,newStartPageToken,changes(fileId,removed,file(${FILE_FIELDS}))`,
    );

    const body = await googleGet<{
      changes?: DriveChange[];
      nextPageToken?: string;
      newStartPageToken?: string;
    }>(url.toString(), params.accessToken, doFetch);

    for (const change of body.changes ?? []) {
      changes.push({
        fileId: change.fileId,
        removed: Boolean(change.removed),
        file: change.file ?? null,
      });
    }

    if (body.nextPageToken) {
      cursor = body.nextPageToken;
      continue;
    }
    nextPageToken = body.newStartPageToken ?? null;
    break;
  }

  return { changes, nextPageToken };
}

/** Whether a change means the file is gone from Kloyya's point of view. */
export function isDriveRemoval(change: DriveChange): boolean {
  return change.removed || change.file?.trashed === true;
}

/** Re-export so callers importing the connector don't reach into google-http. */
export { SyncTokenExpiredError };

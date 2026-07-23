/**
 * The shared Google request path.
 *
 * Every Google connector needs the same three judgements, and they are the ones
 * that decide whether a connector survives production — so they live in one
 * place rather than being re-decided per API:
 *
 *   410 / expired cursor -> our sync token is too old; re-read in full.
 *   429 / 5xx            -> Google having a moment, not a broken connection.
 *   4xx                  -> the grant no longer covers this; a real problem.
 */
export class SyncTokenExpiredError extends Error {
  constructor() {
    super('Google expired the sync token; a full resync is required.');
    this.name = 'SyncTokenExpiredError';
  }
}

/** Google is rate-limiting or briefly broken. Worth retrying; not worth panicking. */
export class GoogleTransientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GoogleTransientError';
  }
}

export async function googleGet<T>(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 410) throw new SyncTokenExpiredError();

  // 429 and 5xx are Google having a moment. A connector that treats them as
  // fatal disconnects customers over a blip.
  if (response.status === 429 || response.status >= 500) {
    throw new GoogleTransientError(`Google returned ${response.status}`, response.status);
  }

  if (!response.ok) {
    // 401/403 mean the grant no longer covers this call — a real problem the
    // caller must surface, not retry. The status is in the message because
    // callers (Gmail's aged-out historyId) need to tell 404 from the rest.
    throw new Error(`Google request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

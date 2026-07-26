/**
 * Apply the storage-layer backstop to the documents bucket.
 *
 * The application already refuses an unsupported type (server/documents/mime.ts),
 * but the application is not the only thing that can write to this bucket: a
 * leaked service-role key, a future Edge Function, or a direct API call all skip
 * it entirely. Setting the limit on the bucket means Storage itself rejects the
 * object, independently of any code we write.
 *
 * The list mirrors the application allowlist exactly. If the two drift, the app
 * refuses first and the user gets the better error — so app-stricter is safe,
 * bucket-stricter would produce a confusing storage failure at PUT time.
 *
 * Idempotent. Safe to re-run.
 */

const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const bucket = process.env['DOCUMENTS_BUCKET'] ?? 'documents';

if (!url || !serviceRoleKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

/** Mirrors ALLOWED_MIME_TYPES in apps/web/server/documents/mime.ts. */
const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/tab-separated-values',
  'application/json',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/tiff',
];

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

async function main(): Promise<void> {
  const response = await fetch(`${url}/storage/v1/bucket/${bucket}`, {
    method: 'PUT',
    headers: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      // Never public: objects are reached only through short-lived signed URLs.
      public: false,
      file_size_limit: MAX_UPLOAD_BYTES,
      allowed_mime_types: ALLOWED_MIME_TYPES,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`Failed to update bucket "${bucket}": ${response.status} ${text}`);
    process.exit(1);
  }

  console.log(`Bucket "${bucket}" hardened:`);
  console.log('  public:     false');
  console.log(`  size limit: ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`);
  console.log(`  mime types: ${ALLOWED_MIME_TYPES.length} allowed`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('Hardening failed:', error);
  process.exit(2);
});

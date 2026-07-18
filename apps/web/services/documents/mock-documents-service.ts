import { now } from '@/lib/clock';
import { mockRespond } from '../http/mock-transport';
import type { DocumentItem, DocumentList, DocumentService } from './types';

/**
 * The mock documents service.
 *
 * An in-memory shelf so the /documents screen — upload, list, delete, the Free
 * plan's 5-document cap — is fully drivable without a running API or object
 * storage. Uploads "succeed" instantly and count against the same cap the real
 * backend enforces, so the limit copy and the disabled dropzone are exercised for
 * real. State is module-scoped, matching how the mock services elsewhere behave.
 */
const FREE_LIMIT = 5;
let shelf: DocumentItem[] = [];

export class MockDocumentService implements DocumentService {
  async list(): Promise<DocumentList> {
    return (await mockRespond(snapshot())).data;
  }

  async upload(file: File): Promise<DocumentItem> {
    const item: DocumentItem = {
      id: crypto.randomUUID(),
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      status: 'ready',
      createdAt: now().toISOString(),
    };
    shelf = [item, ...shelf];
    return (await mockRespond(item)).data;
  }

  async remove(id: string): Promise<void> {
    shelf = shelf.filter((doc) => doc.id !== id);
    await mockRespond({ id });
  }
}

function snapshot(): DocumentList {
  return {
    items: shelf,
    usage: {
      used: shelf.length,
      limit: FREE_LIMIT,
      remaining: Math.max(0, FREE_LIMIT - shelf.length),
    },
  };
}

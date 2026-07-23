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

/** Real-clock timestamp so the activity list always reads as live, not frozen. */
const liveHoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

// A few documents already on the shelf, so the dashboard's Recent Activity and
// the /documents screen aren't empty on first open. Timestamps are live.
let shelf: DocumentItem[] = [
  {
    id: 'doc_q3_roadmap',
    name: 'Q3 Product Roadmap.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 248_000,
    status: 'ready',
    createdAt: liveHoursAgo(2),
  },
  {
    id: 'doc_investor_notes',
    name: 'Meeting Notes — Investor Call',
    mimeType: 'text/markdown',
    sizeBytes: 18_400,
    status: 'ready',
    createdAt: liveHoursAgo(3),
  },
  {
    id: 'doc_launch_plan',
    name: 'kloyya-launch-plan.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1_240_000,
    status: 'ready',
    createdAt: liveHoursAgo(5),
  },
];

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

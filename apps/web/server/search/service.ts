import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { syncRecords } from '@kloyya/db/schema';
import type { SearchDoc, SearchResult } from '@kloyya/core/search';
import { searchDocs } from '@/lib/search';
import { readEventTime, readEventTitle } from '../integrations/calendar-parse';
import { loadThreads } from '../inbox/service';
import { listTasks } from '../tasks/service';
import type { StartContext } from '../tenant';

/**
 * Cross-entity search, built from the same real records every other screen
 * reads — tasks, meetings, and email threads. Ranking is the exact pure
 * `searchDocs` scorer the mock has always used (lib/search.ts); only the
 * index behind it is now real.
 *
 * Deliberately narrower than the client's `SEARCH_KINDS` union
 * (project/person/article/recommendation are not indexed): none of those
 * four has both a real data source AND a real page to land on yet — the
 * mock's own stated rule is "nothing is indexed that has nowhere to go",
 * and a doc pointing at a page that doesn't exist breaks that rule rather
 * than honoring it. Each kind joins here once both halves are real.
 */

const MEETING_ROW_LIMIT = 500;
const TASK_PAGE_SIZE = 100;

async function loadMeetingDocs(db: AppDb, ctx: StartContext): Promise<SearchDoc[]> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({ externalId: syncRecords.externalId, payload: syncRecords.payload })
      .from(syncRecords)
      .where(
        and(
          eq(syncRecords.workspaceId, ctx.workspaceId),
          eq(syncRecords.resourceType, 'calendar_event'),
          isNull(syncRecords.deletedAtSource),
        ),
      )
      .orderBy(desc(syncRecords.fetchedAt))
      .limit(MEETING_ROW_LIMIT),
  );

  const docs: SearchDoc[] = [];
  for (const row of rows) {
    if (!row.payload || typeof row.payload !== 'object') continue;
    const payload = row.payload as Record<string, unknown>;
    const title = readEventTitle(payload);
    const startsAt = readEventTime(payload['start']);
    if (!title || !startsAt) continue;
    docs.push({
      id: row.externalId,
      kind: 'meeting',
      title,
      subtitle: new Date(startsAt) > new Date() ? 'Upcoming meeting' : 'Past meeting',
      href: `/meetings/${row.externalId}`,
      keywords: [],
    });
  }
  return docs;
}

async function loadEmailDocs(db: AppDb, ctx: StartContext): Promise<SearchDoc[]> {
  const threads = await loadThreads(db, ctx);
  return threads.map((thread) => ({
    id: thread.id,
    kind: 'email',
    title: thread.subject,
    subtitle: `Email · ${thread.senderName}`,
    href: `/inbox/${thread.id}`,
    keywords: [thread.senderName, thread.senderEmail],
  }));
}

async function loadTaskDocs(db: AppDb, ctx: StartContext): Promise<SearchDoc[]> {
  const page = await listTasks(db, ctx, { pageSize: TASK_PAGE_SIZE });
  return page.tasks.map((task) => ({
    id: task.id,
    kind: 'task',
    title: task.title,
    subtitle: `Task · ${task.priority}`,
    href: '/tasks',
    keywords: [task.status, task.priority],
  }));
}

export async function search(
  db: AppDb,
  ctx: StartContext,
  query: string,
  limit?: number,
): Promise<SearchResult[]> {
  const [taskDocs, meetingDocs, emailDocs] = await Promise.all([
    loadTaskDocs(db, ctx),
    loadMeetingDocs(db, ctx),
    loadEmailDocs(db, ctx),
  ]);
  return searchDocs([...taskDocs, ...meetingDocs, ...emailDocs], query, limit);
}

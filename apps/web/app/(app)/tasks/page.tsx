import type { Metadata } from 'next';
import { TasksView } from '@/features/tasks/components/tasks-view';
import { parseTaskQuery } from '@/features/tasks/task-query';

export const metadata: Metadata = {
  title: 'Tasks',
  description: 'Your work, ranked by priority.',
  robots: { index: false, follow: false },
};

/**
 * Filters are read and validated here, on the server.
 *
 * Same reasoning as the login page: `useSearchParams` would opt the whole
 * subtree out of prerendering, and it would hand a raw, attacker-controlled
 * query string to a client component. `parseTaskQuery` drops anything it does
 * not recognise, so `TasksView` receives a value that is already known-good.
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // `?status=a&status=b` arrives as an array. Take the first; the codec expects
  // the comma-separated form and will drop anything it cannot parse.
  const flat = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single !== undefined) flat.set(key, single);
  }

  return <TasksView filters={parseTaskQuery(flat)} />;
}

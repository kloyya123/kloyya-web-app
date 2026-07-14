import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TASK_FILTERS,
  parseTaskQuery,
  serializeTaskQuery,
  type TaskFilters,
} from './task-query';

const params = (search: string) => new URLSearchParams(search);

describe('parseTaskQuery', () => {
  it('returns the defaults for an empty query string', () => {
    expect(parseTaskQuery(params(''))).toEqual(DEFAULT_TASK_FILTERS);
  });

  it('defaults to ranking by Kloyya, not by due date', () => {
    // KDA models aiPriorityScore separately from the human-set priority.
    // The list order is Kloyya's judgment; the badge is the human's.
    expect(DEFAULT_TASK_FILTERS.sortBy).toBe('aiPriority');
    expect(DEFAULT_TASK_FILTERS.sortDirection).toBe('desc');
  });

  it('reads comma-separated status and priority filters', () => {
    const filters = parseTaskQuery(params('status=todo,blocked&priority=Critical,High'));

    expect(filters.status).toEqual(['todo', 'blocked']);
    expect(filters.priority).toEqual(['Critical', 'High']);
  });

  describe('treats the query string as untrusted input', () => {
    it('drops unknown status values', () => {
      const filters = parseTaskQuery(params('status=todo,<script>,nonsense'));
      expect(filters.status).toEqual(['todo']);
    });

    it('drops unknown priority values', () => {
      const filters = parseTaskQuery(params('priority=High,DROP TABLE tasks'));
      expect(filters.priority).toEqual(['High']);
    });

    it('falls back to the default sort field when it is not a known column', () => {
      expect(parseTaskQuery(params('sort=passwordHash')).sortBy).toBe('aiPriority');
    });

    it('falls back to the default sort direction', () => {
      expect(parseTaskQuery(params('dir=sideways')).sortDirection).toBe('desc');
    });

    it('deduplicates repeated values', () => {
      expect(parseTaskQuery(params('status=todo,todo,todo')).status).toEqual(['todo']);
    });

    it('trims and caps the search term', () => {
      expect(parseTaskQuery(params('q=%20%20atlas%20%20')).search).toBe('atlas');

      const long = 'a'.repeat(500);
      expect(parseTaskQuery(params(`q=${long}`)).search).toHaveLength(200);
    });

    it('ignores an empty projectId rather than filtering on the empty string', () => {
      expect(parseTaskQuery(params('project=')).projectId).toBeNull();
    });
  });

  it('reads the cursor verbatim, without decoding it', () => {
    const cursor = btoa('offset:20');
    expect(parseTaskQuery(params(`cursor=${encodeURIComponent(cursor)}`)).cursor).toBe(
      cursor,
    );
  });
});

describe('serializeTaskQuery', () => {
  it('omits every default, keeping shared URLs clean', () => {
    expect(serializeTaskQuery(DEFAULT_TASK_FILTERS).toString()).toBe('');
  });

  it('writes only the filters that differ from the defaults', () => {
    const filters: TaskFilters = {
      ...DEFAULT_TASK_FILTERS,
      status: ['todo'],
      search: 'atlas',
    };

    const search = serializeTaskQuery(filters);
    expect(search.get('status')).toBe('todo');
    expect(search.get('q')).toBe('atlas');
    expect(search.get('priority')).toBeNull();
    expect(search.get('sort')).toBeNull();
  });

  it('drops the cursor when the filters change', () => {
    // A cursor is only meaningful for the query that produced it. Carrying it
    // across a filter change lands the user on page 3 of a different list.
    const filters: TaskFilters = {
      ...DEFAULT_TASK_FILTERS,
      cursor: btoa('offset:20'),
      status: ['done'],
    };

    expect(serializeTaskQuery(filters, { resetCursor: true }).get('cursor')).toBeNull();
    expect(serializeTaskQuery(filters).get('cursor')).toBe(filters.cursor);
  });

  it('round-trips a fully specified filter set', () => {
    const filters: TaskFilters = {
      status: ['in_progress', 'blocked'],
      priority: ['Critical'],
      projectId: 'proj_atlas',
      search: 'timeline',
      sortBy: 'dueAt',
      sortDirection: 'asc',
      cursor: btoa('offset:40'),
    };

    expect(parseTaskQuery(serializeTaskQuery(filters))).toEqual(filters);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import {
  configureMockTransport,
  mockRespond,
  mockRespondCollection,
} from './mock-transport';

const ITEMS = Array.from({ length: 25 }, (_, index) => ({ id: `item_${index}` }));

describe('mock transport', () => {
  beforeEach(() => {
    configureMockTransport({ instant: true, failureRate: 0 });
  });

  describe('mockRespond', () => {
    it('wraps data in the KAS success envelope', async () => {
      const response = await mockRespond({ name: 'Atlas' });

      expect(response.data).toEqual({ name: 'Atlas' });
      expect(response.version).toBe('v1');
      expect(response.correlationId).toMatch(/^corr_/);
      expect(response.timing?.durationMs).toBeTypeOf('number');
    });

    it('gives every response a distinct correlation id', async () => {
      const [a, b] = await Promise.all([mockRespond(1), mockRespond(2)]);
      expect(a.correlationId).not.toBe(b.correlationId);
    });

    it('rejects with a 503 ApiError when failure injection is on', async () => {
      configureMockTransport({ instant: true, failureRate: 1 });

      await expect(mockRespond('anything')).rejects.toBeInstanceOf(ApiError);
      await expect(mockRespond('anything')).rejects.toMatchObject({
        httpStatus: 503,
        isRetryable: true,
      });
    });
  });

  describe('mockRespondCollection', () => {
    it('returns the first page and a next cursor', async () => {
      const response = await mockRespondCollection(ITEMS, { pageSize: 10 });

      expect(response.data).toHaveLength(10);
      expect(response.data[0]?.id).toBe('item_0');
      expect(response.pagination.currentCursor).toBeNull();
      expect(response.pagination.previousCursor).toBeNull();
      expect(response.pagination.nextCursor).toBeTypeOf('string');
      expect(response.pagination.pageSize).toBe(10);
      expect(response.pagination.totalCount).toBe(25);
    });

    it('walks forward through every page and stops', async () => {
      const seen: string[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < 10; page++) {
        const response = await mockRespondCollection(ITEMS, {
          pageSize: 10,
          ...(cursor !== undefined ? { cursor } : {}),
        });
        seen.push(...response.data.map((item) => item.id));

        if (response.pagination.nextCursor === null) break;
        cursor = response.pagination.nextCursor;
      }

      // Every item exactly once, in order, and the walk terminated.
      expect(seen).toEqual(ITEMS.map((item) => item.id));
    });

    it('reports no next cursor on the final page', async () => {
      const first = await mockRespondCollection(ITEMS, { pageSize: 20 });
      const nextCursor = first.pagination.nextCursor;
      if (nextCursor === null) throw new Error('Expected a next cursor after page one.');

      const second = await mockRespondCollection(ITEMS, {
        pageSize: 20,
        cursor: nextCursor,
      });

      expect(second.data).toHaveLength(5);
      expect(second.pagination.nextCursor).toBeNull();
      expect(second.pagination.previousCursor).toBeTypeOf('string');
    });

    it('keeps the cursor opaque', async () => {
      const response = await mockRespondCollection(ITEMS, { pageSize: 10 });
      // Nothing in the UI may read an offset out of this. A real keyset cursor
      // must be able to replace it without changing a single component.
      expect(response.pagination.nextCursor).not.toMatch(/^\d+$/);
      expect(response.pagination.nextCursor).not.toContain('offset');
    });

    it('clamps page size into 1..100', async () => {
      const tooSmall = await mockRespondCollection(ITEMS, { pageSize: 0 });
      expect(tooSmall.pagination.pageSize).toBe(1);

      const tooLarge = await mockRespondCollection(ITEMS, { pageSize: 5000 });
      expect(tooLarge.pagination.pageSize).toBe(100);
    });

    it('defaults to a page size of 20', async () => {
      const response = await mockRespondCollection(ITEMS);
      expect(response.pagination.pageSize).toBe(20);
      expect(response.data).toHaveLength(20);
    });

    it('starts from the top on a malformed cursor rather than erroring', async () => {
      // A user can hand-edit `?cursor=` in the address bar. That is a client
      // mistake, not a server error, and must never 500.
      const response = await mockRespondCollection(ITEMS, {
        pageSize: 5,
        cursor: 'not-a-real-cursor!!',
      });

      expect(response.data[0]?.id).toBe('item_0');
      expect(response.data).toHaveLength(5);
    });

    it('returns an empty page, not an error, past the end', async () => {
      const response = await mockRespondCollection(ITEMS, {
        pageSize: 10,
        cursor: btoa('offset:900'),
      });

      expect(response.data).toEqual([]);
      expect(response.pagination.nextCursor).toBeNull();
    });

    it('handles an empty source collection', async () => {
      const response = await mockRespondCollection([], { pageSize: 10 });

      expect(response.data).toEqual([]);
      expect(response.pagination.totalCount).toBe(0);
      expect(response.pagination.nextCursor).toBeNull();
      expect(response.pagination.previousCursor).toBeNull();
    });
  });
});

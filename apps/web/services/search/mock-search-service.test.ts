import { beforeEach, describe, expect, it } from 'vitest';
import { configureMockTransport } from '../http/mock-transport';
import { MockSearchService } from './mock-search-service';

describe('MockSearchService', () => {
  const service = new MockSearchService();

  beforeEach(() => {
    configureMockTransport({ instant: true, failureRate: 0 });
  });

  it('returns nothing for a blank query', async () => {
    expect(await service.search('   ')).toEqual([]);
  });

  it('finds records across kinds for a shared term', async () => {
    const results = await service.search('atlas');
    const kinds = new Set(results.map((r) => r.kind));
    // "Atlas" appears in a project, a meeting, tasks, and a recommendation.
    expect(kinds.size).toBeGreaterThan(1);
    expect(results.every((r) => r.score > 0)).toBe(true);
  });

  it('every result carries an openable href', async () => {
    const results = await service.search('atlas');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.href.startsWith('/'))).toBe(true);
  });

  it('finds a person by name', async () => {
    const results = await service.search('Amara');
    expect(results.some((r) => r.kind === 'person' && r.id === 'user_amara')).toBe(true);
  });

  it('respects the limit', async () => {
    const results = await service.search('a', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});

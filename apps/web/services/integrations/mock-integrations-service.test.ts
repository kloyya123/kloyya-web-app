import { beforeEach, describe, expect, it } from 'vitest';
import { INTEGRATION_CATALOG, INITIALLY_CONNECTED } from '@/mock/integrations';
import { API_STATUS } from '@/types/api';
import { ApiError } from '../http/errors';
import { configureMockTransport } from '../http/mock-transport';
import { MockIntegrationsService } from './mock-integrations-service';

configureMockTransport({ instant: true, failureRate: 0 });

async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('Expected the promise to reject with an ApiError.');
}

describe('MockIntegrationsService', () => {
  let integrations: MockIntegrationsService;

  beforeEach(() => {
    // Fresh instance per test: connection state is mutated, and one test's
    // disconnect must not leak into the next.
    integrations = new MockIntegrationsService();
  });

  describe('listConnections', () => {
    it('returns the full catalogue', async () => {
      const list = await integrations.listConnections();
      expect(list.length).toBe(INTEGRATION_CATALOG.length);
    });

    it('marks the initially-connected apps as connected, the rest as available', async () => {
      const list = await integrations.listConnections();
      const gmail = list.find((c) => c.definition.id === 'gmail');
      // A catalogue app the seed deliberately leaves unconnected.
      const untouched = list.find((c) => c.definition.id === 'outlook_calendar');

      expect(gmail?.status).toBe('connected');
      expect(untouched?.status).toBe('error');
    });

    it('carries the seeded error states through', async () => {
      const list = await integrations.listConnections();
      const errored = list.find((c) => c.definition.id === 'outlook_calendar');

      expect(errored?.status).toBe('error');
      expect(errored?.errorReason).toMatch(/paused/i);
    });

    it('filters by category', async () => {
      const calendar = await integrations.listConnections('calendar');
      expect(calendar.length).toBeGreaterThan(0);
      expect(calendar.every((c) => c.definition.category === 'calendar')).toBe(true);
    });
  });

  describe('connect', () => {
    it('moves an available integration to connected and stamps the sync time', async () => {
      const result = await integrations.connect('outlook');

      expect(result.status).toBe('connected');
      expect(result.lastSyncedAt).not.toBeNull();
    });

    it('rejects connecting something already connected', async () => {
      const error = await expectApiError(integrations.connect('gmail'));
      expect(error.httpStatus).toBe(API_STATUS.Conflict);
    });

    it('404s for an unknown integration', async () => {
      const error = await expectApiError(integrations.connect('nonsense'));
      expect(error.httpStatus).toBe(API_STATUS.NotFound);
    });
  });

  describe('disconnect', () => {
    it('returns a connected integration to available and clears its sync time', async () => {
      const result = await integrations.disconnect('gmail');

      expect(result.status).toBe('not_connected');
      expect(result.lastSyncedAt).toBeNull();
    });

    it('rejects disconnecting something not connected', async () => {
      const error = await expectApiError(integrations.disconnect('outlook'));
      expect(error.httpStatus).toBe(API_STATUS.Conflict);
    });
  });

  describe('pause and resume', () => {
    it('pauses a connected integration, then resumes it', async () => {
      const paused = await integrations.pause('gmail');
      expect(paused.status).toBe('paused');

      const resumed = await integrations.resume('gmail');
      expect(resumed.status).toBe('connected');
    });

    it('rejects pausing something that is not connected', async () => {
      const error = await expectApiError(integrations.pause('outlook_calendar'));
      expect(error.httpStatus).toBe(API_STATUS.Conflict);
    });
  });

  describe('reconnect', () => {
    it('recovers an errored integration and clears the error', async () => {
      const result = await integrations.reconnect('outlook_calendar');

      expect(result.status).toBe('connected');
      expect(result.errorReason).toBeUndefined();
      expect(result.lastSyncedAt).not.toBeNull();
    });

    it('rejects reconnecting a healthy integration', async () => {
      // Reconnect is a recovery action; there is nothing to recover on a
      // healthy connection.
      const error = await expectApiError(integrations.reconnect('gmail'));
      expect(error.httpStatus).toBe(API_STATUS.Conflict);
    });
  });

  describe('forceSync', () => {
    it('updates the last-synced time of a connected integration', async () => {
      const before = await integrations.getConnection('notion');
      const after = await integrations.forceSync('notion');

      expect(after.status).toBe('connected');
      expect(new Date(after.lastSyncedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(before.lastSyncedAt!).getTime(),
      );
    });

    it('rejects syncing something not connected', async () => {
      const error = await expectApiError(integrations.forceSync('outlook'));
      expect(error.httpStatus).toBe(API_STATUS.Conflict);
    });
  });

  describe('getSummary', () => {
    it('counts connected, needs-attention, and total for the dashboard widget', async () => {
      const summary = await integrations.getSummary();

      expect(summary.total).toBe(INTEGRATION_CATALOG.length);
      expect(summary.connected).toBe(INITIALLY_CONNECTED.length);
      // The two seeded error states (Teams, Salesforce).
      expect(summary.needsAttention).toBe(1);
    });

    it('reflects a new connection immediately', async () => {
      await integrations.connect('outlook');
      const summary = await integrations.getSummary();
      expect(summary.connected).toBe(INITIALLY_CONNECTED.length + 1);
    });
  });
});

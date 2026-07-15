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
      const figma = list.find((c) => c.definition.id === 'figma');

      expect(gmail?.status).toBe('connected');
      expect(figma?.status).toBe('not_connected');
    });

    it('carries the seeded error states through', async () => {
      const list = await integrations.listConnections();
      const salesforce = list.find((c) => c.definition.id === 'salesforce');

      expect(salesforce?.status).toBe('error');
      expect(salesforce?.errorReason).toMatch(/token expired/i);
    });

    it('filters by category', async () => {
      const crm = await integrations.listConnections('crm');
      expect(crm.length).toBeGreaterThan(0);
      expect(crm.every((c) => c.definition.category === 'crm')).toBe(true);
    });
  });

  describe('connect', () => {
    it('moves an available integration to connected and stamps the sync time', async () => {
      const result = await integrations.connect('figma');

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
      const error = await expectApiError(integrations.disconnect('figma'));
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
      const error = await expectApiError(integrations.pause('salesforce'));
      expect(error.httpStatus).toBe(API_STATUS.Conflict);
    });
  });

  describe('reconnect', () => {
    it('recovers an errored integration and clears the error', async () => {
      const result = await integrations.reconnect('salesforce');

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
      const before = await integrations.getConnection('jira');
      const after = await integrations.forceSync('jira');

      expect(after.status).toBe('connected');
      expect(new Date(after.lastSyncedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(before.lastSyncedAt!).getTime(),
      );
    });

    it('rejects syncing something not connected', async () => {
      const error = await expectApiError(integrations.forceSync('figma'));
      expect(error.httpStatus).toBe(API_STATUS.Conflict);
    });
  });

  describe('getSummary', () => {
    it('counts connected, needs-attention, and total for the dashboard widget', async () => {
      const summary = await integrations.getSummary();

      expect(summary.total).toBe(INTEGRATION_CATALOG.length);
      expect(summary.connected).toBe(INITIALLY_CONNECTED.length);
      // The two seeded error states (Teams, Salesforce).
      expect(summary.needsAttention).toBe(2);
    });

    it('reflects a new connection immediately', async () => {
      await integrations.connect('figma');
      const summary = await integrations.getSummary();
      expect(summary.connected).toBe(INITIALLY_CONNECTED.length + 1);
    });
  });
});

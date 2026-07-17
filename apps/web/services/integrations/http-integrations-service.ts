import type { IntegrationCategory, IntegrationConnection } from '@/types/integrations';
import { apiFetch } from '../http/transport';
import type { ConnectionSummary, IntegrationsService } from './types';

/**
 * The real IntegrationsService.
 *
 * Most of it maps one-to-one onto /v1/integrations/* — the mock and the API were
 * written to the same contract. The exception is `connect`, where OAuth reality
 * breaks the mock's assumption that connecting is synchronous.
 */
export class HttpIntegrationsService implements IntegrationsService {
  async listConnections(category?: IntegrationCategory): Promise<IntegrationConnection[]> {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return apiFetch<IntegrationConnection[]>(`/v1/integrations${query}`);
  }

  async getConnection(id: string): Promise<IntegrationConnection> {
    return apiFetch<IntegrationConnection>(`/v1/integrations/${encodeURIComponent(id)}`);
  }

  /**
   * Begin connecting — by leaving the page.
   *
   * The mock could return a connected integration because it had no real OAuth;
   * the real flow cannot. Connecting means sending the user to Google, and the
   * connection does not exist until they consent and Google redirects back to
   * /connections. So this asks the API for the authorization URL and navigates
   * to it; the returned promise never resolves, because the browser is gone by
   * the time it would. The /connections page reads `?status=` on return and
   * re-fetches the real state.
   *
   * This is the one place the mock's shape and OAuth disagree, and it disagrees
   * with the mock rather than lying to the user about a connection that isn't
   * live yet.
   */
  async connect(id: string): Promise<IntegrationConnection> {
    const { authorizationUrl } = await apiFetch<{ authorizationUrl: string }>(
      `/v1/integrations/${encodeURIComponent(id)}/connect`,
      { method: 'POST' },
    );

    if (typeof window === 'undefined') {
      // Off the browser (SSR, a test) there is nobody to consent — surface that
      // rather than pretending to navigate.
      throw new Error('Connecting requires a browser to complete the OAuth consent flow.');
    }

    window.location.assign(authorizationUrl);
    // Navigation has begun; this promise intentionally never settles.
    return new Promise<IntegrationConnection>(() => {});
  }

  /** Reconnecting is the same consent flow as connecting — re-granting access. */
  async reconnect(id: string): Promise<IntegrationConnection> {
    return this.connect(id);
  }

  async disconnect(id: string): Promise<IntegrationConnection> {
    return apiFetch<IntegrationConnection>(`/v1/integrations/${encodeURIComponent(id)}/disconnect`, {
      method: 'POST',
    });
  }

  async pause(id: string): Promise<IntegrationConnection> {
    return apiFetch<IntegrationConnection>(`/v1/integrations/${encodeURIComponent(id)}/pause`, {
      method: 'POST',
    });
  }

  async resume(id: string): Promise<IntegrationConnection> {
    return apiFetch<IntegrationConnection>(`/v1/integrations/${encodeURIComponent(id)}/resume`, {
      method: 'POST',
    });
  }

  /** Real work: reads the provider and lands what changed. Returns the connection. */
  async forceSync(id: string): Promise<IntegrationConnection> {
    const { connection } = await apiFetch<{ connection: IntegrationConnection }>(
      `/v1/integrations/${encodeURIComponent(id)}/sync`,
      { method: 'POST' },
    );
    return connection;
  }

  async getSummary(): Promise<ConnectionSummary> {
    return apiFetch<ConnectionSummary>('/v1/integrations/summary');
  }
}

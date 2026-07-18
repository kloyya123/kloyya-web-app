import { apiFetch } from '../http/transport';
import type { AskAnswer, AskService } from './types';

/** The real Ask Kloyya service — one POST to /v1/ask, envelope unwrapped. */
export class HttpAskService implements AskService {
  async ask(question: string): Promise<AskAnswer> {
    return apiFetch<AskAnswer>('/v1/ask', { method: 'POST', body: { question } });
  }
}

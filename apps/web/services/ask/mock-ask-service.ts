import { now } from '@/lib/clock';
import { mockRespond } from '../http/mock-transport';
import type { AskAnswer, AskService } from './types';

/**
 * The mock Ask Kloyya service.
 *
 * Real retrieval + a real model live behind the HTTP service; this one exists so
 * the assistant is demoable and testable without a running API or an API key. It
 * echoes the question back inside a plausible, evidence-shaped answer and cites a
 * couple of the mock organisation's sources, so the UI's answer + citations
 * layout is exercised for real — including the loading and error states, which
 * ride on the shared mock transport.
 */
export class MockAskService implements AskService {
  async ask(question: string): Promise<AskAnswer> {
    const freshness = now().toISOString();
    const answer: AskAnswer = {
      answer:
        `Based on your connected tools, here is what I found about “${question.trim()}”. ` +
        'Two sources touch on it — the details are cited below. Connect this demo to a ' +
        'real backend and API key to answer from your own Gmail, Calendar, Drive and Notion.',
      citations: [
        {
          source: 'Gmail',
          resourceType: 'message',
          label: 'Q3 planning — next steps',
          freshness,
        },
        {
          source: 'Google Calendar',
          resourceType: 'calendar_event',
          label: 'Leadership sync',
          freshness,
        },
      ],
      model: 'mock',
    };
    // Rides the shared mock transport, so failure injection and latency apply.
    return (await mockRespond(answer)).data;
  }
}

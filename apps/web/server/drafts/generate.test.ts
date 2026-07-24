import { describe, expect, it } from 'vitest';
import { AiError, type AiProvider } from '../ai/provider';
import { generateDraft } from './generate';

function fakeProvider(reply: string): AiProvider {
  return {
    name: 'openai',
    model: 'gpt-4o-mini',
    async complete() {
      return { text: reply };
    },
  };
}

const brokenProvider: AiProvider = {
  name: 'openai',
  model: 'gpt-4o-mini',
  async complete() {
    throw new AiError('host down');
  },
};

describe('generateDraft', () => {
  it('parses the model\'s TITLE/BODY reply into a draft', async () => {
    const provider = fakeProvider('TITLE: Standup notes\nBODY: We shipped the fix.\\nNext: monitor.');

    const outcome = await generateDraft('note', 'quick standup recap', provider);

    expect(outcome).toMatchObject({
      ok: true,
      draft: { title: 'Standup notes', body: 'We shipped the fix.\nNext: monitor.' },
    });
  });

  it('reports not_configured when no provider is available', async () => {
    const outcome = await generateDraft('note', 'anything', null);
    expect(outcome).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('reports unavailable when the model host is down', async () => {
    const outcome = await generateDraft('note', 'anything', brokenProvider);
    expect(outcome).toEqual({ ok: false, reason: 'unavailable' });
  });
});

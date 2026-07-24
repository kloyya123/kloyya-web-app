import type { AiProvider } from '../ai/provider';
import { AiError } from '../ai/provider';
import type { DraftType } from './service';

/**
 * Draft generation — the core version.
 *
 * An idea in, a title + body out, ready to edit. No style-matching, no
 * per-field granularity yet (that's the later phase); this is the "watch it
 * generate, then edit" flow the drafting feature scoped in for its first cut.
 * The model is asked for a strict, parseable shape so the editor never has to
 * guess where the title ends and the body begins.
 */
export interface GeneratedDraft {
  title: string;
  body: string;
}

export type GenerateOutcome =
  | { ok: true; draft: GeneratedDraft }
  | { ok: false; reason: 'not_configured' | 'unavailable' };

const TYPE_GUIDANCE: Record<DraftType, string> = {
  email: 'Write it as an email: a clear subject-worthy title, and a body with a greeting and sign-off.',
  note: 'Write it as a short, plain note. No greeting or sign-off needed.',
  report: 'Write it as a short report: a descriptive title, and a body with brief sections.',
  document: 'Write it as a working document: a clear title, and a body organized with headings.',
  meeting_summary: 'Write it as a meeting summary: a title naming the meeting, and a body covering what was discussed and any next steps.',
};

const SYSTEM_PROMPT = [
  'You draft written work from a one-line idea, for a person to review and edit',
  'before sending or publishing — never a finished, unreviewed output.',
  'Respond with EXACTLY two lines, nothing else:',
  'TITLE: <a short, specific title>',
  'BODY: <the full draft body, with \\n for line breaks>',
  'Do not add commentary, explanations, or markdown fences.',
].join('\n');

function parse(text: string): GeneratedDraft {
  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);
  const title = titleMatch?.[1]?.trim() ?? '';
  const body = (bodyMatch?.[1]?.trim() ?? text.trim()).replace(/\\n/g, '\n');
  return { title, body };
}

export async function generateDraft(
  type: DraftType,
  idea: string,
  provider: AiProvider | null,
  fetchImpl?: typeof fetch,
): Promise<GenerateOutcome> {
  if (!provider) return { ok: false, reason: 'not_configured' };

  try {
    const { text } = await provider.complete({
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Kind: ${TYPE_GUIDANCE[type]}\n\nIdea: ${idea}` },
      ],
      maxTokens: 900,
      ...(fetchImpl ? { fetchImpl } : {}),
    });
    return { ok: true, draft: parse(text) };
  } catch (error) {
    if (error instanceof AiError) return { ok: false, reason: 'unavailable' };
    throw error;
  }
}

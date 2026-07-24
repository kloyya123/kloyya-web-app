/**
 * Ask Kloyya — the assistant contract.
 *
 * A question in, an evidence-backed answer out, with the exact sources Kloyya was
 * allowed to use. The citations are the product's first principle made concrete:
 * no answer without the evidence beside it.
 */
export interface AskCitation {
  /** A friendly source name, e.g. "Gmail" or "Notion". */
  source: string;
  resourceType: string;
  label: string;
  /** ISO timestamp of when Kloyya last read this source. */
  freshness: string;
}

/** Where the workspace stands against its daily Ask allowance. */
export interface AskUsage {
  used: number;
  /** `null` = unlimited (Pro). */
  limit: number | null;
  remaining: number | null;
}

/**
 * Present when the question was actually a command Kloyya carried out —
 * "create a task to…", "new project called…" — rather than a question to
 * answer. The UI surfaces a link to the thing it made instead of prose only.
 */
export interface AskAction {
  type: 'task_created' | 'project_created';
  id: string;
  title: string;
  href: string;
}

export interface AskAnswer {
  answer: string;
  citations: AskCitation[];
  /** Which model answered, surfaced for transparency. */
  model: string;
  /** Present from the real API; the daily-limit counter for Free plans. */
  usage?: AskUsage;
  action?: AskAction;
}

export interface AskService {
  /** Throws ApiError — 503 `ai_unconfigured` or `ai_unavailable` are the two the UI handles. */
  ask(question: string): Promise<AskAnswer>;
}

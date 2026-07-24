/**
 * Ask Kloyya's command intents — "create a task to…", "new project called…".
 *
 * Deliberately rule-based, not a model call: the set of phrasings Kloyya acts
 * on is small and known, so a regex match is exact, free, and testable without
 * a network — the same "core version, simple, explicit toggle-free" scope the
 * drafting feature took. A model-based classifier is a later upgrade, not a
 * requirement for the first version of "tell Kloyya to do something".
 */
export type Intent =
  | { type: 'create_task'; title: string }
  | { type: 'create_project'; title: string };

const TASK_PATTERNS = [
  /^(?:create|add|make)\s+(?:a\s+|an\s+)?(?:new\s+)?task(?:\s*[:\-]|\s+to|\s+for)?\s+(.+)$/i,
  /^new task(?:\s*[:\-])?\s+(.+)$/i,
  /^remind me to\s+(.+)$/i,
];

const PROJECT_PATTERNS = [
  /^(?:create|add|make|start)\s+(?:a\s+|an\s+)?(?:new\s+)?project(?:\s*[:\-]|\s+called|\s+named)?\s+(?:called\s+|named\s+)?(.+)$/i,
  /^new project(?:\s*[:\-])?\s+(?:called\s+|named\s+)?(.+)$/i,
];

function cleanTitle(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, '').replace(/[.?!]+$/, '');
}

function matchFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const title = match?.[1] ? cleanTitle(match[1]) : '';
    if (title.length > 0) return title;
  }
  return null;
}

/** A task command wins over a project one if both somehow matched — task
 *  phrasings are checked first, since "task" is the more specific noun. */
export function detectIntent(question: string): Intent | null {
  const trimmed = question.trim();
  if (trimmed.length === 0) return null;

  const taskTitle = matchFirst(trimmed, TASK_PATTERNS);
  if (taskTitle) return { type: 'create_task', title: taskTitle };

  const projectTitle = matchFirst(trimmed, PROJECT_PATTERNS);
  if (projectTitle) return { type: 'create_project', title: projectTitle };

  return null;
}

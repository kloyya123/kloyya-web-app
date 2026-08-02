/**
 * Trusted web search — Level 3 of the source hierarchy.
 *
 * Kloyya's first principle is that every claim traces to evidence. Workspace
 * data satisfies that by construction: the user owns it and we cite the record.
 * The web does not, so everything here is built around keeping the distinction
 * visible rather than blending the two into one confident-sounding answer.
 *
 * THREE RULES THIS MODULE ENFORCES
 *
 * 1. Workspace first. The web is consulted only when the user's own data cannot
 *    answer the question (see `shouldSearchWeb`). That is the strategy doc's
 *    "Do I already know this?" branch, and it is what stops every question
 *    costing a search call and two seconds of latency.
 *
 * 2. Results are untrusted input. A search result is text written by a stranger
 *    that we are about to put in a model's context — exactly the threat
 *    server/ask/untrusted.ts exists for. It is fenced identically to email and
 *    documents, never treated as instruction.
 *
 * 3. Off by default. With no provider key configured this returns nothing and
 *    Ask Kloyya behaves precisely as it did before — workspace-only. The feature
 *    is enabled by adding a key, not by a code change, so a missing key degrades
 *    to the old behaviour rather than to an error.
 */

/** One external result, already reduced to what an answer can be built on. */
export interface WebResult {
  title: string;
  url: string;
  /** Extracted page content, not a link preview — the evidence itself. */
  content: string;
  /** Provider's own relevance score, 0..1, when it supplies one. */
  score?: number | undefined;
}

export interface WebSearchProvider {
  /** For citations and logging — never a secret. */
  readonly name: string;
  search(query: string, opts?: { limit?: number; signal?: AbortSignal }): Promise<WebResult[]>;
}

/**
 * How many results reach the model. Small on purpose: each one costs context,
 * and the tail of a search is where the unreliable sources live.
 */
const DEFAULT_LIMIT = 4;

/**
 * A search must not hold up an answer. Exceeded, we answer from workspace alone.
 *
 * 6s was too tight and silently killed almost every real Perplexity call — the
 * live test returned zero sources in exactly 6.0s, which is what exposed it.
 * With generation trimmed (see max_tokens below) a search now lands in ~3s, and
 * 12s leaves room for a slow one without making the user wait on a spinner for
 * evidence that only ever supplements what their own workspace already said.
 */
const SEARCH_TIMEOUT_MS = 12_000;

/** Longest excerpt kept per result, in characters. */
const MAX_CONTENT_CHARS = 1_200;

/**
 * Tavily — chosen because it returns extracted page CONTENT rather than a list
 * of links. A link list would force a second fetch-and-parse step per result,
 * which is both slower and a much larger SSRF surface than one call to a single
 * known host.
 *
 * The interface above is the point: swapping in Brave, Exa or a provider's
 * built-in search is a new adapter, not a change to the ask pipeline.
 */
class TavilyProvider implements WebSearchProvider {
  readonly name = 'tavily';

  constructor(private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async search(query: string, opts: { limit?: number; signal?: AbortSignal } = {}): Promise<WebResult[]> {
    const response = await this.fetchImpl('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: opts.limit ?? DEFAULT_LIMIT,
        // Tavily's own summarisation is deliberately NOT used: it would be an
        // unattributed claim entering the context ahead of the sources it came
        // from, which is the opposite of what this pipeline is for.
        include_answer: false,
        include_raw_content: false,
        search_depth: 'basic',
      }),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });

    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.status}`);
    }

    const body = (await response.json()) as { results?: unknown };
    if (!Array.isArray(body.results)) return [];

    return body.results
      .map((entry): WebResult | null => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Record<string, unknown>;
        const title = typeof row['title'] === 'string' ? row['title'].trim() : '';
        const url = typeof row['url'] === 'string' ? row['url'].trim() : '';
        const content = typeof row['content'] === 'string' ? row['content'].trim() : '';
        // A result without a URL cannot be cited, and an uncitable claim is
        // worse than no claim — drop it rather than let it into the context.
        if (!url || !title || !content) return null;
        return {
          title,
          url,
          content: content.slice(0, MAX_CONTENT_CHARS),
          score: typeof row['score'] === 'number' ? row['score'] : undefined,
        };
      })
      .filter((result): result is WebResult => result !== null);
  }
}

/**
 * Perplexity Sonar — a search-native model rather than a search index.
 *
 * Sonar answers a question AND returns the pages it used, over an
 * OpenAI-compatible endpoint. We keep the SOURCES and discard its prose: the
 * synthesised answer is the one thing we must not pass through, because it
 * would enter Kloyya's context as a confident claim whose reasoning we cannot
 * show the user. Kloyya's own model does the reasoning, over evidence Sonar
 * found, and cites it. Sonar is the researcher here, not the author.
 */
class PerplexityProvider implements WebSearchProvider {
  readonly name = 'perplexity';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(query: string, opts: { limit?: number; signal?: AbortSignal } = {}): Promise<WebResult[]> {
    const response = await this.fetchImpl('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: query }],
        /**
         * We are buying the source list, not the essay — so ask for the
         * shortest answer the API will accept and throw it away.
         *
         * This is a latency fix, not a cost one. Measured against the live API:
         * 256 tokens took 4.5s, 6.9s and 19.6s across three runs, while 16
         * tokens returns the SAME twenty sources in ~2.8s. Generation was the
         * slow part, and we were paying for prose we discard. (1 token is
         * rejected with a 400, so 16 is near the floor.)
         */
        max_tokens: 16,
      }),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });

    if (!response.ok) {
      throw new Error(`Perplexity search failed: ${response.status}`);
    }

    const body = (await response.json()) as {
      search_results?: unknown;
      citations?: unknown;
    };

    const limit = opts.limit ?? DEFAULT_LIMIT;

    // Preferred shape: full results with titles and snippets.
    if (Array.isArray(body.search_results)) {
      return body.search_results
        .map((entry): WebResult | null => {
          if (!entry || typeof entry !== 'object') return null;
          const row = entry as Record<string, unknown>;
          const url = typeof row['url'] === 'string' ? row['url'].trim() : '';
          const title = typeof row['title'] === 'string' ? row['title'].trim() : '';
          if (!url || !title) return null;
          const snippet =
            typeof row['snippet'] === 'string'
              ? row['snippet']
              : typeof row['date'] === 'string'
                ? `Published ${row['date']}.`
                : '';
          return { title, url, content: snippet.slice(0, MAX_CONTENT_CHARS) };
        })
        .filter((result): result is WebResult => result !== null)
        .slice(0, limit);
    }

    // Older shape: bare URLs. Citable, so still useful — the model is told
    // plainly that only the address is known, so it cannot invent contents.
    if (Array.isArray(body.citations)) {
      return body.citations
        .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        .slice(0, limit)
        .map((url) => ({
          title: safeHostname(url),
          url: url.trim(),
          content: '(no excerpt returned — open the link to read the source)',
        }));
    }

    return [];
  }
}

/** Hostname for a display label, or the raw string if it will not parse. */
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export interface WebSearchConfig {
  /** Perplexity Sonar. Preferred when both are set. */
  perplexityApiKey?: string | undefined;
  perplexityModel?: string | undefined;
  /** Tavily, as an alternative index-style provider. */
  tavilyApiKey?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
}

/**
 * The configured provider, or null when web search is switched off.
 *
 * Perplexity wins when both keys are present — it is search-native and returns
 * a source list in one call. Neither key means the feature stays dark and Ask
 * Kloyya answers from the workspace exactly as it did before.
 */
export function resolveWebSearch(config: WebSearchConfig): WebSearchProvider | null {
  const doFetch = config.fetchImpl ?? fetch;
  if (config.perplexityApiKey) {
    return new PerplexityProvider(
      config.perplexityApiKey,
      config.perplexityModel ?? 'sonar',
      doFetch,
    );
  }
  if (config.tavilyApiKey) return new TavilyProvider(config.tavilyApiKey, doFetch);
  return null;
}

/**
 * Signals that a question is asking about the world rather than the workspace.
 *
 * Deliberately narrow. A false positive costs a needless search; a false
 * negative just means we answer from the user's own data, which is the safer
 * failure. Kept as whole-word patterns so "newsletter" does not read as "news".
 */
const EXTERNAL_SIGNALS = [
  /\bcompetitors?\b/i,
  /\bmarket\b/i,
  /\bindustry\b/i,
  /\bnews\b/i,
  /\blatest\b/i,
  /\bpricing (?:of|for)\b/i,
  /\bdocumentation\b/i,
  /\bhow (?:do|does|to)\b/i,
  /\bwhat is\b/i,
  /\bbest practices?\b/i,
  /\bcompare\b/i,
  /\bregulations?\b/i,
];

/** Below this many workspace records, the workspace is treated as not covering it. */
const THIN_WORKSPACE_THRESHOLD = 2;

/**
 * Whether to reach outside the workspace for this question.
 *
 * The whole point is to NOT search most of the time. Two ways it fires:
 * the workspace turned up almost nothing, or the question is plainly about the
 * outside world even though the workspace did return something.
 */
export function shouldSearchWeb(question: string, workspaceRecordCount: number): boolean {
  if (workspaceRecordCount < THIN_WORKSPACE_THRESHOLD) return true;
  return EXTERNAL_SIGNALS.some((pattern) => pattern.test(question));
}

/**
 * Run a search, returning [] on any failure.
 *
 * Never throws. The web is a best-effort enrichment on top of an answer the
 * workspace can usually already give — a search provider having a bad minute
 * must degrade the answer, not fail the request.
 */
export async function searchWeb(
  provider: WebSearchProvider | null,
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<WebResult[]> {
  if (!provider) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    return await provider.search(query, { limit, signal: controller.signal });
  } catch {
    // Includes the timeout abort. Logged nowhere on purpose: a slow search is
    // an ordinary event, not an incident, and this runs on every thin question.
    return [];
  } finally {
    clearTimeout(timer);
  }
}

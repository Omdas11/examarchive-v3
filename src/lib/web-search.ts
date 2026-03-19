export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

interface TavilyResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }>;
}

const DEFAULT_SEARCH_URL = "https://api.tavily.com/search";
const MAX_SEARCH_RESULTS = 5;
const UNTRUSTED_INJECTION_PATTERNS = [
  /ignore\s+previous/gi,
  /ignore\s+all\s+instructions/gi,
  /system\s+prompt/gi,
  /developer\s+message/gi,
  /you\s+must\s+follow/gi,
];

function truncate(value: string, max = 320): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function sanitizeUntrustedSnippet(value: string): string {
  let sanitized = value;
  for (const pattern of UNTRUSTED_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[redacted]");
  }
  return sanitized;
}

export async function runWebSearch(query: string, maxResults = MAX_SEARCH_RESULTS): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  const endpoint = process.env.TAVILY_SEARCH_URL?.trim() || DEFAULT_SEARCH_URL;
  if (!apiKey || !query.trim()) return [];

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: Math.min(Math.max(maxResults, 1), MAX_SEARCH_RESULTS),
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as TavilyResponse;
    return (payload.results ?? [])
      .map((entry) => ({
        title: (entry.title ?? "").trim(),
        url: (entry.url ?? "").trim(),
        snippet: truncate(sanitizeUntrustedSnippet((entry.content ?? "").replace(/\s+/g, " ").trim())),
        score: typeof entry.score === "number" ? entry.score : undefined,
      }))
      .filter((entry) => entry.title && entry.url && entry.snippet);
  } catch {
    return [];
  }
}

export function formatSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) return "";
  return results
    .slice(0, MAX_SEARCH_RESULTS)
    .map((result, index) => {
      const scorePart = typeof result.score === "number" ? ` (score ${result.score.toFixed(2)})` : "";
      return `${index + 1}. ${result.title}${scorePart}\nURL: ${result.url}\nKey points: ${result.snippet}`;
    })
    .join("\n\n");
}

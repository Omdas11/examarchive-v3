/**
 * MD verification — word matcher for line highlight (pure, no D1).
 *
 * The PDF viewer renders a page, OCRs it in the browser (tesseract.js)
 * into word boxes, and this module finds where a question's words sit
 * on that page. Matching is by distinctive words in reading order:
 * the longest ordered run inside a sliding window of page words.
 * It tolerates OCR noise (a few words wrong or missing) but refuses
 * scattered matches, so a highlight never jumps across the page.
 */

export interface PageWord {
  /** Word text as OCR read it. */
  text: string;
  /** Bounding box, normalized 0..1 of the page. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface WordMatch {
  /** Union box of the matched words, normalized 0..1. */
  box: { x0: number; y0: number; x1: number; y1: number };
  /** Distinctive words matched. */
  matched: number;
  /** Distinctive words looked for. */
  total: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "for", "and", "or", "to", "is",
  "are", "was", "were", "what", "which", "how", "why", "when", "with",
  "from", "into", "that", "this", "these", "those", "it", "its", "by",
  "as", "at", "be", "do", "does", "answer", "following", "questions",
  "question", "any", "one", "two", "discuss", "explain", "state",
  "describe", "define", "write", "short", "note", "notes", "marks",
  "mark", "each", "all", "role", "give",
]);

/** Lower-case, strip punctuation. Keeps unicode letters (Bengali etc.). */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

/**
 * The words that identify a question: length 3+, not a stopword,
 * deduped, in order, at most 12. Returns [] when the text has no
 * usable words (e.g. Bengali-only, which this build does not match).
 */
export function distinctiveWords(text: string, max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\s+/)) {
    const word = normalizeWord(raw);
    if (word.length < 3 || STOPWORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= max) break;
  }
  return out;
}

function lcsIndices(
  query: string[],
  page: string[],
): { matched: string[]; span: number } {
  // Classic LCS DP, query rows x page columns. Query is short (<=12).
  const m = query.length;
  const n = page.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        query[i] === page[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  // Walk the table to recover the matched words and their page indexes.
  const matched: string[] = [];
  const indexes: number[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (query[i] === page[j]) {
      matched.push(query[i]);
      indexes.push(j);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  const span =
    indexes.length > 0 ? indexes[indexes.length - 1] - indexes[0] : 0;
  return { matched, span };
}

/**
 * Find a question's words on an OCR'd page. Returns the union box of
 * the matched words, or null when the match is too weak: fewer than 3
 * words, or under 60% of the distinctive words. Windows of 60 page
 * words keep the match local — a highlight never spans the page.
 */
export function findWordMatch(
  queryText: string,
  pageWords: PageWord[],
): WordMatch | null {
  const query = distinctiveWords(queryText);
  if (query.length < 3 || pageWords.length === 0) return null;
  const words = pageWords.map((w) => normalizeWord(w.text));
  const WINDOW = 60;
  const STEP = 30;
  let best: { matched: string[]; indexes: number[] } | null = null;
  for (let start = 0; start < words.length; start += STEP) {
    const windowWords = words.slice(start, start + WINDOW);
    if (windowWords.length < 3) break;
    const { matched, span } = lcsIndices(query, windowWords);
    if (matched.length < 3) continue;
    const indexes: number[] = [];
    // Recover page indexes of the matched words inside this window.
    let qi = 0;
    for (let k = 0; k < windowWords.length && qi < matched.length; k++) {
      if (windowWords[k] === matched[qi]) {
        indexes.push(start + k);
        qi++;
      }
    }
    const score = matched.length;
    const bestScore = best ? best.matched.length : 0;
    const bestSpan = best
      ? best.indexes[best.indexes.length - 1] - best.indexes[0]
      : Number.POSITIVE_INFINITY;
    if (score > bestScore || (score === bestScore && span < bestSpan)) {
      best = { matched, indexes };
    }
    if (start + WINDOW >= words.length) break;
  }
  if (!best) return null;
  if (best.matched.length < 3) return null;
  if (best.matched.length / query.length < 0.6) return null;
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  for (const idx of best.indexes) {
    const w = pageWords[idx];
    if (!w) continue;
    x0 = Math.min(x0, w.x0);
    y0 = Math.min(y0, w.y0);
    x1 = Math.max(x1, w.x1);
    y1 = Math.max(y1, w.y1);
  }
  if (x1 <= x0 || y1 <= y0) return null;
  return {
    box: { x0, y0, x1, y1 },
    matched: best.matched.length,
    total: query.length,
  };
}

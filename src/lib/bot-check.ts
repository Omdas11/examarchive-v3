/**
 * Bot detection by User-Agent substring.
 *
 * Shared by the PDF download route (bots are blocked from downloading)
 * and the view/download counters (bot hits must not inflate counts).
 * Moved here from `src/app/api/files/papers/[fileId]/route.ts` so the
 * counters reuse the exact same lists.
 */

/** Chatbots allowed to crawl pages (Google, Gemini, Claude, ChatGPT). */
const ALLOWED_BOT_SUBSTRINGS = [
  "Googlebot",
  "Google-Extended",
  "Gemini",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
];

/** Common bot / automation markers in a User-Agent. */
const BOT_SUBSTRINGS = [
  "bot",
  "crawler",
  "spider",
  "scraper",
  "HeadlessChrome",
  "curl",
  "python",
  "Go-http-client",
  "scrapy",
  "PostmanRuntime",
  "facebookexternalhit",
  "Twitterbot",
  "Slackbot",
  "LinkedInBot",
  "WhatsApp",
  "TelegramBot",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "PetalBot",
  "Bytespider",
  "YandexBot",
  "Bingbot",
  "DuckDuckBot",
  "Baiduspider",
  "Sogou",
  "Exabot",
];

export function isAllowedChatbot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return ALLOWED_BOT_SUBSTRINGS.some((s) => ua.includes(s.toLowerCase()));
}

export function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_SUBSTRINGS.some((s) => ua.includes(s.toLowerCase()));
}

/** True for any automated visitor, allowed chatbots included. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return isBot(userAgent) || isAllowedChatbot(userAgent);
}

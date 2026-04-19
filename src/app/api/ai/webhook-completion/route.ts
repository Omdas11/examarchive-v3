// Legacy alias for external callbacks that still target /api/ai/webhook-completion.
// Canonical endpoint is /api/ai/notify-completion.
export { POST } from "@/app/api/ai/notify-completion/route";

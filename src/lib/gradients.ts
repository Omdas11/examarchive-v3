/** Build a shared accent gradient for cards. */
export function makeAccentGradient(primary: string, secondary?: string) {
  const mid = secondary ?? "var(--color-primary)";
  return `linear-gradient(90deg, ${primary} 0%, ${mid} 60%, var(--color-primary) 100%)`;
}

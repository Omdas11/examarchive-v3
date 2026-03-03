export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-14rem)] items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-primary)" }}
        aria-label="Loading"
      />
    </div>
  );
}

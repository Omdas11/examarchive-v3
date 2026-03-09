export default function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-accent" />
      <div className="skeleton-body">
        {/* Title */}
        <div className="skeleton" style={{ height: 14, width: "75%" }} />
        {/* Subtitle */}
        <div className="skeleton" style={{ height: 10, width: "50%" }} />
        {/* Tags row */}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <div className="skeleton" style={{ height: 18, width: 48, borderRadius: 9999 }} />
          <div className="skeleton" style={{ height: 18, width: 40, borderRadius: 9999 }} />
          <div className="skeleton" style={{ height: 18, width: 56, borderRadius: 9999 }} />
        </div>
        {/* Meta line */}
        <div className="skeleton" style={{ height: 10, width: "60%", marginTop: 4 }} />
        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <div className="skeleton" style={{ height: 10, width: 60 }} />
          <div className="skeleton" style={{ height: 10, width: 50 }} />
        </div>
      </div>
    </div>
  );
}

/** Grid of skeleton cards for loading states */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

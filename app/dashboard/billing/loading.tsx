export default function BillingLoading() {
  return (
    <div>
      <div className="h-9 w-24 animate-pulse rounded bg-surface-overlay" />
      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-8 py-6">
          <div className="h-3 w-20 animate-pulse rounded bg-surface-overlay" />
          <div className="mt-3 h-7 w-40 animate-pulse rounded bg-surface-overlay" />
        </div>
        <div className="grid grid-cols-2 gap-px bg-border">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface px-8 py-5">
              <div className="h-3 w-24 animate-pulse rounded bg-surface-overlay" />
              <div className="mt-2 h-4 w-32 animate-pulse rounded bg-surface-overlay" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

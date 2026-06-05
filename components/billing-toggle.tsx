'use client';

export function BillingToggle({
  interval,
  onToggle,
}: {
  interval: 'monthly' | 'annual';
  onToggle: (interval: 'monthly' | 'annual') => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
      <button
        onClick={() => onToggle('monthly')}
        className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
          interval === 'monthly'
            ? 'bg-surface-overlay text-zinc-100 shadow-sm'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        Monthly
      </button>
      <button
        onClick={() => onToggle('annual')}
        className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
          interval === 'annual'
            ? 'bg-surface-overlay text-zinc-100 shadow-sm'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        Annual
        <span className="ml-1.5 text-xs text-accent">-17%</span>
      </button>
    </div>
  );
}

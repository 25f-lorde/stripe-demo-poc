const FALLBACK = {
  label: 'Unknown',
  classes: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
  dot: 'bg-zinc-400',
};

const STATUS_CONFIG: Record<string, { label: string; classes: string; dot: string }> = {
  active: {
    label: 'Active',
    classes: 'border-status-active/30 bg-status-active/10 text-status-active',
    dot: 'bg-status-active',
  },
  trialing: {
    label: 'Trial',
    classes: 'border-status-trialing/30 bg-status-trialing/10 text-status-trialing',
    dot: 'bg-status-trialing',
  },
  past_due: {
    label: 'Past due',
    classes: 'border-status-past-due/30 bg-status-past-due/10 text-status-past-due',
    dot: 'bg-status-past-due animate-pulse',
  },
  canceling: {
    label: 'Canceling',
    classes: 'border-status-canceling/30 bg-status-canceling/10 text-status-canceling',
    dot: 'bg-status-canceling',
  },
  canceled: {
    label: 'Canceled',
    classes: 'border-status-canceled/30 bg-status-canceled/10 text-status-canceled',
    dot: 'bg-status-canceled',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? FALLBACK;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${config.classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

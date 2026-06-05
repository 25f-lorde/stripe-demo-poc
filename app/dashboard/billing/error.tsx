'use client';

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h1 className="font-display text-3xl text-zinc-50">Billing</h1>
      <div className="mt-8 rounded-2xl border border-status-past-due/20 bg-status-past-due/5 p-8 text-center">
        <p className="text-status-past-due">
          Something went wrong loading your billing information.
        </p>
        <p className="mt-2 text-sm text-zinc-400">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-xl border border-border px-5 py-2.5 text-sm text-zinc-200 transition-all hover:border-accent"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

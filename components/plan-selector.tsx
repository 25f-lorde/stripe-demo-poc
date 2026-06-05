'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BillingToggle } from './billing-toggle';
import { previewPlanChange, confirmPlanChange } from '@/app/actions/subscription';

interface Plan {
  name: string;
  priceId: string;
  lookupKey: string;
  amount: number;
  interval: string;
}

interface PlanSelectorProps {
  plans: Plan[];
  currentPriceId: string;
  onClose: () => void;
}

export function PlanSelector({ plans, currentPriceId, onClose }: PlanSelectorProps) {
  const router = useRouter();
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    amountDue: number;
    currency: string;
    isUpgrade: boolean;
    description: string;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isPending, startTransition] = useTransition();

  const stripeInterval = interval === 'monthly' ? 'month' : 'year';
  const filteredPlans = plans.filter((p) => p.interval === stripeInterval);

  async function handleSelectPlan(priceId: string) {
    if (priceId === currentPriceId) return;
    setSelectedPriceId(priceId);
    setLoadingPreview(true);
    setPreview(null);

    const result = await previewPlanChange(priceId);
    if (result.success) {
      setPreview(result);
    } else {
      toast.error(result.error);
    }
    setLoadingPreview(false);
  }

  function handleConfirm() {
    if (!selectedPriceId) return;
    startTransition(async () => {
      const result = await confirmPlanChange(selectedPriceId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if ('requiresAction' in result && result.requiresAction) {
        toast.error('Additional authentication required. Please try again.');
        return;
      }
      toast.success('Plan updated!');
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="mt-6 animate-fade-up">
      {/* Interval toggle */}
      <div className="flex justify-center">
        <BillingToggle interval={interval} onToggle={setInterval} />
      </div>

      {/* Plan cards */}
      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {filteredPlans.map((plan) => {
          const isCurrent = plan.priceId === currentPriceId;
          const isSelected = plan.priceId === selectedPriceId;

          return (
            <button
              key={plan.priceId}
              onClick={() => handleSelectPlan(plan.priceId)}
              disabled={isCurrent}
              className={`relative rounded-2xl border p-6 text-left transition-all ${
                isCurrent
                  ? 'border-accent/30 bg-accent-dim cursor-default'
                  : isSelected
                    ? 'border-accent bg-surface-raised shadow-[0_0_24px_-8px_var(--color-accent-dim)]'
                    : 'border-border bg-surface hover:border-zinc-600'
              }`}
            >
              {isCurrent && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-950">
                  Current
                </span>
              )}

              {/* Radio indicator */}
              {!isCurrent && (
                <div className={`absolute top-6 right-6 h-5 w-5 rounded-full border-2 transition-all ${
                  isSelected ? 'border-accent bg-accent' : 'border-zinc-600'
                }`}>
                  {isSelected && (
                    <svg className="h-full w-full p-0.5 text-zinc-950" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              )}

              <h3 className="font-display text-xl text-zinc-100">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-mono text-3xl font-light tracking-tight text-zinc-50">
                  ${plan.amount / 100}
                </span>
                <span className="text-xs text-zinc-500">/{interval === 'monthly' ? 'mo' : 'yr'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Proration preview */}
      {(loadingPreview || preview) && selectedPriceId && (
        <div className="mt-6 animate-fade-up overflow-hidden rounded-2xl border border-border bg-surface">
          {loadingPreview ? (
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface px-6 py-4">
                  <div className="h-3 w-16 animate-pulse rounded bg-surface-overlay" />
                  <div className="mt-2 h-5 w-24 animate-pulse rounded bg-surface-overlay" />
                </div>
              ))}
            </div>
          ) : preview ? (
            <>
              <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
                <div className="bg-surface px-6 py-4">
                  <p className="text-xs text-zinc-500">
                    {preview.isUpgrade ? 'Amount due today' : 'Credit applied'}
                  </p>
                  <p className={`mt-1 font-mono text-sm ${preview.isUpgrade ? 'text-zinc-200' : 'text-status-active'}`}>
                    {preview.isUpgrade
                      ? `$${(preview.amountDue / 100).toFixed(2)}`
                      : `-$${(Math.abs(preview.amountDue) / 100).toFixed(2)}`}
                  </p>
                </div>
                <div className="bg-surface px-6 py-4">
                  <p className="text-xs text-zinc-500">Effective</p>
                  <p className="mt-1 font-mono text-sm text-zinc-200">Immediately</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border px-6 py-4">
                <p className="text-xs text-zinc-500">{preview.description}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setSelectedPriceId(null); setPreview(null); }}
                    className="rounded-xl border border-border px-5 py-2.5 text-sm text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-zinc-950 transition-all hover:bg-accent-hover disabled:opacity-50"
                  >
                    {isPending ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" />
                        </svg>
                        Confirming...
                      </span>
                    ) : (
                      'Confirm change'
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Close button if nothing selected */}
      {!selectedPriceId && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-5 py-2.5 text-sm text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

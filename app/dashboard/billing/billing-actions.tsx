'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PlanSelector } from '@/components/plan-selector';
import { CancelDialog } from '@/components/cancel-dialog';
import { toggleCancellation } from '@/app/actions/subscription';

interface BillingActionsProps {
  plans: Array<{ name: string; priceId: string; lookupKey: string; amount: number; interval: string }>;
  currentPriceId: string;
  cancelAtPeriodEnd: boolean;
  planName: string;
  accessUntil: string;
}

export function BillingActions({
  plans,
  currentPriceId,
  cancelAtPeriodEnd,
  planName,
  accessUntil,
}: BillingActionsProps) {
  const router = useRouter();
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleReactivate() {
    startTransition(async () => {
      const result = await toggleCancellation(false);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Subscription reactivated!');
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-3 border-t border-border px-8 py-5">
        {cancelAtPeriodEnd ? (
          <button
            onClick={handleReactivate}
            disabled={isPending}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-zinc-950 transition-all hover:bg-accent-hover disabled:opacity-50"
          >
            {isPending ? 'Reactivating...' : 'Keep my subscription'}
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowCancelDialog(true)}
              className="rounded-xl border border-border px-5 py-2.5 text-sm text-zinc-400 transition-all hover:border-status-past-due/50 hover:text-status-past-due"
            >
              Cancel subscription
            </button>
            <button
              onClick={() => setShowPlanSelector(!showPlanSelector)}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-zinc-950 transition-all hover:bg-accent-hover"
            >
              {showPlanSelector ? 'Close' : 'Change plan'}
            </button>
          </>
        )}
      </div>

      {/* Plan selector (expandable) */}
      {showPlanSelector && (
        <div className="border-t border-border px-8 py-6">
          <PlanSelector
            plans={plans}
            currentPriceId={currentPriceId}
            onClose={() => setShowPlanSelector(false)}
          />
        </div>
      )}

      {/* Cancel dialog (modal) */}
      {showCancelDialog && (
        <CancelDialog
          planName={planName}
          accessUntil={accessUntil}
          onClose={() => setShowCancelDialog(false)}
        />
      )}
    </>
  );
}

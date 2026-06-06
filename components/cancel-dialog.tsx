'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { toggleCancellation } from '@/app/actions/subscription';

interface CancelDialogProps {
  planName: string;
  accessUntil: string;
  onClose: () => void;
}

export function CancelDialog({ planName, accessUntil, onClose }: CancelDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const result = await toggleCancellation(true);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Subscription canceled. You retain access until ' + accessUntil + '.');
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md animate-fade-up rounded-2xl border border-border bg-surface-raised shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="border-b border-border px-8 pt-8 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-status-past-due/20 bg-status-past-due/10">
              <svg className="h-5 w-5 text-status-past-due" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 7v4m0 2.5h.01M3.07 16.5h13.86c1.1 0 1.78-1.2 1.22-2.15L11.22 3.58a1.4 1.4 0 00-2.44 0L1.85 14.35c-.56.95.12 2.15 1.22 2.15z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 className="font-display text-xl text-zinc-50">Cancel subscription</h2>
              <p className="mt-0.5 text-sm text-zinc-500">This action cannot be undone.</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="bg-surface px-5 py-3.5">
                <p className="text-xs text-zinc-500">Plan</p>
                <p className="mt-0.5 text-sm font-medium text-zinc-200">{planName}</p>
              </div>
              <div className="bg-surface px-5 py-3.5">
                <p className="text-xs text-zinc-500">Access until</p>
                <p className="mt-0.5 font-mono text-sm text-zinc-200">{accessUntil}</p>
              </div>
            </div>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-zinc-400">
            Your subscription will remain active until{' '}
            <span className="font-medium text-zinc-300">{accessUntil}</span>.
            After that, you will lose access to all premium features.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-8 py-5">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-5 py-2.5 text-sm text-zinc-300 transition-all hover:border-zinc-500 hover:text-zinc-100"
          >
            Keep subscription
          </button>
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-xl bg-status-past-due px-5 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" />
                </svg>
                Canceling...
              </span>
            ) : (
              'Cancel subscription'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

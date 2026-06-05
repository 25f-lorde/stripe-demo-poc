'use client';

import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { StripeProvider } from './stripe-provider';
import { createSetupIntent, setDefaultPaymentMethod } from '@/app/actions/payment-methods';

interface UpdatePaymentMethodProps {
  currentBrand: string | null;
  currentLast4: string | null;
}

function UpdateForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? 'Please check your card details');
      setProcessing(false);
      return;
    }

    const result = await createSetupIntent();
    if (!result.success || !result.clientSecret) {
      setError(result.success ? 'Failed to create setup' : result.error);
      setProcessing(false);
      return;
    }

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      clientSecret: result.clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/billing?sync=1`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Failed to save card');
      setProcessing(false);
      return;
    }

    // Set as default payment method
    if (setupIntent?.payment_method && typeof setupIntent.payment_method === 'string') {
      const setResult = await setDefaultPaymentMethod(setupIntent.payment_method);
      if (!setResult.success) {
        setError(setResult.error);
        setProcessing(false);
        return;
      }
    }

    toast.success('Payment method updated!');
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: 'tabs' }} />

      {error && (
        <div className="mt-4 rounded-xl border border-status-past-due/20 bg-status-past-due/5 px-4 py-3">
          <p className="text-sm text-status-past-due">{error}</p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={!stripe || !elements || processing}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-zinc-950 transition-all hover:bg-accent-hover disabled:opacity-50"
        >
          {processing ? (
            <span className="inline-flex items-center gap-2">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" />
              </svg>
              Saving...
            </span>
          ) : (
            'Save card'
          )}
        </button>
      </div>
    </form>
  );
}

export function UpdatePaymentMethod({ currentBrand, currentLast4 }: UpdatePaymentMethodProps) {
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  return (
    <div className="mt-12">
      <h2 className="font-display text-2xl text-zinc-50">Payment method</h2>

      {/* Current card */}
      {currentBrand && currentLast4 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between px-8 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-16 items-center justify-center rounded-lg border border-border bg-surface-overlay">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {currentBrand.toUpperCase().slice(0, 4)}
                </span>
              </div>
              <div>
                <p className="font-mono text-sm text-zinc-200">
                  <span className="text-zinc-500">****</span> {currentLast4}
                </p>
                <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  Default
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-xl border border-border px-5 py-2.5 text-sm text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200"
            >
              {showForm ? 'Cancel' : 'Update card'}
            </button>
          </div>
        </div>
      )}

      {/* No card */}
      {!currentBrand && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm text-zinc-500 transition-all hover:border-zinc-500 hover:text-zinc-300"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          Add payment method
        </button>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="mt-4 animate-fade-up overflow-hidden rounded-2xl border border-accent/30 bg-surface-raised">
          <div className="border-b border-border px-8 py-5">
            <h3 className="text-sm font-medium text-zinc-200">
              {currentBrand ? 'Update payment method' : 'Add payment method'}
            </h3>
          </div>
          <div className="px-8 py-6">
            <StripeProvider mode="setup">
              <UpdateForm onSuccess={() => { setShowForm(false); router.refresh(); }} />
            </StripeProvider>
          </div>
        </div>
      )}
    </div>
  );
}

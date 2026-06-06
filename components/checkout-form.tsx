'use client';

import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createSubscriptionAction } from '@/app/actions/checkout';

interface CheckoutFormProps {
  priceId: string;
}

export function CheckoutForm({ priceId }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    // Step 1: Validate the form
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? 'Please check your payment details');
      setProcessing(false);
      return;
    }

    // Step 2: Create subscription server-side
    const result = await createSubscriptionAction(priceId);
    if (!result.success) {
      setError(result.error);
      setProcessing(false);
      return;
    }

    // Step 3: Confirm payment client-side (handles 3DS automatically)
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret: result.clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/billing?sync=1`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed. Please try again.');
      setProcessing(false);
      return;
    }

    // Step 4: Payment succeeded — redirect with sync trigger
    toast.success('Subscription created!');
    router.push('/dashboard/billing?sync=1');
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: 'tabs' }} />

      {error && (
        <div className="mt-4 rounded-xl border border-status-past-due/20 bg-status-past-due/5 px-4 py-3">
          <p className="text-sm text-status-past-due">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || processing}
        className="mt-8 w-full rounded-xl bg-accent py-4 text-sm font-semibold text-zinc-950 transition-all hover:bg-accent-hover disabled:opacity-50"
      >
        {processing ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" />
            </svg>
            Processing...
          </span>
        ) : (
          'Subscribe'
        )}
      </button>

      <p className="mt-4 text-center text-xs text-zinc-600">
        By subscribing, you agree to our terms. Cancel anytime.
      </p>
    </form>
  );
}

'use client';

import { StripeProvider } from '@/components/stripe-provider';
import { CheckoutForm } from '@/components/checkout-form';

interface CheckoutClientProps {
  priceId: string;
  amount: number;
}

export function CheckoutClient({ priceId, amount }: CheckoutClientProps) {
  return (
    <StripeProvider mode="subscription" amount={amount}>
      <CheckoutForm priceId={priceId} />
    </StripeProvider>
  );
}

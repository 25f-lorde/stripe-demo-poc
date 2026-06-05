'use client';

import { StripeProvider } from '@/components/stripe-provider';
import { CheckoutForm } from '@/components/checkout-form';

interface CheckoutClientProps {
  priceId: string;
  amount: number;
  stripeCustomerId: string | null;
}

export function CheckoutClient({ priceId, amount, stripeCustomerId }: CheckoutClientProps) {
  return (
    <StripeProvider mode="subscription" amount={amount}>
      <CheckoutForm priceId={priceId} stripeCustomerId={stripeCustomerId} />
    </StripeProvider>
  );
}

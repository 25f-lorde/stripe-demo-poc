import 'server-only';

import { unstable_cache } from 'next/cache';
import { stripe } from './client';

export function getCachedCreditBalance(stripeCustomerId: string) {
  return unstable_cache(
    async () => {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (customer.deleted) return null;
      if (customer.balance >= 0) return null;
      return {
        amount: Math.abs(customer.balance),
        currency: customer.currency ?? 'usd',
      };
    },
    [`credit-balance-${stripeCustomerId}`],
    { revalidate: 3600, tags: [`credit-balance-${stripeCustomerId}`] }
  )();
}

import { unstable_cache } from 'next/cache';
import { stripe } from './client';
import type Stripe from 'stripe';

export const getCachedPrices = unstable_cache(
  async () => {
    const prices = await stripe.prices.list({
      active: true,
      type: 'recurring',
      expand: ['data.product'],
    });
    return prices.data;
  },
  ['stripe-prices'],
  { revalidate: 3600, tags: ['stripe-prices'] }
);

export function formatPrice(price: Stripe.Price): {
  priceId: string;
  productName: string;
  amount: number;
  currency: string;
  interval: string;
  lookupKey: string | null;
} {
  const product = price.product as Stripe.Product;
  return {
    priceId: price.id,
    productName: product.name,
    amount: (price.unit_amount ?? 0) / 100,
    currency: price.currency,
    interval: price.recurring?.interval ?? 'month',
    lookupKey: price.lookup_key ?? null,
  };
}

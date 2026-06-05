'use client';

import { useState } from 'react';
import { PricingCard } from './pricing-card';
import { BillingToggle } from './billing-toggle';

const PLANS = [
  {
    name: 'Starter',
    monthlyPrice: 9,
    features: [
      '1 user included',
      '5 GB storage',
      'Email support',
      'Basic analytics',
    ],
  },
  {
    name: 'Pro',
    monthlyPrice: 29,
    recommended: true,
    features: [
      '5 users included',
      '50 GB storage',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
    ],
  },
  {
    name: 'Enterprise',
    monthlyPrice: 99,
    features: [
      'Unlimited users',
      '500 GB storage',
      '24/7 phone support',
      'Custom analytics',
      'API access',
      'SSO authentication',
    ],
  },
];

interface PricingPageClientProps {
  prices: Array<{
    priceId: string;
    lookupKey: string | null;
    amount: number;
    interval: string;
    productName: string;
  }>;
  currentPriceId?: string | null;
}

export function PricingPageClient({ prices, currentPriceId }: PricingPageClientProps) {
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');

  // Map Stripe prices to plans by lookup key, then fallback to product name + interval
  function getPriceId(planName: string): string {
    const suffix = interval === 'monthly' ? 'monthly' : 'annual';
    const stripeInterval = interval === 'monthly' ? 'month' : 'year';
    const lookupKey = `${planName.toLowerCase()}_${suffix}`;

    // First: exact lookup key match
    const byLookup = prices.find((p) => p.lookupKey === lookupKey);
    if (byLookup) return byLookup.priceId;

    // Fallback: match by product name AND interval
    const byName = prices.find(
      (p) =>
        p.productName.toLowerCase().includes(planName.toLowerCase()) &&
        p.interval === stripeInterval
    );
    if (byName) return byName.priceId;

    return `price_placeholder_${planName.toLowerCase()}`;
  }

  return (
    <>
      <div className="mt-10 flex justify-center">
        <BillingToggle interval={interval} onToggle={setInterval} />
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:items-start">
        {PLANS.map((plan) => {
          const priceId = getPriceId(plan.name);
          return (
            <PricingCard
              key={plan.name}
              name={plan.name}
              price={plan.monthlyPrice}
              interval={interval}
              features={plan.features}
              recommended={plan.recommended}
              priceId={priceId}
              currentPlan={currentPriceId === priceId}
            />
          );
        })}
      </div>
    </>
  );
}

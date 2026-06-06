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

  function getLookupKey(planName: string): string {
    const suffix = interval === 'monthly' ? 'monthly' : 'annual';
    return `${planName.toLowerCase()}_${suffix}`;
  }

  function getPriceIdForLookupKey(lookupKey: string): string | null {
    return prices.find((p) => p.lookupKey === lookupKey)?.priceId ?? null;
  }

  return (
    <>
      <div className="mt-10 flex justify-center">
        <BillingToggle interval={interval} onToggle={setInterval} />
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:items-start">
        {PLANS.map((plan) => {
          const lookupKey = getLookupKey(plan.name);
          const priceId = getPriceIdForLookupKey(lookupKey);
          return (
            <PricingCard
              key={plan.name}
              name={plan.name}
              price={plan.monthlyPrice}
              interval={interval}
              features={plan.features}
              recommended={plan.recommended}
              lookupKey={lookupKey}
              currentPlan={currentPriceId != null && currentPriceId === priceId}
            />
          );
        })}
      </div>
    </>
  );
}

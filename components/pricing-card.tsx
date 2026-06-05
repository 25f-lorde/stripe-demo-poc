'use client';

import { useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { createCheckoutSession } from '@/app/actions/stripe';

function SubmitButton({
  recommended,
  currentPlan,
}: {
  recommended?: boolean;
  currentPlan?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={currentPlan || pending}
      className={`mt-8 w-full rounded-xl py-3.5 text-sm font-medium transition-all ${
        currentPlan
          ? 'cursor-default border border-border text-zinc-500'
          : recommended
            ? 'bg-accent text-zinc-950 hover:bg-accent-hover disabled:opacity-50'
            : 'border border-border text-zinc-200 hover:border-accent hover:text-zinc-100 disabled:opacity-50'
      }`}
    >
      {pending ? 'Redirecting...' : currentPlan ? 'Current plan' : 'Get started'}
    </button>
  );
}

interface PricingCardProps {
  name: string;
  price: number;
  interval: 'monthly' | 'annual';
  features: string[];
  recommended?: boolean;
  priceId: string;
  currentPlan?: boolean;
}

export function PricingCard({
  name,
  price,
  interval,
  features,
  recommended,
  priceId,
  currentPlan,
}: PricingCardProps) {
  const submittingRef = useRef(false);
  const annualPrice = Math.round(price * 10);
  const displayPrice = interval === 'monthly' ? price : annualPrice;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 ${
        recommended
          ? 'border-accent bg-surface-raised shadow-[0_0_40px_-12px_var(--color-accent-dim)] lg:-mt-4 lg:mb-4'
          : 'border-border bg-surface hover:border-zinc-600'
      }`}
    >
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-xs font-semibold text-zinc-950">
          Most popular
        </div>
      )}

      <h3 className="font-display text-2xl text-zinc-100">{name}</h3>

      <div className="mt-6 flex items-baseline gap-1">
        <span className="font-mono text-5xl font-light tracking-tight text-zinc-50">
          ${displayPrice}
        </span>
        <span className="text-sm text-zinc-500">
          /{interval === 'monthly' ? 'mo' : 'yr'}
        </span>
      </div>

      {interval === 'annual' && (
        <p className="mt-1 text-xs text-zinc-500">${price}/mo billed annually</p>
      )}

      <div className="my-8 h-px bg-border" />

      <ul className="flex flex-1 flex-col gap-3.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-zinc-300">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M3 8.5L6.5 12L13 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <form
        action={async () => {
          if (submittingRef.current) return;
          submittingRef.current = true;
          try {
            await createCheckoutSession(priceId);
          } finally {
            submittingRef.current = false;
          }
        }}
      >
        <SubmitButton recommended={recommended} currentPlan={currentPlan} />
      </form>
    </div>
  );
}

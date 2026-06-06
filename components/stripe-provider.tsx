'use client';

import { loadStripe } from '@stripe/stripe-js/pure';
import { Elements } from '@stripe/react-stripe-js';
import type { Appearance, StripeElementsOptions } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const appearance: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#4fd1c5',
    colorBackground: '#1c1c2e',
    colorText: '#fafafa',
    colorDanger: '#ef4444',
    borderRadius: '12px',
    fontFamily: '"Instrument Sans", system-ui, sans-serif',
    fontSizeBase: '14px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      backgroundColor: '#14141f',
      border: '1px solid #3a3a52',
      padding: '14px 16px',
    },
    '.Input:focus': {
      borderColor: '#4fd1c5',
      boxShadow: '0 0 0 1px rgba(79, 209, 197, 0.3)',
    },
    '.Label': {
      color: '#a1a1aa',
      fontSize: '12px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    '.Tab': {
      border: '1px solid #3a3a52',
      backgroundColor: '#14141f',
      color: '#a1a1aa',
    },
    '.Tab:hover': {
      color: '#fafafa',
    },
    '.Tab--selected': {
      borderColor: '#4fd1c5',
      backgroundColor: '#1c1c2e',
      color: '#fafafa',
    },
    '.TabIcon': {
      fill: '#a1a1aa',
    },
    '.TabIcon--selected': {
      fill: '#4fd1c5',
    },
  },
};

interface StripeProviderProps {
  children: React.ReactNode;
  mode: 'subscription' | 'setup';
  amount?: number;
  currency?: string;
}

export function StripeProvider({ children, mode, amount, currency = 'usd' }: StripeProviderProps) {
  const options = mode === 'subscription'
    ? { mode: 'subscription' as const, amount: amount ?? 0, currency, appearance }
    : { mode: 'setup' as const, currency, appearance };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}

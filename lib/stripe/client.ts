import 'server-only';

import Stripe from 'stripe';

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  if (key.startsWith('pk_')) {
    throw new Error('STRIPE_SECRET_KEY contains a publishable key, not a secret key');
  }
  return key;
}

export const stripe = new Stripe(getStripeSecretKey());

'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { users, subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe/client';
import { getCachedPrices } from '@/lib/stripe/plans';
import { syncFromSubscription } from '@/lib/stripe/sync';
import { revalidatePath } from 'next/cache';
import type Stripe from 'stripe';

type SubscriptionResult =
  | { success: true; clientSecret: string; subscriptionId: string }
  | { success: false; error: string };

export async function createSubscriptionAction(priceId: string): Promise<SubscriptionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  // Validate priceId against actual Stripe prices
  const prices = await getCachedPrices();
  const validPriceIds = new Set(prices.map((p) => p.id));
  if (!priceId || !validPriceIds.has(priceId)) {
    return { success: false, error: 'Invalid plan selected' };
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) return { success: false, error: 'User not found' };

  // Get or create Stripe customer
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create(
      { email: user.email, metadata: { userId: user.id } },
      { idempotencyKey: `create-customer-${user.id}` }
    );
    stripeCustomerId = customer.id;
    await db.update(users)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  // BUG FIX #4: Block checkout for active, trialing, AND past_due (not just active)
  const [existingSub] = await db.select().from(subscriptions)
    .where(eq(subscriptions.userId, user.id)).limit(1);
  if (existingSub && ['active', 'trialing', 'past_due'].includes(existingSub.status)) {
    return { success: false, error: 'You already have an active subscription' };
  }

  // Cancel any incomplete subscriptions to prevent orphans
  const incompleteSubs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'incomplete',
    limit: 10,
  });
  for (const sub of incompleteSubs.data) {
    await stripe.subscriptions.cancel(sub.id);
  }

  // Create subscription with incomplete payment
  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.confirmation_secret'],
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const clientSecret = invoice.confirmation_secret?.client_secret;

  if (!clientSecret) {
    return { success: false, error: 'Failed to create payment intent' };
  }

  return {
    success: true,
    clientSecret,
    subscriptionId: subscription.id,
  };
}

export async function syncAfterPayment(stripeCustomerId: string): Promise<void> {
  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 1,
    status: 'all',
    expand: ['data.default_payment_method'],
  });

  const sub = subs.data[0];
  if (!sub) return;

  const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId)).limit(1);
  if (!user) return;

  await syncFromSubscription(sub, user.id);
  revalidatePath('/dashboard/billing');
}

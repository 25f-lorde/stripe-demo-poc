import { db } from '@/lib/db/index';
import { users, subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from './client';
import type Stripe from 'stripe';

function extractSubscriptionData(sub: Stripe.Subscription) {
  const firstItem = sub.items.data[0];
  if (!firstItem) return null;

  const pm =
    sub.default_payment_method !== null &&
    typeof sub.default_payment_method !== 'string'
      ? sub.default_payment_method
      : null;

  return {
    stripeSubscriptionId: sub.id,
    stripeProductId: (typeof firstItem.price.product === 'string'
      ? firstItem.price.product
      : firstItem.price.product?.id) ?? null,
    stripePriceId: firstItem.price.id,
    status: sub.status,
    currentPeriodStart: new Date(firstItem.current_period_start * 1000),
    currentPeriodEnd: new Date(firstItem.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    paymentMethodBrand: pm?.card?.brand ?? null,
    paymentMethodLast4: pm?.card?.last4 ?? null,
    paymentMethodId: pm?.id ?? null,
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Sync from a Stripe subscription response directly — no re-fetch needed */
export async function syncFromSubscription(sub: Stripe.Subscription, userId: string): Promise<void> {
  const data = extractSubscriptionData(sub);
  if (!data) {
    console.error(`Subscription ${sub.id} has no line items`);
    return;
  }

  await db.insert(subscriptions).values({
    userId,
    ...data,
  }).onConflictDoUpdate({
    target: subscriptions.userId,
    set: data,
  });
}

/** Sync by fetching latest from Stripe API — used by webhooks and success page */
export async function syncStripeData(customerId: string): Promise<void> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: 'all',
    expand: ['data.default_payment_method'],
  });

  const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
  if (!user) return;

  if (subs.data.length === 0) {
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    return;
  }

  const sub = subs.data[0];
  if (!sub) return;

  await syncFromSubscription(sub, user.id);
}

import { db } from '@/lib/db/index';
import { users, subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from './client';

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

  const firstItem = sub.items.data[0];
  if (!firstItem) {
    console.error(`Subscription ${sub.id} has no line items`);
    return;
  }

  const pm =
    sub.default_payment_method !== null &&
    typeof sub.default_payment_method !== 'string'
      ? sub.default_payment_method
      : null;

  const subscriptionData = {
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
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(subscriptions).values({
    userId: user.id,
    ...subscriptionData,
  }).onConflictDoUpdate({
    target: subscriptions.userId,
    set: subscriptionData,
  });
}

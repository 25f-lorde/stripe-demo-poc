'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { users, subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe/client';
import { getCachedPrices } from '@/lib/stripe/plans';
import { syncFromSubscription } from '@/lib/stripe/sync';
import { revalidatePath } from 'next/cache';

type ActionResult =
  | { success: true }
  | { success: true; requiresAction: true; clientSecret: string }
  | { success: false; error: string };

type PreviewResult =
  | { success: true; amountDue: number; currency: string; isUpgrade: boolean; description: string }
  | { success: false; error: string };

async function getAuthenticatedSubscription() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.stripeCustomerId) return null;

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1);
  if (!sub) return null;

  return { user, sub };
}

export async function previewPlanChange(newPriceId: string): Promise<PreviewResult> {
  const data = await getAuthenticatedSubscription();
  if (!data) return { success: false, error: 'No active subscription' };

  const prices = await getCachedPrices();
  if (!prices.some((p) => p.id === newPriceId)) {
    return { success: false, error: 'Invalid plan' };
  }

  const stripeSub = await stripe.subscriptions.retrieve(data.sub.stripeSubscriptionId);
  const currentItem = stripeSub.items.data[0];
  if (!currentItem) return { success: false, error: 'No subscription item' };

  // BUG FIX #2: Use explicit proration_date so preview matches actual charge
  const prorationDate = Math.floor(Date.now() / 1000);

  const preview = await stripe.invoices.createPreview({
    customer: data.user.stripeCustomerId!,
    subscription: data.sub.stripeSubscriptionId,
    subscription_details: {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: 'create_prorations',
      proration_date: prorationDate,
    },
  });

  const isUpgrade = preview.amount_due > 0;

  return {
    success: true,
    amountDue: preview.amount_due,
    currency: preview.currency,
    isUpgrade,
    description: isUpgrade
      ? `You'll be charged $${(preview.amount_due / 100).toFixed(2)} today`
      : `You'll receive a $${(Math.abs(preview.total) / 100).toFixed(2)} credit`,
  };
}

export async function confirmPlanChange(newPriceId: string): Promise<ActionResult> {
  const data = await getAuthenticatedSubscription();
  if (!data) return { success: false, error: 'No active subscription' };

  // BUG FIX #3: Block plan change if subscription is set to cancel
  if (data.sub.cancelAtPeriodEnd) {
    return { success: false, error: 'Please reactivate your subscription before changing plans' };
  }

  const prices = await getCachedPrices();
  if (!prices.some((p) => p.id === newPriceId)) {
    return { success: false, error: 'Invalid plan' };
  }

  const stripeSub = await stripe.subscriptions.retrieve(data.sub.stripeSubscriptionId);
  const currentItem = stripeSub.items.data[0];
  if (!currentItem) return { success: false, error: 'No subscription item' };

  const currentPrice = currentItem.price.unit_amount ?? 0;
  const newPrice = prices.find((p) => p.id === newPriceId);
  const isUpgrade = (newPrice?.unit_amount ?? 0) > currentPrice;

  // BUG FIX #2: Use fresh proration_date server-side (never from client)
  const updated = await stripe.subscriptions.update(data.sub.stripeSubscriptionId, {
    items: [{ id: currentItem.id, price: newPriceId }],
    proration_behavior: isUpgrade ? 'always_invoice' : 'create_prorations',
    proration_date: Math.floor(Date.now() / 1000),
  });

  // Check if 3DS is required on the proration invoice
  const latestInvoice = updated.latest_invoice;
  if (latestInvoice && typeof latestInvoice !== 'string') {
    const cs = latestInvoice.confirmation_secret?.client_secret;
    if (cs && latestInvoice.status === 'open') {
      await syncFromSubscription(updated, data.user.id);
      revalidatePath('/dashboard/billing');
      return { success: true, requiresAction: true, clientSecret: cs };
    }
  }

  await syncFromSubscription(updated, data.user.id);
  revalidatePath('/dashboard/billing');
  return { success: true };
}

export async function toggleCancellation(cancel: boolean): Promise<ActionResult> {
  const data = await getAuthenticatedSubscription();
  if (!data) return { success: false, error: 'No active subscription' };

  const updated = await stripe.subscriptions.update(data.sub.stripeSubscriptionId, {
    cancel_at_period_end: cancel,
  });

  await syncFromSubscription(updated, data.user.id);
  revalidatePath('/dashboard/billing');
  return { success: true };
}

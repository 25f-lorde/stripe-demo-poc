'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { users, subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe/client';
import { syncFromSubscription } from '@/lib/stripe/sync';
import { revalidatePath } from 'next/cache';

type ActionResult =
  | { success: true; clientSecret?: string }
  | { success: false; error: string };

export async function createSetupIntent(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.stripeCustomerId) return { success: false, error: 'No Stripe customer' };

  const setupIntent = await stripe.setupIntents.create({
    customer: user.stripeCustomerId,
    automatic_payment_methods: { enabled: true },
  });

  if (!setupIntent.client_secret) {
    return { success: false, error: 'Failed to create setup intent' };
  }

  return { success: true, clientSecret: setupIntent.client_secret };
}

export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.stripeCustomerId) return { success: false, error: 'No Stripe customer' };

  // Verify ownership
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== user.stripeCustomerId) {
    return { success: false, error: 'Payment method not found' };
  }

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1);
  if (!sub) return { success: false, error: 'No subscription' };

  const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    default_payment_method: paymentMethodId,
  });

  await syncFromSubscription(updated, user.id);
  revalidatePath('/dashboard/billing');
  return { success: true };
}

'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe/client';

export async function createCheckoutSession(priceId: string): Promise<never> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  if (!priceId || !priceId.startsWith('price_')) {
    throw new Error('Invalid plan selected');
  }

  // Get or create Stripe customer
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) redirect('/login');

  let stripeCustomerId = user.stripeCustomerId;

  if (!stripeCustomerId) {
    if (!user.email) {
      throw new Error('User email is required to create a Stripe customer');
    }

    const customer = await stripe.customers.create(
      {
        email: user.email,
        metadata: { userId: user.id },
      },
      {
        idempotencyKey: `create-customer-${user.id}`,
      }
    );

    stripeCustomerId = customer.id;

    await db.update(users)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  // Check for existing active subscription
  const existing = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
    limit: 1,
  });

  if (existing.data.length > 0) {
    redirect('/dashboard/billing');
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
    allow_promotion_codes: true,
  });

  if (!checkoutSession.url) {
    throw new Error('Stripe checkout session did not return a URL');
  }

  redirect(checkoutSession.url);
}

export async function redirectToCustomerPortal(): Promise<never> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  if (!user?.stripeCustomerId) {
    throw new Error('No Stripe customer found');
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/billing?sync=1`,
  });

  redirect(portalSession.url);
}

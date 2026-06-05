import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { handleStripeEvent } from '@/lib/stripe/webhooks';

export async function POST(req: Request) {
  const body = await req.text();

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response(null, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return new Response(null, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook signature verification failed: ${message}`);
    return new Response(null, { status: 400 });
  }

  await handleStripeEvent(event);

  return NextResponse.json({ received: true });
}

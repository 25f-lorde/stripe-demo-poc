import Stripe from 'stripe';
import { db } from '@/lib/db/index';
import { stripeEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { syncStripeData } from './sync';

const ALLOWED_EVENTS: Stripe.Event.Type[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
];

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (!ALLOWED_EVENTS.includes(event.type)) return;

  // Check if already processed (read-only check)
  const [existing] = await db.select({ eventId: stripeEvents.eventId })
    .from(stripeEvents)
    .where(eq(stripeEvents.eventId, event.id))
    .limit(1);
  if (existing) return;

  const obj = event.data.object;
  const customerId = 'customer' in obj && typeof obj.customer === 'string'
    ? obj.customer
    : null;

  if (!customerId) {
    console.error(`[STRIPE WEBHOOK] No customer ID found. Event: ${event.type}`);
    return;
  }

  // Sync FIRST — if this throws, the event is NOT marked as processed,
  // so Stripe will retry and we'll try again
  await syncStripeData(customerId);

  // Bust caches for invoice history and credit balance
  if (['invoice.paid', 'invoice.payment_failed', 'customer.subscription.updated'].includes(event.type)) {
    revalidateTag(`invoices-${customerId}`);
    revalidateTag(`credit-balance-${customerId}`);
  }

  // Only mark as processed AFTER successful sync
  await db.insert(stripeEvents).values({
    eventId: event.id,
    type: event.type,
  }).onConflictDoNothing();
}

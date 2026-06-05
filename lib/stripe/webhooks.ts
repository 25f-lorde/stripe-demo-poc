import Stripe from 'stripe';
import { db } from '@/lib/db/index';
import { stripeEvents } from '@/lib/db/schema';
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

  // Atomic idempotency: insert returns nothing if event already exists
  const [inserted] = await db.insert(stripeEvents).values({
    eventId: event.id,
    type: event.type,
  }).onConflictDoNothing().returning();

  if (!inserted) return; // Already processed

  const obj = event.data.object;
  const customerId = 'customer' in obj && typeof obj.customer === 'string'
    ? obj.customer
    : null;

  if (!customerId) {
    console.error(`[STRIPE WEBHOOK] No customer ID found. Event: ${event.type}`);
    return;
  }

  await syncStripeData(customerId);
}

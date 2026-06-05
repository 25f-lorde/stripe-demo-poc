import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  stripeProductId: text('stripe_product_id'),
  stripePriceId: text('stripe_price_id').notNull(),
  status: text('status').notNull(),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  paymentMethodId: text('payment_method_id'),
  paymentMethodBrand: text('payment_method_brand'),
  paymentMethodLast4: text('payment_method_last4'),
  lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_subscriptions_price_id').on(table.stripePriceId),
  index('idx_subscriptions_status').on(table.status),
]);

export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull().unique(),
  type: text('type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

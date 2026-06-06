import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { users, subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncStripeData } from '@/lib/stripe/sync';
import { getCachedPrices, formatPrice } from '@/lib/stripe/plans';
import { getCachedCreditBalance } from '@/lib/stripe/balance';
import { getCachedInvoices } from '@/lib/stripe/invoices';
import { redirect } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';
import { BillingActions } from './billing-actions';
import { UpdatePaymentMethod } from '@/components/update-payment-method';
import { InvoiceHistory } from '@/components/invoice-history';
import Link from 'next/link';

async function getPlanName(priceId: string): Promise<string> {
  const prices = await getCachedPrices();
  const match = prices.find((p) => p.id === priceId);
  if (!match) return priceId;
  const formatted = formatPrice(match);
  const interval = match.recurring?.interval === 'year' ? 'Annual' : 'Monthly';
  return `${formatted.productName} (${interval})`;
}

async function getAllPlans() {
  const prices = await getCachedPrices();
  return prices.map((p) => ({
    name: formatPrice(p).productName,
    priceId: p.id,
    lookupKey: p.lookup_key ?? '',
    amount: p.unit_amount ?? 0,
    interval: p.recurring?.interval ?? 'month',
  }));
}

export default async function BillingPage(props: {
  searchParams: Promise<{ sync?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const params = await props.searchParams;
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  // Sync on portal/checkout return
  if (params.sync && user?.stripeCustomerId) {
    try {
      await syncStripeData(user.stripeCustomerId);
    } catch {
      // Stripe might not be configured
    }
    redirect('/dashboard/billing');
  }

  const [sub] = user
    ? await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1)
    : [];

  // Show subscription card for active, trialing, AND past_due
  const hasSubscription = sub && ['active', 'trialing', 'past_due'].includes(sub.status);
  const isCanceling = sub?.cancelAtPeriodEnd;
  const derivedStatus = isCanceling ? 'canceling' : (sub?.status ?? 'canceled');

  const plans = hasSubscription ? await getAllPlans() : [];
  const planName = sub ? await getPlanName(sub.stripePriceId) : '';

  // Fetch credit balance and invoices in parallel (cached, ~0ms on hit)
  const [creditBalance, invoiceList] = await Promise.all([
    user?.stripeCustomerId ? getCachedCreditBalance(user.stripeCustomerId) : null,
    user?.stripeCustomerId ? getCachedInvoices(user.stripeCustomerId) : [],
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl text-zinc-50">Billing</h1>

      {/* Status banners */}
      {sub?.status === 'past_due' && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-status-past-due/20 bg-status-past-due/5 px-5 py-4">
          <p className="text-sm text-status-past-due">
            <span className="font-medium">Payment failed.</span>{' '}
            Update your payment method below to continue your subscription.
          </p>
        </div>
      )}

      {isCanceling && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-status-canceling/20 bg-status-canceling/5 px-5 py-4">
          <p className="text-sm text-status-canceling">
            Your plan cancels on{' '}
            <span className="font-medium">
              {sub?.currentPeriodEnd.toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </span>
            . You retain access until then.
          </p>
        </div>
      )}

      {/* Main subscription card */}
      {hasSubscription && sub ? (
        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
          {/* Plan header */}
          <div className="flex items-center justify-between border-b border-border px-8 py-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Current plan</p>
              <p className="mt-1 font-display text-2xl text-zinc-100">{planName}</p>
            </div>
            <StatusBadge status={derivedStatus} />
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-px bg-border">
            <div className="bg-surface px-8 py-5">
              <p className="text-xs text-zinc-500">Next billing date</p>
              <p className="mt-1 font-mono text-sm text-zinc-200">
                {sub.currentPeriodEnd.toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </p>
            </div>
            <div className="bg-surface px-8 py-5">
              <p className="text-xs text-zinc-500">Status</p>
              <p className="mt-1 text-sm capitalize text-zinc-200">
                {isCanceling ? 'Canceling at period end' : sub.status}
              </p>
            </div>
          </div>

          {/* Actions */}
          <BillingActions
            plans={plans}
            currentPriceId={sub.stripePriceId}
            cancelAtPeriodEnd={sub.cancelAtPeriodEnd}
            planName={planName}
            accessUntil={sub.currentPeriodEnd.toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          />
        </div>
      ) : (
        /* Empty state */
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
          <div className="rounded-full bg-surface-overlay p-4">
            <svg className="h-8 w-8 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </div>
          <p className="mt-4 text-zinc-300">No active subscription</p>
          <p className="mt-1 text-sm text-zinc-500">Choose a plan to get started.</p>
          <Link
            href="/pricing"
            className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-zinc-950 transition-all hover:bg-accent-hover"
          >
            View plans
          </Link>
        </div>
      )}

      {/* Payment method section */}
      {hasSubscription && sub && (
        <UpdatePaymentMethod
          currentBrand={sub.paymentMethodBrand}
          currentLast4={sub.paymentMethodLast4}
        />
      )}

      {/* Credit balance */}
      {creditBalance && (
        <div className="mt-12">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface px-8 py-6">
            <p className="font-mono text-2xl font-light text-accent">
              ${(creditBalance.amount / 100).toFixed(2)} <span className="text-sm text-zinc-400">credit</span>
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Automatically applied to your next invoice.
            </p>
          </div>
        </div>
      )}

      {/* Invoice history */}
      {user?.stripeCustomerId && (
        <InvoiceHistory invoices={invoiceList} />
      )}
    </div>
  );
}

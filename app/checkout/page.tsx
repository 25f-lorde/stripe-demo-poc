import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCachedPrices, formatPrice } from '@/lib/stripe/plans';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CheckoutClient } from './checkout-client';

export default async function CheckoutPage(props: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const session = await auth();
  const params = await props.searchParams;

  if (!session?.user?.id) {
    const redirectUrl = params.plan ? `/checkout?plan=${params.plan}` : '/checkout';
    redirect(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
  }

  if (!params.plan) {
    redirect('/pricing');
  }

  // Find the price matching the lookup key
  const rawPrices = await getCachedPrices();
  const matchedPrice = rawPrices.find((p) => p.lookup_key === params.plan);

  if (!matchedPrice) {
    redirect('/pricing');
  }

  const price = formatPrice(matchedPrice);
  const interval = matchedPrice.recurring?.interval === 'year' ? 'Annual' : 'Monthly';

  // Get user's stripe customer ID
  const [user] = await db.select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Plan features (same as pricing page)
  const features: Record<string, string[]> = {
    Starter: ['1 user included', '5 GB storage', 'Email support', 'Basic analytics'],
    Pro: ['5 users included', '50 GB storage', 'Priority support', 'Advanced analytics', 'Custom integrations'],
    Enterprise: ['Unlimited users', '500 GB storage', '24/7 phone support', 'Custom analytics', 'API access', 'SSO authentication'],
  };

  const planFeatures = features[price.productName] ?? [];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left Panel — Order Summary */}
      <div className="relative flex flex-col justify-between border-b border-border px-6 py-8 lg:w-1/2 lg:border-b-0 lg:border-r lg:px-16 lg:py-12">
        {/* Subtle gradient */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: 'radial-gradient(ellipse 70% 50% at 30% 60%, oklch(0.2 0.08 180 / 0.3), transparent)',
          }}
        />

        <div className="relative z-10">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to pricing
          </Link>

          <p className="mt-8 font-display text-xl text-zinc-100">BillFlow</p>

          {/* Plan card */}
          <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-8 py-6">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Subscribe to</p>
              <h2 className="mt-1 font-display text-3xl text-zinc-50">{price.productName}</h2>
            </div>

            <div className="flex items-baseline justify-between border-b border-border px-8 py-5">
              <span className="text-sm text-zinc-400">{interval} subscription</span>
              <span className="font-mono text-2xl font-light tracking-tight text-zinc-50">
                ${price.amount}<span className="text-sm text-zinc-500">/{interval === 'Monthly' ? 'mo' : 'yr'}</span>
              </span>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 gap-px bg-border">
              {planFeatures.map((feature) => (
                <div key={feature} className="flex items-center gap-3 bg-surface px-8 py-3.5">
                  <svg className="h-4 w-4 shrink-0 text-accent" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm text-zinc-300">{feature}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-baseline justify-between border-t border-accent/20 bg-accent-dim px-8 py-5">
              <span className="text-sm font-medium text-zinc-200">Due today</span>
              <span className="font-mono text-xl font-light text-accent">${price.amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="relative z-10 mt-8 flex items-center gap-2 text-xs text-zinc-600">
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="6" width="10" height="8" rx="1.5" />
            <path d="M5 6V4.5a3 3 0 016 0V6" />
          </svg>
          Secured by Stripe
        </div>
      </div>

      {/* Right Panel — Payment Form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-8 lg:px-16 lg:py-12">
        <div className="mx-auto w-full max-w-md">
          <h2 className="font-display text-2xl text-zinc-50">Payment details</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Your card will be charged ${price.amount.toFixed(2)}/{interval === 'Monthly' ? 'mo' : 'yr'}.
          </p>

          <div className="mt-8">
            <CheckoutClient
              priceId={matchedPrice.id}
              amount={matchedPrice.unit_amount ?? 0}
              stripeCustomerId={user?.stripeCustomerId ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

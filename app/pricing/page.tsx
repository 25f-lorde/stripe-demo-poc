import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { users, subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCachedPrices, formatPrice } from '@/lib/stripe/plans';
import { PricingPageClient } from '@/components/pricing-page-client';
import Link from 'next/link';

export default async function PricingPage() {
  const session = await auth();
  let currentPriceId: string | null = null;

  if (session?.user?.id) {
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
    if (user) {
      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1);
      if (sub?.status === 'active') {
        currentPriceId = sub.stripePriceId;
      }
    }
  }

  const rawPrices = await getCachedPrices();
  const prices = rawPrices.map(formatPrice);

  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="flex items-center justify-between px-8 py-6 lg:px-16">
        <Link href="/" className="font-display text-xl text-zinc-100">
          BillFlow
        </Link>
        <div className="flex items-center gap-6">
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-full border border-border bg-surface-raised px-5 py-2 text-sm text-zinc-200 transition-all hover:border-accent hover:text-zinc-100"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-border bg-surface-raised px-5 py-2 text-sm text-zinc-200 transition-all hover:border-accent hover:text-zinc-100"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 pt-16 pb-32">
        <div className="text-center">
          <h1 className="font-display text-4xl text-zinc-50 sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-zinc-400">
            No hidden fees. No surprises. Cancel anytime.
          </p>
        </div>

        <PricingPageClient prices={prices} currentPriceId={currentPriceId} />
      </main>
    </div>
  );
}

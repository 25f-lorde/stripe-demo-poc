import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { users, subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  const [sub] = user
    ? await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1)
    : [];

  const isActive = sub?.status === 'active' || sub?.status === 'trialing';

  return (
    <div>
      <h1 className="font-display text-3xl text-zinc-50">Dashboard</h1>
      <p className="mt-2 text-zinc-400">
        Welcome back, {session.user.name ?? session.user.email}.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface-raised p-8">
        <h2 className="text-lg font-medium text-zinc-200">Subscription Status</h2>
        {isActive && sub ? (
          <div className="mt-4">
            <p className="text-sm text-zinc-400">
              You&apos;re on an active plan. Manage your subscription from the{' '}
              <Link href="/dashboard/billing" className="text-accent hover:underline">
                billing page
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-zinc-400">
              You don&apos;t have an active subscription.
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-block rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-accent-hover"
            >
              View plans
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

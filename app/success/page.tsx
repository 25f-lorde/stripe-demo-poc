import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncStripeData } from '@/lib/stripe/sync';
import { redirect } from 'next/navigation';

export default async function SuccessPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [user] = await db.select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.stripeCustomerId) redirect('/pricing');

  try {
    await Promise.race([
      syncStripeData(user.stripeCustomerId),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('sync timeout')), 5000)
      ),
    ]);
  } catch {
    // Webhook will catch up
  }

  redirect('/dashboard/billing');
}

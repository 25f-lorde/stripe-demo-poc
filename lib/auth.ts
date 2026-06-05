import { cache } from 'react';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/index';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const COOKIE_NAME = 'demo-user-id';

export const auth = cache(async (): Promise<{ user: { id: string; email: string; name: string | null } } | null> => {
  const cookieStore = await cookies();
  const userId = cookieStore.get(COOKIE_NAME)?.value;
  if (!userId) return null;

  const [user] = await db.select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  return { user };
});

export async function signIn(email: string): Promise<string> {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const [created] = await db.insert(users).values({
      email,
      name: email.split('@')[0] ?? email,
    }).returning();
    if (!created) throw new Error('Failed to create user');
    userId = created.id;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return userId;
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

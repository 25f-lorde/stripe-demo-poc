'use server';

import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/lib/auth';

export async function loginAction(formData: FormData): Promise<void> {
  const email = formData.get('email');
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Valid email is required');
  }

  await signIn(email);
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect('/');
}

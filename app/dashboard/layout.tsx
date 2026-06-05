import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="flex items-center justify-between border-b border-border px-8 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-display text-xl text-zinc-100">
            BillFlow
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/billing"
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Billing
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">{session.user.email}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-full border border-border px-4 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}

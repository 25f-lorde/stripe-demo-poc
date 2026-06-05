import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-surface-raised p-8">
          <h1 className="font-display text-2xl text-zinc-100">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Enter your email to continue. No password needed for this demo.
          </p>

          <form action={loginAction} className="mt-6">
            <label htmlFor="email" className="block text-xs text-zinc-500">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              defaultValue="demo@billflow.dev"
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-accent-hover"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

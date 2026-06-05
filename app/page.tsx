import { auth } from '@/lib/auth';
import Link from 'next/link';

export default async function LandingPage() {
  const session = await auth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950">
      {/* Gradient mesh background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 40%, oklch(0.25 0.12 180 / 0.4), transparent),
            radial-gradient(ellipse 60% 50% at 80% 20%, oklch(0.2 0.08 260 / 0.3), transparent),
            radial-gradient(ellipse 50% 40% at 60% 80%, oklch(0.18 0.06 200 / 0.25), transparent)
          `,
        }}
      />

      {/* Grid lines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 lg:px-16">
        <span className="font-display text-xl text-zinc-100">BillFlow</span>
        <div className="flex items-center gap-6">
          <Link
            href="/pricing"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            Pricing
          </Link>
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

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-32 pb-24 text-center lg:pt-44">
        {/* Pill badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-4 py-1.5 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Powered by Stripe
        </div>

        <h1 className="max-w-3xl font-display text-5xl leading-[1.1] tracking-tight text-zinc-50 sm:text-6xl lg:text-7xl">
          Subscription billing,{' '}
          <span className="text-accent">handled.</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
          A complete subscription management system built with Next.js and
          Stripe. Three tiers, one sync function, zero headaches.
        </p>

        <div className="mt-10 flex items-center gap-4">
          <Link
            href="/pricing"
            className="group relative rounded-full bg-accent px-8 py-3.5 font-medium text-zinc-950 transition-all hover:bg-accent-hover"
          >
            View pricing
            <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">
              &rarr;
            </span>
          </Link>
          <Link
            href="https://github.com/t3dotgg/stripe-recommendations"
            target="_blank"
            className="rounded-full border border-border px-8 py-3.5 text-sm text-zinc-300 transition-all hover:border-zinc-500 hover:text-zinc-100"
          >
            Source code
          </Link>
        </div>
      </main>
    </div>
  );
}

# BillFlow — Stripe Subscription Billing Demo

## Project Overview

Subscription billing demo: Next.js 15 App Router + Stripe + Drizzle ORM + Neon Postgres. Users sign in with email, select a plan, pay via Stripe Checkout, and manage their subscription via Stripe Customer Portal.

Architecture follows [Theo's stripe-recommendations](https://github.com/t3dotgg/stripe-recommendations) — one `syncStripeData()` function is the single source of truth for syncing Stripe state to the local database.

## Commands

```bash
nvm use 20                                # Required — Node 20+
npm run dev                               # Start dev server at localhost:3000
npm run build                             # Production build
npm run start                             # Production server (after build)
npm run lint                              # ESLint (entire project)
npx drizzle-kit push                      # Push schema changes to Neon
npx tsx scripts/seed-stripe.ts            # Create Stripe products/prices
npx tsx scripts/setup-portal.ts           # Configure Customer Portal
```

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components, Server Actions)
- **Language**: TypeScript with `strict: true` and `noUncheckedIndexedAccess: true`
- **Database**: Drizzle ORM + Neon Postgres (HTTP driver via `@neondatabase/serverless`). Config at `drizzle.config.ts`.
- **Payments**: Stripe SDK (server), @stripe/stripe-js (client). Checkout sessions have `allow_promotion_codes: true`.
- **Styling**: Tailwind CSS v4 with `@theme` custom properties (OKLch colors)
- **Auth**: Cookie-based demo auth (no OAuth — `lib/auth.ts`). NOT production-ready.
- **Toasts**: `sonner` — `<Toaster>` mounted in `app/layout.tsx`. Use `import { toast } from 'sonner'` in client components.
- **Node**: Requires 20+ (`.nvmrc` provided)

## Project Structure

```
app/
  layout.tsx                        # Root layout — fonts (DM Serif, Instrument Sans, JetBrains Mono), Toaster
  page.tsx                          # Landing page (public)
  globals.css                       # Tailwind v4 @theme, OKLch colors, animations
  login/page.tsx                    # Email sign-in, default: demo@billflow.dev (public)
  pricing/page.tsx                  # 3-tier pricing, fetches from Stripe API (public)
  success/
    page.tsx                        # Post-checkout sync + redirect (protected)
    loading.tsx                     # Animated checkmark + loading bar
  dashboard/
    layout.tsx                      # Nav bar, auth guard via auth()
    page.tsx                        # Dashboard home (protected)
    billing/
      page.tsx                      # Subscription details + portal button (protected)
      loading.tsx                   # Skeleton loader
      error.tsx                     # Error boundary with retry
  actions/
    auth.ts                         # loginAction(formData), logoutAction()
    stripe.ts                       # createCheckoutSession(priceId), redirectToCustomerPortal()
  api/webhooks/stripe/route.ts      # POST — Stripe webhook handler
lib/
  auth.ts                           # auth(), signIn(email), signOut() — wrapped in React.cache()
  db/
    index.ts                        # Drizzle client (neon-http driver)
    schema.ts                       # users, subscriptions, stripe_events tables
  stripe/
    client.ts                       # Stripe singleton — import 'server-only', rejects pk_ keys
    sync.ts                         # syncStripeData(customerId) — THE sync function
    webhooks.ts                     # handleStripeEvent(event) — dedup + sync
    plans.ts                        # getCachedPrices() — unstable_cache, 1hr TTL
components/
  pricing-card.tsx                  # Plan card with checkout form
  pricing-page-client.tsx           # 3-column grid + monthly/annual toggle
  billing-toggle.tsx                # Monthly/Annual switcher
  status-badge.tsx                  # Color-coded subscription status
  manage-subscription-button.tsx    # Stripe Customer Portal redirect
middleware.ts                       # Route protection: /dashboard/:path*, /success/:path*
drizzle.config.ts                   # Drizzle Kit config (reads DATABASE_URL)
```

## Database Schema (Drizzle + Neon Postgres)

3 tables in `lib/db/schema.ts`:

**users**: id, email (unique), name, stripe_customer_id (unique), created_at, updated_at

**subscriptions**: id, user_id (unique FK -> users, cascade delete), stripe_subscription_id (unique), stripe_product_id, stripe_price_id, status, current_period_start, current_period_end, cancel_at_period_end, payment_method_brand, payment_method_last4, last_synced_at, created_at, updated_at. Indexes on stripe_price_id and status.

**stripe_events**: id, event_id (unique), type, created_at. Used for webhook idempotency.

One subscription per user (enforced by unique constraint on user_id).

## Stripe Integration

### Products & Prices
3 products x 2 intervals = 6 prices. Created via `scripts/seed-stripe.ts` with lookup keys:

| Plan | Monthly | Annual | Lookup keys |
|---|---|---|---|
| Starter | $9/mo | $90/yr | `starter_monthly`, `starter_annual` |
| Pro | $29/mo | $290/yr | `pro_monthly`, `pro_annual` |
| Enterprise | $99/mo | $990/yr | `enterprise_monthly`, `enterprise_annual` |

### Checkout Flow
1. User clicks "Get started" on pricing card
2. Server action `createCheckoutSession(priceId)` validates priceId (must start with `price_`), gets/creates Stripe customer (with idempotency key `create-customer-{userId}`), checks for existing active sub, creates Checkout Session
3. Redirect to Stripe hosted Checkout at `checkout.stripe.com`
4. After payment, Stripe redirects to `/success`
5. Success page calls `syncStripeData(customerId)` with 5s timeout, then redirects to `/dashboard/billing`

### Sync Function (`lib/stripe/sync.ts`)
Single function `syncStripeData(customerId)`:
- Fetches latest subscription from Stripe API (`subscriptions.list` with `status: 'all'`)
- Looks up user by `stripeCustomerId`
- Upserts subscription data with `INSERT ... ON CONFLICT DO UPDATE` (single atomic query)
- Called from: success page (eager sync) and webhook handler (event-driven sync)

### Webhook Handler (`lib/stripe/webhooks.ts`)
- Route at `/api/webhooks/stripe` verifies signature via `constructEvent(body, signature, secret)`
- 9 allowed events: `checkout.session.completed`, `customer.subscription.created/updated/deleted/paused/resumed`, `invoice.paid/payment_failed/payment_action_required`
- Atomic idempotency: INSERT event ID with `onConflictDoNothing`, skip if no row returned
- Extracts `customer` from event object via runtime `in` check (no `as` cast), calls `syncStripeData(customerId)`

### Customer Portal
- Configured via `scripts/setup-portal.ts` with all 6 prices
- Server action `redirectToCustomerPortal()` creates portal session with return URL `?sync=1`
- Billing page checks for `?sync=1` param and eagerly re-syncs before rendering
- Portal is hosted at `billing.stripe.com`

### Local Webhook Testing
```bash
# Terminal 1: dev server
npm run dev

# Terminal 2: webhook forwarding
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the whsec_xxx output to .env as STRIPE_WEBHOOK_SECRET

# Terminal 3: trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
```

### Stripe Test Cards
- `4242 4242 4242 4242` — succeeds
- `4000 0025 0000 3155` — requires 3DS authentication
- `4000 0000 0000 9995` — declined

## Auth System

Demo-only cookie-based auth in `lib/auth.ts`:
- Cookie name: `demo-user-id`, stores raw user ID
- `auth()` reads cookie, queries DB for user, returns `{ user: { id, email, name } } | null`
- Wrapped in `React.cache()` — deduplicated within a single request (no duplicate DB calls)
- `signIn(email)` creates user if not exists, sets cookie (httpOnly, secure in prod, sameSite: lax, 30d)
- `signOut()` deletes cookie
- Login page pre-fills email with `demo@billflow.dev`
- **NOT production-ready** — no signing, no CSRF token, no session invalidation

Route protection: `middleware.ts` checks for cookie on `/dashboard/:path*` and `/success/:path*`, redirects to `/login`.

## Design System

Dark mode with OKLch colors defined in `app/globals.css` via Tailwind v4 `@theme`:
- Accent: electric teal `oklch(0.78 0.18 180)` — CTAs, badges, highlights
- Surfaces: `oklch(0.14/0.18/0.22 0.005 260)` — background/raised/overlay
- Status colors: active (green), trialing (violet), past_due (red + animate-pulse), canceling (amber), canceled (gray)
- Fonts: DM Serif Display (headlines), Instrument Sans (body), JetBrains Mono (data/prices)
- Animations: `fadeUp`, `draw` (SVG checkmark), `loading` (progress bar)

## Testing with Playwright

### Prerequisites
1. Dev server running: `npm run dev` (terminal 1)
2. Stripe CLI forwarding webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` (terminal 2)
3. Playwright installed:
```bash
npm install -D @playwright/test
npx playwright install chromium
```

### URL Patterns
- App pages: `localhost:3000/*`
- Stripe Checkout: `checkout.stripe.com/*` (external, hosted by Stripe)
- Stripe Customer Portal: `billing.stripe.com/*` (external, hosted by Stripe)

### Test Scenarios

**1. Full checkout flow:**
1. Navigate to `http://localhost:3000/login`
2. The email input is pre-filled with `demo@billflow.dev` — click the "Continue" button
3. Navigate to `/pricing` — 3 cards visible (Starter, Pro, Enterprise) on Monthly tab
4. Click "Get started" on Starter card (first button)
5. Wait for URL to match `checkout.stripe.com/**`
6. On Stripe Checkout page (NOT an iframe — these are regular form fields on Stripe's hosted page):
   - Fill "Card number": `4242424242424242`
   - Fill "Expiration": `12/30`
   - Fill "CVC": `123`
   - Fill "Cardholder name": `Test User`
7. Click "Subscribe" button
8. Wait for redirect back to `localhost:3000/dashboard/billing` (goes through `/success` which auto-redirects)
9. Assert: page contains text "Starter (Monthly)", has "Active" status badge, shows "Visa **** 4242"

**2. Plan upgrade via portal:**
1. From `/dashboard/billing`, click "Manage subscription" button
2. Wait for URL to match `billing.stripe.com/**`
3. Click "Update subscription" link
4. Click "Select" on the Pro plan ($29/mo)
5. Click "Continue" button
6. Click "Confirm" button
7. Click "Return to New Business" link
8. Wait for URL to match `localhost:3000/dashboard/billing` (without `?sync=1` — it redirects after sync)
9. Assert: page contains text "Pro (Monthly)"

**3. Subscription persistence across logout/login:**
1. Complete checkout as in scenario 1
2. Click "Sign out" button (in top-right nav)
3. Wait for redirect to `localhost:3000/`
4. Navigate to `/login`, fill email with same address, click "Continue"
5. Navigate to `/dashboard/billing`
6. Assert: subscription is still active with correct plan name

### Playwright Notes
- Stripe Checkout at `checkout.stripe.com` uses **regular HTML form fields** (card number, expiry, CVC, name). These are NOT inside iframes. Iframes are only used when Stripe Elements are embedded in your own page — hosted Checkout is a full Stripe-owned page.
- After portal changes, the return URL is `/dashboard/billing?sync=1`. The server syncs Stripe data then redirects to `/dashboard/billing` (clean URL). Wait for the final URL without query params.
- The "Subscribe" button on Stripe Checkout may show "Processing" state briefly before redirecting. Use `page.waitForURL()` rather than checking button state.
- The webhook secret from `stripe listen` CLI is different from the one in Stripe Dashboard. Always use the CLI-provided `whsec_xxx` for local testing.

## Environment Variables

```
DATABASE_URL                        # Neon Postgres connection string
STRIPE_SECRET_KEY                   # sk_test_xxx (NEVER prefix with NEXT_PUBLIC_)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  # pk_test_xxx (safe for client)
STRIPE_WEBHOOK_SECRET               # whsec_xxx (from stripe listen or Dashboard)
NEXT_PUBLIC_URL                     # http://localhost:3000 (used for Stripe redirect URLs)
```

See `.env.example` for template.

## Known Limitations (Demo Scope)

- **Auth is demo-only** — unsigned cookie, no OAuth, no CSRF. Replace with Auth.js/NextAuth for production.
- **No webhook endpoint in production** — need to register in Stripe Dashboard > Developers > Webhooks.
- **Annual price display** — calculated client-side as `monthlyPrice * 10` ($90, $290, $990), should use actual Stripe price data.
- **Plan features hardcoded** — `PLANS` array in `pricing-page-client.tsx` is a dual source of truth with Stripe products.
- **No connection pooling** — using Neon HTTP driver (stateless). Switch to WebSocket driver for production.
- **Price cache** — `unstable_cache` tag `stripe-prices` is never invalidated via `revalidateTag`. Changes take up to 1 hour.
- **No rate limiting** — on server actions or webhook endpoint.

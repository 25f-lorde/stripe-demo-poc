# BillFlow — Stripe Subscription Billing Demo

A complete subscription billing system built with Next.js 15 and Stripe. Select a plan, pay, and manage your subscription — all end-to-end.

## Features

### Subscription Checkout
- 3-tier pricing page (Starter $9/mo, Pro $29/mo, Enterprise $99/mo)
- Monthly/annual toggle with -17% discount badge
- Stripe Checkout (hosted) — PCI handled by Stripe
- Customer creation with Stripe idempotency key (prevents duplicates)
- Active subscription guard (prevents double-subscribing)
- Post-checkout sync with timeout fallback

### Billing Management
- Billing dashboard showing current plan, status, billing date, payment method
- Stripe Customer Portal for self-service:
  - Upgrade/downgrade between all 3 tiers (monthly or yearly)
  - Cancel subscription (at period end)
  - Update payment method
  - View invoice history
- Automatic state sync on portal return

### Subscription Sync (Theo's Pattern)
- Single `syncStripeData()` function — one canonical way to sync Stripe state
- Called from both the success page and webhook handler
- Always fetches latest truth from Stripe API (source of truth)
- Atomic upsert to database (`INSERT ... ON CONFLICT DO UPDATE`)

### Webhook Handler
- Stripe signature verification (raw body + `constructEvent`)
- Event deduplication via `stripe_events` table (atomic INSERT)
- 9 supported event types: checkout completed, subscription CRUD, invoice events

### Auth (Demo Mode)
- Email-only sign-in — no password, no OAuth setup needed
- Cookie-based sessions (httpOnly, secure in production, sameSite: lax)
- Route protection via Next.js middleware on `/dashboard/*` and `/success`

### UI Design
- Dark mode with electric teal accent
- Typography: DM Serif Display (headlines), Instrument Sans (body), JetBrains Mono (data)
- Status badges: Active (green), Trial (violet), Past Due (red, pulsing), Canceling (amber)
- Gradient mesh landing page with grid overlay
- Loading skeletons and error boundaries

### Security
- `server-only` guard on Stripe client (prevents secret key in client bundle)
- Secret key format validation (rejects publishable keys)
- priceId validation in checkout action
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Middleware-based route protection

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict, noUncheckedIndexedAccess) |
| Database | Drizzle ORM + Neon Postgres |
| Payments | Stripe (Checkout + Customer Portal + Webhooks) |
| Styling | Tailwind CSS v4 |
| Auth | Cookie-based (demo) |
| Notifications | Sonner |

## Getting Started

### Prerequisites
- Node.js 20+
- A Stripe test account
- A Neon database

### Setup

```bash
npm install
```

Add your credentials to `.env`:

```env
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_URL=http://localhost:3000
```

### Database

```bash
npx drizzle-kit push
```

### Stripe Products

```bash
# Create products and prices with lookup keys
npx tsx scripts/seed-stripe.ts

# Configure the Customer Portal with all plans
npx tsx scripts/setup-portal.ts
```

### Run

```bash
npm run dev
```

### Webhook Testing (Local)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_xxx` output to your `.env` as `STRIPE_WEBHOOK_SECRET`.

### Test Cards

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Success |
| `4000 0025 0000 3155` | Requires 3DS |
| `4000 0000 0000 9995` | Declined |

## Project Structure

```
app/
  page.tsx                    # Landing page
  login/page.tsx              # Email sign-in
  pricing/page.tsx            # 3-tier pricing
  success/page.tsx            # Post-checkout sync
  dashboard/
    layout.tsx                # Protected nav layout
    page.tsx                  # Dashboard home
    billing/page.tsx          # Subscription management
  actions/
    auth.ts                   # loginAction, logoutAction
    stripe.ts                 # createCheckoutSession, redirectToCustomerPortal
  api/webhooks/stripe/route.ts
lib/
  auth.ts                     # Cookie auth with React.cache()
  db/
    index.ts                  # Drizzle + Neon client
    schema.ts                 # users, subscriptions, stripe_events
  stripe/
    client.ts                 # Stripe SDK (server-only)
    sync.ts                   # syncStripeData
    webhooks.ts               # Event handler with deduplication
    plans.ts                  # Cached price fetching
components/
  pricing-card.tsx
  pricing-page-client.tsx
  billing-toggle.tsx
  status-badge.tsx
  manage-subscription-button.tsx
middleware.ts                 # Route protection
```

## Architecture

Based on [Theo's Stripe Recommendations](https://github.com/t3dotgg/stripe-recommendations):

1. **Create customer BEFORE checkout** — never let Stripe create ephemeral customers
2. **Single sync function** — one way to sync state, called from success page + webhooks
3. **Webhooks are triggers, not sources of truth** — always re-fetch from Stripe API
4. **Idempotent everything** — dedup webhooks, idempotency keys on customer creation, atomic upserts

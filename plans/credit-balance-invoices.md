# feat: Credit Balance Display + Invoice History

## Overview

Two additions to the billing page:
1. **Credit balance** — show downgrade credits so users know what they have
2. **Invoice history** — show past invoices with date, amount, status, PDF link

Both use cached live fetch from Stripe API. No schema changes, no webhook handler changes (only `revalidateTag` calls added).

---

## Approach: Cached Live Fetch

Both features use `unstable_cache` wrapping Stripe API calls, with webhook-driven `revalidateTag` for real-time freshness. 1-hour TTL as safety fallback.

**Why not DB sync:** This project has Neon free tier timeout issues. Adding more DB writes to the webhook handler and more queries to the billing page would make those worse. Cached fetch avoids both problems.

---

## Pre-requisite Fix: `syncAfterPayment` IDOR

**CRITICAL security bug found during review:** `syncAfterPayment` in `app/actions/checkout.ts` accepts a `stripeCustomerId` parameter from the client. Any authenticated user can call it with another customer's ID. Fix before building new features.

**Fix:** Remove the parameter, derive from `auth()`:

```typescript
export async function syncAfterPayment(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.stripeCustomerId) return;
  await syncStripeData(user.stripeCustomerId);
  revalidatePath('/dashboard/billing');
}
```

Update `checkout-form.tsx` to call `syncAfterPayment()` with no arguments.

---

## Feature 1: Credit Balance

### How it works

Stripe stores a `balance` on every Customer. Negative = credit (from downgrades). Stripe auto-applies it to the next invoice.

### Implementation

**`lib/stripe/balance.ts`** — cached fetch, auth-derived customerId:

```typescript
import 'server-only';
import { unstable_cache } from 'next/cache';
import { stripe } from './client';

export function getCachedCreditBalance(stripeCustomerId: string) {
  return unstable_cache(
    async () => {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (customer.deleted) return null;
      if (customer.balance >= 0) return null; // no credit
      return {
        amount: Math.abs(customer.balance), // cents, positive for display
        currency: customer.currency ?? 'usd',
      };
    },
    [`credit-balance-${stripeCustomerId}`],
    { revalidate: 3600, tags: [`credit-balance-${stripeCustomerId}`] }
  )();
}
```

**Key decisions from review:**
- **Cached** (not live) — balance only changes on plan change or invoice payment. Saves ~100ms per page load.
- **1-hour TTL** with webhook-driven `revalidateTag` for freshness.
- **Called from billing page Server Component** (not a Server Action — this is a read, not a mutation).
- **`stripeCustomerId` comes from the DB lookup** in the billing page, NOT from client input.

**Billing page** — fetch in parallel:

```typescript
// In billing page Server Component:
const creditBalance = user?.stripeCustomerId
  ? await getCachedCreditBalance(user.stripeCustomerId)
  : null;
```

**UI** — between Payment Method and Invoice History:

```
┌──────────────────────────────────────────┐
│  $40.00 credit                           │
│  Automatically applied to your next      │
│  invoice.                                │
└──────────────────────────────────────────┘
```

- Only renders when `creditBalance` is non-null
- Amount in teal (`text-accent`, `font-mono`)
- Card pattern: `rounded-2xl border border-border bg-surface`

### Tasks

- [ ] Fix `syncAfterPayment` IDOR (remove `stripeCustomerId` parameter)
- [ ] Create `lib/stripe/balance.ts` with `getCachedCreditBalance()`
- [ ] Add credit balance section to billing page
- [ ] Add `revalidateTag(`credit-balance-${customerId}`)` to webhook handler for `invoice.paid` and `customer.subscription.updated` events

---

## Feature 2: Invoice History

### How it works

Fetch customer's invoices from Stripe, cache per customer. Webhook busts cache when new invoices are paid.

### Implementation

**`lib/stripe/invoices.ts`** — cached fetch:

```typescript
import 'server-only';
import { unstable_cache } from 'next/cache';
import { stripe } from './client';

export function getCachedInvoices(stripeCustomerId: string) {
  return unstable_cache(
    async () => {
      const invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 10,
      });
      return invoices.data
        .filter((inv) => inv.status === 'paid' || inv.status === 'open')
        .map((inv) => ({
          id: inv.id,
          amountPaid: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          invoiceUrl: inv.hosted_invoice_url,
          invoicePdf: inv.invoice_pdf,
          created: inv.created,
        }));
    },
    [`invoices-${stripeCustomerId}`],
    { revalidate: 3600, tags: [`invoices-${stripeCustomerId}`] }
  )();
}
```

**Key decisions from review:**
- **1-hour TTL** (not 5 min) — invoices change only on payment events. Webhook `revalidateTag` handles real-time freshness. Reduces Stripe API calls by 12x.
- **`limit: 10`** — explicit, shows last 10 invoices.
- **Filter to `paid` and `open`** — don't show drafts or voided.
- **Invoice URLs are permanent** — security review noted these are unauthenticated permanent links. Acceptable for a demo; for production, proxy through a server route.

**Webhook cache busting** — in `lib/stripe/webhooks.ts`:

```typescript
import { revalidateTag } from 'next/cache';

// After sync, bust caches for this customer:
if (['invoice.paid', 'invoice.payment_failed'].includes(event.type)) {
  revalidateTag(`invoices-${customerId}`);
  revalidateTag(`credit-balance-${customerId}`);
}
```

**`components/invoice-history.tsx`** — table component:

```
┌────────────────────────────────────────────────────────┐
│ Invoices                                               │
├────────────┬──────────┬────────┬───────────────────────┤
│ Jun 5 2026 │ $29.00   │ Paid   │ View  ·  PDF          │
│ Jun 5 2026 │ $49.00   │ Paid   │ View  ·  PDF          │
│ Jun 5 2026 │ $9.00    │ Paid   │ View  ·  PDF          │
└────────────┴──────────┴────────┴───────────────────────┘
```

- Uses `gap-px bg-border` grid pattern
- Status: "Paid" in green (`text-status-active`), "Open" in amber (`text-status-canceling`)
- "View" → `invoiceUrl`, "PDF" → `invoicePdf` (both open in new tab)
- Empty state: "No invoices yet"

### Tasks

- [ ] Create `lib/stripe/invoices.ts` with `getCachedInvoices()`
- [ ] Create `components/invoice-history.tsx`
- [ ] Add invoice history section to billing page
- [ ] Add `revalidateTag` calls to webhook handler for invoice + credit balance cache busting

---

## Billing Page Layout (After)

```
Billing
├── Subscription Card (plan, status, dates, change/cancel)
├── Payment Method (card, update button)
├── Credit Balance ($XX credit — auto-applied)  ← NEW
├── Invoice History (table: date, amount, status, links) ← NEW
```

## Files Summary

| Action | Files |
|---|---|
| **Create** | `lib/stripe/balance.ts`, `lib/stripe/invoices.ts`, `components/invoice-history.tsx` |
| **Modify** | `app/dashboard/billing/page.tsx` (add both sections), `lib/stripe/webhooks.ts` (add revalidateTag), `app/actions/checkout.ts` (fix syncAfterPayment IDOR), `components/checkout-form.tsx` (remove stripeCustomerId arg) |

**Total: 3 new files, 4 modified files. Zero schema changes. Zero new DB queries.**

## Security Checklist

- [ ] `syncAfterPayment` no longer accepts `stripeCustomerId` from client
- [ ] `getCachedCreditBalance` derives customerId from auth, not from parameters
- [ ] Invoice URLs open in new tab (`target="_blank" rel="noopener"`)
- [ ] Cache keys always validated non-null before construction

## References

- [Stripe Customer Balance](https://docs.stripe.com/billing/customer/balance)
- [Stripe List Invoices](https://docs.stripe.com/api/invoices/list)
- [Next.js unstable_cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache)

# feat: In-App Stripe Billing (Replace Hosted Checkout & Portal)

## Enhancement Summary

**Deepened on:** 2026-06-04
**Review agents used:** security-sentinel, architecture-strategist, performance-oracle, code-simplicity-reviewer, frontend-design skill

### Key Improvements from Review
1. **Simplified from 5 phases to 3** — merged cancel/reactivate into plan management, dropped cleanup as separate phase
2. **8 server actions reduced to 4** — dropped retryPayment, removePaymentMethod, listPaymentMethods; merged cancel+reactivate
3. **Dropped `/checkout/success` page** — reuse existing `?sync=1` pattern on billing page for 3DS returns
4. **Security fix: generate prorationDate server-side** — never accept from client (manipulable)
5. **Performance: `syncFromSubscription()` variant** — use Stripe response directly instead of re-fetching (saves 200-400ms per mutation)
6. **Typed server action returns** — discriminated unions instead of thrown errors

---

## Overview

Replace Stripe's hosted Checkout page and Customer Portal with fully in-app experiences. No redirects to `checkout.stripe.com` or `billing.stripe.com`.

**What changes:**
- Pricing page → dedicated `/checkout` page with embedded Stripe Elements PaymentElement
- "Manage subscription" button → inline upgrade/downgrade, cancel/reactivate, add payment method
- Success page → removed (3DS return goes to `/dashboard/billing?sync=1`)

**What stays the same:**
- Webhook handler, sync function, auth, design system

---

## Phase 1: Embedded Checkout with Stripe Elements

**Goal:** Replace `createCheckoutSession` → Stripe hosted Checkout with an in-app payment form.

### Architecture

Use the **deferred Elements pattern** (recommended by Stripe for Next.js):
1. Mount `<Elements>` with `mode: 'subscription'` — form renders instantly, no server round-trip
2. User fills out the PaymentElement form
3. On submit: `elements.submit()` → server action creates Subscription → `stripe.confirmPayment()` with client secret
4. 3DS handled automatically by Stripe.js
5. `redirect: 'if_required'` keeps user on page for most cards; `return_url` set to `/dashboard/billing?sync=1` for 3DS redirects

### New Files

**`components/stripe-provider.tsx`** — Client component, Elements wrapper with dark theme appearance
- `loadStripe` from `@stripe/stripe-js/pure` (no auto-inject, lazy loaded)
- Appearance API matching app's dark theme: `night` base, teal primary, surface backgrounds, border colors
- Props: `mode` ('subscription' | 'setup'), `amount`, `currency`

**`components/checkout-form.tsx`** — Client component, PaymentElement + submit logic
- `elements.submit()` validates → server action returns `{ success, clientSecret }` → `stripe.confirmPayment()`
- On success (no redirect): call `syncAfterPayment` server action, toast, `router.push('/dashboard/billing')`
- On error: show error below form
- Loading spinner in submit button during processing

**`app/checkout/page.tsx`** — Server component, dedicated checkout page
- Split-screen layout: order summary (left) + payment form (right)
- Reads `?plan=pro_monthly` from searchParams, fetches price from Stripe
- Redirects to `/pricing` if no `?plan` param
- Requires auth: redirects to `/login?redirect=/checkout?plan=xxx`
- Shows plan name, price, features list, "Due today" total

### New Server Actions (`app/actions/checkout.ts`)

**`createSubscriptionAction(priceId: string)`**
```typescript
type SubscriptionResult =
  | { success: true; clientSecret: string; subscriptionId: string }
  | { success: false; error: string };
```
- Auth check
- Validate priceId against `getCachedPrices()` (not just prefix)
- Get or create Stripe customer (existing idempotency key logic)
- Cancel any existing `incomplete` subscriptions for this customer
- Check for existing `active` subscription (redirect if exists — check local DB, not Stripe API)
- `stripe.subscriptions.create({ payment_behavior: 'default_incomplete', payment_settings: { save_default_payment_method: 'on_subscription' }, expand: ['latest_invoice.payment_intent'] })`
- Returns `{ success: true, clientSecret }` — does NOT redirect

### Files to Modify

- **`components/pricing-card.tsx`** — Change button to `<Link href="/checkout?plan=xxx">` instead of form action
- **`components/pricing-page-client.tsx`** — Remove form action, cards become links
- **`middleware.ts`** — Add `/checkout/:path*` to matcher
- **`lib/stripe/sync.ts`** — Add `syncFromSubscription(sub, userId)` variant that writes directly from a Stripe response instead of re-fetching

### Files to Delete

- `app/success/page.tsx` — 3DS returns go to `/dashboard/billing?sync=1` (already handles sync)
- `app/success/loading.tsx`

### Tasks

- [ ] `npm install @stripe/react-stripe-js`
- [ ] Create `components/stripe-provider.tsx` with dark theme Appearance API
- [ ] Create `components/checkout-form.tsx` with PaymentElement + deferred confirmation
- [ ] Create `app/checkout/page.tsx` (split-screen: order summary + payment form)
- [ ] Create `app/actions/checkout.ts` with `createSubscriptionAction`
- [ ] Add `syncFromSubscription()` to `lib/stripe/sync.ts`
- [ ] Validate priceId against `getCachedPrices()` allowlist
- [ ] Add `/checkout/:path*` to middleware matcher
- [ ] Update `pricing-card.tsx` to use `<Link>` instead of form action
- [ ] Delete `app/success/page.tsx` and `app/success/loading.tsx`
- [ ] Delete old `createCheckoutSession` from `app/actions/stripe.ts`
- [ ] Test: checkout with `4242 4242 4242 4242`
- [ ] Test: 3DS with `4000 0025 0000 3155` (redirects to billing?sync=1)
- [ ] Test: declined with `4000 0000 0000 9995`

---

## Phase 2: In-App Plan Management + Cancel/Reactivate

**Goal:** Replace Customer Portal plan switching and cancellation with inline controls on the billing page.

### Architecture — Plan Changes

1. Billing page shows "Change plan" button
2. Opens plan selector: 3 compact cards with radio-style selection + monthly/annual toggle
3. Selecting a plan fetches proration preview from Stripe
4. Shows proration strip: "You'll be charged $X today" or "You'll receive $X credit"
5. "Confirm change" executes the update, syncs, refreshes page

### Architecture — Cancel/Reactivate

- "Cancel subscription" button → opens confirmation modal
- Modal shows plan name, access-until date, destructive red "Cancel" button
- After cancel: toast, page shows "Canceling" badge + date
- "Keep my subscription" button appears when `cancelAtPeriodEnd` is true → reactivates

### New Server Actions (`app/actions/subscription.ts`)

**`previewPlanChange(newPriceId: string)`**
- Fetches current subscription from DB
- Calls `stripe.invoices.createPreview()` with current item + new price
- Generates `prorationDate` server-side (never from client)
- Returns `{ amountDue, currency, isUpgrade, prorationLines[] }`

**`confirmPlanChange(newPriceId: string)`**
- Generates fresh `prorationDate` server-side
- Upgrades: `proration_behavior: 'always_invoice'` (charge now)
- Downgrades: `proration_behavior: 'create_prorations'` (credit on next invoice)
- Calls `syncFromSubscription()` with the response
- If 3DS required: returns `{ success: true, requiresAction: true, clientSecret }`
- Billing page needs bare `loadStripe()` (no Elements) for `stripe.handleNextAction()`
- Calls `revalidatePath('/dashboard/billing')`

**`toggleCancellation(cancel: boolean)`**
- `stripe.subscriptions.update(subId, { cancel_at_period_end: cancel })`
- Calls `syncFromSubscription()` with response
- Returns `{ success: true, cancelAt: Date | null }`

### New Components

**`components/plan-selector.tsx`** — Client component
- Compact 3-column card grid with radio-style selection indicator
- Reuses existing `BillingToggle` for monthly/annual
- Current plan has "Current" badge, disabled
- On selection: fetches proration preview (with loading skeleton)
- Shows proration strip below cards (using `gap-px bg-border` grid pattern)
- "Confirm change" and "Cancel" buttons

**`components/cancel-dialog.tsx`** — Client component
- Modal with dark scrim + backdrop blur
- Warning icon (status-past-due color), plan info grid, access-until date
- "Keep subscription" (secondary) + "Cancel subscription" (destructive red, `bg-status-past-due`)

### Files to Modify

**`app/dashboard/billing/page.tsx`** — Major changes:
- Fix `isActive` check to include `past_due` (currently hides subscription card)
- Add "Change plan" button in subscription card header
- Add cancel/reactivate buttons in actions area
- Conditionally render `PlanSelector` when changing
- Remove `redirectToCustomerPortal` and `ManageSubscriptionButton`

### Files to Delete

- `components/manage-subscription-button.tsx`
- `redirectToCustomerPortal` from `app/actions/stripe.ts`

### Tasks

- [ ] Create `app/actions/subscription.ts` with `previewPlanChange`, `confirmPlanChange`, `toggleCancellation`
- [ ] Create `components/plan-selector.tsx` with proration preview
- [ ] Create `components/cancel-dialog.tsx` with confirmation modal
- [ ] Handle 3DS on upgrade: bare `loadStripe()` + `stripe.handleNextAction()` on billing page
- [ ] Rebuild billing page: add change plan, cancel, reactivate controls
- [ ] Fix `isActive` to show subscription card for `past_due` status
- [ ] Add toast notifications for plan change, cancel, reactivate
- [ ] Delete `ManageSubscriptionButton` and `redirectToCustomerPortal`
- [ ] Test: upgrade Starter → Pro (immediate charge)
- [ ] Test: downgrade Pro → Starter (credit)
- [ ] Test: monthly → annual switch
- [ ] Test: cancel → shows "Canceling" badge
- [ ] Test: reactivate → shows "Active" badge

---

## Phase 3: In-App Payment Method Update

**Goal:** Allow users to add/update their payment method without leaving the app.

### Architecture

- Show current default card from existing synced DB data (brand + last4 already stored)
- "Update payment method" button opens inline PaymentElement form via SetupIntent
- After successful setup: set as default on subscription, sync
- No multi-card management for demo scope (no list, no remove, no default switching)

### New Server Actions (`app/actions/payment-methods.ts`)

**`createSetupIntent()`**
- Creates `stripe.setupIntents.create({ customer, automatic_payment_methods: { enabled: true } })`
- Returns `{ success: true, clientSecret }`

**`setDefaultPaymentMethod(paymentMethodId: string)`**
- Verify ownership: `stripe.paymentMethods.retrieve(pmId)` → check `pm.customer === stripeCustomerId`
- `stripe.subscriptions.update(subId, { default_payment_method: paymentMethodId })`
- Calls `syncFromSubscription()` with response
- Returns `{ success: true }`

### New Components

**`components/update-payment-method.tsx`** — Client component
- Shows current card (brand + last4 from DB) in a `gap-px bg-border` row
- "Update card" button expands inline PaymentElement form (SetupIntent, `mode: 'setup'`)
- `StripeProvider` wraps just this section with `mode: 'setup'`
- On submit: `elements.submit()` → `createSetupIntent()` → `stripe.confirmSetup({ redirect: 'if_required' })`
- On success: calls `setDefaultPaymentMethod(pm.id)`, shows toast, collapses form

### Files to Modify

**`app/dashboard/billing/page.tsx`**
- Add payment method section below subscription details
- Render `UpdatePaymentMethod` component with current card data

**`lib/stripe/sync.ts`**
- Store `pm?.id` as `paymentMethodId` in subscriptions table

**`lib/db/schema.ts`**
- Add `paymentMethodId: text('payment_method_id')` to subscriptions

### Tasks

- [ ] Add `paymentMethodId` column to schema, run `npx drizzle-kit push`
- [ ] Update `syncStripeData` and `syncFromSubscription` to store `pm.id`
- [ ] Create `app/actions/payment-methods.ts` with `createSetupIntent`, `setDefaultPaymentMethod`
- [ ] Create `components/update-payment-method.tsx` with inline form
- [ ] Add payment method section to billing page
- [ ] Add toast for successful card update
- [ ] Delete old `app/actions/stripe.ts` (all actions now in `checkout.ts`, `subscription.ts`, `payment-methods.ts`)
- [ ] Update `CLAUDE.md` and `README.md`
- [ ] Test: add new card via SetupIntent
- [ ] Test: verify new card becomes default
- [ ] Test full flow: new user → checkout → upgrade → update card → cancel → reactivate

---

## Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Elements init pattern | Deferred (`mode: 'subscription'`) | Form renders instantly, no server round-trip |
| Checkout location | Separate `/checkout` page | Clean URL for 3DS `return_url`, simpler than modal |
| 3DS return handler | Existing `?sync=1` on billing page | No new page needed, pattern already works |
| Subscription creation | `payment_behavior: 'default_incomplete'` | Returns client_secret for client-side confirmation |
| Server action returns | Typed discriminated unions | No thrown errors, client handles success/failure explicitly |
| Sync after mutations | `syncFromSubscription(sub)` variant | Uses Stripe response directly, saves 200-400ms re-fetch |
| Upgrade proration | `always_invoice` (charge now) | Users expect immediate access to higher tier |
| Downgrade proration | `create_prorations` (credit) | Credit on next invoice, users keep current tier |
| ProrationDate | Generated server-side only | Never accept from client (security: manipulable) |
| Cancel/reactivate | Single `toggleCancellation(bool)` action | Same API call, different boolean — no need for 2 actions |
| Cancel behavior | `cancel_at_period_end: true` | Users keep access until paid period expires |
| Payment methods | Show default only, update via SetupIntent | No multi-card management for demo scope |
| Stripe.js loading | `@stripe/stripe-js/pure` + lazy load | Prevents 40KB from penalizing non-billing pages |
| Post-action refresh | `syncFromSubscription()` + `revalidatePath` | Fresh data on re-render without extra Stripe API call |
| Action file split | `checkout.ts`, `subscription.ts`, `payment-methods.ts` | Single-responsibility, ~60-100 lines each |

## Files Summary

| Action | Files |
|---|---|
| **Create** | `components/stripe-provider.tsx`, `components/checkout-form.tsx`, `components/plan-selector.tsx`, `components/cancel-dialog.tsx`, `components/update-payment-method.tsx`, `app/checkout/page.tsx`, `app/actions/checkout.ts`, `app/actions/subscription.ts`, `app/actions/payment-methods.ts` |
| **Modify** | `app/dashboard/billing/page.tsx` (rebuild), `lib/stripe/sync.ts` (add syncFromSubscription + paymentMethodId), `lib/db/schema.ts` (add column), `components/pricing-card.tsx` (link instead of form), `middleware.ts` (add /checkout), `package.json` (add @stripe/react-stripe-js) |
| **Delete** | `app/actions/stripe.ts`, `components/manage-subscription-button.tsx`, `app/success/page.tsx`, `app/success/loading.tsx` |

## References

- [Build subscriptions with Elements](https://docs.stripe.com/billing/subscriptions/build-subscriptions?platform=web&ui=elements)
- [Deferred intent creation](https://docs.stripe.com/payments/accept-a-payment-deferred?platform=web&type=subscription)
- [Proration preview](https://docs.stripe.com/api/invoices/create_preview)
- [Cancel subscriptions](https://docs.stripe.com/billing/subscriptions/cancel)
- [SetupIntents for saving cards](https://docs.stripe.com/payments/setup-intents)
- [PaymentElement Appearance API](https://docs.stripe.com/elements/appearance-api)
- [Stripe React components](https://docs.stripe.com/sdks/stripejs-react)

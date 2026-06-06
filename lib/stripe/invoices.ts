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
          status: inv.status ?? 'unknown',
          invoiceUrl: inv.hosted_invoice_url ?? null,
          invoicePdf: inv.invoice_pdf ?? null,
          created: inv.created,
        }));
    },
    [`invoices-${stripeCustomerId}`],
    { revalidate: 3600, tags: [`invoices-${stripeCustomerId}`] }
  )();
}

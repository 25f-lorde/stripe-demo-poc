interface Invoice {
  id: string;
  amountPaid: number;
  currency: string;
  status: string;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  created: number;
}

export function InvoiceHistory({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="mt-12">
        <h2 className="font-display text-2xl text-zinc-50">Invoices</h2>
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface py-12 text-center">
          <p className="text-zinc-400">No invoices yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12">
      <h2 className="font-display text-2xl text-zinc-50">Invoices</h2>
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="grid grid-cols-1 gap-px bg-border">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between bg-surface px-8 py-4">
              <div className="flex items-center gap-8">
                <p className="font-mono text-sm text-zinc-300">
                  {new Date(inv.created * 1000).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="font-mono text-sm text-zinc-200">
                  ${(inv.amountPaid / 100).toFixed(2)}
                </p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    inv.status === 'paid'
                      ? 'bg-status-active/10 text-status-active'
                      : 'bg-status-canceling/10 text-status-canceling'
                  }`}
                >
                  {inv.status}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {inv.invoiceUrl && (
                  <a
                    href={inv.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    View
                  </a>
                )}
                {inv.invoicePdf && (
                  <a
                    href={inv.invoicePdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

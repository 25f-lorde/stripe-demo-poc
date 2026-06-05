'use client';

import { useFormStatus } from 'react-dom';
import { redirectToCustomerPortal } from '@/app/actions/stripe';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm text-zinc-200 transition-all hover:border-accent hover:text-zinc-100 disabled:opacity-50"
    >
      {pending && (
        <svg
          className="h-3.5 w-3.5 animate-spin"
          viewBox="0 0 16 16"
          fill="none"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="28"
            strokeDashoffset="8"
          />
        </svg>
      )}
      Manage subscription
    </button>
  );
}

export function ManageSubscriptionButton() {
  return (
    <form action={redirectToCustomerPortal}>
      <SubmitButton />
    </form>
  );
}

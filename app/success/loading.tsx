export default function SuccessLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/30">
            <svg className="h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <h1 className="mt-8 font-display text-2xl text-zinc-100">
          You&apos;re all set
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Confirming your subscription...
        </p>
        <div className="mt-6 h-0.5 w-48 overflow-hidden rounded-full bg-surface-overlay">
          <div className="h-full w-full origin-left animate-loading rounded-full bg-accent" />
        </div>
      </div>
    </div>
  );
}

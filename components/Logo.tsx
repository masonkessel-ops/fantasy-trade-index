export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-[28%] bg-gradient-to-tr from-brand-2 to-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] ${className}`}>
      <svg viewBox="0 0 32 32" className="size-full" aria-hidden>
        {/* rising index bars + trend line */}
        <rect x="7.5" y="18" width="4" height="7" rx="1.2" fill="#fff" />
        <rect x="14" y="13.5" width="4" height="11.5" rx="1.2" fill="#fff" />
        <rect x="20.5" y="9" width="4" height="16" rx="1.2" fill="#fff" />
        <path d="M7 14.5 13.5 9.5l4 2.5L25 6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".6" />
      </svg>
    </span>
  );
}

export function Wordmark() {
  return (
    <span className="flex flex-col font-display font-extrabold uppercase italic leading-none tracking-wide">
      <span className="text-[0.6rem] tracking-[0.32em] text-muted">Fantasy</span>
      <span className="whitespace-nowrap text-[1.2rem]">
        Trade <span className="text-gradient">Index</span>
      </span>
    </span>
  );
}

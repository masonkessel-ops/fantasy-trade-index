export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-[28%] bg-gradient-to-tr from-flame to-rocket ${className}`}>
      <svg viewBox="0 0 32 32" className="size-full" aria-hidden>
        <path
          d="M21.6 7.2c-3.7.3-6.8 2.6-8.6 5.9l-2.6.4-2.2 2.6 3.2.6.3.3-1 1.6 2.6 2.6 1.6-1 .3.3.6 3.2 2.6-2.2.4-2.6c3.3-1.8 5.6-4.9 5.9-8.6l.1-2.3-2.3.1Z"
          fill="#0b0e15"
        />
        <circle cx="19.4" cy="12.6" r="1.7" fill="#ff8a25" />
        <path d="M10.4 19.4c-1.6.4-2.6 2-2.6 4.8 2.8 0 4.4-1 4.8-2.6" stroke="#0b0e15" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Wordmark() {
  return (
    <span className="font-display text-[1.35rem] font-extrabold uppercase italic leading-none tracking-wide">
      Trade<span className="text-gradient">Rocket</span>
    </span>
  );
}

import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="mb-6 flex animate-rise flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-rocket">{eyebrow}</p>
        )}
        <h1 className="font-display text-4xl font-extrabold uppercase italic leading-[0.95] tracking-tight sm:text-5xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

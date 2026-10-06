import type { ReactNode } from "react";

/** Readable long-form text (About, Privacy, Terms). */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="card max-w-3xl space-y-4 p-6 text-sm leading-relaxed text-muted sm:p-8 [&_a]:font-semibold [&_a]:text-rocket [&_a:hover]:underline [&_b]:text-ink [&_h2]:pt-2 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-ink [&_h3]:font-semibold [&_h3]:text-ink [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
      {children}
    </div>
  );
}

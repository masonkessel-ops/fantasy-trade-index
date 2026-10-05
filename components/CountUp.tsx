"use client";

import { useEffect, useRef } from "react";
import { animate } from "motion/react";

/** Number that animates from its previous value to the new one. */
export function CountUp({ value, className, decimals = 0 }: { value: number; className?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const controls = animate(prev.current, value, {
      duration: 0.9,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        el.textContent = v.toFixed(decimals);
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, decimals]);
  return (
    <span ref={ref} className={className}>
      {value.toFixed(decimals)}
    </span>
  );
}

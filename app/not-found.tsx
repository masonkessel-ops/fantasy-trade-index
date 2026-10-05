import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="font-display text-8xl font-extrabold italic text-gradient">404</div>
      <h1 className="mt-2 font-display text-2xl font-bold uppercase">Incomplete pass</h1>
      <p className="mt-1 text-sm text-muted">That page or player isn&apos;t on the roster.</p>
      <Link href="/values" className="mt-6 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-bg transition hover:bg-white">
        Back to trade values
      </Link>
    </div>
  );
}

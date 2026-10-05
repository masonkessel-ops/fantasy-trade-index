import Link from "next/link";
import { Rocket } from "lucide-react";
import { PageHeader } from "./PageHeader";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader eyebrow="Coming soon" title={title} subtitle={description} />
      <div className="card flex animate-rise flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-rocket to-flame text-bg">
          <Rocket className="size-7" />
        </span>
        <p className="max-w-sm text-sm text-muted">This feature is being built next. In the meantime, check out the trade value chart.</p>
        <Link href="/values" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-bg transition hover:bg-white">
          View trade values
        </Link>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Prose } from "@/components/Prose";
import { CONTACT_URL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Last updated October 6, 2026" title="Terms" subtitle={`The rules for using ${SITE_NAME}.`} />
      <Prose>
        <h2>For fun and information</h2>
        <p>
          {SITE_NAME} gives fantasy football opinions based on public data and models. Values, grades, projections and suggestions can be wrong and can change at any
          time. Use your own judgment; we&apos;re not responsible for trades, lineups or results in your leagues, or for any money involved.
        </p>

        <h2>Not affiliated</h2>
        <p>
          We&apos;re independent and not affiliated with or endorsed by the NFL, its teams or players, Yahoo, ESPN, Sleeper, FantasyCalc or any other fantasy platform.
          Names and logos belong to their owners.
        </p>

        <h2>Fair use of the site</h2>
        <p>Please don&apos;t overload the site with automated requests, try to break it, or use it for anything illegal. We may limit or block abusive traffic.</p>

        <h2>No warranty</h2>
        <p>The site is provided as is, without warranties of any kind, and may be changed or taken offline at any time.</p>

        <h2>Changes and contact</h2>
        <p>
          We may update these terms; the date above shows the latest version. Questions: <a href={CONTACT_URL}>open an issue on GitHub</a>.
        </p>
      </Prose>
    </>
  );
}

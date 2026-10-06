import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Prose } from "@/components/Prose";
import { CONTACT_URL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Last updated October 6, 2026" title="Privacy" subtitle={`What ${SITE_NAME} stores, and what it doesn't.`} />
      <Prose>
        <h2>The short version</h2>
        <p>No ads, no tracking scripts, and we never sell or share your data. You can use every feature without an account.</p>

        <h2>What we store</h2>
        <ul>
          <li>
            <b>Your team (no account):</b> saved only in your own browser. Clearing your browser data or tapping Reset on My Team removes it.
          </li>
          <li>
            <b>Your scoring setting:</b> a small cookie remembering PPR, half-PPR or standard.
          </li>
          <li>
            <b>If you sign in with Google:</b> your name, email address and profile photo from Google, kept in an encrypted cookie on your device, and your team saved
            in our database so it follows you to other devices. Tap Reset on My Team to delete the saved team; sign out to remove the cookie.
          </li>
          <li>
            <b>League imports:</b> Sleeper and public ESPN leagues are fetched from those services and saved with your team. For private ESPN leagues, the cookies you
            paste are used once to fetch the league and are never stored.
          </li>
          <li>
            <b>Yahoo sign-in (when available):</b> Yahoo&apos;s access token is kept in an encrypted cookie on your device and used only to read your leagues.
          </li>
          <li>
            <b>Screenshots:</b> read inside your browser and never uploaded. Only the text found in them is sent to match player names, and it isn&apos;t stored.
          </li>
        </ul>

        <h2>Services we use</h2>
        <p>
          Vercel hosts the site (standard server logs such as IP address and pages requested). Player data comes from Sleeper and market values from FantasyCalc; your
          personal data isn&apos;t sent to either. The screenshot reader downloads from the jsDelivr CDN. Google provides sign-in, and Upstash stores saved teams.
        </p>

        <h2>Children</h2>
        <p>The site isn&apos;t directed at children under 13, and we don&apos;t knowingly collect their information.</p>

        <h2>Contact</h2>
        <p>
          Questions or deletion requests: <a href={CONTACT_URL}>open an issue on GitHub</a>.
        </p>
      </Prose>
    </>
  );
}

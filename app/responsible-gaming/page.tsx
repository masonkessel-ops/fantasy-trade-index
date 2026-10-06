import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Prose } from "@/components/Prose";

export const metadata: Metadata = { title: "Responsible Gaming & Ad Disclosure" };

export default function ResponsibleGamingPage() {
  return (
    <>
      <PageHeader eyebrow="Play it safe" title="Responsible gaming" subtitle="How partner offers work on this site, and where to get help." />
      <Prose>
        <h2>Partner offers</h2>
        <p>
          Some pages show offers from daily fantasy and pick&apos;em apps. They&apos;re labeled <b>Partner offer</b> and <b>Ad</b>. If you sign up through one, we
          may earn a commission at no cost to you. Partners never pay to change our values, rankings or trade grades, which come only from the market and our model.
          Premium members don&apos;t see partner offers.
        </p>

        <h2>Who can play</h2>
        <ul>
          <li>You must be 21 or older (19+ in Alabama and Nebraska; 18+ in some states).</li>
          <li>Paid fantasy contests aren&apos;t legal everywhere. Check that the app is available in your state; each app checks your location.</li>
          <li>Only play with money you can afford to lose. Fantasy contests involve risk.</li>
        </ul>

        <h2>Get help</h2>
        <ul>
          <li>
            Call or text <b>1-800-GAMBLER</b> (1-800-426-2537), 24/7, free and confidential.
          </li>
          <li>
            <a href="https://www.ncpgambling.org/help-treatment/">National Council on Problem Gambling</a>: chat, local resources and self-assessment.
          </li>
          <li>Most apps let you set deposit limits, take a break, or self-exclude in their account settings.</li>
        </ul>
      </Prose>
    </>
  );
}

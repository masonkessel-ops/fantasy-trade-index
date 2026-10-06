import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { getScoring } from "@/lib/prefs";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: Fantasy Football Trade Values & Trade Analyzer`, template: `%s · ${SITE_NAME}` },
  description:
    "Free fantasy football trade values on a 1–100 scale, a trade analyzer with fair-trade grades, a trade finder for your roster, and an auto lineup that starts the players projected to score the most.",
  applicationName: SITE_NAME,
  keywords: ["fantasy football", "trade values", "trade analyzer", "trade calculator", "trade chart", "start sit", "lineup optimizer", "waiver wire"],
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_NAME, description: SITE_TAGLINE, url: SITE_URL },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_TAGLINE },
  appleWebApp: { capable: true, title: "Trade Index", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#07070c",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const scoring = await getScoring();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} antialiased`}>
      <body className="min-h-dvh">
        <Nav scoring={scoring} />
        <main className="pb-28 lg:pb-12 lg:pl-64">
          <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 lg:px-10 lg:pt-10">
            {children}
            <Footer />
          </div>
        </main>
      </body>
    </html>
  );
}

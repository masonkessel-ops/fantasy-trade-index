import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
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
  title: { default: "Fantasy Trade Index — Fantasy Football Trade Values", template: "%s · Fantasy Trade Index" },
  description: "Live fantasy football trade values, trade analyzer, AI trade assistant and weekly tracker.",
};

export const viewport: Viewport = {
  themeColor: "#05070c",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const scoring = await getScoring();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} antialiased`}>
      <body className="min-h-dvh">
        <Nav scoring={scoring} />
        <main className="pb-28 lg:pb-12 lg:pl-64">
          <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 lg:px-10 lg:pt-10">{children}</div>
        </main>
      </body>
    </html>
  );
}

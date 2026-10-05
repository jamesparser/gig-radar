import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "GigRadar — find the gigs that fit, draft the pitch", template: "%s · GigRadar" },
  description: "GigRadar finds the gigs that fit and drafts the pitch — you close the deal. Skill-fit job radar + AI proposal co-pilot for Upwork, Fiverr and Freelancer.",
  openGraph: {
    title: "GigRadar",
    description: "GigRadar finds the gigs that fit and drafts the pitch — you close the deal.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#07090d", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

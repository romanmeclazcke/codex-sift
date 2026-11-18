import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { JsonLd } from "@/components/JsonLd";
import { AUTHOR, SITE_URL } from "@/lib/content";
import "./globals.css";

const title = "Codex Sift — Model router for the Codex CLI";
const description =
  "Codex Sift routes each Codex CLI turn to flash, craft or forge before the turn is billed. TypeSafe Jev scores the request; your policy.yaml picks the lane. On twelve live prompts that cut estimated quota 53.7% versus always-forge. Built by Roman Meclazcke.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: "%s · Codex Sift",
  },
  description,
  applicationName: "Codex Sift",
  authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  keywords: [
    "Codex Sift",
    "Codex CLI",
    "OpenAI Codex",
    "model router",
    "TypeSafe Jev",
    "policy.yaml",
    "flash craft forge",
    "quota routing",
    "Roman Meclazcke",
  ],
  category: "technology",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Codex Sift",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: `@${AUTHOR.xHandle}`,
  },
  other: {
    "llms-txt": `${SITE_URL}/llms.txt`,
  },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <JsonLd />
        {children}
      </body>
    </html>
  );
}

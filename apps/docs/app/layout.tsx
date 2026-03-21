import "./global.css";
import { RootProvider } from "fumadocs-ui/provider";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mailshot.dev";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    template: "%s | mailshot",
    default: "mailshot - Serverless email sequences on AWS",
  },
  description:
    "Open-source serverless email sequences on AWS. Build onboarding drips and event-triggered sequences. Manage everything through Claude Code — no dashboard needed.",
  keywords: [
    "email sequences",
    "AWS email",
    "serverless email",
    "email automation",
    "Step Functions",
    "SES",
    "React Email",
    "Claude Code",
    "email marketing",
    "open source",
    "TypeScript",
    "CDK",
  ],
  authors: [{ name: "mailshot" }],
  creator: "mailshot",
  publisher: "mailshot",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "mailshot",
    title: "mailshot - Serverless email sequences on AWS",
    description:
      "Serverless email sequences on AWS. Build onboarding drips and event-triggered sequences. Manage everything through Claude Code — no dashboard needed.",
    images: [
      {
        url: "/og-image.png",
        alt: "mailshot - Serverless email sequences on AWS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "mailshot - Serverless email sequences on AWS",
    description:
      "Serverless email sequences on AWS. Build onboarding drips and event-triggered sequences. Manage everything through Claude Code — no dashboard needed.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: baseUrl,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "mailshot",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "AWS",
  description:
    "Serverless email sequences on AWS. Build onboarding drips and event-triggered sequences. Manage everything through Claude Code — no dashboard needed.",
  url: baseUrl,
  license: "https://opensource.org/licenses/MIT",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}

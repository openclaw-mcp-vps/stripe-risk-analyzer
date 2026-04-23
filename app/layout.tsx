import type { Metadata } from "next";
import { Space_Grotesk, Source_Sans_3 } from "next/font/google";

import "@/app/globals.css";

const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const fontBody = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://stripe-risk-analyzer.app"),
  title: {
    default: "Stripe Risk Analyzer",
    template: "%s | Stripe Risk Analyzer"
  },
  description:
    "Predict Stripe account suspension risk by monitoring disputes, refunds, payout issues, and transaction quality in real time.",
  keywords: [
    "Stripe risk monitoring",
    "chargeback alert",
    "Stripe suspension warning",
    "fintech tools",
    "ecommerce risk analytics"
  ],
  openGraph: {
    type: "website",
    title: "Stripe Risk Analyzer",
    description:
      "Analyze your Stripe account health, detect suspension triggers early, and receive proactive risk alerts.",
    siteName: "Stripe Risk Analyzer"
  },
  twitter: {
    card: "summary_large_image",
    title: "Stripe Risk Analyzer",
    description:
      "Predict Stripe suspension risk with dispute, refund, and transaction pattern analytics."
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${fontDisplay.variable} ${fontBody.variable} bg-[#0d1117] text-slate-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}

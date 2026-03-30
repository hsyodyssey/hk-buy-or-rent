import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hkbuyrent.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "香港房产成本计算器 | 买房 vs 租房 真实成本对比",
    template: "%s | 香港房产成本计算器",
  },
  description:
    "交互式分析香港买房与租房的真实成本。支持自住对比和以租养房模式，包含TCO/TCR计算、盈亏平衡分析、多年趋势预测和敏感度分析。Interactive Hong Kong property buy vs rent cost analyzer.",
  keywords: [
    "香港买房",
    "香港租房",
    "买房vs租房",
    "房产成本分析",
    "房产成本计算器",
    "property cost calculator",
    "以租养房",
    "按揭计算",
    "Hong Kong property",
    "buy vs rent Hong Kong",
    "mortgage calculator HK",
    "property investment Hong Kong",
    "TCO TCR",
    "rental yield",
  ],
  authors: [{ name: "HK Property Calculator" }],
  creator: "HK Property Calculator",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    alternateLocale: ["zh_TW", "en_US"],
    url: SITE_URL,
    siteName: "香港房产成本计算器",
    title: "香港房产成本计算器 | 买房 vs 租房 真实成本对比",
    description:
      "交互式分析香港买房与租房的真实成本。支持自住对比和以租养房模式，包含盈亏平衡分析和多年趋势预测。",
  },
  twitter: {
    card: "summary_large_image",
    title: "香港房产成本计算器 | 买房 vs 租房",
    description:
      "交互式分析香港买房与租房的真实成本，支持自住对比和以租养房模式。",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "香港房产成本计算器",
  alternateName: "HK Property Cost Calculator",
  description:
    "交互式分析香港买房与租房的真实成本。支持自住对比和以租养房投资回报分析。",
  url: SITE_URL,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "HKD",
  },
  inLanguage: ["zh-Hans", "zh-Hant", "en"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hans"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

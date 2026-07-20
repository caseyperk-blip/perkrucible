import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@neondatabase/auth-ui/css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://perkrucible.com"),
  title: "PERKRUCIBLE",
  description: "The Digital Crucible",
  other: {
    "google-adsense-account": "ca-pub-2021237326206654",
  },

  icons: {
    icon: "/images/milk-bottle-grid-v1.png",
    shortcut: "/images/milk-bottle-grid-v1.png",
    apple: "/images/milk-bottle-grid-v1.png",
  },

  openGraph: {
    title: "PERKRUCIBLE",
    description: "The Digital Crucible",
    images: [
      {
        url: "/images/perkrucible-link-preview-v2.png",
        width: 1728,
        height: 900,
        alt: "Three knights representing Iron Engine, Milk, and Digital Closet",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "PERKRUCIBLE",
    description: "The Digital Crucible",
    images: ["/images/perkrucible-link-preview-v2.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2021237326206654"
          crossOrigin="anonymous"
        />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}

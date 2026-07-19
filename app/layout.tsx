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

export const metadata: Metadata = {
  metadataBase: new URL("https://perkrucible.com"),
  title: "PERKRUCIBLE",
  description: "The Digital Crucible",

  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
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
      <body>{children}</body>
    </html>
  );
}

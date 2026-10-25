import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@neondatabase/auth-ui/css";
import { Providers } from "./providers";
import { SiteChrome } from "./components/SiteChrome";

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
  description: "A personal archive and repository of phantasmagoric information.",
  icons: {
    icon: "/images/perkrucible-p-favicon.png",
    shortcut: "/images/perkrucible-p-favicon.png",
    apple: "/images/perkrucible-p-favicon.png",
  },

  openGraph: {
    title: "PERKRUCIBLE",
    description: "A personal archive and repository of phantasmagoric information.",
    images: [
      {
        url: "/images/perkrucible-social-preview.jpg",
        width: 2172,
        height: 724,
        alt: "PERKRUCIBLE — Personal Archive",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "PERKRUCIBLE",
    description: "A personal archive and repository of phantasmagoric information.",
    images: ["/images/perkrucible-social-preview.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`} style={{ colorScheme: "dark" }}>
      <body><Providers><SiteChrome>{children}</SiteChrome></Providers></body>
    </html>
  );
}

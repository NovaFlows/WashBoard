import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WashBoard — Logiciel de gestion pour laveurs auto mobiles",
  description: "WashBoard est le logiciel tout-en-un pour les laveurs auto mobiles. Réservation en ligne, gestion des clients, agenda et comptabilité. Essai gratuit 14 jours.",
  keywords: ["lavage auto mobile", "laveur auto mobile", "logiciel lavage auto", "réservation lavage voiture", "detailing", "WashBoard", "washboard detailing", "logiciel detailing"],
  authors: [{ name: "WashBoard" }],
  creator: "WashBoard",
  metadataBase: new URL("https://washboard.fr"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://washboard.fr",
    siteName: "WashBoard",
    title: "WashBoard — Logiciel de gestion pour laveurs auto mobiles",
    description: "Réservation en ligne, gestion clients, agenda et comptabilité pour laveurs auto mobiles. Essai gratuit 14 jours.",
  },
  twitter: {
    card: "summary_large_image",
    title: "WashBoard — Logiciel de gestion pour laveurs auto mobiles",
    description: "Réservation en ligne, gestion clients, agenda et comptabilité pour laveurs auto mobiles.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  verification: {
    google: "p-3W-rX-mHw4cvbbLQo0ayYE-DJS0JqDdYMKumMnrXM",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

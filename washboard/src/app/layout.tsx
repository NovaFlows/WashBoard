import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import RecoveryRedirect from "@/components/auth/RecoveryRedirect";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WashBoard — L'outil de gestion pour laveurs auto mobiles",
  description: "Le logiciel tout-en-un des laveurs auto mobiles : page de réservation en ligne, agenda, suivi clients et comptabilité. Essai gratuit d'un mois, sans carte bancaire.",
  keywords: ["outil laveur auto mobile", "outil gestion lavage auto", "logiciel laveur auto", "lavage auto mobile", "laveur auto mobile", "logiciel lavage auto", "réservation lavage voiture", "detailing", "WashBoard", "logiciel detailing"],
  authors: [{ name: "WashBoard" }],
  creator: "WashBoard",
  metadataBase: new URL("https://www.washboard.fr"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://www.washboard.fr",
    siteName: "WashBoard",
    title: "WashBoard — L'outil de gestion pour laveurs auto mobiles",
    description: "L'outil de gestion des laveurs auto mobiles : réservation en ligne, agenda, clients et comptabilité. Un mois offert, sans carte bancaire.",
  },
  twitter: {
    card: "summary_large_image",
    title: "WashBoard — L'outil de gestion pour laveurs auto mobiles",
    description: "L'outil de gestion des laveurs auto mobiles : réservation en ligne, agenda, clients et comptabilité. Un mois offert, sans carte bancaire.",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Thème lu depuis le cookie côté serveur : la classe `dark` est posée
  // directement sur <html>. Pas de flash, et aucune balise <script> rendue
  // (donc plus d'avertissement React 19 / badge "Issue" en dev).
  const isDark = (await cookies()).get("theme")?.value === "dark";

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <a href="#main-content" className="skip-to-content">Aller au contenu</a>
        <RecoveryRedirect />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

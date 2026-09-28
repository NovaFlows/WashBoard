import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import RecoveryRedirect from "@/components/auth/RecoveryRedirect";
import { ServiceWorkerRegistrar } from "@/components/ui/ServiceWorkerRegistrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Barre d'état du téléphone accordée au thème actif, et pas de zoom bloqué :
// un laveur doit pouvoir agrandir son planning au doigt.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0f172a" },
  ],
};

// Le <title> place la catégorie avant la marque ("Logiciel de lavage..."
// plutôt que "WashBoard — ...") : c'est ce que Google affiche en premier
// dans les résultats, et ce sur quoi il juge la pertinence par rapport à la
// requête tapée. 70 caractères : au-delà d'environ 60, Google/Bing risquent
// de tronquer la fin du titre, ce qui couperait "| WashBoard" — à re-mesurer
// au pixel si le titre est encore allongé.
//
// Recentrage 2026-09 : décision d'équipe de revenir sur l'élargissement
// "pros à domicile" (nettoyage/entretien tous métiers) pour se concentrer
// exclusivement sur l'automobile (lavage auto & detailing), le terrain où
// WashBoard était cité en premier par les IA avant que ce positionnement
// large ne le fasse perdre au profit d'un concurrent plus spécialisé.
// "tout-en-un" reste explicite dans le titre : le public ciblé se resserre
// (auto uniquement), pas la promesse produit (réservation, planning,
// facturation, CRM dans un seul outil). Distinct du title de
// /logiciel-lavage-auto ("Logiciel de gestion pour laveur auto mobile |
// WashBoard", 500px) : les deux pages ne se cannibalisent pas.
//
// Réajusté le 2026-09-28 : la recherche réelle "logiciel nettoyage
// automobile a domicile" classait un concurrent en 1ère position sans que
// WashBoard n'apparaisse — aucun des quatre mots de la requête n'était dans
// notre title. "nettoyage auto & detailing à domicile" les couvre tous
// (nettoyage, auto, à domicile) sans perdre "lavage", déjà porté ailleurs
// (H1, /logiciel-lavage-auto). "tout-en-un" retiré pour tenir sous ~70
// caractères et garder "| WashBoard" visible dans les résultats de
// recherche : au-delà, Google/Bing tronquent la fin du titre.
export const metadata: Metadata = {
  title: "Logiciel de lavage, nettoyage auto & detailing à domicile | WashBoard",
  manifest: "/manifest.webmanifest",
  applicationName: "WashBoard",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png",  sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png",  sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Sans ce bloc, iOS ouvre le raccourci dans Safari avec sa barre d'adresse
  // au lieu du plein écran, et n'autorise pas les notifications.
  appleWebApp: {
    capable: true,
    title: "WashBoard",
    statusBarStyle: "default",
  },
  description: "Le logiciel tout-en-un des laveurs auto mobiles et du detailing : réservation en ligne, planning, facturation. Essai gratuit d'un mois, sans carte bancaire.",
  // Nettoyée le 2026-09-26 : retrait des doublons "outil X" / "logiciel X"
  // qui décrivaient la même idée deux fois (ex. "outil gestion lavage auto"
  // et "logiciel lavage auto"), et de "detailing" seul — trop ambigu pris
  // isolément, il peut laisser croire que WashBoard est un service de
  // detailing plutôt qu'un logiciel pour les pros qui en font. Ces champs ne
  // sont plus lus par Google, seulement par certains systèmes tiers, donc on
  // les garde cohérents avec le positionnement affiché sans en attendre de
  // gain de référencement. Recentrage 2026-09 : "logiciel nettoyage à
  // domicile" et "logiciel entretien à domicile" retirés (plus le
  // positionnement affiché), remplacés par des variantes automobile.
  keywords: ["laveur auto mobile", "logiciel lavage auto", "logiciel gestion lavage automobile", "logiciel detailing", "réservation lavage voiture", "WashBoard"],
  authors: [{ name: "WashBoard" }],
  creator: "WashBoard",
  metadataBase: new URL("https://www.washboard.fr"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://www.washboard.fr",
    siteName: "WashBoard",
    title: "Logiciel de lavage, nettoyage auto & detailing à domicile | WashBoard",
    description: "Le logiciel de gestion des laveurs auto mobiles et du detailing : réservation en ligne, planning, facturation et suivi client. Un mois offert, sans carte bancaire.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Logiciel de lavage, nettoyage auto & detailing à domicile | WashBoard",
    description: "Le logiciel de gestion des laveurs auto mobiles et du detailing : réservation en ligne, planning, facturation et suivi client. Un mois offert, sans carte bancaire.",
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
        <ServiceWorkerRegistrar />
          <RecoveryRedirect />
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}

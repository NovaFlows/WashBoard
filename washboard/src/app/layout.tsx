import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
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

// Refonte 2026, passe 1 : Archivo variable, chargée et exposée en variable
// CSS comme geistMono ci-dessus (jamais appliquée nulle part aujourd'hui,
// --font-geist-mono ne l'est pas non plus) — donc aucun écran ne change de
// police à cette passe. `axes: ["wdth"]` ajoute l'axe de largeur au-dessus
// du wght variable par défaut : c'est lui qui porte le contraste
// 100 %→118 % de la direction visuelle (métadonnées Google Fonts confirmées
// dans node_modules/next : Archivo expose wght 100–900 et wdth 62–125).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: "variable",
  axes: ["wdth"],
  display: "swap",
});

// Barre d'état du téléphone accordée au thème actif, et pas de zoom bloqué :
// un laveur doit pouvoir agrandir son planning au doigt.
//
// Socle mobile (refonte 2026, passe 0) :
// - viewportFit "cover" laisse la page passer sous l'encoche / la Dynamic
//   Island — sans lui, les env(safe-area-inset-*) posés ailleurs (globals.css,
//   DashboardShell, Sidebar) valent 0 et ne servent à rien.
// - interactiveWidget "resizes-content" fait rétrécir la mise en page quand
//   le clavier s'ouvre sur Chrome Android (déjà le comportement par défaut
//   sur iOS) : un champ en bas d'écran reste visible au-dessus du clavier au
//   lieu d'être masqué dessous.
// Les couleurs de theme-color restent en v1 (#ffffff / #0f172a) : les écrans
// actuels sont encore habillés en v1, les poser en v2 (#F6F5F3 / #0E0E11)
// maintenant ferait jurer la barre de statut avec un en-tête blanc pur / une
// surface slate-900 sur CHAQUE écran jusqu'à la bascule des jetons (passe 1
// puis écran par écran). À revoir quand les premiers écrans passent en v2.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  title: "WashBoard — L'outil de gestion pour pros du nettoyage et de l'entretien à domicile",
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
  description: "Le logiciel tout-en-un des pros du nettoyage et de l'entretien à domicile (lavage auto, detailing, ménage, entretien de piscine...) : page de réservation en ligne, agenda, suivi clients et comptabilité. Essai gratuit d'un mois, sans carte bancaire.",
  keywords: ["outil laveur auto mobile", "outil gestion lavage auto", "logiciel laveur auto", "lavage auto mobile", "laveur auto mobile", "logiciel lavage auto", "réservation lavage voiture", "detailing", "WashBoard", "logiciel detailing", "logiciel nettoyage à domicile", "outil pro du nettoyage mobile", "logiciel entretien à domicile"],
  authors: [{ name: "WashBoard" }],
  creator: "WashBoard",
  metadataBase: new URL("https://www.washboard.fr"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://www.washboard.fr",
    siteName: "WashBoard",
    title: "WashBoard — L'outil de gestion pour pros du nettoyage et de l'entretien à domicile",
    description: "L'outil de gestion des pros du nettoyage et de l'entretien à domicile : réservation en ligne, agenda, clients et comptabilité. Un mois offert, sans carte bancaire.",
  },
  twitter: {
    card: "summary_large_image",
    title: "WashBoard — L'outil de gestion pour pros du nettoyage et de l'entretien à domicile",
    description: "L'outil de gestion des pros du nettoyage et de l'entretien à domicile : réservation en ligne, agenda, clients et comptabilité. Un mois offert, sans carte bancaire.",
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
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased${isDark ? " dark" : ""}`}
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

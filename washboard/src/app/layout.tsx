import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import RecoveryRedirect from "@/components/auth/RecoveryRedirect";
import { ServiceWorkerRegistrar } from "@/components/ui/ServiceWorkerRegistrar";
import MarqueurPret from "@/components/ui/MarqueurPret";

// Refonte 2026 : détection "PWA installée" posée AVANT toute peinture, pour
// la classe `wb-pwa` (niveau CSS pur — couleurs, espacements, rayons ; pas de
// changement de structure JSX, voir usePwaStandalone.ts pour ce cas-là).
// Il n'existe pas d'équivalent "cookie lu côté serveur" pour
// `display-mode: standalone` (contrairement au thème clair/sombre juste en
// dessous) : `strategy="beforeInteractive"` injecte ce script dans le HTML
// initial et le fait tourner avant toute hydratation React, donc sans flash.
// Même test que `NotificationsToggle.tsx` / `lib/pwaStandalone.ts`, réécrit
// à la main ici car il tourne hors React.
const PWA_DETECT_SCRIPT = `(function(){try{
  var s = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (s) document.documentElement.classList.add('wb-pwa');
}catch(e){}})();`;

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
// Les couleurs de theme-color restent en v1 (#ffffff / #0f172a) partout SAUF dans la PWA
// installée d'un compte en bêta, où elles prennent le papier de la refonte pour que le beige
// (ou le gris foncé) monte jusqu'à la barre d'état du téléphone.
//
// Décidé ici, CÔTÉ SERVEUR, à partir du cookie `wb_pwa_beta` posé par DashboardShell : c'est
// le seul moyen fiable. iOS lit `theme-color` dans le HTML qu'on lui sert, au lancement ; une
// balise posée ensuite par JavaScript n'était prise en compte qu'au changement d'onglet suivant
// (constaté par Alexandre les 25 et 26 septembre 2026, bandeau ardoise au-dessus de l'écran).
// Le serveur, lui, ne peut pas détecter `display-mode: standalone` — d'où le cookie, qui prend
// effet au lancement suivant.
const COULEUR_BETA = { clair: "#F6F5F3", sombre: "#0E0E11" } as const;

export async function generateViewport(): Promise<Viewport> {
  const jar = await cookies();
  const sombre = jar.get("theme")?.value === "dark";
  const betaPwa = jar.get("wb_pwa_beta")?.value === "1";
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
    themeColor: betaPwa
      ? COULEUR_BETA[sombre ? "sombre" : "clair"]
      : [
          { media: "(prefers-color-scheme: light)", color: "#ffffff" },
          { media: "(prefers-color-scheme: dark)",  color: "#0f172a" },
        ],
  };
}

// Écrans de lancement de l'application installée sur iPhone (le noir qu'iOS montre tant que
// la première page n'est pas arrivée, long avec une mauvaise connexion). iOS n'en choisit
// un que si la taille de l'écran correspond EXACTEMENT : d'où une image par modèle, en clair
// et en sombre (fond beige / gris foncé de la refonte + le logo, mêmes positions que l'écran
// de lancement CSS de globals.css pour que le passage de l'un à l'autre ne se voie pas).
// Images générées une fois (public/splash) ; un nouveau modèle d'iPhone = une ligne ici.
const ECRANS_IPHONE: [number, number, number][] = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2],
];
const startupImage = ECRANS_IPHONE.flatMap(([w, h, r]) =>
  (["clair", "sombre"] as const).map(theme => ({
    url: `/splash/${w}x${h}-${r}x-${theme}.png`,
    media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait) and (prefers-color-scheme: ${theme === "clair" ? "light" : "dark"})`,
  })),
);

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
    startupImage,
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
        <Script id="wb-pwa-detect" strategy="beforeInteractive">
          {PWA_DETECT_SCRIPT}
        </Script>
        <a href="#main-content" className="skip-to-content">Aller au contenu</a>
        <ServiceWorkerRegistrar />
        <MarqueurPret />
          <RecoveryRedirect />
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}

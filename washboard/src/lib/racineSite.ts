// Socle commun aux deux mises en page racines : l'application (app/(app)/layout.tsx, rendue à
// chaque visite) et le site public (app/vitrine/[langue]/layout.tsx, pré-calculé par langue).
// Les deux doivent produire le même <head> : toute modification ici vaut pour les deux.
import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import { alt as ALT_IMAGE_SITE } from "@/app/opengraph-image";
import { imagePartage } from "./imagePartage";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Refonte 2026, passe 1 : Archivo variable, exposée en variable CSS. `axes: ["wdth"]` ajoute
// l'axe de largeur (contraste 100 %→118 % de la direction visuelle).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: "variable",
  axes: ["wdth"],
  display: "swap",
});

export const CLASSES_POLICES = `${geistSans.variable} ${geistMono.variable} ${archivo.variable}`;

// Refonte 2026 : détection "PWA installée" posée AVANT toute peinture, pour la classe `wb-pwa`
// (niveau CSS pur). `strategy="beforeInteractive"` injecte ce script dans le HTML initial et le
// fait tourner avant toute hydratation React, donc sans flash. Même test que
// `NotificationsToggle.tsx` / `lib/pwaStandalone.ts`, réécrit ici car il tourne hors React.
// Depuis le 2026-10-09 : aussi un téléphone dans son navigateur, mais seulement dans l'espace
// laveur (/dashboard). Même requête que `REQUETE_ECRAN_MOBILE` (lib/designMobile.ts).
export const PWA_DETECT_SCRIPT = `(function(){try{
  var s = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  var m = location.pathname.indexOf('/dashboard') === 0
    && window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-height: 500px)').matches;
  if (s || m) document.documentElement.classList.add('wb-pwa');
}catch(e){}})();`;

// Site public pré-calculé : le cookie `theme` ne peut pas être lu par le serveur. La classe
// `dark` est posée par ce script avant la première peinture, comme la lecture serveur le fait
// côté application.
export const THEME_SCRIPT = `(function(){try{
  if (/(?:^|;\\s*)theme=dark(?:;|$)/.test(document.cookie)) document.documentElement.classList.add('dark');
}catch(e){}})();`;

// Barre d'état : v1 (#ffffff / #0f172a) partout, sauf dans la PWA installée d'un compte en bêta
// (cookie `wb_pwa_beta`, lu côté application seulement).
export const COULEUR_BETA = { clair: "#F6F5F3", sombre: "#0E0E11" } as const;
export const THEME_COLOR_STANDARD = [
  { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
];
export const VIEWPORT_BASE = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
} as const;

// Écrans de lancement de l'application installée sur iPhone : une image par modèle, en clair et
// en sombre (public/splash). Un nouveau modèle d'iPhone = une ligne ici.
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
// Image générale du site (app/opengraph-image.tsx, adresse /opengraph-image). Les mises en page
// racines étant dans des sous-dossiers, Next ne la rattache plus seul : elle est déclarée ici. Une
// page qui déclare son propre openGraph la remplace (comme avant).
const IMAGE_SITE = imagePartage("/", ALT_IMAGE_SITE);

export const METADATA_SITE: Metadata = {
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
  // Sans ce bloc, iOS ouvre le raccourci dans Safari avec sa barre d'adresse au lieu du plein
  // écran, et n'autorise pas les notifications.
  appleWebApp: {
    capable: true,
    title: "WashBoard",
    statusBarStyle: "default",
    startupImage,
  },
  description: "Le logiciel tout-en-un des laveurs auto mobiles et du detailing : réservation en ligne, planning, facturation. Essai gratuit de 14 jours, sans carte bancaire.",
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
    description: "Le logiciel de gestion des laveurs auto mobiles et du detailing : réservation en ligne, planning, facturation et suivi client. 14 jours offerts, sans carte bancaire.",
    images: IMAGE_SITE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Logiciel de lavage, nettoyage auto & detailing à domicile | WashBoard",
    description: "Le logiciel de gestion des laveurs auto mobiles et du detailing : réservation en ligne, planning, facturation et suivi client. 14 jours offerts, sans carte bancaire.",
    images: IMAGE_SITE,
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

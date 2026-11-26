import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import "../globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import RecoveryRedirect from "@/components/auth/RecoveryRedirect";
import { ServiceWorkerRegistrar } from "@/components/ui/ServiceWorkerRegistrar";
import MarqueurPret from "@/components/ui/MarqueurPret";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { getLangue } from "@/lib/i18n/serveur";
import { dictionnaireDe } from "@/lib/i18n/dictionnaires";
import { creerTraducteur } from "@/lib/i18n/traduire";
import { CLASSES_POLICES, COULEUR_BETA, METADATA_SITE, PWA_DETECT_SCRIPT, THEME_COLOR_STANDARD, VIEWPORT_BASE } from "@/lib/racineSite";

// Mise en page racine de l'application (tableau de bord, réservation, connexion…), rendue à
// chaque visite. Le site public a la sienne, pré-calculée : app/vitrine/[langue]/layout.tsx.

// theme-color décidé ici, CÔTÉ SERVEUR, à partir du cookie `wb_pwa_beta` posé par
// DashboardShell : iOS lit `theme-color` dans le HTML servi au lancement ; une balise posée
// ensuite par JavaScript n'était prise en compte qu'au changement d'onglet suivant (constaté par
// Alexandre les 25 et 26 septembre 2026). Le cookie prend effet au lancement suivant.
export async function generateViewport(): Promise<Viewport> {
  const jar = await cookies();
  const sombre = jar.get("theme")?.value === "dark";
  const betaPwa = jar.get("wb_pwa_beta")?.value === "1";
  return {
    ...VIEWPORT_BASE,
    themeColor: betaPwa ? COULEUR_BETA[sombre ? "sombre" : "clair"] : THEME_COLOR_STANDARD,
  };
}

export const metadata: Metadata = METADATA_SITE;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Thème lu depuis le cookie côté serveur : la classe `dark` est posée
  // directement sur <html>. Pas de flash, et aucune balise <script> rendue
  // (donc plus d'avertissement React 19 / badge "Issue" en dev).
  const isDark = (await cookies()).get("theme")?.value === "dark";
  // Langue de l'interface : choix de la personne, sinon langue du navigateur, sinon pays (lib/i18n).
  const langue = await getLangue();
  const dictionnaire = dictionnaireDe(langue);
  const t = creerTraducteur(dictionnaire);

  return (
    <html
      lang={langue}
      className={`${CLASSES_POLICES} h-full antialiased${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <Script id="wb-pwa-detect" strategy="beforeInteractive">
          {PWA_DETECT_SCRIPT}
        </Script>
        <a href="#main-content" className="skip-to-content">{t("Aller au contenu")}</a>
        <ServiceWorkerRegistrar />
        <MarqueurPret />
          <RecoveryRedirect />
        <I18nProvider langue={langue} dictionnaire={dictionnaire}><ThemeProvider>{children}</ThemeProvider></I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}

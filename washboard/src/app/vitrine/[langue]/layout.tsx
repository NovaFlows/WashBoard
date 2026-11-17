import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import "../../globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import RecoveryRedirect from "@/components/auth/RecoveryRedirect";
import { ServiceWorkerRegistrar } from "@/components/ui/ServiceWorkerRegistrar";
import MarqueurPret from "@/components/ui/MarqueurPret";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { getLangue } from "@/lib/i18n/serveur";
import { LANGUES } from "@/lib/i18n/langues";
import { dictionnaireDe } from "@/lib/i18n/dictionnaires";
import { creerTraducteur } from "@/lib/i18n/traduire";
import { CLASSES_POLICES, METADATA_SITE, PWA_DETECT_SCRIPT, THEME_COLOR_STANDARD, THEME_SCRIPT, VIEWPORT_BASE } from "@/lib/racineSite";

// Mise en page racine du site public (landing, blog, pages métier, pages légales), pré-calculée
// une fois par langue au déploiement puis servie depuis le cache. Le visiteur n'y arrive jamais
// directement : src/proxy.ts choisit sa langue et réécrit `/blog` en `/vitrine/fr/blog`.
// Rien ici ne doit lire les cookies ni les en-têtes (la page redeviendrait calculée à chaque visite).

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGUES.map(langue => ({ langue }));
}

export const viewport: Viewport = { ...VIEWPORT_BASE, themeColor: THEME_COLOR_STANDARD };

export const metadata: Metadata = METADATA_SITE;

export default async function RacineVitrine({ children }: Readonly<{ children: React.ReactNode }>) {
  const langue = await getLangue();
  const dictionnaire = dictionnaireDe(langue);
  const t = creerTraducteur(dictionnaire);

  return (
    <html
      lang={langue}
      className={`${CLASSES_POLICES} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Vrai script bloquant : `next/script` beforeInteractive ne passe qu'après le premier
            affichage, d'où un flash blanc en mode sombre. `text/plain` côté navigateur : React
            ne le réexécute pas et n'avertit pas (guide « preventing flash before hydration »). */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
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

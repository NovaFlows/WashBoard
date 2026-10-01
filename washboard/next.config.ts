import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Hôte du stockage Supabase, dérivé de la même variable que le reste du
// code plutôt que recopié en dur : si le projet Supabase change un jour,
// cette ligne suit sans qu'on s'en souvienne.
function hoteSupabase(): string | undefined {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
  } catch {
    return undefined
  }
}

// En-têtes de sécurité.
//
// L'application n'en envoyait aucun : ni protection contre l'inclusion dans
// une iframe, ni contrôle du reniflage de type, ni politique de referrer. Le
// tableau de bord pouvait donc être affiché dans une iframe invisible posée
// par-dessus une page piège, et un laveur connecté cliquer « Annuler le
// rendez-vous » en croyant cliquer ailleurs. Relevé lors de la revue du
// 2026-09-05.
const ENTETES_COMMUNS = [
  // Un fichier téléversé par un laveur (logo, photo de fond) ne doit jamais
  // être réinterprété par le navigateur comme du HTML ou du JavaScript.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Ne pas divulguer l'URL complète — qui contient le lien public du laveur —
  // aux sites tiers vers lesquels on navigue.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Le produit ne demande ni caméra ni micro : le dire explicitement empêche
  // un script tiers compromis de les réclamer au nom du site.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
  // Un an de HTTPS obligatoire. Sans `preload` : l'inscription à la liste des
  // navigateurs est un engagement difficile à défaire, à décider séparément.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

// Le tableau de bord ne s'affiche dans aucune iframe, jamais.
//
// La page de réservation publique, elle, reste incluable : un laveur peut
// vouloir l'intégrer à son propre site, et le lui interdire casserait un usage
// légitime pour un gain nul — cette page ne contient aucune action sensible.
const ENTETES_DASHBOARD = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
]

const nextConfig: NextConfig = {
  devIndicators: false,
  // Numéro de version visible en bas de l'écran « Plus » de la PWA (voir
  // DiagnosticPwa.tsx) : permet de savoir en un coup d'œil si un téléphone
  // affiche le dernier déploiement. Vercel fournit l'empreinte du commit au
  // moment du build ; hors Vercel (développement), « local ».
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7),
  },
  serverExternalPackages: ['@react-pdf/renderer'],

  // Logos et fonds de page envoyés par les laveurs (bucket Supabase Storage)
  // et photos des thèmes prédéfinis (Unsplash) : optimisés et mis en cache
  // à l'edge Vercel au lieu d'être reservis en entier à chaque visiteur de
  // la page de réservation — déjà la cause d'un dépassement du quota de
  // bande passante Supabase (voir api/washer/logo/route.ts).
  //
  // `minimumCacheTTL` à un an : sûr parce que les URLs qui en ont besoin
  // sont versionnées (`?v=<profile_updated_at>`, voir lib/themes.ts) — un
  // nouvel envoi change l'URL demandée, jamais le contenu d'une URL déjà en
  // cache.
  images: {
    remotePatterns: [
      ...(hoteSupabase() ? [{ protocol: 'https' as const, hostname: hoteSupabase()!, pathname: '/storage/v1/object/public/**' }] : []),
      { protocol: 'https' as const, hostname: 'images.unsplash.com' },
    ],
    minimumCacheTTL: 31536000,
  },

  async headers() {
    return [
      { source: '/:path*', headers: ENTETES_COMMUNS },
      { source: '/dashboard/:path*', headers: ENTETES_DASHBOARD },
    ]
  },
};

// L'enveloppe Sentry patche la config Next (webpack/Turbopack) pour agréger
// les erreurs — voir sentry.server.config.ts pour pourquoi elle ne fait rien
// tant qu'aucun DSN n'est configuré. `org`/`project`/`authToken` restent
// facultatifs : sans eux, l'étape d'envoi des source maps est simplement
// sautée (message dans les journaux de build, jamais un échec du build) —
// tant que WashBoard n'a pas de compte Sentry avec accès à un jeton, les
// erreurs remontent avec du code minifié plutôt que le code source d'origine.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});

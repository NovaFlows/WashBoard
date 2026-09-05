import type { NextConfig } from "next";

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
  serverExternalPackages: ['@react-pdf/renderer'],

  async headers() {
    return [
      { source: '/:path*', headers: ENTETES_COMMUNS },
      { source: '/dashboard/:path*', headers: ENTETES_DASHBOARD },
    ]
  },
};

export default nextConfig;

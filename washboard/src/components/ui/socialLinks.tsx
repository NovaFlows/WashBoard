import type { ReactNode } from 'react'

// Réseaux sociaux de WashBoard : liste unique, réutilisée par le pied de page
// public (LandingPage) et le menu du tableau de bord (Sidebar) — un logo se
// dessine une fois, pas à chaque endroit où il apparaît.
//
// Comptes confirmés (2026-09-15) : Instagram et TikTok. Le tableau est conçu
// pour encaisser un 3e/4e réseau plus tard sans changement de layout (flex +
// gap, pas de largeur figée).
// Attention : les deux identifiants ne sont volontairement PAS identiques
// (Instagram "washboard.fr" vs TikTok "wash_board.fr" avec underscore) — ne
// pas "corriger" l'un pour matcher l'autre, ce sont les vrais comptes.
// L'URL TikTok est sans paramètre `?lang=fr` : ce paramètre force la langue
// et n'est pas l'URL canonique du profil.
// lucide-react (v1.21) n'a pas d'icônes de marques (Instagram/TikTok/etc.).
// Instagram : SVG inline en contour (trait fin, currentColor) — son logo
// réel EST un contour (carré arrondi + cercle + point), donc ce style est
// fidèle, pas juste "cohérent avec le reste du footer".
// TikTok : un contour ne suffit pas à le rendre reconnaissable (à cette
// taille ça se lit comme une note de musique générique, cf. retour design).
// Le logo réel est une silhouette PLEINE avec un crochet caractéristique en
// haut à droite — on le rend donc en aplat (fill="currentColor", sans
// stroke), avec le tracé standard de Simple Icons (MIT, licence libre,
// https://github.com/simple-icons/simple-icons/blob/develop/icons/tiktok.svg)
// plutôt qu'une approximation dessinée à la main.
export const SOCIAL_LINKS: { name: string; href: string; icon: ReactNode }[] = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/washboard.fr/',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@wash_board.fr',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
]

export type BgThemeId = 'theme1' | 'theme2' | 'theme3' | 'photo1' | 'photo2' | 'photo3'

export type BgThemePreset = {
  id: BgThemeId
  name: string
  subtitle: string
  gradient: string          // toujours défini — utilisé comme fallback et preview
  photo?: string            // URL Unsplash — appliquée sur la page avec overlay
}

// Overlay commun pour les photos — assure la lisibilité du texte
export const OVERLAY = 'rgba(0,0,0,0.52)'

export const BG_THEME_PRESETS: BgThemePreset[] = [
  // — Dégradés —
  {
    id: 'theme1',
    name: 'Nuit Prestige',
    subtitle: 'Dégradé · Bleu nuit',
    gradient: 'linear-gradient(145deg, #010915 0%, #071428 35%, #0d1f42 60%, #030c1c 100%)',
  },
  {
    id: 'theme2',
    name: 'Onyx',
    subtitle: 'Dégradé · Noir absolu',
    gradient: 'linear-gradient(145deg, #040404 0%, #0e0e0e 45%, #181818 70%, #040404 100%)',
  },
  {
    id: 'theme3',
    name: 'Acier',
    subtitle: 'Dégradé · Anthracite',
    gradient: 'linear-gradient(145deg, #0b0e13 0%, #16202e 40%, #1e2d40 65%, #0b0e13 100%)',
  },
  // — Photos —
  {
    id: 'photo1',
    name: 'Détailing Noir',
    subtitle: 'Photo · Voiture noire',
    gradient: 'linear-gradient(145deg, #080a0c 0%, #111418 50%, #080a0c 100%)',
    photo: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=1920&q=85&fit=crop',
  },
  {
    id: 'photo2',
    name: 'Prestige Garage',
    subtitle: 'Photo · Intérieur garage',
    gradient: 'linear-gradient(145deg, #0a0c10 0%, #161b22 50%, #0a0c10 100%)',
    photo: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1920&q=85&fit=crop',
  },
  {
    id: 'photo3',
    name: 'Lavage Luxe',
    subtitle: 'Photo · Jet de nettoyage',
    gradient: 'linear-gradient(145deg, #060b12 0%, #0e1a28 50%, #060b12 100%)',
    photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=85&fit=crop',
  },
]

/** Fait passer une image de fond par l'optimiseur d'images de Next (redimension,
 *  compression, cache à l'edge Vercel) au lieu de l'URL d'origine, resservie
 *  en entier à chaque visiteur de la page de réservation sinon — c'est déjà
 *  ce qui a fait dépasser le quota de bande passante Supabase une fois (voir
 *  api/washer/logo/route.ts, « un logo de 4 Mo a fait dépasser de 60 % »).
 *
 *  Une image CSS (`background-image`) ne peut pas passer par le composant
 *  `<Image>` : on construit donc nous-mêmes l'URL de son point d'entrée
 *  (`/_next/image`), ce que fait `<Image>` en coulisses de toute façon.
 *
 *  `version` doit changer exactement quand le fichier change. Le chemin de
 *  stockage d'un fond envoyé par un laveur est réutilisé d'un envoi à l'autre
 *  (`upsert`, voir api/washer/background/route.ts) : un cache long SANS
 *  version resservirait l'ancien fond après un nouvel envoi. Sans version
 *  fournie, l'URL d'origine est renvoyée telle quelle plutôt que mise en
 *  cache à l'aveugle — mieux vaut repasser par Supabase à chaque fois que
 *  risquer de montrer un fond périmé. */
/** Ajoute `?v=<version>` à une URL, pour distinguer deux envois successifs
 *  d'un même fichier (chemin de stockage réutilisé, voir plus haut) sans
 *  renommer quoi que ce soit en base. `version` absente → URL inchangée. */
export function urlVersionnee(url: string, version?: string | null): string {
  if (!version) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`
}

function imageOptimisee(url: string, version?: string | null): string {
  if (!version) return url
  return `/_next/image?url=${encodeURIComponent(urlVersionnee(url, version))}&w=1920&q=75`
}

/** Renvoie le style CSS à appliquer sur le fond de la page booking.
 *
 *  `version` (facultatif) : date de dernière modification du PROFIL
 *  (`profile_updated_at`), pour mettre en cache longtemps une image envoyée
 *  par le laveur sans jamais montrer une version périmée après un nouvel
 *  envoi — voir `imageOptimisee`. Les photos des thèmes prédéfinis n'en ont
 *  pas besoin : leur URL ne change jamais. */
export function getBgStyle(theme: string | null | undefined, version?: string | null): React.CSSProperties | null {
  if (!theme) return null
  const preset = BG_THEME_PRESETS.find(t => t.id === theme)
  if (preset) {
    if (preset.photo) {
      return {
        backgroundImage: `linear-gradient(${OVERLAY},${OVERLAY}), url(${imageOptimisee(preset.photo, 'fixe')})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }
    }
    return { background: preset.gradient }
  }
  // Image uploadée par le laveur
  if (theme.startsWith('http')) {
    return {
      backgroundImage: `linear-gradient(${OVERLAY},${OVERLAY}), url(${imageOptimisee(theme, version)})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
    }
  }
  return null
}

export function isCustomTheme(theme: string | null | undefined): boolean {
  return !!theme && !BG_THEME_PRESETS.some(t => t.id === theme)
}

/** Les couleurs de marque proposées au laveur, dans l'ordre d'affichage.
 *  Partagée par l'ancien écran (`IdentiteForm`) et l'écran « Apparence de ma
 *  page » de la PWA : une seule liste, pour qu'elles ne divergent jamais.
 *  Les 24 premières sont historiques (commit 59ac1d7) et déjà enregistrées
 *  en base chez de vrais laveurs — on peut en AJOUTER, jamais en retirer ni
 *  en modifier une sans migrer les comptes concernés. */
export const PALETTE = [
  '#1e3a8a', '#1d4ed8', '#2563eb', '#0ea5e9',
  '#0891b2', '#0284c7', '#0369a1',
  '#15803d', '#16a34a', '#059669', '#0d9488',
  '#6d28d9', '#7c3aed', '#9333ea',
  '#dc2626', '#e11d48', '#db2777', '#c026d3',
  '#c2410c', '#ea580c', '#d97706', '#f59e0b',
  '#0f172a', '#1e293b', '#374151',
]

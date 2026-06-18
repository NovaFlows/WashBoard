export type BgThemeId = 'theme1' | 'theme2' | 'theme3' | 'photo1' | 'photo2' | 'photo3'

export type BgThemePreset = {
  id: BgThemeId
  name: string
  subtitle: string
  gradient: string          // toujours défini — utilisé comme fallback et preview
  photo?: string            // URL Unsplash — appliquée sur la page avec overlay
}

// Overlay commun pour les photos — assure la lisibilité du texte
const OVERLAY = 'rgba(0,0,0,0.52)'

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

/** Renvoie le style CSS à appliquer sur le fond de la page booking */
export function getBgStyle(theme: string | null | undefined): React.CSSProperties | null {
  if (!theme) return null
  const preset = BG_THEME_PRESETS.find(t => t.id === theme)
  if (preset) {
    if (preset.photo) {
      return {
        backgroundImage: `linear-gradient(${OVERLAY},${OVERLAY}), url(${preset.photo})`,
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
      backgroundImage: `linear-gradient(${OVERLAY},${OVERLAY}), url(${theme})`,
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

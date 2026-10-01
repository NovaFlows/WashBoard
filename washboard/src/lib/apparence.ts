// Logique de l'écran « Apparence de ma page » de la PWA (`ApparenceV2`) : ce que
// le laveur règle est ce que ses clients voient en ouvrant son lien de réservation
// (`(public)/book/[slug]`). Fonctions pures, sans navigateur — l'écran, ses feuilles
// et son hook ne contiennent que de la présentation et de l'état.

import { BG_THEME_PRESETS, PALETTE, isCustomTheme } from '@/lib/themes'
import { isPublicHttpUrl } from '@/lib/googleReviews'

/** Couleur des boutons de la page publique quand le laveur n'en a pas choisi
 *  (`accent={washer.brand_color ?? '#2563eb'}` dans `book/[slug]/page.tsx`). */
export const COULEUR_PAR_DEFAUT = '#2563eb'

/** Texte de l'en-tête de la page publique quand il n'y a pas de message. */
export const MESSAGE_PAR_DEFAUT = 'Réservation en ligne'

// ── Couleur ────────────────────────────────────────────────────────────────

/** Seuil WCAG AA pour du texte courant. */
export const SEUIL_CONTRASTE = 4.5

function canaux(couleur: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(couleur.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

const lineaire = (c: number) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** Rapport de contraste WCAG du BLANC sur cette couleur (de 1 à 21), ou `null` si
 *  la valeur n'est pas un `#rgb` / `#rrggbb` lisible. Le serveur ne valide pas
 *  `brand_color` : une valeur étrangère ne doit ni casser l'écran ni déclencher un
 *  avertissement. Le blanc est celui du texte des boutons de la page publique. */
export function contrasteBlanc(couleur: string): number | null {
  const rgb = canaux(couleur)
  if (!rgb) return null
  const [r, g, b] = rgb.map(lineaire)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return 1.05 / (luminance + 0.05)
}

/** Le texte blanc se lit-il mal sur cette couleur ? Jamais un interdit : la page
 *  s'en sert pour avertir, pas pour refuser un choix. */
export function contrasteInsuffisant(couleur: string): boolean {
  const c = contrasteBlanc(couleur)
  return c !== null && c < SEUIL_CONTRASTE
}

/** La couleur enregistrée est-elle absente du nuancier ? (Elle est alors montrée
 *  comme un choix de plus, sélectionné, plutôt que de disparaître.) */
export function estHorsNuancier(couleur: string | null | undefined): boolean {
  if (!couleur) return false
  const c = couleur.trim().toLowerCase()
  return !PALETTE.some(p => p === c)
}

// ── Fond ───────────────────────────────────────────────────────────────────

export const LIBELLE_FOND_ORIGINAL = 'Original (clair / sombre)'
export const LIBELLE_FOND_PHOTO = 'Ma photo'

/** Nom d'un fond, tel qu'il se lit dans la liste et sous sa vignette. */
export function libelleFond(theme: string | null | undefined): string {
  if (!theme) return LIBELLE_FOND_ORIGINAL
  const preset = BG_THEME_PRESETS.find(t => t.id === theme)
  if (preset) return preset.name
  // Un identifiant inconnu qui ne commence pas par « http » n'est pas un fond :
  // `getBgStyle` ne l'applique pas, la page publique reste en « Original ».
  return estPhotoPerso(theme) ? LIBELLE_FOND_PHOTO : LIBELLE_FOND_ORIGINAL
}

/** Le fond est-il une photo du laveur (et non un préréglage) ? */
export function estPhotoPerso(theme: string | null | undefined): theme is string {
  return !!theme && isCustomTheme(theme) && theme.startsWith('http')
}

/** Version réduite d'une photo de préréglage pour une vignette : les URL
 *  Unsplash portent déjà `w=1920&q=85`, on les remplace au lieu de les doubler. */
export function miniaturePhoto(url: string, largeur = 480, qualite = 60): string {
  try {
    const u = new URL(url)
    u.searchParams.set('w', String(largeur))
    u.searchParams.set('q', String(qualite))
    return u.toString()
  } catch {
    return url
  }
}

// ── Message d'accueil ──────────────────────────────────────────────────────

/** Longueur au-delà de laquelle le message s'étale sur plusieurs lignes dans l'en-
 *  tête de la page publique. Indicatif : ni le serveur ni l'écran ne refusent rien. */
export const MESSAGE_LONGUEUR_CONSEILLEE = 120

export function messageTropLong(texte: string): boolean {
  return texte.trim().length > MESSAGE_LONGUEUR_CONSEILLEE
}

/** Ce que le serveur enregistrera : `PATCH /api/washer` fait `trim() || null`. */
export function messageNormalise(texte: string): string | null {
  return texte.trim() || null
}

// ── Site web ───────────────────────────────────────────────────────────────

export type ResultatSite = { ok: true; valeur: string | null } | { ok: false; message: string }

const LONGUEUR_MAX_SITE = 2048

export const ERREUR_SITE_SCHEMA = 'Seules les adresses en http:// ou https:// sont acceptées.'
export const ERREUR_SITE_INVALIDE = 'Cette adresse n’est pas valide. Exemple : https://monsite.fr'
export const ERREUR_SITE_PRIVE = 'Cette adresse n’est pas celle d’un site public. Indiquez l’adresse de votre site tel que vos clients le voient.'
export const ERREUR_SITE_LONGUE = 'Cette adresse est trop longue.'
export const ERREUR_SITE_IDENTIFIANTS = 'Retirez l’identifiant et le mot de passe de l’adresse : indiquez seulement l’adresse de votre site.'

// Un schéma explicite : `xxx://…`, ou `xxx:` suivi d'autre chose qu'un numéro de
// port (`monsite.fr:8080` est un hôte, `javascript:alert(1)` n'en est pas un).
const SCHEMA = /^[a-z][a-z0-9+.-]*:(?:\/\/|(?!\d))/i

/** Valide et normalise l'adresse du site saisie par le laveur.
 *
 *  L'ancien formulaire est en `noValidate` : « monsite.fr » (sans https://) y est
 *  accepté, puis ignoré sans un mot par `isPublicHttpUrl` quand la page publique
 *  cherche les avis. Ici on corrige à la saisie : `https://` est ajouté quand
 *  aucun schéma n'est tapé, tout autre schéma que http(s) est refusé, et une
 *  adresse que le serveur ignorerait de toute façon (réseau privé) est refusée avec
 *  une phrase. Vide = `null` (le laveur retire son site). */
export function normaliserSiteWeb(saisie: string): ResultatSite {
  const t = saisie.trim()
  if (!t) return { ok: true, valeur: null }
  if (t.length > LONGUEUR_MAX_SITE) return { ok: false, message: ERREUR_SITE_LONGUE }

  let candidate: string
  if (t.startsWith('//')) candidate = `https:${t}`
  else if (SCHEMA.test(t)) candidate = t
  else candidate = `https://${t}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    // Un schéma inconnu ou mal formé passe par ici aussi : on ne devine pas.
    return { ok: false, message: SCHEMA.test(t) && !/^https?:/i.test(t) ? ERREUR_SITE_SCHEMA : ERREUR_SITE_INVALIDE }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, message: ERREUR_SITE_SCHEMA }
  // « bonjour » se lit comme un hôte valide pour `URL` : il faut au moins un point.
  if (!url.hostname.includes('.')) return { ok: false, message: ERREUR_SITE_INVALIDE }
  // Des identifiants dans l'adresse (`https://nom:mdp@site.fr`) finiraient en clair en base
  // et dans le code de la page publique.
  if (url.username || url.password) return { ok: false, message: ERREUR_SITE_IDENTIFIANTS }
  if (!isPublicHttpUrl(candidate)) return { ok: false, message: ERREUR_SITE_PRIVE }
  // On enregistre l'adresse telle que le navigateur la comprend (`url.href`) et non la
  // saisie brute : `HTTPS:\site.fr`, un espace ou des caractères parasites ressortent
  // propres ou encodés. Pour un site sans chemin, on garde la forme courte (sans « / »).
  const nue = url.pathname === '/' && !url.search && !url.hash
  return { ok: true, valeur: nue ? url.href.replace(/\/$/, '') : url.href }
}

// ── Fichiers d'image acceptés ──────────────────────────────────────────────

/** Types d'image qu'on accepte d'envoyer. Contrôle de confort côté écran : c'est le
 *  serveur qui fait autorité. Il écarte surtout le SVG (qui peut contenir un script) et
 *  ce que `compressImage` laisserait passer tel quel. */
export const TYPES_IMAGE_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp'] as const

export function estImageAcceptee(type: string): boolean {
  return (TYPES_IMAGE_ACCEPTES as readonly string[]).includes(type.toLowerCase())
}

// ── Logo : progression de l'envoi ──────────────────────────────────────────

export type PhaseImage = 'repos' | 'detourage' | 'envoi' | 'fait' | 'echec'

/** Délai après lequel on prévient que le détourage est long : le modèle est
 *  téléchargé la première fois. */
export const DELAI_ATTENTE_LONGUE_MS = 6000

/** La phrase qui accompagne l'envoi du logo. `null` au repos, une fois fini et en échec (l'échec
 *  porte sa propre phrase). */
export function phraseProgression(phase: PhaseImage, attenteLongue: boolean): string | null {
  switch (phase) {
    case 'detourage':
      return attenteLongue
        ? 'On retire le fond… Ça peut prendre du temps la première fois, gardez l’écran ouvert.'
        : 'On retire le fond…'
    case 'envoi':
      return 'Mise en ligne…'
    default:
      return null
  }
}

// Le consentement aux cookies publicitaires, sur la page de réservation d'un
// laveur.
//
// Toute la logique est ici, sans navigateur ni écran, pour être vérifiable
// ligne à ligne. Les deux seules fonctions qui touchent au stockage sont
// isolées en bas de fichier.
//
// ── Ce que ce fichier gouverne, et ce qu'il ne gouverne pas ─────────────────
//
// IL GOUVERNE le Pixel Meta : un script tiers, qui dépose des cookies chez
// Facebook et sert à du ciblage publicitaire. Rien de tout cela ne doit partir
// avant un clic explicite.
//
// IL NE GOUVERNE PAS la mesure interne de WashBoard (voir attribution.ts et
// funnelTracking.ts) : première partie, pas de partage, pas de profilage, pas
// d'identifiant de personne — elle relève de la mesure d'audience et continue
// de fonctionner que le visiteur accepte, refuse, ou ne réponde jamais. Sans
// cette séparation, un refus aurait rendu le laveur aveugle sur ses propres
// réservations, ce qui n'a rien à voir avec ce qu'on lui demande d'accepter.

export type Choix = 'accepte' | 'refuse'

/** Un choix, et la date à laquelle il a été fait. */
export type Consentement = { choix: Choix; le: number }

const CLE_STOCKAGE = 'wb_consentement'

/** Au bout de combien de temps on repose la question.
 *
 *  Six mois : la CNIL demande de ne pas considérer un choix comme éternel, et
 *  de laisser passer un délai raisonnable avant de redemander à qui a refusé.
 *  Le même délai s'applique aux deux réponses — redemander plus vite à ceux
 *  qui ont refusé qu'à ceux qui ont accepté serait exactement le genre de
 *  dissymétrie que le texte interdit. */
export const VALIDITE_MOIS = 6
const VALIDITE_MS = VALIDITE_MOIS * 30 * 24 * 60 * 60 * 1000

/** Les choix retenus, par laveur.
 *
 *  Par laveur, et pas pour tout le site : le Pixel de Kooki Clean et celui
 *  d'un autre laveur sont deux destinataires différents. Accepter chez l'un
 *  n'autorise pas l'autre — et tous les laveurs partagent le domaine
 *  washboard.fr, donc un stockage global les confondrait. */
export type Registre = Record<string, Consentement>

function estChoix(v: unknown): v is Choix {
  return v === 'accepte' || v === 'refuse'
}

/** Relit le registre, en jetant ce qui est illisible ou périmé.
 *
 *  Tolérant à tout : la valeur vient du navigateur du visiteur, où n'importe
 *  qui peut écrire n'importe quoi. Le pire qui puisse arriver est de reposer
 *  la question — jamais de charger un script sans accord. */
export function relireRegistre(brut: string | null | undefined, maintenant: number): Registre {
  if (!brut) return {}
  try {
    const lu = JSON.parse(brut) as unknown
    if (!lu || typeof lu !== 'object' || Array.isArray(lu)) return {}
    const propre: Registre = {}
    for (const [slug, v] of Object.entries(lu as Record<string, unknown>)) {
      const c = v as Partial<Consentement>
      if (!estChoix(c?.choix)) continue
      if (typeof c.le !== 'number' || !Number.isFinite(c.le)) continue
      // Un horodatage dans le futur signale une horloge déréglée ou une valeur
      // fabriquée : on repose la question plutôt que de faire confiance.
      if (c.le > maintenant + 60_000) continue
      if (maintenant - c.le > VALIDITE_MS) continue
      propre[slug] = { choix: c.choix, le: c.le }
    }
    return propre
  } catch {
    return {}
  }
}

/** Le choix en cours pour ce laveur, ou `null` si la question reste posée. */
export function choixPour(registre: Registre, slug: string): Choix | null {
  return registre[slug]?.choix ?? null
}

/** Faut-il afficher le bandeau ?
 *
 *  Trois conditions, et les trois comptent :
 *    - le laveur a un Pixel (sinon il n'y a rien à consentir) ;
 *    - le visiteur n'a pas encore répondu pour CE laveur ;
 *    - ou sa réponse a dépassé sa durée de validité.
 *
 *  Un bandeau affiché sans Pixel serait une nuisance pure : il coûterait des
 *  réservations au laveur pour protéger de quelque chose qui n'existe pas. */
export function doitDemander(pixelId: string | null | undefined, registre: Registre, slug: string): boolean {
  if (!pixelId) return false
  return choixPour(registre, slug) === null
}

/** Le Pixel peut-il être chargé ?
 *
 *  La réponse par défaut est NON. Il faut un Pixel déclaré ET un « accepte »
 *  explicite. Ni l'absence de réponse, ni une valeur abîmée, ni un refus ne
 *  laissent passer — c'est la seule fonction du fichier dont une erreur
 *  entraînerait un dépôt de cookie illégal, alors elle ne dit oui qu'une fois. */
export function peutChargerPixel(pixelId: string | null | undefined, registre: Registre, slug: string): boolean {
  if (!pixelId) return false
  return choixPour(registre, slug) === 'accepte'
}

/** Un identifiant de Pixel Meta est fait de 15 ou 16 chiffres.
 *
 *  Vérifié à la saisie pour que le laveur sache tout de suite qu'il s'est
 *  trompé, et en base par une contrainte : un identifiant invalide ne casse
 *  rien de visible, il fait juste échouer la mesure en silence — la pire des
 *  pannes, celle qu'on ne découvre qu'en cherchant pourquoi les chiffres sont
 *  vides. */
export function pixelIdValide(v: string | null | undefined): boolean {
  return typeof v === 'string' && /^[0-9]{15,16}$/.test(v.trim())
}

/** Nettoie ce que le laveur a collé : il copie souvent depuis le gestionnaire
 *  de publicités, avec des espaces ou des points de séparation. */
export function nettoyerPixelId(brut: string | null | undefined): string | null {
  if (!brut) return null
  const chiffres = brut.replace(/[^0-9]/g, '')
  return chiffres || null
}

/** Pixel simulé en local, pour voir le bandeau sans toucher à la base.
 *
 *  `NEXT_PUBLIC_DEV_PIXEL_ID=123456789012345` fait comme si le laveur avait
 *  déclaré ce Pixel : le bandeau apparaît, le consentement se comporte
 *  exactement comme en vrai, et rien n'est écrit nulle part.
 *
 *  INERTE EN PRODUCTION, et c'est la seule chose qui compte ici : sans cette
 *  garde, une variable oubliée dans l'environnement Vercel ferait apparaître
 *  un bandeau — et charger un script tiers — sur la page de tous les laveurs.
 *  Même motif que `NEXT_PUBLIC_DEV_OFFRE` (voir plan.ts). */
export function pixelIdDev(): string | null {
  if (process.env.NODE_ENV === 'production') return null
  const v = process.env.NEXT_PUBLIC_DEV_PIXEL_ID
  return pixelIdValide(v) ? String(v).trim() : null
}

// ── Accès au stockage ───────────────────────────────────────────────────────
//
// `localStorage` et non un cookie : le choix du visiteur n'a aucune raison de
// voyager vers le serveur à chaque requête, et un cookie de consentement reste
// un cookie de plus.

export function lireRegistre(maintenant: number = Date.now()): Registre {
  if (typeof window === 'undefined') return {}
  try {
    return relireRegistre(window.localStorage.getItem(CLE_STOCKAGE), maintenant)
  } catch {
    // Stockage refusé : on ne peut rien retenir, donc on ne charge rien. La
    // question sera reposée à chaque visite — c'est désagréable, mais c'est le
    // seul comportement qui ne dépose jamais rien sans accord.
    return {}
  }
}

export function enregistrerChoix(slug: string, choix: Choix, maintenant: number = Date.now()): Registre {
  const registre = { ...lireRegistre(maintenant), [slug]: { choix, le: maintenant } }
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(registre)) } catch { /* sans effet */ }
  }
  return registre
}

/** Rouvre la question pour ce laveur — le « Gérer mes cookies » du pied de
 *  page. Efface le choix au lieu de le basculer : c'est au visiteur de
 *  redécider, pas à nous de deviner ce qu'il veut maintenant. */
export function oublierChoix(slug: string, maintenant: number = Date.now()): Registre {
  const registre = lireRegistre(maintenant)
  delete registre[slug]
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(registre)) } catch { /* sans effet */ }
  }
  return registre
}

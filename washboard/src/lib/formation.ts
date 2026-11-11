// Onglet « Formation » (coquille, branche feat/formation, 2026-11-10).
//
// Un partenaire (le premier : Kookii Clean) fait des formations pour les laveurs auto ; WashBoard
// les met à disposition des laveurs inscrits et se paie 50 % de chaque vente. Ce fichier est la
// SOURCE de la forme des données — types, calculs purs, catalogue d'exemple. Rien ici ne lit une
// base : le catalogue ci-dessous est un EXEMPLE qui permet de voir l'écran avant que les tables
// existent (voir docs/FORMATION.md pour le schéma proposé). Aucun titre ici n'est le contenu
// réel du partenaire.

export type TypeLecon = 'video' | 'lecture' | 'quiz'

export type Lecon = {
  id: string
  titre: string
  type: TypeLecon
  /** Durée en secondes (vidéo) ou temps de lecture estimé. */
  dureeSec: number
  /** Visible sans avoir acheté le pack : sert d'aperçu commercial. */
  apercuGratuit?: boolean
  /** Une vidéo a été envoyée pour cette leçon (le chemin du fichier ne quitte jamais le serveur). */
  aVideo?: boolean
}

export type ModuleFormation = {
  id: string
  titre: string
  lecons: Lecon[]
}

export type NiveauFormation = 'debutant' | 'intermediaire' | 'avance'

export type PackFormation = {
  slug: string
  titre: string
  accroche: string
  description: string
  niveau: NiveauFormation
  /** Prix TTC en centimes. 0 = inclus dans l'abonnement. */
  prixCents: number
  /** `bientot` : visible dans le catalogue, pas encore achetable. */
  statut: 'disponible' | 'bientot'
  modules: ModuleFormation[]
  /** Ce que le laveur saura faire à la fin (3 puces maximum à l'écran). */
  objectifs: string[]
  /** Identifiant en base ; absent pour le catalogue d'exemple. */
  id?: string
  /** Pas encore publié : visible des seuls administrateurs. */
  brouillon?: boolean
}

export type SessionLive = {
  id: string
  titre: string
  animateur: string
  /** Début, ISO 8601 avec fuseau. */
  debutIso: string
  dureeMin: number
  places: number
  inscrits: number
  /** Pack auquel l'appel est rattaché ; absent = ouvert à tous les laveurs inscrits. */
  packSlug?: string
}

export const NIVEAUX: Record<NiveauFormation, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
}

// ───────────────────────── calculs purs ─────────────────────────

/** « 12 min », « 1 h 05 », « 45 s » : jamais « 0:12:00 ». */
export function dureeTexte(secondes: number): string {
  const s = Math.max(0, Math.round(secondes))
  if (s < 60) return `${s} s`
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const reste = min % 60
  return reste === 0 ? `${h} h` : `${h} h ${String(reste).padStart(2, '0')}`
}

export const leconsDuPack = (pack: PackFormation): Lecon[] => pack.modules.flatMap(m => m.lecons)

export const dureePack = (pack: PackFormation): number =>
  leconsDuPack(pack).reduce((total, l) => total + l.dureeSec, 0)

/** « 49 € », « 49,90 € », « Inclus » : les centimes ne s'affichent que s'il y en a. */
export function prixTexte(cents: number): string {
  if (cents <= 0) return 'Inclus'
  const euros = cents / 100
  return `${Number.isInteger(euros) ? euros : euros.toFixed(2).replace('.', ',')} €`
}

/** Part d'une leçon terminée : `termines` = ids des leçons faites. Renvoie 0..100, entier. */
export function progressionPack(pack: PackFormation, termines: ReadonlySet<string>): number {
  const lecons = leconsDuPack(pack)
  if (lecons.length === 0) return 0
  const faites = lecons.filter(l => termines.has(l.id)).length
  return Math.round((faites / lecons.length) * 100)
}

/** La première leçon pas encore faite, dans l'ordre du pack : ce que « Reprendre » ouvre. */
export function prochaineLecon(pack: PackFormation, termines: ReadonlySet<string>): Lecon | null {
  return leconsDuPack(pack).find(l => !termines.has(l.id)) ?? null
}

/**
 * Partage d'une vente entre le partenaire et WashBoard (50/50 convenu). En centimes entiers : le
 * centime impair va à WashBoard, de sorte que partenaire + WashBoard = prix, toujours. Un
 * partage qui perdrait un centime par vente deviendrait un litige au bout de mille ventes.
 */
export function partageVente(prixCents: number, partPartenairePourcent = 50): { partenaire: number; washboard: number } {
  const prix = Math.max(0, Math.round(prixCents))
  const pct = Math.min(100, Math.max(0, partPartenairePourcent))
  const partenaire = Math.floor((prix * pct) / 100)
  return { partenaire, washboard: prix - partenaire }
}

export type EtatSession = 'passee' | 'en_cours' | 'bientot' | 'a_venir' | 'complet'

/** Où en est un appel : `bientot` = dans moins de 15 min (le bouton « Rejoindre » s'ouvre). */
export function etatSession(s: SessionLive, maintenant: Date): EtatSession {
  const debut = new Date(s.debutIso).getTime()
  const fin = debut + s.dureeMin * 60_000
  const t = maintenant.getTime()
  if (t >= fin) return 'passee'
  if (t >= debut) return 'en_cours'
  if (debut - t <= 15 * 60_000) return 'bientot'
  return s.inscrits >= s.places ? 'complet' : 'a_venir'
}

/** Les appels à venir ou en cours, du plus proche au plus lointain. */
export function sessionsAVenir(sessions: SessionLive[], maintenant: Date): SessionLive[] {
  return sessions
    .filter(s => etatSession(s, maintenant) !== 'passee')
    .sort((a, b) => new Date(a.debutIso).getTime() - new Date(b.debutIso).getTime())
}

export const packParSlug = (packs: PackFormation[], slug: string): PackFormation | undefined =>
  packs.find(p => p.slug === slug)

/** Retrouve une leçon et le module qui la porte, par son id. */
export function trouverLecon(pack: PackFormation, leconId: string): { lecon: Lecon; module: ModuleFormation; index: number } | null {
  let index = 0
  for (const mod of pack.modules) {
    for (const lecon of mod.lecons) {
      if (lecon.id === leconId) return { lecon, module: mod, index }
      index++
    }
  }
  return null
}

/** Cherche une leçon dans tout le catalogue (la route de lecture ne connaît que son id). */
export function leconDuCatalogue(packs: PackFormation[], leconId: string): { pack: PackFormation; lecon: Lecon } | null {
  for (const pack of packs) {
    const trouve = trouverLecon(pack, leconId)
    if (trouve) return { pack, lecon: trouve.lecon }
  }
  return null
}

// ───────────────────────── catalogue d'exemple ─────────────────────────
// À REMPLACER par la lecture des tables `formations` / `formation_modules` / `formation_lecons`.

export const CATALOGUE_DEMO: PackFormation[] = [
  {
    slug: 'lavage-domicile-les-bases',
    titre: 'Le lavage à domicile : les bases',
    accroche: 'Du premier seau au résultat propre, sans abîmer la peinture.',
    description: 'Le matériel qui compte vraiment, l’ordre des gestes, les erreurs qui rayent une carrosserie et la façon de travailler vite sans bâcler.',
    niveau: 'debutant',
    prixCents: 4900,
    statut: 'disponible',
    objectifs: ['Choisir un matériel de départ sans se ruiner', 'Laver sans rayer, du toit aux jantes', 'Tenir un temps de prestation rentable'],
    modules: [
      {
        id: 'm1', titre: 'Bien démarrer',
        lecons: [
          { id: 'l-1-1', titre: 'Présentation de la formation', type: 'video', dureeSec: 180, apercuGratuit: true },
          { id: 'l-1-2', titre: 'Le matériel de départ', type: 'video', dureeSec: 780 },
          { id: 'l-1-3', titre: 'Les produits : quoi, pourquoi, combien', type: 'lecture', dureeSec: 420 },
        ],
      },
      {
        id: 'm2', titre: 'Le lavage, geste par geste',
        lecons: [
          { id: 'l-2-1', titre: 'Le prélavage', type: 'video', dureeSec: 600 },
          { id: 'l-2-2', titre: 'Le lavage à deux seaux', type: 'video', dureeSec: 900 },
          { id: 'l-2-3', titre: 'Les jantes et les passages de roue', type: 'video', dureeSec: 720 },
          { id: 'l-2-4', titre: 'Le séchage sans micro-rayures', type: 'video', dureeSec: 540 },
          { id: 'l-2-5', titre: 'Quiz : les erreurs qui coûtent cher', type: 'quiz', dureeSec: 300 },
        ],
      },
    ],
  },
  {
    slug: 'interieur-detailing',
    titre: 'L’intérieur : le détailing complet',
    accroche: 'Sièges, plastiques, tissus : l’intérieur qui fait revenir le client.',
    description: 'Aspiration, shampouinage, soin du cuir, traitement des odeurs. Les protocoles par type de matière et le temps à prévoir pour chacun.',
    niveau: 'intermediaire',
    prixCents: 7900,
    statut: 'disponible',
    objectifs: ['Traiter tissu, cuir et plastiques sans les abîmer', 'Éliminer les odeurs durablement', 'Chiffrer une prestation intérieure'],
    modules: [
      {
        id: 'm1', titre: 'Les matières',
        lecons: [
          { id: 'l-3-1', titre: 'Reconnaître ce qu’on nettoie', type: 'video', dureeSec: 540, apercuGratuit: true },
          { id: 'l-3-2', titre: 'Le tissu et l’alcantara', type: 'video', dureeSec: 960 },
          { id: 'l-3-3', titre: 'Le cuir : nettoyer puis nourrir', type: 'video', dureeSec: 840 },
        ],
      },
      {
        id: 'm2', titre: 'Les cas difficiles',
        lecons: [
          { id: 'l-4-1', titre: 'Taches tenaces', type: 'video', dureeSec: 780 },
          { id: 'l-4-2', titre: 'Odeurs : tabac, animaux, humidité', type: 'video', dureeSec: 660 },
        ],
      },
    ],
  },
  {
    slug: 'lancer-son-activite',
    titre: 'Lancer son activité de laveur',
    accroche: 'Statut, prix, premiers clients : ce qu’on aurait aimé savoir avant.',
    description: 'Choisir son statut, fixer ses prix, trouver ses premiers clients et ne pas faire de gratuit. Complète WashBoard : on y montre aussi comment s’en servir au quotidien.',
    niveau: 'debutant',
    prixCents: 0,
    statut: 'bientot',
    objectifs: ['Choisir un statut adapté', 'Fixer des prix qui rapportent', 'Obtenir ses dix premiers clients'],
    modules: [
      {
        id: 'm1', titre: 'Poser les bases',
        lecons: [
          { id: 'l-5-1', titre: 'Statut et obligations', type: 'video', dureeSec: 900 },
          { id: 'l-5-2', titre: 'Combien facturer', type: 'video', dureeSec: 840 },
        ],
      },
    ],
  },
]

export const SESSIONS_DEMO: SessionLive[] = [
  { id: 's-1', titre: 'Questions / réponses : vos premiers lavages', animateur: 'Le formateur', debutIso: '2026-11-19T19:00:00+01:00', dureeMin: 60, places: 30, inscrits: 12, packSlug: 'lavage-domicile-les-bases' },
  { id: 's-2', titre: 'Atelier en direct : le shampouinage d’un siège', animateur: 'Le formateur', debutIso: '2026-11-26T19:00:00+01:00', dureeMin: 90, places: 20, inscrits: 20, packSlug: 'interieur-detailing' },
  { id: 's-3', titre: 'Les prix en 2026 : on en parle entre laveurs', animateur: 'L’équipe WashBoard', debutIso: '2026-12-03T18:30:00+01:00', dureeMin: 45, places: 50, inscrits: 8 },
]

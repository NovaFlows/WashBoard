// Avancement de la configuration d'un compte laveur.
//
// Deux familles, volontairement inégales :
//
// — l'ESSENTIEL (80 % du total) : ce sans quoi la page de réservation
//   fonctionne mal ou pas du tout ;
// — le CONFORT (20 % à eux tous) : des réglages qui améliorent le service
//   sans être nécessaires.
//
// Cette pondération est le cœur du calcul. Compter tous les éléments à égalité
// ferait plafonner à 45 % un laveur parfaitement opérationnel, et lui donnerait
// l'impression d'être à la traîne alors qu'il encaisse des réservations.
// À l'inverse, un compte sans prestations doit rester visiblement bas.
//
// Les frais de déplacement sont exclus des deux familles : un laveur qui ne
// facture pas le déplacement n'a rien à configurer, et ne doit pas être
// pénalisé pour ça.
//
// Calibré sur un cas réel : un inscrit avait téléversé son logo, renseigné son
// adresse et saisi 28 créneaux, puis s'était arrêté avant de créer ses
// prestations. Sa page publique ne proposait rien, et rien ne le lui disait.

export const ESSENTIAL_WEIGHT = 80
export const OPTIONAL_WEIGHT = 20

export type SetupInput = {
  servicesCount: number
  availabilitiesCount: number
  baseAddress: string | null
  phone: string | null
  logoUrl: string | null
  // Confort
  googleCalendarConnected: boolean
  reviewsEnabled: boolean
  followupEnabled: boolean
  zoneEnabled: boolean
  smartSlotEnabled: boolean
  welcomeMessage: string | null
}

export type SetupItem = {
  key: string
  label: string
  done: boolean
  /** Sans cet élément, la page de réservation ne peut pas aboutir. */
  blocking: boolean
  /** Fait partie de l'essentiel (par opposition au confort). */
  essential: boolean
  /** Où aller pour le renseigner. */
  href: string
}

export type SetupProgress = {
  percent: number
  items: SetupItem[]
  /** Ce qui manque, l'essentiel et les points bloquants d'abord. */
  missing: SetupItem[]
  complete: boolean
  /** Tout l'essentiel est en place : la page encaisse des réservations. */
  essentialsDone: boolean
}

function rempli(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

export function computeSetupProgress(input: SetupInput): SetupProgress {
  const essentiels: SetupItem[] = [
    {
      key: 'services',
      label: 'Vos prestations et leurs tarifs',
      done: input.servicesCount > 0,
      blocking: true, essential: true,
      href: '/dashboard/admin',
    },
    {
      key: 'availabilities',
      label: 'Vos horaires de disponibilité',
      done: input.availabilitiesCount > 0,
      blocking: true, essential: true,
      href: '/dashboard/calendrier',
    },
    {
      key: 'baseAddress',
      // Sert au calcul des trajets et de la zone : sans elle, un client hors
      // secteur peut réserver un créneau que le laveur ne pourra pas honorer.
      label: 'Votre adresse de départ',
      done: rempli(input.baseAddress),
      blocking: true, essential: true,
      href: '/dashboard/parametres',
    },
    {
      key: 'phone',
      label: 'Votre téléphone',
      done: rempli(input.phone),
      blocking: false, essential: true,
      href: '/dashboard/parametres',
    },
    {
      key: 'logo',
      label: 'Votre logo',
      done: rempli(input.logoUrl),
      blocking: false, essential: true,
      href: '/dashboard/admin',
    },
  ]

  const confort: SetupItem[] = [
    {
      key: 'zone',
      label: 'Votre zone d’intervention',
      done: input.zoneEnabled,
      blocking: false, essential: false,
      href: '/dashboard/parametres',
    },
    {
      key: 'reviews',
      label: 'La demande d’avis Google',
      done: input.reviewsEnabled,
      blocking: false, essential: false,
      href: '/dashboard/parametres',
    },
    {
      key: 'followup',
      label: 'Les relances de vos clients',
      done: input.followupEnabled,
      blocking: false, essential: false,
      href: '/dashboard/parametres',
    },
    {
      key: 'calendar',
      label: 'La synchronisation Google Agenda',
      done: input.googleCalendarConnected,
      blocking: false, essential: false,
      href: '/dashboard/parametres',
    },
    {
      key: 'smartSlot',
      label: 'Les créneaux intelligents',
      done: input.smartSlotEnabled,
      blocking: false, essential: false,
      href: '/dashboard/parametres',
    },
    {
      key: 'welcome',
      label: 'Votre message d’accueil',
      done: rempli(input.welcomeMessage),
      blocking: false, essential: false,
      href: '/dashboard/admin',
    },
  ]

  const part = (liste: SetupItem[], poids: number) =>
    liste.length === 0 ? 0 : (liste.filter(i => i.done).length / liste.length) * poids

  const percent = Math.round(part(essentiels, ESSENTIAL_WEIGHT) + part(confort, OPTIONAL_WEIGHT))

  const items = [...essentiels, ...confort]

  // Ordre de la liste : bloquants, puis reste de l'essentiel, puis confort.
  // On ne demande pas un message d'accueil à quelqu'un dont la page ne peut
  // pas encore encaisser une réservation.
  const rang = (i: SetupItem) => (i.blocking ? 0 : i.essential ? 1 : 2)
  const missing = items.filter(i => !i.done).sort((a, b) => rang(a) - rang(b))

  return {
    percent,
    items,
    missing,
    complete: missing.length === 0,
    essentialsDone: essentiels.every(i => i.done),
  }
}

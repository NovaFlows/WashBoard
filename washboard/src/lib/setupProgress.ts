// Avancement de la configuration d'un compte laveur.
//
// Ne comptent QUE les éléments sans lesquels la page de réservation fonctionne
// mal ou pas du tout. Les réglages de confort — frais de déplacement, créneaux
// intelligents, relances, couleur de marque — en sont volontairement exclus :
// un laveur qui ne facture pas le déplacement ne doit pas lire « 70 % » et se
// croire en retard sur quelque chose.
//
// La liste est calibrée sur un cas réel : un inscrit avait téléversé son logo,
// renseigné son adresse et saisi 28 créneaux, puis s'était arrêté avant de
// créer ses prestations. Sa page publique ne proposait donc rien, et rien ne
// le lui disait.

export type SetupInput = {
  servicesCount: number
  availabilitiesCount: number
  baseAddress: string | null
  phone: string | null
  logoUrl: string | null
}

export type SetupItem = {
  key: string
  label: string
  done: boolean
  /** Sans cet élément, la page de réservation ne peut pas aboutir. */
  blocking: boolean
  /** Où aller pour le renseigner. */
  href: string
}

export type SetupProgress = {
  percent: number
  items: SetupItem[]
  /** Ce qui manque, les points bloquants d'abord. */
  missing: SetupItem[]
  complete: boolean
}

function rempli(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

export function computeSetupProgress(input: SetupInput): SetupProgress {
  const items: SetupItem[] = [
    {
      key: 'services',
      label: 'Vos prestations et leurs tarifs',
      done: input.servicesCount > 0,
      blocking: true,
      href: '/dashboard/admin',
    },
    {
      key: 'availabilities',
      label: 'Vos horaires de disponibilité',
      done: input.availabilitiesCount > 0,
      blocking: true,
      href: '/dashboard/calendrier',
    },
    {
      key: 'baseAddress',
      // Sert au calcul des trajets et de la zone : sans elle, un client hors
      // secteur peut réserver un créneau que le laveur ne pourra pas honorer.
      label: 'Votre adresse de départ',
      done: rempli(input.baseAddress),
      blocking: true,
      href: '/dashboard/parametres',
    },
    {
      key: 'phone',
      label: 'Votre téléphone',
      done: rempli(input.phone),
      blocking: false,
      href: '/dashboard/parametres',
    },
    {
      key: 'logo',
      label: 'Votre logo',
      done: rempli(input.logoUrl),
      blocking: false,
      href: '/dashboard/admin',
    },
  ]

  const faits = items.filter(i => i.done).length
  const percent = Math.round((faits / items.length) * 100)

  // Les points bloquants remontent en tête : c'est par eux qu'il faut
  // commencer, pas par le logo.
  const missing = items
    .filter(i => !i.done)
    .sort((a, b) => Number(b.blocking) - Number(a.blocking))

  return { percent, items, missing, complete: faits === items.length }
}

// Fichier clients d'un laveur : une ligne par client, tirée de ses réservations,
// et la recherche qui permet de le retrouver.
//
// Un client est identifié par son email, comme dans la fiche client
// (`clientProfile.ts`) : c'est le seul champ obligatoire et stable. Aucune
// requête ici, du calcul pur, donc testable.

import { buildClientProfile, type ClientBooking } from './clientProfile'

export type RendezVousCourt = { service: string; date: string }

export type ResumeClient = {
  email: string
  name: string
  phone: string
  isProfessional: boolean
  companyName: string | null
  addresses: string[]
  /** Dernière prestation réellement faite : terminée, ou confirmée et déjà
   *  passée. Un rendez-vous à venir n'est pas une prestation faite. */
  derniere: RendezVousCourt | null
  /** Prochain rendez-vous à venir, en attente ou confirmé. */
  prochain: RendezVousCourt | null
  honoredCount: number
  totalRevenue: number
  /** Date du rendez-vous le plus récent, à venir compris : sert au tri. */
  activite: string
}

const cle = (email: string) => email.trim().toLowerCase()
const court = (b: ClientBooking): RendezVousCourt => ({ service: b.services?.name ?? 'Prestation', date: b.scheduled_at })

/** Un client par email, le plus récemment actif en premier. */
export function listeClients(bookings: ClientBooking[], now: Date = new Date()): ResumeClient[] {
  const parClient = new Map<string, ClientBooking[]>()
  for (const b of bookings) {
    if (!b.client_email?.trim()) continue
    const k = cle(b.client_email)
    const liste = parClient.get(k)
    if (liste) liste.push(b)
    else parClient.set(k, [b])
  }

  const clients: ResumeClient[] = []
  for (const [email, siens] of parClient) {
    // Chaque groupe ne contient que ce client : la fiche se calcule sans
    // reparcourir toutes les réservations.
    const p = buildClientProfile(siens, email, now)
    if (!p) continue
    const t = now.getTime()
    const faites = p.bookings.filter(b =>
      b.status === 'done' || (b.status === 'confirmed' && new Date(b.scheduled_at).getTime() <= t))
    const aVenir = p.bookings
      .filter(b => (b.status === 'pending' || b.status === 'confirmed') && new Date(b.scheduled_at).getTime() > t)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

    clients.push({
      email: p.email,
      name: p.name,
      phone: p.phone,
      isProfessional: p.isProfessional,
      companyName: p.companyName,
      addresses: p.addresses,
      derniere: faites[0] ? court(faites[0]) : null,
      prochain: aVenir[0] ? court(aVenir[0]) : null,
      honoredCount: p.honoredCount,
      totalRevenue: p.totalRevenue,
      activite: p.bookings[0].scheduled_at,
    })
  }

  return clients.sort((a, b) => new Date(b.activite).getTime() - new Date(a.activite).getTime())
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Chiffres d'un numéro, sous la forme 0XXXXXXXXX quand il est écrit en +33. */
function chiffresTelephone(s: string): string {
  const d = s.replace(/\D/g, '')
  return d.startsWith('33') && d.length > 9 ? '0' + d.slice(2) : d
}

/** Retrouve un client par son nom, son entreprise, son email, son adresse ou
 *  son téléphone. Sans accents ni majuscules ; plusieurs mots doivent tous
 *  correspondre (« julie paris »). Un numéro se cherche quelle que soit son
 *  écriture : « 06 12 », « 0612 » ou « +33 6 12 ». */
export function rechercherClients(clients: ResumeClient[], texte: string): ResumeClient[] {
  const brut = texte.trim()
  if (!brut) return clients

  // Une recherche faite seulement de chiffres est un numéro de téléphone.
  const saisieChiffres = brut.replace(/[\s.\-()+]/g, '')
  if (/^\d{2,}$/.test(saisieChiffres)) {
    const cherche = saisieChiffres.startsWith('33') && saisieChiffres.length > 2
      ? ['0' + saisieChiffres.slice(2), saisieChiffres]
      : [saisieChiffres]
    return clients.filter(c => {
      const tel = chiffresTelephone(c.phone)
      return cherche.some(q => tel.includes(q))
    })
  }

  const mots = sansAccents(brut).split(/\s+/).filter(Boolean)
  return clients.filter(c => {
    const botte = sansAccents([c.name, c.companyName ?? '', c.email, c.phone, ...c.addresses].join(' '))
    return mots.every(m => botte.includes(m))
  })
}

// Export RGPD (droit d'accès, article 15) — « Exporter ses données » du menu « … » de la fiche
// (2026-09-28, revu par l'agent `legal`). Un texte simple, lisible directement par le client
// final sans outil particulier — pas un JSON brut. Calcul pur : `ClientProfileModalV2.tsx`
// construit juste le fichier à partir de ce texte, aucune requête ici.

import type { ClientProfile } from './clientProfile'

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Le contenu du fichier, prêt à être écrit tel quel — voir `nomFichierExportClient` pour son
 *  nom. Couvre tout ce que `ClientProfile` agrège : réservations, devis/factures, notes,
 *  véhicules. Ne couvre PAS d'éventuelles autres tables portant les coordonnées de ce client
 *  (voir la revue de l'agent `legal`, 2026-09-28) — hors du périmètre de cette fiche. */
export function texteExportClient(profil: ClientProfile, nomLaveur: string): string {
  const titre = profil.isProfessional && profil.companyName ? profil.companyName : profil.name
  const lignes: string[] = []

  lignes.push(`Données conservées par ${nomLaveur} sur ${titre}`, `Export du ${dateFr(new Date().toISOString())}`, '')
  lignes.push('IDENTITÉ', `Nom : ${profil.name}`)
  if (profil.email) lignes.push(`Email : ${profil.email}`)
  if (profil.phone) lignes.push(`Téléphone : ${profil.phone}`)
  if (profil.isProfessional && profil.companyName) lignes.push(`Entreprise : ${profil.companyName}`)
  if (profil.addresses.length > 0) lignes.push(`Adresse(s) : ${profil.addresses.join(' ; ')}`)
  if (profil.vehicules) lignes.push(`Véhicule(s) (note du laveur) : ${profil.vehicules}`)
  if (profil.vehiculesReserves.length > 0) lignes.push(`Véhicule(s) donné(s) en réservant : ${profil.vehiculesReserves.join(', ')}`)
  if (profil.notes) lignes.push(`Note interne du laveur : ${profil.notes}`)
  lignes.push('')

  lignes.push('RÉSERVATIONS', profil.bookings.length === 0 ? 'Aucune.' : '')
  for (const b of profil.bookings) {
    const prix = b.booked_price ?? b.services?.price ?? 0
    lignes.push(`- ${dateFr(b.scheduled_at)} · ${b.services?.name ?? 'Prestation'} · ${prix} € · ${b.address} · statut : ${b.status}`)
  }
  lignes.push('')

  lignes.push('DEVIS ET FACTURES', profil.documents.length === 0 ? 'Aucun.' : '')
  for (const d of profil.documents) {
    const genre = d.genre === 'devis' ? 'Devis' : 'Facture'
    const statutPaiement = d.genre === 'facture' ? (d.paye_le ? ' (encaissée)' : ' (non encaissée)') : ''
    lignes.push(`- ${genre} ${d.numero ?? ''} du ${dateFr(d.emis_le ?? d.created_at)} · ${d.contenu.totaux.ttc} €${statutPaiement}`)
  }
  lignes.push('')

  lignes.push('CE QUE CES DONNÉES SERVENT', 'Organiser vos rendez-vous, vos devis et vos factures avec ce laveur.')
  lignes.push('Ce document répond à une demande de droit d’accès (article 15 du RGPD).')

  return lignes.join('\n')
}

export const nomFichierExportClient = (profil: ClientProfile) => {
  const titre = profil.isProfessional && profil.companyName ? profil.companyName : profil.name
  const slug = titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return `donnees-${slug || 'client'}.txt`
}

import { notFound } from 'next/navigation'
import { exigerEquipe, chargerFicheLaveur } from '@/lib/ficheLaveurDonnees'
import { analyserLaveur } from '@/lib/ficheLaveur'
import CoqueEquipe from '@/components/dashboard/equipe/CoqueEquipe'
import FicheLaveurVue from '@/components/dashboard/equipe/FicheLaveurVue'

export const dynamic = 'force-dynamic'

// Fiche d'un laveur, réservée à l'équipe. La notification « Nouvel inscrit »
// ouvre directement cette page (lib/confirmationSuite.ts).
export default async function FicheLaveurPage({ params }: { params: Promise<{ id: string }> }) {
  const { washer } = await exigerEquipe()
  const { id } = await params
  // Identifiant mal formé : Postgres refuserait la requête par une erreur,
  // qui s'afficherait comme une panne plutôt que comme une fiche introuvable.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const donnees = await chargerFicheLaveur(id)
  if (!donnees) notFound()
  const now = new Date()
  return (
    <CoqueEquipe washer={washer}>
      <FicheLaveurVue donnees={donnees} topo={analyserLaveur(donnees, now)} now={now} />
    </CoqueEquipe>
  )
}

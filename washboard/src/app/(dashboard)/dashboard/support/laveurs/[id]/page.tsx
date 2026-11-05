import { notFound } from 'next/navigation'
import { exigerEquipe, chargerFicheLaveur, chargerAppels } from '@/lib/ficheLaveurDonnees'
import { analyserLaveur } from '@/lib/ficheLaveur'
import { uuidValide } from '@/lib/uuid'
import CoqueEquipe from '@/components/dashboard/equipe/CoqueEquipe'
import FicheLaveurV2 from '@/components/dashboard/equipe/FicheLaveurV2'

export const dynamic = 'force-dynamic'

// Fiche d'un laveur, réservée à l'équipe. La notification « nouvel inscrit »
// ouvre directement cette page (lib/confirmationSuite.ts).
export default async function FicheLaveurPage({ params }: { params: Promise<{ id: string }> }) {
  const { washer } = await exigerEquipe()
  const { id } = await params
  // Identifiant mal formé : Postgres répondrait par une erreur, affichée comme
  // une panne plutôt que comme une fiche introuvable.
  if (!uuidValide(id)) notFound()
  const [donnees, suivi] = await Promise.all([chargerFicheLaveur(id), chargerAppels([id])])
  if (!donnees) notFound()
  const now = new Date()
  return (
    <CoqueEquipe washer={washer}>
      <FicheLaveurV2
        donnees={donnees}
        topo={analyserLaveur(donnees, now)}
        appels={suivi.appels}
        suiviActif={suivi.actif}
        maintenant={now.getTime()}
      />
    </CoqueEquipe>
  )
}

import { exigerEquipe, chargerArbreParrainages } from '@/lib/ficheLaveurDonnees'
import CoqueEquipe from '@/components/dashboard/equipe/CoqueEquipe'
import ArbreParrainagesV2 from '@/components/dashboard/equipe/ArbreParrainagesV2'

export const dynamic = 'force-dynamic'

// Arbre des parrainages de l'espace équipe : qui a parrainé qui, et les signaux à vérifier.
export default async function ParrainagesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { washer } = await exigerEquipe()
  const { q } = await searchParams
  const arbre = await chargerArbreParrainages()
  return (
    <CoqueEquipe washer={washer}>
      {arbre
        ? <ArbreParrainagesV2 arbre={arbre} rechercheInitiale={typeof q === 'string' ? q.slice(0, 80) : ''} />
        : <p className="p-6 text-[14px]">Impossible de charger les parrainages. Réessayez dans un instant.</p>}
    </CoqueEquipe>
  )
}

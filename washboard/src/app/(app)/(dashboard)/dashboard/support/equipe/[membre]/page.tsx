import { notFound } from 'next/navigation'
import { exigerEquipe, chargerTousLesLaveurs, chargerAppels, chargerResponsables } from '@/lib/ficheLaveurDonnees'
import { resumerLaveurs } from '@/lib/resumeLaveurs'
import { chargerProspects } from '@/lib/prospectsDonnees'
import { membreDepuisSlug } from '@/lib/espaceEquipe'
import CoqueEquipe from '@/components/dashboard/equipe/CoqueEquipe'
import MembreEquipeV2 from '@/components/dashboard/equipe/MembreEquipeV2'

export const dynamic = 'force-dynamic'

// Page d'un membre de l'équipe : ses laveurs et ses prospects. `exigerEquipe` renvoie
// tout autre compte vers l'accueil ; un prénom inconnu donne un 404.
export default async function MembrePage({ params }: { params: Promise<{ membre: string }> }) {
  const { washer } = await exigerEquipe()
  const membre = membreDepuisSlug((await params).membre)
  if (!membre) notFound()
  const now = new Date()
  const [tous, { appels }, responsables, prospects] = await Promise.all([chargerTousLesLaveurs(), chargerAppels(), chargerResponsables(), chargerProspects()])
  const laveurs = resumerLaveurs(tous, appels, { now, exclure: washer?.id, responsables: responsables.parLaveur })
  return (
    <CoqueEquipe washer={washer}>
      <MembreEquipeV2 membre={membre} laveurs={laveurs} prospects={prospects.prospects} prospectsActifs={prospects.actif} maintenant={now.getTime()} />
    </CoqueEquipe>
  )
}

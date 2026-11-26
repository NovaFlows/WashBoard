import { exigerEquipe } from '@/lib/ficheLaveurDonnees'
import { chargerProspects } from '@/lib/prospectsDonnees'
import { ONGLETS, type Onglet } from '@/lib/prospects'
import CoqueEquipe from '@/components/dashboard/equipe/CoqueEquipe'
import ProspectsV2 from '@/components/dashboard/equipe/ProspectsV2'

export const dynamic = 'force-dynamic'

// Zone Prospects de l'espace équipe : laveurs démarchés qui n'ont pas de compte.
export default async function ProspectsPage({ searchParams }: { searchParams: Promise<{ filtre?: string; p?: string }> }) {
  const { washer } = await exigerEquipe()
  const [{ filtre, p }, { prospects, actif }] = await Promise.all([searchParams, chargerProspects()])
  const now = new Date()
  const onglet = ONGLETS.includes(filtre as Onglet) ? (filtre as Onglet) : undefined
  return (
    <CoqueEquipe washer={washer}>
      <ProspectsV2 prospects={prospects} actif={actif} maintenant={now.getTime()} ongletInitial={onglet} ouvertInitial={p && prospects.some(x => x.id === p) ? p : undefined} />
    </CoqueEquipe>
  )
}

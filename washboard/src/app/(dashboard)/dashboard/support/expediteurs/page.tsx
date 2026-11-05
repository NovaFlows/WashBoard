import { exigerEquipe } from '@/lib/ficheLaveurDonnees'
import CoqueEquipe from '@/components/dashboard/equipe/CoqueEquipe'
import ExpediteursV2 from '@/components/dashboard/equipe/ExpediteursV2'

export const dynamic = 'force-dynamic'

export default async function ExpediteursPage() {
  const { washer } = await exigerEquipe()
  return <CoqueEquipe washer={washer}><ExpediteursV2 /></CoqueEquipe>
}

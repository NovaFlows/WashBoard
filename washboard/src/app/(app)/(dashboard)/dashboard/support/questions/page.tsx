import { exigerEquipe } from '@/lib/ficheLaveurDonnees'
import CoqueEquipe from '@/components/dashboard/equipe/CoqueEquipe'
import QuestionsEquipeV2 from '@/components/dashboard/equipe/QuestionsEquipeV2'

export const dynamic = 'force-dynamic'

// Questions des laveurs. La liste est chargée par SupportInbox lui-même, via
// /api/support/team-questions : 503 plutôt qu'une liste vide en cas d'échec.
export default async function QuestionsPage() {
  const { washer } = await exigerEquipe()
  return <CoqueEquipe washer={washer}><QuestionsEquipeV2 /></CoqueEquipe>
}

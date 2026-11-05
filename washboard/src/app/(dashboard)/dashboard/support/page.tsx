import { exigerEquipe, chargerResumeEquipe } from '@/lib/ficheLaveurDonnees'
import CoqueEquipe from '@/components/dashboard/equipe/CoqueEquipe'
import AccueilEquipeV2 from '@/components/dashboard/equipe/AccueilEquipeV2'

export const dynamic = 'force-dynamic'

// Accueil de l'espace équipe (« Équipe » dans Plus).
//
// Réservé à SUPPORT_ADMIN_USER_IDS : `exigerEquipe` renvoie tout autre compte
// vers l'accueil, sans dire que la page existe. La coque ne suppose pas de
// fiche laveur (voir CoqueEquipe) : un compte d'équipe dédié n'en aurait pas.
//
// Refonte du 2026-11-05 : l'ancienne page empilait le formulaire d'accès, les
// expéditeurs et la boîte de questions à l'ancien design. Chaque sujet a
// désormais son écran ; l'accès au compte d'un laveur se demande depuis sa fiche.
export default async function SupportPage() {
  const { user, washer } = await exigerEquipe()
  const resume = await chargerResumeEquipe()
  return (
    <CoqueEquipe washer={washer}>
      <AccueilEquipeV2 resume={resume} email={user.email ?? null} />
    </CoqueEquipe>
  )
}

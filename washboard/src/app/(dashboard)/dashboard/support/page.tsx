import { exigerEquipe, chargerResumeEquipe, chargerTousLesLaveurs, chargerAppels, chargerResponsables } from '@/lib/ficheLaveurDonnees'
import { resumerLaveurs } from '@/lib/resumeLaveurs'
import { chargerProspects } from '@/lib/prospectsDonnees'
import { prospectsARappeler, resumerProspects } from '@/lib/prospects'
import { resumerEquipe } from '@/lib/espaceEquipe'
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
// Sur ordinateur, l'accueil est un tableau de bord : d'où la lecture de tous les
// laveurs (la largeur d'écran n'est connue que dans le navigateur).
export default async function SupportPage() {
  const { user, washer } = await exigerEquipe()
  const now = new Date()
  const [resume, tous, { appels }, responsables, prospects] = await Promise.all([chargerResumeEquipe(now), chargerTousLesLaveurs(), chargerAppels(), chargerResponsables(), chargerProspects()])
  const laveurs = resumerLaveurs(tous, appels, { now, exclure: washer?.id, responsables: responsables.parLaveur })
  return (
    <CoqueEquipe washer={washer}>
      <AccueilEquipeV2 resume={resume} email={user.email ?? null} laveurs={laveurs} equipe={resumerEquipe(laveurs, prospects.prospects, now)} maintenant={now.getTime()} prospects={prospects.actif ? resumerProspects(prospects.prospects, now) : null} rappelsProspects={prospects.actif ? prospectsARappeler(prospects.prospects) : []} />
    </CoqueEquipe>
  )
}

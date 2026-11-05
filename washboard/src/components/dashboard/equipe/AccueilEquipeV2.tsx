'use client'

import { CarteListe, Ligne, NonLus } from '@/components/dashboard/ParametresFormV2'
import { corps } from '@/components/dashboard/FeuilleV2'
import { useSupportBadges } from '@/components/dashboard/SupportBadgesContext'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import type { LaveurResume } from '@/lib/resumeLaveurs'
import EcranEquipe, { Section } from './EcranEquipe'
import TableauEquipe from './TableauEquipe'

// Accueil de l'espace équipe : trois portes, chacune avec ce qui l'attend.
// Avant (2026-11-05), tout s'empilait sur une seule page à l'ancien design :
// formulaire d'accès, expéditeurs, boîte de questions. Sur ordinateur, un tableau
// de bord à la place (TableauEquipe).

type Resume = { nouveaux: number | null; total: number | null; expediteursEnAttente: number | null; aRelancer: number | null }

const nombre = (n: number | null, un: string, plusieurs: string) => n == null ? undefined : n === 0 ? undefined : `${n} ${n > 1 ? plusieurs : un}`

export default function AccueilEquipeV2({ resume, email, laveurs, maintenant }: { resume: Resume; email: string | null; laveurs: LaveurResume[]; maintenant: number }) {
  const { unreadTeamCount } = useSupportBadges()
  const grandEcran = useGrandEcran()
  if (grandEcran) {
    return <TableauEquipe laveurs={laveurs} resume={{ expediteursEnAttente: resume.expediteursEnAttente, suiviActif: resume.aRelancer !== null }} email={email} maintenant={maintenant} />
  }
  return (
    <EcranEquipe titre="Équipe" sousTitre="Outil interne, invisible des laveurs" retour={{ href: '/dashboard/parametres', label: 'Plus' }}>
      <Section titre="Laveurs">
        <CarteListe>
          <Ligne label="Tous les laveurs" valeur={resume.total != null ? String(resume.total) : undefined} href="/dashboard/support/laveurs" />
          <Ligne label="À rappeler" valeur={nombre(resume.aRelancer, 'relance due', 'relances dues') ?? (resume.aRelancer === null ? 'Suivi à activer' : 'Personne')} href="/dashboard/support/laveurs?filtre=rappeler" />
          <Ligne label="Nouveaux inscrits" valeur={nombre(resume.nouveaux, 'cette semaine', 'cette semaine') ?? 'Aucun cette semaine'} href="/dashboard/support/laveurs?filtre=nouveaux" />
        </CarteListe>
      </Section>

      <Section titre="À traiter">
        <CarteListe>
          <Ligne label="Questions des laveurs" href="/dashboard/support/questions" signal={<NonLus count={unreadTeamCount} />} />
          <Ligne label="Expéditeurs SMS" valeur={nombre(resume.expediteursEnAttente, 'en attente', 'en attente')} href="/dashboard/support/expediteurs" />
        </CarteListe>
      </Section>

      {email && <p className={`px-0.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Connecté en tant que {email}. L’accès au compte d’un laveur se demande depuis sa fiche.</p>}
    </EcranEquipe>
  )
}

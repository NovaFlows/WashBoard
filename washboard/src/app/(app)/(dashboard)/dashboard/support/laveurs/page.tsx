import { exigerEquipe, chargerTousLesLaveurs, chargerAppels, chargerResponsables } from '@/lib/ficheLaveurDonnees'
import { resumerLaveurs } from '@/lib/resumeLaveurs'
import CoqueEquipe from '@/components/dashboard/equipe/CoqueEquipe'
import ListeLaveursV2, { type Filtre } from '@/components/dashboard/equipe/ListeLaveursV2'

export const dynamic = 'force-dynamic'

const FILTRES: Filtre[] = ['tous', 'rappeler', 'nouveaux', 'configurer', 'essai']

// Liste des laveurs de l'espace équipe. Calculée ici, envoyée allégée au
// navigateur : seul ce que la liste affiche quitte le serveur.
export default async function LaveursPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { washer } = await exigerEquipe()
  const { filtre } = await searchParams
  const now = new Date()
  const [tous, { appels }, responsables] = await Promise.all([chargerTousLesLaveurs(), chargerAppels(), chargerResponsables()])

  const laveurs = resumerLaveurs(tous, appels, { now, exclure: washer?.id, responsables: responsables.parLaveur })

  return (
    <CoqueEquipe washer={washer}>
      <ListeLaveursV2
        laveurs={laveurs}
        filtreInitial={FILTRES.includes(filtre as Filtre) ? (filtre as Filtre) : 'tous'}
        maintenant={now.getTime()}
        affiliationActive={responsables.actif}
      />
    </CoqueEquipe>
  )
}

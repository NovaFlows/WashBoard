import { exigerEquipe, chargerTousLesLaveurs, chargerAppels } from '@/lib/ficheLaveurDonnees'
import { analyserLaveur } from '@/lib/ficheLaveur'
import { relanceDue, type Appel } from '@/lib/suiviAppels'
import { COMPTES_INTERNES_EXCLUS_DIFFUSION } from '@/lib/plan'
import CoqueEquipe from '@/components/dashboard/equipe/CoqueEquipe'
import ListeLaveursV2, { type Filtre, type LaveurResume } from '@/components/dashboard/equipe/ListeLaveursV2'

export const dynamic = 'force-dynamic'

const FILTRES: Filtre[] = ['tous', 'rappeler', 'nouveaux', 'configurer', 'essai']

// Liste des laveurs de l'espace équipe. Calculée ici, envoyée allégée au
// navigateur : seul ce que la liste affiche quitte le serveur.
export default async function LaveursPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { washer } = await exigerEquipe()
  const { filtre } = await searchParams
  const now = new Date()
  const [tous, { appels }] = await Promise.all([chargerTousLesLaveurs(), chargerAppels()])

  const parLaveur = new Map<string, Appel[]>()
  for (const a of appels) parLaveur.set(a.washer_id, [...(parLaveur.get(a.washer_id) ?? []), a])

  const laveurs: LaveurResume[] = tous
    .filter(d => !COMPTES_INTERNES_EXCLUS_DIFFUSION.includes(d.washer.slug))
    .map(d => {
      const topo = analyserLaveur(d, now)
      const siens = parLaveur.get(d.washer.id) ?? []
      const due = relanceDue(siens, now)
      return {
        id: d.washer.id, name: d.washer.name, slug: d.washer.slug, phone: d.washer.phone, creeLe: d.washer.created_at,
        statut: topo.statut.libelle, ton: topo.statut.ton, priorite: topo.priorite, pagePrete: topo.pagePrete,
        enEssai: topo.statut.libelle.startsWith('En essai'),
        visites30: topo.activite.visites30, reservations30: topo.activite.reservations30,
        derniereConnexion: topo.activite.derniereConnexion,
        relance: due ? { le: due.relancer_le!, action: due.prochaine_action } : null,
        dernierAppel: siens[0] ? { le: siens[0].appele_le, resultat: siens[0].resultat } : null,
      }
    })

  return (
    <CoqueEquipe washer={washer}>
      <ListeLaveursV2
        laveurs={laveurs}
        filtreInitial={FILTRES.includes(filtre as Filtre) ? (filtre as Filtre) : 'tous'}
        maintenant={now.getTime()}
      />
    </CoqueEquipe>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { Building2 } from 'lucide-react'
import ClientProfileModal from '@/components/dashboard/ClientProfileModal'
import { buildClientProfile } from '@/lib/clientProfile'
import { listeClients } from '@/lib/listeClients'
import { comptePourLeCA, effectivePrice } from '@/lib/crmStats'
import type { ChiffresBooking } from '@/components/dashboard/ChiffresV2'

// Onglet « Clients » de Chiffres (refonte 2026, passe 5). Reprend
// `listeClients`/`buildClientProfile` (déjà utilisés par l'écran Clients v2
// et par l'ancien CRM) plutôt que d'écrire un nouveau calcul par client —
// aucune requête supplémentaire, les réservations sont déjà chargées par
// `page.tsx`.
//
// Portée volontairement réduite par rapport à la maquette
// (`project/ChiffresClients.dc.html`), signalé dans le compte rendu de la
// passe :
// - pas de cohortes « reviennent, par mois d'arrivée » ni de « gagnés/perdus
//   ce mois » : calculer ces cohortes correctement (fenêtre glissante de
//   6 mois par client, cas des mois trop récents pour conclure) est une
//   vraie nouvelle logique métier, pas une présentation d'une donnée déjà
//   calculée ailleurs — hors du principe « garde la logique, remplace la
//   présentation » de cette refonte ;
// - pas de section « Les relances qui marchent » : rien dans la base
//   n'enregistre aujourd'hui le canal d'une relance ni si le client est
//   revenu grâce à elle (voir `.claude/agents/refonte.md`, « Les deux
//   automatismes de message » — cette liaison fait partie de l'étape 4 du
//   plan CRM, pas encore construite). Afficher un faux taux de retour aurait
//   été pire que ne rien afficher.
// Les deux (best clients, valeur moyenne, répartition pro/particulier)
// restent : ce sont des agrégats directs des réservations déjà en mémoire.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)] tabular-nums`

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const euros = (v: number) => `${nombre.format(Math.round(v))} €`

export default function ChiffresClients({ bookings }: { bookings: ChiffresBooking[] }) {
  const [maintenant] = useState(() => Date.now())
  const [ouvert, setOuvert] = useState<string | null>(null)

  const clients = useMemo(() => listeClients(bookings, new Date(maintenant)), [bookings, maintenant])

  const stats = useMemo(() => {
    const actifs = clients.filter(c => c.honoredCount > 0)
    const totalCA = actifs.reduce((s, c) => s + c.totalRevenue, 0)
    const valeurMoyenne = actifs.length ? totalCA / actifs.length : 0
    const meilleurs = [...actifs].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5)

    const compteesCA = bookings.filter(comptePourLeCA)
    const caTotal = compteesCA.reduce((s, b) => s + effectivePrice(b), 0)
    const caPro = compteesCA.filter(b => b.is_professional).reduce((s, b) => s + effectivePrice(b), 0)
    const partCaPro = caTotal > 0 ? Math.round((caPro / caTotal) * 100) : 0
    const partRdvPro = compteesCA.length > 0 ? Math.round((compteesCA.filter(b => b.is_professional).length / compteesCA.length) * 100) : 0

    return { actifs, totalCA, valeurMoyenne, meilleurs, partCaPro, partRdvPro }
  }, [clients, bookings])

  const fiche = ouvert ? buildClientProfile(bookings, ouvert) : null

  if (stats.actifs.length === 0) {
    return (
      <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
        Vos statistiques clients apparaîtront ici dès votre première prestation honorée.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-[3px]">
        <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Valeur moyenne par client</span>
        <span className={`text-[44px] sm:text-[52px] leading-none ${hero}`}>{euros(stats.valeurMoyenne)}</span>
        <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
          sur l’ensemble de vos {nombre.format(stats.actifs.length)} client{stats.actifs.length > 1 ? 's' : ''} actif{stats.actifs.length > 1 ? 's' : ''}
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between px-0.5 pb-2">
          <span className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Vos meilleurs clients</span>
          <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {Math.round((stats.meilleurs.reduce((s, c) => s + c.totalRevenue, 0) / (stats.totalCA || 1)) * 100)} % du chiffre d’affaires
          </span>
        </div>
        <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] px-4 divide-y divide-[color:var(--v2-filet)]">
          {stats.meilleurs.map((c, i) => {
            const titreClient = c.isProfessional && c.companyName ? c.companyName : c.name
            const part = stats.totalCA > 0 ? Math.round((c.totalRevenue / stats.totalCA) * 100) : 0
            return (
              <button
                key={c.email}
                type="button"
                onClick={() => setOuvert(c.email)}
                aria-label={`Voir la fiche de ${titreClient}`}
                className="w-full grid grid-cols-[18px_1fr_auto_40px] gap-2.5 items-center py-2.5 text-left"
              >
                <span className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>{i + 1}</span>
                <span className="min-w-0 flex items-center gap-1.5">
                  {c.isProfessional && <Building2 size={13} strokeWidth={2} className="shrink-0 text-[color:var(--v2-color-gris)]" aria-hidden />}
                  <span className={`text-[14.5px] ${corpsFort} truncate`}>{titreClient}</span>
                </span>
                <span className={`text-[14.5px] ${corpsFort} tabular-nums text-right`}>{euros(c.totalRevenue)}</span>
                <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] text-right`}>{part} %</span>
              </button>
            )
          })}
        </div>
      </div>

      <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-relaxed px-1`}>
        Les clients professionnels font {stats.partCaPro} % du chiffre d’affaires pour {stats.partRdvPro} % des rendez-vous.
      </p>

      <div className="rounded-[var(--v2-radius-surface)] border border-dashed border-[color:var(--v2-filet-fort)] px-4 py-3.5">
        <p className={`text-[13px] ${corpsFort}`}>Les relances qui marchent</p>
        <p className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)] leading-relaxed mt-1`}>
          Pas encore suivi : WashBoard ne relie pas encore une relance envoyée à son canal et à son résultat. Réglages actuels dans Plus › Messages automatiques.
        </p>
      </div>

      {fiche && <ClientProfileModal profile={fiche} onClose={() => setOuvert(null)} />}
    </div>
  )
}

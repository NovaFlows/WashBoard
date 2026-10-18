import { quotaSmsEnClair, requiredPlan, requiredPlanLabel, type Feature } from '@/lib/plan'

// `offre` pointe la clé de MIN_PLAN (lib/plan.ts) : le badge en est dérivé, jamais écrit à la
// main, et reste absent pour ce que l'offre gratuite ouvre. `nouveau` : sorties d'octobre 2026.
type Item = { titre: string; texte: string; offre?: Feature; nouveau?: boolean }
type Colonne = { titre: string; sous: string; items: Item[] }

const COLONNES: Colonne[] = [
  {
    titre: 'Remplir ton agenda', sous: 'Les clients te trouvent et réservent seuls.',
    items: [
      { titre: 'Page de réservation à ton image', texte: `Tes prestations et tes prix par type de véhicule, réservables sans compte. Ton logo et tes couleurs dès ${requiredPlanLabel('page_personnalisee')}.` },
      { titre: 'Promotions', texte: 'Une remise en % ou en € sur la période de ton choix, annoncée par un bandeau et un compte à rebours.', nouveau: true },
      { titre: 'Créneaux groupés', texte: 'Les horaires proches d’un rendez-vous déjà prévu mis en avant, avec ta remise.', offre: 'creneaux_intelligents' },
      { titre: 'Avis Google automatiques', texte: `Une demande d’avis après chaque prestation terminée, par email ou SMS (${quotaSmsEnClair()}).`, offre: 'avis_email' },
      { titre: 'Liens par réseau', texte: 'Un lien pour Instagram, un pour TikTok, un pour Google : tu sais d’où vient chaque réservation.', offre: 'crm' },
    ],
  },
  {
    titre: 'Être payé, proprement', sous: 'Rien à recopier, rien à refaire le soir.',
    items: [
      { titre: 'Acompte à la réservation', texte: 'Payé par ton lien PayPal, Stripe, SumUp, Lydia, par Wero ou par virement. Pas réglé à temps : le créneau se libère.', nouveau: true },
      { titre: 'Facturation conforme', texte: 'SIRET, TVA, numérotation continue. La facture part dès que tu marques terminé.', offre: 'facturation' },
      { titre: 'Frais de déplacement', texte: 'Calculés au trajet réel, depuis ton point de départ ou ton rendez-vous précédent.', offre: 'frais_deplacement' },
      { titre: 'Comptabilité', texte: 'Chiffre d’affaires, dépenses, dépenses récurrentes et résultat, par jour, semaine, mois ou année.', offre: 'compta' },
    ],
  },
  {
    titre: 'Faire revenir tes clients', sous: 'Un bon client, ça se garde.',
    items: [
      { titre: 'Carte de fidélité', texte: 'Un tampon par prestation, la récompense de ton choix appliquée toute seule. En 3D, à tes couleurs.', nouveau: true },
      { titre: 'Relances automatiques', texte: 'Un message pour faire revenir un client après sa dernière prestation.', offre: 'followup' },
      { titre: 'Fiche client', texte: 'Historique, dépensé, panier moyen, et une alerte quand un client n’est pas revenu depuis 90 jours.' },
      { titre: 'CRM et statistiques', texte: `Visiteurs, taux de conversion, sources et export Excel. Suivi de tes campagnes Meta en ${requiredPlanLabel('campagnes')}.`, offre: 'crm' },
    ],
  },
]

const ET_AUSSI = [
  'Agenda jour, semaine, mois',
  'Congés et absences',
  'Google Agenda synchronisé',
  'Notifications de réservation',
  'Appli installable',
  'Devis et factures sans rendez-vous',
  'Clients pros et entreprises',
  `Multi-laveurs (${requiredPlanLabel('multi_laveurs')})`,
]

function Badge({ item }: { item: Item }) {
  if (item.nouveau) return <span className="badge badge-new">Nouveau</span>
  if (item.offre && requiredPlan(item.offre) !== 'decouverte') return <span className="badge">{requiredPlanLabel(item.offre)}</span>
  return null
}

export default function ToutEnUn() {
  return (
    <section className="section" id="fonctionnalites">
      <div className="w">
        <p className="sur-titre"><span className="pt" />Tout-en-un</p>
        <h2 className="h2">Le logiciel des pros du lavage auto et du detailing. <span className="doux">De la réservation à la fidélisation.</span></h2>
        <div className="fonc">
          {COLONNES.map(col => (
            <div className="fonc-col" key={col.titre}>
              <h3>{col.titre}</h3>
              <p>{col.sous}</p>
              {col.items.map(it => (
                <div className="fonc-it" key={it.titre}>
                  <b>{it.titre} <Badge item={it} /></b>
                  <p>{it.texte}</p>
                </div>
              ))}
            </div>
          ))}
          <div className="fonc-aussi">
            <b>Et aussi :</b>
            {ET_AUSSI.map(x => <span key={x}>{x}</span>)}
          </div>
        </div>
      </div>
    </section>
  )
}

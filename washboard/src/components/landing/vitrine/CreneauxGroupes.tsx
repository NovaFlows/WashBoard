import { requiredPlanLabel } from '@/lib/plan'
import CreneauxDemo from './CreneauxDemo'
import { getT } from '@/lib/i18n/serveur'

const ETAPES = [
  { n: '01', titre: 'Le client réserve', texte: 'Il donne son adresse en réservant, comme pour n’importe quel rendez-vous. Rien à cocher de ton côté.' },
  { n: '02', titre: 'WashBoard compare les trajets', texte: 'Son adresse est comparée, via Google Maps, au trajet réel jusqu’à tes rendez-vous déjà prévus ce jour-là.' },
  { n: '03', titre: 'Les créneaux proches ressortent', texte: 'Les horaires sous ton seuil (5 à 30 minutes) sont mis en avant, avec ta remise si tu en as réglé une. Le client reste libre de son choix.' },
]

export default async function CreneauxGroupes() {
  const t = await getT()
  return (
    <section className="section" id="creneaux">
      <div className="w">
        <p className="sur-titre"><span className="pt" />{t('Créneaux groupés')} <span className="badge">{requiredPlanLabel('creneaux_intelligents')}</span></p>
        <h2 className="h2">{t('Deux rendez-vous proches,')} <span className="doux">{t('un trajet en moins.')}</span></h2>
        <CreneauxDemo
          etapes={
            <div className="cg-etapes">
              {ETAPES.map(e => (
                <div key={e.n}><span>{e.n}</span><div><b>{t(e.titre)}</b><p>{t(e.texte)}</p></div></div>
              ))}
            </div>
          }
        />
      </div>
    </section>
  )
}

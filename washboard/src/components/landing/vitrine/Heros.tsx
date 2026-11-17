import Link from 'next/link'
import { AppOrdinateur, AppTelephone } from './demo'
import { IcFleche } from './Icones'
import TitreRotatif from './TitreRotatif'
import { getT } from '@/lib/i18n/serveur'

export default async function Heros() {
  const t = await getT()
  return (
    <section className="heros">
      <div className="w">
        <div>
          <TitreRotatif />
          <p className="chapo">{t('Le logiciel des laveurs auto et du detailing à domicile. Tes clients réservent en ligne, ton agenda se remplit tout seul, tes factures partent dès que tu termines, et ta carte de fidélité les fait revenir.')}</p>
          <div className="heros-cta">
            <Link className="btn btn-accent" href="/signup">{t('Essayer 14 jours gratuits')}</Link>
            <a className="btn btn-ligne" href="#demo">{t('Manipuler la démo')}</a>
          </div>
          <p className="rassure">{t('Sans carte bancaire.')} <b>{t('28 jours avec le code d’un collègue.')}</b></p>
          <div className="preuves"><span>{t('Pensé pour le téléphone')}</span><span>{t('Aussi sur ordinateur')}</span><span>{t('S’installe comme une appli')}</span></div>
        </div>
        <div className="scene" role="group" aria-label={t('Aperçu de WashBoard sur ordinateur et sur téléphone')}>
          <div className="ecran-dk"><AppOrdinateur ecranInitial="agenda" /></div>
          <div className="scene-tel"><AppTelephone /></div>
          <p className="scene-legende"><span>{t('Touche les onglets : tout fonctionne, avec des données fictives.')}</span><IcFleche /></p>
        </div>
      </div>
    </section>
  )
}

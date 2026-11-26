import Link from 'next/link'
import { getT } from '@/lib/i18n/serveur'

export default async function Final() {
  const t = await getT()
  return (
    <section className="final">
      <div className="w">
        <h2 className="h2">{t('Tu fais le service.')}<br /><span className="doux">{t('On gère le reste.')}</span></h2>
        <p className="chapo" style={{ marginInline: 'auto' }}>{t('Ta page de réservation en ligne en 10 minutes. 14 jours offerts, sans carte bancaire.')}</p>
        <div className="heros-cta">
          <Link className="btn btn-accent" href="/signup">{t('Créer mon compte')}</Link>
          <a className="btn btn-ligne" href="#demo">{t('Revoir la démo')}</a>
        </div>
        <p className="rassure">{t('Un collègue t’a donné son code ?')} <b>{t('28 jours d’essai')}</b> {t('au lieu de 14.')}</p>
      </div>
    </section>
  )
}

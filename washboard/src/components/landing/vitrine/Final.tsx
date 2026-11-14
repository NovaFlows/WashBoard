import Link from 'next/link'
import { getT } from '@/lib/i18n/serveur'

export default async function Final() {
  const t = await getT()
  return (
    <section className="final">
      <div className="w">
        <h2 className="h2">{t('Tu fais le service.')}<br /><span className="doux">{t('On gère le reste.')}</span></h2>
        <p className="chapo" style={{ marginInline: 'auto' }}>{t('Ta page de réservation en ligne en 10 minutes. Un mois offert, sans carte bancaire.')}</p>
        <div className="heros-cta">
          <Link className="btn btn-accent" href="/signup">{t('Créer mon compte')}</Link>
          <a className="btn btn-ligne" href="#demo">{t('Revoir la démo')}</a>
        </div>
      </div>
    </section>
  )
}

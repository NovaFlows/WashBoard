import Link from 'next/link'
import BoutonTheme from './BoutonTheme'
import { Logo } from './Icones'
import SelecteurLangue from '@/components/i18n/SelecteurLangue'
import { getT } from '@/lib/i18n/serveur'

const LIENS = [
  { href: '#demo', label: 'Démo' },
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#fidelite', label: 'Fidélité' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#faq', label: 'FAQ' },
]

// Hors de l'accueil, les ancres et le logo repartent vers la page d'accueil.
export default async function Navigation({ horsAccueil = false }: { horsAccueil?: boolean }) {
  const prefixe = horsAccueil ? '/' : ''
  const t = await getT()
  return (
    <header className="nav">
      <div className="w">
        <a className="marque" href={horsAccueil ? '/' : '#haut'}><Logo />WashBoard</a>
        <nav className="nav-liens" aria-label={t('Sections')}>
          {LIENS.map(l => <a key={l.href} href={prefixe + l.href}>{t(l.label)}</a>)}
          <Link href="/blog">Blog</Link>
        </nav>
        <div className="nav-droite">
          <SelecteurLangue />
          <BoutonTheme />
          <Link className="lien-discret" href="/login"><span className="long">{t('Se connecter')}</span><span className="court">{t('Connexion')}</span></Link>
          <Link className="btn btn-accent btn-petit" href="/signup">{t('Essayer')}<span className="long">&nbsp;{t('gratuitement')}</span></Link>
        </div>
      </div>
    </header>
  )
}

import Link from 'next/link'
import BoutonTheme from './BoutonTheme'
import { Logo } from './Icones'

const LIENS = [
  { href: '#demo', label: 'Démo' },
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#fidelite', label: 'Fidélité' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#faq', label: 'FAQ' },
]

// Hors de l'accueil, les ancres et le logo repartent vers la page d'accueil.
export default function Navigation({ horsAccueil = false }: { horsAccueil?: boolean }) {
  const prefixe = horsAccueil ? '/' : ''
  return (
    <header className="nav">
      <div className="w">
        <a className="marque" href={horsAccueil ? '/' : '#haut'}><Logo />WashBoard</a>
        <nav className="nav-liens" aria-label="Sections">
          {LIENS.map(l => <a key={l.href} href={prefixe + l.href}>{l.label}</a>)}
          <Link href="/blog">Blog</Link>
        </nav>
        <div className="nav-droite">
          <BoutonTheme />
          <Link className="lien-discret" href="/login">Se connecter</Link>
          <Link className="btn btn-accent btn-petit" href="/signup">Essayer<span className="long">&nbsp;gratuitement</span></Link>
        </div>
      </div>
    </header>
  )
}

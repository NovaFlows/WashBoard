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

export default function Navigation() {
  return (
    <header className="nav">
      <div className="w">
        <a className="marque" href="#haut"><Logo />WashBoard</a>
        <nav className="nav-liens" aria-label="Sections">
          {LIENS.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
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

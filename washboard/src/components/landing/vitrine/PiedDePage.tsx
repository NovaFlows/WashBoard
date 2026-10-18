import Link from 'next/link'
import { SOCIAL_LINKS } from '@/components/ui/socialLinks'
import { Logo } from './Icones'

const COLONNES = [
  { titre: 'Métiers', liens: [
    { href: '/logiciel-lavage-auto', label: 'Logiciel lavage auto' },
    { href: '/logiciel-nettoyage-canape', label: 'Nettoyage de canapés' },
    { href: '/optimisation-tournee-lavage-auto', label: 'Optimiser sa tournée' },
    { href: '/meilleur-logiciel-lavage-auto', label: 'Meilleur logiciel lavage auto' },
  ] },
  { titre: 'Ressources', liens: [
    { href: '/blog', label: 'Blog' },
    { href: '#faq', label: 'FAQ' },
    { href: '#tarifs', label: 'Tarifs' },
  ] },
  { titre: 'Légal', liens: [
    { href: '/mentions-legales', label: 'Mentions légales' },
    { href: '/cgv', label: 'CGV' },
    { href: '/confidentialite', label: 'Confidentialité' },
  ] },
]

export default function PiedDePage({ horsAccueil = false }: { horsAccueil?: boolean }) {
  const prefixe = horsAccueil ? '/' : ''
  return (
    <footer className="pied">
      <div className="w">
        <div className="pied-grille">
          <div>
            <a className="marque" href={horsAccueil ? '/' : '#haut'} style={{ padding: 0 }}><Logo />WashBoard</a>
            <p style={{ marginTop: 12, maxWidth: '34ch' }}>Le logiciel de gestion des laveurs auto mobiles, du detailing et du nettoyage de canapés à domicile.</p>
            <div className="pied-social">
              {SOCIAL_LINKS.map(s => (
                <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`WashBoard sur ${s.name}`}>{s.icon}</a>
              ))}
            </div>
          </div>
          {COLONNES.map(col => (
            <div key={col.titre}>
              <p className="pied-titre">{col.titre}</p>
              {col.liens.map(l => l.href.startsWith('#')
                ? <a key={l.href} href={prefixe + l.href}>{l.label}</a>
                : <Link key={l.href} href={l.href}>{l.label}</Link>)}
            </div>
          ))}
        </div>
        <div className="pied-bas">
          <span>© 2026 WashBoard{horsAccueil ? '' : ' · Les démos de cette page utilisent des données fictives.'}</span>
          <a href="https://novaflows.fr/realisations" target="_blank" rel="noopener noreferrer">Conçu par NovaFlows</a>
        </div>
      </div>
    </footer>
  )
}

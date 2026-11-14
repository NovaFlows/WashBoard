import Link from 'next/link'
import { SOCIAL_LINKS } from '@/components/ui/socialLinks'
import { Logo } from './Icones'
import { getT } from '@/lib/i18n/serveur'

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

export default async function PiedDePage({ horsAccueil = false }: { horsAccueil?: boolean }) {
  const prefixe = horsAccueil ? '/' : ''
  const t = await getT()
  return (
    <footer className="pied">
      <div className="w">
        <div className="pied-grille">
          <div>
            <a className="marque" href={horsAccueil ? '/' : '#haut'} style={{ padding: 0 }}><Logo />WashBoard</a>
            <p style={{ marginTop: 12, maxWidth: '34ch' }}>{t('Le logiciel de gestion des laveurs auto mobiles, du detailing et du nettoyage de canapés à domicile.')}</p>
            <div className="pied-social">
              {SOCIAL_LINKS.map(s => (
                <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={t('WashBoard sur {nom}', { nom: s.name })}>{s.icon}</a>
              ))}
            </div>
          </div>
          {COLONNES.map(col => (
            <div key={col.titre}>
              <p className="pied-titre">{t(col.titre)}</p>
              {col.liens.map(l => l.href.startsWith('#')
                ? <a key={l.href} href={prefixe + l.href}>{t(l.label)}</a>
                : <Link key={l.href} href={l.href}>{t(l.label)}</Link>)}
            </div>
          ))}
        </div>
        <div className="pied-bas">
          <span>© 2026 WashBoard{horsAccueil ? '' : ` · ${t('Les démos de cette page utilisent des données fictives.')}`}</span>
          <a href="https://novaflows.fr/realisations" target="_blank" rel="noopener noreferrer">{t('Conçu par NovaFlows')}</a>
        </div>
      </div>
    </footer>
  )
}

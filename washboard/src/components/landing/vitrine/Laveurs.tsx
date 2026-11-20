import { getT } from '@/lib/i18n/serveur'

type Image = { largeur: number; hauteur: number }
type Logo = { fichier: string; nom: string | null; image: Image; clair?: Image }

// Logos affichés avec l'accord des laveurs, détourés (public/landing/laveurs). `clair` : variante
// « autocollant » sur fond noir pour le mode clair, quand le logo a du blanc qui disparaîtrait sur la page.
export const LOGOS_LAVEURS: readonly Logo[] = [
  { fichier: 'my-clean', nom: 'My Clean', image: { largeur: 170, hauteur: 160 }, clair: { largeur: 169, hauteur: 160 } },
  { fichier: 'street-clean-car-91', nom: 'Street Clean Car 91', image: { largeur: 161, hauteur: 160 } },
  { fichier: 'automaclean', nom: 'AutomaClean', image: { largeur: 360, hauteur: 141 } },
  { fichier: 'paint-etrier-77', nom: 'Paint Étrier 77', image: { largeur: 126, hauteur: 160 }, clair: { largeur: 127, hauteur: 160 } },
  { fichier: 'chat-lavage', nom: null, image: { largeur: 158, hauteur: 160 } },
]

// Laveurs inscrits en plus des logos affichés (33 comptes actifs hors test au 2026-11-18).
// À ne jamais arrondir au-dessus du réel.
export const AUTRES_LAVEURS = 25

export default async function Laveurs() {
  const t = await getT()
  const groupe = (copie: number) => [
    ...LOGOS_LAVEURS.map(l => {
      const alt = copie === 0 ? (l.nom ?? t('Logo d’un laveur WashBoard')) : ''
      const src = (suffixe = '') => `/landing/laveurs/${l.fichier}${suffixe}.webp`
      return (
        <li key={`${copie}-${l.fichier}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- webp déjà réduits, page pré-calculée */}
          <img className={l.clair ? 'logo-sombre' : undefined} src={src()} alt={alt} width={l.image.largeur} height={l.image.hauteur} decoding="async" />
          {l.clair && (
            // eslint-disable-next-line @next/next/no-img-element -- idem
            <img className="logo-clair" src={src('-clair')} alt={alt} width={l.clair.largeur} height={l.clair.hauteur} decoding="async" />
          )}
        </li>
      )
    }),
    <li key={`${copie}-plus`} className="laveurs-plus" aria-hidden={copie !== 0 || undefined}>
      <span className="trois-points" aria-hidden="true"><i /><i /><i /></span>
      <span><b className="num">+{AUTRES_LAVEURS}</b> {t('autres laveurs')}</span>
    </li>,
  ]
  return (
    <section className="laveurs" aria-labelledby="laveurs-titre">
      <div className="w">
        <p className="laveurs-titre" id="laveurs-titre">{t('Ils lavent déjà avec WashBoard')}</p>
        <div className="defile">
          {/* Deux fois la même liste : la piste glisse d'une demi-longueur puis repart, sans saut. */}
          <div className="defile-piste">
            <ul>{groupe(0)}{groupe(1)}</ul>
            <ul aria-hidden="true">{groupe(2)}{groupe(3)}</ul>
          </div>
        </div>
      </div>
    </section>
  )
}

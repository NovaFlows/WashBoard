import { getT } from '@/lib/i18n/serveur'

// Logos affichés avec l'accord des laveurs. Images dans public/landing/laveurs (fond noir d'origine).
export const LOGOS_LAVEURS = [
  { fichier: 'my-clean', nom: 'My Clean', largeur: 194, hauteur: 184 },
  { fichier: 'street-clean-car-91', nom: 'Street Clean Car 91', largeur: 186, hauteur: 184 },
  { fichier: 'automaclean', nom: 'AutomaClean', largeur: 344, hauteur: 149 },
  { fichier: 'paint-etrier-77', nom: 'Paint Étrier 77', largeur: 149, hauteur: 184 },
  { fichier: 'chat-lavage', nom: null, largeur: 182, hauteur: 184 },
] as const

// Laveurs inscrits en plus des logos affichés (33 comptes actifs hors test au 2026-11-18).
// À ne jamais arrondir au-dessus du réel.
export const AUTRES_LAVEURS = 25

export default async function Laveurs() {
  const t = await getT()
  const logos = (copie: number) => LOGOS_LAVEURS.map(l => (
    <li key={`${copie}-${l.fichier}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- webp déjà réduits (4-11 Ko), page pré-calculée */}
      <img
        src={`/landing/laveurs/${l.fichier}.webp`}
        alt={copie === 0 ? (l.nom ?? t('Logo d’un laveur WashBoard')) : ''}
        width={l.largeur}
        height={l.hauteur}
        decoding="async"
      />
    </li>
  ))
  return (
    <section className="laveurs" aria-labelledby="laveurs-titre">
      <div className="w">
        <p className="laveurs-titre" id="laveurs-titre">{t('Ils lavent déjà avec WashBoard')}</p>
        <div className="laveurs-rang">
          <div className="defile">
            {/* Deux fois la même liste : la piste glisse d'une demi-longueur puis repart, sans saut. */}
            <div className="defile-piste">
              <ul>{logos(0)}{logos(1)}</ul>
              <ul aria-hidden="true">{logos(2)}{logos(3)}</ul>
            </div>
          </div>
          <p className="laveurs-plus">
            <span className="trois-points" aria-hidden="true"><i /><i /><i /></span>
            <b className="num">+{AUTRES_LAVEURS}</b> {t('laveurs')}
          </p>
        </div>
      </div>
    </section>
  )
}

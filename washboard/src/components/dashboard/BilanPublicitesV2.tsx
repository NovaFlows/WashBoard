'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { formatEuros } from '@/lib/plan'
import {
  labelPlateforme, synthese, toutesLesCreations, parPlateforme, estFiable,
  type CampagneAffichee,
} from '@/lib/campagne'

// « Bilan » — la vue qui additionne, quand l'écran des campagnes ne suffit
// plus.
//
// Elle n'existe que pour les questions qu'AUCUNE carte isolée ne peut
// trancher :
//   · de toutes mes vidéos, laquelle marche le mieux ? (la meilleure d'une
//     petite campagne peut battre celle d'une grosse) ;
//   · est-ce que Meta me rapporte plus que TikTok ?
//   · laquelle de mes campagnes dois-je couper ?
//
// Tout le reste — déclarer, modifier, copier un lien — reste sur l'écran
// précédent. Cette page-ci ne fait que lire : rien n'y est modifiable, et
// c'est volontaire. Un écran de bilan où l'on peut agir devient un second
// écran de gestion, et les deux divergent.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

const pourcent = (v: number | null) => (v === null ? '—' : `${v.toFixed(1).replace('.', ',')} %`)
const multiple = (v: number | null) => (v === null ? '—' : `× ${v.toFixed(1).replace('.', ',')}`)

function couleurRetour(retour: number | null, reservations: number): string | undefined {
  if (retour === null || reservations === 0) return undefined
  return retour >= 1 ? 'var(--v2-color-vert)' : 'var(--v2-color-rouge)'
}

function Carte({ titre: intitule, children }: { titre?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
      {intitule && (
        <h2 className={`px-4 pt-4 text-[15px] ${nom}`}>{intitule}</h2>
      )}
      <div className="p-4 pt-2">{children}</div>
    </section>
  )
}

function Mesure({ label, valeur, aide, couleur, pale }: {
  label: string
  valeur: string
  aide?: string
  couleur?: string
  pale?: boolean
}) {
  return (
    <div className="flex min-h-11 items-baseline gap-3 py-1.5">
      <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>{label}</span>
      <span className="ml-auto text-right">
        <span
          className={`text-[17px] ${pale ? corps : corpsFort}`}
          style={{ color: couleur ?? (pale ? 'var(--v2-color-gris)' : 'var(--v2-color-encre)') }}
        >
          {valeur}
        </span>
        {aide && <span className={`block text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{aide}</span>}
      </span>
    </div>
  )
}

/** Une ligne de classement : rang, nom, sous-titre, et le chiffre qui classe. */
function LigneRang({ rang, titre: intitule, sousTitre, valeur, aide, couleur }: {
  rang: number
  titre: string
  sousTitre: string
  valeur: string
  aide?: string
  couleur?: string
}) {
  const premier = rang === 1
  return (
    <li className="flex items-center gap-3 border-t border-[color:var(--v2-filet)] py-3 first:border-t-0">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--v2-radius-pilule)] text-[12px] ${corpsFort}`}
        style={premier
          ? { background: 'var(--v2-color-vert)', color: 'var(--v2-color-surface)' }
          : { background: 'var(--v2-filet-fort)', color: 'var(--v2-color-gris)' }}
      >
        {rang}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] ${nom}`}>{intitule}</span>
        <span className={`block truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`block text-[16px] ${corpsFort}`} style={couleur ? { color: couleur } : undefined}>{valeur}</span>
        {aide && <span className={`block text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{aide}</span>}
      </span>
    </li>
  )
}

export type BilanPublicitesProps = { campagnes: CampagneAffichee[] }

export default function BilanPublicitesV2({ campagnes }: BilanPublicitesProps) {
  const totaux = useMemo(
    () => synthese(campagnes.map(c => c.bilan), campagnes.map(c => c.budget)),
    [campagnes],
  )
  const videos = useMemo(() => toutesLesCreations(campagnes), [campagnes])
  const plateformes = useMemo(() => parPlateforme(campagnes), [campagnes])

  // Les campagnes classées par ce qu'elles ont rapporté, pas par leur date :
  // sur cet écran on cherche quoi couper et quoi nourrir, pas ce qui est
  // récent.
  const classement = useMemo(
    () => [...campagnes].sort((a, b) =>
      b.bilan.chiffreAffaires - a.bilan.chiffreAffaires
      || b.bilan.reservations - a.bilan.reservations
      || a.nom.localeCompare(b.nom, 'fr')),
    [campagnes],
  )

  const couleur = couleurRetour(totaux.retour, totaux.reservations)
  const tauxGlobal = totaux.visites > 0 ? (totaux.reservations / totaux.visites) * 100 : null

  return (
    <div
      className={`mx-auto -mx-3 -mt-6 max-w-3xl bg-[color:var(--v2-color-fond)] px-3 pb-24 pt-3 text-[color:var(--v2-color-encre)] sm:-mx-4 sm:px-4 ${police}`}
    >
      <div className="flex items-center gap-1 pb-3">
        <Link
          href="/dashboard/clients/publicites"
          aria-label="Retour aux publicités"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0">
          <h1 className={`text-[21px] leading-none ${titre}`}>Bilan</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {campagnes.length} campagne{campagnes.length > 1 ? 's' : ''} depuis le début
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Carte titre="Tout additionné">
          <Mesure label="Dépensé" valeur={`${formatEuros(totaux.budget)} €`} />
          <Mesure label="Encaissé" valeur={`${formatEuros(totaux.chiffreAffaires)} €`} />
          <Mesure
            label="Retour"
            valeur={totaux.reservations > 0 ? multiple(totaux.retour) : '—'}
            couleur={couleur}
          />
          <Mesure label="Visites" valeur={String(totaux.visites)} />
          <Mesure
            label="Clients"
            valeur={String(totaux.reservations)}
            aide={totaux.coutParReservation === null
              ? undefined
              : `${formatEuros(Math.round(totaux.coutParReservation * 100) / 100)} € chacun`}
          />
          {/* Le taux global suit la même règle que partout : sous le seuil il
              ne veut rien dire, et le montrer ferait tirer des conclusions
              d'une poignée de clics. */}
          <Mesure
            label="Transformation"
            valeur={estFiable(totaux.visites) ? pourcent(tauxGlobal) : 'Peu de données'}
            pale={!estFiable(totaux.visites)}
          />

          {totaux.reservations > 0 && totaux.retour !== null && (
            <p className={`mt-2 border-t border-[color:var(--v2-filet)] pt-3 text-[14px] leading-relaxed ${corps}`}>
              Pour 1 € de publicité, vous avez encaissé{' '}
              <span className={corpsFort} style={couleur ? { color: couleur } : undefined}>
                {formatEuros(Math.round(totaux.retour * 100) / 100)} €
              </span>{' '}
              de lavages.
            </p>
          )}
        </Carte>

        {/* Toutes les vidéos ensemble : c'est la seule vue qui permet de voir
            que la meilleure vidéo d'une petite campagne bat celle d'une
            grosse. */}
        {videos.length > 0 && (
          <Carte titre="Vos vidéos, toutes campagnes confondues">
            <ul>
              {videos.slice(0, 10).map((v, i) => (
                <LigneRang
                  key={v.creation.id}
                  rang={i + 1}
                  titre={v.creation.nom}
                  sousTitre={`${v.campagne} · ${v.visites} visite${v.visites > 1 ? 's' : ''}`}
                  valeur={`${v.reservations} client${v.reservations > 1 ? 's' : ''}`}
                  aide={v.chiffreAffaires > 0 ? `${formatEuros(v.chiffreAffaires)} €` : undefined}
                />
              ))}
            </ul>
            {videos.length > 10 && (
              <p className={`mt-3 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
                Les 10 premières sur {videos.length}.
              </p>
            )}
          </Carte>
        )}

        {/* Deux plateformes ou plus seulement : « 100 % sur Meta » n'apprend
            rien à qui n'a jamais lancé ailleurs. */}
        {plateformes.length > 1 && (
          <Carte titre="Par plateforme">
            <ul>
              {plateformes.map((p, i) => (
                <LigneRang
                  key={p.plateforme}
                  rang={i + 1}
                  titre={labelPlateforme(p.plateforme)}
                  sousTitre={`${formatEuros(p.budget)} € dépensés · ${p.campagnes} campagne${p.campagnes > 1 ? 's' : ''}`}
                  valeur={p.reservations > 0 ? multiple(p.retour) : '—'}
                  aide={`${formatEuros(p.chiffreAffaires)} €`}
                  couleur={couleurRetour(p.retour, p.reservations)}
                />
              ))}
            </ul>
          </Carte>
        )}

        <Carte titre="Vos campagnes">
          <ul>
            {classement.map((c, i) => (
              <LigneRang
                key={c.id}
                rang={i + 1}
                titre={c.nom}
                sousTitre={`${labelPlateforme(c.plateforme)} · ${formatEuros(c.budget)} € dépensés`}
                valeur={c.bilan.reservations > 0 ? multiple(c.bilan.retour) : '—'}
                aide={`${formatEuros(c.bilan.chiffreAffaires)} €`}
                couleur={couleurRetour(c.bilan.retour, c.bilan.reservations)}
              />
            ))}
          </ul>
        </Carte>

        {/* Dire d'où viennent ces chiffres, une fois, en bas. Le budget est
            déclaré à la main : quelqu'un qui compare ce bilan à ce que Meta
            lui facture doit savoir pourquoi les deux peuvent différer. */}
        <p className={`px-1 text-[12px] leading-relaxed ${corps} text-[color:var(--v2-color-gris)]`}>
          Les montants dépensés sont ceux que vous avez saisis. Les visites et les clients sont
          comptés par WashBoard, à partir des liens de vos campagnes.
        </p>
      </div>
    </div>
  )
}

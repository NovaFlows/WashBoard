'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { CHAMP, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { AVERTISSEMENT_SUGGESTION } from '@/lib/zoneForm'

// Saisie d'adresse de la PWA (refonte 2026). Le composant du site
// (`ui/AddressAutocomplete`, inchangé) reste en style slate et pose sa liste de
// suggestions en flottant (`absolute`) : dans une feuille du bas, qui défile et
// coupe son contenu, cette liste serait rognée. Ici les suggestions s'affichent
// EN LIGNE, sous le champ, et poussent le reste du formulaire.
//
// MÊMES ROUTES, MÊMES QUOTAS que le v1 : `/api/places/autocomplete`, débit de
// 300 ms, trois caractères minimum, jeton de session réutilisé pour toute la
// saisie. Comme le v1 côté zone, on n'appelle PAS `/api/places/details` : la
// zone n'a pas besoin des coordonnées (le serveur géocode `crow` à
// l'enregistrement), et chaque appel est facturé par Google.
//
// TROU CONSTATÉ, NON CORRIGÉ (la route est partagée avec le site) :
// `/api/places/autocomplete` répond `{ suggestions: [] }` aussi bien pour « rien
// trouvé » que pour « Google en panne » (`fetchGoogleMaps` rend `null`, la route
// l'aplatit). Depuis le navigateur, on ne distingue donc une panne que si la
// requête elle-même échoue (réseau, 429, 500) — sinon une clé Google expirée se
// lit « Aucune adresse trouvée ».

type Suggestion = { label: string; placeId: string }
type Etat = 'repos' | 'recherche' | 'liste' | 'vide' | 'panne'

const DEBIT_MS = 300
const LONGUEUR_MIN = 3

export const PHRASE_RECHERCHE = 'Recherche…'
export const PHRASE_AUCUNE = 'Aucune adresse trouvée, ajoutez le code postal'
export const PHRASE_PANNE = 'Suggestions indisponibles, écrivez l’adresse complète'

type Props = {
  id: string
  valeur: string
  onChange: (valeur: string) => void
  placeholder?: string
  /** `base_address` du laveur, proposée d'un tap. Reste un champ DISTINCT de
   *  `zone_config.center_address` : on ne fusionne pas les deux adresses. */
  adresseDeBase?: string | null
  erreur?: string | null
}

export default function AdresseV2({ id, valeur, onChange, placeholder, adresseDeBase, erreur }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [etat, setEtat] = useState<Etat>('repos')
  // L'adresse à l'ouverture vient de la base : elle a déjà été choisie une fois,
  // on n'avertit qu'à partir du moment où le laveur tape lui-même.
  const [choisie, setChoisie] = useState(true)
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)
  const session = useRef<string | null>(null)
  // Une réponse en retard ne doit pas écraser une saisie plus récente.
  const requete = useRef(0)

  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current) }, [])

  function saisir(texte: string) {
    onChange(texte)
    setChoisie(false)
    if (minuteur.current) clearTimeout(minuteur.current)
    const mien = ++requete.current
    if (texte.trim().length < LONGUEUR_MIN) {
      setSuggestions([])
      setEtat('repos')
      return
    }
    setEtat('recherche')
    minuteur.current = setTimeout(async () => {
      session.current ??= crypto.randomUUID()
      try {
        const res = await fetch(
          `/api/places/autocomplete?q=${encodeURIComponent(texte.trim())}&session=${session.current}`,
        )
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json() as { suggestions?: Suggestion[] }
        if (mien !== requete.current) return
        const liste = data.suggestions ?? []
        setSuggestions(liste)
        setEtat(liste.length > 0 ? 'liste' : 'vide')
      } catch {
        if (mien !== requete.current) return
        setSuggestions([])
        setEtat('panne')
      }
    }, DEBIT_MS)
  }

  function retenir(label: string) {
    requete.current++
    if (minuteur.current) clearTimeout(minuteur.current)
    onChange(label)
    setChoisie(true)
    setSuggestions([])
    setEtat('repos')
  }

  const message = etat === 'recherche' ? PHRASE_RECHERCHE : etat === 'vide' ? PHRASE_AUCUNE : etat === 'panne' ? PHRASE_PANNE : null
  // Pas d'avertissement pendant la recherche (le verdict n'est pas tombé) ni quand
  // l'autocomplétion est en panne : il n'y a alors aucune suggestion à choisir, et
  // la phrase grise dit déjà quoi faire.
  const avertir = !choisie && valeur.trim().length >= LONGUEUR_MIN && etat !== 'recherche' && etat !== 'panne'

  return (
    <div>
      <input
        id={id}
        type="text"
        value={valeur}
        onChange={e => saisir(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        aria-invalid={!!erreur}
        aria-describedby={`${id}-etat`}
        className={CHAMP}
      />

      {adresseDeBase?.trim() && adresseDeBase.trim() !== valeur.trim() && (
        <button
          type="button"
          onClick={() => retenir(adresseDeBase.trim())}
          className={`mt-2 inline-flex h-11 max-w-full items-center gap-2 rounded-[var(--v2-radius-pilule)] border border-[color:var(--v2-filet-fort)] px-4 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)] transition-transform active:scale-[.97] motion-reduce:transition-none`}
          style={PRESSION}
        >
          <MapPin size={15} strokeWidth={2} aria-hidden className="shrink-0" />
          <span className="truncate">Utiliser mon adresse de départ</span>
        </button>
      )}

      <div id={`${id}-etat`} aria-live="polite">
        {message && (
          <p className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{message}</p>
        )}
        {etat === 'liste' && suggestions.length > 0 && (
          <ul className="mt-2 overflow-hidden rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] divide-y divide-[color:var(--v2-filet)]">
            {suggestions.map(s => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onClick={() => retenir(s.label)}
                  className={`flex min-h-12 w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] ${corps}`}
                >
                  <MapPin size={15} strokeWidth={2} aria-hidden className="shrink-0 text-[color:var(--v2-color-gris)]" />
                  <span className="min-w-0 flex-1 leading-snug">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {erreur && (
        <p role="alert" className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreur}</p>
      )}
      {!erreur && avertir && (
        // Non bloquant : `verdictZone` LAISSE PASSER quand Google ne reconnaît pas
        // l'adresse (lib/zone.ts) — la zone ne s'applique alors simplement pas.
        <div className="mt-2">
          <Constat ton="ambre" role="status">{AVERTISSEMENT_SUGGESTION}</Constat>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'

// Relie la fiche Google du laveur, pour afficher ses avis sur sa page de
// réservation.
//
// On ne demande pas un « identifiant de lieu » : personne ne sait où le
// trouver. Le laveur tape le nom de son entreprise et choisit dans la liste,
// où la note et le nombre d'avis lui permettent de reconnaître sa fiche du
// premier coup d'œil.

type Etablissement = {
  placeId: string
  name: string
  address: string
  rating: number | null
  reviewCount: number | null
}

export function GoogleBusinessPicker({
  value,
  onChange,
  labelClass,
  inputClass,
}: {
  value: string
  onChange: (placeId: string, nom?: string) => void
  labelClass: string
  inputClass: string
}) {
  const [recherche, setRecherche] = useState('')
  const [resultats, setResultats] = useState<Etablissement[]>([])
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [choisi, setChoisi] = useState<string | null>(null)
  const [manuel, setManuel] = useState(false)
  const [identifiant, setIdentifiant] = useState('')
  // État initial déduit de la valeur reçue : le poser depuis l'effet
  // provoquerait un rendu en cascade au premier affichage.
  const [etatFiche, setEtatFiche] = useState<'verification' | 'ok' | 'muette' | null>(
    value ? 'verification' : null
  )
  const [nbAvis, setNbAvis] = useState(0)

  // Une fiche déjà reliée est vérifiée à l'ouverture : afficher « reliée »
  // sans savoir si Google répond a déjà induit en erreur — un identifiant
  // invalide donnait l'impression que tout était en place pendant que la page
  // de réservation retombait en silence sur les avis du site.
  useEffect(() => {
    if (!value) return
    let annule = false
    fetch(`/api/places/business?verify=${encodeURIComponent(value)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (!annule) { setEtatFiche(d.ok ? 'ok' : 'muette'); setNbAvis(d.reviewCount ?? 0) } })
      .catch(() => { if (!annule) setEtatFiche('muette') })
    return () => { annule = true }
  }, [value])

  async function chercher() {
    if (recherche.trim().length < 3) return
    setOccupe(true); setErreur(null); setResultats([])
    try {
      const res = await fetch(`/api/places/business?q=${encodeURIComponent(recherche.trim())}`)
      if (!res.ok) throw new Error()
      const { results } = await res.json()
      setResultats(results)
      // Une recherche sans résultat n'est pas une panne : on le dit autrement,
      // sinon le laveur croit que la fonction est cassée.
      if (results.length === 0) setErreur('Aucun établissement trouvé. Essayez avec la ville : « CleanCar Cergy ».')
    } catch {
      setErreur('Recherche impossible pour le moment. Réessayez dans un instant.')
    } finally { setOccupe(false) }
  }

  return (
    <div>
      <label className={labelClass}>
        Fiche Google{' '}
        <span className="font-normal text-slate-400">(vos avis Google seront affichés sur votre page de réservation)</span>
      </label>

      {value ? (
        <div className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border ${
          etatFiche === 'muette'
            ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30'
            : 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30'
        }`}>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${
              etatFiche === 'muette'
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}>
              {etatFiche === 'muette' ? 'Cette fiche ne répond pas' : (choisi ?? 'Fiche Google reliée')}
            </p>
            <p className={`text-xs ${
              etatFiche === 'muette'
                ? 'text-amber-600/90 dark:text-amber-500/90'
                : 'text-emerald-600/80 dark:text-emerald-500/80'
            }`}>
              {etatFiche === 'verification' && 'Vérification en cours…'}
              {etatFiche === 'ok' && `${nbAvis} avis récupérés · mise à jour une fois par jour.`}
              {etatFiche === 'muette' && 'Retirez-la et recherchez votre établissement ci-dessous. En attendant, ce sont les avis de votre site qui s’affichent.'}
              {etatFiche === null && 'Vos avis se mettent à jour tout seuls, une fois par jour.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { onChange(''); setChoisi(null); setResultats([]); setEtatFiche(null) }}
            className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800"
          >
            Retirer
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); chercher() } }}
              placeholder="Nom de votre entreprise + ville"
              className={inputClass}
            />
            <button
              type="button"
              onClick={chercher}
              disabled={occupe || recherche.trim().length < 3}
              className="shrink-0 px-4 rounded-xl bg-[#1651E8] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#0F4ACC] transition-colors"
            >
              {occupe ? '…' : 'Chercher'}
            </button>
          </div>

          {erreur && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{erreur}</p>}

          {/* Beaucoup de laveurs sont mobiles : leur fiche Google n'a pas
              d'adresse (« Dessert le Val-d'Oise et les zones à proximité »), et
              ces fiches-là sont absentes de l'index de recherche de Google,
              même quand elles s'affichent parfaitement dans son moteur.
              Vérifié le 2026-09-04 sur une vraie fiche à 60 avis : introuvable
              par les deux versions de l'API. D'où cette saisie directe. */}
          <button
            type="button"
            onClick={() => setManuel(v => !v)}
            className="text-xs font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline underline-offset-2 mt-2.5"
          >
            {manuel ? 'Revenir à la recherche' : 'Vous ne trouvez pas votre fiche ?'}
          </button>

          {manuel && (
            <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-2.5">
                Les fiches sans adresse (activité à domicile) n&apos;apparaissent pas dans
                la recherche ci-dessus. Récupérez l&apos;identifiant de votre fiche sur{' '}
                <a
                  href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline underline-offset-2"
                >
                  l&apos;outil de Google
                </a>{' '}
                (cherchez le nom de votre entreprise, puis copiez le « Place ID »).
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={identifiant}
                  onChange={e => setIdentifiant(e.target.value)}
                  placeholder="ChIJ…"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = identifiant.trim()
                    if (!v) return
                    onChange(v)
                    setChoisi(null)
                    setEtatFiche('verification')
                    setManuel(false)
                  }}
                  disabled={!identifiant.trim()}
                  className="shrink-0 px-4 rounded-xl bg-[#1651E8] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#0F4ACC] transition-colors"
                >
                  Relier
                </button>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                On vérifie tout de suite que la fiche répond — vous saurez immédiatement si c&apos;est la bonne.
              </p>
            </div>
          )}

          {resultats.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {resultats.map(r => (
                <li key={r.placeId}>
                  <button
                    type="button"
                    onClick={() => { onChange(r.placeId, r.name); setChoisi(r.name); setResultats([]); setEtatFiche('verification') }}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#1651E8] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{r.address}</p>
                    {r.rating !== null && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                        {r.rating.toFixed(1)} ★ · {r.reviewCount ?? 0} avis
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
        Google ne partage que ses 5 avis les plus pertinents — c&apos;est sa limite, pas la nôtre.
      </p>
    </div>
  )
}

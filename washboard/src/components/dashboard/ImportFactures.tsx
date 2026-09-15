'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { extraireZip, extension, TYPES_ACCEPTES, LIMITES } from '@/lib/zipFactures'
import { BUCKET_FACTURES_IMPORTEES } from '@/lib/importFactures'
import type { SourceDate } from '@/lib/dateFacture'

// Import des factures qu'un laveur a faites ailleurs, avant WashBoard.
//
// 1. Il glisse des PDF, des photos ou un ZIP ; le ZIP est ouvert ici, dans son
//    navigateur (il ne transite jamais par notre serveur, limité à 4,5 Mo).
// 2. Chaque fichier part seul, directement dans le stockage privé.
// 3. Le serveur devine la date ; le laveur la vérifie et la corrige.
// 4. Il enregistre : les factures se rangent au bon mois, à la bonne année.

type Etat = 'envoi' | 'analyse' | 'pret' | 'erreur'

type Ligne = {
  id: string
  nom: string
  type: string
  taille: number
  modifieLe: number
  etat: Etat
  erreur?: string
  chemin?: string
  date: string
  source: SourceDate | null
  montant: string
  /** Numéro d'origine : une facture importée garde le sien, jamais un F-000xx. */
  numero: string
}

type Entree = { nom: string; type: string; donnees: Blob; modifieLe: number }

// Phrase complète affichée sous le nom du fichier.
const SOURCES: Record<SourceDate, string> = {
  nom: 'Date trouvée dans le nom du fichier',
  texte: 'Date lue dans la facture',
  metadonnees: 'Date de création du PDF — à vérifier',
  fichier: 'Date du fichier — à vérifier',
}

const EN_PARALLELE = 3

export function ImportFactures() {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [ignores, setIgnores] = useState<string[]>([])
  const [survol, setSurvol] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  const maj = (id: string, champs: Partial<Ligne>) =>
    setLignes(prev => prev.map(l => (l.id === id ? { ...l, ...champs } : l)))

  async function envoyer(ligne: Ligne, fichier: Blob) {
    try {
      const prep = await fetch('/api/factures/importees/televersement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: ligne.type, taille: ligne.taille }),
      })
      const p = await prep.json().catch(() => ({})) as { chemin?: string; token?: string; error?: string }
      if (!prep.ok || !p.chemin || !p.token) throw new Error(p.error ?? 'Envoi impossible.')

      const { error } = await createClient().storage
        .from(BUCKET_FACTURES_IMPORTEES)
        .uploadToSignedUrl(p.chemin, p.token, fichier, { contentType: ligne.type })
      if (error) throw new Error('Envoi interrompu. Réessayez.')
      maj(ligne.id, { etat: 'analyse', chemin: p.chemin })

      const an = await fetch('/api/factures/importees/analyser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chemin: p.chemin, nomFichier: ligne.nom, modifieLe: ligne.modifieLe }),
      })
      const a = await an.json().catch(() => ({})) as { date?: string | null; source?: SourceDate | null; montant?: number | null; numero?: string | null }
      maj(ligne.id, {
        etat: 'pret',
        date: a.date ?? '',
        source: a.source ?? null,
        montant: a.montant != null ? String(a.montant).replace('.', ',') : '',
        numero: a.numero ?? '',
      })
    } catch (e) {
      maj(ligne.id, { etat: 'erreur', erreur: e instanceof Error ? e.message : 'Envoi impossible.' })
    }
  }

  async function ajouter(fichiers: FileList | File[]) {
    setMessage(null)
    const entrees: Entree[] = []
    const refus: string[] = []
    for (const f of Array.from(fichiers)) {
      const ext = extension(f.name)
      if (ext === 'zip') {
        try {
          const { fichiers: extraits, ignores: ign } = extraireZip(new Uint8Array(await f.arrayBuffer()))
          refus.push(...ign)
          for (const x of extraits) {
            entrees.push({ nom: x.nom, type: x.type, donnees: new Blob([new Uint8Array(x.donnees)], { type: x.type }), modifieLe: f.lastModified })
          }
        } catch {
          refus.push(`${f.name} : ZIP illisible ou abîmé`)
        }
      } else if (TYPES_ACCEPTES[ext]) {
        if (f.size > LIMITES.tailleFichier) refus.push(`${f.name} : plus de 10 Mo`)
        else entrees.push({ nom: f.name, type: TYPES_ACCEPTES[ext], donnees: f, modifieLe: f.lastModified })
      } else {
        refus.push(`${f.name} : format non accepté (PDF, JPG, PNG ou ZIP)`)
      }
    }

    const place = LIMITES.nombreFichiers - lignes.length
    if (entrees.length > place) {
      refus.push(`${entrees.length - place} fichier(s) au-delà de ${LIMITES.nombreFichiers} par import`)
      entrees.length = Math.max(0, place)
    }
    setIgnores(prev => [...prev, ...refus])

    const nouvelles = entrees.map(e => ({
      ligne: {
        id: crypto.randomUUID(), nom: e.nom, type: e.type, taille: e.donnees.size, modifieLe: e.modifieLe,
        etat: 'envoi' as Etat, date: '', source: null, montant: '', numero: '',
      },
      donnees: e.donnees,
    }))
    setLignes(prev => [...prev, ...nouvelles.map(n => n.ligne)])

    // Trois envois à la fois : assez pour aller vite, sans saturer une
    // connexion mobile.
    const file = [...nouvelles]
    await Promise.all(Array.from({ length: EN_PARALLELE }, async () => {
      for (let n = file.shift(); n; n = file.shift()) await envoyer(n.ligne, n.donnees)
    }))
  }

  async function effacerFichiers(chemins: string[]) {
    if (chemins.length === 0) return
    await fetch('/api/factures/importees', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chemins }),
    }).catch(() => {})
  }

  function retirer(ligne: Ligne) {
    setLignes(prev => prev.filter(l => l.id !== ligne.id))
    if (ligne.chemin) effacerFichiers([ligne.chemin])
  }

  async function annuler() {
    await effacerFichiers(lignes.flatMap(l => (l.chemin ? [l.chemin] : [])))
    setLignes([]); setIgnores([]); setMessage(null); setOuvert(false)
  }

  const prets = lignes.filter(l => l.etat === 'pret')
  const enCours = lignes.some(l => l.etat === 'envoi' || l.etat === 'analyse')
  const sansDate = prets.filter(l => !l.date).length
  const peutEnregistrer = prets.length > 0 && !enCours && sansDate === 0 && !enregistrement

  async function enregistrer() {
    setEnregistrement(true)
    setMessage(null)
    const res = await fetch('/api/factures/importees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        factures: prets.map(l => ({
          chemin: l.chemin, nomFichier: l.nom, typeFichier: l.type, taille: l.taille,
          dateFacture: l.date, montant: l.montant.trim() ? l.montant.replace(/\s/g, '').replace(',', '.') : null,
          numero: l.numero.trim() || null,
        })),
      }),
    })
    const r = await res.json().catch(() => ({})) as { ajoutees?: number; error?: string }
    setEnregistrement(false)
    if (!res.ok) { setMessage({ ok: false, texte: r.error ?? 'L’enregistrement a échoué.' }); return }
    // Les fichiers en erreur n'ont jamais été enregistrés : on les retire du stockage.
    await effacerFichiers(lignes.filter(l => l.etat === 'erreur' && l.chemin).map(l => l.chemin as string))
    setLignes([]); setIgnores([]); setOuvert(false)
    router.refresh()
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        + Ajouter mes factures existantes
      </button>
    )
  }

  const saisie = "w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <section aria-labelledby="import-titre" className="w-full mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <h2 id="import-titre" className="text-base font-bold text-slate-900 dark:text-white">Ajouter mes factures existantes</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Vos factures <strong className="font-semibold text-slate-700 dark:text-slate-200">de vente</strong>, envoyées à vos
        clients avant WashBoard : PDF, photos (JPG, PNG) ou un fichier ZIP. Vous vérifiez la date de chacune avant de
        l&apos;enregistrer, elle se range au bon mois et garde son numéro d&apos;origine.
      </p>
      {/* Les achats n'ont rien à faire ici : ils fausseraient le total des
          ventes du mois. Leur place est dans les Dépenses de la Comptabilité. */}
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
        Factures d&apos;achat (matériel, produits, abonnements) : notez-les dans{' '}
        <Link href="/dashboard/compta" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Comptabilité → Dépenses</Link>.
        Y joindre le PDF de la facture est <span className="font-semibold">en développement</span>.
      </p>

      <label
        onDragOver={e => { e.preventDefault(); setSurvol(true) }}
        onDragLeave={() => setSurvol(false)}
        onDrop={e => { e.preventDefault(); setSurvol(false); ajouter(e.dataTransfer.files) }}
        className={`mt-4 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors ${
          survol ? 'border-[#1651E8] bg-blue-50 dark:bg-blue-950/30' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400'
        }`}
      >
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Glissez vos fichiers ici, ou cliquez pour les choisir</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">10 Mo par fichier · ZIP jusqu&apos;à 100 Mo · {LIMITES.nombreFichiers} factures maximum</span>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.zip,application/pdf,image/jpeg,image/png,application/zip"
          className="sr-only"
          onChange={e => { if (e.target.files) ajouter(e.target.files); e.target.value = '' }}
        />
      </label>

      {ignores.length > 0 && (
        <ul className="mt-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 space-y-0.5">
          {ignores.map((t, i) => <li key={i}>Ignoré — {t}</li>)}
        </ul>
      )}

      {lignes.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800 border-y border-slate-100 dark:border-slate-800">
          {lignes.map(l => {
            const aVerifier = l.etat === 'pret' && (!l.source || l.source === 'metadonnees' || l.source === 'fichier')
            return (
              <li key={l.id} className="py-3 flex flex-wrap items-start gap-x-3 gap-y-2">
                <div className="flex-1 min-w-[12rem]">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 break-all">{l.nom}</p>
                  <p className={`text-xs mt-0.5 ${l.etat === 'erreur' ? 'text-red-600 dark:text-red-400' : aVerifier ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {l.etat === 'envoi' && 'Envoi…'}
                    {l.etat === 'analyse' && 'Lecture de la date…'}
                    {l.etat === 'erreur' && l.erreur}
                    {l.etat === 'pret' && (l.source ? SOURCES[l.source] : 'Date introuvable : à saisir')}
                  </p>
                </div>
                {l.etat === 'pret' && (
                  <>
                    <label className="w-32">
                      <span className="sr-only">Numéro d&apos;origine de la facture {l.nom} (facultatif)</span>
                      <input
                        type="text" placeholder="N° facture" maxLength={40}
                        value={l.numero} onChange={e => maj(l.id, { numero: e.target.value })} className={saisie}
                      />
                    </label>
                    <label className="w-36">
                      <span className="sr-only">Date de la facture {l.nom}</span>
                      <input type="date" required value={l.date} onChange={e => maj(l.id, { date: e.target.value })} className={saisie} />
                    </label>
                    <label className="w-28">
                      <span className="sr-only">Montant TTC de la facture {l.nom} (facultatif)</span>
                      <input
                        type="text" inputMode="decimal" placeholder="Montant €"
                        value={l.montant} onChange={e => maj(l.id, { montant: e.target.value })} className={saisie}
                      />
                    </label>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => retirer(l)}
                  aria-label={`Retirer ${l.nom}`}
                  className="px-2 py-1.5 text-sm text-slate-400 hover:text-red-600 transition-colors"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {message && <p className={`mt-3 text-sm font-medium ${message.ok ? 'text-emerald-600' : 'text-red-600 dark:text-red-400'}`}>{message.texte}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={enregistrer}
          disabled={!peutEnregistrer}
          className="px-4 py-2.5 bg-[#1651E8] hover:bg-[#1244c4] text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
        >
          {enregistrement ? 'Enregistrement…' : `Enregistrer ${prets.length} facture${prets.length > 1 ? 's' : ''}`}
        </button>
        <button
          type="button"
          onClick={annuler}
          className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Annuler
        </button>
        {enCours && <span className="text-xs text-slate-500 dark:text-slate-400">Envoi en cours…</span>}
        {!enCours && sansDate > 0 && <span className="text-xs text-amber-600 dark:text-amber-400">Il manque la date de {sansDate} facture{sansDate > 1 ? 's' : ''}.</span>}
      </div>
    </section>
  )
}

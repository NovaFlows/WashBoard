'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronDown, ChevronRight, Flag, Search, X } from 'lucide-react'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import type { Noeud, Signal } from '@/lib/arbreParrainage'
import { STATUTS_FILLEUL } from '@/components/dashboard/ParrainageV2'
import EcranEquipe, { Carte, Section } from './EcranEquipe'

type Arbre = { racines: Noeud[]; total: number; recompenses: number }
type NoeudPlat = Noeud & { ligneId?: string; signaux?: Signal[]; chemin: string; profondeur: number; parrainNom?: string; parrainId?: string }

const LIBELLE_SIGNAL: Record<Signal, string> = {
  meme_connexion: 'Même connexion',
  meme_siret: 'Même SIRET',
  recompenses_rapprochees: 'Gains rapprochés',
}
const NIVEAUX_DECALES = 3

function sansAccent(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Chaque nœud avec son chemin (« 0.2.1 ») : sert au dépliage et à la recherche. */
function aplatir(racines: Noeud[]): NoeudPlat[] {
  const tous: NoeudPlat[] = []
  const visiter = (n: Noeud & { ligneId?: string; signaux?: Signal[] }, chemin: string, profondeur: number, parrain?: Noeud) => {
    tous.push({ ...n, chemin, profondeur, parrainNom: parrain?.nom, parrainId: parrain?.id })
    n.filleuls.forEach((f, i) => visiter(f, `${chemin}.${i}`, profondeur + 1, n))
  }
  racines.forEach((r, i) => visiter(r, String(i), 0))
  return tous
}

function aVerifier(n: Noeud): boolean {
  return n.filleuls.some(f => f.signaux.length > 0 || aVerifier(f))
}

export default function ArbreParrainagesV2({ arbre, rechercheInitiale = '' }: { arbre: Arbre; rechercheInitiale?: string }) {
  const router = useRouter()
  const tous = useMemo(() => aplatir(arbre.racines), [arbre])
  const [saisie, setSaisie] = useState(rechercheInitiale)
  const [cherche, setCherche] = useState('')
  const [filtre, setFiltre] = useState(false)
  const [ouverts, setOuverts] = useState<Set<string>>(new Set())
  const [masques, setMasques] = useState<Set<string>>(new Set())
  const liste = useRef<HTMLDivElement>(null)

  const signales = tous.filter(n => n.signaux?.length && n.ligneId && !masques.has(n.ligneId))

  function lancerRecherche(texte: string) {
    const q = sansAccent(texte.trim())
    setCherche(q)
    const ouvrir = new Set<string>()
    if (q) {
      for (const n of tous) {
        if (!sansAccent(n.nom).includes(q)) continue
        const p = n.chemin.split('.')
        for (let i = 1; i < p.length; i++) ouvrir.add(p.slice(0, i).join('.'))
      }
    }
    setOuverts(ouvrir)
    requestAnimationFrame(() => liste.current?.querySelector('[data-trouve]')?.scrollIntoView({ block: 'center' }))
  }

  useEffect(() => {
    if (rechercheInitiale) lancerRecherche(rechercheInitiale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const trouves = cherche ? tous.filter(n => sansAccent(n.nom).includes(cherche)).length : 0

  function visible(n: Noeud & { signaux?: Signal[] }): boolean {
    return !filtre || !!n.signaux?.length || n.filleuls.some(visible)
  }
  function estOuvert(chemin: string) {
    return filtre ? !ouverts.has(`ferme:${chemin}`) : ouverts.has(chemin)
  }
  function basculer(chemin: string) {
    setOuverts(prev => {
      const s = new Set(prev)
      const cle = filtre ? `ferme:${chemin}` : chemin
      if (s.has(cle)) s.delete(cle); else s.add(cle)
      return s
    })
  }

  async function cestNormal(lignes: string[]) {
    setMasques(prev => new Set([...prev, ...lignes]))
    const res = await fetch('/api/support/parrainages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lignes }),
    }).catch(() => null)
    if (!res?.ok) setMasques(prev => { const s = new Set(prev); lignes.forEach(l => s.delete(l)); return s })
    else router.refresh()
  }

  const ligne = (n: Noeud & { ligneId?: string; signaux?: Signal[] }, chemin: string, profondeur: number): React.ReactNode => {
    if (!visible(n)) return null
    const enfants = n.filleuls.filter(visible)
    const ouvert = enfants.length > 0 && estOuvert(chemin)
    const trouve = !!cherche && sansAccent(n.nom).includes(cherche)
    const st = STATUTS_FILLEUL[n.statut]
    const clients = n.filleuls.filter(f => f.statut === 'client').length
    const signaux = n.ligneId && masques.has(n.ligneId) ? [] : (n.signaux ?? [])
    return (
      <li key={chemin}>
        <div
          data-trouve={trouve || undefined}
          className={`flex items-start gap-1 rounded-[10px] py-1.5 pr-1 ${trouve ? 'bg-[color:color-mix(in_srgb,var(--v2-color-accent)_10%,transparent)]' : ''}`}
        >
          {enfants.length > 0 ? (
            <button type="button" onClick={() => basculer(chemin)} aria-expanded={ouvert} aria-label={`${ouvert ? 'Replier' : 'Déplier'} ${n.nom}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] hover:bg-[color:var(--v2-filet)]">
              {ouvert ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
          ) : <span className="w-9 shrink-0" />}
          <div className="min-w-0 flex-1 pt-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/dashboard/support/laveurs/${n.id}`} className={`min-w-0 truncate text-[15px] ${corpsFort} hover:underline`}>{n.nom}</Link>
              <span className={`inline-flex shrink-0 items-center gap-1.5 text-[13px] ${corpsFort}`} style={{ color: st.couleur }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.couleur }} aria-hidden />{st.libelle}
              </span>
            </div>
            <div className={`mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {n.filleuls.length > 0 && <span>a parrainé {n.filleuls.length} · {clients ? `${clients} client${clients > 1 ? 's' : ''}` : 'aucun client'}</span>}
              {signaux.map(s => (
                <span key={s} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${corpsFort}`} style={{ color: 'var(--v2-color-ambre)', background: 'color-mix(in srgb, var(--v2-color-ambre) 14%, transparent)' }}>
                  <Flag size={12} aria-hidden />{LIBELLE_SIGNAL[s]}
                </span>
              ))}
              {profondeur >= NIVEAUX_DECALES && <span className="rounded-full bg-[color:var(--v2-filet)] px-2 py-0.5">niveau {profondeur + 1}</span>}
              {!ouvert && aVerifier(n) && (
                <span className={`inline-flex items-center gap-1 ${corpsFort}`} style={{ color: 'var(--v2-color-ambre)' }}><Flag size={12} aria-hidden />à vérifier à l’intérieur</span>
              )}
            </div>
          </div>
        </div>
        {ouvert && (
          <ul className={profondeur + 1 < NIVEAUX_DECALES ? 'ml-[18px] border-l border-[color:var(--v2-filet)] pl-2' : ''}>
            {enfants.map(f => ligne(f, `${chemin}.${n.filleuls.indexOf(f)}`, profondeur + 1))}
          </ul>
        )}
      </li>
    )
  }

  // Cartes « À vérifier » : une par filleul signalé, une seule par parrain pour les gains rapprochés.
  const cartes: { cle: string; titre: string; texte: string; ficheId: string; lignes: string[] }[] = []
  const rapproches = new Map<string, NoeudPlat[]>()
  for (const n of signales) {
    for (const s of n.signaux!) {
      if (s === 'recompenses_rapprochees') {
        rapproches.set(n.parrainId!, [...(rapproches.get(n.parrainId!) ?? []), n])
      } else {
        cartes.push({
          cle: `${s}:${n.ligneId}`,
          titre: s === 'meme_connexion' ? 'Même connexion à l’inscription' : 'Même SIRET',
          texte: s === 'meme_connexion'
            ? `${n.nom} s’est inscrit depuis la même connexion que son parrain, ${n.parrainNom}.`
            : `${n.nom} et son parrain ${n.parrainNom} ont le même numéro de SIRET.`,
          ficheId: n.id,
          lignes: [n.ligneId!],
        })
      }
    }
  }
  for (const [parrainId, fils] of rapproches) {
    const nom = fils[0].parrainNom
    cartes.push({
      cle: `rapproches:${parrainId}`,
      titre: 'Plus de 3 mois gagnés en 30 jours',
      texte: `${nom} a gagné ${fils.length} mois en 30 jours.`,
      ficheId: parrainId,
      lignes: fils.map(f => f.ligneId!),
    })
  }

  return (
    <EcranEquipe titre="Parrainages" sousTitre="Qui a parrainé qui, et ce qu’il y a à vérifier." retour={{ href: '/dashboard/support', label: 'Équipe' }}>
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { v: arbre.total, l: arbre.total > 1 ? 'laveurs parrainés' : 'laveur parrainé' },
          { v: arbre.recompenses, l: arbre.recompenses > 1 ? 'mois offerts' : 'mois offert' },
          { v: cartes.length, l: 'à vérifier', ambre: cartes.length > 0 },
        ].map(x => (
          <Carte key={x.l} className="px-3.5 py-3">
            <p className={`text-[26px] leading-none ${corpsFort} tabular-nums`} style={x.ambre ? { color: 'var(--v2-color-ambre)' } : undefined}>{x.v}</p>
            <p className={`mt-1 text-[12.5px] leading-tight ${corps} text-[color:var(--v2-color-gris)]`}>{x.l}</p>
          </Carte>
        ))}
      </div>

      <Section titre="Arbre des parrainages">
        <div className="space-y-2.5">
          <form onSubmit={e => { e.preventDefault(); lancerRecherche(saisie) }} className="relative" role="search">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--v2-color-gris)]" aria-hidden />
            <input
              type="search"
              enterKeyHint="search"
              value={saisie}
              onChange={e => { setSaisie(e.target.value); if (!e.target.value && cherche) { setCherche(''); setOuverts(new Set()) } }}
              placeholder="Rechercher un laveur"
              aria-label="Rechercher un laveur"
              className={`h-11 w-full rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] pl-10 pr-10 text-[16px] ${corps} focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`}
            />
            {saisie && (
              <button type="button" aria-label="Effacer" onClick={() => { setSaisie(''); setCherche(''); setOuverts(new Set()) }} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-[color:var(--v2-color-gris)]">
                <X size={16} />
              </button>
            )}
          </form>
          <button type="button" aria-pressed={filtre} onClick={() => { setFiltre(f => !f); setOuverts(new Set()) }}
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[14px] ${corpsFort} ${filtre ? 'border-[color:var(--v2-color-ambre)] text-[color:var(--v2-color-ambre)]' : 'border-[color:var(--v2-filet-fort)]'}`}>
            <Flag size={15} aria-hidden />À vérifier seulement
          </button>
          <p className={`min-h-[18px] text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`} aria-live="polite">
            {cherche
              ? (trouves ? `${trouves} laveur${trouves > 1 ? 's' : ''} trouvé${trouves > 1 ? 's' : ''}, arbre ouvert sur ${trouves > 1 ? 'eux' : 'lui'}.` : 'Aucun laveur ne s’appelle comme ça.')
              : filtre ? 'Seuls les laveurs à vérifier sont affichés, avec les parrains qui les relient.' : ''}
          </p>
          <Carte className="px-2 py-1.5">
            <div ref={liste}>
              {arbre.racines.length === 0
                ? <p className={`px-2 py-4 text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>Aucun parrainage pour l’instant.</p>
                : <ul>{arbre.racines.map((r, i) => ligne(r, String(i), 0))}</ul>}
            </div>
          </Carte>
        </div>
      </Section>

      {cartes.length > 0 && (
        <Section titre="À vérifier">
          <div className="space-y-2.5">
            {cartes.map(c => (
              <Carte key={c.cle} className="px-4 py-3.5">
                <p className={`flex items-center gap-2 text-[14.5px] ${corpsFort}`}>
                  <AlertTriangle size={16} style={{ color: 'var(--v2-color-ambre)' }} aria-hidden />{c.titre}
                </p>
                <p className={`mt-1 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{c.texte}</p>
                <div className="mt-3 flex items-center gap-4">
                  <Link href={`/dashboard/support/laveurs/${c.ficheId}`} className={`inline-flex h-10 items-center rounded-[var(--v2-radius-bouton)] px-4 text-[14px] ${corpsFort} text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)' }}>
                    Voir la fiche
                  </Link>
                  <button type="button" onClick={() => void cestNormal(c.lignes)} className={`text-[14px] ${corps} underline underline-offset-[3px]`}>C’est normal</button>
                </div>
              </Carte>
            ))}
          </div>
        </Section>
      )}
    </EcranEquipe>
  )
}

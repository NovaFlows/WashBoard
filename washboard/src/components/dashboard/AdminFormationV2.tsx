'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { corps, corpsFort, titre, CHAMP, ETIQUETTE, BOUTON, puce } from '@/components/dashboard/FeuilleV2'
import { TitreSection } from '@/components/dashboard/ParametresFormV2'
import FormationEnveloppeV2 from '@/components/dashboard/FormationEnveloppeV2'
import { createClient } from '@/lib/supabase/client'
import { NIVEAUX, dureeTexte, prixTexte, type Lecon, type NiveauFormation, type PackFormation, type TypeLecon } from '@/lib/formation'
import { BUCKET_VIDEOS, TAILLE_MAX_VIDEO_MO, TYPES_VIDEO_ACCEPTES } from '@/lib/formationAdmin'

// Gestion de la formation (branche feat/formation, 2026-11-11) : réservée aux administrateurs
// (`FORMATION_ADMIN_USER_IDS`). Créer un pack, le remplir, ajouter des leçons, y déposer des
// vidéos, publier. Chaque modification part vers `/api/formation/admin` ; la page se rafraîchit
// ensuite pour relire la base (une seule source de vérité, pas d'état local qui diverge).

const CARTE = 'rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)]'
const SECONDAIRE = `flex h-10 items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] px-3 text-[14px] ${corpsFort} text-[color:var(--v2-color-encre)] disabled:opacity-50`
const PRIMAIRE = `${BOUTON} bg-[color:var(--v2-color-accent)] text-[color:var(--v2-color-sur-accent)]`
const TYPES: { id: TypeLecon; label: string }[] = [
  { id: 'video', label: 'Vidéo' }, { id: 'lecture', label: 'Lecture' }, { id: 'quiz', label: 'Quiz' },
]

async function appeler(corpsRequete: Record<string, unknown>): Promise<{ ok: boolean; erreur?: string; [k: string]: unknown }> {
  try {
    const r = await fetch('/api/formation/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpsRequete),
    })
    const j = await r.json().catch(() => ({}))
    return r.ok ? { ok: true, ...j } : { ok: false, erreur: j.error ?? 'Échec de la requête.' }
  } catch {
    return { ok: false, erreur: 'Connexion impossible.' }
  }
}

/** Durée d'une vidéo lue localement, avant envoi : évite de la saisir à la main. */
function dureeDuFichier(fichier: File): Promise<number | null> {
  return new Promise(resolve => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(fichier)
    v.preload = 'metadata'
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : null) }
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    v.src = url
  })
}

function LigneLecon({ lecon, module, onChange }: { lecon: Lecon; module: string; onChange: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  const [titreL, setTitreL] = useState(lecon.titre)
  const [moduleL, setModuleL] = useState(module)
  const [minutes, setMinutes] = useState(String(Math.round(lecon.dureeSec / 60)))
  const [type, setType] = useState<TypeLecon>(lecon.type)
  const [apercu, setApercu] = useState(!!lecon.apercuGratuit)
  const [etat, setEtat] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const fichier = useRef<HTMLInputElement>(null)

  async function enregistrer() {
    setOccupe(true); setEtat(null)
    const r = await appeler({
      action: 'lecon.maj', id: lecon.id,
      champs: { titre: titreL, module_titre: moduleL, duree_sec: Math.round(Number(minutes) * 60) || 0, type, apercu_gratuit: apercu },
    })
    setOccupe(false)
    if (!r.ok) return setEtat(r.erreur ?? 'Échec.')
    setEtat('Enregistré.'); onChange()
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer la leçon « ${lecon.titre} » et sa vidéo ?`)) return
    setOccupe(true)
    const r = await appeler({ action: 'lecon.supprimer', id: lecon.id })
    setOccupe(false)
    if (!r.ok) return setEtat(r.erreur ?? 'Échec.')
    onChange()
  }

  async function envoyer(f: File) {
    setEtat(null)
    if (!TYPES_VIDEO_ACCEPTES.includes(f.type)) return setEtat('Format refusé : MP4, WebM ou MOV.')
    const tailleMo = f.size / (1024 * 1024)
    if (tailleMo > TAILLE_MAX_VIDEO_MO) return setEtat(`Vidéo trop lourde (${TAILLE_MAX_VIDEO_MO} Mo maximum).`)
    setOccupe(true); setEtat(`Envoi de « ${f.name} » (${Math.round(tailleMo)} Mo)…`)
    const prep = await appeler({ action: 'video.preparer', leconId: lecon.id, nom: f.name, type: f.type, tailleMo })
    if (!prep.ok) { setOccupe(false); return setEtat(prep.erreur ?? 'Échec.') }
    const { error } = await createClient().storage.from(BUCKET_VIDEOS)
      .uploadToSignedUrl(String(prep.chemin), String(prep.jeton), f, { contentType: f.type })
    if (error) { setOccupe(false); return setEtat(`Envoi interrompu : ${error.message}`) }
    const duree = await dureeDuFichier(f)
    const fin = await appeler({ action: 'video.rattacher', leconId: lecon.id, chemin: prep.chemin, dureeSec: duree })
    setOccupe(false)
    if (!fin.ok) return setEtat(fin.erreur ?? 'Échec.')
    setEtat('Vidéo en ligne.'); onChange()
  }

  async function retirer() {
    if (!window.confirm('Retirer la vidéo de cette leçon ?')) return
    setOccupe(true)
    const r = await appeler({ action: 'video.retirer', leconId: lecon.id })
    setOccupe(false)
    if (!r.ok) return setEtat(r.erreur ?? 'Échec.')
    onChange()
  }

  return (
    <li className="py-3">
      <button type="button" onClick={() => setOuvert(o => !o)} className="flex w-full items-center gap-3 text-left" aria-expanded={ouvert}>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)]`}>{lecon.titre}</span>
          <span className={`block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {TYPES.find(t => t.id === lecon.type)?.label} · {dureeTexte(lecon.dureeSec)} · {lecon.aVideo ? 'vidéo en ligne' : lecon.type === 'video' ? 'pas de vidéo' : 'sans vidéo'}
          </span>
        </span>
        <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{ouvert ? 'Fermer' : 'Modifier'}</span>
      </button>

      {ouvert && (
        <div className="mt-3 space-y-3">
          <div><label className={ETIQUETTE}>Titre de la leçon</label><input className={CHAMP} value={titreL} onChange={e => setTitreL(e.target.value)} maxLength={140} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={ETIQUETTE}>Module</label><input className={CHAMP} value={moduleL} onChange={e => setModuleL(e.target.value)} maxLength={100} /></div>
            <div><label className={ETIQUETTE}>Durée (minutes)</label><input className={CHAMP} inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => <button key={t.id} type="button" onClick={() => setType(t.id)} className={puce(type === t.id)}>{t.label}</button>)}
            <button type="button" onClick={() => setApercu(a => !a)} className={puce(apercu)}>Aperçu gratuit</button>
          </div>

          <div className="space-y-2">
            <input
              ref={fichier} type="file" accept={TYPES_VIDEO_ACCEPTES.join(',')} className="sr-only" tabIndex={-1}
              onChange={e => { const f = e.target.files?.[0]; if (f) void envoyer(f); e.target.value = '' }}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={occupe} onClick={() => fichier.current?.click()} className={SECONDAIRE}>
                {lecon.aVideo ? 'Remplacer la vidéo' : 'Envoyer une vidéo'}
              </button>
              {lecon.aVideo && <button type="button" disabled={occupe} onClick={retirer} className={SECONDAIRE}>Retirer la vidéo</button>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" disabled={occupe} onClick={enregistrer} className={`${PRIMAIRE} flex-1`}>Enregistrer</button>
            <button type="button" disabled={occupe} onClick={supprimer} className={`${SECONDAIRE} text-[color:var(--v2-color-erreur,#b3261e)]`}>Supprimer</button>
          </div>
          {etat && <p role="status" className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{etat}</p>}
        </div>
      )}
    </li>
  )
}

function CartePackAdmin({ pack, onChange }: { pack: PackFormation; onChange: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  const [titreP, setTitreP] = useState(pack.titre)
  const [accroche, setAccroche] = useState(pack.accroche)
  const [description, setDescription] = useState(pack.description)
  const [niveau, setNiveau] = useState<NiveauFormation>(pack.niveau)
  const [prix, setPrix] = useState(String(pack.prixCents / 100))
  const [objectifs, setObjectifs] = useState(pack.objectifs.join('\n'))
  const [nouvelle, setNouvelle] = useState('')
  const [etat, setEtat] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const packId = pack.id as string

  async function enregistrer(extra: Record<string, unknown> = {}) {
    setOccupe(true); setEtat(null)
    const r = await appeler({
      action: 'pack.maj', id: packId,
      champs: {
        titre: titreP, accroche, description, niveau,
        prix_cents: Math.round(Number(prix.replace(',', '.')) * 100) || 0,
        objectifs: objectifs.split('\n'), ...extra,
      },
    })
    setOccupe(false)
    if (!r.ok) return setEtat(r.erreur ?? 'Échec.')
    setEtat('Enregistré.'); onChange()
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer le pack « ${pack.titre} », ses leçons et ses vidéos ? Cette action est définitive.`)) return
    setOccupe(true)
    const r = await appeler({ action: 'pack.supprimer', id: packId })
    setOccupe(false)
    if (!r.ok) return setEtat(r.erreur ?? 'Échec.')
    onChange()
  }

  async function ajouterLecon() {
    if (!nouvelle.trim()) return
    setOccupe(true); setEtat(null)
    const r = await appeler({ action: 'lecon.ajouter', packId, champs: { titre: nouvelle, module_titre: pack.modules.at(-1)?.titre ?? 'Module 1', type: 'video' } })
    setOccupe(false)
    if (!r.ok) return setEtat(r.erreur ?? 'Échec.')
    setNouvelle(''); onChange()
  }

  const publie = !pack.brouillon
  const nbLecons = pack.modules.reduce((n, m) => n + m.lecons.length, 0)

  return (
    <div className={CARTE}>
      <button type="button" onClick={() => setOuvert(o => !o)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={ouvert}>
        <span className="min-w-0 flex-1">
          <span className={`block text-[16px] leading-snug ${titre}`}>{pack.titre}</span>
          <span className={`block text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {publie ? 'Publié' : 'Brouillon'} · {nbLecons} leçon{nbLecons > 1 ? 's' : ''} · {prixTexte(pack.prixCents)}
          </span>
        </span>
        <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{ouvert ? 'Fermer' : 'Modifier'}</span>
      </button>

      {ouvert && (
        <div className="space-y-4 border-t border-[color:var(--v2-filet)] p-4">
          <div><label className={ETIQUETTE}>Titre</label><input className={CHAMP} value={titreP} onChange={e => setTitreP(e.target.value)} maxLength={120} /></div>
          <div><label className={ETIQUETTE}>Accroche (une phrase)</label><input className={CHAMP} value={accroche} onChange={e => setAccroche(e.target.value)} maxLength={200} /></div>
          <div>
            <label className={ETIQUETTE}>Description</label>
            <textarea className={`${CHAMP} h-28 py-2`} value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} />
          </div>
          <div>
            <label className={ETIQUETTE}>Ce que le laveur saura faire (une ligne par objectif, 6 maximum)</label>
            <textarea className={`${CHAMP} h-24 py-2`} value={objectifs} onChange={e => setObjectifs(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={ETIQUETTE}>Prix TTC (€, 0 = inclus)</label><input className={CHAMP} inputMode="decimal" value={prix} onChange={e => setPrix(e.target.value)} /></div>
            <div>
              <label className={ETIQUETTE}>Niveau</label>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {(Object.keys(NIVEAUX) as NiveauFormation[]).map(n => <button key={n} type="button" onClick={() => setNiveau(n)} className={puce(niveau === n)}>{NIVEAUX[n]}</button>)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={occupe} onClick={() => enregistrer({ statut: pack.statut === 'disponible' ? 'bientot' : 'disponible' })} className={puce(pack.statut === 'disponible')}>
              {pack.statut === 'disponible' ? 'Achetable' : 'Bientôt disponible'}
            </button>
          </div>

          <div>
            <TitreSection>Leçons</TitreSection>
            {nbLecons === 0 ? (
              <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Aucune leçon pour l’instant.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--v2-filet)]">
                {pack.modules.flatMap(m => m.lecons.map(l => <LigneLecon key={l.id} lecon={l} module={m.titre} onChange={onChange} />))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <input className={CHAMP} placeholder="Titre de la nouvelle leçon" value={nouvelle} onChange={e => setNouvelle(e.target.value)} maxLength={140} />
              <button type="button" disabled={occupe || !nouvelle.trim()} onClick={ajouterLecon} className={`${SECONDAIRE} shrink-0`}>Ajouter</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={occupe} onClick={() => enregistrer()} className={`${PRIMAIRE} flex-1`}>Enregistrer</button>
            <button type="button" disabled={occupe} onClick={() => enregistrer({ publie: !publie })} className={SECONDAIRE}>
              {publie ? 'Repasser en brouillon' : 'Publier'}
            </button>
            <button type="button" disabled={occupe} onClick={supprimer} className={SECONDAIRE}>Supprimer</button>
          </div>
          {etat && <p role="status" className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{etat}</p>}
        </div>
      )}
    </div>
  )
}

export default function AdminFormationV2({ packs }: { packs: PackFormation[] }) {
  const router = useRouter()
  const [nouveau, setNouveau] = useState('')
  const [etat, setEtat] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const rafraichir = () => router.refresh()

  async function creer() {
    if (!nouveau.trim()) return
    setOccupe(true); setEtat(null)
    const r = await appeler({ action: 'pack.creer', champs: { titre: nouveau } })
    setOccupe(false)
    if (!r.ok) return setEtat(r.erreur ?? 'Échec.')
    setNouveau(''); rafraichir()
  }

  return (
    <FormationEnveloppeV2
      titre="Gérer la formation"
      sousTitre="Packs, leçons et vidéos : visibles des laveurs une fois publiés"
      retour={{ href: '/dashboard/formation', label: 'Formation' }}
    >
      <div className={`${CARTE} space-y-3 p-4`}>
        <label className={ETIQUETTE} htmlFor="nouveau-pack">Nouveau pack de formation</label>
        <div className="flex gap-2">
          <input id="nouveau-pack" className={CHAMP} placeholder="Titre du pack" value={nouveau} onChange={e => setNouveau(e.target.value)} maxLength={120} />
          <button type="button" disabled={occupe || !nouveau.trim()} onClick={creer} className={`${SECONDAIRE} shrink-0`}>Créer</button>
        </div>
        {etat && <p role="status" className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{etat}</p>}
      </div>

      {packs.length === 0 ? (
        <p className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>
          Aucun pack pour l’instant. Créez le premier ci-dessus : il restera en brouillon, invisible des laveurs, jusqu’à sa publication.
        </p>
      ) : (
        <div className="space-y-3">{packs.map(p => <CartePackAdmin key={p.id ?? p.slug} pack={p} onChange={rafraichir} />)}</div>
      )}

      <p className={`px-0.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        Les vidéos sont stockées dans un espace privé et ne sont lues qu’avec un lien signé, valable une heure, marqué au nom du laveur.
      </p>
    </FormationEnveloppeV2>
  )
}

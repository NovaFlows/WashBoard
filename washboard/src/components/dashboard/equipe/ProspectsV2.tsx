'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AtSign, Phone, Plus } from 'lucide-react'
import { Feuille, BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort, puce } from '@/components/dashboard/FeuilleV2'
import { Constat, ConfirmationSuppression, TEXTE_ROUGE, nom as styleNom } from '@/components/dashboard/PrestationsUiV2'
import { Chevron } from '@/components/dashboard/ParametresFormV2'
import { dateCourte, ilYa } from '@/lib/ficheLaveur'
import { aujourdhuiParis } from '@/lib/suiviAppels'
import { ARCHIVE_APRES_JOURS, LIBELLE_ONGLET, LIBELLE_STATUT, ONGLETS, STATUTS, ongletDe, type Onglet, type Prospect, type StatutProspect } from '@/lib/prospects'
import EcranEquipe, { Carte, Initiales, Section } from './EcranEquipe'
import ChoixDate, { dateJour } from './ChoixDate'

// Zone Prospects de l'espace équipe (2026-11-06). Les messages Instagram envoyés
// arrivent seuls (agent prospection) ; les réponses aussi, dans « À trier », et c'est
// l'équipe qui décide : intéressé ou pas. Les prospects eus au téléphone s'ajoutent
// à la main (ou par l'agent suivi client) dans « En discussion », avec une date de rappel.

const LISTE = 'overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)]'
const GRIS = `${corps} text-[color:var(--v2-color-gris)]`
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const majuscule = (s: string) => s.replace(/^./, c => c.toUpperCase())

const VIDE: Record<Onglet, string> = {
  trier: 'Aucune réponse à trier. Elles arrivent ici quand un prospect répond au message Instagram.',
  discussion: 'Personne en discussion. Ajoutez ceux que vous avez eus au téléphone avec « Ajouter ».',
  interesses: 'Aucun prospect intéressé pour l’instant.',
  contactes: 'Aucun message envoyé ces 30 derniers jours.',
  non: 'Aucun refus.',
  inscrits: 'Aucun prospect devenu client pour l’instant.',
  archives: `Les messages restés sans réponse ${ARCHIVE_APRES_JOURS} jours arrivent ici.`,
}

function lienInstagram(compte: string) { return `https://www.instagram.com/${compte}/` }

/** Envoie une modification ; renvoie le message d'erreur, ou null. */
async function envoyer(url: string, method: 'POST' | 'PATCH' | 'DELETE', corpsRequete?: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: corpsRequete ? JSON.stringify(corpsRequete) : undefined })
    if (res.ok) return null
    const r = await res.json().catch(() => ({}))
    return r.error ?? 'Enregistrement impossible. Réessayez.'
  } catch {
    return 'Enregistrement impossible. Vérifiez votre connexion.'
  }
}

// ── Fiche d'un prospect ──────────────────────────────────────────────────────

function FicheProspect({ p, now, onClose }: { p: Prospect; now: Date; onClose: () => void }) {
  const router = useRouter()
  const [rappel, setRappel] = useState(p.relancer_le ?? '')
  const [telephone, setTelephone] = useState(p.telephone ?? '')
  const [ville, setVille] = useState(p.ville ?? '')
  const [notes, setNotes] = useState(p.notes ?? '')
  const [enCours, setEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [suppression, setSuppression] = useState(false)
  const modifie = rappel !== (p.relancer_le ?? '') || telephone !== (p.telephone ?? '') || ville !== (p.ville ?? '') || notes !== (p.notes ?? '')

  async function changer(corpsRequete: Record<string, unknown>, quoi: string, fermer = false) {
    if (enCours) return
    setEnCours(quoi)
    setErreur(null)
    const echec = await envoyer(`/api/support/prospects/${p.id}`, 'PATCH', corpsRequete)
    setEnCours(null)
    if (echec) { setErreur(echec); return }
    router.refresh()
    if (fermer) onClose()
  }

  async function supprimer() {
    setEnCours('supprimer')
    setErreur(null)
    const echec = await envoyer(`/api/support/prospects/${p.id}`, 'DELETE')
    setEnCours(null)
    if (echec) { setErreur(echec); return }
    router.refresh()
    onClose()
  }

  if (suppression) {
    return (
      <ConfirmationSuppression
        titre="Supprimer ce prospect ?"
        texte={`${p.nom} disparaît de la liste.`}
        remarque={p.instagram ? 'Attention : sans lui dans la liste, rien n’empêche l’agent prospection de lui réécrire. Pour un refus, préférez « Pas intéressé ».' : undefined}
        enCours={enCours === 'supprimer'} erreur={erreur}
        onConfirmer={() => void supprimer()} onClose={() => { setSuppression(false); setErreur(null) }}
      />
    )
  }

  return (
    <Feuille
      titre={p.nom}
      sousTitre={[p.instagram && `@${p.instagram}`, p.ville].filter(Boolean).join(' · ') || undefined}
      onClose={onClose}
      pied={
        <div>
          {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <button
            type="button" disabled={!modifie || !!enCours}
            onClick={() => void changer({ relancer_le: rappel || null, telephone, ville, notes }, 'enregistrer')}
            className={`${BOUTON} w-full text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            {enCours === 'enregistrer' ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {(p.instagram || p.telephone) && (
          <div className="flex gap-2.5">
            {p.instagram && (
              <a href={lienInstagram(p.instagram)} target="_blank" rel="noopener noreferrer" className={`${BOUTON} flex-1 gap-2 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`} style={PRESSION}>
                <AtSign size={17} strokeWidth={2} aria-hidden />Instagram
              </a>
            )}
            {p.telephone && (
              <a href={`tel:${p.telephone.replace(/\s/g, '')}`} className={`${BOUTON} flex-1 gap-2 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`} style={PRESSION}>
                <Phone size={17} strokeWidth={2} aria-hidden />Appeler
              </a>
            )}
          </div>
        )}

        {p.reponse && (
          <div>
            <p className={ETIQUETTE}>Sa réponse{p.repondu_le ? ` · ${ilYa(p.repondu_le, now)}` : ''}</p>
            <Carte className="px-4 py-3"><p className={`whitespace-pre-line text-[15px] leading-snug ${corps}`}>{p.reponse}</p></Carte>
          </div>
        )}

        {p.statut === 'a_repondu' && (
          <div className="flex gap-2.5">
            <button type="button" disabled={!!enCours} onClick={() => void changer({ statut: 'interesse' }, 'interesse', true)} className={`${BOUTON} flex-1 text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
              {enCours === 'interesse' ? '…' : 'Intéressé'}
            </button>
            <button type="button" disabled={!!enCours} onClick={() => void changer({ statut: 'pas_interesse' }, 'pas_interesse', true)} className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`} style={PRESSION}>
              {enCours === 'pas_interesse' ? '…' : 'Pas intéressé'}
            </button>
          </div>
        )}

        <div>
          <p className={ETIQUETTE}>Étape</p>
          <div className="flex flex-wrap gap-2">
            {STATUTS.map(s => (
              <button key={s} type="button" aria-pressed={p.statut === s} disabled={!!enCours} onClick={() => p.statut !== s && void changer({ statut: s }, s)} className={puce(p.statut === s)}>
                {enCours === s ? '…' : LIBELLE_STATUT[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={ETIQUETTE}>À rappeler</p>
          <ChoixDate valeur={rappel} onChange={setRappel} now={now} avecAujourdhui effacable libelleEffacer="Pas de rappel" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prospect-tel" className={ETIQUETTE}>Téléphone</label>
            <input id="prospect-tel" type="tel" inputMode="tel" value={telephone} onChange={e => setTelephone(e.target.value)} maxLength={30} className={CHAMP} />
          </div>
          <div>
            <label htmlFor="prospect-ville" className={ETIQUETTE}>Ville</label>
            <input id="prospect-ville" value={ville} onChange={e => setVille(e.target.value)} maxLength={80} className={CHAMP} />
          </div>
        </div>

        <div>
          <label htmlFor="prospect-notes" className={ETIQUETTE}>Notes</label>
          <textarea id="prospect-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} rows={3} placeholder="Ce qu’il a dit au téléphone, ce qu’il attend" className={`${CHAMP} h-auto py-2.5 leading-snug`} />
        </div>

        {p.message && (
          <div>
            <p className={ETIQUETTE}>Notre message{p.contacte_le ? ` · ${dateCourte(p.contacte_le)}` : ''}</p>
            <p className={`whitespace-pre-line text-[13.5px] leading-snug ${GRIS}`}>{p.message}</p>
          </div>
        )}

        <button type="button" onClick={() => setSuppression(true)} className={`text-[14px] ${corpsFort}`} style={{ color: TEXTE_ROUGE }}>
          Supprimer ce prospect
        </button>
      </div>
    </Feuille>
  )
}

// ── Ajouter un prospect ──────────────────────────────────────────────────────

const ETAPES_AJOUT: StatutProspect[] = ['en_discussion', 'interesse', 'contacte']

function NouveauProspect({ now, onClose }: { now: Date; onClose: () => void }) {
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [instagram, setInstagram] = useState('')
  const [telephone, setTelephone] = useState('')
  const [ville, setVille] = useState('')
  const [statut, setStatut] = useState<StatutProspect>('en_discussion')
  const [rappel, setRappel] = useState(aujourdhuiParis(now))
  const [notes, setNotes] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function ajouter() {
    if (enCours) return
    if (!nom.trim()) { setErreur('Indiquez au moins un nom.'); return }
    setEnCours(true)
    setErreur(null)
    const echec = await envoyer('/api/support/prospects', 'POST', { nom, instagram, telephone, ville, statut, notes, relancer_le: rappel || null })
    setEnCours(false)
    if (echec) { setErreur(echec); return }
    router.refresh()
    onClose()
  }

  return (
    <Feuille
      titre="Ajouter un prospect"
      onClose={onClose}
      pied={
        <div>
          {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <button type="button" onClick={() => void ajouter()} disabled={enCours} className={`${BOUTON} w-full text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
            {enCours ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="nouveau-nom" className={ETIQUETTE}>Nom</label>
          <input id="nouveau-nom" value={nom} onChange={e => setNom(e.target.value)} maxLength={120} placeholder="Nom de l’entreprise ou du laveur" className={CHAMP} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="nouveau-tel" className={ETIQUETTE}>Téléphone</label>
            <input id="nouveau-tel" type="tel" inputMode="tel" value={telephone} onChange={e => setTelephone(e.target.value)} maxLength={30} className={CHAMP} />
          </div>
          <div>
            <label htmlFor="nouveau-ig" className={ETIQUETTE}>Instagram</label>
            <input id="nouveau-ig" value={instagram} onChange={e => setInstagram(e.target.value)} autoCapitalize="none" autoCorrect="off" placeholder="@compte" className={CHAMP} />
          </div>
        </div>
        <div>
          <label htmlFor="nouveau-ville" className={ETIQUETTE}>Ville (facultatif)</label>
          <input id="nouveau-ville" value={ville} onChange={e => setVille(e.target.value)} maxLength={80} className={CHAMP} />
        </div>
        <div>
          <p className={ETIQUETTE}>Étape</p>
          <div className="flex flex-wrap gap-2">
            {ETAPES_AJOUT.map(s => <button key={s} type="button" aria-pressed={statut === s} onClick={() => setStatut(s)} className={puce(statut === s)}>{LIBELLE_STATUT[s]}</button>)}
          </div>
        </div>
        <div>
          <p className={ETIQUETTE}>À rappeler</p>
          <ChoixDate valeur={rappel} onChange={setRappel} now={now} avecAujourdhui effacable libelleEffacer="Pas de rappel" />
        </div>
        <div>
          <label htmlFor="nouveau-notes" className={ETIQUETTE}>Notes (facultatif)</label>
          <textarea id="nouveau-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} rows={3} placeholder="Ce qu’il a dit au téléphone" className={`${CHAMP} h-auto py-2.5 leading-snug`} />
        </div>
      </div>
    </Feuille>
  )
}

// ── Écran ────────────────────────────────────────────────────────────────────

export default function ProspectsV2({ prospects, actif, maintenant, ongletInitial }: { prospects: Prospect[]; actif: boolean; maintenant: number; ongletInitial?: Onglet }) {
  const now = useMemo(() => new Date(maintenant), [maintenant])
  const compte = useMemo(() => {
    const c = Object.fromEntries(ONGLETS.map(o => [o, 0])) as Record<Onglet, number>
    for (const p of prospects) c[ongletDe(p, now)]++
    return c
  }, [prospects, now])
  const [onglet, setOnglet] = useState<Onglet>(() => ongletInitial ?? (['trier', 'discussion', 'interesses'] as Onglet[]).find(o => compte[o] > 0) ?? 'contactes')
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState<string | null>(null)

  const visibles = useMemo(() => {
    const q = sansAccents(recherche.trim())
    const chiffres = recherche.replace(/\D/g, '')
    // Une recherche porte sur tous les prospects, quel que soit l'onglet.
    const liste = prospects.filter(p => q
      ? sansAccents(p.nom).includes(q) || (p.instagram ?? '').includes(q.replace(/^@/, '')) || sansAccents(p.ville ?? '').includes(q)
        || (chiffres.length >= 3 && (p.telephone ?? '').replace(/\D/g, '').includes(chiffres))
      : ongletDe(p, now) === onglet)
    const date = (p: Prospect) => p.repondu_le ?? p.contacte_le ?? p.updated_at
    return liste.sort((a, b) => onglet === 'discussion' || onglet === 'interesses'
      ? (a.relancer_le ?? '9999').localeCompare(b.relancer_le ?? '9999') || b.updated_at.localeCompare(a.updated_at)
      : date(b).localeCompare(date(a)))
  }, [prospects, onglet, recherche, now])

  const auj = aujourdhuiParis(now)
  const demain = aujourdhuiParis(new Date(maintenant + 864e5))
  const parJour = !recherche.trim() && (onglet === 'discussion' || onglet === 'interesses') ? [
    { titre: 'À rappeler aujourd’hui', liste: visibles.filter(p => p.relancer_le && p.relancer_le <= auj) },
    { titre: 'Demain', liste: visibles.filter(p => p.relancer_le === demain) },
    { titre: 'Les prochains jours', liste: visibles.filter(p => p.relancer_le && p.relancer_le > demain) },
    { titre: 'Sans date de rappel', liste: visibles.filter(p => !p.relancer_le) },
  ].filter(j => j.liste.length > 0) : null

  const detail = (p: Prospect): string => {
    const o = ongletDe(p, now)
    if (o === 'discussion' || o === 'interesses') {
      const quand = p.relancer_le ? (p.relancer_le < auj ? `En retard depuis ${dateJour(p.relancer_le)}` : p.relancer_le > demain ? majuscule(dateJour(p.relancer_le)) : null) : null
      return [quand, p.notes?.split('\n')[0]].filter(Boolean).join(' · ') || (p.reponse ? `« ${p.reponse} »` : 'Sans note')
    }
    if (o === 'trier') return p.reponse ? `« ${p.reponse} »` : 'Réponse à lire dans la messagerie'
    if (o === 'contactes' || o === 'archives') return p.contacte_le ? `Message envoyé ${ilYa(p.contacte_le, now)}` : 'Message envoyé'
    return `${LIBELLE_STATUT[p.statut]} · ${ilYa(p.updated_at, now)}`
  }

  const ligne = (p: Prospect) => (
    <li key={p.id}>
      <button type="button" onClick={() => setOuvert(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[color:var(--v2-filet)]/50">
        <Initiales nom={p.nom} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={`truncate text-[15.5px] ${styleNom}`}>{p.nom}</span>
            {recherche.trim() && <span className={`ml-auto shrink-0 text-[12px] ${GRIS}`}>{LIBELLE_STATUT[p.statut]}</span>}
          </span>
          <span className={`mt-0.5 block truncate text-[12.5px] ${GRIS}`}>
            {[p.instagram && `@${p.instagram}`, p.ville, !p.instagram && p.telephone].filter(Boolean).join(' · ') || 'Sans coordonnées'}
          </span>
          <span className={`mt-0.5 block truncate text-[12.5px] ${GRIS}`}>{detail(p)}</span>
        </span>
        <Chevron />
      </button>
    </li>
  )

  const choisi = ouvert && ouvert !== 'nouveau' ? prospects.find(p => p.id === ouvert) : null

  return (
    <EcranEquipe
      titre="Prospects"
      sousTitre={actif ? `${prospects.length} laveurs démarchés, sans compte WashBoard` : 'Laveurs démarchés, sans compte WashBoard'}
      retour={{ href: '/dashboard/support', label: 'Équipe' }}
      action={actif ? (
        <button type="button" onClick={() => setOuvert('nouveau')} className={`flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--v2-radius-pilule)] px-4 text-[14px] ${corpsFort} text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
          <Plus size={17} strokeWidth={2.2} aria-hidden />Ajouter
        </button>
      ) : undefined}
    >
      {!actif ? (
        <Constat ton="ambre">La zone Prospects n’est pas encore activée en base : il manque la table « prospects ».</Constat>
      ) : (
        <>
          <div className="space-y-3">
            <input type="search" inputMode="search" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Nom, @compte, ville, téléphone" aria-label="Rechercher un prospect" className={CHAMP} />
            {!recherche.trim() && (
              <div className="-mx-3 sm:mx-0 px-3 sm:px-0 flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Étape">
                {ONGLETS.map(o => (
                  <button key={o} type="button" aria-pressed={onglet === o} onClick={() => setOnglet(o)} className={puce(onglet === o)}>
                    {LIBELLE_ONGLET[o]} {compte[o]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {visibles.length === 0 ? (
            <p className={`px-0.5 py-4 text-[14px] leading-snug ${GRIS}`}>{recherche.trim() ? 'Aucun prospect ne correspond.' : VIDE[onglet]}</p>
          ) : parJour ? (
            parJour.map(j => (
              <Section key={j.titre} titre={`${j.titre} · ${j.liste.length}`}>
                <ul className={LISTE}>{j.liste.map(ligne)}</ul>
              </Section>
            ))
          ) : (
            <ul className={LISTE}>{visibles.map(ligne)}</ul>
          )}

          {onglet === 'trier' && !recherche.trim() && visibles.length > 0 && (
            <p className={`px-0.5 text-[12.5px] leading-snug ${GRIS}`}>Ouvrez une réponse et choisissez « Intéressé » ou « Pas intéressé ». La réponse se lit en entier dans la messagerie @washboard.fr.</p>
          )}
        </>
      )}

      {ouvert === 'nouveau' && <NouveauProspect now={now} onClose={() => setOuvert(null)} />}
      {choisi && <FicheProspect key={choisi.id} p={choisi} now={now} onClose={() => setOuvert(null)} />}
    </EcranEquipe>
  )
}

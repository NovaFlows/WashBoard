'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Feuille, BOUTON, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { PLAN_LABELS, PLAN_PRICES, yearlyPrice, type Plan } from '@/lib/plan'
import type { ParrainageFiche } from '@/lib/ficheLaveurDonnees'
import { dateCourte } from '@/lib/ficheLaveur'
import { Carte, LigneInfo, Section } from './EcranEquipe'

type Compte = {
  id: string
  name: string
  plan: string | null
  grandfathered?: boolean | null
  subscription_status?: string | null
  trial_ends_at?: string | null
  subscription_ends_at?: string | null
}

function Constat({ ton, children }: { ton: 'vert' | 'ambre' | 'rouge'; children: React.ReactNode }) {
  const couleur = `var(--v2-color-${ton})`
  return (
    <p role={ton === 'rouge' ? 'alert' : 'status'} className={`rounded-[var(--v2-radius-carte)] border px-3.5 py-3 text-[13.5px] leading-snug ${corpsFort}`} style={{ borderColor: `color-mix(in srgb, ${couleur} 30%, transparent)`, color: couleur }}>
      {children}
    </p>
  )
}

const OFFRES: Exclude<Plan, 'decouverte'>[] = ['starter', 'pro', 'business']
const estOffrePayante = (p: string | null): p is Exclude<Plan, 'decouverte'> => (OFFRES as string[]).includes(p ?? '')

function statutAbonnement(w: Compte): string {
  if (w.grandfathered) return 'Client historique'
  switch (w.subscription_status) {
    case 'active': return 'Client'
    case 'past_due': return 'Paiement en retard'
    case 'trial': return w.trial_ends_at && new Date(w.trial_ends_at) > new Date() ? 'En essai' : 'Essai terminé'
    default: return 'Essai terminé'
  }
}

/** Abonnement et parrainage du laveur, avec le bouton « Paiement reçu ». */
export default function BlocAbonnementFiche({ washer: w, parrainage }: { washer: Compte; parrainage: ParrainageFiche | null }) {
  const [ouverte, setOuverte] = useState(false)
  const payeJusquAu = w.subscription_status === 'active' || w.subscription_status === 'past_due' ? w.subscription_ends_at : null
  return (
    <Section titre="Abonnement et parrainage">
      <Carte className="px-4">
        <div className="divide-y divide-[color:var(--v2-filet)]">
          <LigneInfo libelle="Offre">{w.grandfathered ? 'Accès complet' : (estOffrePayante(w.plan) ? PLAN_LABELS[w.plan] : PLAN_LABELS.decouverte)}</LigneInfo>
          <LigneInfo libelle="Statut">{statutAbonnement(w)}</LigneInfo>
          {payeJusquAu && <LigneInfo libelle="Payé jusqu’au">{dateCourte(payeJusquAu)}</LigneInfo>}
          {!payeJusquAu && w.subscription_status === 'trial' && w.trial_ends_at && <LigneInfo libelle="Essai jusqu’au">{dateCourte(w.trial_ends_at)}</LigneInfo>}
          {parrainage && (
            <>
              <LigneInfo libelle="Parrainé par">
                {parrainage.parrain
                  ? <Link href={`/dashboard/support/laveurs/${parrainage.parrain.id}`} className={`underline underline-offset-2 ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>{parrainage.parrain.nom}</Link>
                  : 'Personne'}
              </LigneInfo>
              <LigneInfo libelle="A parrainé">
                {parrainage.filleuls === 0
                  ? 'Personne'
                  : `${parrainage.filleuls} laveur${parrainage.filleuls > 1 ? 's' : ''}, dont ${parrainage.clients} client${parrainage.clients > 1 ? 's' : ''}`}
              </LigneInfo>
              {(parrainage.parrain || parrainage.filleuls > 0) && (
                <div className="py-2.5">
                  <Link href={`/dashboard/support/parrainages?q=${encodeURIComponent(w.name)}`} className={`text-[13.5px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>
                    Voir dans l’arbre des parrainages
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
        <div className="pb-4 pt-1">
          <button type="button" onClick={() => setOuverte(true)} className={`${BOUTON} w-full text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
            Paiement reçu
          </button>
        </div>
      </Carte>
      {ouverte && <FeuillePaiement washer={w} parrain={parrainage?.parrain && !parrainage.recompenseDonnee ? parrainage.parrain.nom : null} onClose={() => setOuverte(false)} />}
    </Section>
  )
}

function depuisQuand(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  return `il y a ${Math.round(minutes / 60)} h`
}

type Resultat = { payeJusquAu: string; parrainage: { statut: string; parrain?: string } | null }

function FeuillePaiement({ washer: w, parrain, onClose }: { washer: Compte; parrain: string | null; onClose: () => void }) {
  const router = useRouter()
  const [offre, setOffre] = useState<Exclude<Plan, 'decouverte'>>(estOffrePayante(w.plan) ? w.plan : 'pro')
  const [duree, setDuree] = useState<1 | 12>(1)
  const [verifie, setVerifie] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [resultat, setResultat] = useState<Resultat | null>(null)
  const [doublon, setDoublon] = useState<{ offre: Plan; dureeMois: number; confirmeLe: string } | null>(null)
  const montant = duree === 12 ? yearlyPrice(PLAN_PRICES[offre]) : PLAN_PRICES[offre]

  async function confirmer() {
    setEnCours(true)
    setErreur(null)
    const confirmerDoublon = doublon !== null
    try {
      const res = await fetch(`/api/support/laveurs/${w.id}/paiement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offre, dureeMois: duree, confirmerDoublon }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 409 && json?.doublon) { setDoublon(json.doublon); return }
      if (!res.ok) { setErreur(json?.error ?? 'Enregistrement impossible. Réessayez.'); return }
      setResultat({ payeJusquAu: json.payeJusquAu, parrainage: json.parrainage ?? null })
      router.refresh()
    } catch {
      setErreur('Connexion impossible. Réessayez.')
    } finally {
      setEnCours(false)
    }
  }

  const choix = (actif: boolean) =>
    `flex min-h-[48px] flex-1 flex-col items-center justify-center rounded-[var(--v2-radius-bouton)] border px-2 py-1.5 text-[14px] ${corpsFort} ${actif ? 'border-[color:var(--v2-color-accent)] text-[color:var(--v2-color-accent)]' : 'border-[color:var(--v2-filet-fort)]'}`

  if (resultat) {
    const p = resultat.parrainage
    return (
      <Feuille titre="Paiement enregistré" sousTitre={w.name} onClose={onClose}
        pied={<button type="button" onClick={onClose} className={`${BOUTON} w-full border border-[color:var(--v2-filet-fort)]`} style={PRESSION}>Fermer</button>}>
        <div className="space-y-3">
          <Constat ton="vert">{`${PLAN_LABELS[offre]} actif, payé jusqu’au ${dateCourte(resultat.payeJusquAu)}.`}</Constat>
          {p?.statut === 'recompense' && p.parrain && <Constat ton="vert">{`${p.parrain} a reçu son mois offert.`}</Constat>}
          {p?.statut === 'echec' && <Constat ton="ambre">Le mois offert du parrain n’a pas pu être appliqué. Il sera réessayé cette nuit.</Constat>}
        </div>
      </Feuille>
    )
  }

  return (
    <Feuille titre="Paiement reçu" sousTitre={w.name} onClose={onClose}
      pied={
        <div className="flex gap-2.5">
          <button type="button" onClick={onClose} className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)]`} style={PRESSION}>Annuler</button>
          <button type="button" onClick={() => void confirmer()} disabled={!verifie || enCours} className={`${BOUTON} flex-[1.4] text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
            {enCours ? 'Enregistrement…' : doublon ? 'Oui, deuxième paiement' : 'Confirmer le paiement'}
          </button>
        </div>
      }>
      <div className="space-y-4">
        <div>
          <p className={`mb-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Offre payée</p>
          <div className="flex gap-2">
            {OFFRES.map(o => (
              <button key={o} type="button" aria-pressed={offre === o} onClick={() => setOffre(o)} className={choix(offre === o)}>
                {PLAN_LABELS[o]}
                <span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{PLAN_PRICES[o]} €/mois</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={`mb-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Durée payée</p>
          <div className="flex gap-2">
            <button type="button" aria-pressed={duree === 1} onClick={() => setDuree(1)} className={choix(duree === 1)}>1 mois</button>
            <button type="button" aria-pressed={duree === 12} onClick={() => setDuree(12)} className={choix(duree === 12)}>
              1 an
              <span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>1 mois offert</span>
            </button>
          </div>
        </div>
        <p className={`flex items-baseline justify-between text-[14px] ${corps}`}>
          <span className="text-[color:var(--v2-color-gris)]">Paiement à saisir</span>
          <span className={`text-[20px] ${corpsFort} tabular-nums`}>{montant} €</span>
        </p>
        {parrain && <Constat ton="ambre">{`Son parrain ${parrain} recevra 1 mois offert.`}</Constat>}
        <label className={`flex cursor-pointer items-start gap-2.5 text-[14px] ${corps}`}>
          <input type="checkbox" checked={verifie} onChange={e => setVerifie(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[color:var(--v2-color-accent)]" />
          J’ai vérifié que ce paiement vient bien de ce laveur
        </label>
        {doublon && (
          <Constat ton="rouge">{`Un paiement a déjà été confirmé ${depuisQuand(doublon.confirmeLe)} : ${PLAN_LABELS[doublon.offre]}, ${doublon.dureeMois === 12 ? '1 an' : '1 mois'}. Le confirmer encore ajoute une période de plus. Si c’est le même virement, annulez.`}</Constat>
        )}
        {erreur && <Constat ton="rouge">{erreur}</Constat>}
      </div>
    </Feuille>
  )
}

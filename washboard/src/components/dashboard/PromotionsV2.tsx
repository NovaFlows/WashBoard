'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort, puce, titre } from '@/components/dashboard/FeuilleV2'
import { CarteListe } from '@/components/dashboard/ParametresFormV2'
import { ConfirmationSuppression, Interrupteur, nom as policeNom } from '@/components/dashboard/PrestationsUiV2'
import BandeauPromotion from '@/components/booking/BandeauPromotion'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ListeReglagesV2, { type ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import { COULEURS_BANDEAU, libelleRemise, type Promotion, type TypeRemise } from '@/lib/promotion'

// « Promotions » — demande d'Alexandre, 2026-10-17 : « que le laveur puisse mettre une
// promotion pendant un temps, par exemple pour la Saint-Valentin, et que sur sa page de
// réservation, s'il le souhaite, il y ait un bandeau avec un compteur et pourquoi il y a la
// promotion. Il doit pouvoir configurer le bandeau comme il le souhaite. »
//
// Deux vues : la liste (en cours, à venir, terminées) et le formulaire, avec l'aperçu du
// bandeau tel que le client le verra. Règles de calcul : lib/promotion.ts.

const IDEES = ['Saint-Valentin', 'Fête des mères', 'Fête des pères', 'Printemps', 'Rentrée', 'Black Friday', 'Noël']

type Brouillon = {
  id: string | null
  nom: string
  type_remise: TypeRemise
  valeur: string
  debut: string
  fin: string
  toutes: boolean
  service_ids: string[]
  bandeau_actif: boolean
  bandeau_texte: string
  bandeau_couleur: string
  bandeau_compteur: boolean
}

/** ISO → valeur d'un `<input type="datetime-local">`, à l'heure du téléphone. */
function versLocal(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function nouveauBrouillon(): Brouillon {
  const debut = new Date(); debut.setMinutes(0, 0, 0); debut.setHours(debut.getHours() + 1)
  const fin = new Date(debut); fin.setDate(fin.getDate() + 7)
  return {
    id: null, nom: '', type_remise: 'pourcentage', valeur: '10', debut: versLocal(debut.toISOString()), fin: versLocal(fin.toISOString()),
    toutes: true, service_ids: [], bandeau_actif: true, bandeau_texte: '', bandeau_couleur: COULEURS_BANDEAU[0], bandeau_compteur: true,
  }
}

function depuisPromotion(p: Promotion): Brouillon {
  return {
    id: p.id, nom: p.nom, type_remise: p.type_remise, valeur: String(p.valeur).replace('.', ','),
    debut: versLocal(p.debut), fin: versLocal(p.fin),
    toutes: !p.service_ids?.length, service_ids: p.service_ids ?? [],
    bandeau_actif: p.bandeau_actif, bandeau_texte: p.bandeau_texte ?? '', bandeau_couleur: p.bandeau_couleur ?? COULEURS_BANDEAU[0],
    bandeau_compteur: p.bandeau_compteur,
  }
}

function etat(p: Pick<Promotion, 'debut' | 'fin'>, maintenant: number): { mot: string; couleur: string } {
  if (new Date(p.fin).getTime() <= maintenant) return { mot: 'Terminée', couleur: 'var(--v2-color-gris)' }
  if (new Date(p.debut).getTime() > maintenant) return { mot: 'À venir', couleur: 'var(--v2-color-ambre)' }
  return { mot: 'En cours', couleur: 'var(--v2-color-vert)' }
}

const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

export default function PromotionsV2({ slug, services, liste }: { slug: string; services: { id: string; name: string }[]; liste: ReglagesListeProps }) {
  const grandEcran = useGrandEcran()
  const [promotions, setPromotions] = useState<Promotion[] | null>(null)
  const [enAttente, setEnAttente] = useState(false)
  const [chargementErreur, setChargementErreur] = useState<string | null>(null)
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [suppression, setSuppression] = useState(false)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  // Heure figée à l'ouverture de l'écran : l'état « En cours / À venir » et l'aperçu n'ont
  // pas besoin d'être à la seconde, et un rendu doit rester pur.
  const [maintenant] = useState(() => Date.now())

  const charger = useCallback(async () => {
    try {
      const res = await fetch('/api/washer/promotions')
      const json = await res.json().catch(() => null)
      if (!res.ok) { setChargementErreur(json?.error ?? 'Impossible de charger vos promotions.'); return }
      setPromotions(json.promotions ?? [])
      setEnAttente(json.enAttente === true)
    } catch {
      setChargementErreur('Impossible de charger vos promotions. Vérifiez votre connexion.')
    }
  }, [])
  useEffect(() => { void charger() }, [charger])

  const maj = (champs: Partial<Brouillon>) => setBrouillon(b => (b ? { ...b, ...champs } : b))

  async function enregistrer() {
    if (!brouillon || enregistrement) return
    setErreur(null)
    const valeur = Number(brouillon.valeur.replace(',', '.'))
    if (!brouillon.nom.trim()) { setErreur('Donnez un nom à la promotion.'); return }
    if (!(valeur > 0)) { setErreur('Indiquez le montant de la remise.'); return }
    if (!brouillon.debut || !brouillon.fin) { setErreur('Indiquez le début et la fin.'); return }
    if (!brouillon.toutes && !brouillon.service_ids.length) { setErreur('Choisissez au moins une prestation, ou « Toutes ».'); return }
    setEnregistrement(true)
    const corpsRequete = {
      nom: brouillon.nom.trim(),
      type_remise: brouillon.type_remise,
      valeur,
      debut: new Date(brouillon.debut).toISOString(),
      fin: new Date(brouillon.fin).toISOString(),
      service_ids: brouillon.toutes ? null : brouillon.service_ids,
      bandeau_actif: brouillon.bandeau_actif,
      bandeau_texte: brouillon.bandeau_texte.trim() || null,
      bandeau_couleur: brouillon.bandeau_couleur,
      bandeau_compteur: brouillon.bandeau_compteur,
    }
    try {
      const res = await fetch(brouillon.id ? `/api/washer/promotions/${brouillon.id}` : '/api/washer/promotions', {
        method: brouillon.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpsRequete),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) { setErreur(json?.error ?? 'Enregistrement impossible. Réessayez.'); return }
      setBrouillon(null)
      await charger()
    } catch {
      setErreur('Enregistrement impossible. Vérifiez votre connexion.')
    } finally {
      setEnregistrement(false)
    }
  }

  async function supprimer() {
    if (!brouillon?.id) return
    setSuppressionEnCours(true)
    setErreur(null)
    try {
      const res = await fetch(`/api/washer/promotions/${brouillon.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => null)
      if (!res.ok) { setErreur(json?.error ?? 'Suppression impossible. Réessayez.'); return }
      setSuppression(false)
      setBrouillon(null)
      await charger()
    } catch {
      setErreur('Suppression impossible. Vérifiez votre connexion.')
    } finally {
      setSuppressionEnCours(false)
    }
  }

  const enTete = (intitule: string, sousTitre: string, retour: () => void, lienRetour?: string) => (
    <div className="flex items-center gap-1 pb-3">
      {lienRetour ? (
        <Link href={lienRetour} aria-label="Retour à Plus" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]">
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
      ) : (
        <button type="button" onClick={retour} aria-label="Retour aux promotions" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]">
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className={`text-[24px] leading-none ${titre}`}>{intitule}</h1>
        <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</p>
      </div>
    </div>
  )

  // ── Vue liste ──────────────────────────────────────────────────────────
  const vueListe = (
    <>
      {enTete('Promotions', 'Une remise pendant une période, annoncée sur votre page', () => {}, '/dashboard/parametres')}

      {chargementErreur && <Constat>{chargementErreur}</Constat>}
      {enAttente && <Constat>Les promotions arrivent très bientôt sur votre compte. Réessayez dans quelques minutes.</Constat>}

      {promotions && promotions.length > 0 && (
        <CarteListe>
          <ul className="divide-y divide-[color:var(--v2-filet)]">
            {promotions.map(p => {
              const e = etat(p, maintenant)
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => { setErreur(null); setBrouillon(depuisPromotion(p)) }} className="flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`truncate text-[15.5px] ${policeNom}`}>{p.nom} <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>{libelleRemise({ ...p, valeur: Number(p.valeur) })}</span></span>
                      <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Du {dateCourte(p.debut)} au {dateCourte(p.fin)}</span>
                    </span>
                    <span className={`flex shrink-0 items-center gap-1.5 text-[13px] ${corpsFort}`} style={{ color: e.couleur }}>
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: e.couleur }} aria-hidden />{e.mot}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </CarteListe>
      )}

      {promotions && promotions.length === 0 && !enAttente && (
        <p className={`px-0.5 pb-4 text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
          Aucune promotion pour l’instant. Préparez-en une à l’avance : elle s’affichera toute seule le jour venu, et disparaîtra à la fin.
        </p>
      )}

      {promotions && !enAttente && (
        <button type="button" onClick={() => { setErreur(null); setBrouillon(nouveauBrouillon()) }} className={`${BOUTON} mt-4 w-full `} style={{ background: 'var(--v2-color-accent)', color: 'var(--v2-color-sur-accent)', ...PRESSION }}>
          Nouvelle promotion
        </button>
      )}
    </>
  )

  // ── Vue formulaire ─────────────────────────────────────────────────────
  const b = brouillon
  const apercu = b && {
    nom: b.nom.trim() || 'Votre promotion',
    type_remise: b.type_remise,
    valeur: Number(b.valeur.replace(',', '.')) || 0,
    // Une fin déjà passée masquerait l'aperçu : il montre alors un compte à rebours d'un jour.
    fin: b.fin && new Date(b.fin).getTime() > maintenant ? new Date(b.fin).toISOString() : new Date(maintenant + 86400000).toISOString(),
    service_ids: null,
    bandeau_actif: true,
    bandeau_texte: b.bandeau_texte.trim() || null,
    bandeau_couleur: b.bandeau_couleur,
    bandeau_compteur: b.bandeau_compteur,
  }

  const vueFormulaire = b && (
    <>
      {enTete(b.id ? 'Modifier la promotion' : 'Nouvelle promotion', 'Elle s’applique aux réservations prises pendant la période', () => setBrouillon(null))}

      <div className="flex flex-col gap-[22px]">
        <section className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
          <label htmlFor="promo-nom" className={ETIQUETTE}>Pourquoi cette promotion ?</label>
          <input id="promo-nom" className={CHAMP} value={b.nom} maxLength={60} placeholder="Saint-Valentin" onChange={e => maj({ nom: e.target.value })} />
          <div className="-mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-1">
            {IDEES.map(i => (
              <button key={i} type="button" onClick={() => maj({ nom: i })} className={puce(b.nom === i)}>{i}</button>
            ))}
          </div>

          <p className={`${ETIQUETTE} mt-5`}>Remise</p>
          <div className="flex gap-2.5">
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => maj({ type_remise: 'pourcentage' })} className={puce(b.type_remise === 'pourcentage')}>En %</button>
              <button type="button" onClick={() => maj({ type_remise: 'montant' })} className={puce(b.type_remise === 'montant')}>En €</button>
            </div>
            <input aria-label={b.type_remise === 'pourcentage' ? 'Remise en pourcentage' : 'Remise en euros'} className={CHAMP} inputMode="decimal" value={b.valeur} onChange={e => maj({ valeur: e.target.value.replace(/[^\d.,]/g, '') })} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-debut" className={ETIQUETTE}>Début</label>
              <input id="promo-debut" type="datetime-local" className={CHAMP} value={b.debut} onChange={e => maj({ debut: e.target.value })} />
            </div>
            <div>
              <label htmlFor="promo-fin" className={ETIQUETTE}>Fin</label>
              <input id="promo-fin" type="datetime-local" className={CHAMP} value={b.fin} onChange={e => maj({ fin: e.target.value })} />
            </div>
          </div>
        </section>

        <section className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
          <p className={ETIQUETTE}>Prestations concernées</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => maj({ toutes: true })} className={puce(b.toutes)}>Toutes</button>
            <button type="button" onClick={() => maj({ toutes: false })} className={puce(!b.toutes)}>Certaines</button>
          </div>
          {!b.toutes && (
            <ul className="mt-3 divide-y divide-[color:var(--v2-filet)]">
              {services.map(s => {
                const coche = b.service_ids.includes(s.id)
                return (
                  <li key={s.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
                      <input type="checkbox" className="h-5 w-5 accent-[color:var(--v2-color-encre)]" checked={coche}
                        onChange={() => maj({ service_ids: coche ? b.service_ids.filter(x => x !== s.id) : [...b.service_ids, s.id] })} />
                      <span className={`text-[15px] ${corps}`}>{s.name}</span>
                    </label>
                  </li>
                )
              })}
              {!services.length && <li className={`py-2 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Aucune prestation créée.</li>}
            </ul>
          )}
          <p className={`mt-3 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            La remise porte sur la prestation et ses options, pas sur les frais de déplacement.
          </p>
        </section>

        <section className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className={`text-[15px] ${corpsFort}`}>Bandeau sur ma page</p>
              <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>En haut de votre page de réservation</p>
            </div>
            <Interrupteur actif={b.bandeau_actif} enCours={false} libelle="Afficher le bandeau" onClick={() => maj({ bandeau_actif: !b.bandeau_actif })} />
          </div>

          {b.bandeau_actif && (
            <>
              <label htmlFor="promo-texte" className={`${ETIQUETTE} mt-4`}>Message (facultatif)</label>
              <input id="promo-texte" className={CHAMP} value={b.bandeau_texte} maxLength={140} placeholder="Offrez un lavage à votre moitié" onChange={e => maj({ bandeau_texte: e.target.value })} />

              <p className={`${ETIQUETTE} mt-4`}>Couleur</p>
              <div className="flex flex-wrap items-center gap-2.5">
                {COULEURS_BANDEAU.map(c => (
                  <button key={c} type="button" onClick={() => maj({ bandeau_couleur: c })} aria-label={`Couleur ${c}`} aria-pressed={b.bandeau_couleur === c}
                    className="h-9 w-9 rounded-full border-2" style={{ background: c, borderColor: b.bandeau_couleur === c ? 'var(--v2-color-encre)' : 'var(--v2-filet-fort)', boxShadow: b.bandeau_couleur === c ? 'inset 0 0 0 2px var(--v2-color-surface)' : 'none' }} />
                ))}
                <label className={`flex h-9 cursor-pointer items-center gap-2 rounded-full border border-[color:var(--v2-filet-fort)] px-3 text-[13px] ${corpsFort}`}>
                  <input type="color" value={b.bandeau_couleur} onChange={e => maj({ bandeau_couleur: e.target.value.toUpperCase() })} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" />
                  Autre
                </label>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <p className={`min-w-0 flex-1 text-[15px] ${corps}`}>Compte à rebours</p>
                <Interrupteur actif={b.bandeau_compteur} enCours={false} libelle="Afficher le compte à rebours" onClick={() => maj({ bandeau_compteur: !b.bandeau_compteur })} />
              </div>

              <p className={`${ETIQUETTE} mt-3`}>Aperçu</p>
              <div className="overflow-hidden rounded-[12px] border border-[color:var(--v2-filet)]">
                {apercu && <BandeauPromotion promo={apercu} />}
              </div>
            </>
          )}
        </section>

        {erreur && <Constat>{erreur}</Constat>}

        <div className="flex flex-col gap-2">
          <button type="button" onClick={enregistrer} disabled={enregistrement} className={`${BOUTON} w-full `} style={{ background: 'var(--v2-color-accent)', color: 'var(--v2-color-sur-accent)', ...PRESSION }}>
            {enregistrement ? 'Enregistrement…' : b.id ? 'Enregistrer' : 'Créer la promotion'}
          </button>
          {b.id && (
            <button type="button" onClick={() => setSuppression(true)} className={`${BOUTON} w-full`} style={{ color: 'var(--v2-color-rouge)', ...PRESSION }}>
              Supprimer la promotion
            </button>
          )}
          <a href={`/book/${slug}`} target="_blank" rel="noopener" className={`mt-1 self-center text-[13.5px] ${corpsFort} underline decoration-[color:var(--v2-filet-fort)] underline-offset-4`}>
            Voir ma page de réservation
          </a>
        </div>
      </div>

      {suppression && (
        <ConfirmationSuppression
          titre="Supprimer cette promotion ?"
          texte="Le bandeau disparaît de votre page et la remise ne s’applique plus aux nouvelles réservations. Les réservations déjà prises gardent leur prix."
          enCours={suppressionEnCours}
          erreur={erreur}
          onConfirmer={supprimer}
          onClose={() => setSuppression(false)}
        />
      )}
    </>
  )

  const contenu = (
    <div className={grandEcran
      ? 'text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'
      : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'}>
      {vueFormulaire ?? vueListe}
    </div>
  )

  if (!grandEcran) return contenu
  return (
    <div className="flex items-start gap-5">
      <div className="sticky top-0 w-[320px] shrink-0 max-h-[calc(100vh-60px)] overflow-y-auto">
        <ListeReglagesV2 {...liste} selection="promotions" />
      </div>
      <div className="min-w-0 max-w-[620px] flex-1">{contenu}</div>
    </div>
  )
}

function Constat({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className={`mb-3 flex items-start gap-2 text-[13.5px] leading-snug ${corps}`}>
      <span className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-rouge)' }} aria-hidden />
      {children}
    </p>
  )
}

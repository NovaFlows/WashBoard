'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus } from 'lucide-react'
import { Feuille, BOUTON, PRESSION, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { Constat, ConfirmationSuppression, nom } from '@/components/dashboard/PrestationsUiV2'
import FeuilleDocumentV2 from '@/components/dashboard/FeuilleDocumentV2'
import {
  devisExpire, libelleGenre, libelleStatut, tonStatut, type Document, type GenreDocument,
} from '@/lib/documents'
import {
  creerDocument, envoyerDocument, facturerDevis, lireDocuments, repondreDevis, supprimerDevis,
} from '@/lib/documentsApi'
import { aujourdhuiParis } from '@/lib/chiffresPeriode'

// « Devis et factures » — refonte 2026, destination NEUVE (Alexandre, 2026-09-27 : « on va
// créer une section nouveau devis facture qui existe pas pour en générer un ou une »).
//
// Ce que cet écran ajoute au produit : jusqu'ici une facture ne pouvait naître que d'un
// rendez-vous pris sur la page de réservation. Deux situations restaient sans réponse —
// chiffrer un travail avant de le faire (le client veut un prix avant de dire oui), et
// facturer un chantier arrivé par le bouche-à-oreille, qui n'a jamais eu de créneau.
//
// Réservé à la PWA installée (voir `Documents.tsx`, le garde-fou). L'adresse est sous
// `/dashboard/chiffres/` pour que « Chiffres » reste allumé dans la barre du bas.
//
// Les factures de rendez-vous restent où elles sont (`/dashboard/factures`) : elles naissent
// toutes seules quand un rendez-vous passe à « Terminé », et n'ont rien à faire dans un écran
// dont le sujet est « ce que j'écris à la main ».

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const COULEUR_TON = { gris: 'var(--v2-color-gris)', ambre: 'var(--v2-color-ambre)', vert: 'var(--v2-color-vert)' } as const

const jourCourt = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

function Pastille({ document: d, aujourdhui }: { document: Document; aujourdhui: string }) {
  // Un devis périmé se lit d'un coup d'œil : le prix ne tient plus, il faut le refaire.
  const perime = d.genre === 'devis' && d.statut !== 'transforme' && d.statut !== 'refuse'
    && devisExpire(d.valable_jusquau, aujourdhui)
  const ton = perime ? 'gris' : tonStatut(d)
  return (
    <span className={`flex items-center gap-1.5 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
      <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: COULEUR_TON[ton] }} aria-hidden />
      {perime ? 'Expiré' : libelleStatut(d)}
    </span>
  )
}

/** Ce qu'on peut encore faire d'un document, une fois ouvert. */
function FeuilleActions({
  document: d, occupe, onEnvoyer, onRepondre, onFacturer, onSupprimer, onClose,
}: {
  document: Document
  occupe: boolean
  onEnvoyer: () => void
  onRepondre: (statut: 'accepte' | 'refuse') => void
  onFacturer: () => void
  onSupprimer: () => void
  onClose: () => void
}) {
  const devis = d.genre === 'devis'
  const client = d.contenu.client.entreprise || d.contenu.client.nom
  const secondaire = `${BOUTON} w-full border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`

  return (
    <Feuille titre={`${libelleGenre(d.genre)} ${d.numero ?? ''}`.trim()} sousTitre={`${client} · ${euros.format(d.contenu.totaux.ttc)}`} onClose={onClose}>
      <div className="flex flex-col gap-2.5">
        <a
          href={`/api/documents/${d.id}/pdf`}
          className={`${BOUTON} w-full text-white`}
          style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
        >
          Télécharger le PDF
        </a>
        <button type="button" onClick={onEnvoyer} disabled={occupe} className={secondaire} style={PRESSION}>
          {d.envoye_le ? 'Renvoyer par email' : 'Envoyer par email'}
        </button>

        {devis && d.statut !== 'transforme' && (
          <>
            {d.statut === 'accepte' ? (
              /* Le geste qui donne son intérêt au devis : la facture reprend ses lignes,
                 sans rien retaper, et prend le numéro suivant de la vraie suite. */
              <button
                type="button"
                onClick={onFacturer}
                disabled={occupe}
                className={`${BOUTON} w-full text-white`}
                style={{ background: 'var(--v2-color-vert)', ...PRESSION }}
              >
                Transformer en facture
              </button>
            ) : (
              <div className="flex gap-2.5">
                <button type="button" onClick={() => onRepondre('accepte')} disabled={occupe} className={`${secondaire} flex-1`} style={PRESSION}>
                  Accepté
                </button>
                <button type="button" onClick={() => onRepondre('refuse')} disabled={occupe} className={`${secondaire} flex-1`} style={PRESSION}>
                  Refusé
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onSupprimer}
              disabled={occupe}
              className={`${BOUTON} w-full text-[color:var(--v2-color-rouge)]`}
              style={PRESSION}
            >
              Supprimer ce devis
            </button>
          </>
        )}

        {!devis && (
          <p className={`mt-1 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Une facture émise ne se modifie ni ne se supprime : sa numérotation doit rester
            continue. Une erreur se corrige par un avoir.
          </p>
        )}
      </div>
    </Feuille>
  )
}

export default function DocumentsV2({ prestations }: { prestations: { id: string; name: string; price: number }[] }) {
  const [aujourdhui] = useState(() => aujourdhuiParis(Date.now()))
  const [documents, setDocuments] = useState<Document[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [nouveau, setNouveau] = useState<GenreDocument | null>(null)
  const [ouvert, setOuvert] = useState<Document | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [suppression, setSuppression] = useState<Document | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  const [suppressionErreur, setSuppressionErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const r = await lireDocuments()
    // Une panne ne vide pas la liste : on garde ce qui est affiché et on le dit.
    if (r.ok) { setDocuments(r.data); setErreur(null) }
    else setErreur(r.message)
  }, [])

  useEffect(() => { void charger() }, [charger])

  /** Une action sur le document ouvert : la phrase d'échec s'affiche dans la feuille, qui
   *  reste ouverte ; un succès referme et recharge. */
  async function agir(action: () => Promise<{ ok: true } | { ok: false; message: string }>, succes: string) {
    if (occupe) return
    setOccupe(true)
    setErreur(null)
    const r = await action()
    setOccupe(false)
    if (!r.ok) { setErreur(r.message); setOuvert(null); return }
    setMessage(succes)
    setOuvert(null)
    await charger()
  }

  async function confirmerSuppression() {
    if (!suppression || suppressionEnCours) return
    setSuppressionEnCours(true)
    setSuppressionErreur(null)
    const r = await supprimerDevis(suppression.id)
    setSuppressionEnCours(false)
    if (!r.ok) { setSuppressionErreur(r.message); return }
    setDocuments(ds => (ds ?? []).filter(d => d.id !== suppression.id))
    setSuppression(null)
  }

  const devis = (documents ?? []).filter(d => d.genre === 'devis')
  const factures = (documents ?? []).filter(d => d.genre === 'facture')

  return (
    <div className="max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]">
      <div className="flex items-center gap-1 pb-2">
        <Link
          href="/dashboard/chiffres"
          aria-label="Retour à Chiffres"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`text-[24px] leading-none ${titre}`}>Devis et factures</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Écrits à la main, sans rendez-vous
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNouveau('devis')}
          aria-label="Nouveau devis ou nouvelle facture"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-[.94] motion-reduce:transition-none"
          style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
        >
          <Plus size={22} strokeWidth={2.4} aria-hidden />
        </button>
      </div>

      {erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
      {message && (
        <div className="mt-2">
          <p role="status" className={`text-[13.5px] leading-snug ${corps}`} style={{ color: 'var(--v2-color-vert)' }}>{message}</p>
        </div>
      )}

      {documents === null ? (
        <p className={`py-10 text-center text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Chargement…</p>
      ) : documents.length === 0 ? (
        <div className="mt-4 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-7">
          <p className={`text-[15px] ${corpsFort}`}>Rien pour l’instant</p>
          <p className={`mt-1.5 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Un client demande un prix pour des tapis, un canapé, une remise en état ? Faites-lui un
            devis. Un chantier est arrivé par le bouche-à-oreille, sans passer par votre page ?
            Faites la facture ici.
          </p>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={() => setNouveau('devis')}
              className={`${BOUTON} flex-1 text-white`}
              style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
            >
              Nouveau devis
            </button>
            <button
              type="button"
              onClick={() => setNouveau('facture')}
              className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
              style={PRESSION}
            >
              Nouvelle facture
            </button>
          </div>
        </div>
      ) : (
        <>
          {([['Devis', devis], ['Factures', factures]] as const).map(([intitule, liste]) => liste.length === 0 ? null : (
            <section key={intitule} aria-label={intitule} className="mt-[26px]">
              <h2 className={`px-0.5 pb-1.5 text-[19px] leading-tight ${titre}`}>{intitule}</h2>
              <div className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
                <ul className="divide-y divide-[color:var(--v2-filet)] px-4">
                  {liste.map(d => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setOuvert(d)}
                        className="flex min-h-[62px] w-full items-center gap-3 py-2.5 text-left"
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className={`truncate text-[15px] ${nom}`}>
                            {d.contenu.client.entreprise || d.contenu.client.nom}
                          </span>
                          <span className={`truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                            {d.numero} · {d.emis_le ? jourCourt(d.emis_le) : jourCourt(d.created_at)}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className={`text-[15px] ${corpsFort} tabular-nums`}>
                            {euros.format(d.contenu.totaux.ttc)}
                          </span>
                          <Pastille document={d} aujourdhui={aujourdhui} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </>
      )}

      {nouveau && (
        <FeuilleDocumentV2
          aujourdhui={aujourdhui}
          prestations={prestations}
          genreInitial={nouveau}
          onEnregistrer={async saisie => {
            const r = await creerDocument(saisie)
            if (!r.ok) return r.message
            setMessage(`${libelleGenre(saisie.genre)} ${r.data.numero ?? ''} créé${saisie.genre === 'facture' ? 'e' : ''}.`)
            await charger()
            return null
          }}
          onClose={() => setNouveau(null)}
        />
      )}

      {ouvert && (
        <FeuilleActions
          document={ouvert}
          occupe={occupe}
          onEnvoyer={() => void agir(() => envoyerDocument(ouvert.id), 'Envoyé au client.')}
          onRepondre={statut => void agir(
            () => repondreDevis(ouvert.id, statut),
            statut === 'accepte' ? 'Devis accepté. Vous pouvez le transformer en facture.' : 'Devis marqué refusé.',
          )}
          onFacturer={() => void agir(() => facturerDevis(ouvert.id), 'Facture créée depuis le devis.')}
          onSupprimer={() => { setSuppressionErreur(null); setSuppression(ouvert); setOuvert(null) }}
          onClose={() => setOuvert(null)}
        />
      )}

      {suppression && (
        <ConfirmationSuppression
          titre={`Supprimer le devis ${suppression.numero} ?`}
          texte="Il disparaît de votre liste. Le client garde le PDF que vous lui avez envoyé."
          enCours={suppressionEnCours}
          erreur={suppressionErreur}
          onConfirmer={confirmerSuppression}
          onClose={() => setSuppression(null)}
        />
      )}
    </div>
  )
}

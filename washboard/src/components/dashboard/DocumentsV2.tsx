'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Plus } from 'lucide-react'
import { Feuille, BOUTON, PRESSION, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { Constat, ConfirmationSuppression, nom } from '@/components/dashboard/PrestationsUiV2'
import FeuilleDocumentV2 from '@/components/dashboard/FeuilleDocumentV2'
import {
  devisExpire, libelleGenre, libelleStatut, messageWhatsapp, nomFichierDocument, partagerPdf,
  tonStatut, totalDocument, type Document, type GenreDocument, type SaisieDocument,
} from '@/lib/documents'
import { whatsappDigits } from '@/lib/phone'
import {
  creerDocument, envoyerDocument, facturerDevis, lireDocuments, marquerPayee, repondreDevis,
  supprimerDevis,
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
//
// PAYÉE OU PAS (2026-09-27). Une facture à la main n'est pas de l'argent reçu : le chantier
// facturé à une entreprise se règle par virement, plus tard. Toute facture qui naît ici pose
// donc la question tout de suite (`FeuillePaiement`), et seules les payées entrent dans
// l'« Encaissé » de Chiffres. Ne pas répondre vaut « pas encore » : on ne compte jamais d'argent
// qu'on n'a pas. Le rendez-vous, lui, est payé sur place — la question ne s'y pose pas.

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

/** La question posée dès qu'une facture naît : l'argent est-il déjà là ?
 *
 *  Demandée tout de suite, parce que c'est le moment où le laveur le sait (Alexandre,
 *  2026-09-27 : « quand un devis se transforme en facture on met un pop up payé ou pas encore
 *  payé »). « Pas encore » n'est pas un abandon : la facture attend dans la liste avec sa
 *  pastille ambre, et son bouton « Marquer payée » la fait entrer dans l'encaissé le jour où
 *  le virement tombe. Fermer la feuille sans répondre revient à « pas encore » — le défaut
 *  prudent, celui qui ne compte pas d'argent qu'on n'a pas. */
function FeuillePaiement({ numero, montant, occupe, onRepondre, onClose }: {
  numero: string | null
  montant: number
  occupe: boolean
  onRepondre: (paye: boolean) => void
  onClose: () => void
}) {
  const secondaire = `${BOUTON} w-full border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`
  return (
    <Feuille
      titre={`Facture ${numero ?? ''}`.trim()}
      sousTitre={`${euros.format(montant)} · déjà payée ?`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => onRepondre(true)}
          disabled={occupe}
          className={`${BOUTON} w-full text-white`}
          style={{ background: 'var(--v2-color-vert)', ...PRESSION }}
        >
          Oui, encaissée
        </button>
        <button type="button" onClick={() => onRepondre(false)} disabled={occupe} className={secondaire} style={PRESSION}>
          Pas encore
        </button>
        <p className={`mt-1 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
          Seules les factures encaissées comptent dans vos chiffres. Une facture en attente reste
          dans votre liste, et vous la marquerez payée le jour où l’argent arrive.
        </p>
      </div>
    </Feuille>
  )
}

/** Ce qu'on peut encore faire d'un document, une fois ouvert. */
function FeuilleActions({
  document: d, nomLaveur, occupe, onEnvoyer, onRepondre, onFacturer, onPayer, onSupprimer, onClose,
}: {
  document: Document
  nomLaveur: string
  occupe: boolean
  onEnvoyer: () => void
  onRepondre: (statut: 'accepte' | 'refuse') => void
  onFacturer: () => void
  onPayer: (paye: boolean) => void
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
        {/* WhatsApp d'abord : c'est par là que les clients des laveurs répondent. Le PDF n'y
            est pas joint mais lié — `wa.me` ne sait pas joindre un fichier. */}
        {d.contenu.client.telephone && (
          <button
            type="button"
            onClick={async () => {
              const lien = `${window.location.origin}/api/documents/${d.id}/pdf`
              // D'abord le partage natif : il envoie le VRAI fichier, que le laveur dépose
              // dans WhatsApp, Messages ou Mail depuis la feuille de partage de son
              // téléphone. Le message n'y porte PAS de lien : le client a le PDF avec.
              const partage = await partagerPdf(
                lien,
                nomFichierDocument({ genre: d.genre, numero: d.numero ?? '' }),
                messageWhatsapp(d, null, nomLaveur),
                `${libelleGenre(d.genre)} ${d.numero ?? ''}`.trim(),
              )
              if (partage) return
              // Repli (ordinateur, navigateur trop ancien) : `wa.me` ne transporte qu'un
              // message, le lien y est donc indispensable — sinon le client n'a rien.
              window.open(
                `https://wa.me/${whatsappDigits(d.contenu.client.telephone!)}?text=${encodeURIComponent(messageWhatsapp(d, lien, nomLaveur))}`,
                '_blank', 'noopener',
              )
            }}
            className={`${secondaire} gap-2`}
            style={PRESSION}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.3 4.7 4.84-1.27A9.9 9.9 0 1 0 12.04 2m0 1.8a8.1 8.1 0 1 1-4.1 15.09l-.29-.17-2.87.75.77-2.8-.19-.3A8.1 8.1 0 0 1 12.04 3.8m-3.2 4c-.15 0-.4.06-.61.29-.21.23-.8.79-.8 1.92s.82 2.23.94 2.38c.11.15 1.6 2.55 3.94 3.47 1.95.77 2.35.62 2.77.58.42-.04 1.36-.55 1.55-1.09.19-.54.19-1 .14-1.1-.06-.09-.21-.15-.44-.27-.23-.11-1.36-.67-1.57-.75-.21-.08-.36-.11-.51.12-.15.23-.59.74-.72.9-.13.15-.26.17-.49.06-.23-.12-.97-.36-1.85-1.14-.68-.61-1.15-1.36-1.28-1.59-.13-.23-.01-.35.1-.47.1-.1.23-.27.34-.4.11-.14.15-.23.23-.38.08-.16.04-.29-.02-.4-.06-.12-.51-1.25-.71-1.71-.17-.41-.35-.41-.5-.42z" />
            </svg>
            Envoyer le PDF (WhatsApp…)
          </button>
        )}
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
          <>
            {/* Le geste qui fait entrer l'argent dans Chiffres — et le seul. */}
            {d.paye_le ? (
              <>
                <p className={`mt-1 text-[13px] leading-snug ${corps}`} style={{ color: 'var(--v2-color-vert)' }}>
                  Encaissée le {jourCourt(d.paye_le)} · comptée dans vos chiffres
                </p>
                <button
                  type="button"
                  onClick={() => onPayer(false)}
                  disabled={occupe}
                  className={`h-11 self-start text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)] underline`}
                >
                  Finalement, pas encore payée
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onPayer(true)}
                disabled={occupe}
                className={`${BOUTON} w-full text-white`}
                style={{ background: 'var(--v2-color-vert)', ...PRESSION }}
              >
                Marquer payée
              </button>
            )}
            <p className={`mt-1 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Une facture émise ne se modifie ni ne se supprime : sa numérotation doit rester
              continue. Une erreur se corrige par un avoir.
            </p>
          </>
        )}
      </div>
    </Feuille>
  )
}

export default function DocumentsV2({ prestations, nomLaveur }: {
  prestations: { id: string; name: string; price: number }[]
  /** Signature du message WhatsApp : le client doit savoir qui lui écrit. */
  nomLaveur: string
}) {
  const [aujourdhui] = useState(() => aujourdhuiParis(Date.now()))
  const [documents, setDocuments] = useState<Document[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  // Le « + » de la barre du bas arrive avec `?nouveau=1` : il emmène à la SAISIE, pas à la
  // liste — c'est le geste qu'on vient faire.
  //
  // C'est l'ADRESSE qui dit si la feuille est ouverte, pas un état lu une fois au montage :
  // quand on était déjà sur cet écran, retaper le « + » ne changeait pas l'adresse, rien ne
  // se remontait, et le bouton semblait mort (Alexandre, 2026-09-27). Refermer la feuille
  // retire donc le paramètre, pour que le tap suivant soit bien une navigation.
  const router = useRouter()
  const chemin = usePathname()
  const paramsUrl = useSearchParams()
  const ouvertParUrl = paramsUrl.get('nouveau') !== null
  const [nouveau, setNouveau] = useState<GenreDocument | null>(null)
  const feuilleNouveau = nouveau ?? (ouvertParUrl ? 'devis' : null)

  // Pré-remplissage depuis la Fiche entreprise (Alexandre, 2026-09-28 : « il faut que ce soit
  // pré rempli avec les informations de l'entreprise dans le devis »), transporté par l'adresse
  // au même titre que `nouveau=1` (voir FicheEntrepriseV2.tsx, `hrefNouveauDevis`). Ignoré si la
  // feuille a été rouverte par le « + » de cet écran (`nouveau` local, pas `ouvertParUrl`) : ce
  // geste-là veut un formulaire vide, pas les paramètres d'une navigation précédente.
  const prefill: Partial<SaisieDocument> | undefined = nouveau === null && ouvertParUrl && paramsUrl.get('entreprise')
    ? {
        clientNom: paramsUrl.get('nom') ?? '',
        clientTelephone: paramsUrl.get('tel') ?? '',
        clientEmail: paramsUrl.get('email') ?? '',
        clientAdresse: paramsUrl.get('adresse') ?? '',
        professionnel: true,
        entreprise: paramsUrl.get('entreprise') ?? '',
      }
    : undefined

  function fermerNouveau() {
    setNouveau(null)
    if (ouvertParUrl) router.replace(chemin ?? '/dashboard/chiffres/documents', { scroll: false })
  }
  // L'ouverture retient un IDENTIFIANT, pas une copie du document : après « Accepté », la
  // feuille doit proposer « Transformer en facture », pas répéter le choix déjà fait. Avec une
  // copie figée, elle montrait l'état d'avant l'action (constaté le 2026-09-27, en base réelle).
  const [ouvertId, setOuvertId] = useState<string | null>(null)
  // La facture qui vient de naître et dont on ne sait pas encore si elle est payée.
  const [paiement, setPaiement] = useState<{ id: string; numero: string | null; montant: number } | null>(null)
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

  /** Une action sur le document ouvert.
   *
   *  `fermer` dit si le geste est terminé : noter la réponse du client ne l'est pas — la
   *  facture se fait dans la foulée, dans la même feuille, qui se met à jour toute seule
   *  puisqu'elle relit la liste. Transformer, envoyer ou supprimer, si. */
  async function agir(
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
    succes: string,
    { fermer = true } = {},
  ) {
    if (occupe) return
    setOccupe(true)
    setErreur(null)
    const r = await action()
    setOccupe(false)
    if (!r.ok) { setErreur(r.message); setOuvertId(null); return }
    setMessage(succes)
    if (fermer) setOuvertId(null)
    await charger()
  }

  /** Le devis devient facture, puis la question du paiement. Écrit à la main plutôt que passé
   *  par `agir` : il faut l'identifiant de la facture née pour pouvoir la marquer payée. */
  async function facturer(devis: Document) {
    if (occupe) return
    setOccupe(true)
    setErreur(null)
    const r = await facturerDevis(devis.id)
    setOccupe(false)
    if (!r.ok) { setErreur(r.message); setOuvertId(null); return }
    setMessage(`Facture ${r.data.numero ?? ''} créée depuis le devis.`.replace('  ', ' '))
    setOuvertId(null)
    await charger()
    // `deja` : la facture existait (double tap) — sa situation de paiement est déjà connue.
    if (!r.data.deja) {
      setPaiement({ id: r.data.id, numero: r.data.numero, montant: devis.contenu.totaux.ttc })
    }
  }

  /** Payée, ou plus payée. Le seul drapeau qui décide de l'entrée dans l'« Encaissé ». */
  async function payer(id: string, paye: boolean) {
    if (occupe) return
    setOccupe(true)
    setErreur(null)
    const r = await marquerPayee(id, paye)
    setOccupe(false)
    setPaiement(null)
    if (!r.ok) { setErreur(r.message); return }
    setMessage(paye ? 'Facture encaissée : elle compte dans vos chiffres.' : 'Facture remise en attente de paiement.')
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
  // Toujours relu dans la liste : la feuille ne peut pas montrer un état périmé.
  const ouvert = (documents ?? []).find(d => d.id === ouvertId) ?? null

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
                        onClick={() => { setMessage(null); setOuvertId(d.id) }}
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

      {feuilleNouveau && (
        <FeuilleDocumentV2
          aujourdhui={aujourdhui}
          prestations={prestations}
          genreInitial={feuilleNouveau}
          prefill={prefill}
          onEnregistrer={async saisie => {
            const r = await creerDocument(saisie)
            if (!r.ok) return r.message
            setMessage(`${libelleGenre(saisie.genre)} ${r.data.numero ?? ''} créé${saisie.genre === 'facture' ? 'e' : ''}.`)
            await charger()
            // Une facture écrite directement pose la même question qu'une facture née d'un
            // devis : l'argent est-il déjà là ? Même feuille, même défaut prudent.
            if (saisie.genre === 'facture') {
              setPaiement({ id: r.data.id, numero: r.data.numero, montant: totalDocument(saisie) })
            }
            return null
          }}
          onClose={fermerNouveau}
        />
      )}

      {ouvert && (
        <FeuilleActions
          document={ouvert}
          nomLaveur={nomLaveur}
          occupe={occupe}
          onEnvoyer={() => void agir(() => envoyerDocument(ouvert.id), 'Envoyé au client.')}
          onRepondre={statut => void agir(
            () => repondreDevis(ouvert.id, statut),
            statut === 'accepte' ? 'Devis accepté. Vous pouvez le transformer en facture.' : 'Devis marqué refusé.',
            // La feuille reste ouverte : « Transformer en facture » y prend la place des deux
            // boutons de réponse, et c'est le geste suivant.
            { fermer: statut === 'refuse' },
          )}
          onFacturer={() => void facturer(ouvert)}
          onPayer={paye => void payer(ouvert.id, paye)}
          onSupprimer={() => { setSuppressionErreur(null); setSuppression(ouvert); setOuvertId(null) }}
          onClose={() => setOuvertId(null)}
        />
      )}

      {paiement && (
        <FeuillePaiement
          numero={paiement.numero}
          montant={paiement.montant}
          occupe={occupe}
          onRepondre={paye => {
            // « Pas encore » n'écrit rien : la colonne est déjà nulle à la naissance.
            if (paye) void payer(paiement.id, true)
            else setPaiement(null)
          }}
          onClose={() => setPaiement(null)}
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

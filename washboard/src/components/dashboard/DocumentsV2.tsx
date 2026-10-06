'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, FileText, MapPin, Phone, Plus, Search } from 'lucide-react'
import { useOffre } from '@/components/dashboard/OffreContext'
import { OffreVerrouilleeV2 } from '@/components/dashboard/OffreVerrouilleeV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import { Feuille, BOUTON, PRESSION, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { Constat, ConfirmationSuppression, nom } from '@/components/dashboard/PrestationsUiV2'
import FeuilleDocumentV2 from '@/components/dashboard/FeuilleDocumentV2'
import FeuilleActionsDocumentV2, { IconeWhatsapp } from '@/components/dashboard/FeuilleActionsDocumentV2'
import {
  devisExpire, libelleGenre, libelleStatut, messageWhatsapp, nomFichierDocument, partagerPdf,
  totalDocument, tonStatut, type Document, type GenreDocument, type SaisieDocument,
} from '@/lib/documents'
import {
  creerDocument, envoyerDocument, facturerDevis, lireDocuments, marquerPayee, repondreDevis,
  supprimerDevis,
} from '@/lib/documentsApi'
import { aujourdhuiParis } from '@/lib/chiffresPeriode'
import { confirmerEnvoi, annoncerApresRetour } from '@/lib/confirmationEnvoi'
import { whatsappDigits } from '@/lib/phone'

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

/** Champ de filtre bureau (recherche, selects) — pilule 40 px, comme la recherche de
 *  `ClientsViewV2.tsx` et `.docselect`/`.docfilters .search` de la maquette (planche
 *  Documents), pas le rayon de bouton de `CHAMP` (`FeuilleV2.tsx`), pensé pour un champ de
 *  feuille mobile. */
const FILTRE_CHAMP = `h-10 rounded-[var(--v2-radius-pilule)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[13px] ${corps} text-[color:var(--v2-color-encre)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`

const jourCourt = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/** Le statut à l'écran, point + mot : un devis périmé se lit d'un coup d'œil (le prix ne tient
 *  plus, il faut le refaire) et prime sur `libelleStatut()` quand c'est le cas. Extrait pour
 *  servir aussi les filtres et la liste de la passe bureau (`etatsOptions`, `LigneDocumentBureauV2`,
 *  `FicheDocumentBureauV2` plus bas) : un seul calcul, jamais trois versions du même « périmé
 *  ou pas » à garder d'accord entre elles. */
function statutAffiche(d: Document, aujourdhui: string): { label: string; ton: 'gris' | 'ambre' | 'vert' } {
  const perime = d.genre === 'devis' && d.statut !== 'transforme' && d.statut !== 'refuse'
    && devisExpire(d.valable_jusquau, aujourdhui)
  return perime ? { label: 'Expiré', ton: 'gris' } : { label: libelleStatut(d), ton: tonStatut(d) }
}

function Pastille({ document: d, aujourdhui }: { document: Document; aujourdhui: string }) {
  const { label, ton } = statutAffiche(d, aujourdhui)
  return (
    <span className={`flex items-center gap-1.5 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
      <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: COULEUR_TON[ton] }} aria-hidden />
      {label}
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

/** La flèche revient d'où l'on vient : le « + » de la barre du bas est accessible de partout,
 *  et renvoyer à Chiffres après un devis écrit depuis l'Accueil ou les Clients faisait perdre
 *  le fil (Alexandre, 2026-09-30). Sans historique (écran ouvert en direct), Chiffres reste le
 *  parent. Le « + » tapé ici même remplace l'adresse au lieu de l'empiler (BarreBasV2), sinon
 *  un retour ne ferait que revenir à cet écran. */
function FlecheRetourDocuments() {
  const router = useRouter()
  return (
    <Link
      href="/dashboard/chiffres"
      aria-label="Retour à Chiffres"
      onClick={e => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          e.preventDefault()
          router.back()
        }
      }}
      className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
    >
      <ChevronLeft size={22} strokeWidth={2} />
    </Link>
  )
}

const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Une ligne de la liste bureau (planche Documents, `.client-row`) — avatar carré D/F plutôt que
 *  les initiales du client : c'est le TYPE de document qui se reconnaît d'un coup d'œil dans
 *  cette colonne étroite, le nom du client est déjà sur la ligne juste à côté. Même patron que
 *  `LigneClient` de ClientsViewV2.tsx (ligne cliquable, `aria-current` pour la sélection). */
function LigneDocumentBureauV2({ document: d, aujourdhui, selectionnee, onOuvrir }: {
  document: Document
  aujourdhui: string
  selectionnee: boolean
  onOuvrir: () => void
}) {
  const client = d.contenu.client.entreprise || d.contenu.client.nom
  const { ton } = statutAffiche(d, aujourdhui)
  return (
    <li>
      <button
        type="button"
        onClick={onOuvrir}
        aria-label={`Voir ${libelleGenre(d.genre)} ${d.numero ?? ''} de ${client}`.replace(/\s+/g, ' ').trim()}
        aria-current={selectionnee ? 'true' : undefined}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:bg-[color:var(--v2-filet)] ${
          selectionnee ? 'bg-[color:var(--v2-filet)]' : 'hover:bg-[color:var(--v2-filet)]'
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--v2-radius-carte)] text-[13px] ${corpsFort} text-[color:var(--v2-color-encre)] bg-[color:var(--v2-filet)]`}
          aria-hidden
        >
          {d.genre === 'devis' ? 'D' : 'F'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`truncate text-[15px] ${nom}`}>{`${libelleGenre(d.genre)} ${d.numero ?? ''}`.trim()}</span>
          <span className={`truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {client} · {jourCourt(d.emis_le ?? d.created_at)}
          </span>
        </span>
        <span className={`shrink-0 text-[14px] ${corpsFort} tabular-nums`} style={{ color: COULEUR_TON[ton] }}>
          {euros.format(d.contenu.totaux.ttc)}
        </span>
      </button>
    </li>
  )
}

/** Fiche de document du panneau de droite bureau — mêmes ACTIONS que `FeuilleActionsDocumentV2`
 *  (mêmes callbacks, posés par `DocumentsOuvertsV2` plus bas, jamais recalculés), présentation à
 *  part : posée à demeure à côté de la liste (pas de fond, pas de piège de focus, pas de geste
 *  de fermeture — rien de tout ça n'a de sens pour un panneau permanent, même raisonnement que
 *  `ClientProfileModalV2.tsx` en mode `panneau` et que `FicheRdvBureauV2` dans
 *  `CalendrierDashboardV2.tsx`), avec en plus le CONTENU du document (lignes, total, client) que
 *  la feuille mobile ne montre pas (le PDF en tient lieu sur téléphone, voir
 *  `FeuilleActionsDocumentV2.tsx`) : la maquette bureau (écrans 43/49) le demande, sans aucune
 *  donnée nouvelle — tout vient de `document.contenu`, déjà chargé par `lireDocuments()`.
 *
 *  Un devis et une facture n'ont pas les mêmes actions, exactement comme sur la feuille mobile :
 *  un devis encore ouvert propose Accepté/Refusé ou « Transformer en facture », et se supprime ;
 *  une facture propose seulement « Marquer payée »/« Finalement, pas encore payée » — elle ne se
 *  supprime ni ne se modifie, sa numérotation doit rester continue. */
function FicheDocumentBureauV2({
  document: d, aujourdhui, nomLaveur, occupe, onEnvoyer, onRepondre, onFacturer, onPayer, onSupprimer,
}: {
  document: Document
  aujourdhui: string
  nomLaveur: string
  occupe: boolean
  onEnvoyer: () => void
  onRepondre: (statut: 'accepte' | 'refuse') => void
  onFacturer: () => void
  onPayer: (paye: boolean) => void
  onSupprimer: () => void
}) {
  const devis = d.genre === 'devis'
  const client = d.contenu.client.entreprise || d.contenu.client.nom
  const { label, ton } = statutAffiche(d, aujourdhui)
  const secondaire = `${BOUTON} w-full border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)]">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className={`truncate text-[21px] ${titre}`}>{`${libelleGenre(d.genre)} ${d.numero ?? ''}`.trim()}</h2>
            <p className={`mt-1 truncate text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {client} · {euros.format(d.contenu.totaux.ttc)}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap pt-1">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: COULEUR_TON[ton] }} aria-hidden />
            <span className={`text-[13px] ${corpsFort}`} style={{ color: COULEUR_TON[ton] }}>{label}</span>
          </span>
        </div>

        <h3 className={`mt-5 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Lignes</h3>
        <div className="mt-2 divide-y divide-[color:var(--v2-filet)] overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)]">
          {d.contenu.lignes.map((l, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className={`block text-[14.5px] ${nom}`}>{l.designation}</span>
                {l.quantite !== 1 && (
                  <span className={`mt-0.5 block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                    {l.quantite} × {euros.format(l.prixUnitaireTtc)}
                  </span>
                )}
              </span>
              <span className={`shrink-0 ${corpsFort} tabular-nums`}>{euros.format(l.totalTtc)}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-[color:var(--v2-filet)] px-1 py-2.5">
          <span className={corpsFort}>Total</span>
          <span className={`text-[20px] ${titre} tabular-nums`}>{euros.format(d.contenu.totaux.ttc)}</span>
        </div>
        {devis && d.contenu.valableJusquau && (
          <p className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Valable jusqu’au {dateLongue(d.contenu.valableJusquau)}
          </p>
        )}

        {(d.contenu.client.telephone || d.contenu.client.adresseFacturation) && (
          <>
            <h3 className={`mt-5 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Client</h3>
            <div className="mt-2 flex flex-col gap-2.5 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] px-4 py-3">
              {d.contenu.client.telephone && (
                <span className="flex items-center gap-2.5">
                  <Phone size={16} strokeWidth={1.8} className="shrink-0 text-[color:var(--v2-color-gris)]" aria-hidden />
                  <span className={`text-[14px] ${corps}`}>{d.contenu.client.telephone}</span>
                </span>
              )}
              {d.contenu.client.adresseFacturation && (
                <span className="flex items-center gap-2.5">
                  <MapPin size={16} strokeWidth={1.8} className="shrink-0 text-[color:var(--v2-color-gris)]" aria-hidden />
                  <span className={`text-[14px] ${corps}`}>{d.contenu.client.adresseFacturation}</span>
                </span>
              )}
            </div>
          </>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          <a
            href={`/api/documents/${d.id}/pdf`}
            className={`${BOUTON} w-full text-white`}
            style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            Télécharger le PDF
          </a>
          {d.contenu.client.telephone && (
            <a href={`tel:${d.contenu.client.telephone}`} className={`${secondaire} gap-2`} style={PRESSION}>
              <Phone size={16} strokeWidth={2} aria-hidden />
              Appeler {client}
            </a>
          )}
          {d.contenu.client.telephone && (
            <button
              type="button"
              onClick={async () => {
                const lien = `${window.location.origin}/api/documents/${d.id}/pdf`
                // Même logique que `FeuilleActionsDocumentV2.tsx` : partage natif d'abord (le
                // VRAI fichier, le message n'y porte pas de lien), repli `wa.me` sinon (lui ne
                // transporte que du texte, le lien y est donc indispensable).
                const partage = await partagerPdf(
                  lien,
                  nomFichierDocument({ genre: d.genre, numero: d.numero ?? '' }),
                  messageWhatsapp(d, null, nomLaveur),
                  `${libelleGenre(d.genre)} ${d.numero ?? ''}`.trim(),
                )
                if (partage === 'annule') return
                const cible = `${libelleGenre(d.genre)} ${d.numero ?? ''}`.trim()
                if (partage === 'envoye') {
                  confirmerEnvoi({ titre: 'PDF envoyé', detail: `${cible} pour ${client}` })
                  return
                }
                annoncerApresRetour({ titre: 'Message envoyé', detail: `${cible} pour ${client}` })
                window.open(
                  `https://wa.me/${whatsappDigits(d.contenu.client.telephone!)}?text=${encodeURIComponent(messageWhatsapp(d, lien, nomLaveur))}`,
                  '_blank', 'noopener',
                )
              }}
              className={`${secondaire} gap-2`}
              style={PRESSION}
            >
              <IconeWhatsapp />
              Envoyer le PDF (WhatsApp…)
            </button>
          )}
          <button type="button" onClick={onEnvoyer} disabled={occupe} className={secondaire} style={PRESSION}>
            {d.envoye_le ? 'Renvoyer par email' : 'Envoyer par email'}
          </button>

          {devis && d.statut !== 'transforme' && (
            <>
              {d.statut === 'accepte' ? (
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
      </div>
    </div>
  )
}

type PropsDocuments = {
  prestations: { id: string; name: string; price: number }[]
  /** Signature du message WhatsApp : le client doit savoir qui lui écrit. */
  nomLaveur: string
}

/** La facturation conforme fait partie de l'offre Pro (comme `/dashboard/factures`
 *  sur le site). Sous cette offre, l'écran entier est remplacé par la carte
 *  d'offre : ne pas proposer d'écrire un document qu'on ne pourra pas émettre. */
export default function DocumentsV2(props: PropsDocuments) {
  const { peut } = useOffre()
  if (peut('facturation')) return <DocumentsOuvertsV2 {...props} />
  return (
    <div className="max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]">
      <div className="flex items-center gap-1 pb-2">
        <FlecheRetourDocuments />
        <h1 className={`text-[24px] leading-none ${titre}`}>Devis et factures</h1>
      </div>
      <div className="mt-2">
        <OffreVerrouilleeV2
          titre="Éditez des devis et des factures conformes"
          description="Mentions légales, SIRET, TVA, numérotation continue : des documents que votre comptable accepte."
          feature="facturation"
        />
      </div>
    </div>
  )
}

function DocumentsOuvertsV2({ prestations, nomLaveur }: {
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

  // ── Passe bureau (2026-10-07) : liste + recherche + filtres approfondis + fiche à côté ──────
  //
  // Réservé au grand écran (voir l'en-tête du fichier) : le téléphone garde EXACTEMENT la
  // présentation groupée « Devis »/« Factures » ci-dessus, sans recherche ni filtre — c'est la
  // colonne de gauche du rail bureau (« Documents » épinglé) qui a fait naître cette demande,
  // elle n'a pas d'équivalent au pouce.
  const grandEcran = useGrandEcran()
  const [rechercheDoc, setRechercheDoc] = useState('')
  const [filtreType, setFiltreType] = useState<'' | GenreDocument>('')
  const [filtreEtat, setFiltreEtat] = useState('')
  const [filtrePeriode, setFiltrePeriode] = useState<'' | 'mois' | 'mois-1' | 'annee'>('')
  const [filtreClient, setFiltreClient] = useState('')
  const [filtreMontantMin, setFiltreMontantMin] = useState('')
  const [filtreMontantMax, setFiltreMontantMax] = useState('')

  // Le plus récent en tête — même ordre que la maquette (planche Documents).
  const tousDocuments = useMemo(
    () => [...(documents ?? [])].sort((a, b) => (b.emis_le ?? b.created_at).localeCompare(a.emis_le ?? a.created_at)),
    [documents],
  )
  const nomAffiche = (d: Document) => d.contenu.client.entreprise || d.contenu.client.nom
  // Construites depuis les documents RÉELS, jamais une liste figée à la main : un client ou un
  // état qui n'existe pas encore chez ce laveur ne doit pas apparaître dans son propre filtre
  // (même principe que `doc-client` dans la maquette, qui se remplit depuis `DOCS`). L'État
  // reprend `libelleStatut()`/« Expiré » — jamais un « Brouillon » ou un « En retard » inventés :
  // `lib/documents.ts` ne connaît ni l'un ni l'autre (« Pas de brouillon », en-tête du fichier ;
  // aucune date d'échéance distincte de l'émission).
  const clientsOptions = useMemo(
    () => [...new Set(tousDocuments.map(nomAffiche))].sort((a, b) => a.localeCompare(b, 'fr')),
    [tousDocuments],
  )
  const etatsOptions = useMemo(
    () => [...new Set(tousDocuments.map(d => statutAffiche(d, aujourdhui).label))],
    [tousDocuments, aujourdhui],
  )
  const documentsFiltres = useMemo(() => {
    const q = rechercheDoc.trim().toLowerCase()
    const min = filtreMontantMin.trim() ? Number(filtreMontantMin) : null
    const max = filtreMontantMax.trim() ? Number(filtreMontantMax) : null
    return tousDocuments.filter(d => {
      if (q) {
        const hay = `${d.numero ?? ''} ${nomAffiche(d)} ${d.contenu.totaux.ttc}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filtreType && d.genre !== filtreType) return false
      if (filtreEtat && statutAffiche(d, aujourdhui).label !== filtreEtat) return false
      if (filtreClient && nomAffiche(d) !== filtreClient) return false
      if (min !== null && !Number.isNaN(min) && d.contenu.totaux.ttc < min) return false
      if (max !== null && !Number.isNaN(max) && d.contenu.totaux.ttc > max) return false
      if (filtrePeriode) {
        // Comparaison en jour civil du navigateur, comme le reste de cet écran (`jourCourt`,
        // plus haut) : pas le jour de Paris exact de `aujourdhui` à quelques heures près, une
        // précision inutile pour un filtre « ce mois-ci »/« cette année ».
        const date = new Date(d.emis_le ?? d.created_at)
        const [ay, am] = aujourdhui.split('-').map(Number)
        const dy = date.getFullYear()
        const dm = date.getMonth() + 1
        if (filtrePeriode === 'mois' && !(dy === ay && dm === am)) return false
        if (filtrePeriode === 'mois-1') {
          const pm = am === 1 ? 12 : am - 1
          const py = am === 1 ? ay - 1 : ay
          if (!(dy === py && dm === pm)) return false
        }
        if (filtrePeriode === 'annee' && dy !== ay) return false
      }
      return true
    })
  }, [tousDocuments, rechercheDoc, filtreType, filtreEtat, filtreClient, filtreMontantMin, filtreMontantMax, filtrePeriode, aujourdhui])
  const totalFiltre = documentsFiltres.reduce((s, d) => s + d.contenu.totaux.ttc, 0)
  // Les devis n'entrent jamais dans « impayés » : ils ne réclament rien (même principe que
  // `estPayee()`, qui n'existe que pour une facture).
  const impayeFiltre = documentsFiltres
    .filter(d => d.genre === 'facture' && !d.paye_le)
    .reduce((s, d) => s + d.contenu.totaux.ttc, 0)

  // Communes aux deux présentations : la feuille de saisie (centrée par `Feuille` dès 640px de
  // large, sans rien à changer ici), la question du paiement et la confirmation de suppression.
  const sheets = (
    <>
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
    </>
  )

  if (grandEcran) {
    return (
      <div className="space-y-5 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]">
        <div className="flex items-center gap-1 pb-2">
          <div className="min-w-0 flex-1">
            <h1 className={`text-[21px] ${titre}`}>Documents</h1>
            <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Devis et factures</p>
          </div>
          <button
            type="button"
            onClick={() => setNouveau('devis')}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--v2-radius-pilule)] px-4 text-[13.5px] text-white ${corpsFort} transition-transform active:scale-[.97] motion-reduce:transition-none`}
            style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            <Plus size={16} strokeWidth={2.4} aria-hidden />
            Nouveau
          </button>
        </div>

        {erreur && <Constat ton="rouge" role="alert">{erreur}</Constat>}
        {message && (
          <p role="status" className={`text-[13.5px] leading-snug ${corps}`} style={{ color: 'var(--v2-color-vert)' }}>{message}</p>
        )}

        {documents === null ? (
          <p className={`py-10 text-center text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Chargement…</p>
        ) : (
          <>
            <div className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-[230px] shrink-0">
                  <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--v2-color-gris)]" aria-hidden />
                  <input
                    type="search"
                    inputMode="search"
                    value={rechercheDoc}
                    onChange={e => setRechercheDoc(e.target.value)}
                    placeholder="N°, client ou montant"
                    aria-label="Rechercher un document"
                    autoComplete="off"
                    className={`${FILTRE_CHAMP} w-full pl-9 pr-3 placeholder:text-[color:var(--v2-color-gris)] [&::-webkit-search-cancel-button]:hidden`}
                  />
                </div>
                <select
                  value={filtreType}
                  onChange={e => setFiltreType(e.target.value as '' | GenreDocument)}
                  aria-label="Filtrer par type"
                  className={`${FILTRE_CHAMP} w-auto px-3`}
                >
                  <option value="">Type · tous</option>
                  <option value="devis">Devis</option>
                  <option value="facture">Facture</option>
                </select>
                <select
                  value={filtreEtat}
                  onChange={e => setFiltreEtat(e.target.value)}
                  aria-label="Filtrer par état"
                  className={`${FILTRE_CHAMP} w-auto px-3`}
                >
                  <option value="">État · tous</option>
                  {etatsOptions.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select
                  value={filtrePeriode}
                  onChange={e => setFiltrePeriode(e.target.value as typeof filtrePeriode)}
                  aria-label="Filtrer par période"
                  className={`${FILTRE_CHAMP} w-auto px-3`}
                >
                  <option value="">Période · toute</option>
                  <option value="mois">Ce mois-ci</option>
                  <option value="mois-1">Mois dernier</option>
                  <option value="annee">Cette année</option>
                </select>
                <select
                  value={filtreClient}
                  onChange={e => setFiltreClient(e.target.value)}
                  aria-label="Filtrer par client"
                  className={`${FILTRE_CHAMP} w-auto px-3`}
                >
                  <option value="">Client · tous</option>
                  {clientsOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex h-10 items-center gap-1.5 rounded-[var(--v2-radius-pilule)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={filtreMontantMin}
                    onChange={e => setFiltreMontantMin(e.target.value)}
                    placeholder="min"
                    aria-label="Montant minimum"
                    className={`w-12 bg-transparent text-center text-[13px] ${corps} text-[color:var(--v2-color-encre)] outline-none`}
                  />
                  <span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>–</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={filtreMontantMax}
                    onChange={e => setFiltreMontantMax(e.target.value)}
                    placeholder="max"
                    aria-label="Montant maximum"
                    className={`w-12 bg-transparent text-center text-[13px] ${corps} text-[color:var(--v2-color-encre)] outline-none`}
                  />
                  <span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>€</span>
                </div>
              </div>
            </div>

            <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`} aria-live="polite">
              <span className={`${corpsFort} text-[color:var(--v2-color-encre)] tabular-nums`}>{documentsFiltres.length}</span>
              {` document${documentsFiltres.length > 1 ? 's' : ''} · `}
              <span className={`${corpsFort} text-[color:var(--v2-color-encre)] tabular-nums`}>{euros.format(totalFiltre)}</span>
              {impayeFiltre > 0 && (
                <>
                  {' dont '}
                  <span className={`${corpsFort} tabular-nums`} style={{ color: 'var(--v2-color-ambre)' }}>{euros.format(impayeFiltre)}</span>
                  {' impayés'}
                </>
              )}
            </p>

            {documents.length === 0 ? (
              <div className="flex h-[420px] items-center justify-center rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] px-8 text-center">
                <div className="max-w-[420px]">
                  <p className={`text-[22px] leading-snug ${titre}`}>Rien pour l’instant</p>
                  <p className={`mt-2.5 text-[13.5px] leading-relaxed ${corps} text-[color:var(--v2-color-gris)]`}>
                    Un client demande un prix pour des tapis, un canapé, une remise en état ? Faites-lui
                    un devis. Un chantier est arrivé par le bouche-à-oreille, sans passer par votre
                    page ? Faites la facture ici.
                  </p>
                  <div className="mt-4 flex justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setNouveau('devis')}
                      className={`${BOUTON} text-white`}
                      style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
                    >
                      Nouveau devis
                    </button>
                    <button
                      type="button"
                      onClick={() => setNouveau('facture')}
                      className={`${BOUTON} border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
                      style={PRESSION}
                    >
                      Nouvelle facture
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-4" style={{ height: 'max(420px, calc(100vh - 340px))' }}>
                <div className="h-full w-[380px] shrink-0 overflow-y-auto rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
                  {documentsFiltres.length === 0 ? (
                    <p className={`px-4 py-7 text-center text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
                      Aucun document ne correspond à ces filtres.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[color:var(--v2-filet)]">
                      {documentsFiltres.map(d => (
                        <LigneDocumentBureauV2
                          key={d.id}
                          document={d}
                          aujourdhui={aujourdhui}
                          selectionnee={ouvert?.id === d.id}
                          onOuvrir={() => { setMessage(null); setOuvertId(d.id) }}
                        />
                      ))}
                    </ul>
                  )}
                </div>
                <div className="h-full min-w-0 flex-1">
                  {ouvert ? (
                    <FicheDocumentBureauV2
                      key={ouvert.id}
                      document={ouvert}
                      aujourdhui={aujourdhui}
                      nomLaveur={nomLaveur}
                      occupe={occupe}
                      onEnvoyer={() => void agir(async () => {
                        const r = await envoyerDocument(ouvert.id)
                        if (r.ok) confirmerEnvoi({ titre: 'Email envoyé', detail: `${libelleGenre(ouvert.genre)} ${ouvert.numero ?? ''} pour ${ouvert.contenu.client.nom}`.replace(/\s+/g, ' ').trim() })
                        return r
                      }, 'Envoyé au client.')}
                      onRepondre={statut => void agir(
                        () => repondreDevis(ouvert.id, statut),
                        statut === 'accepte' ? 'Devis accepté. Vous pouvez le transformer en facture.' : 'Devis marqué refusé.',
                        { fermer: statut === 'refuse' },
                      )}
                      onFacturer={() => void facturer(ouvert)}
                      onPayer={paye => void payer(ouvert.id, paye)}
                      onSupprimer={() => { setSuppressionErreur(null); setSuppression(ouvert); setOuvertId(null) }}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2.5 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-6 text-center">
                      <FileText size={22} strokeWidth={1.8} className="text-[color:var(--v2-color-gris)]" aria-hidden />
                      <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
                        Sélectionnez un document pour voir sa fiche.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {sheets}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]">
      <div className="flex items-center gap-1 pb-2">
        <FlecheRetourDocuments />
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

      {ouvert && (
        <FeuilleActionsDocumentV2
          document={ouvert}
          nomLaveur={nomLaveur}
          occupe={occupe}
          onEnvoyer={() => void agir(async () => {
            const r = await envoyerDocument(ouvert.id)
            if (r.ok) confirmerEnvoi({ titre: 'Email envoyé', detail: `${libelleGenre(ouvert.genre)} ${ouvert.numero ?? ''} pour ${ouvert.contenu.client.nom}`.replace(/\s+/g, ' ').trim() })
            return r
          }, 'Envoyé au client.')}
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

      {sheets}
    </div>
  )
}

'use client'

import { Phone } from 'lucide-react'
import { Feuille, BOUTON, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { confirmerEnvoi, annoncerApresRetour } from '@/lib/confirmationEnvoi'
import { libelleGenre, messageWhatsapp, nomFichierDocument, partagerPdf, type Document } from '@/lib/documents'
import { whatsappDigits } from '@/lib/phone'

// Ce qu'on peut encore faire d'un document, une fois ouvert — extrait de `DocumentsV2.tsx` le
// 2026-09-28 pour que la Fiche entreprise puisse ouvrir la MÊME feuille sur une facture
// impayée (Alexandre : « quand je clique sur la notification de la facture […] il faut que ça
// m'affiche la facture avec télécharger envoyer etc »), sans dupliquer ce bloc.
//
// « Appeler » (2026-09-28, même demande : « sur une facture pro comme celle-ci on peut appeler
// depuis la fiche de la facture ») s'ajoute à côté de WhatsApp — même condition (un téléphone
// existe), pas réservée aux factures « pro » : un particulier avec un numéro peut tout autant
// être appelé depuis sa facture.

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const jourCourt = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/** Le pictogramme WhatsApp, exporté pour que le panneau bureau de `DocumentsV2.tsx`
 *  (`FicheDocumentBureauV2`) puisse réutiliser exactement le même trait plutôt que de le
 *  recopier une seconde fois — le reste du bouton (partage natif, repli `wa.me`) n'a pas
 *  besoin d'être partagé, lui, puisque les deux présentations appellent le même callback
 *  `onEnvoyerWhatsapp` posé par l'appelant (`DocumentsV2.tsx`). */
export function IconeWhatsapp({ taille = 17 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.3 4.7 4.84-1.27A9.9 9.9 0 1 0 12.04 2m0 1.8a8.1 8.1 0 1 1-4.1 15.09l-.29-.17-2.87.75.77-2.8-.19-.3A8.1 8.1 0 0 1 12.04 3.8m-3.2 4c-.15 0-.4.06-.61.29-.21.23-.8.79-.8 1.92s.82 2.23.94 2.38c.11.15 1.6 2.55 3.94 3.47 1.95.77 2.35.62 2.77.58.42-.04 1.36-.55 1.55-1.09.19-.54.19-1 .14-1.1-.06-.09-.21-.15-.44-.27-.23-.11-1.36-.67-1.57-.75-.21-.08-.36-.11-.51.12-.15.23-.59.74-.72.9-.13.15-.26.17-.49.06-.23-.12-.97-.36-1.85-1.14-.68-.61-1.15-1.36-1.28-1.59-.13-.23-.01-.35.1-.47.1-.1.23-.27.34-.4.11-.14.15-.23.23-.38.08-.16.04-.29-.02-.4-.06-.12-.51-1.25-.71-1.71-.17-.41-.35-.41-.5-.42z" />
    </svg>
  )
}

export default function FeuilleActionsDocumentV2({
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
        {d.contenu.client.telephone && (
          <a
            href={`tel:${d.contenu.client.telephone}`}
            className={`${secondaire} gap-2`}
            style={PRESSION}
          >
            <Phone size={16} strokeWidth={2} aria-hidden />
            Appeler {client}
          </a>
        )}
        {/* WhatsApp : c'est par là que les clients des laveurs répondent. Le PDF n'y est pas
            joint mais lié — `wa.me` ne sait pas joindre un fichier. */}
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
              if (partage === 'annule') return
              const cible = `${libelleGenre(d.genre)} ${d.numero ?? ''}`.trim()
              if (partage === 'envoye') {
                confirmerEnvoi({ titre: 'PDF envoyé', detail: `${cible} pour ${client}` })
                return
              }
              annoncerApresRetour({ titre: 'Message envoyé', detail: `${cible} pour ${client}` })
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

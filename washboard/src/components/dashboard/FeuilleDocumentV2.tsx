'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Feuille, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort, puce } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'
import AdresseV2 from '@/components/dashboard/AdresseV2'
import { montantNombre } from '@/lib/depenses'
import {
  dateDansNJours, ligneVide, saisieNeuve, totalDocument, validerDocument,
  VALIDITE_DEVIS_JOURS, type GenreDocument, type LigneSaisie, type SaisieDocument,
} from '@/lib/documents'

// « Nouveau devis · Nouvelle facture » — feuille du bas de l'écran Devis et factures (PWA).
//
// Un seul formulaire pour les deux : à part la validité (le devis) et la date de prestation
// (la facture), tout est identique. Deux formulaires auraient divergé, et le laveur aurait dû
// apprendre deux écrans pour un même geste.
//
// Les prix se saisissent TTC, comme sur la page de réservation : c'est ce que le client paie.
// La TVA, si le laveur y est assujetti, est extraite à la construction du document.

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

type Prestation = { id: string; name: string; price: number }

/** Une ligne du document : désignation large, quantité et prix serrés à droite. */
function LigneSaisieV2({
  ligne, index, seule, onChange, onRetirer,
}: {
  ligne: LigneSaisie
  index: number
  seule: boolean
  onChange: (l: LigneSaisie) => void
  onRetirer: () => void
}) {
  // Le prix vit en texte tant qu'on tape : « 12, » n'est pas encore un nombre, et le
  // convertir à chaque frappe empêcherait d'écrire la virgule.
  const [prix, setPrix] = useState(() => (ligne.prixUnitaireTtc ? String(ligne.prixUnitaireTtc).replace('.', ',') : ''))
  const [quantite, setQuantite] = useState(() => String(ligne.quantite))

  return (
    <div className="flex flex-col gap-2 border-t border-[color:var(--v2-filet)] pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={ligne.designation}
          onChange={e => onChange({ ...ligne, designation: e.target.value })}
          placeholder="Nettoyage canapé 3 places"
          aria-label={`Désignation de la ligne ${index + 1}`}
          className={CHAMP}
        />
        {!seule && (
          <button
            type="button"
            onClick={onRetirer}
            aria-label={`Retirer la ligne ${index + 1}`}
            className="flex h-11 w-9 shrink-0 items-center justify-center text-[color:var(--v2-color-gris)]"
          >
            <Trash2 size={18} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* Largeur portée par le conteneur : le champ est en `w-full`, un `w-16` sur lui
            perdrait l'arbitrage Tailwind selon l'ordre du CSS, pas celui des classes. */}
        <label className="flex shrink-0 items-center gap-2">
          <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Qté</span>
          <span className="block w-[68px]">
            <input
              type="text"
              inputMode="numeric"
              value={quantite}
              onChange={e => {
                setQuantite(e.target.value)
                onChange({ ...ligne, quantite: Math.trunc(montantNombre(e.target.value)) || 0 })
              }}
              aria-label={`Quantité de la ligne ${index + 1}`}
              className={`${CHAMP} text-center tabular-nums`}
            />
          </span>
        </label>
        <label className="relative min-w-0 flex-1">
          <input
            type="text"
            inputMode="decimal"
            value={prix}
            onChange={e => {
              setPrix(e.target.value)
              onChange({ ...ligne, prixUnitaireTtc: montantNombre(e.target.value) || 0 })
            }}
            placeholder="0,00"
            aria-label={`Prix unitaire de la ligne ${index + 1}`}
            className={`${CHAMP} pr-8 text-right tabular-nums`}
          />
          <span
            aria-hidden
            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}
          >
            €
          </span>
        </label>
      </div>
    </div>
  )
}

export default function FeuilleDocumentV2({
  aujourdhui, prestations, genreInitial, prefill, onEnregistrer, onClose,
}: {
  /** Jour de Paris, `AAAA-MM-JJ`. */
  aujourdhui: string
  /** Les prestations du laveur, pour remplir une ligne d'un tap au lieu de la taper. */
  prestations: Prestation[]
  genreInitial: GenreDocument
  /** Champs client posés d'avance — depuis la Fiche entreprise (2026-09-28), qui connaît déjà
   *  le nom, les coordonnées et l'entreprise du contact. Complète `saisieNeuve`, ne le remplace
   *  pas : les lignes, la remise, la validité restent celles d'un document tout neuf. */
  prefill?: Partial<SaisieDocument>
  /** `null` quand c'est émis, sinon la phrase à afficher — la feuille reste ouverte. */
  onEnregistrer: (saisie: SaisieDocument) => Promise<string | null>
  onClose: () => void
}) {
  const [saisie, setSaisie] = useState<SaisieDocument>(() => ({ ...saisieNeuve(genreInitial, aujourdhui), ...prefill }))
  const [remise, setRemise] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const refErreur = useRef<HTMLDivElement>(null)

  // Le formulaire est long : un refus affiché tout en bas, alors qu'on est resté en haut sur
  // le champ fautif, donne un bouton « Créer » qui semble ne rien faire. On amène le message
  // sous les yeux (même défaut que le bouton « Continuer » de la couleur de marque, 2026-09-26).
  useEffect(() => {
    if (erreur) refErreur.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [erreur])

  const devis = saisie.genre === 'devis'
  const modifier = (champs: Partial<SaisieDocument>) => {
    setSaisie(s => ({ ...s, ...champs }))
    setErreur(null)
  }

  /** Changer de genre ne doit rien effacer de ce qui est déjà tapé : seules la validité et la
   *  date de prestation, propres à l'un ou à l'autre, sont réajustées. */
  function changerGenre(genre: GenreDocument) {
    modifier({
      genre,
      valableJusquau: genre === 'devis' ? (saisie.valableJusquau ?? dateDansNJours(aujourdhui, VALIDITE_DEVIS_JOURS)) : null,
      date: genre === 'facture' ? (saisie.date ?? aujourdhui) : saisie.date,
    })
  }

  function ajouterPrestation(p: Prestation) {
    setSaisie(s => {
      const lignes = s.lignes.filter(l => l.designation.trim())
      return { ...s, lignes: [...lignes, { designation: p.name, quantite: 1, prixUnitaireTtc: Number(p.price) }] }
    })
    setErreur(null)
  }

  const total = totalDocument({ ...saisie, remiseTtc: montantNombre(remise) || 0 })

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    const complet: SaisieDocument = { ...saisie, remiseTtc: montantNombre(remise) || 0 }
    const refus = validerDocument(complet, aujourdhui)
    if (refus) { setErreur(refus); return }
    setEnCours(true)
    const message = await onEnregistrer(complet)
    setEnCours(false)
    if (message) setErreur(message)
    else onClose()
  }

  return (
    <Feuille
      titre={devis ? 'Nouveau devis' : 'Nouvelle facture'}
      sousTitre={devis
        ? 'Un prix engageant, valable un temps donné. Il ne compte pas tant que le client n’a pas dit oui.'
        : 'Une facture pour un travail fait hors de votre page de réservation.'}
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={enCours} libelle={devis ? 'Créer le devis' : 'Créer la facture'} onClose={onClose} formulaire="document-nouveau" />}
    >
      <form id="document-nouveau" onSubmit={soumettre} noValidate>
        <div className="flex gap-2 pb-1" role="group" aria-label="Type de document">
          {(['devis', 'facture'] as const).map(g => (
            <button
              key={g}
              type="button"
              aria-pressed={saisie.genre === g}
              onClick={() => changerGenre(g)}
              className={`${puce(saisie.genre === g)} flex-1 justify-center`}
              style={PRESSION}
            >
              {g === 'devis' ? 'Devis' : 'Facture'}
            </button>
          ))}
        </div>

        <Bloc titre="Le client">
          <input
            type="text"
            value={saisie.clientNom}
            onChange={e => modifier({ clientNom: e.target.value })}
            placeholder="Marie Martin"
            aria-label="Nom du client"
            className={CHAMP}
          />
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={saisie.clientEmail}
            onChange={e => modifier({ clientEmail: e.target.value })}
            placeholder="marie@exemple.fr"
            aria-label="Email du client"
            className={`${CHAMP} mt-2`}
          />
          <input
            type="tel"
            inputMode="tel"
            value={saisie.clientTelephone}
            onChange={e => modifier({ clientTelephone: e.target.value })}
            placeholder="06 12 34 56 78"
            aria-label="Téléphone du client"
            className={`${CHAMP} mt-2`}
          />
          <p className={`mt-1.5 text-[12px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Le téléphone sert à envoyer le document sur WhatsApp, l’email à l’envoyer d’ici.
            Sans l’un ni l’autre, il reste téléchargeable.
          </p>
          {/* Même champ d'adresse que le reste de la PWA (`AdresseV2`) : suggestions Google
              en ligne, sous le champ, pour ne pas être rognées par la feuille qui défile. */}
          <div className="mt-2">
            <AdresseV2
              id="document-adresse-client"
              valeur={saisie.clientAdresse}
              onChange={v => modifier({ clientAdresse: v })}
              placeholder="Adresse du client"
            />
          </div>
          <button
            type="button"
            aria-pressed={saisie.professionnel}
            onClick={() => modifier({ professionnel: !saisie.professionnel })}
            className={`${puce(saisie.professionnel)} mt-2.5`}
            style={PRESSION}
          >
            C’est un professionnel
          </button>
          {saisie.professionnel && (
            <>
              <input
                type="text"
                value={saisie.entreprise}
                onChange={e => modifier({ entreprise: e.target.value })}
                placeholder="Nom de l’entreprise"
                aria-label="Entreprise du client"
                className={`${CHAMP} mt-2`}
              />
              <input
                type="text"
                inputMode="numeric"
                value={saisie.siret}
                onChange={e => modifier({ siret: e.target.value })}
                placeholder="SIRET (facultatif)"
                aria-label="SIRET du client"
                className={`${CHAMP} mt-2`}
              />
            </>
          )}
        </Bloc>

        <Bloc titre="Les lignes" aide="Prix TTC">
          {prestations.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Ajouter une de mes prestations">
              {prestations.slice(0, 6).map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => ajouterPrestation(p)}
                  className={puce(false)}
                  style={PRESSION}
                >
                  + {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-3">
            {saisie.lignes.map((l, i) => (
              <LigneSaisieV2
                key={i}
                ligne={l}
                index={i}
                seule={saisie.lignes.length === 1}
                onChange={maj => modifier({ lignes: saisie.lignes.map((x, j) => (j === i ? maj : x)) })}
                onRetirer={() => modifier({ lignes: saisie.lignes.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => modifier({ lignes: [...saisie.lignes, ligneVide()] })}
            className={`mt-3 flex h-10 items-center gap-1.5 text-[13.5px] ${corpsFort}`}
            style={{ color: 'var(--v2-color-accent)' }}
          >
            <Plus size={16} strokeWidth={2.4} aria-hidden />
            Ajouter une ligne
          </button>
        </Bloc>

        <Bloc titre="Remise" aide="Facultative">
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={remise}
              onChange={e => { setRemise(e.target.value); setErreur(null) }}
              placeholder="0,00"
              aria-label="Remise en euros"
              className={`${CHAMP} pr-8 text-right tabular-nums`}
            />
            <span
              aria-hidden
              className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}
            >
              €
            </span>
          </div>
        </Bloc>

        <Bloc titre="La prestation">
          <label className="block">
            <span className={ETIQUETTE}>{devis ? 'Date prévue (facultative)' : 'Date de la prestation'}</span>
            <input
              type="date"
              value={saisie.date ?? ''}
              onChange={e => modifier({ date: e.target.value || null })}
              aria-label="Date de la prestation"
              className={CHAMP}
            />
          </label>
          <div className="mt-2">
            <AdresseV2
              id="document-lieu"
              valeur={saisie.lieu}
              onChange={v => modifier({ lieu: v })}
              placeholder="Lieu de la prestation (facultatif)"
            />
          </div>
        </Bloc>

        {devis && (
          <Bloc titre="Valable jusqu’au">
            <input
              type="date"
              value={saisie.valableJusquau ?? ''}
              min={aujourdhui}
              onChange={e => modifier({ valableJusquau: e.target.value || null })}
              aria-label="Valable jusqu’au"
              className={CHAMP}
            />
            <p className={`mt-1.5 text-[12px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Passé cette date, votre prix ne vous engage plus.
            </p>
          </Bloc>
        )}

        <Bloc titre="Mot pour le client" aide="Facultatif">
          <textarea
            value={saisie.note}
            onChange={e => modifier({ note: e.target.value })}
            rows={3}
            placeholder="Intervention sur une demi-journée. Prévoir un point d’eau."
            aria-label="Mot pour le client"
            className={`${CHAMP} h-auto py-2.5 leading-snug`}
          />
        </Bloc>

        <div className="flex items-baseline justify-between border-t border-[color:var(--v2-filet)] pt-3">
          <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Total à payer</span>
          <span className={`text-[22px] ${corpsFort} tabular-nums`}>{euros.format(total)}</span>
        </div>

        <div ref={refErreur} aria-live="polite">
          {erreur && <div className="mt-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
        </div>
      </form>
    </Feuille>
  )
}

'use client'

import { useState } from 'react'
import { Feuille, CHAMP, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied, Puces } from '@/components/dashboard/ReglageAutomatismeV2'
import AdresseV2 from '@/components/dashboard/AdresseV2'

// Feuilles du bas de « Mon profil » (PWA) pour les réglages simples : nom de l'entreprise,
// téléphone, adresse de départ, nombre de laveurs. Mêmes champs et même route que l'ancien
// écran (`ParametresFormV1`, carte « Mon profil ») — seule la présentation change.
//
// `onEnregistrer` rend `null` quand c'est enregistré, sinon la phrase à afficher sur place
// (la feuille reste ouverte, la saisie n'est jamais perdue).

type Enregistrer = (valeur: string) => Promise<string | null>

/** Champ de texte d'une ligne : un intitulé, un champ, « Enregistrer ». */
export function FeuilleTexteV2({
  titre, sousTitre, etiquette, aide, valeur, placeholder, type = 'text', valider, onEnregistrer, onClose,
}: {
  titre: string
  sousTitre?: string
  etiquette: string
  aide?: string
  valeur: string
  placeholder?: string
  type?: 'text' | 'tel'
  /** `null` si la saisie passe, sinon la phrase à afficher. */
  valider?: (saisie: string) => string | null
  onEnregistrer: Enregistrer
  onClose: () => void
}) {
  const [saisie, setSaisie] = useState(valeur)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    const refus = valider?.(saisie) ?? null
    if (refus) { setErreur(refus); return }
    if (saisie.trim() === valeur.trim()) { onClose(); return }
    setErreur(null)
    setEnCours(true)
    const message = await onEnregistrer(saisie.trim())
    setEnCours(false)
    if (message) setErreur(message)
    else onClose()
  }

  return (
    <Feuille
      titre={titre}
      sousTitre={sousTitre}
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="profil-texte" />}
    >
      <form id="profil-texte" onSubmit={soumettre} noValidate>
        <Bloc titre={etiquette}>
          <input
            type={type}
            inputMode={type === 'tel' ? 'tel' : undefined}
            autoComplete={type === 'tel' ? 'tel' : 'organization'}
            value={saisie}
            onChange={e => { setSaisie(e.target.value); setErreur(null) }}
            placeholder={placeholder}
            aria-label={etiquette}
            aria-invalid={!!erreur}
            className={CHAMP}
          />
          {erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          {aide && <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{aide}</p>}
        </Bloc>
      </form>
    </Feuille>
  )
}

/** Adresse de départ : le point d'où partent les trajets, et donc les frais de déplacement. */
export function FeuilleAdresseDepartV2({
  adresse, onEnregistrer, onClose,
}: { adresse: string; onEnregistrer: Enregistrer; onClose: () => void }) {
  const [saisie, setSaisie] = useState(adresse)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    if (saisie.trim() === adresse.trim()) { onClose(); return }
    setErreur(null)
    setEnCours(true)
    const message = await onEnregistrer(saisie.trim())
    setEnCours(false)
    if (message) setErreur(message)
    else onClose()
  }

  return (
    <Feuille
      titre="Adresse de départ"
      sousTitre="D’où vous partez le matin."
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="profil-adresse" />}
    >
      <form id="profil-adresse" onSubmit={soumettre} noValidate>
        <Bloc titre="Votre adresse">
          <AdresseV2
            id="profil-adresse-champ"
            valeur={saisie}
            onChange={v => { setSaisie(v); setErreur(null) }}
            placeholder="12 rue de la Paix, 75001 Paris"
            erreur={erreur}
          />
          <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Sert à calculer la distance jusqu’à vos clients, et les frais de déplacement.
          </p>
        </Bloc>
      </form>
    </Feuille>
  )
}

const LAVEURS = [1, 2, 3, 4, 5]

/** Nombre de laveurs : combien de rendez-vous peuvent se chevaucher. Réservé au plan Pro —
 *  l'écran n'ouvre pas cette feuille sans lui. */
export function FeuilleEquipeV2({
  nombre, onEnregistrer, onClose,
}: { nombre: number; onEnregistrer: (n: number) => Promise<string | null>; onClose: () => void }) {
  const depart = Math.max(1, nombre)
  const [choix, setChoix] = useState<number | 'autre'>(LAVEURS.includes(depart) ? depart : 'autre')
  const [libre, setLibre] = useState(String(depart))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  // Le serveur borne lui aussi (1 à 50) : ici on ne fait que montrer un chiffre cohérent.
  const n = choix === 'autre' ? Math.max(1, Math.min(50, Math.floor(Number(libre) || 1))) : choix

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    if (n === nombre) { onClose(); return }
    setErreur(null)
    setEnCours(true)
    const message = await onEnregistrer(n)
    setEnCours(false)
    if (message) setErreur(message)
    else onClose()
  }

  return (
    <Feuille
      titre="Nombre de laveurs"
      sousTitre="Vous compris."
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="profil-equipe" />}
    >
      <form id="profil-equipe" onSubmit={soumettre} noValidate>
        <Bloc titre="Combien êtes-vous à laver">
          <Puces
            nom="Nombre de laveurs"
            valeurs={LAVEURS}
            libelle={v => String(v)}
            valeur={choix}
            autre
            onChoisir={v => { setChoix(v); setErreur(null) }}
          />
          {choix === 'autre' && (
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={libre}
              onChange={e => { setLibre(e.target.value); setErreur(null) }}
              aria-label="Nombre de laveurs"
              className={`${CHAMP} mt-2.5`}
            />
          )}
          <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            {n > 1
              ? `Jusqu’à ${n} rendez-vous en même temps sur votre page de réservation.`
              : 'Un seul rendez-vous à la fois : aucun chevauchement possible.'}
          </p>
          {erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
        </Bloc>
      </form>
    </Feuille>
  )
}

'use client'

import { useState } from 'react'
import { Feuille, CHAMP, PRESSION, BOUTON, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied, Puces } from '@/components/dashboard/ReglageAutomatismeV2'
import { validerFacturation } from '@/lib/profil'
import { TAUX_TVA, infosFacturationManquantes, phraseManques, type RegimeTva, type StatutJuridique } from '@/lib/facture'
import type { ChampsProfil } from '@/lib/profilApi'

// « Mon statut et mes factures » — feuille du bas de « Mon profil » (PWA). Ce sont les mentions
// portées sur les factures envoyées aux clients : tant qu'il en manque une, aucune facture
// n'est émise (le client reçoit un récapitulatif, qui ne se présente pas comme une facture).
//
// Mêmes champs, mêmes règles et même route que l'ancien écran (`FacturationCard`, conservé pour
// le site). Ce qui change : les champs de société n'apparaissent qu'en société, ceux de TVA
// qu'en assujetti — l'ancien écran les montrait tous, tout le temps.

const FORMES = ['SASU', 'SAS', 'EURL', 'SARL', 'SA', 'SNC']

type Props = {
  washer: {
    facture_statut?: StatutJuridique
    facture_nom_legal?: string | null
    facture_siret?: string | null
    facture_adresse?: string | null
    facture_forme_juridique?: string | null
    facture_capital?: string | null
    facture_immatriculation?: string | null
    facture_regime_tva?: RegimeTva
    facture_taux_tva?: number
    facture_numero_tva?: string | null
    facture_prochain_numero?: number
  }
  /** `null` si enregistré, sinon la phrase à afficher. */
  onEnregistrer: (champs: ChampsProfil) => Promise<string | null>
  onClose: () => void
}

function ChoixDeux<T extends string>({ nom, valeur, options, onChange }: {
  nom: string
  valeur: T
  options: readonly { valeur: T; libelle: string; aide: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={nom}>
      {options.map(o => {
        const actif = valeur === o.valeur
        return (
          <button
            key={o.valeur}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(o.valeur)}
            className={`rounded-[var(--v2-radius-bouton)] border px-3.5 py-3 text-left transition-colors motion-reduce:transition-none ${
              actif
                ? 'border-[color:var(--v2-color-encre)] bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)]'
                : 'border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)]'
            }`}
            style={PRESSION}
          >
            <span className="block text-[15px] font-semibold">{o.libelle}</span>
            <span className={`mt-0.5 block text-[12.5px] leading-snug ${actif ? 'opacity-80' : 'text-[color:var(--v2-color-gris)]'}`}>
              {o.aide}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function FeuilleFacturationV2({ washer, onEnregistrer, onClose }: Props) {
  const [statut, setStatut] = useState<StatutJuridique>(washer.facture_statut ?? 'ei')
  const [nomLegal, setNomLegal] = useState(washer.facture_nom_legal ?? '')
  const [siret, setSiret] = useState(washer.facture_siret ?? '')
  const [adresse, setAdresse] = useState(washer.facture_adresse ?? '')
  const [forme, setForme] = useState(washer.facture_forme_juridique ?? '')
  const [capital, setCapital] = useState(washer.facture_capital ?? '')
  const [immatriculation, setImmatriculation] = useState(washer.facture_immatriculation ?? '')
  const [regime, setRegime] = useState<RegimeTva>(washer.facture_regime_tva ?? 'franchise')
  const [taux, setTaux] = useState<number>(washer.facture_taux_tva ?? 20)
  const [numeroTva, setNumeroTva] = useState(washer.facture_numero_tva ?? '')
  const numeroActuel = washer.facture_prochain_numero ?? 1
  const [prochainNumero, setProchainNumero] = useState(String(numeroActuel))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const societe = statut === 'societe'
  const assujetti = regime === 'assujetti'
  const manques = infosFacturationManquantes({
    facture_statut: statut,
    facture_nom_legal: nomLegal,
    facture_siret: siret,
    facture_adresse: adresse,
    facture_forme_juridique: forme,
    facture_capital: capital,
    facture_immatriculation: immatriculation,
    facture_regime_tva: regime,
    facture_numero_tva: numeroTva,
  })

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    const refus = validerFacturation({ siret, regime, numeroTva, prochainNumero, numeroActuel })
    if (refus) { setErreur(refus); return }
    setErreur(null)
    setEnCours(true)
    const message = await onEnregistrer({
      facture_statut: statut,
      facture_nom_legal: nomLegal,
      facture_siret: siret,
      facture_adresse: adresse,
      // Les champs de société ne veulent rien dire pour une entreprise individuelle : on les
      // vide plutôt que de les laisser traîner sur les factures.
      facture_forme_juridique: societe ? forme : '',
      facture_capital: societe ? capital : '',
      facture_immatriculation: societe ? immatriculation : '',
      facture_regime_tva: regime,
      facture_taux_tva: taux,
      facture_numero_tva: assujetti ? numeroTva : '',
      // Envoyé seulement s'il a changé : le serveur refuse de revenir en arrière.
      ...(Number(prochainNumero) !== numeroActuel ? { facture_prochain_numero: Number(prochainNumero) } : {}),
    })
    setEnCours(false)
    if (message) setErreur(message)
    else onClose()
  }

  return (
    <Feuille
      titre="Mon statut et mes factures"
      sousTitre="Ce qui figure sur les factures envoyées à vos clients."
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="profil-facturation" />}
    >
      <form id="profil-facturation" onSubmit={soumettre} noValidate>
        <Bloc titre="Votre statut">
          <ChoixDeux
            nom="Statut"
            valeur={statut}
            onChange={setStatut}
            options={[
              { valeur: 'ei', libelle: 'Entreprise individuelle', aide: 'Auto-entrepreneur, micro-entreprise, EI' },
              { valeur: 'societe', libelle: 'Société', aide: 'SASU, SAS, EURL, SARL…' },
            ] as const}
          />
        </Bloc>

        <Bloc titre={societe ? 'Raison sociale' : 'Votre nom légal'}>
          <input
            type="text"
            value={nomLegal}
            onChange={e => { setNomLegal(e.target.value); setErreur(null) }}
            placeholder={societe ? 'AutoNettoyage' : 'Jean Dupont'}
            aria-label={societe ? 'Raison sociale' : 'Nom légal'}
            className={CHAMP}
          />
          <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            {societe
              ? 'Le nom déposé de votre société, tel qu’il figure sur votre Kbis.'
              : 'Votre prénom et nom, tels que déclarés. La mention « EI » est ajoutée toute seule.'}
          </p>
        </Bloc>

        <Bloc titre="SIRET">
          <input
            type="text"
            inputMode="numeric"
            value={siret}
            onChange={e => { setSiret(e.target.value); setErreur(null) }}
            placeholder="123 456 789 00012"
            aria-label="SIRET"
            className={CHAMP}
          />
        </Bloc>

        <Bloc titre="Adresse professionnelle">
          <input
            type="text"
            value={adresse}
            onChange={e => { setAdresse(e.target.value); setErreur(null) }}
            placeholder="8 rue des Lilas, 95560 Maffliers"
            aria-label="Adresse professionnelle"
            className={CHAMP}
          />
        </Bloc>

        {societe && (
          <>
            <Bloc titre="Forme juridique">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Forme juridique">
                {FORMES.map(f => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={forme === f}
                    onClick={() => setForme(f)}
                    className={`${BOUTON} border px-3.5 ${
                      forme === f
                        ? 'border-[color:var(--v2-color-encre)] bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)]'
                        : 'border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-gris)]'
                    }`}
                    style={PRESSION}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={forme}
                onChange={e => setForme(e.target.value)}
                placeholder="Autre forme"
                aria-label="Forme juridique"
                className={`${CHAMP} mt-2.5`}
              />
            </Bloc>

            <Bloc titre="Capital social">
              <input
                type="text"
                value={capital}
                onChange={e => setCapital(e.target.value)}
                placeholder="1 000 €"
                aria-label="Capital social"
                className={CHAMP}
              />
            </Bloc>

            <Bloc titre="Immatriculation (RCS)">
              <input
                type="text"
                value={immatriculation}
                onChange={e => setImmatriculation(e.target.value)}
                placeholder="RCS Pontoise 123 456 789"
                aria-label="Immatriculation"
                className={CHAMP}
              />
            </Bloc>
          </>
        )}

        <Bloc titre="TVA">
          <ChoixDeux
            nom="Régime de TVA"
            valeur={regime}
            onChange={setRegime}
            options={[
              { valeur: 'franchise', libelle: 'Franchise en base', aide: 'Vous ne facturez pas la TVA (cas le plus courant)' },
              { valeur: 'assujetti', libelle: 'Assujetti', aide: 'Vous facturez la TVA et la reversez' },
            ] as const}
          />
          {assujetti && (
            <div className="mt-3 space-y-3">
              <div>
                <p className={`mb-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Taux appliqué</p>
                <Puces
                  nom="Taux de TVA"
                  valeurs={TAUX_TVA}
                  libelle={v => `${String(v).replace('.', ',')} %`}
                  valeur={taux}
                  onChoisir={v => { if (v !== 'autre') setTaux(v) }}
                />
              </div>
              <div>
                <p className={`mb-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Numéro de TVA</p>
                <input
                  type="text"
                  value={numeroTva}
                  onChange={e => { setNumeroTva(e.target.value); setErreur(null) }}
                  placeholder="FR12345678901"
                  aria-label="Numéro de TVA"
                  className={CHAMP}
                />
              </div>
            </div>
          )}
        </Bloc>

        <Bloc titre="Prochain numéro de facture">
          <input
            type="number"
            inputMode="numeric"
            min={numeroActuel}
            value={prochainNumero}
            onChange={e => { setProchainNumero(e.target.value); setErreur(null) }}
            aria-label="Prochain numéro de facture"
            className={CHAMP}
          />
          <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Vos factures sont numérotées sans trou et sans retour en arrière. Vous pouvez seulement
            avancer, par exemple pour reprendre la suite d’un autre logiciel.
          </p>
        </Bloc>

        <div className="space-y-2 pb-1" aria-live="polite">
          {manques.length > 0 && <Constat ton="ambre" role="status">{phraseManques(manques)}</Constat>}
          {erreur && <Constat ton="rouge" role="alert">{erreur}</Constat>}
        </div>
      </form>
    </Feuille>
  )
}

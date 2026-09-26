'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { CarteListe } from '@/components/dashboard/ParametresFormV2'
import { LigneDeuxNiveaux as Ligne } from '@/components/dashboard/PrestationsUiV2'
import { Section } from '@/components/dashboard/PrestationsV2'
import { corps, titre } from '@/components/dashboard/FeuilleV2'
import { FeuilleAdresseDepartV2, FeuilleEquipeV2, FeuilleTexteV2 } from '@/components/dashboard/FeuillesProfilV2'
import FeuilleFacturationV2 from '@/components/dashboard/FeuilleFacturationV2'
import { FeuilleEmailV2, FeuilleMotDePasseV2 } from '@/components/dashboard/FeuillesConnexionV2'
import { enregistrerProfil, type ChampsProfil } from '@/lib/profilApi'
import {
  resumeAdresseDepart, resumeEmail, resumeEquipe, resumeFacturation, resumeNomEntreprise, resumeTelephone,
  validerNomEntreprise, validerTelephone,
} from '@/lib/profil'
import type { Washer } from '@/types'

// « Mon profil » — refonte 2026, destination NEUVE de « Plus » (Alexandre, 2026-09-26 : la
// ligne « Équipe » devient « Mon profil », et c'est là-dedans qu'on renseigne son téléphone,
// son adresse de départ, le nom de l'entreprise, son statut pour les factures, son adresse
// mail et son mot de passe). Réservé à la PWA installée (voir `Profil.tsx`, le garde-fou :
// le site est renvoyé vers `/dashboard/parametres/tout#profil`, l'ancien formulaire, inchangé).
//
// Trois sections : l'entreprise (ce que voient les clients et ce qui calcule les trajets), la
// facturation (les mentions légales portées sur les factures), et la connexion (identifiants).
// Chaque ligne ouvre sa feuille ; aucune saisie n'est enregistrée sans un « Enregistrer ».
//
// Le nombre de laveurs vient de l'ancienne ligne « Équipe » : il n'a pas d'autre écran v2, et
// le perdre reviendrait à ne plus pouvoir régler les rendez-vous simultanés depuis la PWA.
//
// Les frais de déplacement, eux, restent sur l'ancien écran (« Tous les réglages ») : ils
// doivent rejoindre la zone d'intervention, pas ce profil — voir TODO.md.

type Feuille =
  | 'nom' | 'telephone' | 'adresse' | 'equipe' | 'facturation' | 'email' | 'motDePasse' | null

export default function ProfilV2({ washer, email, peutEquipe }: { washer: Washer; email: string; peutEquipe: boolean }) {
  const router = useRouter()
  // Copie locale : la ligne change tout de suite après un enregistrement réussi, sans attendre
  // le rechargement de la page (`router.refresh()`, lancé en plus pour le reste de l'écran).
  const [fiche, setFiche] = useState(washer)
  const [feuille, setFeuille] = useState<Feuille>(null)

  const fermer = () => setFeuille(null)

  /** Enregistre, met la fiche à jour, et rend `null` — ou la phrase d'échec, affichée dans la
   *  feuille, qui reste alors ouverte avec la saisie. */
  async function enregistrer(champs: ChampsProfil): Promise<string | null> {
    const r = await enregistrerProfil(champs)
    if (!r.ok) return r.message
    setFiche(f => ({ ...f, ...champs }) as Washer)
    router.refresh()
    return null
  }

  const nom = resumeNomEntreprise(fiche.name)
  const telephone = resumeTelephone(fiche.phone)
  const adresse = resumeAdresseDepart(fiche.base_address)
  const equipe = resumeEquipe(fiche.team_size, peutEquipe)
  const facturation = resumeFacturation(fiche)
  const courriel = resumeEmail(email)

  return (
    <div className="max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]">
      <div className="flex items-center gap-1 pb-2">
        <Link
          href="/dashboard/parametres"
          aria-label="Retour à Plus"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`text-[24px] leading-none ${titre}`}>Mon profil</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Votre entreprise, vos factures, votre connexion
          </p>
        </div>
      </div>

      <Section titre="Mon entreprise">
        <CarteListe>
          <ul className="divide-y divide-[color:var(--v2-filet)]">
            <Ligne label="Nom de l’entreprise" valeur={nom.texte} ton={nom.ton} tronquer onClick={() => setFeuille('nom')} />
            <Ligne label="Téléphone" valeur={telephone.texte} ton={telephone.ton} onClick={() => setFeuille('telephone')} />
            <Ligne label="Adresse de départ" valeur={adresse.texte} ton={adresse.ton} onClick={() => setFeuille('adresse')} />
            <Ligne
              label="Nombre de laveurs"
              valeur={equipe.texte}
              onClick={() => (peutEquipe ? setFeuille('equipe') : router.push('/dashboard/abonnement'))}
            />
          </ul>
        </CarteListe>
      </Section>

      <Section titre="Mes factures">
        <CarteListe>
          <ul>
            <Ligne
              label="Mon statut et mes factures"
              valeur={facturation.texte}
              ton={facturation.ton}
              onClick={() => setFeuille('facturation')}
            />
          </ul>
        </CarteListe>
        <p className={`mt-2 px-0.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
          Tant qu’il manque une information, vos clients reçoivent un récapitulatif à la place d’une facture.
        </p>
      </Section>

      <Section titre="Ma connexion">
        <CarteListe>
          <ul className="divide-y divide-[color:var(--v2-filet)]">
            <Ligne label="Adresse e-mail" valeur={courriel.texte} ton={courriel.ton} tronquer onClick={() => setFeuille('email')} />
            <Ligne label="Mot de passe" valeur="••••••••" onClick={() => setFeuille('motDePasse')} />
          </ul>
        </CarteListe>
      </Section>

      {feuille === 'nom' && (
        <FeuilleTexteV2
          titre="Nom de l’entreprise"
          sousTitre="Ce que vos clients voient sur votre page de réservation."
          etiquette="Nom"
          valeur={fiche.name ?? ''}
          placeholder="Kooki Clean"
          valider={validerNomEntreprise}
          onEnregistrer={v => enregistrer({ name: v })}
          onClose={fermer}
        />
      )}
      {feuille === 'telephone' && (
        <FeuilleTexteV2
          titre="Téléphone"
          etiquette="Votre numéro"
          type="tel"
          valeur={fiche.phone ?? ''}
          placeholder="06 00 00 00 00"
          aide="Il apparaît sur vos factures et sert à vous joindre. Vos clients, eux, vous joignent par votre page."
          valider={validerTelephone}
          onEnregistrer={v => enregistrer({ phone: v })}
          onClose={fermer}
        />
      )}
      {feuille === 'adresse' && (
        <FeuilleAdresseDepartV2
          adresse={fiche.base_address ?? ''}
          onEnregistrer={v => enregistrer({ base_address: v })}
          onClose={fermer}
        />
      )}
      {feuille === 'equipe' && (
        <FeuilleEquipeV2
          nombre={fiche.team_size ?? 1}
          onEnregistrer={n => enregistrer({ team_size: n })}
          onClose={fermer}
        />
      )}
      {feuille === 'facturation' && (
        <FeuilleFacturationV2 washer={fiche} onEnregistrer={enregistrer} onClose={fermer} />
      )}
      {feuille === 'email' && <FeuilleEmailV2 email={email} onClose={fermer} />}
      {feuille === 'motDePasse' && <FeuilleMotDePasseV2 email={email} onClose={fermer} />}
    </div>
  )
}

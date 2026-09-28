// Détection d'un doublon probable pour une fiche client (menu « … », 2026-09-28) — deux fiches
// qui sont en réalité la même personne, inscrite deux fois (une nouvelle réservation avec une
// autre adresse email, par exemple). Calcul pur, comme le reste de `lib/` : la fusion elle-même
// (réattribuer réservations et documents) vit côté serveur, voir `/api/clients/fusionner`.
//
// Deux signaux, du plus fiable au moins fiable :
//  - même téléphone : deux fiches avec exactement le même numéro sont, en pratique, la même
//    personne — un numéro ne se partage pas par hasard entre deux clients d'un même laveur ;
//  - même nom (sans accents ni casse) : moins sûr qu'un téléphone identique, mais pour le
//    fichier d'un laveur (quelques centaines de clients), deux inconnus au nom EXACTEMENT
//    identique restent rares — un faux positif reste sans conséquence : c'est une PROPOSITION,
//    le laveur choisit de fusionner ou d'ignorer.
//
// Volontairement SANS l'email : c'est justement ce qui diffère entre les deux fiches dans le cas
// qu'on cherche à repérer (nouvelle adresse), le comparer n'aiderait jamais à les rapprocher.

import { sansAccents, chiffresTelephone } from './listeClients'
import type { ResumeClient } from './listeClients'

export type Doublon = {
  /** Clé de l'AUTRE fiche — celle qui ressemble à celle qu'on regarde. */
  cle: string
  /** Ce qu'on affiche pour la désigner : son email si elle en a un, sinon son nom. */
  identifiant: string
  motif: string
}

const nomNormalise = (s: string) => sansAccents(s).trim().replace(/\s+/g, ' ')

/** Cherche un doublon pour LA fiche dont on connaît `cle`, `name` et `phone`, dans le reste du
 *  fichier (`tousLesClients`, déjà chargé par l'écran — aucune requête ici). `null` si rien ne
 *  ressemble. */
export function trouverDoublon(
  profil: { cle: string; name: string; phone: string },
  tousLesClients: ResumeClient[],
): Doublon | null {
  const autres = tousLesClients.filter(c => c.cle !== profil.cle)

  const tel = chiffresTelephone(profil.phone)
  if (tel.length >= 6) {
    const parTelephone = autres.find(c => chiffresTelephone(c.phone) === tel)
    if (parTelephone) {
      return {
        cle: parTelephone.cle,
        identifiant: parTelephone.email || parTelephone.name,
        motif: `Même téléphone que « ${parTelephone.email || parTelephone.name} »`,
      }
    }
  }

  const nom = nomNormalise(profil.name)
  if (nom) {
    const parNom = autres.find(c => nomNormalise(c.name) === nom)
    if (parNom) {
      return {
        cle: parNom.cle,
        identifiant: parNom.email || parNom.name,
        motif: `${parNom.email || parNom.name} ressemble à cette fiche`,
      }
    }
  }

  return null
}

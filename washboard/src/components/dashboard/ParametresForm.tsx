'use client'

import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import type { Washer } from '@/types'
import ParametresFormV1 from '@/components/dashboard/ParametresFormV1'
import ParametresFormV2 from '@/components/dashboard/ParametresFormV2'

// Point de branchement v1/v2 de l'écran de réglages — décision d'Alexandre,
// 2026-09-22 : la refonte 2026 (menu « Plus » rangé par fréquence, jetons v2)
// ne s'applique QU'à la PWA installée en mode standalone. Le site (navigateur
// classique, mobile ou ordinateur) reste v1 sans exception : ParametresFormV1
// est repris à l'identique de l'ancien `ParametresForm.tsx` (deux onglets,
// même logique). Voir usePwaStandalone.ts pour pourquoi c'est un hook (la
// FORME change du tout au tout : un formulaire à deux onglets devient un menu
// de renvois) et non une simple classe CSS — même raisonnement que
// ClientsView.tsx / ClientProfileModal.tsx (passes 2-3).
//
// Import unique et stable pour tout le reste du dashboard : la page
// /dashboard/parametres continue d'importer ParametresForm sans rien savoir
// du branchement.
type Props = {
  washer: Washer
  email: string
  /** Voir ParametresFormV2 : nombre de prestations déjà compté par la page,
   *  facultatif, ignoré côté v1. */
  servicesCount?: number
  /** Voir ParametresFormV2 : phrase de résumé des horaires (« Lun–Ven 8h–18h »),
   *  facultative, ignorée côté v1. */
  resumeHoraires?: string
}

export default function ParametresForm({ washer, email, servicesCount, resumeHoraires }: Props) {
  const isPwa = usePwaStandalone()
  return isPwa
    ? <ParametresFormV2 washer={washer} servicesCount={servicesCount} resumeHoraires={resumeHoraires} />
    : <ParametresFormV1 washer={washer} email={email} />
}

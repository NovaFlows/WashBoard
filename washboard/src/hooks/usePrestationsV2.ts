'use client'

import { useState } from 'react'
import type { CategoryType, Service, ServiceCategory } from '@/types'
import { appliquerAuService, type FormulairePrestation } from '@/lib/prestationForm'
import { sanitizeTypes } from '@/lib/categoryTypes'
import {
  creerCategorie as apiCreerCategorie, creerPrestation as apiCreerPrestation, modifierCategorie as apiModifierCategorie,
  modifierPrestation as apiModifierPrestation, supprimerCategorie as apiSupprimerCategorie,
  supprimerPrestation as apiSupprimerPrestation, type ResultatApi,
} from '@/lib/prestationsApi'
import { signalerAvancement } from '@/lib/visiteGuidee'

// État de l'écran « Prestations et prix » de la PWA (`PrestationsV2`) : les
// listes affichées et les six écritures. Chaque écriture rend `null` quand elle
// a réussi, sinon la phrase à montrer au laveur ; la liste locale n'est modifiée
// QU'APRÈS un succès du serveur (jamais d'affichage optimiste : une prestation
// qui semble supprimée et qui ne l'est pas, c'est une réservation qu'on croit
// avoir retirée de sa page).
//
// Mêmes routes, mêmes corps que `PrestationsManager` / `CategoriesManager` (le
// site) — voir `lib/prestationForm.ts` pour la liste des règles dupliquées.

export function usePrestationsV2(servicesInitiaux: Service[], categoriesInitiales: ServiceCategory[]) {
  const [services, setServices] = useState(servicesInitiaux)
  const [categories, setCategories] = useState(categoriesInitiales)

  async function creerPrestation(form: FormulairePrestation): Promise<string | null> {
    const r = await apiCreerPrestation(form)
    if (!r.ok) return r.message
    setServices(s => [...s, r.data])
    signalerAvancement('services')
    return null
  }

  async function modifierPrestation(id: string, form: FormulairePrestation): Promise<string | null> {
    const r = await apiModifierPrestation(id, form)
    if (!r.ok) return r.message
    setServices(s => s.map(svc => (svc.id === id ? appliquerAuService(svc, form) : svc)))
    return null
  }

  async function supprimerPrestation(id: string): Promise<string | null> {
    const r = await apiSupprimerPrestation(id)
    if (!r.ok) return r.message
    setServices(s => s.filter(svc => svc.id !== id))
    return null
  }

  /** Met une prestation en veille, ou la remet en ligne (plafond de catalogue
   *  des offres 2026 — voir `lib/prestation.ts`, `estEnVeille`).
   *
   *  Mettre en veille est toujours permis : c'est la sortie de secours d'un
   *  laveur qui a plus de prestations que son offre n'en affiche. Seule la
   *  REMISE EN LIGNE peut être refusée (403), et ce refus n'est pas une erreur
   *  à peindre en rouge : c'est une offre à proposer, d'où le `plafond` rendu
   *  à l'appelant plutôt qu'une simple phrase. */
  async function basculerVeille(id: string, enVeille: boolean): Promise<
    { ok: true } | { ok: false; message: string; plafond?: number }
  > {
    let res: Response
    try {
      res = await fetch(`/api/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en_veille: enVeille }),
      })
    } catch {
      return { ok: false, message: 'Enregistrement impossible. Vérifiez votre connexion et réessayez.' }
    }
    const corps = await res.json().catch(() => ({})) as { error?: string; quota?: { plafond: number } }
    if (!res.ok) {
      return {
        ok: false,
        message: corps.error ?? 'Impossible de modifier cette prestation',
        plafond: res.status === 403 ? corps.quota?.plafond : undefined,
      }
    }
    setServices(s => s.map(svc => (svc.id === id ? { ...svc, en_veille: enVeille } : svc)))
    return { ok: true }
  }

  async function creerCategorie(nom: string, types: CategoryType[]): Promise<ResultatApi<ServiceCategory>> {
    const r = await apiCreerCategorie(nom.trim(), types, categories.length)
    if (r.ok) setCategories(c => [...c, r.data])
    return r
  }

  async function modifierCategorie(id: string, nom: string, types: CategoryType[]): Promise<string | null> {
    const r = await apiModifierCategorie(id, nom, types)
    if (!r.ok) return r.message
    // La route écarte les types sans nom : la liste locale fait pareil pour
    // rester fidèle à ce qui est réellement enregistré.
    setCategories(c => c.map(cat => (cat.id === id ? { ...cat, name: nom.trim(), types: sanitizeTypes(types) } : cat)))
    return null
  }

  async function supprimerCategorie(id: string): Promise<string | null> {
    const r = await apiSupprimerCategorie(id)
    if (!r.ok) return r.message
    setCategories(c => c.filter(cat => cat.id !== id))
    // `ON DELETE SET NULL` côté base : ses prestations restent, sans catégorie.
    setServices(s => s.map(svc => (svc.category_id === id ? { ...svc, category_id: null } : svc)))
    return null
  }

  return {
    services, categories,
    creerPrestation, modifierPrestation, supprimerPrestation, basculerVeille,
    creerCategorie, modifierCategorie, supprimerCategorie,
  }
}

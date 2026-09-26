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
    creerPrestation, modifierPrestation, supprimerPrestation,
    creerCategorie, modifierCategorie, supprimerCategorie,
  }
}

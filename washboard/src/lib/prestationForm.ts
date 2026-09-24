// Logique du formulaire « Prestations et prix » de la PWA (refonte 2026,
// `PrestationsV2`) : règles de saisie, corps des requêtes, résumés d'affichage.
//
// DUPLIQUÉ VOLONTAIREMENT de `admin/PrestationsManager.tsx` et
// `admin/CategoriesManager.tsx` (le site, inchangé) : ce sont des composants qui
// gardent leur logique dans leur état React, et une vraie cliente s'en sert tous
// les jours — les faire dépendre d'un module neuf, dans la même passe qu'un
// écran neuf, aurait mêlé deux risques. Les règles reprises à l'identique, avec
// leur équivalent v1, sont listées ici pour qu'on puisse les rapprocher :
//   changerCategorie   ↔ `changeCategory`   (PrestationsManager, ServiceForm)
//   basculerType       ↔ `toggleVehicle`    (idem)
//   changerPrixType    ↔ le `onChange` de « Prix par type » (idem)
//   corpsPrestation    ↔ `payload()`        (PrestationsManager)
//   appliquerAuService ↔ la fusion de `update()` (idem)
//   formulaireNeuf     ↔ `startAdd()`, formulaireDepuisService ↔ `startEdit()`
//   phrasesDuree       ↔ le bloc « joursProblematiques » de ServiceForm
//   typesDepuisModele  ↔ `applyPreset()`    (CategoriesManager)
// Une correction de règle dans l'un doit être reportée dans l'autre.

import type { Availability, CategoryType, Service, ServiceAddon, ServiceCategory } from '@/types'
import { formatDureeFr, hasPriceOverrides, minVehiclePrice } from '@/lib/pricing'
import { formatEuros } from '@/lib/plan'
import { joursDureeIncompatible } from '@/lib/slots'
import { VEHICLE_LABELS } from '@/lib/vehicle-labels'

export type FormulairePrestation = {
  category_id: string
  name: string
  description: string
  price: string
  duration_minutes: string
  vehicle_types: string[]
  vehicle_price_overrides: Record<string, number>
  addons: ServiceAddon[]
}

export const FORMULAIRE_VIDE: FormulairePrestation = {
  category_id: '', name: '', description: '', price: '', duration_minutes: '',
  vehicle_types: [], vehicle_price_overrides: {}, addons: [],
}

/** Types d'une prestation d'avant les catégories (ou dont la catégorie a été
 *  supprimée). Ils fonctionnent encore côté client : on les garde tels quels et
 *  on peut y revenir, au lieu de les effacer au changement de catégorie. */
export type SansCategorie = { vehicle_types: string[]; vehicle_price_overrides: Record<string, number> }

/** Nouvelle prestation : la première catégorie est présélectionnée AVEC tous
 *  ses types cochés (le cas courant est de proposer sa prestation pour tout ce
 *  que la catégorie contient). */
export function formulaireNeuf(categories: ServiceCategory[]): FormulairePrestation {
  const premiere = categories[0]
  return {
    ...FORMULAIRE_VIDE,
    vehicle_types: (premiere?.types ?? []).map(t => t.id),
    category_id: premiere?.id ?? '',
    vehicle_price_overrides: {},
    addons: [],
  }
}

export function formulaireDepuisService(svc: Service): FormulairePrestation {
  return {
    category_id: svc.category_id ?? '',
    name: svc.name,
    description: svc.description ?? '',
    price: String(svc.price),
    duration_minutes: String(svc.duration_minutes),
    vehicle_types: [...svc.vehicle_types],
    vehicle_price_overrides: { ...(svc.vehicle_price_overrides ?? {}) },
    addons: [...(svc.addons ?? [])],
  }
}

/** Ce que « Sans catégorie » doit rendre : les types d'origine de la prestation,
 *  seulement si sa catégorie n'existe (plus). */
export function sansCategorieDe(svc: Service, categories: ServiceCategory[]): SansCategorie | null {
  if (categories.some(c => c.id === svc.category_id)) return null
  return { vehicle_types: [...svc.vehicle_types], vehicle_price_overrides: { ...(svc.vehicle_price_overrides ?? {}) } }
}

/** Changer de catégorie : tous les types de la nouvelle sont cochés, les prix
 *  par type repartent à zéro (ils portaient sur les types de l'ancienne).
 *  Revenir sur « Sans catégorie » rend les types d'origine. */
export function changerCategorie(
  form: FormulairePrestation,
  catId: string,
  categories: ServiceCategory[],
  sansCategorie: SansCategorie | null,
): FormulairePrestation {
  if (!catId) {
    const origine = sansCategorie ?? { vehicle_types: [], vehicle_price_overrides: {} }
    return {
      ...form,
      category_id: '',
      vehicle_types: [...origine.vehicle_types],
      vehicle_price_overrides: { ...origine.vehicle_price_overrides },
    }
  }
  const categorie = categories.find(c => c.id === catId)
  return {
    ...form,
    category_id: catId,
    vehicle_types: (categorie?.types ?? []).map(t => t.id),
    vehicle_price_overrides: {},
  }
}

/** Cocher / décocher un type. Décocher retire aussi son prix : une surcharge
 *  « orpheline » fausserait le « à partir de » côté client. */
export function basculerType(form: FormulairePrestation, typeId: string): FormulairePrestation {
  const retire = form.vehicle_types.includes(typeId)
  const prix = { ...form.vehicle_price_overrides }
  if (retire) delete prix[typeId]
  return {
    ...form,
    vehicle_types: retire ? form.vehicle_types.filter(x => x !== typeId) : [...form.vehicle_types, typeId],
    vehicle_price_overrides: prix,
  }
}

/** Saisie d'un prix pour un type : vide = retour au prix de base. */
export function changerPrixType(form: FormulairePrestation, typeId: string, saisie: string): FormulairePrestation {
  const prix = { ...form.vehicle_price_overrides }
  const nombre = Number(saisie)
  if (saisie === '' || !Number.isFinite(nombre)) delete prix[typeId]
  else prix[typeId] = nombre
  return { ...form, vehicle_price_overrides: prix }
}

/** Types cochés qui n'existent plus dans la catégorie de la prestation
 *  (supprimés ou renommés en base sans que la prestation ait suivi). Le tunnel
 *  client les affiche sous leur identifiant brut. Sans catégorie : rien à
 *  comparer, donc rien à signaler. */
export function typesOrphelins(vehicleTypes: string[], categorie: ServiceCategory | undefined): string[] {
  if (!categorie) return []
  return vehicleTypes.filter(id => !categorie.types.some(t => t.id === id))
}

export function retirerOrphelins(form: FormulairePrestation, categorie: ServiceCategory | undefined): FormulairePrestation {
  const orphelins = new Set(typesOrphelins(form.vehicle_types, categorie))
  if (orphelins.size === 0) return form
  return {
    ...form,
    vehicle_types: form.vehicle_types.filter(id => !orphelins.has(id)),
    vehicle_price_overrides: Object.fromEntries(
      Object.entries(form.vehicle_price_overrides).filter(([id]) => !orphelins.has(id)),
    ),
  }
}

/** Corps envoyé à `POST /api/services` et `PATCH /api/services/[id]`.
 *  Une description vide est enregistrée en `null`. */
export function corpsPrestation(form: FormulairePrestation) {
  return {
    category_id: form.category_id || null,
    name: form.name.trim(),
    description: form.description.trim() || null,
    price: Number(form.price),
    duration_minutes: Number(form.duration_minutes),
    vehicle_types: form.vehicle_types,
    vehicle_price_overrides: form.vehicle_price_overrides,
    addons: form.addons,
  }
}

/** La prestation locale après un `PATCH` réussi (la route ne renvoie pas la ligne). */
export function appliquerAuService(svc: Service, form: FormulairePrestation): Service {
  return { ...svc, ...corpsPrestation(form) }
}

// ── Options et suppléments ─────────────────────────────────────────────────

export const CATEGORIES_OPTION_PAR_DEFAUT = ['Suppléments intérieur', 'Suppléments extérieur', 'Traitements spéciaux']

/** Catégorie d'une option laissée vide. */
export const CATEGORIE_OPTION_REPLI = 'Options'

/** Clé de comparaison : « supplements  Intérieur » et « Suppléments intérieur »
 *  sont la même catégorie. */
function cle(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Catégories d'options à proposer en puces : d'abord celles DÉJÀ employées (ce
 *  sont leurs orthographes qui comptent), puis les modèles. Le tunnel client
 *  (`StepOptions`) regroupe les options par chaîne EXACTE : « options » et
 *  « Options » y font deux rubriques. */
export function categoriesOptionProposees(addonsCourantes: ServiceAddon[], autresServices: Service[]): string[] {
  const vues = new Set<string>()
  const liste: string[] = []
  const ajouter = (c: string) => {
    const propre = c.replace(/\s+/g, ' ').trim()
    if (!propre || vues.has(cle(propre))) return
    vues.add(cle(propre))
    liste.push(propre)
  }
  addonsCourantes.forEach(a => ajouter(a.category))
  autresServices.forEach(s => (s.addons ?? []).forEach(a => ajouter(a.category)))
  CATEGORIES_OPTION_PAR_DEFAUT.forEach(ajouter)
  return liste
}

/** Catégorie saisie à la main → celle qui existe déjà si c'est la même à la
 *  casse, aux accents et aux espaces près, sinon la saisie nettoyée. */
export function categorieOptionNormalisee(saisie: string, connues: string[]): string {
  const propre = saisie.replace(/\s+/g, ' ').trim()
  if (!propre) return CATEGORIE_OPTION_REPLI
  return connues.find(c => cle(c) === cle(propre)) ?? propre
}

export type BrouillonOption = { label: string; category: string; price: string; duration_minutes: string }

/** L'option à ajouter, ou `null` si le brouillon est incomplet (libellé et prix
 *  obligatoires ; le prix peut valoir 0). */
export function nouvelleOption(brouillon: BrouillonOption, connues: string[], id: string): ServiceAddon | null {
  const label = brouillon.label.trim()
  const prix = Number(brouillon.price)
  if (!label || brouillon.price.trim() === '' || !Number.isFinite(prix) || prix < 0) return null
  const duree = Number(brouillon.duration_minutes)
  return {
    id,
    label,
    category: categorieOptionNormalisee(brouillon.category, connues),
    price: prix,
    ...(brouillon.duration_minutes.trim() !== '' && Number.isFinite(duree) && duree > 0 ? { duration_minutes: duree } : {}),
  }
}

// ── Avertissement de durée ─────────────────────────────────────────────────

export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

export function listeJours(jours: string[]): string {
  return jours.length === 1 ? jours[0] : `${jours.slice(0, -1).join(', ')} et ${jours[jours.length - 1]}`
}

/** Les jours où la durée ne tient dans aucune plage du laveur, en phrases —
 *  jour par jour, parce qu'un laveur peut avoir 3 h le lundi et 8 h le mardi :
 *  « ça ne rentre nulle part » serait faux dès qu'un seul jour convient, et ne
 *  dirait pas lequel corriger. Toutes les options ne sont pas exclusives (un
 *  client peut les cumuler) : c'est la durée AVEC toutes les options qui doit
 *  rentrer. Vide tant que le laveur n'a configuré aucune disponibilité. */
export function phrasesDuree(
  disponibilites: Pick<Availability, 'day_of_week' | 'start_time' | 'end_time'>[],
  form: Pick<FormulairePrestation, 'duration_minutes' | 'addons'>,
): string[] {
  const base = Number(form.duration_minutes || 0)
  const avecOptions = base + form.addons.reduce((somme, a) => somme + (a.duration_minutes ?? 0), 0)
  if (!(avecOptions > 0)) return []
  const problemes = joursDureeIncompatible(disponibilites, base, avecOptions)
  const memeSansOptions = problemes.filter(j => j.memeSansOptions).map(j => JOURS[j.day_of_week])
  const seulementAvecOptions = problemes.filter(j => !j.memeSansOptions).map(j => JOURS[j.day_of_week])
  const phrases: string[] = []
  if (memeSansOptions.length > 0) {
    phrases.push(`Cette prestation dure ${formatDureeFr(base)} : trop long pour votre ${listeJours(memeSansOptions)}, même sans option.`)
  }
  if (seulementAvecOptions.length > 0) {
    phrases.push(`Options comprises, elle peut durer jusqu’à ${formatDureeFr(avecOptions)} : ça dépasse votre ${listeJours(seulementAvecOptions)} dès qu’une option est cochée.`)
  }
  return phrases
}

// ── Affichage de la liste ──────────────────────────────────────────────────

/** Sous-titre de l'écran : « 4 prestations · 2 catégories ». */
export function sousTitrePrestations(nbPrestations: number, nbCategories: number): string {
  const p = nbPrestations === 0 ? 'Aucune prestation' : `${nbPrestations} prestation${nbPrestations > 1 ? 's' : ''}`
  if (nbCategories === 0) return p
  return `${p} · ${nbCategories} catégorie${nbCategories > 1 ? 's' : ''}`
}

/** Prix d'une ligne : « dès 60 € » si des types ont un prix différent du prix de base. */
export function prixListe(svc: Service): { des: boolean; montant: string } {
  const des = hasPriceOverrides(svc)
  return { des, montant: `${formatEuros(des ? minVehiclePrice(svc) : svc.price)} €` }
}

/** Nom lisible d'un type coché. Un type qui n'est plus dans la catégorie est
 *  reconnu s'il fait partie des modèles historiques (« SUV / 4x4 »), sinon il
 *  est dit supprimé plutôt qu'affiché sous son identifiant. */
export function nomDuType(typeId: string, categorie: { types: CategoryType[] } | undefined): string {
  return categorie?.types.find(t => t.id === typeId)?.name ?? VEHICLE_LABELS[typeId] ?? 'Type supprimé'
}

/** « Citadine, Berline +2 » — les deux premiers types, le reste compté. */
export function resumeTypes(svc: Service, categorie: ServiceCategory | undefined, max = 2): string {
  const noms = svc.vehicle_types.map(t => nomDuType(t, categorie))
  if (noms.length <= max) return noms.join(', ')
  return `${noms.slice(0, max).join(', ')} +${noms.length - max}`
}

/** Deuxième ligne d'une prestation : « 1h30 · Citadine, Berline +2 ». */
export function detailPrestation(svc: Service, categorie: ServiceCategory | undefined): string {
  const types = resumeTypes(svc, categorie)
  return types ? `${formatDureeFr(svc.duration_minutes)} · ${types}` : formatDureeFr(svc.duration_minutes)
}

/** Résumé d'une section repliée. */
export function resumePrixParType(form: FormulairePrestation): string {
  const n = Object.keys(form.vehicle_price_overrides).length
  if (n === 0) return 'Prix de base pour tous'
  return `${n} prix différent${n > 1 ? 's' : ''}`
}

export function resumeOptions(form: Pick<FormulairePrestation, 'addons'>): string {
  const n = form.addons.length
  return n === 0 ? 'Aucune' : `${n} option${n > 1 ? 's' : ''}`
}

export function resumeDescription(description: string): string {
  const propre = description.trim().replace(/\s+/g, ' ')
  if (!propre) return 'Aucune'
  return propre.length > 34 ? `${propre.slice(0, 33)}…` : propre
}

// ── Catégories ─────────────────────────────────────────────────────────────

export type ModeleCategorie = { name: string; types: { name: string; id?: string }[] }

/** Les types d'un modèle. L'id fixe du modèle est gardé quand il existe : les
 *  ids de « Voiture » sont des identifiants lisibles (`SUV`, `citadine`…) dont
 *  dépendent les images et le champ « modèle du véhicule » obligatoire du
 *  tunnel client — les remplacer par des UUID casserait les deux. */
export function typesDepuisModele(modele: ModeleCategorie, genererId: () => string = () => crypto.randomUUID()): CategoryType[] {
  return modele.types.map(t => ({ id: t.id ?? genererId(), name: t.name }))
}

/** Prestations qui propose encore un type que la catégorie s'apprête à perdre. */
export function prestationsUtilisantTypes(services: Service[], categoryId: string, typesRetires: string[]): Service[] {
  if (typesRetires.length === 0) return []
  return services.filter(s => s.category_id === categoryId && s.vehicle_types.some(t => typesRetires.includes(t)))
}

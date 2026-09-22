'use client'

import { useState } from 'react'
import type { Availability, Service, ServiceAddon, ServiceCategory } from '@/types'
import CategoriesManager from './CategoriesManager'
import { champsManquants, estReservable, messageManques, DUREE_MAX_MINUTES, ERREUR_DUREE_MAX } from '@/lib/prestation'
import { joursDureeIncompatible } from '@/lib/slots'
import { formatDureeFr } from '@/lib/pricing'

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

type FormData = { category_id: string; name: string; description: string; price: string; duration_minutes: string; vehicle_types: string[]; vehicle_price_overrides: Record<string, number>; addons: ServiceAddon[] }
const EMPTY: FormData = { category_id: '', name: '', description: '', price: '', duration_minutes: '', vehicle_types: [], vehicle_price_overrides: {}, addons: [] }

const NOTE_BLOQUANTE = 'text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2'

/** Types d'une prestation d'avant les catégories (ou dont la catégorie a été
 *  supprimée). Ils fonctionnent encore côté client : on les garde tels quels
 *  et on peut y revenir, au lieu de les effacer au changement de catégorie. */
type SansCategorie = { vehicle_types: string[]; vehicle_price_overrides: Record<string, number> }

type ServiceFormProps = {
  form: FormData
  categories: ServiceCategory[]
  sansCategorie: SansCategorie | null
  availabilities: Availability[]
  onChange: (f: FormData) => void
  onSave: () => void
  onCancel: () => void
  loading: boolean
  error: string | null
}

function ServiceForm({ form, categories, sansCategorie, availabilities, onChange, onSave, onCancel, loading, error }: ServiceFormProps) {
  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
  const [draft, setDraft] = useState({ label: '', category: 'Suppléments intérieur', price: '', duration_minutes: '' })

  const selectedCategory = categories.find(c => c.id === form.category_id)
  const availableTypes = selectedCategory?.types ?? []

  function addAddon() {
    if (!draft.label.trim() || !draft.price) return
    const addon: ServiceAddon = {
      id: crypto.randomUUID(),
      label: draft.label.trim(),
      category: draft.category.trim() || 'Options',
      price: Number(draft.price),
      ...(draft.duration_minutes ? { duration_minutes: Number(draft.duration_minutes) } : {}),
    }
    onChange({ ...form, addons: [...form.addons, addon] })
    setDraft(d => ({ ...d, label: '', price: '', duration_minutes: '' }))
  }

  function removeAddon(id: string) {
    onChange({ ...form, addons: form.addons.filter(a => a.id !== id) })
  }

  function changeCategory(catId: string) {
    // Tous les types de la catégorie sont cochés d'emblée.
    //
    // Le cas courant est de proposer sa prestation pour tout ce que la
    // catégorie contient — une citadine comme un SUV, un canapé deux places
    // comme un trois places. Partir de rien obligeait à tout cocher à la main
    // avant de pouvoir avancer, et rien n'indiquait que c'était attendu :
    // certains laveurs enregistraient une prestation sans aucun type, donc
    // impossible à réserver.
    //
    // Décocher ce qu'on ne fait pas est plus rapide que cocher ce qu'on fait,
    // et surtout : le résultat par défaut est utilisable.
    //
    // Les tarifs par type sont remis à zéro : ils portent sur les types de
    // l'ancienne catégorie et n'ont aucun sens dans la nouvelle.
    //
    // Revenir sur « Sans catégorie » (proposé seulement aux prestations qui
    // n'en avaient pas) rend leurs types d'origine : les vider sans prévenir
    // laissait une prestation impossible à réserver.
    if (!catId) {
      onChange({ ...form, category_id: '', ...(sansCategorie ?? { vehicle_types: [], vehicle_price_overrides: {} }) })
      return
    }
    const categorie = categories.find(c => c.id === catId)
    onChange({
      ...form,
      category_id: catId,
      vehicle_types: (categorie?.types ?? []).map(t => t.id),
      vehicle_price_overrides: {},
    })
  }

  function toggleVehicle(v: string) {
    const removing = form.vehicle_types.includes(v)
    // En désélectionnant un type, on retire aussi sa surcharge de prix pour
    // ne pas laisser de surcharge « orpheline » qui fausserait le « à partir de ».
    const overrides = { ...form.vehicle_price_overrides }
    if (removing) delete overrides[v]
    onChange({
      ...form,
      vehicle_types: removing
        ? form.vehicle_types.filter(x => x !== v)
        : [...form.vehicle_types, v],
      vehicle_price_overrides: overrides,
    })
  }

  const manques = champsManquants(form)
  const canSave = manques.length === 0 && !loading

  // Toutes les options ne sont pas exclusives (cases à cocher indépendantes) :
  // un client peut toutes les cumuler, donc c'est cette durée-là qui doit
  // rentrer dans au moins une disponibilité du laveur — pas seulement la
  // durée de base. Averti seulement s'il a déjà configuré des disponibilités
  // (sinon rien à comparer, et ça ne doit pas bloquer un tout nouveau compte).
  const dureeBase = Number(form.duration_minutes || 0)
  const dureeAvecOptions = dureeBase
    + form.addons.reduce((somme, a) => somme + (a.duration_minutes ?? 0), 0)
  // Un laveur peut avoir des horaires très inégaux selon le jour (3h le lundi,
  // 8h le mardi) : dire seulement « ça ne rentre nulle part » serait faux dès
  // qu'un seul jour convient, et ne dirait pas lequel corriger. On détaille
  // donc jour par jour, et on distingue « trop long même sans option » de
  // « trop long seulement si des options sont cochées ».
  const joursProblematiques = dureeAvecOptions > 0
    ? joursDureeIncompatible(availabilities, dureeBase, dureeAvecOptions)
    : []
  const joursMemeSansOptions = joursProblematiques.filter(j => j.memeSansOptions).map(j => JOURS[j.day_of_week])
  const joursSeulementAvecOptions = joursProblematiques.filter(j => !j.memeSansOptions).map(j => JOURS[j.day_of_week])

  function listeJours(jours: string[]): string {
    return jours.length === 1 ? jours[0] : `${jours.slice(0, -1).join(', ')} et ${jours[jours.length - 1]}`
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Catégorie</label>
          {categories.length === 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              Créez d&apos;abord une catégorie ci-dessus pour pouvoir y rattacher cette prestation.
            </p>
          ) : (
            <select
              value={form.category_id}
              onChange={e => changeCategory(e.target.value)}
              className={inputClass}
            >
              {sansCategorie && <option value="">— Sans catégorie —</option>}
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nom de la prestation</label>
          <input
            type="text"
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            placeholder="Lavage intérieur + extérieur"
            className={inputClass}
            autoFocus
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Description <span className="text-slate-400 font-normal">(optionnel — visible par le client, 250 car. max)</span>
          </label>
          <textarea
            value={form.description}
            onChange={e => onChange({ ...form, description: e.target.value.slice(0, 250) })}
            placeholder="Ex : Lavage complet intérieur et extérieur, aspiration, nettoyage des vitres..."
            rows={3}
            className={inputClass + ' resize-none'}
          />
          <p className="text-right text-xs text-slate-400 mt-0.5">{form.description.length}/250</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Prix (€)</label>
          <input
            type="number"
            min="0"
            value={form.price}
            onChange={e => onChange({ ...form, price: e.target.value })}
            placeholder="80"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Durée (min)</label>
          <input
            type="number"
            min="15"
            max={DUREE_MAX_MINUTES}
            step="15"
            value={form.duration_minutes}
            onChange={e => onChange({ ...form, duration_minutes: e.target.value })}
            placeholder="90"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
          Types
          {selectedCategory && <span className="ml-1 text-slate-400 font-normal">de « {selectedCategory.name} »</span>}
        </label>
        {!selectedCategory ? (
          form.vehicle_types.length > 0 ? (
            <p className="text-xs text-slate-400">Cette prestation garde ses types actuels. Choisissez une catégorie pour les modifier.</p>
          ) : (
            <p className={NOTE_BLOQUANTE}>Choisissez une catégorie puis cochez au moins un type : sans type, vos clients ne peuvent pas réserver cette prestation.</p>
          )
        ) : availableTypes.length === 0 ? (
          <p className={NOTE_BLOQUANTE}>Cette catégorie n&apos;a aucun type : vos clients n&apos;auraient rien à choisir. Ajoutez-en en modifiant la catégorie ci-dessus.</p>
        ) : (
          <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {availableTypes.map(t => (
              <button
                key={t.id}
                type="button"
                data-testid="type-prestation"
                aria-pressed={form.vehicle_types.includes(t.id)}
                onClick={() => toggleVehicle(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors ${
                  form.vehicle_types.includes(t.id)
                    ? 'border-blue-600 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          {form.vehicle_types.length === 0 && (
            <p className={NOTE_BLOQUANTE}>Cochez au moins un type : sans type, vos clients ne peuvent pas réserver cette prestation.</p>
          )}
          </div>
        )}
      </div>

      {form.vehicle_types.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Prix par type
            <span className="ml-1 text-slate-400 font-normal">(optionnel — laissez vide pour utiliser le prix de base)</span>
          </label>
          <div className="space-y-1.5">
            {form.vehicle_types.map(v => {
              const t = availableTypes.find(o => o.id === v)
              return (
                <div key={v} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 w-32 shrink-0">{t?.name ?? v}</span>
                  <input
                    type="number"
                    min="0"
                    value={form.vehicle_price_overrides[v] ?? ''}
                    onChange={e => {
                      const val = e.target.value
                      const overrides = { ...form.vehicle_price_overrides }
                      if (val === '') delete overrides[v]
                      else overrides[v] = Number(val)
                      onChange({ ...form, vehicle_price_overrides: overrides })
                    }}
                    placeholder={form.price || 'Prix de base'}
                    className={inputClass}
                  />
                  <span className="text-xs text-slate-400 shrink-0">€</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Options & suppléments */}
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
          Options & suppléments
          <span className="ml-1 text-slate-400 font-normal">(optionnel — proposé au client pendant la réservation)</span>
        </label>

        {form.addons.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {form.addons.map(addon => (
              <div key={addon.id} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                <span className="text-xs text-slate-400 shrink-0 w-32 truncate">{addon.category}</span>
                <span className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{addon.label}</span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">+{addon.price}€</span>
                {addon.duration_minutes ? <span className="text-xs text-slate-400 shrink-0">+{addon.duration_minutes}min</span> : null}
                <button
                  type="button"
                  onClick={() => removeAddon(addon.id)}
                  className="text-red-400 hover:text-red-600 text-xs shrink-0 ml-1 transition-colors"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        <datalist id="addon-categories">
          <option value="Suppléments intérieur" />
          <option value="Suppléments extérieur" />
          <option value="Traitements spéciaux" />
        </datalist>

        {/* Sur téléphone, cinq éléments sur une ligne écrasaient la catégorie et
            le nom en deux cases vides : ils passent en pleine rangée au-dessus. */}
        <div className="grid grid-cols-6 sm:grid-cols-[1fr_1fr_5rem_5rem_auto] gap-2 items-end">
          <input
            list="addon-categories"
            value={draft.category}
            onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
            placeholder="Catégorie"
            className={inputClass + ' col-span-3 sm:col-span-1'}
          />
          <input
            value={draft.label}
            onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
            placeholder="Ex : Poils d'animaux"
            className={inputClass + ' col-span-3 sm:col-span-1'}
            onKeyDown={e => e.key === 'Enter' && addAddon()}
          />
          <div className="relative col-span-2 sm:col-span-1">
            <input
              type="number"
              min="0"
              value={draft.price}
              onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
              placeholder="15€"
              className={inputClass}
              onKeyDown={e => e.key === 'Enter' && addAddon()}
            />
          </div>
          <div className="relative col-span-2 sm:col-span-1">
            <input
              type="number"
              min="5"
              step="5"
              value={draft.duration_minutes}
              onChange={e => setDraft(d => ({ ...d, duration_minutes: e.target.value }))}
              placeholder="+min"
              className={inputClass}
              onKeyDown={e => e.key === 'Enter' && addAddon()}
            />
          </div>
          <button
            type="button"
            onClick={addAddon}
            disabled={!draft.label.trim() || !draft.price}
            className="col-span-2 sm:col-span-1 px-3 py-2 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {manques.includes('duree_max') && (
        <p className={NOTE_BLOQUANTE}>{ERREUR_DUREE_MAX}</p>
      )}

      {joursProblematiques.length > 0 && (
        <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2 space-y-1">
          {joursMemeSansOptions.length > 0 && (
            <p>
              Cette prestation dure {formatDureeFr(dureeBase)} : trop long pour votre {listeJours(joursMemeSansOptions)}, même sans option.
            </p>
          )}
          {joursSeulementAvecOptions.length > 0 && (
            <p>
              Options comprises, elle peut durer jusqu&apos;à {formatDureeFr(dureeAvecOptions)} : ça dépasse votre {listeJours(joursSeulementAvecOptions)} dès qu&apos;une option est cochée.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
        >
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Annuler
        </button>
      </div>
      {!loading && manques.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{messageManques(manques)}</p>
      )}
    </div>
  )
}

export default function PrestationsManager({ services: initialServices, categories: initialCategories, availabilities }: { services: Service[]; categories: ServiceCategory[]; availabilities: Availability[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [services, setServices] = useState(initialServices)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function categoryName(id: string | null): string | null {
    if (!id) return null
    return categories.find(c => c.id === id)?.name ?? null
  }

  function typeLabel(svc: Service, typeId: string): string {
    const cat = categories.find(c => c.id === svc.category_id)
    return cat?.types.find(t => t.id === typeId)?.name ?? typeId
  }

  function startAdd() {
    setEditId(null)
    // La première catégorie était déjà présélectionnée, mais sans ses types :
    // le formulaire s'ouvrait donc sur une catégorie choisie et aucune case
    // cochée, alors que passer par le menu déroulant les aurait toutes
    // cochées. On aligne les deux chemins.
    const premiere = categories[0]
    setForm({
      ...EMPTY,
      category_id: premiere?.id ?? '',
      vehicle_types: (premiere?.types ?? []).map(t => t.id),
    })
    setError(null)
    setShowAdd(true)
  }

  function startEdit(svc: Service) {
    setShowAdd(false)
    setError(null)
    setForm({
      category_id: svc.category_id ?? '',
      name: svc.name,
      description: svc.description ?? '',
      price: String(svc.price),
      duration_minutes: String(svc.duration_minutes),
      vehicle_types: [...svc.vehicle_types],
      vehicle_price_overrides: { ...(svc.vehicle_price_overrides ?? {}) },
      addons: [...(svc.addons ?? [])],
    })
    setEditId(svc.id)
  }

  function cancelForm() {
    setShowAdd(false)
    setEditId(null)
    setForm(EMPTY)
    setError(null)
  }

  function payload() {
    return {
      category_id: form.category_id || null,
      name: form.name,
      description: form.description.trim() || null,
      price: Number(form.price),
      duration_minutes: Number(form.duration_minutes),
      vehicle_types: form.vehicle_types,
      vehicle_price_overrides: form.vehicle_price_overrides,
      addons: form.addons,
    }
  }

  async function add() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Erreur lors de la création')
      setLoading(false)
      return
    }
    setServices(s => [...s, json.data])
    cancelForm()
    setLoading(false)
  }

  async function update() {
    if (!editId) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/services/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Erreur lors de la modification')
      setLoading(false)
      return
    }
    setServices(s => s.map(svc => svc.id === editId
      ? { ...svc, category_id: form.category_id || null, name: form.name, description: form.description.trim() || null, price: Number(form.price), duration_minutes: Number(form.duration_minutes), vehicle_types: form.vehicle_types, vehicle_price_overrides: form.vehicle_price_overrides, addons: form.addons }
      : svc
    ))
    cancelForm()
    setLoading(false)
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette prestation ?')) return
    const res = await fetch(`/api/services/${id}`, { method: 'DELETE' })
    if (res.ok) setServices(s => s.filter(svc => svc.id !== id))
  }

  return (
    <div className="space-y-6">
      <CategoriesManager categories={categories} setCategories={setCategories} />

      <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Prestations</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Les lavages proposés à vos clients, rattachés à une catégorie.</p>
        </div>

        {services.length === 0 && !showAdd && categories.length > 0 && (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
            Aucune prestation — ajoutez-en une ci-dessous
          </div>
        )}

        {services.map(svc => (
          <div key={svc.id}>
            {editId === svc.id ? (
              <ServiceForm
                form={form}
                categories={categories}
                sansCategorie={categories.some(c => c.id === svc.category_id)
                  ? null
                  : { vehicle_types: [...svc.vehicle_types], vehicle_price_overrides: { ...(svc.vehicle_price_overrides ?? {}) } }}
                availabilities={availabilities}
                onChange={setForm}
                onSave={update}
                onCancel={cancelForm}
                loading={loading}
                error={error}
              />
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{svc.name}</p>
                    {categoryName(svc.category_id) && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                        {categoryName(svc.category_id)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {svc.price}€ · {svc.duration_minutes} min
                    {svc.vehicle_types.length > 0 && ` · ${svc.vehicle_types.map(t => typeLabel(svc, t)).join(', ')}`}
                  </p>
                  {!estReservable(svc) && (
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1">
                      Invisible pour vos clients : aucun type coché. Modifiez-la pour en choisir un.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(svc)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => remove(svc.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {showAdd && (
          <ServiceForm
            form={form}
            categories={categories}
            sansCategorie={null}
            availabilities={availabilities}
            onChange={setForm}
            onSave={add}
            onCancel={cancelForm}
            loading={loading}
            error={error}
          />
        )}

        {/* Sans catégorie, une prestation n'aurait aucun type à proposer : on
            ne montre pas un formulaire qui mène à une impasse, on dit par où
            commencer. */}
        {!showAdd && editId === null && categories.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Commencez par créer une catégorie, juste au-dessus</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Elle liste ce que vos clients peuvent choisir, par exemple Voiture avec Citadine, Berline, SUV.
              Vos prestations s&apos;ajoutent ensuite ici.
            </p>
          </div>
        )}

        {!showAdd && editId === null && categories.length > 0 && (
          <button
            onClick={startAdd}
            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-sm font-medium transition-colors"
          >
            + Ajouter une prestation
          </button>
        )}
      </div>
    </div>
  )
}

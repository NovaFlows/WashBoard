'use client'

import { useState } from 'react'
import type { Service, ServiceAddon, ServiceCategory } from '@/types'
import CategoriesManager from './CategoriesManager'

type FormData = { category_id: string; name: string; description: string; price: string; duration_minutes: string; vehicle_types: string[]; vehicle_price_overrides: Record<string, number>; addons: ServiceAddon[] }
const EMPTY: FormData = { category_id: '', name: '', description: '', price: '', duration_minutes: '', vehicle_types: [], vehicle_price_overrides: {}, addons: [] }

type ServiceFormProps = {
  form: FormData
  categories: ServiceCategory[]
  onChange: (f: FormData) => void
  onSave: () => void
  onCancel: () => void
  loading: boolean
  error: string | null
}

function ServiceForm({ form, categories, onChange, onSave, onCancel, loading, error }: ServiceFormProps) {
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
    // Les types diffèrent d'une catégorie à l'autre : on réinitialise la sélection
    onChange({ ...form, category_id: catId, vehicle_types: [], vehicle_price_overrides: {} })
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

  const canSave = form.name.trim() && form.price && form.duration_minutes && !loading

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
              <option value="">— Sans catégorie —</option>
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
          <p className="text-xs text-slate-400">Sélectionnez une catégorie pour choisir ses types.</p>
        ) : availableTypes.length === 0 ? (
          <p className="text-xs text-slate-400">Cette catégorie n&apos;a aucun type. Ajoutez-en dans la catégorie.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {availableTypes.map(t => (
              <button
                key={t.id}
                type="button"
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

        <div className="grid grid-cols-[1fr_1fr_5rem_5rem_auto] gap-2 items-end">
          <input
            list="addon-categories"
            value={draft.category}
            onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
            placeholder="Catégorie"
            className={inputClass}
          />
          <input
            value={draft.label}
            onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
            placeholder="Ex : Poils d'animaux"
            className={inputClass}
            onKeyDown={e => e.key === 'Enter' && addAddon()}
          />
          <div className="relative">
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
          <div className="relative">
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
            className="px-3 py-2 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            + Ajouter
          </button>
        </div>
      </div>

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
    </div>
  )
}

export default function PrestationsManager({ services: initialServices, categories: initialCategories }: { services: Service[]; categories: ServiceCategory[] }) {
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
    setForm({ ...EMPTY, category_id: categories[0]?.id ?? '' })
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

        {services.length === 0 && !showAdd && (
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
            onChange={setForm}
            onSave={add}
            onCancel={cancelForm}
            loading={loading}
            error={error}
          />
        )}

        {!showAdd && editId === null && (
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

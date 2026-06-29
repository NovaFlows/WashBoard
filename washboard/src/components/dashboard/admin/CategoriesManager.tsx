'use client'

import { useState } from 'react'
import type { ServiceCategory, CategoryType } from '@/types'

type Draft = { name: string; types: CategoryType[] }
const EMPTY: Draft = { name: '', types: [] }

// Modèles de types pré-remplis pour les catégories courantes.
// `keys` (optionnel) = IDs fixes ; pour « Voiture » on réutilise les clés
// historiques afin que les images de véhicules s'affichent côté client.
// Sinon, les IDs sont générés à l'application (navigateur uniquement).
const PRESETS: { name: string; types: { name: string; id?: string }[] }[] = [
  {
    name: 'Voiture',
    types: [
      { id: 'citadine_2p', name: 'Citadine 2p' },
      { id: 'citadine',    name: 'Citadine' },
      { id: 'berline',     name: 'Berline' },
      { id: 'SUV',         name: 'SUV / 4x4' },
      { id: 'monospace',   name: 'Monospace' },
      { id: '7places',     name: '7 places' },
      { id: 'utilitaire',  name: 'Van / Utilitaire' },
    ],
  },
  {
    name: 'Canapé',
    types: [
      { name: '2 places' },
      { name: '3 places' },
      { name: "Canapé d'angle" },
      { name: 'Méridienne' },
      { name: 'Fauteuil' },
    ],
  },
]

type CategoryFormProps = {
  form: Draft
  onChange: (f: Draft) => void
  onSave: () => void
  onCancel: () => void
  loading: boolean
  error: string | null
}

function CategoryForm({ form, onChange, onSave, onCancel, loading, error }: CategoryFormProps) {
  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
  const [typeDraft, setTypeDraft] = useState('')

  function addType() {
    const name = typeDraft.trim()
    if (!name) return
    onChange({ ...form, types: [...form.types, { id: crypto.randomUUID(), name }] })
    setTypeDraft('')
  }

  function removeType(id: string) {
    onChange({ ...form, types: form.types.filter(t => t.id !== id) })
  }

  function renameType(id: string, name: string) {
    onChange({ ...form, types: form.types.map(t => t.id === id ? { ...t, name } : t) })
  }

  function applyPreset(preset: { name: string; types: { name: string; id?: string }[] }) {
    const types: CategoryType[] = preset.types.map(t => ({
      // ID fixe si fourni (clés voiture → images), sinon ID frais.
      id: t.id ?? crypto.randomUUID(),
      name: t.name,
    }))
    onChange({ ...form, name: form.name.trim() || preset.name, types })
  }

  const canSave = form.name.trim() && !loading

  return (
    <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nom de la catégorie</label>
        <input
          type="text"
          value={form.name}
          onChange={e => onChange({ ...form, name: e.target.value })}
          placeholder="Voiture, Canapé, Maison..."
          className={inputClass}
          autoFocus
        />
      </div>

      {form.types.length === 0 && (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Partir d&apos;un modèle (optionnel) :</p>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border-2 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
          Types
          <span className="ml-1 text-slate-400 font-normal">(ex : SUV, Citadine — ou 2 places, Angle...)</span>
        </label>

        {form.types.length > 0 && (
          <div className="space-y-1.5 mb-2.5">
            {form.types.map(t => (
              <div key={t.id} className="flex items-center gap-2">
                <input
                  value={t.name}
                  onChange={e => renameType(t.id, e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => removeType(t.id)}
                  className="text-red-400 hover:text-red-600 text-sm shrink-0 px-2 transition-colors"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={typeDraft}
            onChange={e => setTypeDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addType() } }}
            placeholder="Ajouter un type..."
            className={inputClass}
          />
          <button
            type="button"
            onClick={addType}
            disabled={!typeDraft.trim()}
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
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
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

type Props = {
  categories: ServiceCategory[]
  setCategories: React.Dispatch<React.SetStateAction<ServiceCategory[]>>
}

export default function CategoriesManager({ categories, setCategories }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Draft>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startAdd() {
    setEditId(null)
    setForm(EMPTY)
    setError(null)
    setShowAdd(true)
  }

  function startEdit(cat: ServiceCategory) {
    setShowAdd(false)
    setError(null)
    setForm({ name: cat.name, types: cat.types.map(t => ({ ...t })) })
    setEditId(cat.id)
  }

  function cancelForm() {
    setShowAdd(false)
    setEditId(null)
    setForm(EMPTY)
    setError(null)
  }

  async function add() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, types: form.types, display_order: categories.length }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Erreur lors de la création')
      setLoading(false)
      return
    }
    setCategories(c => [...c, json.data])
    cancelForm()
    setLoading(false)
  }

  async function update() {
    if (!editId) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/categories/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, types: form.types }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Erreur lors de la modification')
      setLoading(false)
      return
    }
    setCategories(c => c.map(cat => cat.id === editId
      ? { ...cat, name: form.name.trim(), types: form.types }
      : cat
    ))
    cancelForm()
    setLoading(false)
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette catégorie ? Les prestations qui y sont rattachées ne le seront plus.')) return
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    if (res.ok) setCategories(c => c.filter(cat => cat.id !== id))
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Catégories</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Regroupez vos prestations (Voiture, Canapé, Maison...). Chaque catégorie a ses propres types.
        </p>
      </div>

      {categories.map(cat => (
        <div key={cat.id}>
          {editId === cat.id ? (
            <CategoryForm form={form} onChange={setForm} onSave={update} onCancel={cancelForm} loading={loading} error={error} />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{cat.name}</p>
                {cat.types.length > 0 ? (
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    {cat.types.map(t => (
                      <span key={t.id} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {t.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Aucun type</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => startEdit(cat)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >Modifier</button>
                <button
                  onClick={() => remove(cat.id)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                >Supprimer</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showAdd && (
        <CategoryForm form={form} onChange={setForm} onSave={add} onCancel={cancelForm} loading={loading} error={error} />
      )}

      {!showAdd && editId === null && (
        <button
          onClick={startAdd}
          className="w-full py-2.5 border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-sm font-medium transition-colors"
        >
          + Ajouter une catégorie
        </button>
      )}
    </div>
  )
}

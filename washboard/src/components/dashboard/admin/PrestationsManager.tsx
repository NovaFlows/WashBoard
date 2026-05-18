'use client'

import { useState } from 'react'
import type { Service } from '@/types'

const VEHICLE_OPTIONS = [
  { value: 'citadine', label: 'Citadine' },
  { value: 'berline',  label: 'Berline' },
  { value: 'SUV',      label: 'SUV / 4x4' },
]

type FormData = { name: string; price: string; duration_minutes: string; vehicle_types: string[] }
const EMPTY: FormData = { name: '', price: '', duration_minutes: '', vehicle_types: [] }

type ServiceFormProps = {
  form: FormData
  onChange: (f: FormData) => void
  onSave: () => void
  onCancel: () => void
  loading: boolean
  error: string | null
}

function ServiceForm({ form, onChange, onSave, onCancel, loading, error }: ServiceFormProps) {
  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"

  function toggleVehicle(v: string) {
    onChange({
      ...form,
      vehicle_types: form.vehicle_types.includes(v)
        ? form.vehicle_types.filter(x => x !== v)
        : [...form.vehicle_types, v],
    })
  }

  const canSave = form.name.trim() && form.price && form.duration_minutes && !loading

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
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
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Types de véhicules</label>
        <div className="flex gap-2 flex-wrap">
          {VEHICLE_OPTIONS.map(v => (
            <button
              key={v.value}
              type="button"
              onClick={() => toggleVehicle(v.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors ${
                form.vehicle_types.includes(v.value)
                  ? 'border-blue-600 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300'
              }`}
            >
              {v.label}
            </button>
          ))}
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

export default function PrestationsManager({ services: initial }: { services: Service[] }) {
  const [services, setServices] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startAdd() {
    setEditId(null)
    setForm(EMPTY)
    setError(null)
    setShowAdd(true)
  }

  function startEdit(svc: Service) {
    setShowAdd(false)
    setError(null)
    setForm({
      name: svc.name,
      price: String(svc.price),
      duration_minutes: String(svc.duration_minutes),
      vehicle_types: [...svc.vehicle_types],
    })
    setEditId(svc.id)
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
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        price: Number(form.price),
        duration_minutes: Number(form.duration_minutes),
        vehicle_types: form.vehicle_types,
      }),
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
      body: JSON.stringify({
        name: form.name,
        price: Number(form.price),
        duration_minutes: Number(form.duration_minutes),
        vehicle_types: form.vehicle_types,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Erreur lors de la modification')
      setLoading(false)
      return
    }
    setServices(s => s.map(svc => svc.id === editId
      ? { ...svc, name: form.name, price: Number(form.price), duration_minutes: Number(form.duration_minutes), vehicle_types: form.vehicle_types }
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
    <div className="space-y-3">
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
              onChange={setForm}
              onSave={update}
              onCancel={cancelForm}
              loading={loading}
              error={error}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg shrink-0">🧽</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{svc.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {svc.price}€ · {svc.duration_minutes} min
                  {svc.vehicle_types.length > 0 && ` · ${svc.vehicle_types.join(', ')}`}
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
  )
}

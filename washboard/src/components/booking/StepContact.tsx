'use client'

import { useState } from 'react'

type Props = {
  loading: boolean
  error: string | null
  onSubmit: (data: { client_name: string; client_email: string; client_phone: string }) => void
  onBack: () => void
}

export default function StepContact({ loading, error, onSubmit, onBack }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const canSubmit = name.trim() && email.includes('@') && phone.trim().length >= 10

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Vos coordonnées</h2>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prénom et nom</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jean Dupont"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jean@email.com"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="06 00 00 00 00"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 py-3 px-4 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          Retour
        </button>
        <button
          onClick={() => canSubmit && onSubmit({ client_name: name, client_email: email, client_phone: phone })}
          disabled={!canSubmit || loading}
          className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {loading ? 'Envoi...' : 'Confirmer'}
        </button>
      </div>
    </div>
  )
}

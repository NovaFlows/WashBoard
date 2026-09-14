'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'
import type { Washer } from '@/types'
import { TAUX_TVA, infosFacturationManquantes, phraseManques, siretValide, type RegimeTva } from '@/lib/facture'

const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
const aideClass = "text-xs text-slate-400 dark:text-slate-500 mt-1"

/** Informations portées sur les factures du laveur à ses clients. Tant
 *  qu'elles sont incomplètes, aucune facture n'est émise : le client reçoit
 *  un récapitulatif, qui ne se présente pas comme une facture. */
export function FacturationCard({ washer }: { washer: Washer }) {
  const router = useRouter()
  const [nomLegal, setNomLegal] = useState(washer.facture_nom_legal ?? '')
  const [siret, setSiret] = useState(washer.facture_siret ?? '')
  const [adresse, setAdresse] = useState(washer.facture_adresse ?? '')
  const [regime, setRegime] = useState<RegimeTva>(washer.facture_regime_tva ?? 'franchise')
  const [taux, setTaux] = useState(String(washer.facture_taux_tva ?? 20))
  const [numeroTva, setNumeroTva] = useState(washer.facture_numero_tva ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const manques = infosFacturationManquantes({
    facture_nom_legal: nomLegal,
    facture_siret: siret,
    facture_adresse: adresse,
    facture_regime_tva: regime,
    facture_numero_tva: numeroTva,
  })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (siret.trim() && !siretValide(siret)) {
      setMsg({ ok: false, text: 'SIRET invalide : vérifiez les 14 chiffres.' })
      return
    }
    setLoading(true)
    const res = await fetch('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facture_nom_legal: nomLegal,
        facture_siret: siret,
        facture_adresse: adresse,
        facture_regime_tva: regime,
        facture_taux_tva: Number(taux),
        facture_numero_tva: regime === 'assujetti' ? numeroTva : '',
      }),
    })
    const json = await res.json().catch(() => ({})) as { error?: string }
    setMsg(res.ok
      ? { ok: true, text: 'Informations de facturation enregistrées' }
      : { ok: false, text: json.error ?? 'Erreur lors de la mise à jour' })
    if (res.ok) router.refresh()
    setLoading(false)
  }

  return (
    <div id="facturation" className="scroll-mt-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <FileText size={16} strokeWidth={2} className="text-slate-400 dark:text-slate-500" />Facturation
      </h2>
      <form onSubmit={save} noValidate className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-1">
          Quand vous marquez un rendez-vous « Terminé », sa facture est émise avec ces informations.
          Vos clients professionnels la reçoivent par email.
        </p>

        {manques.length === 0 ? (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">✓ Vos factures sont prêtes à être émises.</p>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            {phraseManques(manques)} En attendant, vos clients reçoivent un simple récapitulatif.
          </p>
        )}

        <div>
          <label htmlFor="facture-nom-legal" className={labelClass}>Nom légal</label>
          <input id="facture-nom-legal" type="text" value={nomLegal} onChange={e => setNomLegal(e.target.value)} placeholder="Jean Dupont EI" className={inputClass} />
          <p className={aideClass}>Votre prénom et nom suivis de « EI » si vous êtes entrepreneur individuel (micro-entreprise), ou la raison sociale de votre société.</p>
        </div>

        <div>
          <label htmlFor="facture-siret" className={labelClass}>SIRET</label>
          <input id="facture-siret" type="text" inputMode="numeric" value={siret} onChange={e => setSiret(e.target.value)} placeholder="123 456 789 00012" className={inputClass} />
          <p className={aideClass}>14 chiffres, sur votre avis de situation Insee ou sur annuaire-entreprises.data.gouv.fr.</p>
        </div>

        <div>
          <label className={labelClass}>Adresse professionnelle</label>
          <AddressAutocomplete value={adresse} onChange={setAdresse} placeholder="12 rue de la Paix, 75001 Paris" className={inputClass} />
        </div>

        <div>
          <p className={labelClass}>TVA</p>
          <div className="flex flex-col gap-2">
            {([
              { value: 'franchise', label: 'Je ne facture pas la TVA (micro-entreprise)', desc: 'Vos factures portent la mention « TVA non applicable, art. 293 B du CGI ».' },
              { value: 'assujetti', label: 'Je facture la TVA', desc: 'Vos prix restent affichés TTC ; la facture détaille le HT et la TVA.' },
            ] as const).map(opt => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  regime === opt.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="facture_regime_tva"
                  value={opt.value}
                  checked={regime === opt.value}
                  onChange={() => setRegime(opt.value)}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{opt.label}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {regime === 'assujetti' && (
          <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-3">
            <div>
              <label htmlFor="facture-taux-tva" className={labelClass}>Taux</label>
              <select id="facture-taux-tva" value={taux} onChange={e => setTaux(e.target.value)} className={inputClass}>
                {TAUX_TVA.map(t => <option key={t} value={String(t)}>{String(t).replace('.', ',')} %</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="facture-numero-tva" className={labelClass}>N° de TVA intracommunautaire</label>
              <input id="facture-numero-tva" type="text" value={numeroTva} onChange={e => setNumeroTva(e.target.value)} placeholder="FR40123456789" className={inputClass} />
            </div>
          </div>
        )}

        {msg && (
          <p className={`text-sm font-medium ${msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {msg.ok ? '✓ ' : '✕ '}{msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
        >
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}

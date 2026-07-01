import type { SupabaseClient } from '@supabase/supabase-js'

export type RecurringOccurrence = {
  date: string        // date effective de la dépense (jour clampé au dernier jour du mois)
  monthStart: string  // 1er du mois (pour vérifier l'existence)
  monthEnd: string    // dernier jour du mois
}

/** Calcule les occurrences d'une dépense récurrente (jour du mois) dans [start, end].
 *  Fonction PURE (testable) : gère le clamp du jour au dernier jour du mois
 *  (ex. le 31 devient le 28/29 en février) et exclut les dates hors intervalle.
 */
export function recurringDatesInRange(dayOfMonth: number, start: string, end: string): RecurringOccurrence[] {
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return []

  const out: RecurringOccurrence[] = []
  const cur = new Date(s.getFullYear(), s.getMonth(), 1)
  while (cur <= e) {
    const year  = cur.getFullYear()
    const month = cur.getMonth() + 1
    const lastDay = new Date(year, month, 0).getDate()
    const day     = Math.min(dayOfMonth, lastDay)
    const mm      = String(month).padStart(2, '0')
    const date    = `${year}-${mm}-${String(day).padStart(2, '0')}`

    if (date >= start && date <= end) {
      out.push({
        date,
        monthStart: `${year}-${mm}-01`,
        monthEnd:   `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      })
    }
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}

export async function materializeRecurring(supabase: SupabaseClient, washerId: string, start: string, end: string) {
  const { data: templates } = await supabase
    .from('washer_recurring_expenses')
    .select('*')
    .eq('washer_id', washerId)
    .eq('active', true)

  if (!templates?.length) return

  for (const template of templates) {
    for (const { date, monthStart, monthEnd } of recurringDatesInRange(template.day_of_month, start, end)) {
      const { data: existing } = await supabase
        .from('washer_expenses')
        .select('id')
        .eq('washer_id', washerId)
        .eq('recurring_expense_id', template.id)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .maybeSingle()

      if (!existing) {
        await supabase.from('washer_expenses').insert({
          washer_id:            washerId,
          date,
          category:             template.category,
          label:                template.label,
          amount:               template.amount,
          recurring_expense_id: template.id,
        })
      }
    }
  }
}

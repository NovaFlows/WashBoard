import type { SupabaseClient } from '@supabase/supabase-js'

export async function materializeRecurring(supabase: SupabaseClient, washerId: string, start: string, end: string) {
  const { data: templates } = await supabase
    .from('washer_recurring_expenses')
    .select('*')
    .eq('washer_id', washerId)
    .eq('active', true)

  if (!templates?.length) return

  // Collect all months in the [start, end] range
  const months: { year: number; month: number }[] = []
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const cur = new Date(s.getFullYear(), s.getMonth(), 1)
  while (cur <= e) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 })
    cur.setMonth(cur.getMonth() + 1)
  }

  for (const template of templates) {
    for (const { year, month } of months) {
      const lastDay   = new Date(year, month, 0).getDate()
      const day       = Math.min(template.day_of_month, lastDay)
      const date      = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      if (date < start || date > end) continue

      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
      const monthEnd   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

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

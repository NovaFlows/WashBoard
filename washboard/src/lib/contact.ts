type ContactBooking = {
  client_name: string
  client_email: string
  client_phone: string
  address: string
  scheduled_at: string
  services: { name: string } | null
}

function fmt(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function openGmail(b: ContactBooking): void {
  const date    = new Date(b.scheduled_at)
  const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = fmt(date)
  const subject = `Votre réservation — ${b.services?.name ?? 'Lavage'} du ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
  const body    = [`Bonjour ${b.client_name},`, '', 'Je vous contacte au sujet de votre réservation :', `• Prestation : ${b.services?.name ?? '—'}`, `• Date : ${dateStr} à ${timeStr}`, `• Adresse : ${b.address}`, '', ''].join('\n')
  const url = new URL('https://mail.google.com/mail/')
  url.searchParams.set('view', 'cm')
  url.searchParams.set('to', b.client_email)
  url.searchParams.set('su', subject)
  url.searchParams.set('body', body)
  window.open(url.toString(), '_blank', 'noopener')
}

export function openWhatsapp(b: ContactBooking): void {
  if (!b.client_phone) return
  const date    = new Date(b.scheduled_at)
  const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = fmt(date)
  const text    = [`Bonjour ${b.client_name},`, '', 'Je vous contacte au sujet de votre réservation :', `• Prestation : ${b.services?.name ?? '—'}`, `• Date : ${dateStr} à ${timeStr}`, `• Adresse : ${b.address}`, ''].join('\n')
  let phone = b.client_phone.replace(/\D/g, '')
  if (phone.startsWith('0')) phone = '33' + phone.slice(1)
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

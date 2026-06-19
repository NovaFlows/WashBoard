import { NextRequest, NextResponse } from 'next/server'
import { createCalendarEvent, getBusySlots } from '@/lib/googleCalendar'

export async function POST(req: NextRequest) {
  const { dateStr, timeStr, firstname, lastname, email, message } = await req.json()

  if (!dateStr || !timeStr || !firstname || !lastname || !email) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  try {
    // Double-check the slot is still free before creating
    const busy = await getBusySlots(dateStr)
    if (busy.includes(timeStr)) {
      return NextResponse.json({ error: 'Ce créneau vient d\'être réservé. Veuillez en choisir un autre.' }, { status: 409 })
    }

    await createCalendarEvent({ dateStr, timeStr, firstname, lastname, email, message: message ?? '' })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[booking/book]', err)
    return NextResponse.json({ error: 'Impossible de créer le rendez-vous.' }, { status: 500 })
  }
}

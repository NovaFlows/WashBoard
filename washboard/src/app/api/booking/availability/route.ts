import { NextRequest, NextResponse } from 'next/server'
import { getBusySlots } from '@/lib/googleCalendar'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }
  try {
    const busySlots = await getBusySlots(date)
    return NextResponse.json({ busySlots })
  } catch (err) {
    console.error('[booking/availability]', err)
    return NextResponse.json({ error: 'Calendar unavailable' }, { status: 500 })
  }
}

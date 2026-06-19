import { google } from 'googleapis'

const CALENDAR_ID = 'novaflows.pro@gmail.com'
const TZ = 'Europe/Paris'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!
  const credentials = JSON.parse(raw)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
}

function getParisOffsetMinutes(date: Date): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  const parisDate = new Date(date.toLocaleString('en-US', { timeZone: TZ }))
  return (parisDate.getTime() - utcDate.getTime()) / 60000
}

function parisToUtc(dateStr: string, timeStr: string): Date {
  const naive = new Date(`${dateStr}T${timeStr}:00`)
  const offsetMin = getParisOffsetMinutes(naive)
  return new Date(naive.getTime() - offsetMin * 60000)
}

// Returns list of HH:MM slots (8h-22h) that are busy on the given date
export async function getBusySlots(dateStr: string): Promise<string[]> {
  const auth = getAuth()
  const calendar = google.calendar({ version: 'v3', auth })

  const dayStart = parisToUtc(dateStr, '00:00')
  const dayEnd = parisToUtc(dateStr, '23:59')

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      timeZone: TZ,
      items: [{ id: CALENDAR_ID }],
    },
  })

  const busy = res.data.calendars?.[CALENDAR_ID]?.busy ?? []

  const busySlots: string[] = []
  for (let h = 8; h <= 22; h++) {
    const slotTime = `${String(h).padStart(2, '0')}:00`
    const slotStart = parisToUtc(dateStr, slotTime)
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000)

    const overlaps = busy.some(period => {
      const s = new Date(period.start!)
      const e = new Date(period.end!)
      return slotStart < e && slotEnd > s
    })

    if (overlaps) busySlots.push(slotTime)
  }

  return busySlots
}

export async function createCalendarEvent({
  dateStr, timeStr, firstname, lastname, email, message,
}: {
  dateStr: string
  timeStr: string
  firstname: string
  lastname: string
  email: string
  message: string
}) {
  const auth = getAuth()
  const calendar = google.calendar({ version: 'v3', auth })

  const [h] = timeStr.split(':')
  const endH = String(parseInt(h) + 1).padStart(2, '0')

  await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: `📞 Appel WashBoard — ${firstname} ${lastname}`,
      description: `Email : ${email}${message ? `\nMessage : ${message}` : ''}`,
      start: { dateTime: `${dateStr}T${timeStr}:00`, timeZone: TZ },
      end: { dateTime: `${dateStr}T${endH}:00:00`, timeZone: TZ },
    },
  })
}

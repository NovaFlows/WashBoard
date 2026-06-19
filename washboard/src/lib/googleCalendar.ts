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

// Get Paris UTC offset in hours for a date (1 for CET, 2 for CEST)
// Uses noon UTC as a reference to avoid day-boundary edge cases
function getParisOffsetHours(dateStr: string): number {
  const ref = new Date(`${dateStr}T12:00:00Z`)
  const parisHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }).format(ref),
    10
  )
  return parisHour - 12 // 14-12=2 (CEST) or 13-12=1 (CET)
}

// Convert a Paris local time to UTC by embedding the explicit offset in the ISO string.
// This works correctly regardless of the server's local timezone.
function parisToUtc(dateStr: string, timeStr: string): Date {
  const offsetH = getParisOffsetHours(dateStr)
  const sign = offsetH >= 0 ? '+' : '-'
  const offsetStr = `${sign}${String(Math.abs(offsetH)).padStart(2, '0')}:00`
  return new Date(`${dateStr}T${timeStr}:00${offsetStr}`)
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
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000)

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

  await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: `📞 Appel WashBoard — ${firstname} ${lastname}`,
      description: `Email : ${email}${message ? `\nMessage : ${message}` : ''}`,
      start: { dateTime: `${dateStr}T${timeStr}:00`, timeZone: TZ },
      end: { dateTime: `${dateStr}T${timeStr.replace(/(\d+):(\d+)/, (_, h, m) => {
        const total = parseInt(h) * 60 + parseInt(m) + 30
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
      })}:00`, timeZone: TZ },
    },
  })
}

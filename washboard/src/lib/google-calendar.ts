import { google } from 'googleapis'

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
  )
}

export function getGoogleAuthUrl(washerId: string): string {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent',
    state: washerId,
  })
}

export async function exchangeCode(code: string): Promise<string | null> {
  const { tokens } = await oauthClient().getToken(code)
  return tokens.refresh_token ?? null
}

// Convertit un ISO UTC en string avec offset Paris explicite (ex: "2026-06-20T11:00:00+02:00")
// Évite toute ambiguïté avec le champ timeZone de l'API Google Calendar
function toParisOffsetIso(utcIso: string): string {
  const date = new Date(utcIso)
  const utcMs   = date.getTime()
  const parisMs = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' })).getTime()
  const utcRef  = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
  const offsetMin = (parisMs - utcRef) / 60000
  const sign = offsetMin >= 0 ? '+' : '-'
  const offH = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0')
  const offM = String(Math.abs(offsetMin) % 60).padStart(2, '0')
  // Heure locale Paris
  const local = new Date(utcMs + offsetMin * 60000)
  const pad   = (n: number) => String(n).padStart(2, '0')
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}${sign}${offH}:${offM}`
}

interface CalendarEvent {
  summary: string
  description?: string
  location?: string
  startIso: string
  endIso: string
}

export async function createCalendarEvent(refreshToken: string, event: CalendarEvent): Promise<string | null> {
  try {
    const client = oauthClient()
    client.setCredentials({ refresh_token: refreshToken })
    const cal = google.calendar({ version: 'v3', auth: client })
    const res = await cal.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary:     event.summary,
        description: event.description,
        location:    event.location,
        start: { dateTime: toParisOffsetIso(event.startIso) },
        end:   { dateTime: toParisOffsetIso(event.endIso) },
      },
    })
    return res.data.id ?? null
  } catch (e) {
    console.error('[GCal] createEvent error:', e)
    return null
  }
}

export async function patchCalendarEvent(
  refreshToken: string,
  eventId: string,
  patch: { summary?: string; startIso?: string; endIso?: string },
): Promise<void> {
  try {
    const client = oauthClient()
    client.setCredentials({ refresh_token: refreshToken })
    const cal = google.calendar({ version: 'v3', auth: client })
    const requestBody: Record<string, unknown> = {}
    if (patch.summary  !== undefined) requestBody.summary = patch.summary
    if (patch.startIso !== undefined) requestBody.start   = { dateTime: toParisOffsetIso(patch.startIso) }
    if (patch.endIso   !== undefined) requestBody.end     = { dateTime: toParisOffsetIso(patch.endIso) }
    await cal.events.patch({ calendarId: 'primary', eventId, requestBody })
  } catch (e) {
    console.error('[GCal] patchEvent error:', e)
  }
}

export async function deleteCalendarEvent(refreshToken: string, eventId: string): Promise<void> {
  try {
    const client = oauthClient()
    client.setCredentials({ refresh_token: refreshToken })
    const cal = google.calendar({ version: 'v3', auth: client })
    await cal.events.delete({ calendarId: 'primary', eventId })
  } catch (e) {
    console.error('[GCal] deleteEvent error:', e)
  }
}

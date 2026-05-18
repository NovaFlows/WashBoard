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
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.startIso, timeZone: 'Europe/Paris' },
        end:   { dateTime: event.endIso,   timeZone: 'Europe/Paris' },
      },
    })
    return res.data.id ?? null
  } catch (e) {
    console.error('[GCal] createEvent error:', e)
    return null
  }
}

export async function patchCalendarEvent(refreshToken: string, eventId: string, patch: { summary: string }): Promise<void> {
  try {
    const client = oauthClient()
    client.setCredentials({ refresh_token: refreshToken })
    const cal = google.calendar({ version: 'v3', auth: client })
    await cal.events.patch({ calendarId: 'primary', eventId, requestBody: patch })
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

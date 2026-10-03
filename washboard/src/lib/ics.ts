// Fichier .ics (format iCalendar) pour le bouton « Ajouter à mon agenda » de
// l'écran de confirmation.
//
// Généré à la volée, côté client, à partir des données déjà connues du
// formulaire — pas de nouvelle colonne, pas de nouvel appel serveur. On ne
// gère volontairement qu'un seul VEVENT : un rendez-vous de lavage n'est
// jamais récurrent ici (la récurrence n'existe pas dans le produit).

/** Un événement minimal, assez pour un rendez-vous de lavage. */
export type IcsEvent = {
  /** Identifiant stable de l'événement — l'id de la réservation suffit :
   *  rouvrir deux fois la confirmation et l'ajouter deux fois à l'agenda doit
   *  mettre à jour le même événement, pas en créer un second. */
  uid: string
  title: string
  description?: string
  location?: string
  start: Date
  durationMinutes: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Date UTC au format iCalendar : `AAAAMMJJTHHMMSSZ`.
 *
 *  En UTC et pas à l'heure de Paris : un `DTSTART`/`DTEND` suivi de `Z` est
 *  compris sans ambiguïté par tout agenda, quel que soit le fuseau de
 *  l'appareil qui l'importe — contrairement à une heure locale sans `Z`, qui
 *  demanderait aussi un bloc `VTIMEZONE` pour rester correcte. */
function formatIcsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  )
}

/** Échappe les caractères que le format iCalendar traite spécialement.
 *  L'ordre compte : le backslash doit être échappé AVANT les autres, sinon on
 *  double l'échappement qu'on vient d'ajouter. */
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

/** Construit le contenu texte d'un fichier .ics à un seul événement.
 *
 *  Fin de ligne CRLF : imposée par la RFC 5545, et certains agendas (Outlook
 *  notamment) refusent ou déforment un fichier qui ne la respecte pas. */
export function buildIcs(event: IcsEvent): string {
  const end = new Date(event.start.getTime() + Math.max(0, event.durationMinutes) * 60_000)

  const lines: (string | null)[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WashBoard//Reservation//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(event.start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : null,
    event.description ? `DESCRIPTION:${escapeIcsText(event.description)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.filter((l): l is string => l !== null).join('\r\n')
}

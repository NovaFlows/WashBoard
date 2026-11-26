/** YYYY-MM-DD in local timezone — use for date inputs and calendar keys. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getMondayOf(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  return r
}

/** Fuseau par défaut des rendez-vous.
 *
 *  Un rendez-vous est un fait à l'heure DU LAVEUR : ses horaires d'ouverture
 *  sont stockés en « HH:MM » sans fuseau, dans son heure locale. Mais une
 *  partie de l'affichage est calculée sur le SERVEUR — notifications, e-mails —
 *  et Vercel tourne en UTC. Sans fuseau explicite, un rendez-vous de 8 h s'y
 *  écrivait « 06:00 » l'été et « 07:00 » l'hiver.
 *
 *  Constaté le 2026-09-11 : un laveur a reçu « nouvelle réservation … à
 *  06:00 », hors de ses horaires, pour un rendez-vous correctement enregistré
 *  à 8 h. Les e-mails portaient la même erreur depuis mai.
 *
 *  Le fuseau est donc toujours fixé, jamais laissé à la machine. Paris est le
 *  fuseau de presque tous les laveurs ; un laveur d'outre-mer (Cayenne,
 *  2026-11-26) a le sien dans `washers.fuseau` (voir `lib/fuseaux.ts`), passé
 *  en dernier argument à chaque fonction ci-dessous. Sans cet argument, le
 *  comportement est exactement celui d'avant : l'heure de Paris. */
export const FUSEAU = 'Europe/Paris'

/** "YYYY-MM-DD" dans le fuseau donné (Paris par défaut) — le jour civil que
 *  voit le laveur ou son client, quel que soit le fuseau du serveur qui
 *  l'exécute (UTC sur Vercel). Sert à savoir si UNE date tombe
 *  « aujourd'hui » (réservation le jour même), pas seulement à formater. */
export function dateStrParis(d: Date = new Date(), fuseau: string = FUSEAU): string {
  return d.toLocaleDateString('en-CA', { timeZone: fuseau })
}

const formats = new Map<string, Intl.DateTimeFormat>()
function formatComplet(fuseau: string): Intl.DateTimeFormat {
  let f = formats.get(fuseau)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: fuseau, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    formats.set(fuseau, f)
  }
  return f
}

/** Avance du fuseau sur UTC à cet instant, en ms (Paris : +2 h l'été, +1 h
 *  l'hiver ; Cayenne : −3 h toute l'année). */
function decalage(ms: number, fuseau: string): number {
  const p = formatComplet(fuseau).formatToParts(new Date(ms))
  const n = (type: string) => Number(p.find(x => x.type === type)?.value)
  const lu = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour') % 24, n('minute'), n('second'))
  return lu - Math.floor(ms / 1000) * 1000
}

/** Instant exact (ms epoch) de « tel jour, telle heure » dans le fuseau donné
 *  (Paris par défaut), quel que soit le fuseau de l'appareil. `mois` va de 1
 *  à 12.
 *
 *  Les horaires d'un laveur sont des heures locales et le serveur vérifie
 *  chaque réservation dans ce même fuseau (`heureParis`). Construire l'heure
 *  avec `setHours` la plaçait dans le fuseau de l'appareil : en UTC, le
 *  créneau « 17:00 » partait à 19:00 heure de Paris (2026-10-18). */
export function instantParis(
  annee: number, mois: number, jour: number, heures: number, minutes: number,
  fuseau: string = FUSEAU,
): number {
  const naif = Date.UTC(annee, mois - 1, jour, heures, minutes)
  // Deux passes : la première estimation peut tomber de l'autre côté d'un
  // changement d'heure.
  const essai = naif - decalage(naif, fuseau)
  return naif - decalage(essai, fuseau)
}

/** Instant d'une saisie « AAAA-MM-JJ » + « HH:MM » faite par le laveur dans
 *  son agenda, lue dans son fuseau. Remplace `new Date(`${date}T${heure}:00`)`,
 *  qui la lisait dans le fuseau de l'APPAREIL : identique pour un laveur de
 *  Paris sur un téléphone à l'heure de Paris, faux dès que les deux diffèrent.
 *  Date invalide si la saisie est illisible (même contrat qu'avant). */
export function instantSaisi(dateStr: string, heure: string, fuseau: string = FUSEAU): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  const h = /^(\d{1,2}):(\d{2})/.exec(heure)
  if (!d || !h) return new Date(NaN)
  return new Date(instantParis(Number(d[1]), Number(d[2]), Number(d[3]), Number(h[1]), Number(h[2]), fuseau))
}

/** Jour (« AAAA-MM-JJ ») et heure (« HH:MM ») d'un instant dans le fuseau
 *  donné : l'inverse de `instantSaisi`, pour pré-remplir un formulaire. */
export function saisieDe(instant: Date, fuseau: string = FUSEAU): { date: string; heure: string } {
  const p = formatComplet(fuseau).formatToParts(instant)
  const v = (type: string) => p.find(x => x.type === type)?.value ?? '00'
  return { date: `${v('year')}-${v('month')}-${v('day')}`, heure: `${String(Number(v('hour')) % 24).padStart(2, '0')}:${v('minute')}` }
}

/** Aujourd'hui dans le fuseau du laveur, à minuit de l'appareil : la case
 *  « aujourd'hui » d'un calendrier de réservation, même sur un appareil réglé
 *  sur un autre fuseau. */
export function aujourdhuiParis(maintenant: Date = new Date(), fuseau: string = FUSEAU): Date {
  const [a, m, j] = dateStrParis(maintenant, fuseau).split('-').map(Number)
  return new Date(a, m - 1, j)
}

/** Heure au format court français (09:05, 14:30), dans le fuseau donné.
 *
 *  Était recopiée dans trois fichiers (calendrier, liste de RDV, liens de
 *  contact) sous le nom `fmt`. */
export function formatHeure(date: Date, fuseau: string = FUSEAU): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: fuseau })
}

/** Heure la plus courte possible : « 8h », « 8h30 », « 14h ».
 *
 *  Dans la vue Mois du calendrier, une case fait une cinquantaine de pixels de
 *  large sur un téléphone : « 08:00 » y était déjà tronqué en « 08:… », ce qui
 *  ne dit rien. En retirant le zéro de tête et les minutes rondes, on gagne
 *  assez de place pour que l'heure reste lisible.
 *
 *  Tirée de `formatHeure` pour hériter de son fuseau : `getHours()` lisait
 *  l'heure de la machine, pas celle du rendez-vous. */
export function formatHeureCompacte(date: Date, fuseau: string = FUSEAU): string {
  const [, h, m] = /(\d{1,2})\D+(\d{2})/.exec(formatHeure(date, fuseau)) ?? []
  const heures = Number(h)
  const minutes = Number(m)
  return minutes === 0 ? `${heures}h` : `${heures}h${String(minutes).padStart(2, '0')}`
}

/** Minuit dans le fuseau donné (Paris par défaut) pour la date `YYYY-MM-DD`,
 *  en instant UTC exact.
 *
 *  Sert à borner une journée dans une requête (`gte`/`lt` sur `scheduled_at`) :
 *  la colonne est en UTC, mais « le 21 septembre » est une notion locale.
 *  Se recale automatiquement heure d'été / heure d'hiver, y compris le jour
 *  même du changement (vérifié sur les bascules 2026 : 29 mars, 25 octobre). */
export function minuitParisUTC(dateStr: string, fuseau: string = FUSEAU): Date {
  const [a, m, j] = dateStr.split('-').map(Number)
  return new Date(instantParis(a, m, j, 0, 0, fuseau))
}

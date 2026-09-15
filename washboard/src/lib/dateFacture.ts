/** Devine la date d'une facture importée (faite ailleurs, avant WashBoard).
 *
 *  Aucune méthode n'est fiable à 100 % : chaque logiciel écrit la date à sa
 *  façon, et une photo n'a pas de texte lisible. On essaie donc, du plus sûr au
 *  moins sûr, et on dit d'où vient la date — l'écran d'import la montre au
 *  laveur, qui la corrige avant d'enregistrer. Aucune facture n'est rangée sans
 *  qu'il ait vu sa date.
 *
 *  Français ET anglais : un laveur importe aussi les factures de ses propres
 *  fournisseurs et outils, souvent en anglais (« Date of issue April 6, 2026 »,
 *  « Amount due €21.60 ») — constaté au premier essai, le 2026-09-15.
 *
 *  Pur : aucun accès réseau, testable sans fichier. */

export type SourceDate = 'nom' | 'texte' | 'metadonnees' | 'fichier'
export type DateDevinee = { date: string; source: SourceDate } | null

const MOIS: Record<string, number> = {
  // français
  janvier: 1, janv: 1, fevrier: 2, fevr: 2, fev: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6,
  juillet: 7, juil: 7, aout: 8, septembre: 9, sept: 9, sep: 9, octobre: 10, oct: 10,
  novembre: 11, nov: 11, decembre: 12, dec: 12,
  // anglais
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5,
  june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, october: 10,
  november: 11, december: 12,
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Date plausible pour une facture : existe au calendrier, pas avant 2000,
 *  pas plus d'un jour dans le futur. */
function iso(annee: number, mois: number, jour: number, maintenant: Date): string | null {
  if (annee < 100) annee += 2000
  const d = new Date(Date.UTC(annee, mois - 1, jour))
  if (d.getUTCFullYear() !== annee || d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) return null
  if (annee < 2000 || d.getTime() > maintenant.getTime() + 86_400_000) return null
  return d.toISOString().slice(0, 10)
}

/** Toutes les dates lisibles dans un texte, dans l'ordre où elles apparaissent. */
function datesDans(texte: string, maintenant: Date): { date: string; index: number }[] {
  const t = sansAccents(texte)
  const trouvees: { date: string; index: number }[] = []
  const ajouter = (index: number, a: number, m: number, j: number) => {
    const d = iso(a, m, j, maintenant)
    if (d) trouvees.push({ date: d, index })
  }
  // 2026-03-12, 2026_03_12, 2026.03.12
  for (const m of t.matchAll(/(?<!\d)(20\d{2})[-_./](\d{1,2})[-_./](\d{1,2})(?!\d)/g)) ajouter(m.index, +m[1], +m[2], +m[3])
  // 20260312
  for (const m of t.matchAll(/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/g)) ajouter(m.index, +m[1], +m[2], +m[3])
  // 12/03/2026, 12-03-2026, 12.03.2026, 12/03/26 — ordre français jour/mois/année
  for (const m of t.matchAll(/(?<!\d)(\d{1,2})[-_./](\d{1,2})[-_./](\d{4}|\d{2})(?!\d)/g)) ajouter(m.index, +m[3], +m[2], +m[1])
  // 12 mars 2026, 1er avril 2026, 6th April 2026
  for (const m of t.matchAll(/(?<!\d)(\d{1,2})(?:er|st|nd|rd|th)?\s+([a-z]+)\.?,?\s+(20\d{2})(?!\d)/g)) {
    const mois = MOIS[m[2]]
    if (mois) ajouter(m.index, +m[3], mois, +m[1])
  }
  // April 6, 2026 — Apr 6 2026 (ordre anglais mois/jour/année)
  for (const m of t.matchAll(/(?<![a-z])([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})(?!\d)/g)) {
    const mois = MOIS[m[1]]
    if (mois) ajouter(m.index, +m[3], mois, +m[2])
  }
  return trouvees.sort((a, b) => a.index - b.index)
}

/** Date écrite dans le texte d'une facture. Une date précédée d'un libellé
 *  (« Date de facture », « Date d'émission », « Date of issue »…) l'emporte sur
 *  la première date venue, qui peut être une échéance ou une période. */
export function dateDansTexte(texte: string, maintenant = new Date()): string | null {
  const dates = datesDans(texte, maintenant)
  if (dates.length === 0) return null
  const t = sansAccents(texte)
  const libelles = /(date\s+(de\s+(la\s+)?facture|d'?\s?emission|de\s+facturation|of\s+issue)|facture\s+du|emise?\s+le|(invoice|issue)\s+date|date\s*:)/g
  for (const l of t.matchAll(libelles)) {
    const suivante = dates.find(d => d.index > l.index && d.index - l.index < 60)
    if (suivante) return suivante.date
  }
  return dates[0].date
}

/** Date de création inscrite dans le PDF (« D:20260312093000+01'00' »). */
export function dateMetadonnees(brut: string | null | undefined, maintenant = new Date()): string | null {
  const m = /D?:?(\d{4})(\d{2})(\d{2})/.exec(String(brut ?? ''))
  return m ? iso(+m[1], +m[2], +m[3], maintenant) : null
}

export function devinerDate(entree: {
  nomFichier: string
  texte?: string | null
  metadonnees?: string | null
  modifieLe?: number | null
}, maintenant = new Date()): DateDevinee {
  const nom = datesDans(entree.nomFichier.replace(/\.[a-z0-9]+$/i, ''), maintenant)[0]?.date
  if (nom) return { date: nom, source: 'nom' }
  const texte = entree.texte ? dateDansTexte(entree.texte, maintenant) : null
  if (texte) return { date: texte, source: 'texte' }
  const meta = dateMetadonnees(entree.metadonnees, maintenant)
  if (meta) return { date: meta, source: 'metadonnees' }
  if (entree.modifieLe && entree.modifieLe > 0) {
    const d = new Date(entree.modifieLe)
    const f = iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), maintenant)
    if (f) return { date: f, source: 'fichier' }
  }
  return null
}

// ── Montant ────────────────────────────────────────────────────────────────

const NOMBRE = String.raw`(\d{1,3}(?:[ .,  ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`

/** « 1 250,50 », « 1,250.50 », « 21.60 », « 21,60 » : le dernier séparateur
 *  suivi d'un ou deux chiffres est la virgule décimale ; les autres sont des
 *  séparateurs de milliers. */
function lireNombre(brut: string): number | null {
  const s = brut.replace(/[  ]/g, ' ').trim()
  const dernier = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'))
  const apres = dernier >= 0 ? s.length - dernier - 1 : 0
  const entier = (apres > 0 && apres <= 2 ? s.slice(0, dernier) : s).replace(/[ .,]/g, '')
  const decimales = apres > 0 && apres <= 2 ? s.slice(dernier + 1) : '0'
  const n = Number(`${entier}.${decimales}`)
  return Number.isFinite(n) ? n : null
}

/** Libellés du montant à payer, du plus sûr au moins sûr. « Total » seul vient
 *  en dernier, et jamais « Total HT » / « Total excluding tax ». */
const LIBELLES_MONTANT = [
  'total ttc', 'net a payer', 'montant ttc', 'total a payer', 'amount due', 'total due', 'montant du',
  String.raw`total(?!\s+(?:excluding|excl|hors|ht\b|sans|before))`,
]

/** Montant TTC écrit dans le texte, s'il est clairement libellé et suivi (ou
 *  précédé) du symbole €. Facultatif : sans libellé net, on ne devine rien —
 *  un montant faux dans les totaux du mois serait pire qu'un montant absent. */
export function montantDansTexte(texte: string): number | null {
  const t = sansAccents(texte)
  for (const libelle of LIBELLES_MONTANT) {
    const re = new RegExp(String.raw`(?:^|[^a-z])${libelle}\s*:?\s*((?:€|eur)\s*)?${NOMBRE}(\s*(?:€|eur))?`)
    const m = re.exec(t)
    if (m && (m[1] || m[3])) {
      const n = lireNombre(m[2])
      if (n !== null && n > 0 && n < 1_000_000) return Math.round(n * 100) / 100
    }
  }
  return null
}

// Changer le lien de réservation (le « slug ») depuis « Mes liens » de la PWA.
// Mêmes règles et même route que l'ancien écran (`ParametresFormV1`,
// `PATCH /api/washer`) : le serveur revalide le format et l'unicité, ce contrôle-ci
// ne sert qu'à répondre tout de suite, sans aller-retour, à une faute de frappe.

import { appeler, type ResultatApi } from '@/lib/prestationsApi'

// Copie exacte de la règle du serveur (`api/washer/route.ts`) : 3 à 40 caractères,
// minuscules, chiffres et tirets, jamais de tiret au début ni à la fin.
const FORMAT_SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/

export const PHRASE_SLUG_INVALIDE =
  '3 à 40 caractères : minuscules, chiffres et tirets (pas au début ni à la fin).'

export type ResultatSlug = { ok: true; valeur: string } | { ok: false; message: string }

/** Ce que le laveur tape (« Ma Société », « ma-société ») est ramené à un lien
 *  possible quand c'est sans ambiguïté : minuscules et espaces devenus tirets. Le reste
 *  est refusé avec une phrase, jamais corrigé en silence (les accents, notamment). */
export function normaliserSlug(saisie: string): ResultatSlug {
  const s = saisie.trim().toLowerCase().replace(/\s+/g, '-')
  if (!FORMAT_SLUG.test(s)) return { ok: false, message: PHRASE_SLUG_INVALIDE }
  return { ok: true, valeur: s }
}

/** `PATCH /api/washer` avec le seul champ `slug`. Le refus « déjà utilisé » (409) et
 *  le format invalide (400) reviennent en phrase claire du serveur. */
export async function enregistrerSlug(slug: string): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', '/api/washer', { slug })
  return r.ok ? { ok: true, data: null } : r
}

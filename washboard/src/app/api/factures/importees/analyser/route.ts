import { NextResponse } from 'next/server'
import { getDocumentProxy, extractText, getMeta } from 'unpdf'
import { requireWasher } from '@/lib/requireWasher'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET_FACTURES_IMPORTEES, cheminAppartient } from '@/lib/importFactures'
import { devinerDate, montantDansTexte } from '@/lib/dateFacture'
import { logger } from '@/lib/logger'

// Devine la date (et, s'il est clairement écrit, le montant) d'une facture
// importée, une fois le fichier arrivé dans le stockage. Le résultat n'est
// qu'une proposition : l'écran d'import la montre au laveur, qui la corrige
// avant d'enregistrer. Une lecture qui échoue n'est donc jamais bloquante.
export async function POST(req: Request) {
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { washerId } = auth.ctx

  const { chemin, nomFichier, modifieLe } = await req.json().catch(() => ({})) as Record<string, unknown>
  if (!cheminAppartient(chemin, washerId)) {
    return NextResponse.json({ error: 'Fichier introuvable dans votre espace.' }, { status: 404 })
  }
  const nom = typeof nomFichier === 'string' ? nomFichier.slice(0, 200) : ''

  let texte: string | null = null
  let metadonnees: string | null = null
  if (chemin.endsWith('.pdf')) {
    const { data: fichier, error } = await createAdminClient().storage
      .from(BUCKET_FACTURES_IMPORTEES)
      .download(chemin)
    if (error || !fichier) {
      logger.warn('factures_importees.analyse.download_failed', { washerId }, error)
    } else {
      try {
        const pdf = await getDocumentProxy(new Uint8Array(await fichier.arrayBuffer()))
        const { text } = await extractText(pdf, { mergePages: true })
        texte = String(text).slice(0, 20_000)
        const { info } = await getMeta(pdf)
        const creation = (info as Record<string, unknown> | undefined)?.CreationDate
        metadonnees = typeof creation === 'string' ? creation : null
      } catch (e) {
        // PDF protégé, abîmé ou scanné sans texte : on se rabat sur le nom et
        // la date du fichier.
        logger.warn('factures_importees.analyse.pdf_illisible', { washerId }, e)
      }
    }
  }

  const devinee = devinerDate({
    nomFichier: nom,
    texte,
    metadonnees,
    modifieLe: typeof modifieLe === 'number' ? modifieLe : null,
  })
  return NextResponse.json({
    date: devinee?.date ?? null,
    source: devinee?.source ?? null,
    montant: texte ? montantDansTexte(texte) : null,
  })
}

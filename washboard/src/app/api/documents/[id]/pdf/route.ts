import { createAdminClient } from '@/lib/supabase/admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import FacturePDF from '@/components/pdf/FacturePDF'
import type { FactureContenu } from '@/lib/facture'
import { logoPourPdf } from '@/lib/logoFacture'
import { logger } from '@/lib/logger'

// Le PDF d'un devis ou d'une facture écrits à la main. Même gabarit que les factures de
// réservation (`FacturePDF`), même régime d'accès : route publique dont l'identifiant du
// document fait le jeton — c'est ce lien que reçoit le client par email, sans compte.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // La RLS interdit `documents` à l'anon : service-role, ciblé sur l'id exact.
  const admin = createAdminClient()
  const { data: document, error } = await admin
    .from('documents')
    .select('genre, numero, contenu, emis_le')
    .eq('id', id)
    .maybeSingle()

  if (error) logger.error('documents.pdf.read_failed', { documentId: id }, error)
  if (!document?.numero) return new Response('Not found', { status: 404 })

  const contenu = document.contenu as FactureContenu
  const buffer = await renderToBuffer(createElement(FacturePDF, {
    numero: document.numero as string,
    emiseLe: document.emis_le as string,
    contenu,
    logo: await logoPourPdf(contenu.vendeur.logoUrl),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any)

  const nomFichier = `${document.genre === 'devis' ? 'devis' : 'facture'}-${document.numero}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomFichier}"`,
      'Cache-Control': 'no-store',
      // Même raison que pour les factures de réservation : le lien est public, et un client
      // qui le colle quelque part rendrait sinon le document — SIRET, adresses, montants —
      // trouvable par une recherche.
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  })
}

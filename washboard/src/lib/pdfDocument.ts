import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import FacturePDF from '@/components/pdf/FacturePDF'
import { logoPourPdf } from '@/lib/logoFacture'
import type { FactureContenu } from '@/lib/facture'
import { nomFichierDocument } from '@/lib/documents'

export { nomFichierDocument }

// Le PDF d'un devis ou d'une facture écrits à la main, rendu au même endroit pour les deux
// usages : le lien public (`/api/documents/[id]/pdf`) et la pièce jointe de l'email.
//
// Écrit ici plutôt que dupliqué dans les deux routes : le client qui télécharge et celui qui
// reçoit l'email doivent avoir exactement le même document, y compris le nom du fichier.

export type DocumentRendable = {
  genre: string
  numero: string
  emis_le: string
  contenu: FactureContenu
}

export async function rendreDocumentPdf(d: DocumentRendable): Promise<Buffer> {
  return renderToBuffer(createElement(FacturePDF, {
    numero: d.numero,
    emiseLe: d.emis_le,
    contenu: d.contenu,
    logo: await logoPourPdf(d.contenu.vendeur.logoUrl),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any)
}

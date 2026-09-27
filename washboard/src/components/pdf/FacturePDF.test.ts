import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import FacturePDF from '@/components/pdf/FacturePDF'
import { construireDocument, saisieNeuve } from '@/lib/documents'
import type { VendeurFacturable } from '@/lib/facture'

// Le PDF part chez le client : un style mal nommé ou une date nulle non gérée ne doivent pas
// se découvrir en production, où l'erreur se voit en 500 sur le lien de la facture.
//
// Ce test REND vraiment le document (react-pdf), il ne se contente pas de construire l'arbre.
// Pour regarder le résultat : `WB_PDF_OUT=/un/dossier npx vitest run FacturePDF`.

const vendeur: VendeurFacturable = {
  name: 'AutoNettoyage',
  phone: '06 12 34 56 78',
  facture_statut: 'ei',
  facture_nom_legal: 'Jean Dupont',
  facture_siret: '73282932000074',
  facture_adresse: '8 rue des Lilas, 95560 Maffliers',
  facture_regime_tva: 'franchise',
}

const saisie = (genre: 'devis' | 'facture') => ({
  ...saisieNeuve(genre, '2026-09-27'),
  clientNom: 'Marie Martin',
  clientEmail: 'marie@exemple.fr',
  clientAdresse: '3 allée des Roses, 95000 Cergy',
  lieu: '3 allée des Roses, 95000 Cergy',
  lignes: [
    { designation: 'Nettoyage canapé 3 places', quantite: 1, prixUnitaireTtc: 120 },
    { designation: 'Tapis', quantite: 3, prixUnitaireTtc: 16.1 },
  ],
  remiseTtc: 8.3,
  note: 'Intervention sur une demi-journée. Prévoir un point d’eau et une prise électrique.',
})

/** Le texte réellement imprimé, relu depuis le PDF produit : les flux sont compressés, et le
 *  texte y vit en hexadécimal dans des opérateurs `TJ`. Sans cette relecture, un test qui
 *  vérifie « ça rend » laisse passer n'importe quel libellé faux. */
function texteDuPdf(pdf: Buffer): string {
  const flux: string[] = []
  let i = 0
  for (;;) {
    const debut = pdf.indexOf('stream', i)
    if (debut < 0) break
    const fin = pdf.indexOf('endstream', debut)
    if (fin < 0) break
    let d = debut + 6
    while (pdf[d] === 13 || pdf[d] === 10) d++
    try { flux.push(inflateSync(pdf.subarray(d, fin)).toString('latin1')) } catch { /* police ou image */ }
    i = fin + 9
  }
  return [...flux.join('\n').matchAll(/\[([^\]]*)\]\s*TJ/g)]
    .map(m => [...m[1].matchAll(/<([0-9a-fA-F]*)>/g)]
      .map(h => Buffer.from(h[1], 'hex').toString('latin1'))
      .join(''))
    .join('\n')
}

async function rendre(genre: 'devis' | 'facture', numero: string) {
  const contenu = construireDocument(saisie(genre), vendeur)
  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(FacturePDF, { numero, emiseLe: '2026-09-27T10:00:00.000Z', contenu }) as any,
  )
  if (process.env.WB_PDF_OUT) writeFileSync(`${process.env.WB_PDF_OUT}/${genre}.pdf`, buffer)
  return buffer
}

describe('FacturePDF', () => {
  it('imprime un devis : titre, validité, case « bon pour accord »', async () => {
    const texte = texteDuPdf(await rendre('devis', 'D-2026-0003'))

    expect(texte).toContain('Devis')
    expect(texte).toContain('D-2026-0003')
    expect(texte).toContain('Valable jusqu')
    expect(texte).toContain('27 octobre 2026')
    expect(texte).toContain('Bon pour accord')
    expect(texte).toContain('Signature du client')
    // Une prestation pas encore planifiée : surtout pas la date du jour, que le client
    // lirait comme un rendez-vous pris.
    expect(texte).toContain('Date à convenir')
    // Le mot du laveur, apostrophe typographique comprise (octet 0x92 en WinAnsi).
    expect(texte).toContain('Prévoir un point d\u0092eau')
    // Les pénalités de retard n'ont rien à faire sur un devis : rien n'est encore dû.
    expect(texte).not.toContain('L441-10')
  }, 30_000)

  it('imprime une facture écrite à la main, avec ses mentions à elle', async () => {
    const texte = texteDuPdf(await rendre('facture', 'F-2026-0004'))

    expect(texte).toContain('Facture')
    expect(texte).toContain('F-2026-0004')
    expect(texte).not.toContain('Bon pour accord')
    expect(texte).not.toContain('Valable jusqu')
  }, 30_000)

  it('nomme la remise « Remise », pas « Remise créneau optimisé »', async () => {
    // Le créneau optimisé n'existe que sur une réservation : ce libellé-là sur un devis
    // écrit à la main parlerait au client d'une mécanique qu'il n'a jamais vue.
    const texte = texteDuPdf(await rendre('devis', 'D-2026-0003'))
    expect(texte).toContain('Remise')
    expect(texte).not.toContain('optimis')
  }, 30_000)

  it('une facture de réservation — sans `genre` — ne change pas d’un iota', async () => {
    const contenu = construireDocument(
      { ...saisie('facture'), date: '2026-09-20T14:30:00.000Z' },
      vendeur,
    )
    const buffer = await renderToBuffer(
      // Le contenu d'une facture de rendez-vous ne porte pas de `genre` : c'est le cas de
      // toutes celles déjà émises en base, elles doivent continuer à s'afficher comme avant.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(FacturePDF, { numero: 'F-2026-0001', emiseLe: '2026-09-20T15:00:00.000Z', contenu: { ...contenu, genre: undefined } }) as any,
    )
    const texte = texteDuPdf(buffer)

    expect(texte).toContain('Facture')
    expect(texte).toContain('Remise créneau optimisé')
    // La date d'une prestation planifiée garde son heure.
    expect(texte).toMatch(/Le 20 septembre 2026/)
    expect(texte).toContain('16:30')
  }, 30_000)
})

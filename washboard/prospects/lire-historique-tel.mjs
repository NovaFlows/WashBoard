// Lecture SEULE des sauvegardes de prospects.xlsx : le numero de telephone
// enregistre pour un laveur a chaque date de sauvegarde. Sert d'historique, la
// base n'en gardant aucun.
//
//   node lire-historique-tel.mjs pista
import ExcelJS from 'exceljs'
import fs from 'node:fs'

const motif = new RegExp(process.argv[2] ?? 'pista', 'i')
const fichiers = fs.readdirSync('.').filter(f => f.endsWith('.xlsx') && !f.startsWith('~$')).sort()

for (const f of fichiers) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(f)
  for (const ws of wb.worksheets) {
    // `row.values` est un tableau creux (index 0 vide) : on lit cellule par
    // cellule, sinon findIndex tombe sur un trou et casse.
    const entetes = []
    for (let c = 1; c <= ws.columnCount; c++) entetes[c] = String(ws.getRow(1).getCell(c).value ?? '').toLowerCase()
    const colTel = entetes.findIndex(h => (h ?? '').includes('téléphone') || (h ?? '').includes('telephone'))
    if (colTel < 1) continue
    for (let r = 2; r <= ws.rowCount; r++) {
      const vals = ws.getRow(r).values ?? []
      const ligne = vals.map(v => (v && typeof v === 'object' && 'text' in v) ? v.text : v).join(' | ')
      if (!motif.test(ligne)) continue
      const tel = vals[colTel]
      console.log(`${f.padEnd(52)} [${ws.name}] tel=${String(tel ?? '').trim() || '(vide)'}`)
    }
  }
}

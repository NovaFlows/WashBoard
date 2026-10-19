// Icônes des emails : écrit les sources SVG dans public/email/ puis leurs PNG @2x.
//
// Pourquoi des PNG : Gmail et Outlook retirent le SVG en ligne. Les emails pointent donc
// vers `${appUrl}/email/<nom>.png`, affichés à la moitié de leur taille réelle (net sur
// écran haute densité). Relancer après toute retouche : `node scripts/email-icones.mjs`.
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const DOSSIER = path.join(process.cwd(), 'public', 'email')

const ENCRE = '#16161A'
const ACCENT = '#306090'
const AMBRE = '#9A5B00'
const ROUGE = '#B3261E'

// Pastille des icônes d'en-tête : un disque très pâle de la couleur du trait.
const PASTILLE = { [ENCRE]: '#F1F0ED', [ACCENT]: '#EBF0F6', [AMBRE]: '#F6EEE3', [ROUGE]: '#F8EAE9' }

// Tracés sur une grille de 24, trait fin.
const TRACES = {
  horloge: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.6V12l3 2"/>`,
  sablier: `<path d="M6.5 3.5h11M6.5 20.5h11"/><path d="M8 3.5v2.4c0 2.1 1.4 3.6 4 6.1 2.6-2.5 4-4 4-6.1V3.5"/><path d="M8 20.5v-2.4c0-2.1 1.4-3.6 4-6.1 2.6 2.5 4 4 4 6.1v2.4"/><path d="M10 19.2h4L12 17.3z" fill="currentColor"/>`,
  calendrier: `<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M9 14.8l2.1 2.1 4.2-4.3"/>`,
  cadenas: `<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.4v2.4"/>`,
  bulle: `<path d="M6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><path d="M8.5 9h7M8.5 12h4.5"/>`,
  telephone: `<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>`,
  ordinateur: `<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2.5 19.5h19"/>`,
  alerte: `<path d="M10.3 4.6a2 2 0 0 1 3.4 0l7.4 12.9a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3z"/><path d="M12 9.6v4.2"/><circle cx="12" cy="16.9" r=".6" fill="currentColor"/>`,
}

const ETOILE = 'M12 2.8l2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 16.83l-5.5 2.9 1.05-6.12L3.1 9.27l6.15-.9z'

/** Icône d'en-tête de carte : 44 px affichés, trait de 1,6 sur la grille de 24. */
function pastille(traces, couleur) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <circle cx="22" cy="22" r="22" fill="${PASTILLE[couleur]}"/>
  <g transform="translate(10 10)" fill="none" stroke="${couleur}" color="${couleur}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${traces}</g>
</svg>
`
}

const ICONES = {
  horloge: pastille(TRACES.horloge, ENCRE),
  sablier: pastille(TRACES.sablier, AMBRE),
  calendrier: pastille(TRACES.calendrier, ACCENT),
  cadenas: pastille(TRACES.cadenas, ENCRE),
  bulle: pastille(TRACES.bulle, ACCENT),
  telephone: pastille(TRACES.telephone, ENCRE),
  ordinateur: pastille(TRACES.ordinateur, ENCRE),
  alerte: pastille(TRACES.alerte, ROUGE),
  // Les cinq étoiles de la demande d'avis : 5 × 28 px, 6 px d'écart.
  etoiles: `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="28" viewBox="0 0 164 28">
  ${[0, 1, 2, 3, 4].map(i => `<path transform="translate(${i * 34} 0) scale(${28 / 24})" d="${ETOILE}" fill="${ACCENT}" stroke="${ACCENT}" stroke-width="1" stroke-linejoin="round"/>`).join('\n  ')}
</svg>
`,
  // Le « ★ » du créneau optimisé, à la taille du texte.
  etoile: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
  <path d="${ETOILE}" fill="${ACCENT}" stroke="${ACCENT}" stroke-width="1.2" stroke-linejoin="round"/>
</svg>
`,
}

fs.mkdirSync(DOSSIER, { recursive: true })
for (const [nom, svg] of Object.entries(ICONES)) {
  fs.writeFileSync(path.join(DOSSIER, `${nom}.svg`), svg)
  // density 144 = 2 × 72 : le PNG fait le double de la taille déclarée dans le SVG.
  await sharp(Buffer.from(svg), { density: 144 }).png({ compressionLevel: 9 }).toFile(path.join(DOSSIER, `${nom}.png`))
}
console.log(`${Object.keys(ICONES).length} icônes écrites dans public/email/`)

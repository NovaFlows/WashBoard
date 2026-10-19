// Icônes des emails : écrit les sources SVG dans public/email/ puis leurs PNG @2x.
//
// Pourquoi des PNG : Gmail et Outlook retirent le SVG en ligne. Les emails pointent donc
// vers `${appUrl}/email/<nom>.png`, affichés à la moitié de leur taille réelle (net sur
// écran haute densité). Relancer après toute retouche : `node scripts/email-icones.mjs`.
//
// Règle d'usage : une icône d'en-tête par email envoyé au laveur au nom de WashBoard, aucune
// dans ceux envoyés à ses clients (c'est le laveur qui parle, comme dans l'email du tampon).
// Couleur : encre par défaut ; ambre pour une échéance, rouge pour une perte d'accès. Le bleu
// reste au bouton, seul élément d'accent de l'email.
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const DOSSIER = path.join(process.cwd(), 'public', 'email')

const ENCRE = '#16161A'
const AMBRE = '#9A5B00'
const ROUGE = '#B3261E'
// Or du dernier tampon de la carte de fidélité (email du tampon) : réservé aux étoiles.
const OR = '#E8B84A'
const OR_TRAIT = '#D9A43A'

// Tuile des icônes d'en-tête : carré arrondi (comme les boutons de l'app), fond papier pour
// l'encre, teinte très pâle de la couleur du trait sinon.
const TUILE = { [ENCRE]: '#F6F5F3', [AMBRE]: '#F7EFE4', [ROUGE]: '#F9ECEB' }

// Tracés sur une grille de 24, au trait de l'app (1,8).
const TRACES = {
  sablier: `<path d="M6.5 3.5h11M6.5 20.5h11"/><path d="M8 3.5v2.4c0 2.1 1.4 3.6 4 6.1 2.6-2.5 4-4 4-6.1V3.5"/><path d="M8 20.5v-2.4c0-2.1 1.4-3.6 4-6.1 2.6 2.5 4 4 4 6.1v2.4"/><path d="M10 19.2h4L12 17.3z" fill="currentColor"/>`,
  calendrier: `<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M9 14.8l2.1 2.1 4.2-4.3"/>`,
  cadenas: `<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.4v2.4"/>`,
  bulle: `<path d="M6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><path d="M8.5 9h7M8.5 12h4.5"/>`,
  telephone: `<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>`,
  ordinateur: `<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2.5 19.5h19"/>`,
  alerte: `<path d="M10.3 4.6a2 2 0 0 1 3.4 0l7.4 12.9a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3z"/><path d="M12 9.6v4.2"/><circle cx="12" cy="16.9" r=".7" fill="currentColor"/>`,
  // Code de confirmation d'adresse.
  enveloppe: `<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/>`,
  // Offres et choix de formule.
  etiquette: `<path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2a1.5 1.5 0 0 1 1.06.44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-7.2 7.2a1.5 1.5 0 0 1-2.12 0l-7.3-7.3a1.5 1.5 0 0 1-.44-1.06z"/><circle cx="8.3" cy="8.3" r="1.3"/>`,
}

const ETOILE = 'M12 2.8l2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 16.83l-5.5 2.9 1.05-6.12L3.1 9.27l6.15-.9z'

/** Icône d'en-tête de carte : tuile de 44 px, glyphe de 24 px centré. */
function tuile(traces, couleur) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <rect width="44" height="44" rx="12" fill="${TUILE[couleur]}"/>
  <g transform="translate(10 10)" fill="none" stroke="${couleur}" color="${couleur}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${traces}</g>
</svg>
`
}

const ICONES = {
  sablier: tuile(TRACES.sablier, AMBRE),
  calendrier: tuile(TRACES.calendrier, ENCRE),
  cadenas: tuile(TRACES.cadenas, ENCRE),
  bulle: tuile(TRACES.bulle, ENCRE),
  telephone: tuile(TRACES.telephone, ENCRE),
  ordinateur: tuile(TRACES.ordinateur, ENCRE),
  alerte: tuile(TRACES.alerte, ROUGE),
  enveloppe: tuile(TRACES.enveloppe, ENCRE),
  etiquette: tuile(TRACES.etiquette, ENCRE),
  // Les cinq étoiles de la demande d'avis : 5 × 24 px, 6 px d'écart.
  etoiles: `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="24" viewBox="0 0 144 24">
  ${[0, 1, 2, 3, 4].map(i => `<path transform="translate(${i * 30} 0)" d="${ETOILE}" fill="${OR}" stroke="${OR_TRAIT}" stroke-width="1" stroke-linejoin="round"/>`).join('\n  ')}
</svg>
`,
  // L'étoile du créneau optimisé, à la taille du texte.
  etoile: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
  <path d="${ETOILE}" fill="${ENCRE}" stroke="${ENCRE}" stroke-width="1.2" stroke-linejoin="round"/>
</svg>
`,
}

fs.mkdirSync(DOSSIER, { recursive: true })
// Retire les icônes qui ne sont plus dessinées (évite des fichiers orphelins dans public/).
for (const f of fs.readdirSync(DOSSIER)) {
  if (!(f.replace(/\.(svg|png)$/, '') in ICONES)) fs.unlinkSync(path.join(DOSSIER, f))
}
for (const [nom, svg] of Object.entries(ICONES)) {
  fs.writeFileSync(path.join(DOSSIER, `${nom}.svg`), svg)
  // density 144 = 2 × 72 : le PNG fait le double de la taille déclarée dans le SVG.
  await sharp(Buffer.from(svg), { density: 144 }).png({ compressionLevel: 9 }).toFile(path.join(DOSSIER, `${nom}.png`))
}
console.log(`${Object.keys(ICONES).length} icônes écrites dans public/email/`)

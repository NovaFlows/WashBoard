// Gabarit commun des emails, dans la DA 2026 : fond papier, carte blanche, encre, Archivo.
// Modèle de départ : `sendTamponFidelite`, validé par Ryan.
//
// Contraintes propres à l'email, à ne pas « moderniser » : tables et styles en ligne, ni
// flex, ni grid, ni variables CSS (Gmail et Outlook les ignorent), et des PNG plutôt que du
// SVG en ligne (retiré par Gmail et Outlook, voir scripts/email-icones.mjs).
//
// Toutes les chaînes reçues ici sont du HTML inséré tel quel : une valeur saisie par un
// client ou un laveur doit passer par `escapeHtml` AVANT d'arriver dans ces fonctions.

export const COULEUR = {
  papier: '#F6F5F3',
  carte: '#FFFFFF',
  encre: '#16161A',
  gris: '#6B6B76',
  grisPetit: '#6E6E78',
  // rgba(22,22,26,.10) posé sur le blanc : Outlook ignore les couleurs rgba des bordures.
  filet: '#E8E8E9',
  accent: '#306090',
  ambre: '#9A5B00',
  rouge: '#B3261E',
} as const

export const POLICE = `'Archivo',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif`

// Répétée sur chaque bloc de texte : Outlook n'hérite pas la police dans les tables imbriquées.
const F = `font-family:${POLICE};`

const FONDS = {
  ambre: { trait: COULEUR.ambre, fond: '#FAF5EE' },
  rouge: { trait: COULEUR.rouge, fond: '#FBF2F1' },
  info: { trait: COULEUR.accent, fond: '#F2F5F9' },
} as const

/** Page complète : papier, en-tête, carte de 600 px au plus, pied. */
export function page({ titre, entete, contenu, pied = '' }: {
  /** Texte brut de la balise <title> (onglet des webmails). */
  titre: string
  entete: string
  contenu: string
  pied?: string
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${titre}</title>
<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..800&display=swap" rel="stylesheet"><!--<![endif]-->
<style>
:root{color-scheme:light only;supported-color-schemes:light}
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
a{color:${COULEUR.accent}}
@media (max-width:480px){
.wb-marge{padding:20px 12px 28px!important}
.wb-carte{padding:28px 20px!important}
.wb-titre{font-size:24px!important}
.wb-col{display:block!important;width:100%!important;padding:0 0 16px!important;border:0!important}
}
</style>
<!--[if mso]><style>body,table,td,p,a,h1,div,span,li{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${COULEUR.papier};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${COULEUR.papier};">
<tr><td align="center" class="wb-marge" style="padding:32px 16px 40px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:600px;${F}color:${COULEUR.encre};">
<tr><td style="padding:0 4px 16px;text-align:left;">${entete}</td></tr>
<tr><td class="wb-carte" style="background:${COULEUR.carte};border:1px solid ${COULEUR.filet};border-radius:16px;padding:36px 40px;text-align:left;${F}color:${COULEUR.encre};">
${contenu}
</td></tr>
${pied ? `<tr><td style="padding:20px 4px 0;${F}font-size:12px;line-height:1.6;color:${COULEUR.grisPetit};text-align:left;">${pied}</td></tr>` : ''}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`
}

/** En-tête des emails envoyés au laveur, au nom de WashBoard : logo et nom, en petit. */
export function enteteWashBoard(base: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>
<td style="vertical-align:middle;padding-right:10px;"><img src="${base}/logo-washboard-128.png" width="28" height="28" alt="" style="display:block;border:0;border-radius:7px;"></td>
<td style="vertical-align:middle;${F}font-size:16px;font-weight:700;letter-spacing:-0.01em;color:${COULEUR.encre};">WashBoard</td>
</tr></table>`
}

/** En-tête des emails envoyés aux clients d'un laveur : c'est lui l'expéditeur visible,
 *  WashBoard n'apparaît qu'en pied. */
export function enteteLaveur(nom: string, ligne?: string): string {
  return `<div style="${F}font-size:17px;font-weight:700;line-height:1.25;letter-spacing:-0.01em;font-stretch:108%;color:${COULEUR.encre};">${nom}</div>${ligne ? `
<div style="margin-top:4px;${F}font-size:13px;line-height:1.5;color:${COULEUR.gris};">${ligne}</div>` : ''}`
}

/** Icône d'en-tête de carte (44 px, pastille comprise). */
export function iconeTitre(base: string, nom: string, alt = ''): string {
  return `<img src="${base}/email/${nom}.png" width="44" height="44" alt="${alt}" style="display:block;border:0;margin:0 0 18px;">`
}

/** Titre de carte : surtitre discret, grand titre, phrase d'accompagnement. */
export function titre({ texte, surtitre, sousTitre, icone = '' }: {
  texte: string
  surtitre?: string
  sousTitre?: string
  icone?: string
}): string {
  return `${icone}${surtitre ? etiquette(surtitre, '0 0 8px') : ''}
<h1 class="wb-titre" style="margin:0 0 ${sousTitre ? '8px' : '20px'};${F}font-size:27px;line-height:1.12;font-weight:700;letter-spacing:-0.025em;font-stretch:108%;color:${COULEUR.encre};">${texte}</h1>${sousTitre ? `
<p style="margin:0 0 24px;${F}font-size:15px;line-height:1.5;color:${COULEUR.gris};">${sousTitre}</p>` : ''}`
}

const TONS = {
  encre: `${F}font-size:15px;line-height:1.6;color:${COULEUR.encre};`,
  gris: `${F}font-size:14px;line-height:1.6;color:${COULEUR.gris};`,
  petit: `${F}font-size:12.5px;line-height:1.6;color:${COULEUR.grisPetit};`,
} as const

export function paragraphe(html: string, { ton = 'encre', marge = '0 0 16px', style = '' }: {
  ton?: keyof typeof TONS
  marge?: string
  style?: string
} = {}): string {
  return `<p style="margin:${marge};${TONS[ton]}${style}">${html}</p>`
}

/** Bouton : sombre dans les emails au nom du laveur (comme le tampon), accent dans ceux
 *  au nom de WashBoard — le bleu est la couleur de WashBoard, pas celle du laveur. */
export function bouton(libelle: string, href: string, variante: 'sombre' | 'accent', marge = '8px 0 0'): string {
  const fond = variante === 'sombre' ? COULEUR.encre : COULEUR.accent
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:${marge};"><tr>
<td style="border-radius:13px;background:${fond};"><a href="${href}" target="_blank" style="display:inline-block;padding:15px 26px;${F}font-size:15px;font-weight:700;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:13px;">${libelle}</a></td>
</tr></table>`
}

/** Bouton secondaire en ligne (plusieurs côte à côte, ex. les liens de paiement). */
export function boutonEnLigne(libelle: string, href: string): string {
  return `<a href="${href}" target="_blank" style="display:inline-block;margin:10px 8px 0 0;background:${COULEUR.encre};color:#FFFFFF;text-decoration:none;${F}font-size:14px;font-weight:700;line-height:1.2;padding:12px 20px;border-radius:12px;">${libelle}</a>`
}

export type LigneDetail = { libelle: string; valeur: string; gauche?: boolean; fort?: boolean }

/** Liste libellé / valeur séparée par des filets. */
export function details(lignes: LigneDetail[], marge = '4px 0 24px'): string {
  const rangs = lignes.map((l, i) => {
    const filet = `border-top:1px solid ${COULEUR.filet};${i === lignes.length - 1 ? `border-bottom:1px solid ${COULEUR.filet};` : ''}`
    return `<tr>
<td style="${filet}padding:12px 14px 12px 0;vertical-align:top;${F}font-size:14px;line-height:1.5;color:${COULEUR.gris};white-space:nowrap;">${l.libelle}</td>
<td style="${filet}padding:12px 0;vertical-align:top;${F}font-size:14px;line-height:1.5;font-weight:${l.fort ? 700 : 600};color:${COULEUR.encre};text-align:${l.gauche ? 'left' : 'right'};word-break:break-word;">${l.valeur}</td>
</tr>`
  }).join('\n')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:${marge};">
${rangs}
</table>`
}

/** Encadré discret : liseré coloré et fond très léger, jamais un bandeau plein. */
export function encadre(html: string, ton: keyof typeof FONDS, marge = '0 0 24px'): string {
  const c = FONDS[ton]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:${marge};"><tr>
<td style="background:${c.fond};border-left:3px solid ${c.trait};border-radius:0 10px 10px 0;padding:14px 18px;${F}font-size:14px;line-height:1.55;font-weight:500;color:${COULEUR.encre};">${html}</td>
</tr></table>`
}

/** Bloc neutre sur fond papier (récapitulatifs secondaires : acompte, fidélité, notes). */
export function bloc(html: string, marge = '0 0 20px'): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:${marge};"><tr>
<td style="background:${COULEUR.papier};border-radius:12px;padding:16px 18px;${F}font-size:14px;line-height:1.55;color:${COULEUR.encre};">${html}</td>
</tr></table>`
}

/** Petit libellé en capitales (surtitre, en-tête de colonne). */
export function etiquette(texte: string, marge = '0 0 6px'): string {
  return `<p style="margin:${marge};${F}font-size:11px;font-weight:700;line-height:1.4;letter-spacing:.14em;text-transform:uppercase;color:${COULEUR.grisPetit};">${texte}</p>`
}

#!/usr/bin/env node
/**
 * Habille une page « proposition » aux couleurs d'un prospect.
 *
 *   node habiller-page.mjs <slug> --logo logo.png [--fond visuel.jpg] [--couleur #RRGGBB]
 *
 * « --fond auto » fabrique un fond aux couleurs du logo, pour les prospects qui
 * n'ont aucun visuel utilisable.
 *
 * Ce qui est automatise, parce que c'est mecanique :
 *   - compression et televersement du logo (600 px) et du fond (1920 px) ;
 *   - detection de la couleur de marque a partir du logo ;
 *   - ASSOMBRISSEMENT de cette couleur jusqu'a ce que du texte blanc dessus
 *     soit lisible.
 *
 * Ce qui reste a la main : choisir le cadrage du logo et l'image de fond. Une
 * detection automatique se trompe une fois sur trois, et une page mal cadree
 * envoyee a un prospect fait plus de mal que pas de page du tout.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

// ── Lisibilite ──────────────────────────────────────────────────────────────
// L'interface ecrit en BLANC sur la couleur d'accent. Une couleur de marque
// vive — le citron d'un flyer, un jaune, un cyan — donne un contraste de 2
// alors qu'il en faut 4.5 : les boutons deviennent illisibles en plein soleil,
// c'est-a-dire exactement la ou un laveur consulte son telephone.
// On garde donc la TEINTE du prospect et on baisse la luminosite jusqu'au
// seuil. Sa couleur vive, elle, continue de vivre dans le logo.
const CONTRASTE_MIN = 4.5

const canal = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const luminance = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
const contrasteBlanc = c => 1.05 / (luminance(c) + 0.05)
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')

function versLisible(rgb) {
  let c = rgb
  for (let k = 100; k >= 20; k -= 5) {
    c = rgb.map(v => Math.round(v * k / 100))
    if (contrasteBlanc(c) >= CONTRASTE_MIN) return { couleur: c, assombri: 100 - k }
  }
  return { couleur: c, assombri: 80 }
}

const teinte = ([r, g, b]) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (!d) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

/** Couleurs vives du logo, les plus frequentes d'abord, en ignorant les gris et
 *  les extremes. Un logo est fait de noir, de blanc et d'une ou deux couleurs :
 *  ce sont celles-la qu'on cherche, pas la plus frequente (qui serait le fond).
 *  Les teintes trop proches sont fusionnees : deux bleus voisins sont un bleu. */
async function paletteLogo(fichier) {
  const { data, info } = await sharp(fichier).resize(120, 120, { fit: 'inside' })
    .raw().toBuffer({ resolveWithObject: true })
  const seaux = new Map()
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    if (saturation < 0.35 || max < 60 || max > 245) continue   // gris, trop sombre, trop clair
    const cle = [r, g, b].map(v => Math.round(v / 24) * 24).join(',')
    seaux.set(cle, (seaux.get(cle) ?? 0) + 1)
  }
  const classees = [...seaux.entries()].sort((a, b) => b[1] - a[1])
    .map(([cle, n]) => [cle.split(',').map(Number), n])
  const gardees = []
  for (const [c, n] of classees) {
    if (gardees.every(([g]) => Math.min(Math.abs(teinte(g) - teinte(c)), 360 - Math.abs(teinte(g) - teinte(c))) > 40)) {
      gardees.push([c, n])
    }
    if (gardees.length === 3) break
  }
  // Une teinte marginale n'est pas une couleur de marque : c'est un reflet, une
  // etincelle, un lisere. L'orange de YH pese 56 % de son bleu — les deux
  // comptent. Le jaune des etincelles de ScutNet pese 1 % : le retenir peignait
  // son fond en olive alors que son logo est rouge et argent.
  const seuil = (gardees[0]?.[1] ?? 0) * 0.25
  return gardees.filter(([, n], i) => i === 0 || n >= seuil).map(([c]) => c)
}

const couleurDominante = async f => (await paletteLogo(f))[0] ?? null

// ── Fond genere ─────────────────────────────────────────────────────────────
// Quand un prospect n'a aucun visuel exploitable, on lui fabrique un fond a
// partir des couleurs de SON logo, plutot que de lui coller un theme generique
// partage avec tout le monde. Le motif — des barres verticales en miroir, comme
// un egaliseur — est sombre et calme : ce qui compte reste la carte par-dessus.
// Le tirage est deterministe : relancer l'outil ne change pas la page.

/** Efface le fond d'un logo pour pouvoir l'incruster dans une image.
 *
 *  On ne peut pas simplement rendre transparents « tous les pixels blancs » :
 *  le lettrage de ScutNet est cerne de blanc, ca le trouerait. On part donc des
 *  BORDS et on ne propage que de proche en proche — le blanc interieur, qui ne
 *  touche pas le bord, est preserve.
 *
 *  Rend null si les quatre coins ne se ressemblent pas : le logo est alors sur
 *  une photo ou un degrade, et un detourage aveugle l'abimerait. */
async function detourer(fichier) {
  const { data, info } = await sharp(fichier).ensureAlpha()
    .resize(700, 700, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = info
  const px = i => [data[i * C], data[i * C + 1], data[i * C + 2]]
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])

  const coins = [0, W - 1, (H - 1) * W, H * W - 1].map(px)
  if (coins.some(c => dist(c, coins[0]) > 90)) return null

  const TOL = 110                       // somme des ecarts R+G+B
  const vu = new Uint8Array(W * H)
  const file = []
  for (let x = 0; x < W; x++) { file.push(x, (H - 1) * W + x) }
  for (let y = 0; y < H; y++) { file.push(y * W, y * W + W - 1) }
  for (const i of file) if (!vu[i] && dist(px(i), coins[0]) <= TOL) vu[i] = 1
  let tete = 0
  const pile = file.filter(i => vu[i])
  while (tete < pile.length) {
    const i = pile[tete++], x = i % W, y = (i - x) / W
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (j >= 0 && !vu[j] && dist(px(j), coins[0]) <= TOL) { vu[j] = 1; pile.push(j) }
    }
  }
  for (let i = 0; i < W * H; i++) if (vu[i]) data[i * C + 3] = 0

  return sharp(data, { raw: { width: W, height: H, channels: C } }).png().toBuffer()
}

/** Bruit reproductible dans [0,1] : meme graine, meme fond. */
function alea(graine) {
  let x = graine * 2654435761 % 2147483647
  return () => { x = (x * 48271) % 2147483647; return x / 2147483647 }
}

function fondSVG([r1, g1, b1], deuxieme, graine, logoPNG) {
  const [r2, g2, b2] = deuxieme ?? [r1, g1, b1]
  const W = 1920, H = 1080, axe = H / 2
  // Le logo, en grand et efface, sous le motif.
  //
  // Il est volontairement DECENTRE et deborde du cadre. Centre, il se retrouve
  // pile derriere la carte, qui en masque le milieu : d'un logo portant un mot
  // — « YHMOTORS », « ACHAT · VENTE · LOCATION » — il ne restait que les deux
  // bouts, et on lisait « Y…S » et « AC…ON ». Un fragment de graphisme sur le
  // cote se lit comme un filigrane ; un mot coupe en deux se lit comme un
  // defaut.
  const emblemeH = H * 0.88
  const embleme = logoPNG
    ? `<image href="data:image/png;base64,${logoPNG.toString('base64')}"
              x="${(W * 0.80 - emblemeH / 2).toFixed(0)}" y="${((H - emblemeH) / 2).toFixed(0)}"
              width="${emblemeH.toFixed(0)}" height="${emblemeH.toFixed(0)}"
              preserveAspectRatio="xMidYMid meet" opacity="0.30"/>`
    : ''
  const tirage = alea(graine)
  // Une ligne brisee lissee plutot que du bruit pur : ca evoque un egaliseur,
  // pas de la neige.
  const pas = 26, n = Math.ceil(W / pas)
  const brut = Array.from({ length: n + 2 }, () => tirage())
  const lisse = brut.map((v, i) => (brut[i - 1] ?? v) * 0.25 + v * 0.5 + (brut[i + 1] ?? v) * 0.25)
  const barres = lisse.map((v, i) => {
    const x = i * pas
    // Le motif court sur toute la largeur, sans creux au centre : sur un
    // telephone l'image est recadree en colonne CENTRALE, et un centre vide
    // donnerait un fond noir a tous les visiteurs mobiles.
    const h = 70 + v * 360
    const accent = i % 9 === 4
    const c = accent ? `rgb(${r1},${g1},${b1})` : `rgb(${r2},${g2},${b2})`
    return `<rect x="${x}" y="${(axe - h).toFixed(0)}" width="14" height="${(h * 2).toFixed(0)}" rx="7" `
         + `fill="${c}" opacity="${(0.22 + v * 0.24).toFixed(3)}"/>`
  }).join('')

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="g1" cx="30%" cy="32%" r="72%">
      <stop offset="0%" stop-color="rgb(${r2},${g2},${b2})" stop-opacity="0.70"/>
      <stop offset="100%" stop-color="rgb(${r2},${g2},${b2})" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="72%" cy="76%" r="66%">
      <stop offset="0%" stop-color="rgb(${r1},${g1},${b1})" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="rgb(${r1},${g1},${b1})" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="78%">
      <stop offset="68%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.45"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#07080b"/>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>
  ${embleme}
  ${barres}
  <circle cx="${W / 2}" cy="${axe}" r="${H * 0.42}" fill="none"
          stroke="rgb(${r1},${g1},${b1})" stroke-opacity="0.18" stroke-width="3"/>
  <circle cx="${W / 2}" cy="${axe}" r="${H * 0.47}" fill="none"
          stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`)
}

// ── Environnement ───────────────────────────────────────────────────────────
function base() {
  const chemin = path.resolve('..', '.env.local')
  if (!fs.existsSync(chemin)) {
    console.error('Lance ce script depuis washboard/prospects/.'); process.exit(1)
  }
  for (const l of fs.readFileSync(chemin, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } })
}

async function televerser(db, seau, nom, buffer) {
  const { error } = await db.storage.from(seau)
    .upload(nom, buffer, { contentType: 'image/webp', upsert: true })
  if (error) { console.error(`${seau} :`, error.message); process.exit(1) }
  const { data: { publicUrl } } = db.storage.from(seau).getPublicUrl(nom)
  return publicUrl + '?v=' + Date.now()
}

// ── Main ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const slug = args[0]
const opt = n => { const i = args.indexOf('--' + n); return i > -1 ? args[i + 1] : null }

if (!slug || slug.startsWith('--')) {
  console.error('Usage : node habiller-page.mjs <slug> --logo <fichier> [--fond <fichier>] [--couleur #RRGGBB]')
  process.exit(1)
}

const db = base()
const { data: w, error } = await db.from('washers')
  .select('id, name, is_preview').eq('slug', slug).maybeSingle()
if (error || !w) { console.error(`Aucune page « ${slug} ».`); process.exit(1) }
// Garde-fou : on n'habille jamais un vrai compte, il choisit lui-meme.
if (!w.is_preview) { console.error(`« ${w.name} » est un VRAI compte : on n'y touche pas.`); process.exit(1) }

const maj = {}
console.log(`\n${w.name}\n`)

const logo = opt('logo')
if (logo) {
  if (!fs.existsSync(logo)) { console.error('logo introuvable :', logo); process.exit(1) }
  const buf = await sharp(logo).resize(600, 600, { fit: 'inside' }).webp({ quality: 90 }).toBuffer()
  maj.logo_url = await televerser(db, 'logos', `${w.id}.webp`, buf)
  console.log(`  logo   ${(buf.length / 1024).toFixed(0)} Ko`)
}

const fond = opt('fond')
if (fond === 'auto') {
  if (!logo) { console.error('« --fond auto » a besoin de --logo : c\'est de lui que viennent les couleurs.'); process.exit(1) }
  const palette = await paletteLogo(logo)
  if (!palette.length) { console.error('aucune couleur vive dans ce logo : donne un fichier de fond.'); process.exit(1) }
  const forceeIci = opt('couleur')
  // La couleur imposee prime : c'est celle du prospect, pas celle qu'on devine.
  // Mais elle ne doit pas ECRASER la seconde teinte : forcer l'orange d'un logo
  // orange et bleu donnait un fond entierement brun, le bleu disparaissait.
  if (forceeIci && /^#?[0-9a-f]{6}$/i.test(forceeIci)) {
    const imposee = [0, 2, 4].map(i => parseInt(forceeIci.replace('#', '').slice(i, i + 2), 16))
    const ecart = c => { const d = Math.abs(teinte(c) - teinte(imposee)); return Math.min(d, 360 - d) }
    const contraste = palette.filter(c => ecart(c) > 40).sort((a, b) => ecart(b) - ecart(a))[0]
    palette.length = 0
    palette.push(imposee, ...(contraste ? [contraste] : []))
  }
  // Graine tiree du slug : la meme page redonne toujours le meme fond.
  const graine = [...slug].reduce((a, c) => a + c.charCodeAt(0), 7)
  const embleme = await detourer(logo)
  const buf = await sharp(fondSVG(palette[0], palette[1], graine, embleme))
    .webp({ quality: 82 }).toBuffer()
  maj.background_theme = await televerser(db, 'backgrounds', `${w.id}.webp`, buf)
  console.log(`  fond   ${(buf.length / 1024).toFixed(0)} Ko  (généré depuis ${palette.map(hex).join(' + ')}`
    + `${embleme ? ', logo incrusté' : ', logo non détourable — motif seul'})`)
} else if (fond) {
  if (!fs.existsSync(fond)) { console.error('fond introuvable :', fond); process.exit(1) }
  // 1920 px suffit pour un fond plein ecran, et le poids compte : ce fichier
  // part chez CHAQUE visiteur de la page.
  const buf = await sharp(fond).resize(1920, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 }).toBuffer()
  maj.background_theme = await televerser(db, 'backgrounds', `${w.id}.webp`, buf)
  console.log(`  fond   ${(buf.length / 1024).toFixed(0)} Ko`)
}

let brute = null
const forcee = opt('couleur')
if (forcee) {
  const m = /^#?([0-9a-f]{6})$/i.exec(forcee)
  if (!m) { console.error('couleur attendue au format #RRGGBB'); process.exit(1) }
  brute = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16))
} else if (logo) {
  brute = await couleurDominante(logo)
}

if (brute) {
  const avant = contrasteBlanc(brute)
  const { couleur, assombri } = versLisible(brute)
  maj.brand_color = hex(couleur)
  console.log(`  marque ${hex(brute)}  contraste ${avant.toFixed(2)}`
    + (avant >= CONTRASTE_MIN ? '  (gardee telle quelle)' : ''))
  if (avant < CONTRASTE_MIN) {
    console.log(`  accent ${maj.brand_color}  contraste ${contrasteBlanc(couleur).toFixed(2)}`
      + `  (assombrie de ${assombri} % pour rester lisible en blanc)`)
  }
}

if (!Object.keys(maj).length) { console.error('Rien a faire : donne au moins --logo, --fond ou --couleur.'); process.exit(1) }

const { error: eMaj } = await db.from('washers').update(maj).eq('id', w.id)
if (eMaj) { console.error('mise a jour :', eMaj.message); process.exit(1) }

console.log(`\n  https://www.washboard.fr/book/${slug}\n`)

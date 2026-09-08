#!/usr/bin/env node
/**
 * Habille une page « proposition » aux couleurs d'un prospect.
 *
 *   node habiller-page.mjs <slug> --logo logo.png [--fond visuel.jpg] [--couleur #RRGGBB]
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

/** Couleur dominante du logo, en ignorant les gris et les extremes.
 *  Un logo est fait de noir, de blanc et d'UNE couleur : c'est celle-la qu'on
 *  cherche, pas la plus frequente (qui serait le fond). */
async function couleurDominante(fichier) {
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
  if (!seaux.size) return null
  const [cle] = [...seaux.entries()].sort((a, b) => b[1] - a[1])[0]
  return cle.split(',').map(Number)
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
if (fond) {
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

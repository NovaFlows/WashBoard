// Exporte au format des silhouettes photo (face + contour, viewBox -20 -10 1040 420) les
// véhicules dessinés à la main, faute de photo : camping-car, camion, moto, scooter, vélo.
import { writeFileSync } from 'node:fs'
import { SILHOUETTES } from './silhouettes-dessinees.mjs'
// node export-dessinees.mjs   →   public/silhouettes/<type>.svg et <type>-contour.svg
const sortie = new URL('../../public/silhouettes/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const O = 12

function jante(r) {
  const { cx, cy } = r, R = r.r
  const q = (a, rr) => `${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`
  if (r.jante === 'velo') {
    let v = `<circle cx="${cx}" cy="${cy}" r="${R - 6}" fill="none" stroke="#7C7C83" stroke-width="12"/><circle cx="${cx}" cy="${cy}" r="${R - 14}" fill="none" stroke="#C9C9CE" stroke-width="3"/>`
    for (let k = 0; k < 18; k++) v += `<path d="M ${cx} ${cy} L ${q((k / 18) * Math.PI * 2, R - 15)}" stroke="#B9B9BF" stroke-width="1.6"/>`
    return v + `<circle cx="${cx}" cy="${cy}" r="9" fill="#A5A5AC"/>`
  }
  if (r.jante === 'moto' || r.jante === 'scooter') {
    const rj = R * (r.jante === 'moto' ? 0.72 : 0.62)
    let v = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#76767D"/><circle cx="${cx}" cy="${cy}" r="${rj}" fill="#8E8E95"/>`
    if (r.jante === 'moto') v += `<circle cx="${cx}" cy="${cy}" r="${rj * 0.7}" fill="none" stroke="#C3C3C8" stroke-width="7"/>`
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2
      v += r.jante === 'moto'
        ? `<path d="M ${q(a - 0.1, rj * 0.24)} L ${q(a - 0.05, rj - 3)} L ${q(a + 0.05, rj - 3)} L ${q(a + 0.1, rj * 0.24)} Z" fill="#D0D0D5"/>`
        : `<circle cx="${(cx + Math.cos(a) * rj * 0.55).toFixed(1)}" cy="${(cy + Math.sin(a) * rj * 0.55).toFixed(1)}" r="${(rj * 0.18).toFixed(1)}" fill="#76767D"/>`
    }
    return v + `<circle cx="${cx}" cy="${cy}" r="${rj * 0.22}" fill="#C4C4C9"/><circle cx="${cx}" cy="${cy}" r="${rj}" fill="none" stroke="#D6D6DA" stroke-width="2.5"/>`
  }
  const rj = R * 0.66
  let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#7C7C83"/><circle cx="${cx}" cy="${cy}" r="${R - 5}" fill="none" stroke="#88888F" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="${rj}" fill="#8E8E95"/>`
  for (let k = 0; k < 10; k++) {
    const a = (Math.floor(k / 2) / 5) * Math.PI * 2 + (k % 2 ? 0.13 : -0.13) - Math.PI / 2
    s += `<path d="M ${q(a - 0.07, rj * 0.24)} L ${q(a - 0.09, rj - 3)} L ${q(a + 0.09, rj - 3)} L ${q(a + 0.07, rj * 0.24)} Z" fill="#D2D2D7"/>`
  }
  return s + `<circle cx="${cx}" cy="${cy}" r="${rj * 0.26}" fill="#C4C4C9"/><circle cx="${cx}" cy="${cy}" r="${rj}" fill="none" stroke="#DADADE" stroke-width="2.5"/>`
}

const vue = 'viewBox="-20 -10 1040 420" xmlns="http://www.w3.org/2000/svg"'
for (const nom of ['camping-car', 'camion', 'moto', 'scooter', 'velo']) {
  const s = SILHOUETTES[nom]
  const contour = [...s.corps, ...(s.sombres ?? []), ...s.passages].map(d => `<path d="${d}" fill="#fff" stroke="#fff" stroke-width="${O}" stroke-linejoin="round"/>`).join('')
    + (s.traits ?? []).map(t => `<path d="${t.d}" fill="none" stroke="#fff" stroke-width="${t.w + O}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')
    + s.roues.map(r => `<circle cx="${r.cx}" cy="${r.cy}" r="${r.r + O / 2}" fill="#fff"/>`).join('')
  const plein = [
    '<defs><linearGradient id="caisse" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C4C4C9"/><stop offset=".55" stop-color="#B8B8BE"/><stop offset="1" stop-color="#A9A9AF"/></linearGradient><linearGradient id="verre" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#E4E4E8"/><stop offset="1" stop-color="#C6C6CC"/></linearGradient></defs>',
    ...s.passages.map(d => `<path d="${d}" fill="#6F6F76"/>`),
    ...s.corps.map(d => `<path d="${d}" fill="url(#caisse)"/>`),
    ...(s.traits ?? []).map(t => `<path d="${t.d}" fill="none" stroke="#ABABB1" stroke-width="${t.w}" stroke-linecap="round" stroke-linejoin="round"/>`),
    ...(s.sombres ?? []).map(d => `<path d="${d}" fill="#9A9AA1"/>`),
    ...(s.vitres ?? []).map(d => `<path d="${d}" fill="url(#verre)"/>`),
    ...(s.montants ?? []).map(d => `<path d="${d}" fill="#8D8D94"/>`),
    ...(s.feux ?? []).map(l => `<path d="${l.d}" fill="${l.ton === 'clair' ? '#E4E4E8' : '#97979E'}"/>`),
    ...(s.details ?? []).map(d => `<path d="${d}" fill="none" stroke="#D3D3D8" stroke-width="3" stroke-linecap="round"/>`),
    ...(s.lignes ?? []).map(d => `<path d="${d}" fill="none" stroke="#97979E" stroke-width="2.2" stroke-linecap="round"/>`),
    ...(s.poignees ?? []).map(d => `<path d="${d}" fill="#A6A6AD"/>`),
    ...s.roues.map(jante),
  ].join('')
  writeFileSync(`${sortie}${nom}.svg`, `<svg ${vue}>${contour}${plein}</svg>`)
  writeFileSync(`${sortie}${nom}-contour.svg`, `<svg ${vue}>${contour}</svg>`)
  console.log(nom, 'ok')
}

// Reel « Un garage te confie 3 véhicules ? » — rendu entièrement codé, déterministe : rendu(t)
// dessine l'image de l'instant t (s) sur le canvas 1080×1920.
//
// Leçons d'Alexandre appliquées : de vrais iPhone (cadre titane, Dynamic Island, barre d'état,
// indicateur d'accueil) ; Safari et l'écran verrouillé iOS dessinés fidèlement ; tous les écrans
// WashBoard sont les VRAIES captures de la plateforme (captures/capturer-resa.mjs :
// /dev/booking-preview ; captures/capturer-demo.mjs : /demo), données fictives, sans étiquette.
//
// Chaîne : un garage te confie 3 véhicules ? → sur ta page, il ajoute 3 utilitaires dans la même
// réservation, le prix suit (35 → 70 → 105 €) → « Je réserve pour une entreprise », nom + SIRET →
// « Réservation envoyée ! » → chez toi : « 🚗 Nouvelle réservation », la demande « En attente »,
// tu confirmes → lavage terminé : la facture F-00048 du garage dans « Devis et factures », et le
// mail « Facture F-00048 — Brillance Mobile » qui part au garage → envoie ça à un pote laveur →
// essaie gratuitement, lien en bio.
(function () {
  const W = 1080, H = 1920;
  const { K, VO, DUREE } = globalThis.TL;

  const C = {
    papier: '#F2EEE6', encre: '#0B1828', encre2: '#3A4657', gris: '#8C93A0', bleu: '#3080FF',
    orange: '#E8552F', rouge: '#E5484D', vert: '#1DA851', blanc: '#FFFFFF', ombre: 'rgba(11,24,40,',
    iosBleu: '#007AFF',
  };
  const SF = 'Inter, "Noto Color Emoji"';

  // ───────────────────────── easings ─────────────────────────
  function bezier(x1, y1, x2, y2) {
    const f = (t, a, b) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
    return (p) => {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      let lo = 0, hi = 1, t = p;
      for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (f(t, x1, x2) < p) lo = t; else hi = t; }
      return f(t, y1, y2);
    };
  }
  const backOut = (s) => (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2));
  const E = { out: bezier(0.16, 1, 0.3, 1), doux: bezier(0.25, 0.9, 0.35, 1), inOut: bezier(0.7, 0, 0.3, 1), in: bezier(0.6, 0, 0.85, 0.3), snap: backOut(0.62) };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const P = (t, a, b, e = E.out) => e(clamp((t - a) / (b - a)));
  function rng(seed) {
    return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ───────────────────────── primitives ─────────────────────────
  let ctx;
  const IMG = {};
  const HAUT = {}, HAUT_SOMBRE = {};
  let POS = {};
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function police(px, poids = 800, famille = 'Geist') { ctx.font = `${poids} ${px}px ${famille}`; }
  function ombre(a, blur, oy) { ctx.shadowColor = C.ombre + a + ')'; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy; }
  function sansOmbre() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  function texte(s, x, y, { px = 30, poids = 700, famille = 'Geist', couleur = C.encre, align = 'left', alpha = 1 } = {}) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    police(px, poids, famille);
    ctx.fillStyle = couleur;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
    ctx.restore();
  }
  const ios = (s, x, y, px, poids, couleur, align = 'left', alpha = 1) => texte(s, x, y, { px, poids, famille: SF, couleur, align, alpha });
  function couper(s, largeur) {
    if (ctx.measureText(s).width <= largeur) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > largeur) s = s.slice(0, -1);
    return s + '…';
  }

  // ───────────────────────── typographie animée ─────────────────────────
  function titre(t, { a, b, lignes, y, taille, poids = 800, x = W / 2, inter = 0.06, espace = -0.02, maxW = 940 }) {
    if (t < a || t > b + 0.5) return;
    police(taille, poids);
    ctx.letterSpacing = `${espace * taille}px`;
    const plusLarge = Math.max(...lignes.map((l) => l.reduce((s, [m]) => s + ctx.measureText(m).width, 0)));
    if (plusLarge > maxW) taille = Math.floor(taille * maxW / plusLarge);
    const lh = taille * 1.08;
    lignes.forEach((ligne, k) => {
      const pin_ = P(t, a + k * inter, a + k * inter + 0.55, E.out);
      const pout = P(t, b + k * 0.04, b + k * 0.04 + 0.24, E.in);
      if (pin_ <= 0 || pout >= 1) return;
      const yl = y + k * lh;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, yl - taille * 0.95, W, taille * 1.22); ctx.clip();
      const dy = (1 - pin_) * taille * 1.05 - pout * taille * 1.1;
      police(taille, poids);
      ctx.letterSpacing = `${espace * taille}px`;
      const largeurs = ligne.map(([s]) => ctx.measureText(s).width);
      let cx = x - largeurs.reduce((u, v) => u + v, 0) / 2;
      ligne.forEach(([s, col], i) => { ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(s, cx, yl + dy); cx += largeurs[i]; });
      ctx.restore();
    });
    ctx.letterSpacing = '0px';
  }
  function pastille(s, x, y, { fond, encre, alpha = 1, taille = 30, e = 1 }) {
    if (alpha <= 0 || e <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(e, e);
    police(taille, 700);
    ctx.letterSpacing = `${taille * 0.12}px`;
    const w = ctx.measureText(s).width + taille * 1.3, h = taille * 1.9;
    ombre(0.18, 24, 8); ctx.fillStyle = fond; rr(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); sansOmbre();
    ctx.fillStyle = encre; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, taille * 0.06, 2);
    ctx.restore();
    ctx.letterSpacing = '0px';
  }
  function sticker(nom, x, yBas, h, { alpha = 1, e = 1 } = {}) {
    const im = IMG[nom];
    if (!im || alpha <= 0 || e <= 0) return;
    const w = (h * im.width) / im.height;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, yBas);
    ctx.scale(e, e);
    ombre(0.2, 40, 16);
    ctx.drawImage(im, -w / 2, -h, w, h);
    ctx.restore();
  }
  // un sticker qui entre en rebond entre a et b, sous la bande des sous-titres
  const stickerScene = (t, nom, x, a, b, h = 500) => sticker(nom, x, 2050, h, { e: E.snap(P(t, a, a + 0.35)), alpha: 1 - P(t, b - 0.15, b + 0.15) });
  function logo(cx, cy, taille, alpha) {
    if (!IMG.logo || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; ombre(0.28, 50, 20);
    ctx.drawImage(IMG.logo, cx - taille / 2, cy - taille / 2, taille, taille);
    ctx.restore();
  }

  // ═════════════════════════ L'IPHONE ═════════════════════════
  const PT_W = 393, PT_H = 846;
  function geometrie(w) {
    const h = w * 2.061, f = w * 0.013, b = w * 0.027;
    const sx = -w / 2 + f + b, sy = -h / 2 + f + b, sw = w - 2 * (f + b);
    return { h, f, b, sx, sy, sw, k: sw / PT_W };
  }
  function iphone(w, ecran, { sombre = false } = {}) {
    const { h, f, b, sx, sy, sw, k } = geometrie(w);
    const R = w * 0.175, sh = h - 2 * (f + b);
    const bouton = (x, y, hh) => { ctx.fillStyle = '#2C2C2F'; rr(x, y, f * 1.7, hh, f); ctx.fill(); };
    bouton(-w / 2 - f * 1.1, -h * 0.31, h * 0.045);
    bouton(-w / 2 - f * 1.1, -h * 0.235, h * 0.075);
    bouton(-w / 2 - f * 1.1, -h * 0.145, h * 0.075);
    bouton(w / 2 - f * 0.6, -h * 0.205, h * 0.11);
    ombre(0.4, 70, 34);
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, '#47464B'); g.addColorStop(0.06, '#1E1E21'); g.addColorStop(0.94, '#1E1E21'); g.addColorStop(1, '#4A494E');
    ctx.fillStyle = g;
    rr(-w / 2, -h / 2, w, h, R);
    ctx.fill();
    sansOmbre();
    ctx.fillStyle = '#050505';
    rr(-w / 2 + f, -h / 2 + f, w - 2 * f, h - 2 * f, R - f);
    ctx.fill();
    ctx.save();
    rr(sx, sy, sw, sh, R - f - b);
    ctx.clip();
    ctx.translate(sx, sy);
    ctx.scale(k, k);
    ecran();
    ctx.fillStyle = '#000';
    rr(PT_W / 2 - 62, 11, 124, 36, 18);
    ctx.fill();
    ctx.fillStyle = sombre ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
    rr(PT_W / 2 - 67, PT_H - 13, 134, 5, 2.5);
    ctx.fill();
    ctx.restore();
  }
  function barreEtat(clair) {
    const c = clair ? '#FFFFFF' : '#000000';
    ios('9:41', 52, 36, 17, 600, c, 'center');
    ctx.fillStyle = c;
    for (let i = 0; i < 4; i++) rr(292 + i * 5.2, 33 - (4 + i * 2.4), 3.4, 4 + i * 2.4, 1), ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(322, 34, 3 + i * 3.6, -Math.PI * 0.75, -Math.PI * 0.25); ctx.stroke(); }
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(322, 33, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.4; ctx.lineWidth = 1.2; rr(336, 25.5, 25, 12, 3.8); ctx.stroke();
    ctx.fillRect(362.5, 29.5, 1.6, 4); ctx.globalAlpha = 1;
    rr(338, 27.5, 19, 8, 2.2); ctx.fill();
  }
  // geste du doigt (indicateur de toucher), en points
  function toucher(t, t0, x, y) {
    const a = P(t, t0 - 0.22, t0 - 0.05, E.out) * (1 - P(t, t0 + 0.12, t0 + 0.4, E.in));
    if (a <= 0) return;
    const s = t < t0 ? lerp(1.25, 1, P(t, t0 - 0.22, t0 - 0.05)) : lerp(0.85, 1, P(t, t0, t0 + 0.12));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(40,40,45,0.32)';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, 22 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const onde = P(t, t0, t0 + 0.4, E.out);
    if (t >= t0) { ctx.globalAlpha = a * (1 - onde) * 0.6; ctx.beginPath(); ctx.arc(x, y, 22 + 30 * onde, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  // surbrillance bleue autour d'un rectangle [cx, cy, w, h] (points, zone de la capture : +54)
  function cadre(t, a, b, [x, y, w, h], marge = 5) {
    const g = P(t, a, a + 0.3) * (1 - P(t, b - 0.2, b));
    if (g <= 0) return;
    ctx.save();
    ctx.globalAlpha = g;
    ctx.strokeStyle = C.bleu; ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(48,128,255,0.6)'; ctx.shadowBlur = 16;
    rr(x - w / 2 - marge, 54 + y - h / 2 - marge, w + 2 * marge, h + 2 * marge, 14); ctx.stroke();
    ctx.restore();
  }
  const rect = (nom) => { const r = POS[nom]; return r ? [r.x, r.y, r.w, r.h] : null; };
  const tap = (t, t0, nom) => { const r = POS[nom]; if (r) toucher(t, t0, r.x, 54 + r.y); };

  // ───────────────────────── icônes et notification iOS (en points) ─────────────────────────
  function iconeWashBoard(x, y, s) {
    ctx.save(); rr(x, y, s, s, s * 0.225); ctx.clip();
    if (IMG.logo) ctx.drawImage(IMG.logo, x, y, s, s);
    ctx.restore();
  }
  function iconeMail(x, y, s) {
    const g = ctx.createLinearGradient(0, y, 0, y + s);
    g.addColorStop(0, '#1E9BFF'); g.addColorStop(1, '#0A6DF0');
    ctx.fillStyle = g; rr(x, y, s, s, s * 0.225); ctx.fill();
    ctx.fillStyle = '#FFF'; rr(x + s * 0.17, y + s * 0.28, s * 0.66, s * 0.44, s * 0.05); ctx.fill();
    ctx.strokeStyle = '#1784F8'; ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.moveTo(x + s * 0.19, y + s * 0.31); ctx.lineTo(x + s / 2, y + s * 0.53); ctx.lineTo(x + s * 0.81, y + s * 0.31); ctx.stroke();
  }
  // corps : [ligne en gras (facultative, préfixée « ** »), lignes normales…]
  function notification(y, icone, titre_, corps, { alpha = 1, verrouille = false } = {}) {
    if (alpha <= 0) return;
    const h = 62 + corps.length * 20;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.fillStyle = verrouille ? 'rgba(250,250,252,0.86)' : 'rgba(246,246,248,0.97)';
    rr(10, y, 373, h, 24);
    ctx.fill();
    sansOmbre();
    icone(22, y + 14, 38);
    police(15, 600, SF);
    ios(couper(titre_, 212), 72, y + 30, 15, 600, '#000');
    ios('maintenant', 370, y + 30, 13, 400, '#86868B', 'right');
    corps.forEach((l, i) => {
      const gras = l.startsWith('**'), s = gras ? l.slice(2) : l;
      police(15, gras ? 600 : 400, SF);
      ios(couper(s, 290), 72, y + 51 + i * 20, 15, gras ? 600 : 400, '#1C1C1E');
    });
    ctx.restore();
  }

  // ═════════════════════════ TÉLÉPHONE DU GARAGE : SAFARI + VRAIE PAGE ═════════════════════════
  // [capture, instant d'apparition, transition]
  const RESA = [
    ['r1-accueil', -1, 'net'],
    ['r2-un', K.r2, 'defile'],
    ['r3-deux', K.tapPlus1 + 0.06, 'net'],
    ['r4-trois', K.tapPlus2 + 0.06, 'net'],
    ['r5-exterieur', K.r5, 'defile'],
    ['r7-contact', K.r7, 'defile'],
    ['r8-case', K.r8, 'net'],
    ['r9-entreprise', K.r9, 'defile'],
    ['r10-envoyee', K.r10, 'pop'],
  ];
  // zones relevées sur les captures (points, zone web 393×700)
  const Z = {
    compteur: [313, 203, 104, 46],
    exterieur: [197, 376, 352, 86],
    total: [104, 596, 176, 62],
  };
  function pageClient(t) {
    let k = 0;
    while (k < RESA.length - 1 && t >= RESA[k + 1][1]) k++;
    const [nom, t0, style] = RESA[k];
    const prec = k > 0 ? RESA[k - 1][0] : null;
    const d = style === 'net' ? 0.001 : style === 'defile' ? 0.34 : 0.26;
    const p = k > 0 ? P(t, t0, t0 + d, E.out) : 1;
    ctx.fillStyle = HAUT[nom] || '#FFF'; ctx.fillRect(0, 0, PT_W, 54);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 54, PT_W, 700); ctx.clip();
    ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 54, PT_W, 700);
    if (style === 'defile' && prec && p < 1) {
      // la page glisse vers le haut : l'ancienne part, la nouvelle arrive du bas
      ctx.drawImage(IMG[prec], 0, 54 - 160 * p, PT_W, 700);
      ctx.globalAlpha = p;
      ctx.drawImage(IMG[nom], 0, 54 + 160 * (1 - p), PT_W, 700);
    } else {
      if (prec && p < 1) ctx.drawImage(IMG[prec], 0, 54, PT_W, 700);
      ctx.globalAlpha = p;
      ctx.drawImage(IMG[nom], 0, 54 + (style === 'pop' ? (1 - p) * 20 : 0), PT_W, 700);
    }
    ctx.restore();
    barreEtat(HAUT_SOMBRE[nom]);
    // gestes et repères
    if (nom === 'r1-accueil') tap(t, K.tapUtilitaire, 'r1.utilitaire');
    if (nom === 'r2-un' || nom === 'r3-deux' || nom === 'r4-trois') {
      cadre(t, K.un - 0.1, K.prix - 0.05, Z.compteur, 4);
      tap(t, K.tapPlus1, 'r2.plus');
      tap(t, K.tapPlus2, 'r2.plus');
      if (nom === 'r4-trois') cadre(t, K.prix - 0.05, K.tapExterieur + 0.15, Z.exterieur, 3);
      tap(t, K.tapExterieur, 'r4.exterieur');
    }
    if (nom === 'r5-exterieur') cadre(t, K.seul - 0.15, K.r7, Z.total, 4);
    if (nom === 'r7-contact') { cadre(t, K.r7 + 0.4, K.tapCase + 0.1, rect('r7.entreprise'), 8); tap(t, K.tapCase, 'r7.case'); }
    if (nom === 'r9-entreprise') {
      cadre(t, K.nom - 0.25, K.siret - 0.1, rect('r9.entreprise'), 3);
      cadre(t, K.siret - 0.15, K.tapConfirmer, rect('r9.siret'), 3);
      tap(t, K.tapConfirmer, 'r9.continuer');
    }
    safari();
  }
  function safari() {
    const y0 = 754;
    ctx.fillStyle = 'rgba(246,246,248,0.97)'; ctx.fillRect(0, y0, PT_W, PT_H - y0);
    ctx.fillStyle = '#D1D1D6'; ctx.fillRect(0, y0, PT_W, 0.6);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#FFFFFF'; rr(14, y0 + 6, 365, 40, 13); ctx.fill();
    ctx.restore();
    ios('AA', 36, y0 + 32, 15, 600, '#000');
    // cadenas + domaine, centrés ensemble comme dans Safari
    police(16, 400, SF);
    const lu = ctx.measureText('washboard.fr').width, xl = PT_W / 2 - (lu + 15) / 2;
    ctx.fillStyle = '#000';
    rr(xl, y0 + 22, 10, 8, 1.8); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(xl + 5, y0 + 22, 3.2, Math.PI, 0); ctx.stroke();
    ios('washboard.fr', xl + 15, y0 + 32, 16, 400, '#000');
    ctx.beginPath(); ctx.arc(355, y0 + 26, 7, -Math.PI * 0.2, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = C.iosBleu; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const yi = y0 + 63;
    ctx.beginPath(); ctx.moveTo(42, yi - 8); ctx.lineTo(34, yi); ctx.lineTo(42, yi + 8); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(110, yi - 8); ctx.lineTo(118, yi); ctx.lineTo(110, yi + 8); ctx.stroke(); ctx.globalAlpha = 1;
    rr(188, yi - 6, 16, 16, 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(196, yi + 2); ctx.lineTo(196, yi - 13); ctx.moveTo(191, yi - 8); ctx.lineTo(196, yi - 13); ctx.lineTo(201, yi - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(266, yi - 9); ctx.lineTo(266, yi + 9); ctx.moveTo(266, yi - 9); ctx.quadraticCurveTo(258, yi - 12, 250, yi - 9); ctx.lineTo(250, yi + 9); ctx.quadraticCurveTo(258, yi + 6, 266, yi + 9); ctx.stroke();
    rr(338, yi - 8, 14, 14, 3); ctx.stroke(); rr(343, yi - 3, 14, 14, 3); ctx.stroke();
  }

  // ═════════════════════════ TON TÉLÉPHONE : NOTIFICATION, DEMANDE, FACTURE ═════════════════════════
  function ecranVerrouille(t) {
    const g = ctx.createLinearGradient(0, 0, PT_W, PT_H);
    g.addColorStop(0, '#2B3A67'); g.addColorStop(0.55, '#4C5FA8'); g.addColorStop(1, '#C37B9E');
    ctx.fillStyle = g; ctx.fillRect(0, 0, PT_W, PT_H);
    barreEtat(true);
    ios('samedi 7 novembre', PT_W / 2, 118, 21, 600, 'rgba(255,255,255,0.92)', 'center');
    ios('9:41', PT_W / 2, 214, 96, 700, 'rgba(255,255,255,0.95)', 'center');
    for (const x of [62, 331]) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(x, PT_H - 92, 25, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 2;
    rr(55, PT_H - 103, 14, 22, 3); ctx.stroke();
    rr(320, PT_H - 99, 22, 15, 3); ctx.stroke(); ctx.beginPath(); ctx.arc(331, PT_H - 91.5, 4, 0, Math.PI * 2); ctx.stroke();
    // la vraie notification envoyée par WashBoard (src/app/api/bookings/route.ts)
    const n = P(t, K.notif, K.notif + 0.35, E.snap);
    if (n > 0) {
      ctx.save(); ctx.translate(0, (1 - n) * 60); ctx.globalAlpha = clamp(n * 1.4);
      notification(420, iconeWashBoard, '🚗 Nouvelle réservation', ['👤 Yasmine Haddad', '✨ Extérieur · 105€'], { verrouille: true });
      ctx.restore();
    }
  }
  function capture(nom, dy = 0, alpha = 1) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(IMG[nom], 0, 54 + dy, PT_W, 798);
    ctx.restore();
  }
  function appLaveur(t) {
    const doc = t >= K.d2;
    const p = P(t, K.d2, K.d2 + 0.3, E.out);
    ctx.fillStyle = HAUT[doc ? 'd2-documents' : 'd1-a-confirmer'] || '#F4F3F1'; ctx.fillRect(0, 0, PT_W, PT_H);
    if (!doc || p < 1) capture('d1-a-confirmer');
    if (doc) capture('d2-documents', (1 - p) * 24, p);
    barreEtat(false);
    if (!doc) {
      cadre(t, K.deverrouille + 0.4, K.tapCarte + 0.3, rect('carte'), 4);
      tap(t, K.tapCarte, 'carte');
    } else {
      cadre(t, K.facture - 0.1, K.sortieLaveur, [196, 307, 344, 62], 3);
    }
  }
  function telephoneLaveur(t) {
    const d = P(t, K.deverrouille, K.deverrouille + 0.45, E.inOut);
    appLaveur(t);
    if (d < 1) { ctx.save(); ctx.translate(0, -d * PT_H); ecranVerrouille(t); ctx.restore(); }
  }

  // ═════════════════════════ CAMÉRA SUR L'IPHONE ═════════════════════════
  // [t, échelle, point de l'écran (pt) amené au centre du cadre]
  const WT = 470, CX = 540, CY = 905;
  const CTR = [196.5, 423];
  const CAM_CLIENT = [
    [0, 1, CTR],
    [K.tapUtilitaire - 0.5, 1, CTR],
    [K.tapUtilitaire - 0.1, 1.25, [197, 54 + 430]],
    [K.r2 + 0.1, 1.25, [197, 54 + 430]],
    [K.r2 + 0.45, 1.45, [197, 54 + 260]],
    [K.prix - 0.25, 1.45, [197, 54 + 260]],
    [K.prix + 0.1, 1.4, [197, 54 + 360]],
    [K.r5 + 0.1, 1.4, [197, 54 + 360]],
    [K.seul - 0.2, 1.35, [197, 54 + 520]],
    [K.r7 - 0.05, 1.35, [197, 54 + 520]],
    [K.r7 + 0.35, 1.45, [197, 54 + 330]],
    [K.r9 - 0.05, 1.45, [197, 54 + 330]],
    [K.r9 + 0.35, 1.42, [197, 54 + 300]],
    [K.tapConfirmer - 0.35, 1.42, [197, 54 + 300]],
    [K.tapConfirmer, 1.1, [197, 54 + 470]],
    [K.r10 + 0.2, 1.15, [197, 54 + 420]],
    [DUREE, 1.15, [197, 54 + 420]],
  ];
  const CAM_LAVEUR = [
    [0, 1, CTR],
    [K.notif - 0.1, 1, CTR],
    [K.notif + 0.4, 1.3, [197, 470]],
    [K.deverrouille, 1.3, [197, 470]],
    [K.deverrouille + 0.5, 1.4, [197, 54 + 392]],
    [K.d2 - 0.05, 1.4, [197, 54 + 392]],
    [K.d2 + 0.4, 1.35, [197, 54 + 330]],
    [DUREE, 1.35, [197, 54 + 330]],
  ];
  function camera(t, cams) {
    let k = 0;
    while (k < cams.length - 2 && t >= cams[k + 1][0]) k++;
    const [t0, s0, a] = cams[k], [t1, s1, b] = cams[k + 1];
    const p = E.inOut(clamp((t - t0) / (t1 - t0 || 1)));
    return { s: lerp(s0, s1, p), x: lerp(a[0], b[0], p), y: lerp(a[1], b[1], p) };
  }
  function telephone(t, entreeA, sortieA, cams, ecran, cote) {
    if (t < entreeA || t > sortieA + 0.6) return;
    const entree = P(t, entreeA, entreeA + 0.6, E.out);
    const sortie = P(t, sortieA, sortieA + 0.5, E.in);
    const c = camera(t, cams);
    const g = geometrie(WT);
    const fx = g.sx + g.k * c.x, fy = g.sy + g.k * c.y;
    const z = clamp((c.s - 1) / 0.2);
    ctx.save();
    // fenêtre du téléphone : jamais dans les titres (au-dessus) ni dans les sous-titres (dessous)
    ctx.beginPath(); ctx.rect(0, 392, W, 1398 - 392); ctx.clip();
    ctx.translate(CX + (1 - entree) * cote * 900 - sortie * cote * 1100, CY);
    ctx.rotate((1 - entree) * cote * 0.1 - sortie * cote * 0.12);
    ctx.scale(c.s, c.s);
    ctx.translate(-fx, -fy);
    iphone(WT, ecran);
    ctx.restore();
    if (z > 0) {
      for (const [y0, y1] of [[392, 452], [1398, 1338]]) {
        const gr = ctx.createLinearGradient(0, y0, 0, y1);
        gr.addColorStop(0, `rgba(242,238,230,${z})`); gr.addColorStop(1, 'rgba(242,238,230,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
      }
    }
  }

  // le mail reçu par le garage (vrai expéditeur et vrai objet : src/lib/email/index.ts, sendFacture)
  function carteMail(t) {
    const a = P(t, K.carteMail, K.carteMail + 0.4, E.snap) * (1 - P(t, K.sortieLaveur - 0.1, K.sortieLaveur + 0.25, E.in));
    if (a <= 0) return;
    const k = 2.35;
    ctx.save();
    ctx.globalAlpha = clamp(a * 1.5);
    ctx.translate(W / 2, 560 + (1 - a) * -80);
    ctx.rotate(-0.025);
    ctx.scale(k * lerp(0.9, 1, a), k * lerp(0.9, 1, a));
    ctx.translate(-PT_W / 2, -50);
    notification(0, iconeMail, 'Brillance Mobile via WashBoard', ['**Facture F-00048 — Brillance Mobile', 'Bonjour Yasmine Haddad,', 'Merci pour votre confiance.']);
    ctx.restore();
  }

  // ═════════════════════════ SOUS-TITRES ═════════════════════════
  const AFFICHES = ['01', '02', '03', '04', '05', '06'];
  // la transcription entend « ça facture par » pour « sa facture part » : on écrit ce qui est dit
  const CORRIGER = { '05': { 'ça': 'sa', 'par': 'part' }, '03': { 'Je': '« je', 'entreprise.': 'entreprise »' } };
  const GROUPES = {};
  function preparerSousTitres() {
    for (const id of AFFICHES) {
      const mots = [];
      const deja = {};
      for (const [m0, d] of globalThis.MOTS[id]) {
        let m = m0;
        const c = CORRIGER[id] && CORRIGER[id][m0.replace(/[.,]+$/, '')] !== undefined ? m0.replace(/[.,]+$/, '') : null;
        if (c !== null && !deja[c]) { deja[c] = true; m = CORRIGER[id][c] + (m0.match(/[.,]+$/) || [''])[0]; }
        if (id === '03' && m0 === 'entreprise.') m = 'entreprise »';
        const propre = m.replace(/^Washboard/i, 'WashBoard').replace(/[.,]+$/, '');
        if (/^[?!.,…]+$/.test(propre) && mots.length) mots[mots.length - 1][0] += ' ' + propre;
        else mots.push([propre, VO[id] + d]);
      }
      const gs = [];
      let cur = [];
      for (const w of mots) {
        if (cur.length && [...cur, w].map((x) => x[0]).join(' ').length > 22) { gs.push(cur); cur = []; }
        cur.push(w);
      }
      if (cur.length) gs.push(cur);
      const dernier = gs[gs.length - 1];
      if (gs.length > 1 && dernier.length === 1 && [...gs[gs.length - 2], ...dernier].map((x) => x[0]).join(' ').length <= 30) gs[gs.length - 2].push(...gs.pop());
      GROUPES[id] = gs;
    }
  }
  function sousTitres(t) {
    for (const id of AFFICHES) {
      const fin = VO[id] + globalThis.DUREES[id] + 0.15;
      if (t < VO[id] - 0.05 || t > fin) continue;
      const gs = GROUPES[id];
      let g = 0;
      for (let k = 0; k < gs.length; k++) if (t >= gs[k][0][1] - 0.05) g = k;
      const mots = gs[g];
      const apparition = P(t, mots[0][1] - 0.08, mots[0][1] + 0.12, E.out) * (1 - P(t, fin - 0.12, fin, E.in));
      police(52, 800);
      const esp = ctx.measureText(' ').width;
      const largeurs = mots.map(([m]) => ctx.measureText(m).width);
      const tot = largeurs.reduce((u, v) => u + v, 0) + esp * (mots.length - 1);
      ctx.save();
      ctx.globalAlpha = apparition;
      ctx.translate(540, 1462);
      ctx.scale(lerp(0.92, 1, apparition), lerp(0.92, 1, apparition));
      ctx.fillStyle = 'rgba(11,24,40,0.92)';
      rr(-tot / 2 - 30, -60, tot + 60, 84, 22); ctx.fill();
      let x = -tot / 2, courant = 0;
      mots.forEach(([, d], k) => { if (t >= d - 0.02) courant = k; });
      mots.forEach(([m, d], k) => {
        ctx.fillStyle = k === courant ? '#8FBCFF' : t >= d - 0.02 ? C.blanc : 'rgba(255,255,255,0.45)';
        ctx.textAlign = 'left';
        ctx.fillText(m, x, 0);
        x += largeurs[k] + esp;
      });
      ctx.restore();
    }
  }

  // ═════════════════════════ GRAIN + VIGNETTE ═════════════════════════
  let GRAIN;
  function preparerGrain() {
    GRAIN = document.createElement('canvas');
    GRAIN.width = 540; GRAIN.height = 960;
    const g = GRAIN.getContext('2d');
    const d = g.createImageData(540, 960);
    const r = rng(3);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - 0.5) * 60; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }
  function finition() {
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.06; ctx.drawImage(GRAIN, 0, 0, W, H); ctx.restore();
    const v = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.32, W / 2, H * 0.5, H * 0.78);
    v.addColorStop(0, 'rgba(11,24,40,0)'); v.addColorStop(1, 'rgba(11,24,40,0.13)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  // ═════════════════════════ LES SCÈNES ═════════════════════════
  const T = (t, a, b, lignes) => titre(t, { a, b, lignes, y: 250, taille: 80, x: 540, maxW: 900 });
  function scene(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.papier;
    ctx.fillRect(0, 0, W, H);

    // accroche
    titre(t, { a: 0.05, b: K.entreeClient - 0.25, lignes: [[['UN GARAGE', C.encre]], [['TE CONFIE', C.encre]], [['3 VÉHICULES ?', C.bleu]]], y: 760, taille: 128 });
    stickerScene(t, 'p18', 540, 0.35, K.entreeClient + 0.1, 560);

    telephone(t, K.entreeClient, K.sortieClient, CAM_CLIENT, () => pageClient(t), 1);
    telephone(t, K.entreeLaveur, K.sortieLaveur, CAM_LAVEUR, () => telephoneLaveur(t), -1);
    carteMail(t);

    T(t, K.entreeClient + 0.1, K.ajoute - 0.2, [[['SUR TA PAGE', C.encre]], [['WASHBOARD.', C.bleu]]]);
    T(t, K.ajoute - 0.1, K.un - 0.25, [[['IL AJOUTE', C.encre]], [['SES VÉHICULES.', C.bleu]]]);
    T(t, K.un - 0.15, K.prix - 0.25, [[['1, 2, 3…', C.encre]], [['UNE RÉSERVATION.', C.bleu]]]);
    T(t, K.prix - 0.15, K.r7 - 0.15, [[['LE PRIX SUIT', C.encre]], [['TOUT SEUL.', C.bleu]]]);
    stickerScene(t, 'p14', 880, K.ajoute, K.r7);
    T(t, K.r7 - 0.05, K.met - 0.25, [[['« JE RÉSERVE POUR', C.encre]], [['UNE ENTREPRISE »', C.bleu]]]);
    T(t, K.met - 0.15, K.toi - 0.2, [[['SON NOM,', C.encre]], [['SON SIRET.', C.bleu]]]);
    stickerScene(t, 'p05', 190, K.coche, K.toi);
    T(t, K.toi + 0.1, K.tapCarte - 0.35, [[['TOI, TU REÇOIS', C.encre]], [['LA DEMANDE.', C.bleu]]]);
    T(t, K.tapCarte - 0.25, K.quand + 0.9, [[['TU', C.encre]], [['CONFIRMES.', C.vert]]]);
    stickerScene(t, 'p12', 880, K.recois, K.d2);
    T(t, K.quand + 1.0, K.carteMail - 0.2, [[['LAVAGE TERMINÉ ?', C.encre]], [['FACTURE CRÉÉE.', C.bleu]]]);
    T(t, K.carteMail - 0.1, K.envoie - 0.25, [[['PAR MAIL,', C.encre]], [['À SON NOM.', C.bleu]]]);
    stickerScene(t, 'p09', 190, K.facture, K.envoie);
    titre(t, { a: K.envoie, b: K.essaie - 0.25, lignes: [[['ENVOIE ÇA À', C.encre]], [['UN POTE', C.bleu]], [['LAVEUR.', C.bleu]]], y: 760, taille: 128 });
    stickerScene(t, 'p06', 540, K.envoie + 0.2, K.essaie, 560);

    sousTitres(t);
    finale(t);
    finition();
  }

  function finale(t) {
    const a = P(t, K.essaie - 0.05, K.essaie + 0.5, E.out);
    if (a <= 0) return;
    ctx.save(); ctx.fillStyle = `rgba(242,238,230,${a})`; ctx.fillRect(0, 0, W, H); ctx.restore();
    logo(540, lerp(760, 720, a), 280 * lerp(0.92, 1, E.snap(a)), a);
    ctx.save();
    ctx.globalAlpha = a;
    police(112, 800);
    ctx.letterSpacing = '-3px';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.encre;
    ctx.fillText('WashBoard', 540, 1010 + (1 - a) * 30);
    ctx.letterSpacing = '0px';
    ctx.restore();
    const u = P(t, K.essaie + 0.2, K.essaie + 0.6, E.out);
    pastille('ESSAIE GRATUITEMENT', 540, 1130 + (1 - u) * 20, { fond: C.bleu, encre: C.blanc, taille: 38, alpha: u, e: lerp(0.9, 1, E.snap(u)) });
    const v = P(t, K.bio - 0.1, K.bio + 0.3, E.out);
    pastille('LIEN EN BIO · WASHBOARD.FR', 540, 1250 + (1 - v) * 20, { fond: C.encre, encre: C.blanc, taille: 32, alpha: v });
    ctx.save();
    ctx.globalAlpha = P(t, K.fin + 0.2, K.fin + 0.7, E.out);
    police(36, 600);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.encre2;
    ctx.fillText('Tu laves des voitures. On gère le reste.', 540, 1360);
    ctx.restore();
    sticker('p08', 540, 2050, 500, { e: E.snap(P(t, K.essaie + 0.35, K.essaie + 0.7)) });
  }

  // ═════════════════════════ flou de mouvement ═════════════════════════
  const FENETRES_FLOU = [[K.entreeClient - 0.1, K.entreeClient + 0.6], [K.sortieClient, K.entreeLaveur + 0.6], [K.sortieLaveur, K.sortieLaveur + 0.6]];
  let BUF;
  function rendu(t, canvas) {
    const out = canvas.getContext('2d');
    const flou = FENETRES_FLOU.some(([a, b]) => t >= a && t <= b);
    if (!flou) { ctx = out; scene(t); return; }
    const n = 8, obturation = 0.5 / 60;
    if (!BUF) { BUF = document.createElement('canvas'); BUF.width = W; BUF.height = H; }
    const bctx = BUF.getContext('2d');
    out.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < n; i++) {
      ctx = bctx;
      scene(t + obturation * (i / (n - 1) - 0.5));
      out.globalAlpha = 1 / (i + 1);
      out.drawImage(BUF, 0, 0);
    }
    out.globalAlpha = 1;
  }

  // ═════════════════════════ COUVERTURE (sombre ou claire) ═════════════════════════
  // Tout l'important tient dans le centre 3:4 (y 240 → 1680) ; le sticker est toujours présent.
  function couverture(canvas, theme) {
    ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sombre = theme === 'sombre';
    const fond = ctx.createLinearGradient(0, 0, 0, H);
    fond.addColorStop(0, sombre ? '#0B1828' : '#F4F7FB');
    fond.addColorStop(1, sombre ? '#16294A' : '#E4EAF3');
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, W, H);
    const encre = sombre ? '#FFFFFF' : C.encre, doux = sombre ? 'rgba(255,255,255,0.55)' : '#7B8494';
    if (IMG.logo) { ctx.save(); rr(70, 285, 56, 56, 13); ctx.clip(); ctx.drawImage(IMG.logo, 70, 285, 56, 56); ctx.restore(); }
    texte('WashBoard', 142, 325, { px: 34, poids: 700, couleur: encre });
    texte('Un garage te confie', 70, 470, { px: 92, poids: 800, couleur: doux });
    ctx.letterSpacing = '-2px';
    police(116, 800);
    ctx.fillStyle = sombre ? '#7FAAD8' : C.bleu; ctx.fillText('3 véhicules ?', 70, 600);
    ctx.letterSpacing = '0px';
    // l'iPhone sur la vraie page : 3 utilitaires, 105 €
    ctx.save(); ctx.translate(650, 1190); ctx.rotate(0.04);
    iphone(330, () => { ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, PT_W, PT_H); ctx.drawImage(IMG['r5-exterieur'], 0, 54, PT_W, 700); barreEtat(false); safari(); });
    ctx.restore();
    sticker('p18', 250, 1670, 560);
    return canvas.toDataURL('image/png').slice(22);
  }

  async function charger(base) {
    const charge = (n, src) => new Promise((ok, ko) => { const im = new Image(); im.onload = () => { IMG[n] = im; ok(); }; im.onerror = () => ko(new Error(src)); im.src = src; });
    const ECRANS = [...RESA.map(([n]) => n), 'd1-a-confirmer', 'd2-documents'];
    await Promise.all([
      ...['p05', 'p06', 'p08', 'p09', 'p12', 'p14', 'p18'].map((n) => charge(n, `${base}assets/stickers/${n}.png`)),
      ...ECRANS.map((n) => charge(n, `${base}assets/ecrans/${n}.png`)),
      charge('logo', `${base}assets/logo.png`),
      fetch(`${base}assets/ecrans/positions-resa.json`).then((r) => r.json()).then((j) => { Object.assign(POS, j); }),
      fetch(`${base}assets/ecrans/positions-demo.json`).then((r) => r.json()).then((j) => { Object.assign(POS, j); }),
    ]);
    // positions dérivées : la case à cocher (à gauche de son libellé), le radio « Extérieur » sur r4
    if (POS['r7.entreprise']) POS['r7.case'] = { x: 41, y: POS['r7.entreprise'].y, w: 22, h: 22 };
    POS['r4.exterieur'] = { x: 42, y: 353, w: 21, h: 21 };
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    const g = c.getContext('2d', { willReadFrequently: true });
    const pixel = (n, x, y) => { g.clearRect(0, 0, 1, 1); g.drawImage(IMG[n], x, y, 1, 1, 0, 0, 1, 1); return g.getImageData(0, 0, 1, 1).data; };
    for (const n of ECRANS) {
      const [r, v, b] = pixel(n, 30, 3);
      HAUT[n] = `rgb(${r},${v},${b})`;
      HAUT_SOMBRE[n] = 0.299 * r + 0.587 * v + 0.114 * b < 140;
    }
    await Promise.all(['800 100px Geist', '700 100px Geist', '600 100px Geist',
      '400 17px Inter', '500 17px Inter', '600 17px Inter', '700 17px Inter', '17px "Noto Color Emoji"'].map((f) => document.fonts.load(f, f.includes('Emoji') ? '🚗👤✨' : 'a')));
    preparerGrain();
    preparerSousTitres();
  }

  globalThis.WB = { rendu, charger, couverture, W, H };
})();

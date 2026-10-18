# Silhouettes de la page de réservation, étape 2 : vectoriser la découpe (decoupe/<type>.png).
#   public/silhouettes/<type>.svg          la face (contour blanc, carrosserie, vitres, roues)
#   public/silhouettes/<type>-contour.svg  la seule forme : tranche 3D et masques du reflet
# La forme, les plastiques noirs, les phares et les jantes viennent de la photo ; les vitres,
# montants, poignées et lignes de portes sont relevés à la main (releves.py).
#   python vectorise.py [type…]   (Python de la machine : numpy, opencv, scikit-learn)
# Repère commun : viewBox -20 -10 1040 420, voiture centrée, roues posées sur y = 380.
import os, sys
import numpy as np
import cv2
from PIL import Image
from sklearn.cluster import KMeans
from releves import RELEVES

ICI = os.path.dirname(os.path.abspath(__file__))
ENTREE = os.path.join(ICI, 'decoupe')
SORTIE = os.path.join(ICI, '..', '..', 'public', 'silhouettes')
os.makedirs(SORTIE, exist_ok=True)

LARGEUR_TRAVAIL = 1400      # px de la découpe redimensionnée avant traitement
CONTOUR = 12                # épaisseur du contour blanc, unités du repère
NIVEAUX = 6                 # nombre d'aplats de gris
TONS_SOMBRES = ['#9C9CA3', '#85858C', '#6E6E75', '#5E5E65']
TON_CAISSE = '#B8B8BE'
TONS_CLAIRS = ['#CBCBD0', '#DCDCE0', '#E8E8EB']


def chemin(contours, hierarchie, echelle, dx, dy, eps):
    """Contours OpenCV → un `d` SVG (trous compris, règle evenodd)."""
    morceaux = []
    for c in contours:
        if cv2.contourArea(c) < 6:
            continue
        a = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
        if len(a) < 3:
            continue
        pts = [f'{x * echelle + dx:.1f} {y * echelle + dy:.1f}' for x, y in a]
        morceaux.append('M ' + ' L '.join(pts) + ' Z')
    return ' '.join(morceaux)


def roues(masque, gris):
    """Les deux roues (cercles), pour connaître le sol et couper ce qui le traîne."""
    h, w = masque.shape
    flou = cv2.medianBlur(gris, 5)
    cercles = cv2.HoughCircles(flou, cv2.HOUGH_GRADIENT, dp=1.2, minDist=w * 0.35, param1=120, param2=28,
                               minRadius=int(w * 0.06), maxRadius=int(w * 0.13))
    if cercles is None:
        return []
    c = sorted(cercles[0], key=lambda k: -k[1])  # les plus bas d'abord
    # Les deux plus bas, l'un à gauche, l'autre à droite.
    gauche = [k for k in c if k[0] < w / 2][:1]
    droite = [k for k in c if k[0] >= w / 2][:1]
    return gauche + droite


def traiter(nom):
    rel = RELEVES.get(nom, {})
    im = Image.open(os.path.join(ENTREE, f'{nom}.png')).convert('RGBA')
    k = LARGEUR_TRAVAIL / im.width
    im = im.resize((LARGEUR_TRAVAIL, round(im.height * k)), Image.LANCZOS)
    rgba = np.array(im)
    masque = (rgba[:, :, 3] > 128).astype(np.uint8)
    rgb = rgba[:, :, :3]
    gris = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    # Le sol : sous les roues. Hors des roues, on coupe ce qui descend presque au sol (ombres).
    rs = roues(masque, gris)
    bas_masque = np.nonzero(masque.any(axis=1))[0].max()
    if len(rs) == 2:
        sol = int(max(r[1] + r[2] for r in rs))
        sol = min(sol, bas_masque)
        r_moy = float(np.mean([r[2] for r in rs]))
        coupe = int(sol - r_moy * rel.get('coupe', 0.30))
        cols = np.ones(masque.shape[1], bool)
        for cx, cy, r in rs:
            cols[max(0, int(cx - r * 1.05)):int(cx + r * 1.05)] = False
        masque[coupe:, cols] = 0
        # Sous le bas de caisse, il ne reste que les roues (l'ombre au sol tombait aussi
        # dans leurs colonnes, d'où des blocs carrés sous les pneus).
        yy0, xx0 = np.mgrid[0:masque.shape[0], 0:masque.shape[1]]
        roue_ok = np.zeros(masque.shape, bool)
        for cx, cy, r in rs:
            roue_ok |= (xx0 - cx) ** 2 + (yy0 - cy) ** 2 <= (r * 1.03) ** 2
        bas_zone = np.zeros(masque.shape, bool)
        bas_zone[coupe:, :] = True
        masque[bas_zone & ~roue_ok] = 0
        masque[sol + 2:, :] = 0
    # Lissage du bord, plus grande zone, trous bouchés.
    masque = cv2.morphologyEx(masque, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, etiq, stats, _ = cv2.connectedComponentsWithStats(masque)
    if n > 1:
        masque = (etiq == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    pleins = masque.copy()
    contours, _ = cv2.findContours(pleins, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(pleins, contours, -1, 1, cv2.FILLED)
    masque = pleins
    ys, xs = np.nonzero(masque)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()

    # Zones par ce qu'elles SONT, pas par paliers de gris : la carrosserie d'une seule teinte,
    # ce qui est nettement plus sombre (vitres teintées, plastiques noirs), nettement plus clair
    # (vitres qui reflètent le ciel, chromes, phares) ; les roues à part.
    doux = cv2.pyrMeanShiftFiltering(rgb, 18, 28)
    lum = cv2.cvtColor(doux, cv2.COLOR_RGB2LAB)[:, :, 0].astype(np.float32)
    dedans = masque.astype(bool)
    dans_roue = np.zeros(masque.shape, bool)
    yy, xx = np.mgrid[0:masque.shape[0], 0:masque.shape[1]]
    for cx, cy, r in rs:
        dans_roue |= (xx - cx) ** 2 + (yy - cy) ** 2 <= (r * 1.02) ** 2
    cadre = np.zeros(masque.shape, np.uint8)
    if rel.get('cadre'):
        cv2.fillPoly(cadre, [np.array(rel['cadre'], np.int32)], 1)
    corps = dedans & ~dans_roue & ~cadre.astype(bool)
    L_caisse = float(np.median(lum[corps]))
    delta = 26.0
    classes = {}
    # « Très sombre » relatif à la carrosserie : sur une peinture foncée (orange, vert), les
    # plastiques noirs doivent ressortir aussi.
    classes['#74747B'] = corps & (lum < max(L_caisse - 2.2 * delta, L_caisse * 0.5))
    classes['#D6D6DB'] = corps & (lum > L_caisse + 1.5 * delta)
    # Roues : pneu sombre, jante en deux tons tirés de la photo (le vrai dessin des branches).
    jantes_dessinees = []
    for cx, cy, r in rs:
        roue = dedans & ((xx - cx) ** 2 + (yy - cy) ** 2 <= (r * 1.02) ** 2)
        jante = (xx - cx) ** 2 + (yy - cy) ** 2 <= (r * 0.68) ** 2
        pneu = roue & ~jante
        classes.setdefault('#6A6A71', np.zeros(masque.shape, bool))
        classes['#6A6A71'] |= pneu
        lj = lum[jante & dedans]
        # Jante sans contraste (noire sur pneu noir) : son dessin ne se lit pas sur la photo,
        # on en dessine une à cinq doubles branches, foncée comme l'originale.
        if lj.size and (rel.get('jantes_dessinees') or float(np.std(lj)) < 16):
            jantes_dessinees.append((cx, cy, r, rel.get('jantes_dessinees') == 'claires'))
            continue
        if lj.size:
            seuil = float(np.median(lj))
            classes.setdefault('#D2D2D7', np.zeros(masque.shape, bool))
            classes.setdefault('#858589', np.zeros(masque.shape, bool))
            classes['#D2D2D7'] |= jante & dedans & (lum >= seuil)
            classes['#858589'] |= jante & dedans & (lum < seuil)
    ordre_tons = ['#D6D6DB', '#74747B']
    tons_roues = ['#6A6A71', '#858589', '#D2D2D7']

    # Mise à l'échelle dans le repère commun : roues sur y = 380, centré.
    w, h = x1 - x0 + 1, y1 - y0 + 1
    echelle = min(1000 / w, 370 / h)
    dx = (1000 - w * echelle) / 2 - x0 * echelle
    dy = 380 - (y1 + 1) * echelle
    eps = 0.8 / echelle  # tolérance de simplification ≈ 0,8 unité du repère

    contour_ext, _ = cv2.findContours(masque, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    d_forme = chemin(contour_ext, None, echelle, dx, dy, eps)

    couches = []
    surface_min = masque.sum() * 0.0006
    for ton in ordre_tons:
        if ton not in classes:
            continue
        zone = classes[ton].astype(np.uint8)
        grand = ton in ('#D6D6DB', '#74747B')
        noyau = np.ones((7, 7) if grand else (3, 3), np.uint8)
        zone = cv2.morphologyEx(zone, cv2.MORPH_OPEN, noyau)
        zone = cv2.morphologyEx(zone, cv2.MORPH_CLOSE, noyau)
        n, e, st, _ = cv2.connectedComponentsWithStats(zone)
        garde = np.zeros_like(zone)
        mini = surface_min if grand else surface_min * 0.15
        # Les clairs : seulement les petits éléments (phares, chromes), pas les reflets.
        maxi = masque.sum() * 0.012 if ton == '#D6D6DB' else masque.sum()
        for j in range(1, n):
            if mini <= st[j, cv2.CC_STAT_AREA] <= maxi:
                garde[e == j] = 1
        if not garde.any():
            continue
        cs, hi = cv2.findContours(garde, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        d = chemin(cs, hi, echelle, dx, dy, eps)
        if d:
            couches.append((ton, d))

    def poly(points):
        return 'M ' + ' L '.join(f'{x * echelle + dx:.1f} {y * echelle + dy:.1f}' for x, y in points) + ' Z'
    def ligne(points):
        return 'M ' + ' L '.join(f'{x * echelle + dx:.1f} {y * echelle + dy:.1f}' for x, y in points)
    releves_svg = []
    if rel.get('cadre'):
        releves_svg.append(f'<path d="{poly(rel["cadre"])}" fill="#74747B" stroke="#74747B" stroke-width="3" stroke-linejoin="round"/>')
    for v in rel.get('vitres', []):
        releves_svg.append(f'<path d="{poly(v)}" fill="url(#verre)" stroke-linejoin="round"/>')
    for p in rel.get('poignees', []):
        releves_svg.append(f'<path d="{poly(p)}" fill="#9C9CA3" stroke="#9C9CA3" stroke-width="3" stroke-linejoin="round"/>')
    for l in rel.get('lignes', []):
        releves_svg.append(f'<path d="{ligne(l)}" fill="none" stroke="#9A9AA1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>')
    roues_svg = []
    for ton in tons_roues:
        if ton not in classes:
            continue
        zone = classes[ton].astype(np.uint8)
        zone = cv2.morphologyEx(zone, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        zone = cv2.morphologyEx(zone, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        n, e, st, _ = cv2.connectedComponentsWithStats(zone)
        for j in range(1, n):
            if st[j, cv2.CC_STAT_AREA] < masque.sum() * 0.00008:
                zone[e == j] = 0
        cs, hi = cv2.findContours(zone, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        d = chemin(cs, hi, echelle, dx, dy, eps)
        if d:
            roues_svg.append(f'<path d="{d}" fill="{ton}" fill-rule="evenodd"/>')

    import math
    for cx, cy, r, claire in jantes_dessinees:
        X, Y, R = cx * echelle + dx, cy * echelle + dy, r * echelle
        rj = R * 0.66
        p = lambda a, rr: f'{X + math.cos(a) * rr:.1f} {Y + math.sin(a) * rr:.1f}'
        fond, branche, moyeu, levre = ('#8E8E95', '#D2D2D7', '#C4C4C9', '#DADADE') if claire else ('#7E7E85', '#A9A9B0', '#9A9AA1', '#B4B4BA')
        el = [f'<circle cx="{X:.1f}" cy="{Y:.1f}" r="{rj:.1f}" fill="{fond}"/>']
        for k in range(10):
            a0 = (k // 2) / 5 * math.tau + (0.13 if k % 2 else -0.13) - math.pi / 2
            el.append(f'<path d="M {p(a0 - 0.07, rj * 0.24)} L {p(a0 - 0.09, rj - 3)} L {p(a0 + 0.09, rj - 3)} L {p(a0 + 0.07, rj * 0.24)} Z" fill="{branche}"/>')
        el.append(f'<circle cx="{X:.1f}" cy="{Y:.1f}" r="{rj * 0.26:.1f}" fill="{moyeu}"/><circle cx="{X:.1f}" cy="{Y:.1f}" r="{rj:.1f}" fill="none" stroke="{levre}" stroke-width="2.5"/>')
        roues_svg.append(''.join(el))

    vue = 'viewBox="-20 -10 1040 420" xmlns="http://www.w3.org/2000/svg"'
    face = [f'<svg {vue}>',
            f'<path d="{d_forme}" fill="#fff" stroke="#fff" stroke-width="{CONTOUR}" stroke-linejoin="round"/>',
            '<defs><linearGradient id="verre" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#E4E4E8"/><stop offset="1" stop-color="#C6C6CC"/></linearGradient></defs>',
            f'<path d="{d_forme}" fill="{TON_CAISSE}"/>']
    face += [f'<path d="{d}" fill="{t}" fill-rule="evenodd"/>' for t, d in couches if t in ordre_tons]
    face += releves_svg + roues_svg
    face.append('</svg>')
    contour = f'<svg {vue}><path d="{d_forme}" fill="#fff" stroke="#fff" stroke-width="{CONTOUR}" stroke-linejoin="round"/></svg>'
    open(os.path.join(SORTIE, f'{nom}.svg'), 'w', encoding='utf-8').write(''.join(face))
    open(os.path.join(SORTIE, f'{nom}-contour.svg'), 'w', encoding='utf-8').write(contour)
    taille = os.path.getsize(os.path.join(SORTIE, f'{nom}.svg'))
    print(f'{nom}: roues {len(rs)}, {len(couches)} aplats, {taille // 1024} Ko')


noms = sys.argv[1:] or ['citadine', 'SUV', '7places', 'berline', 'monospace', 'citadine_2p', 'utilitaire']
for n in noms:
    traiter(n)

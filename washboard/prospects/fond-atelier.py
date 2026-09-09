# Fabrique une scene d'atelier aux couleurs d'un prospect : mur de beton brut,
# caisson lumineux portant SON logo, lampe tungstene, plante en contre-jour.
#
#   python fond-atelier.py <logo.png> <#accent> <#second> <sortie.png> [graine] [largeur] [x]
#
# puis :
#   node habiller-page.mjs <slug> --fond <sortie.png> --couleur <#accent>
#
# Pourquoi une scene calculee et non une photo : reprendre le cliche d'un autre
# laveur pour l'afficher sous le nom d'un prospect reviendrait a lui attribuer
# l'atelier de quelqu'un d'autre. Ici tout est genere, rien n'appartient a
# personne — sauf le logo, qui est bien le sien.
#
# Le decor tient a trois choses, dans cet ordre d'importance :
#   1. l'ecart de TEMPERATURE entre l'ambiance (froide, sa couleur secondaire)
#      et les sources (chaudes, sa couleur de marque et une lampe) ;
#   2. la MATIERE du mur, qui doit rester lisible sous les halos ;
#   3. le CADRAGE : la carte de reservation masque le centre, l'enseigne est
#      donc decentree pour passer derriere elle comme sur une vraie photo.
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter

W, H = 1920, 1080

LOGO    = sys.argv[1]
ACCENT  = sys.argv[2]
SECOND  = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != '-' else sys.argv[2]
SORTIE  = sys.argv[4] if len(sys.argv) > 4 else 'atelier.png'
GRAINE  = int(sys.argv[5]) if len(sys.argv) > 5 else 7
SIGNE_L = int(sys.argv[6]) if len(sys.argv) > 6 else 950
SIGNE_X = float(sys.argv[7]) if len(sys.argv) > 7 else 0.37

rng = np.random.default_rng(GRAINE)
hexa = lambda s: np.array([int(s.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)], np.float32) / 255
TEINTE, FROIDE = hexa(ACCENT), hexa(SECOND)
CHAUDE = np.array([1.00, 0.60, 0.24], np.float32)          # tungstene ~2700 K


def bruit(octaves=6, base=4, persistance=0.55):
    """Bruit fractal : des nappes de plus en plus fines, additionnees."""
    total = np.zeros((H, W), np.float32)
    amp, freq, somme = 1.0, base, 0.0
    for _ in range(octaves):
        petit = rng.random((max(2, int(freq * H / W)), max(2, int(freq)))).astype(np.float32)
        grand = np.array(Image.fromarray((petit * 255).astype(np.uint8))
                         .resize((W, H), Image.BICUBIC), np.float32) / 255
        total += grand * amp
        somme += amp
        amp *= persistance
        freq *= 2.0
    return total / somme


def halo(cx, cy, rayon, puissance=2.0):
    """Chute de lumiere radiale, en coordonnees relatives (0-1)."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((x - cx * W) / (rayon * W)) ** 2 + ((y - cy * H) / (rayon * W)) ** 2)
    return np.clip(1.0 - d, 0, 1) ** puissance


# ── 1. Le mur ───────────────────────────────────────────────────────────────
# Le beton est bien plus UNIFORME qu'un ciel nuageux : ce sont les hautes
# frequences qui font la matiere. Une premiere version ponderee a l'inverse
# ressemblait a du brouillard.
taches = gaussian_filter(bruit(3, 2, 0.6), 22)
grain  = bruit(8, 22, 0.62)
piquet = gaussian_filter(rng.random((H, W)).astype(np.float32), 0.8)

mur = 0.22 * taches + 0.55 * grain + 0.23 * piquet
mur = (mur - mur.min()) / (mur.max() - mur.min())
mur = 0.30 + 0.58 * mur          # plage plus large : le beton doit avoir du relief

# Panneaux de banche : le mur est coule par bandes, chacune prend un ton un peu
# different. C'est ce qui donne au beton son relief a grande echelle — sans ca,
# la lumiere tombe sur une surface uniforme et la scene reste gazeuse.
bandes = np.zeros((H, W), np.float32)
y0 = 0
while y0 < H:
    h_bande = int(rng.uniform(0.16, 0.30) * H)
    x0 = 0
    while x0 < W:
        l_bande = int(rng.uniform(0.18, 0.42) * W)
        bandes[y0:y0 + h_bande, x0:x0 + l_bande] = rng.uniform(-0.09, 0.09)
        x0 += l_bande
    y0 += h_bande
mur = np.clip(mur + gaussian_filter(bandes, 12), 0, 1)

# Bulles de coulage : les petits crateres d'un beton brut de decoffrage.
for _ in range(2600):
    x0, y0 = rng.integers(0, W), rng.integers(0, H)
    r = int(rng.integers(1, 4))
    yy, xx = np.ogrid[-r:r + 1, -r:r + 1]
    m = (xx ** 2 + yy ** 2 <= r ** 2)
    y1, y2, x1, x2 = max(0, y0 - r), min(H, y0 + r + 1), max(0, x0 - r), min(W, x0 + r + 1)
    sub = m[:y2 - y1, :x2 - x1]
    mur[y1:y2, x1:x2] = np.where(sub, mur[y1:y2, x1:x2] * rng.uniform(0.62, 0.86), mur[y1:y2, x1:x2])

# Joints de banches : le beton coule se lit a ses reprises horizontales.
for yj, force in ((0.34, 0.55), (0.62, 0.45), (0.86, 0.35)):
    y0 = int(yj * H)
    ligne = np.exp(-((np.arange(H) - y0) ** 2) / (2 * 3.5 ** 2))
    creux = np.exp(-((np.arange(H) - y0 - 4) ** 2) / (2 * 5.0 ** 2))
    ondul = 1 + 0.35 * np.sin(np.linspace(0, 9, W))
    mur *= (1 - 0.30 * force * (ligne[:, None] * ondul[None, :]))
    mur += 0.05 * force * creux[:, None]

for _ in range(9):
    x0 = int(rng.integers(0, W)); larg = int(rng.integers(30, 110))
    col = np.exp(-((np.arange(W) - x0) ** 2) / (2 * larg ** 2))
    prof = np.clip(np.linspace(-0.2, 1.0, H), 0, 1) ** 1.4
    mur *= (1 - 0.10 * col[None, :] * prof[:, None])

mur = np.clip(mur, 0, 1)
# Le beton est legerement bleute dans l'ombre : c'est ce qui le distingue d'un
# gris neutre, et ce qui fait ressortir la lumiere chaude par contraste.
beton = np.stack([mur * 0.94, mur * 0.96, mur * 1.00], -1)

# ── 2. Le caisson ───────────────────────────────────────────────────────────
# Traite comme un CAISSON LUMINEUX et non comme un tube neon : son logo est un
# embleme plein, le transformer en tube deformerait sa marque. Un caisson garde
# le logo exact et l'eclaire par l'interieur.
cx, cy = int(W * SIGNE_X), int(H * 0.40)
def detourer(chemin):
    """Efface le fond du logo en propageant depuis les BORDS. Un simple seuil sur
    le blanc trouerait un lettrage cerne de blanc ; la propagation epargne tout
    ce qui ne touche pas le bord. Rend l'image telle quelle si les quatre coins
    different — le logo est alors sur une photo, et un detourage l'abimerait."""
    im = Image.open(chemin).convert('RGBA')
    im.thumbnail((900, 900), Image.LANCZOS)
    a = np.asarray(im, np.int16).copy()
    h, w = a.shape[:2]
    coins = [a[0, 0, :3], a[0, w - 1, :3], a[h - 1, 0, :3], a[h - 1, w - 1, :3]]
    if max(np.abs(c - coins[0]).sum() for c in coins) > 90:
        return im
    ref, TOL = coins[0], 110
    proche = (np.abs(a[..., :3] - ref).sum(-1) <= TOL)
    from scipy.ndimage import label
    etiq, _ = label(proche)
    bords = set(etiq[0].tolist()) | set(etiq[-1].tolist()) | set(etiq[:, 0].tolist()) | set(etiq[:, -1].tolist())
    bords.discard(0)
    a[..., 3] = np.where(np.isin(etiq, list(bords)), 0, a[..., 3])
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


logo = detourer(LOGO)
logo.thumbnail((SIGNE_L, SIGNE_L), Image.LANCZOS)
plaque = Image.new('RGBA', (W, H), (0, 0, 0, 0))
plaque.paste(logo, (cx - logo.width // 2, cy - logo.height // 2), logo)
sig = np.asarray(plaque, np.float32) / 255
sig_rgb, sig_a = sig[..., :3], sig[..., 3]

ombre = gaussian_filter(np.roll(np.roll(sig_a, 24, 0), 18, 1), 18)
beton *= (1 - 0.55 * ombre)[..., None]

# ── 3. Les lumieres ─────────────────────────────────────────────────────────
# Releve sur une photo d'atelier reelle : le point le plus clair est une lampe
# tungstene en bas a gauche (x ≈ 6 %, y ≈ 60 %), le haut et le bas sont tres
# sombres, une bande mi-claire traverse le bas du mur.
lampe = halo(0.065, 0.60, 0.40, 2.6)
diff  = gaussian_filter(sig_a, 150)
pres  = gaussian_filter(sig_a, 26)
# Deuxieme foyer a droite, dans la couleur de marque : sans lui toute la lumiere
# venait de gauche et la moitie droite du cadre etait morte.
foyer_d = halo(0.93, 0.34, 0.26, 2.0)
bas_d   = halo(0.86, 0.88, 0.22, 2.2)

# Le mur baigne dans la SECONDE couleur, froide, et les accents sont chauds.
# Version precedente : l'orange de la marque et l'orange du tungstene avaient la
# meme teinte, tout se melangeait en un lavis sepia sans structure. Un decor tient
# par l'ecart de temperature entre son ambiance et ses sources.
ambiance = 0.30 + 0.55 * halo(0.5, 0.5, 0.95, 1.2)
eclair = (0.06
          + 0.62 * ambiance[..., None] * FROIDE
          + 1.30 * lampe[..., None] * CHAUDE
          + 0.95 * diff[..., None] * TEINTE
          + 0.75 * foyer_d[..., None] * TEINTE
          + 0.45 * bas_d[..., None] * TEINTE)
scene = beton * eclair

# Les halos additionnels sont MODULES par la matiere du mur. Ajoutes tels quels,
# ils lissaient le beton et le mur redevenait un degrade.
matiere = (0.35 + 0.65 * mur)[..., None]
scene += pres[..., None] * TEINTE * 0.55 * matiere
scene += diff[..., None] * TEINTE * 0.30 * matiere
scene += foyer_d[..., None] * TEINTE * 0.34 * matiere
scene += sig_rgb * sig_a[..., None] * 0.70          # le caisson allume

# La lampe : abat-jour, ampoule, collerette.
abat = Image.new('L', (W, H), 0)
da = ImageDraw.Draw(abat)
lx, ly = int(W * 0.062), int(H * 0.598)
da.polygon([(lx - 46, ly - 16), (lx + 46, ly - 16), (lx + 26, ly - 62), (lx - 26, ly - 62)], fill=255)
da.rectangle([lx - 3, 0, lx + 3, ly - 58], fill=255)          # la tige
capot = gaussian_filter(np.asarray(abat, np.float32) / 255, 1.2)
scene *= (1 - 0.86 * capot)[..., None]
scene += gaussian_filter(capot, 9)[..., None] * CHAUDE * 0.22  # le metal chauffe
scene += halo(0.062, 0.598, 0.030, 1.4)[..., None] * CHAUDE * 1.45
scene += halo(0.062, 0.598, 0.17, 2.8)[..., None] * CHAUDE * 0.42

# ── 4. La plante ────────────────────────────────────────────────────────────
# En contre-jour devant la lampe. Premiere version faite de traits et de ronds :
# ca ressemblait a des allumettes. Une feuille est une forme fuselee, dessinee
# a plat puis pivotee.
feuilles = Image.new('L', (W, H), 0)
dessin = ImageDraw.Draw(feuilles)
for base_x, base_y, nb in ((int(W * 0.040), int(H * 1.16), 34),
                           (int(W * 0.105), int(H * 1.22), 20)):
    for _ in range(nb):
        lg = int(rng.uniform(0.16, 0.34) * H)
        lar = max(9, int(lg * rng.uniform(0.10, 0.17)))       # fuselee, pas charnue
        f = Image.new('L', (lar, lg), 0)
        ImageDraw.Draw(f).ellipse([0, 0, lar - 1, lg - 1], fill=255)
        # La feuille doit suivre SA tige. Une rotation au hasard — ce que je
        # faisais — donnait un bouquet de doigts ecartes.
        ang = rng.uniform(-140, -40)
        f = f.rotate(-(ang + 90), expand=True, resample=Image.BICUBIC)
        a = np.radians(ang)
        mx, my = base_x + np.cos(a) * lg * 0.5, base_y + np.sin(a) * lg * 0.5
        feuilles.paste(f, (int(mx - f.width / 2), int(my - f.height / 2)), f)
        dessin.line([(base_x, base_y), (mx, my)], fill=255, width=3)
silhouette = gaussian_filter(np.asarray(feuilles, np.float32) / 255, 2.5)
scene *= (1 - 0.94 * silhouette)[..., None]
lisere = np.clip(gaussian_filter(silhouette, 5) - silhouette, 0, 1)
scene += lisere[..., None] * CHAUDE * 0.50

# ── 5. Finition ─────────────────────────────────────────────────────────────
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
vign = 1 - 0.62 * np.clip(np.sqrt(((x / W - .5) / .78) ** 2 + ((y / H - .5) / .78) ** 2), 0, 1) ** 2.0
scene *= vign[..., None]
scene += (rng.random((H, W, 1)).astype(np.float32) - 0.5) * 0.020
scene = np.clip(scene, 0, 1) ** (1 / 1.05)
# Un soupcon de contraste local, comme un capteur photo le rendrait.
scene = np.clip((scene - 0.5) * 1.13 + 0.5, 0, 1)

Image.fromarray((np.clip(scene, 0, 1) * 255).astype(np.uint8)).save(SORTIE)
print('ecrit :', SORTIE)

# Véhicules de la page de réservation : la voiture détourée de sa photo, posée dans le repère
# commun (demande d'Alexandre, 2026-10-18 : « on ne fait plus les silhouettes, on essaie avec
# les voitures segmentées »). Photos de profil qu'il a choisies (MG3, Aygo X, Audi A8, Lexus,
# Grand Scénic, Dacia Jogger, Transit Custom), avant à droite — non versionnées : les déposer
# dans photos/.
#
#   python -m venv venv && venv/Scripts/pip install "rembg[cpu]" opencv-python-headless
#   (environnement à part : rembg tire numpy 2, qui casse les autres outils Python de la machine)
#   venv/Scripts/python decoupe.py [--couleur] [type…]   →  public/silhouettes/<type>.webp
#
# Les voitures sortent en « fantôme » gris très pâle, toutes du même ton : exactement l'aspect
# de l'image d'attente avant le choix (demande d'Alexandre, 2026-10-18 : « toutes les voitures
# sélectionnées dans ce type de forme grise », puis « c'est pas la même chose » devant un gris
# plus soutenu) ; --couleur garde les couleurs des photos.
#
# Repère commun : 1040 × 420 px, voiture centrée, au plus 1000 × 370, roues posées sur y = 390.
import os, sys
import cv2
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage

ICI = os.path.dirname(os.path.abspath(__file__))
IMAGES = os.path.join(ICI, 'photos')
SORTIE = os.path.join(ICI, '..', '..', 'public', 'silhouettes')
APERCU = os.path.join(ICI, 'decoupe')
os.makedirs(APERCU, exist_ok=True)

LARGEUR, HAUTEUR, SOL = 1040, 420, 390
COULEUR = '--couleur' in sys.argv
TYPES = [t for t in sys.argv[1:] if not t.startswith('--')]

# photo → (type, réglages). Par défaut : photo de studio sur fond blanc, trous bouchés (vitres).
#   trous=False   garde les ajours (roues à rayons, cadre d'une moto) au lieu de les boucher
#   fond_blanc=False   photo sur un autre fond : pas de retrait du blanc sur les bords
#   sol=y         la ligne du sol à la main, quand les roues ne se trouvent pas toutes seules
#   rayon_min=r   roues plus petites que 6 % de la largeur de la photo (camion à grande caisse)
#   sol='bas'     le sol au point le plus bas de la découpe (le bas des pneus)
#   pente=deg     redresse une photo prise un peu de biais (roues pas à la même hauteur)
PHOTOS = {
    '26.jpg': ('citadine', {}),
    '20.jpg': ('citadine_2p', {}),
    '22.jpg': ('berline', {}),
    '24.jpg': ('SUV', {}),
    '21.jpg': ('monospace', {}),
    '23.jpg': ('7places', {}),
    '25.jpg': ('utilitaire', {}),
    # Ajoutées le 2026-10-19 : une moto de studio (avec son reflet au sol) et un camion à
    # caisse photographié dehors.
    '29.png': ('moto', {'trous': False, 'fond_blanc': False}),
    '30.png': ('camion', {'fond_blanc': False, 'sol': 267}),
    # Ajouté le 2026-10-19 : camping-car photographié dehors, roue avant 19 px plus haute.
    '34.png': ('camping-car', {'fond_blanc': False, 'pente': -1.85, 'sol': 'bas'}),
}


def roues(gris, masque, rayon_min=0.06):
    """Les deux roues (cercles) : leur bas donne le sol, sous lequel il n'y a que de l'ombre."""
    h, w = masque.shape
    cercles = cv2.HoughCircles(cv2.medianBlur(gris, 5), cv2.HOUGH_GRADIENT, dp=1.2, minDist=w * 0.35,
                               param1=120, param2=28, minRadius=int(w * rayon_min), maxRadius=int(w * 0.13))
    if cercles is None:
        return []
    c = sorted(cercles[0], key=lambda k: -k[1])
    gauche = [k for k in c if k[0] < w / 2][:1]
    droite = [k for k in c if k[0] >= w / 2][:1]
    return gauche + droite


# Répartition des gris visée, du plus sombre au plus clair : la part de la voiture (0 à 1) sous
# chaque gris. Les pneus et les vitres restent sombres, la carrosserie gris clair.
PARTS = [0, 0.04, 0.12, 0.25, 0.50, 0.80, 0.97, 1]
GRIS = [0.16, 0.27, 0.43, 0.60, 0.74, 0.83, 0.92, 0.97]
CAISSE = 0.74   # gris de la carrosserie (luminance médiane), le même sur toutes les voitures
PENTE = 0.78    # contraste conservé de la photo


def en_gris(rgb, opaque):
    """La voiture en gris clair, du même ton quelle que soit sa couleur (une voiture bleu foncé
    et un utilitaire blanc finissent dans le même gris). Moitié-moitié entre :
    - la photo en gris, recalée pour que sa carrosserie (luminance médiane) tombe sur CAISSE :
      garde le modelé, mais pas l'écart des sombres d'une voiture à l'autre ;
    - le gris du rang de chaque pixel dans la voiture (PARTS → GRIS) : même répartition des
      gris partout, mais grossit le grain des grandes surfaces unies (utilitaire blanc)."""
    lum = (rgb @ np.array([0.2126, 0.7152, 0.0722])) / 255
    valeurs = np.sort(lum[opaque])
    mediane = valeurs[valeurs.size // 2]
    recale = CAISSE + (lum - mediane) * PENTE
    rangs = np.linspace(0, 1, valeurs.size)
    valeurs, premiers = np.unique(valeurs, return_index=True)
    par_rang = np.interp(lum, valeurs, np.interp(rangs[premiers], PARTS, GRIS))
    gris = np.clip(0.5 * recale + 0.5 * par_rang, 0, 1)
    return np.repeat((fantome(gris) * 255)[:, :, None], 3, axis=2)


def fantome(gris):
    """Le gris pâli comme l'était l'image d'attente : contraste à 70 %, puis posée à 14 %
    d'opacité sur le blanc de la carte — mais opaque, pour que la tranche 3D ne se voie pas
    au travers."""
    return 1 - 0.14 * (1 - ((gris - 0.5) * 0.7 + 0.5))


def traiter(fichier, nom, reglages, session):
    im = Image.open(os.path.join(IMAGES, fichier)).convert('RGB')
    if 'pente' in reglages:
        im = im.rotate(reglages['pente'], resample=Image.BICUBIC, fillcolor=(255, 255, 255))
    rgb = np.array(im).astype(np.float32)
    alpha = np.array(remove(im, session=session, only_mask=True, post_process_mask=False)).astype(np.float32) / 255

    # La plus grande zone d'un seul tenant ; ses trous (vitres que le détourage croit
    # transparentes) sont bouchés, opaques.
    plein = alpha > 0.5
    etiq, n = ndimage.label(plein)
    if n > 1:
        tailles = ndimage.sum(plein, etiq, range(1, n + 1))
        plein = etiq == (1 + int(np.argmax(tailles)))
    bouche = ndimage.binary_fill_holes(plein) if reglages.get('trous', True) else plein
    proche = ndimage.binary_dilation(bouche, iterations=3)
    alpha = np.where(bouche & ~plein, 1.0, alpha) * proche

    # Le sol : rien sous le bas des pneus (l'ombre portée de la photo).
    rs = roues(cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY), bouche, reglages.get('rayon_min', 0.06))
    if reglages.get('sol') == 'bas':
        sol = int(np.nonzero(bouche.any(axis=1))[0].max())
        alpha[sol + 1:, :] = 0
        print(f'  {nom}: sol {sol} (point le plus bas)')
    elif 'sol' in reglages:
        alpha[reglages['sol'] + 1:, :] = 0
        print(f'  {nom}: sol {reglages["sol"]} (à la main)')
    elif len(rs) == 2:
        sol = int(round(max(r[1] + r[2] for r in rs)))
        alpha[sol + 1:, :] = 0
        print(f'  {nom}: roues {[(int(x), int(y), int(r)) for x, y, r in rs]}, sol {sol}')
    else:
        print(f'  {nom}: roues non trouvées')

    # Les bords mi-transparents mêlent la voiture au fond blanc : on retire ce blanc, sans
    # quoi un liseré clair apparaît sur fond sombre.
    a = np.clip(alpha, 0, 1)[:, :, None]
    sur = np.where(a > 0.02, a, 1)
    couleur = np.clip((rgb - (1 - a) * 255) / sur, 0, 255)
    couleur = np.where(a > 0.97, rgb, couleur)
    if not reglages.get('fond_blanc', True):
        couleur = rgb
    if not COULEUR:
        couleur = en_gris(couleur, a[:, :, 0] > 0.5)
    rgba = np.dstack([couleur, a[:, :, 0] * 255]).round().astype(np.uint8)

    out = Image.fromarray(rgba, 'RGBA')
    out = out.crop(out.getbbox())
    w, h = out.size
    k = min(1000 / w, 370 / h)
    out = out.resize((round(w * k), round(h * k)), Image.LANCZOS)
    cadre = Image.new('RGBA', (LARGEUR, HAUTEUR), (0, 0, 0, 0))
    cadre.alpha_composite(out, ((LARGEUR - out.width) // 2, SOL - out.height))
    chemin = os.path.join(SORTIE, f'{nom}.webp')
    cadre.save(chemin, 'WEBP', quality=84, alpha_quality=90, method=6)
    cadre.save(os.path.join(APERCU, f'{nom}.png'))
    print(nom, out.size, f'{os.path.getsize(chemin) / 1024:.0f} Ko')


session = new_session('isnet-general-use')
for fichier, (nom, reglages) in PHOTOS.items():
    if TYPES and nom not in TYPES:
        continue
    traiter(fichier, nom, reglages, session)

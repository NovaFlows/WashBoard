# Véhicules de la page de réservation : la voiture détourée de sa photo, posée dans le repère
# commun (demande d'Alexandre, 2026-10-18 : « on ne fait plus les silhouettes, on essaie avec
# les voitures segmentées »). Photos de profil qu'il a choisies (MG3, Aygo X, Audi A8, Lexus,
# Grand Scénic, Dacia Jogger, Transit Custom), avant à droite — non versionnées : les déposer
# dans photos/.
#
#   python -m venv venv && venv/Scripts/pip install "rembg[cpu]" opencv-python-headless
#   (environnement à part : rembg tire numpy 2, qui casse les autres outils Python de la machine)
#   venv/Scripts/python decoupe.py [type…]   →  public/silhouettes/<type>.webp
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

PHOTOS = {
    '26.jpg': 'citadine',
    '20.jpg': 'citadine_2p',
    '22.jpg': 'berline',
    '24.jpg': 'SUV',
    '21.jpg': 'monospace',
    '23.jpg': '7places',
    '25.jpg': 'utilitaire',
}


def roues(gris, masque):
    """Les deux roues (cercles) : leur bas donne le sol, sous lequel il n'y a que de l'ombre."""
    h, w = masque.shape
    cercles = cv2.HoughCircles(cv2.medianBlur(gris, 5), cv2.HOUGH_GRADIENT, dp=1.2, minDist=w * 0.35,
                               param1=120, param2=28, minRadius=int(w * 0.06), maxRadius=int(w * 0.13))
    if cercles is None:
        return []
    c = sorted(cercles[0], key=lambda k: -k[1])
    gauche = [k for k in c if k[0] < w / 2][:1]
    droite = [k for k in c if k[0] >= w / 2][:1]
    return gauche + droite


def traiter(fichier, nom, session):
    im = Image.open(os.path.join(IMAGES, fichier)).convert('RGB')
    rgb = np.array(im).astype(np.float32)
    alpha = np.array(remove(im, session=session, only_mask=True, post_process_mask=False)).astype(np.float32) / 255

    # La plus grande zone d'un seul tenant ; ses trous (vitres que le détourage croit
    # transparentes) sont bouchés, opaques.
    plein = alpha > 0.5
    etiq, n = ndimage.label(plein)
    if n > 1:
        tailles = ndimage.sum(plein, etiq, range(1, n + 1))
        plein = etiq == (1 + int(np.argmax(tailles)))
    bouche = ndimage.binary_fill_holes(plein)
    proche = ndimage.binary_dilation(bouche, iterations=3)
    alpha = np.where(bouche & ~plein, 1.0, alpha) * proche

    # Le sol : rien sous le bas des pneus (l'ombre portée de la photo).
    rs = roues(cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY), bouche)
    if len(rs) == 2:
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
for fichier, nom in PHOTOS.items():
    if len(sys.argv) > 1 and nom not in sys.argv[1:]:
        continue
    traiter(fichier, nom, session)

# Silhouettes de la page de réservation, étape 1 : découper la voiture de sa photo (rembg).
# Photos de profil envoyées par Alexandre le 2026-10-18 (MG3, Lexus TZ, Dacia Jogger, Audi A8,
# Grand Scénic, Aygo X, Transit Custom) — non versionnées : les déposer dans photos/.
#
#   python -m venv venv && venv/Scripts/pip install "rembg[cpu]"   (environnement à part :
#   rembg tire numpy 2, qui casse les autres outils Python de la machine)
#   venv/Scripts/python decoupe.py [type…]   →  decoupe/<type>.png, avant du véhicule à droite
# Étape 2 : vectorise.py.
import os, sys
import numpy as np
from PIL import Image, ImageOps
from rembg import remove, new_session
from scipy import ndimage

ICI = os.path.dirname(os.path.abspath(__file__))
IMAGES = os.path.join(ICI, 'photos')
SORTIE = os.path.join(ICI, 'decoupe')
os.makedirs(SORTIE, exist_ok=True)

# image → (type, à retourner pour avoir l'avant à droite)
PHOTOS = {
    '13.png': ('citadine', False),
    '14.png': ('SUV', True),
    '15.png': ('7places', False),
    '16.png': ('berline', False),
    '17.png': ('monospace', True),
    '18.png': ('citadine_2p', True),
    '19.png': ('utilitaire', False),
}
session = new_session('isnet-general-use')
for fichier, (nom, retourner) in PHOTOS.items():
    if len(sys.argv) > 1 and nom not in sys.argv[1:]:
        continue
    im = Image.open(os.path.join(IMAGES, fichier)).convert('RGB')
    decoupe = remove(im, session=session, post_process_mask=True)
    a = np.array(decoupe)[:, :, 3] > 128
    # La plus grande zone d'un seul tenant, trous bouchés (vitres transparentes).
    etiq, n = ndimage.label(a)
    if n > 1:
        tailles = ndimage.sum(a, etiq, range(1, n + 1))
        a = etiq == (1 + int(np.argmax(tailles)))
    a = ndimage.binary_fill_holes(a)
    rgba = np.array(im.convert('RGBA'))
    rgba[:, :, 3] = (a * 255).astype(np.uint8)
    out = Image.fromarray(rgba)
    if retourner:
        out = ImageOps.mirror(out)
    out = out.crop(out.getbbox())
    out.save(os.path.join(SORTIE, f'{nom}.png'))
    print(nom, out.size)

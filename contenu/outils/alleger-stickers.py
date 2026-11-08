# Allège les stickers d'une personne pour le dépôt : 700 px de large, palette 256 couleurs (rendu identique
# sur ces dessins, environ 8 fois plus léger).   python contenu/outils/alleger-stickers.py ryan
import glob
import os
import sys

from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
dossier = os.path.join(ICI, '..', 'stickers', sys.argv[1] if len(sys.argv) > 1 else 'ryan')
total = 0
for f in sorted(glob.glob(os.path.join(dossier, '*.png'))):
    im = Image.open(f).convert('RGBA')
    if im.width > 700:
        im = im.resize((700, round(im.height * 700 / im.width)), Image.LANCZOS)
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(f, optimize=True)
    total += os.path.getsize(f)
    print(os.path.basename(f), round(os.path.getsize(f) / 1000), 'Ko')
print('total', round(total / 1e6, 1), 'Mo')

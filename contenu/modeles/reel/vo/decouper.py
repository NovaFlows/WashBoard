# Découpe la prise continue choisie (prises/<X>.mp3 + sa transcription Scribe prises/<X>.json)
# en répliques, SANS toucher au son : chaque coupe tombe au milieu du silence entre deux phrases,
# donc les morceaux recollés aux instants DEBUTS redonnent exactement l'enregistrement d'origine.
# Écrit out/<id>.wav, durees.json, mots.json et ../video/vo_data.js (MOTS, DUREES, DEBUTS) :
# la timeline de la vidéo se cale sur la voix, pas l'inverse.
#   python decouper.py A
import json
import os
import re
import subprocess
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
X = sys.argv[1]
PRISE = os.path.join(ICI, 'prises', f'{X}.mp3')
mots = [w for w in json.load(open(os.path.join(ICI, 'prises', f'{X}.json'), encoding='utf-8'))['words'] if w.get('type') == 'word']
norme = lambda s: re.sub(r"[^\wà-ÿ']", '', s.lower())
toks = [norme(w['text']) for w in mots]

# deux premiers mots de chaque réplique, cherchés dans l'ordre
DEBUTS_REPLIQUES = [('01', 'un', 'garage'), ('02', 'sur', 'ta'), ('03', 'il', 'coche'), ('04', 'toi', 'tu'),
                    ('05', 'et', 'quand'), ('06', 'envoie', 'ça'), ('07', 'et', 'essaie')]
idx, k = [], 0
for rid, a, b in DEBUTS_REPLIQUES:
    while k < len(toks) - 1 and not (toks[k] == a and toks[k + 1] == b):
        k += 1
    if k >= len(toks) - 1:
        sys.exit(f'réplique {rid} introuvable dans la prise {X}')
    idx.append(k)
    k += 1

duree = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', PRISE],
                             capture_output=True, text=True, check=True).stdout)
coupes = [0.0] + [(mots[i - 1]['end'] + mots[i]['start']) / 2 for i in idx[1:]] + [duree]
os.makedirs(os.path.join(ICI, 'out'), exist_ok=True)
MOTS, DUREES, DEBUTS = {}, {}, {}
for n, (rid, _, _) in enumerate(DEBUTS_REPLIQUES):
    a, b = coupes[n], coupes[n + 1]
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', PRISE, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-ar', '48000', '-ac', '2',
                    os.path.join(ICI, 'out', f'{rid}.wav')], check=True)
    fin = idx[n + 1] if n + 1 < len(idx) else len(mots)
    MOTS[rid] = [(w['text'], round(w['start'] - a, 2), round(w['end'] - a, 2)) for w in mots[idx[n]:fin]]
    DUREES[rid] = round(b - a, 3)
    DEBUTS[rid] = round(a, 3)
    print(rid, f'{a:6.2f} s', ' '.join(m for m, _, _ in MOTS[rid]))
json.dump(DUREES, open(os.path.join(ICI, 'durees.json'), 'w'), indent=1)
json.dump(MOTS, open(os.path.join(ICI, 'mots.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
with open(os.path.join(ICI, '..', 'video', 'vo_data.js'), 'w', encoding='utf-8') as f:
    f.write(f'// Généré par vo/decouper.py depuis la prise continue {X} : instants des mots, durée et début de chaque réplique.\n')
    f.write(f'globalThis.MOTS = {json.dumps(MOTS, ensure_ascii=False)};\nglobalThis.DUREES = {json.dumps(DUREES)};\nglobalThis.DEBUTS = {json.dumps(DEBUTS)};\n')

# Voix off en UNE SEULE prise continue (jamais une prise par réplique) : l'intonation suit tout
# le texte comme un vrai enregistrement. Variante « A » retenue par Alexandre (eleven_v4). La voix est celle
# de la personne indiquée dans contenu/.env (CONTENU_PERSONNE), d'après sa fiche personnes/<nom>.json.
# Retranscrit aussitôt la prise avec Scribe (prises/A.json) pour vérifier chaque mot.
#   python prise.py            -> prises/A.mp3 + prises/A.json
import json
import os
import subprocess
import urllib.request
import uuid

ICI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ICI, 'prises')
os.makedirs(OUT, exist_ok=True)
# Dossier contenu/ du dépôt (celui qui contient personnes/), où que soit ce script.
CONTENU = ICI
while not os.path.isdir(os.path.join(CONTENU, 'personnes')):
    parent = os.path.dirname(CONTENU)
    if parent == CONTENU:
        raise SystemExit('Dossier contenu/ introuvable (personnes/ manquant).')
    CONTENU = parent
# contenu/.env (jamais dans Git) : ELEVENLABS_API_KEY=... et CONTENU_PERSONNE=alexandre | ryan
ENV = dict(l.strip().split('=', 1) for l in open(os.path.join(CONTENU, '.env'), encoding='utf-8') if '=' in l and not l.lstrip().startswith('#'))
KEY = ENV['ELEVENLABS_API_KEY']
PERSONNE = json.load(open(os.path.join(CONTENU, 'personnes', ENV['CONTENU_PERSONNE'].strip() + '.json'), encoding='utf-8'))
VOIX = PERSONNE['voix_elevenlabs']   # voix clonée de la personne qui fait la vidéo
if not VOIX or VOIX.startswith('A_REMPLIR'):
    raise SystemExit(f"Voix ElevenLabs de {PERSONNE['prenom']} pas encore renseignée dans personnes/.")

TEXTE = ("Un garage te confie trois véhicules ? "
         "Sur ta page WashBoard, il les ajoute dans la même réservation : un, deux, trois… et le prix suit tout seul. "
         "Il coche « je réserve pour une entreprise », il met son nom et son Siret. "
         "Toi, tu reçois la demande, tu confirmes. "
         "Et quand tu marques le lavage terminé, sa facture part toute seule, par mail, à son nom. "
         "Envoie ça à un pote laveur. "
         "Et essaie gratuitement : lien en bio !")

# Réglages validés par Alexandre le 2026-11-02 ; une personne peut avoir les siens (« reglages_voix » de sa fiche).
CORPS = {'model_id': PERSONNE.get('modele_voix', 'eleven_v4'), 'text': TEXTE,
         'voice_settings': PERSONNE.get('reglages_voix') or {'stability': 0.4, 'similarity_boost': 0.85, 'style': 0.45, 'use_speaker_boost': True, 'speed': 1.08}}


def generer(nom):
    req = urllib.request.Request(
        f'https://api.elevenlabs.io/v1/text-to-speech/{VOIX}?output_format=mp3_44100_128',
        data=json.dumps(CORPS).encode(), headers={'xi-api-key': KEY, 'Content-Type': 'application/json'})
    chemin = os.path.join(OUT, f'{nom}.mp3')
    with urllib.request.urlopen(req) as r, open(chemin, 'wb') as f:
        f.write(r.read())
    d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', chemin],
                       capture_output=True, text=True).stdout.strip()
    print(nom, CORPS['model_id'], f'{float(d):.2f} s')
    return chemin


def transcrire(chemin, nom):
    b = uuid.uuid4().hex
    corps = (f'--{b}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n'
             f'--{b}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\nfra\r\n'
             f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n').encode()
    corps += open(chemin, 'rb').read() + f'\r\n--{b}--\r\n'.encode()
    req = urllib.request.Request('https://api.elevenlabs.io/v1/speech-to-text', data=corps,
                                 headers={'xi-api-key': KEY, 'Content-Type': f'multipart/form-data; boundary={b}'})
    with urllib.request.urlopen(req) as r:
        d = json.load(r)
    json.dump(d, open(os.path.join(OUT, f'{nom}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('Scribe :', d['text'])


if __name__ == '__main__':
    transcrire(generer('A'), 'A')

# Piste son du TikTok : voix off (vo/out/XX.wav) posée aux instants de video/timeline.js, plus
# des bruitages synthétisés ici même (aucun fichier externe), discrets et rares : la voix reste
# devant. Sortie : audio/mix.wav (48 kHz stéréo), normalisée -14 LUFS pour TikTok.
#   python mix.py
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
SR = 48000
r = np.random.default_rng(11)

tl = json.loads(subprocess.run(['node', '-e', "require('./vo_data.js');const T=require('./timeline.js');console.log(JSON.stringify({VO:T.VO,CUES:T.CUES,DUREE:T.DUREE}))"],
                               cwd=os.path.join(RACINE, 'video'), capture_output=True, text=True, check=True).stdout)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, att, dec):
    """attaque linéaire courte puis décroissance exponentielle (secondes)"""
    tt = np.arange(n) / SR
    a = np.clip(tt / max(att, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(tt - att, 0) / dec)


def filtre(x, f, typ, ordre=2):
    return sosfilt(butter(ordre, f, btype=typ, fs=SR, output='sos'), x)


def bruit(d):
    return r.standard_normal(int(d * SR))


def balayage(f0, f1, d):
    tt = t_(d)
    f = f0 * (f1 / f0) ** (tt / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def son(nom):
    if nom == 'snap':
        n = filtre(bruit(0.05), 2500, 'highpass') * env(int(0.05 * SR), 0.001, 0.008)
        s = np.sin(2 * np.pi * 1900 * t_(0.05)) * env(int(0.05 * SR), 0.001, 0.02)
        return 0.6 * n + 0.5 * s
    if nom == 'tick':
        s = np.sin(2 * np.pi * 3100 * t_(0.03)) * env(int(0.03 * SR), 0.0005, 0.006)
        return 0.5 * s + 0.2 * filtre(bruit(0.03), 4000, 'highpass') * env(int(0.03 * SR), 0.0005, 0.003)
    if nom == 'tap':
        corps = np.sin(2 * np.pi * 220 * t_(0.06)) * env(int(0.06 * SR), 0.001, 0.02)
        corps[:len(son('tick'))] += 0.7 * son('tick')
        return corps
    if nom == 'stop':
        d = 0.18
        b = np.sin(2 * np.pi * 95 * t_(d)) * env(int(d * SR), 0.002, 0.05)
        return 0.9 * b + 0.4 * np.pad(son('snap'), (0, int(d * SR) - len(son('snap'))))
    if nom == 'pin':
        d = 0.22
        s = balayage(720, 170, d) * env(int(d * SR), 0.002, 0.07)
        th = np.sin(2 * np.pi * 70 * t_(d)) * env(int(d * SR), 0.004, 0.06)
        return 0.55 * s + 0.8 * th
    if nom in ('whoosh', 'morph'):
        d = 0.55 if nom == 'whoosh' else 1.0
        n = bruit(d)
        tt = t_(d)
        forme = np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 2
        bas, haut = filtre(n, [300, 1200], 'bandpass'), filtre(n, [1200, 5000], 'bandpass')
        x = (bas * (1 - tt / d) + haut * (tt / d)) * forme
        if nom == 'morph':
            x = 0.7 * x + 0.35 * balayage(220, 660, d) * forme
        return x * 0.7
    if nom == 'draw':
        d = 0.7
        tt = t_(d)
        return filtre(bruit(d), [800, 4000], 'bandpass') * np.sin(np.pi * tt / d) * 0.5
    if nom == 'retract':
        d = 0.85
        tt = t_(d)
        forme = np.sin(np.pi * tt / d) ** 1.5
        return (0.5 * balayage(900, 160, d) + 0.5 * filtre(bruit(d), [600, 3000], 'bandpass')) * forme * 0.6
    if nom == 'car':
        d = 2.4
        tt = t_(d)
        forme = np.clip(tt / 0.3, 0, 1) * np.clip((d - tt) / 0.4, 0, 1)
        moteur = filtre(bruit(d), [60, 260], 'bandpass') * 1.6 + 0.25 * np.sin(2 * np.pi * (62 + 8 * np.sin(2 * np.pi * 0.7 * tt)) * tt)
        return moteur * forme * 0.6
    if nom == 'impact':
        d = 1.4
        tt = t_(d)
        boom = np.sin(2 * np.pi * (48 + 30 * np.exp(-tt / 0.05)) * tt) * env(int(d * SR), 0.003, 0.35)
        brillance = (np.sin(2 * np.pi * 1568 * tt) + 0.6 * np.sin(2 * np.pi * 2349 * tt)) * env(int(d * SR), 0.01, 0.35) * 0.18
        return boom + brillance + 0.3 * np.pad(son('snap'), (0, int(d * SR) - len(son('snap'))))
    if nom == 'blip':
        a = np.sin(2 * np.pi * 880 * t_(0.09)) * env(int(0.09 * SR), 0.002, 0.03)
        b = np.sin(2 * np.pi * 1320 * t_(0.12)) * env(int(0.12 * SR), 0.002, 0.04)
        return np.concatenate([a, b]) * 0.5
    if nom == 'select':
        d = 0.6
        a = np.sin(2 * np.pi * 1046.5 * t_(d)) * env(int(d * SR), 0.003, 0.15)
        b = np.sin(2 * np.pi * 1568 * t_(d)) * env(int(d * SR), 0.003, 0.2)
        return 0.45 * a + 0.4 * np.roll(b, int(0.07 * SR)) * (np.arange(int(d * SR)) > 0.07 * SR)
    raise ValueError(nom)


n = int(tl['DUREE'] * SR) + SR
voix = np.zeros(n)
sfx = np.zeros((n, 2))
for rid, debut in tl['VO'].items():
    sr, x = wavfile.read(os.path.join(RACINE, 'vo', 'out', f'{rid}.wav'))
    x = x.astype(np.float64) / 32768
    x = x.mean(axis=1) if x.ndim == 2 else x
    k = int(debut * SR)
    voix[k:k + len(x)] += x
voix = filtre(voix, 80, 'highpass')
voix /= np.abs(voix).max() + 1e-9

for instant, nom, gain in tl['CUES']:
    s = son(nom)
    s = s / (np.abs(s).max() + 1e-9) * gain * 0.32
    k = int(instant * SR)
    # légère largeur stéréo : un côté retardé de 6 ms
    g = s[: max(0, min(len(s), n - k))]
    sfx[k:k + len(g), 0] += g
    d = int(0.006 * SR)
    sfx[k + d:k + d + len(g), 1] += g[: max(0, min(len(g), n - k - d))]

mix = np.stack([voix, voix], axis=1) * 0.78 + sfx
mix = mix[: int(tl['DUREE'] * SR)]
brut = os.path.join(ICI, 'mix_brut.wav')
wavfile.write(brut, SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', brut, '-af',
                'acompressor=threshold=-18dB:ratio=2.5:attack=8:release=120,loudnorm=I=-14:TP=-1.5:LRA=9',
                '-ar', '48000', os.path.join(ICI, 'mix.wav')], check=True)
print('->', os.path.join(ICI, 'mix.wav'))

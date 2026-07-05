#!/usr/bin/env python3
"""Генерация звуков игры в WAV-файлы (порт рецептов из js/audio.js).

Нужен для фолбэка без Web Audio (iOS Lockdown Mode): там играют только
обычные HTTP-аудиофайлы. Запуск:  python3 tools/gen_audio.py
"""
import math
import os
import random
import struct
import wave

RATE = 16000
OUT = os.path.join(os.path.dirname(__file__), '..', 'audio')


def seg(pts, t):
    if t <= pts[0][0]:
        return pts[0][1]
    for i in range(1, len(pts)):
        if t <= pts[i][0]:
            t0, v0 = pts[i - 1]
            t1, v1 = pts[i]
            return v0 + (v1 - v0) * ((t - t0) / max(1e-6, t1 - t0))
    return pts[-1][1]


def buf(dur):
    return [0.0] * max(1, round(dur * RATE))


def tone(out, f, a, wave_='sine', vib=0.0, vib_hz=6.0, at=0.0):
    ph = 0.0
    off = round(at * RATE)
    for i in range(len(out) - off):
        t = i / RATE
        fr = seg(f, t) * (1 + vib * math.sin(2 * math.pi * vib_hz * t))
        ph += fr / RATE
        p = ph - math.floor(ph)
        if wave_ == 'saw':
            w = 2 * p - 1
        elif wave_ == 'square':
            w = 1.0 if p < 0.5 else -1.0
        elif wave_ == 'triangle':
            w = 4 * p - 1 if p < 0.5 else 3 - 4 * p
        else:
            w = math.sin(2 * math.pi * ph)
        out[i + off] += w * seg(a, t)


def noise(out, f, a, at=0.0):
    lp1 = lp2 = 0.0
    off = round(at * RATE)
    for i in range(len(out) - off):
        t = i / RATE
        k = min(0.95, (seg(f, t) / RATE) * 6.28)
        w = random.random() * 2 - 1
        lp1 += k * (w - lp1)
        lp2 += k * 0.35 * (lp1 - lp2)
        out[i + off] += (lp1 - lp2) * 3 * seg(a, t)


def meow(fs, dur, amp):
    o = buf(dur)
    n = len(fs) - 1
    f = [[dur * i / n, x] for i, x in enumerate(fs)]
    tone(o, f, [[0, 0], [0.04, amp], [dur * 0.6, amp], [dur, 0]], 'saw', vib=0.02)
    tone(o, [[p[0], p[1] * 2] for p in f], [[0, 0], [0.04, amp * 0.35], [dur, 0]], 'triangle')
    return o


def chime(notes):
    o = buf(0.6 + len(notes) * 0.07)
    for i, fq in enumerate(notes):
        tone(o, [[0, fq]], [[0, 0], [0.01, 0.13], [0.5, 0]], at=i * 0.07)
        tone(o, [[0, fq * 2.01]], [[0, 0], [0.01, 0.045], [0.25, 0]], at=i * 0.07)
    return o


def bark(n, hi):
    p = 1.22 if hi else 1.0
    o = buf(0.14 + (n - 1) * 0.17)
    for i in range(n):
        noise(o, [[0, 800 * p], [0.09, 350 * p]], [[0, 0], [0.008, 0.34], [0.09, 0]], at=i * 0.17)
        tone(o, [[0, 175 * p], [0.1, 88 * p]], [[0, 0], [0.012, 0.24], [0.1, 0]], 'square', at=i * 0.17)
    return o


def gen():
    S = {}
    S['meow'] = meow([520, 760, 700, 480], 0.5, 0.26)
    S['mew'] = meow([640, 900, 820], 0.22, 0.2)
    S['angry'] = meow([430, 380, 330, 240], 0.42, 0.27)
    S['squeak'] = meow([880, 1240, 990], 0.16, 0.18)

    o = buf(0.9)
    tone(o, [[0, 620], [0.4, 1050], [0.85, 560]],
         [[0, 0], [0.15, 0.11], [0.6, 0.11], [0.9, 0]], vib=0.012)
    S['whine'] = o

    o = buf(0.16)
    noise(o, [[0, 900], [0.16, 200]], [[0, 0], [0.01, 0.26], [0.16, 0]])
    S['snort'] = o

    o = buf(0.3)
    noise(o, [[0, 1400], [0.12, 900]], [[0, 0], [0.01, 0.09], [0.12, 0]])
    noise(o, [[0, 1100], [0.12, 800]], [[0, 0], [0.01, 0.08], [0.12, 0]], at=0.18)
    S['pant'] = o

    o = buf(0.28)
    tone(o, [[0, 340], [0.24, 72]], [[0, 0], [0.01, 0.3], [0.26, 0]], 'triangle')
    tone(o, [[0, 1300], [0.1, 340]], [[0, 0], [0.008, 0.14], [0.12, 0]])
    S['boing'] = o

    o = buf(0.05)
    noise(o, [[0, 1600], [0.05, 1800]], [[0, 0], [0.005, 0.05], [0.045, 0]])
    S['step'] = o

    o = buf(0.45)
    for i in range(3):
        noise(o, [[0, 950], [0.06, 500]], [[0, 0], [0.008, 0.18], [0.06, 0]], at=i * 0.13)
    S['crunch'] = o

    o = buf(0.5)
    for i in range(3):
        noise(o, [[0, 2100], [0.05, 1300]], [[0, 0], [0.008, 0.07], [0.05, 0]], at=i * 0.15)
        tone(o, [[0, 760], [0.05, 430]], [[0, 0], [0.008, 0.045], [0.05, 0]], at=i * 0.15 + 0.015)
    S['lap'] = o

    o = buf(0.28)
    for i in range(2):
        noise(o, [[0, 1400], [0.05, 800]], [[0, 0], [0.008, 0.09], [0.05, 0]], at=i * 0.16)
    S['nibble'] = o

    o = buf(0.1)
    tone(o, [[0, 520], [0.08, 90]], [[0, 0], [0.006, 0.24], [0.09, 0]])
    S['pop'] = o

    o = buf(0.3)
    noise(o, [[0, 350], [0.3, 2600]], [[0, 0], [0.05, 0.16], [0.3, 0]])
    S['whoosh'] = o

    o = buf(1.6)
    tone(o, [[0, 64], [0.5, 88], [1, 60]], [[0, 0], [0.4, 0.12], [1, 0]])
    noise(o, [[0, 600], [0.4, 250]], [[0, 0], [0.05, 0.05], [0.4, 0]], at=1.15)
    S['snore'] = o

    o = buf(0.34)
    for i, dt in enumerate([0, 0.14, 0.24]):
        tone(o, [[0, 2300 + i * 300], [0.06, 3100 + i * 200]],
             [[0, 0], [0.01, 0.04], [0.07, 0]], at=dt)
    S['tweet'] = o

    o = buf(0.45)
    for i in range(5):
        noise(o, [[0, 500 + random.random() * 1500], [0.05, 400]],
              [[0, 0], [0.006, 0.12], [0.05, 0]], at=i * 0.07)
    S['rattle'] = o

    o = buf(1.6)
    noise(o, [[0, 420], [1.6, 420]], [[0, 0], [0.05, 0.16], [1.55, 0.16], [1.6, 0]])
    for i in range(len(o)):
        t = i / RATE
        o[i] *= 0.55 + 0.45 * math.sin(2 * math.pi * 23 * t)
    S['purr'] = o

    S['bark1l'] = bark(1, False)
    S['bark1h'] = bark(1, True)
    S['bark2l'] = bark(2, False)
    S['bark2h'] = bark(2, True)
    S['chime_std'] = chime([1046, 1318, 1568])
    S['chime_hello'] = chime([1046, 1568])
    S['chime_mode'] = chime([784, 988])
    S['chime_win'] = chime([1568, 2093, 2637])

    o = buf(1.2)
    for i, fq in enumerate([523, 659, 784, 1046, 784, 1046]):
        tone(o, [[0, fq]], [[0, 0], [0.015, 0.18], [0.22, 0]], 'triangle', at=i * 0.11)
    noise(o, [[0, 3000], [0.5, 6000]], [[0, 0], [0.05, 0.05], [0.5, 0]], at=0.5)
    for i, fq in enumerate([1568, 2093, 2637]):
        tone(o, [[0, fq]], [[0, 0], [0.01, 0.12], [0.5, 0]], at=0.55 + i * 0.07)
    S['fanfare'] = o

    S['_silent'] = buf(0.8)
    return S


def write_wav(path, data):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        frames = bytearray()
        for s in data:
            v = max(-1.0, min(1.0, s * 0.85))
            frames += struct.pack('<h', int(v * 32767))
        w.writeframes(bytes(frames))


def main():
    random.seed(7)  # воспроизводимость
    os.makedirs(OUT, exist_ok=True)
    names = []
    total = 0
    for name, data in gen().items():
        p = os.path.join(OUT, name + '.wav')
        write_wav(p, data)
        names.append(name)
        total += os.path.getsize(p)
    print(f'wav: {len(names)} файлов, {total // 1024}KB')

    # iOS Lockdown Mode не декодирует WAV/PCM — нужен AAC (.m4a).
    # afconvert есть на любом macOS.
    import shutil
    import subprocess
    if shutil.which('afconvert'):
        total_m4a = 0
        for name in names:
            src = os.path.join(OUT, name + '.wav')
            dst = os.path.join(OUT, name + '.m4a')
            subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', src, dst],
                           check=True, capture_output=True)
            total_m4a += os.path.getsize(dst)
        print(f'm4a: {len(names)} файлов, {total_m4a // 1024}KB')
    else:
        print('afconvert не найден — .m4a не сгенерированы')


if __name__ == '__main__':
    main()

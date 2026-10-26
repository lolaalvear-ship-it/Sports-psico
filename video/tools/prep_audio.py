#!/usr/bin/env python3
"""Ajusta la duración de una narración sin tocar el tono de la voz.

1. Recorta las pausas más largas que --max-pause (deja --max-pause de silencio, centrado).
   Las pausas que empiezan cerca de un instante de --keep se conservan enteras
   (por ejemplo, una pausa dramática antes de la última frase).
2. Aplica atempo (--tempo, 1.0 = sin cambio) y normaliza el volumen a -14 LUFS.

Uso: python3 tools/prep_audio.py voz.mp3 salida.wav [--max-pause 0.45] [--keep 60.5] [--tempo 1.03]
"""
import argparse, re, subprocess, tempfile, wave
from pathlib import Path
import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("out")
    ap.add_argument("--max-pause", type=float, default=0.45)
    ap.add_argument("--keep", type=float, action="append", default=[], help="inicio aproximado (s) de una pausa a conservar")
    ap.add_argument("--tempo", type=float, default=1.0)
    ap.add_argument("--noise", type=float, default=-35)
    a = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        raw, cut = Path(tmp) / "raw.wav", Path(tmp) / "cut.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.audio, "-ac", "1", "-ar", "44100", str(raw)], check=True)
        with wave.open(str(raw)) as w:
            sr = w.getframerate()
            x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        log = subprocess.run(["ffmpeg", "-i", str(raw), "-af", f"silencedetect=noise={a.noise}dB:d=0.18", "-f", "null", "-"],
                             capture_output=True, text=True).stderr
        st = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", log)]
        en = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", log)]
        parts, cur, half = [], 0.0, a.max_pause / 2
        for s, e in zip(st, en):
            if e - s <= a.max_pause or e >= len(x) / sr - 0.05 or any(abs(s - k) < 0.4 for k in a.keep):
                continue
            parts.append(x[int(cur * sr):int((s + half) * sr)])
            cur = e - half
        parts.append(x[int(cur * sr):])
        y = np.concatenate(parts)
        with wave.open(str(cut), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(y.tobytes())
        af = ([f"atempo={a.tempo}"] if a.tempo != 1.0 else []) + ["loudnorm=I=-14:TP=-1.5:LRA=11"]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(cut), "-af", ",".join(af), "-ar", "44100", a.out], check=True)
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.out],
                         capture_output=True, text=True).stdout.strip()
    print(f"{len(x) / sr:.2f}s -> pausas recortadas {len(y) / sr:.2f}s -> final {float(dur):.2f}s")


if __name__ == "__main__":
    main()

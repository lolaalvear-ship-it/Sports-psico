#!/usr/bin/env python3
"""Añade efectos de sonido sintetizados (sin bancos de sonido ni licencias) y mezcla con la voz.

  python3 tools/sfx.py <slug> [--volumen -16] [--sin-golpes]

Lee reels/<slug>/timeline.json (tras tools/sync.py) y reels/<slug>/audio/voz_final.wav:
  · «whoosh» en cada cambio de escena (ruido filtrado con barrido);
  · golpe grave suave en cada marca de palabra clave (salvo --sin-golpes).
En timeline.json, una escena con "sfx": false no lleva whoosh, y una marca cuyo nombre empieza por "_" no lleva golpe.
Escribe audio/sfx.wav (solo efectos) y audio/mezcla.wav (voz + efectos, normalizado a -14 LUFS),
que render.mjs usa automáticamente.
"""
import argparse, json, subprocess, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 44100


def whoosh(dur=0.55, seed=0):
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    x = r.standard_normal(n)
    t = np.linspace(0, 1, n)
    # paso-bajo de un polo cuyo corte sube y baja: el ruido «pasa» de grave a agudo y vuelve
    fc = 300 + 2600 * np.sin(np.pi * t) ** 2
    y = np.zeros(n); lp = 0.0
    for i in range(n):
        lp += (1 - np.exp(-2 * np.pi * fc[i] / SR)) * (x[i] - lp)
        y[i] = lp
    env = np.sin(np.pi * t) ** 1.6
    y = y * env
    return y / (np.abs(y).max() + 1e-9)


def thump(dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 95 * np.exp(-t * 9) + 45
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * 11)
    click = np.random.default_rng(1).standard_normal(n) * np.exp(-t * 300) * 0.25
    y = y + click
    return y / np.abs(y).max()


def place(buf, clip, t, gain):
    i = int(t * SR)
    if i < 0:
        clip, i = clip[-i:], 0
    j = min(len(buf), i + len(clip))
    if j > i:
        buf[i:j] += clip[:j - i] * gain


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--volumen", type=float, default=-16, help="dB de los efectos respecto a la voz")
    ap.add_argument("--sin-golpes", action="store_true")
    a = ap.parse_args()
    base = ROOT / "reels" / a.slug
    tl = json.loads((base / "timeline.json").read_text(encoding="utf-8"))
    voice = base / "audio" / "voz_final.wav"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(voice), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    v = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768
    n = max(len(v), int(tl["duration"] * SR) + SR)
    fx = np.zeros(n)
    g = 10 ** (a.volumen / 20) * np.sqrt(np.mean(v ** 2)) / 0.3  # relativo al nivel medio de la voz
    for i, sc in enumerate(tl["scenes"]):
        if i > 0 and sc.get("sfx", True):
            w = whoosh(seed=i)
            place(fx, w, sc["start"] - len(w) / SR * 0.6, g * 0.9)
        if not a.sin_golpes:
            for k, mt in (sc.get("marks") or {}).items():
                if not k.startswith("_"):
                    place(fx, thump(), sc["start"] + mt, g * 1.1)
    mix = np.zeros(n); mix[:len(v)] = v; mix += fx
    for name, data in (("sfx.wav", fx), ("_mezcla_raw.wav", mix)):
        with wave.open(str(base / "audio" / name), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(data, -1, 1) * 32767).astype(np.int16).tobytes())
    tmp = base / "audio" / "_mezcla_raw.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR),
                    str(base / "audio" / "mezcla.wav")], check=True)
    tmp.unlink()
    print("OK ->", base / "audio" / "mezcla.wav")


if __name__ == "__main__":
    main()

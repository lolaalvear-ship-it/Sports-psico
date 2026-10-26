#!/usr/bin/env python3
"""Crea la carpeta de un reel nuevo a partir de reels/_plantilla.

  python3 tools/nuevo_reel.py <slug> "Título del reel"

Deja en reels/<slug>/: scenes.js (escenas de ejemplo para reescribir), reel.json, timeline.json provisional
y narracion.txt vacía, más FUENTES.md, GUION.md y POST.md para rellenar durante el flujo.
"""
import json, re, shutil, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

if len(sys.argv) < 3 or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", sys.argv[1]):
    sys.exit('Uso: python3 tools/nuevo_reel.py <slug-en-minusculas> "Título"')
slug, titulo = sys.argv[1], sys.argv[2]
dst = ROOT / "reels" / slug
if dst.exists():
    sys.exit(f"Ya existe {dst}")
shutil.copytree(ROOT / "reels" / "_plantilla", dst, ignore=shutil.ignore_patterns("output", "audio"))
(dst / "audio").mkdir()
cfg = json.loads((dst / "reel.json").read_text(encoding="utf-8"))
cfg["titulo"] = titulo
(dst / "reel.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(dst / "narracion.txt").write_text("", encoding="utf-8")
hoy = date.today().isoformat()
(dst / "FUENTES.md").write_text(f"# Fuentes · {titulo}\n\n_Aprobadas el {hoy}._\n\n", encoding="utf-8")
(dst / "GUION.md").write_text(f"# Guion · {titulo}\n\n", encoding="utf-8")
(dst / "POST.md").write_text(f"# Texto del post · {titulo}\n\n", encoding="utf-8")
print("OK ->", dst)

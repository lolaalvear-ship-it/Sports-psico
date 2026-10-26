# Reels de psicología con fuentes

Este repositorio produce reels verticales (1080×1920) de divulgación con evidencia científica, dibujados por código.

- Para crear un reel nuevo («hazme un vídeo sobre…») sigue la skill `reel` (`.claude/skills/reel/SKILL.md`):
  fuentes en PubMed → guion con tres ganchos → voz con ElevenLabs → apertura A/B → vídeo, portada y texto del post.
  Tiene cuatro aprobaciones obligatorias; no te las saltes.
- Motor compartido: `video/engine/`. Reels nuevos: `video/reels/<slug>/`. Marca personal: `video/marca.json`.
- Los tres primeros Shorts (`video/src*/`, `docs/`) son anteriores al motor compartido; se renderizan con `--src`.
- Nunca pongas en pantalla ni en la narración un dato que no esté en el `FUENTES.md` aprobado del reel.
- No publiques ni programes nada en redes sin que la persona lo pida.
- La clave de ElevenLabs va en `video/.env` (ignorado por git), nunca en un archivo versionado.

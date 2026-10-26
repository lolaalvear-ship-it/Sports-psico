import * as THREE from 'three';
import { smooth } from './math';
import { drawBackground, drawBadge, drawCaption, drawFooter, drawLabels, drawLegend, drawPost, drawTitle, type Ctx2, type ScreenLabel } from './overlay';
import type { AssetResolver, SceneRuntime } from './runtime';
import { SCENE_BUILDERS } from './scenes';
import { getStyle } from './styles';
import type { Project, Scene } from './types';

export const TRANSITION = 0.6;

export interface TimelineItem { scene: Scene; index: number; start: number; end: number }

export function timeline(p: Project): TimelineItem[] {
  let t = 0;
  return p.scenes.map((scene, index) => {
    const item = { scene, index, start: t, end: t + scene.duration };
    t += scene.duration;
    return item;
  });
}
export const projectDuration = (p: Project) => p.scenes.reduce((s, x) => s + x.duration, 0);

export function outputSize(aspect: Project['aspect'], shortSide: number) {
  const long = Math.round((shortSide * 16) / 9 / 2) * 2;
  return aspect === '9:16' ? { w: shortSide, h: long } : { w: long, h: shortSide };
}

/**
 * Motor híbrido: cada escena 3D se dibuja con WebGL y se compone en un lienzo 2D
 * junto con fondo, textos, etiquetas y posproceso. El resultado es una función pura
 * del tiempo: render(t) siempre produce el mismo fotograma.
 */
export class Engine {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gl: THREE.WebGLRenderer;
  private project: Project | null = null;
  private runtimes = new Map<string, { sig: string; rt: SceneRuntime }>();
  private building: Promise<void> = Promise.resolve();
  W = 0;
  H = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Este navegador no permite dibujar en canvas 2D.');
    this.ctx = ctx;
    const glCanvas = document.createElement('canvas');
    this.gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(1);
    this.gl.setClearColor(0x000000, 1);
  }

  setSize(w: number, h: number) {
    if (w === this.W && h === this.H) return;
    this.W = w;
    this.H = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.setSize(w, h, false);
  }

  /** Construye (o reutiliza) las escenas 3D del proyecto. */
  setProject(p: Project, assets: AssetResolver) {
    this.project = p;
    const styleId = p.styleId;
    this.building = this.building.then(async () => {
      const keep = new Set<string>();
      for (const s of p.scenes) {
        const sig = JSON.stringify([s.kind, s.params, s.camera, styleId]);
        keep.add(s.id);
        const cur = this.runtimes.get(s.id);
        if (cur && cur.sig === sig) continue;
        cur?.rt.dispose();
        this.runtimes.delete(s.id);
        const rt = await SCENE_BUILDERS[s.kind]({ scene: s, style: getStyle(styleId), assets });
        this.runtimes.set(s.id, { sig, rt });
        // compila los shaders ahora para que la reproducción no tenga tirones
        this.gl.compile(rt.scene, rt.camera);
      }
      for (const [id, v] of this.runtimes) if (!keep.has(id)) { v.rt.dispose(); this.runtimes.delete(id); }
    });
    return this.building;
  }

  ready() {
    return this.building;
  }

  get duration() {
    return this.project ? projectDuration(this.project) : 0;
  }

  private drawScene(item: TimelineItem, lt: number, alpha: number) {
    const entry = this.runtimes.get(item.scene.id);
    if (!entry || alpha <= 0) return null;
    const { rt } = entry;
    const scene = item.scene;
    rt.camera.aspect = this.W / this.H;
    rt.camera.userData.pointScale = Math.min(this.W, this.H) / 1080;
    rt.camera.updateProjectionMatrix();
    rt.update(lt, scene.duration);
    this.gl.render(rt.scene, rt.camera);
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter'; // escenas emisivas sobre fondo oscuro
    c.globalAlpha = alpha;
    c.drawImage(this.gl.domElement, 0, 0);
    c.restore();
    return rt;
  }

  private project3D(v: THREE.Vector3, cam: THREE.Camera) {
    const p = v.clone().project(cam);
    return { x: (p.x * 0.5 + 0.5) * this.W, y: (-p.y * 0.5 + 0.5) * this.H, visible: p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05 };
  }

  render(t: number, frame = Math.round(t * 30)) {
    const p = this.project;
    if (!p || !this.W) return;
    const style = getStyle(p.styleId);
    const x: Ctx2 = { c: this.ctx, W: this.W, H: this.H, u: Math.min(this.W, this.H) / 1080, style };
    drawBackground(x);
    const tl = timeline(p);
    const total = projectDuration(p);
    t = Math.max(0, Math.min(t, total - 1e-3));
    const i = Math.max(0, tl.findIndex((it) => t >= it.start && t < it.end));
    const cur = tl[i];
    if (!cur) return;
    const lt = t - cur.start;
    // transición: la escena anterior sigue moviéndose mientras se funde con la nueva
    const k = i > 0 ? smooth(0, TRANSITION, lt) : 1;
    if (k < 1) this.drawScene(tl[i - 1], t - tl[i - 1].start, 1 - k);
    const rt = this.drawScene(cur, lt, k);

    const s = cur.scene;
    drawPost(x, frame);
    drawTitle(x, s.title, s.params.subtitle, lt, s.duration, s.kind === 'title');
    if (rt && s.showLabels) {
      const labels: ScreenLabel[] = rt.labels().map((l) => ({ ...this.project3D(l.pos, rt.camera), text: l.text, color: l.color }));
      drawLabels(x, labels, lt, s.duration);
      drawLegend(x, rt.legend?.() ?? [], lt, s.duration);
    }
    drawCaption(x, s.caption, lt, s.duration);
    drawBadge(x, 'Representación conceptual', s.conceptual ? smooth(0.2, 0.8, lt) * (1 - smooth(s.duration - 0.4, s.duration, lt)) : 0);
    if (i === tl.length - 1) drawFooter(x, p.citations, smooth(0.8, 1.6, lt));

    // fundido desde y hacia negro
    const fade = Math.min(smooth(0, 0.4, t), 1 - smooth(total - 0.5, total, t));
    if (fade < 1) {
      this.ctx.fillStyle = `rgba(0,0,0,${1 - fade})`;
      this.ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  dispose() {
    for (const v of this.runtimes.values()) v.rt.dispose();
    this.runtimes.clear();
    this.gl.dispose();
  }
}

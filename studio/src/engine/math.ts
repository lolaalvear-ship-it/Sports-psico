export const TAU = Math.PI * 2;

/** Generador pseudoaleatorio determinista (mulberry32): mismo seed, misma animación. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const frac = (x: number) => x - Math.floor(x);
export const smooth = (e0: number, e1: number, x: number) => {
  const k = clamp((x - e0) / (e1 - e0));
  return k * k * (3 - 2 * k);
};
export const easeInOut = (k: number) => {
  k = clamp(k);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
/** Entra en [a, a+fade] y sale en [b-fade, b]. */
export const window01 = (t: number, a: number, b: number, fade = 0.5) =>
  smooth(a, a + fade, t) * (1 - smooth(b - fade, b, t));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

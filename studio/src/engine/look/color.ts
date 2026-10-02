// Colour in OKLCH. Shade and light tones are computed from a base colour and the scene's light,
// so a film never has a hand-picked shadow colour that drifts from the rest.

export interface Lch {
  l: number; // 0..1
  c: number; // chroma, roughly 0..0.37
  h: number; // hue in degrees
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const toGamma = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const q = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return `#${q(r)}${q(g)}${q(b)}`;
}

export function toLch(hex: string): Lch {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function lchToLinear(x: Lch): [number, number, number] {
  const a = x.c * Math.cos((x.h * Math.PI) / 180);
  const b = x.c * Math.sin((x.h * Math.PI) / 180);
  const l = Math.pow(x.l + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(x.l - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(x.l - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLCH to hex. Chroma is reduced until the colour fits in sRGB, so hue and lightness are kept. */
export function fromLch(x: Lch): string {
  let c = Math.max(0, x.c);
  const l = Math.min(1, Math.max(0, x.l));
  for (let i = 0; i < 24; i++) {
    const [r, g, b] = lchToLinear({ l, c, h: x.h });
    if (r >= -0.0005 && r <= 1.0005 && g >= -0.0005 && g <= 1.0005 && b >= -0.0005 && b <= 1.0005) {
      return rgbToHex(toGamma(Math.max(0, r)), toGamma(Math.max(0, g)), toGamma(Math.max(0, b)));
    }
    c *= 0.9;
  }
  const [r, g, b] = lchToLinear({ l, c: 0, h: x.h });
  return rgbToHex(toGamma(Math.max(0, r)), toGamma(Math.max(0, g)), toGamma(Math.max(0, b)));
}

/** Moves hue `h` toward `target` by at most `deg` degrees, the short way round. */
export function hueToward(h: number, target: number, deg: number): number {
  let d = ((target - h + 540) % 360) - 180;
  if (Math.abs(d) < deg) return (target + 360) % 360;
  return (h + Math.sign(d) * deg + 360) % 360;
}

export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a).map(toLinear);
  const y = hexToRgb(b).map(toLinear);
  return rgbToHex(toGamma(x[0] + (y[0] - x[0]) * t), toGamma(x[1] + (y[1] - x[1]) * t), toGamma(x[2] + (y[2] - x[2]) * t));
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bb] = hexToRgb(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bb;
  };
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface SceneLight {
  /** unit vector pointing from a surface toward the key light, in screen space (y down) */
  dir: readonly [number, number];
  /** colour of the key light, e.g. warm morning sun */
  key: string;
  /** colour of the fill light or sky, which tints the shadows */
  ambient: string;
  /** 0..1: how hard the light is (1 = noon sun, 0.5 = overcast). Scales shadow depth. */
  strength: number;
  /** rim-light amount, 0 = none, 1 = full (use against dark or hazy backgrounds) */
  rim?: number;
}

/**
 * A first choice for the unlit partner of a sunlit surface (`wall` for `wall.sun`): what that surface looks like
 * where only the sky reaches it. About three-quarters as light, half the colour, the hue turned toward the ambient.
 * (The room of the first film: 0.71 to 0.9 of the lightness, 0.2 to 0.75 of the chroma.) It is a starting point:
 * look at the pair in a still and change the three numbers until the shade reads as shade and not as another paint.
 */
export function unlit(sun: string, light: SceneLight, o: { l?: number; c?: number; hue?: number } = {}): string {
  const x = toLch(sun);
  return fromLch({ l: x.l * (o.l ?? 0.75), c: x.c * (o.c ?? 0.5), h: hueToward(x.h, toLch(light.ambient).h, o.hue ?? 40) });
}

export interface Tones {
  base: string;
  shade: string;
  deep: string; // occlusion: creases, contact
  light: string;
  rim: string; // the bright edge that faces the key light
}

export interface ToneRecipe {
  shadeDrop: number; // fraction of lightness removed in shadow
  shadeChroma: number;
  shadeHue: number; // degrees toward the ambient hue
  lightLift: number;
  lightChroma: number;
  lightHue: number; // degrees toward the key hue
}

const cache = new Map<string, Tones>();

/** The four tones of a material under a scene light. */
export function tonesOf(base: string, light: SceneLight, recipe: ToneRecipe): Tones {
  const key = `${base}|${light.key}|${light.ambient}|${light.strength}|${recipe.shadeDrop}|${recipe.lightLift}|${recipe.shadeHue}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const b = toLch(base);
  const amb = toLch(light.ambient);
  const k = toLch(light.key);
  const drop = recipe.shadeDrop * (0.6 + 0.4 * light.strength);
  // Warm colours (reds through yellows) darken toward red, the way a painter shades skin and ochre;
  // everything else leans toward the ambient hue the short way round.
  const warm = b.h >= 15 && b.h <= 115;
  // reds barely shift (a red pushed toward magenta turns pink); oranges and yellows shift fully
  const warmK = Math.min(1, Math.max(0.15, (b.h - 25) / 40));
  const shadeHue = (h: number, deg: number) => (warm ? (h - deg * warmK + 360) % 360 : hueToward(h, amb.h, deg));
  // Near-neutral colours have no hue of their own to shift, so their shadows take the ambient colour.
  const wN = 1 - Math.min(1, Math.max(0, (b.c - 0.02) / 0.05));
  const blend = (chromatic: Lch, neutral: Lch): Lch => {
    const ax = chromatic.c * Math.cos((chromatic.h * Math.PI) / 180);
    const ay = chromatic.c * Math.sin((chromatic.h * Math.PI) / 180);
    const bx = neutral.c * Math.cos((neutral.h * Math.PI) / 180);
    const by = neutral.c * Math.sin((neutral.h * Math.PI) / 180);
    const x = ax + (bx - ax) * wN;
    const y = ay + (by - ay) * wN;
    return { l: chromatic.l, c: Math.hypot(x, y), h: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 };
  };
  // (a dark neutral, like black hair, takes much less of the ambient colour than a white wall does)
  const tint = Math.min(1, Math.max(0.25, (b.l - 0.15) / 0.6));
  const shadeL = b.l * (1 - drop);
  const shade = blend(
    { l: shadeL, c: b.c * recipe.shadeChroma, h: shadeHue(b.h, recipe.shadeHue) },
    { l: shadeL, c: (0.008 + 0.016 * light.strength) * tint, h: amb.h },
  );
  const deepL = shadeL * (1 - drop * 0.75);
  const deep = blend(
    { l: deepL, c: b.c * recipe.shadeChroma * 1.05, h: shadeHue(b.h, recipe.shadeHue * 1.6) },
    { l: deepL, c: (0.012 + 0.02 * light.strength) * tint, h: amb.h },
  );
  const liteL = b.l + recipe.lightLift * (1 - b.l);
  const lite = blend(
    { l: liteL, c: b.c * recipe.lightChroma, h: hueToward(b.h, k.h, recipe.lightHue) },
    { l: liteL, c: 0.014, h: k.h },
  );
  // (dark cloth catches less rim light than pale cloth: a bright line down black trousers reads as piping)
  const rimL = b.l + 0.36 * (1 - b.l) * (0.3 + 0.7 * b.l);
  const rim = blend({ l: rimL, c: b.c * 0.8, h: hueToward(b.h, k.h, 18) }, { l: rimL, c: 0.03, h: k.h });
  const out: Tones = { base, shade: fromLch(shade), deep: fromLch(deep), light: fromLch(lite), rim: fromLch(rim) };
  cache.set(key, out);
  return out;
}

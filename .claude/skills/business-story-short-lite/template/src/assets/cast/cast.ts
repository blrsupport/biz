// The cast of the two demos. Stylised people, not likenesses.
// Each differs from the others in build, head shape, hair and at least three things on the face.
import type { Palette } from "../../engine/draw/shape.ts";
import { FIGURE_PALETTE, makeBuild, type Character } from "../../engine/figure/body.ts";
import { FACE_BASE, HEAD_BASE, type HeadForm } from "../../engine/figure/head.ts";
import { smoothstep, type Pt } from "../../engine/geom/vec.ts";

/** Reshapes the base head: overall width, jaw width, how square the chin is, depth of the back of the skull. */
export function headForm(o: { wide?: number; jaw?: number; chin?: number; cheek?: number; back?: number; brow?: number }): HeadForm {
  const wide = o.wide ?? 1;
  const jaw = o.jaw ?? 1;
  const chin = o.chin ?? 1;
  const cheek = o.cheek ?? 1;
  const front: Pt[] = HEAD_BASE.front.map(([x, y]) => {
    const j = smoothstep(0.12, 0.38, y);
    const c = smoothstep(0.4, 0.47, y);
    const k = Math.exp(-((y - 0.2) * (y - 0.2)) / 0.02);
    return [x * wide * (1 + (jaw - 1) * j) * (1 + (chin - 1) * c) * (1 + (cheek - 1) * k), y] as Pt;
  });
  const side: Pt[] = HEAD_BASE.side.map(([z, y]) => {
    if (z < -0.2) return [z * (o.back ?? 1), y] as Pt;
    if (z > 0.3 && y < -0.05 && y > -0.3) return [z + (o.brow ?? 0), y] as Pt;
    return [z, y] as Pt;
  });
  return { front, side, pivot: HEAD_BASE.pivot };
}

export const RAHUL: Character = {
  id: "rahul",
  skin: "skin.rahul",
  build: makeBuild({ wide: 1.08, belly: 0.1, shoulders: 0.95, limb: 1.08, legs: 0.94 }),
  head: {
    form: headForm({ wide: 1.03, jaw: 1.07, chin: 1.25, cheek: 1.04 }),
    face: { ...FACE_BASE, eyeW: 0.038, eyeH: 0.054, browT: 0.02, browArch: 0.024, noseLen: 0.066, noseWing: 0.064, mouthW: 0.115 },
    skin: "skin.rahul",
    hair: {
      mat: "hair",
      // parted on his left; the fringe sweeps down across the forehead to his right
      line: [
        [-180, 0.22],
        [-140, 0.2],
        [-100, 0.14],
        [-80, 0.11],
        [-66, -0.06],
        [-50, -0.17],
        [-25, -0.205],
        [0, -0.245],
        [22, -0.31],
        [40, -0.3],
        [56, -0.2],
        [68, -0.07],
        [80, 0.11],
        [100, 0.14],
        [140, 0.2],
        [180, 0.22],
      ],
      top: 0.09,
      side: 0.055,
      nape: 0.04,
      wave: { n: 5, d: 0.18 },
      lip: 0.016,
    },
  },
  outfit: {
    top: { mat: "kurta", hem: 1.46, sleeve: 1.9, neck: { dip: 0.07 }, ease: 0.02, placket: { to: 0.4, buttons: 3, mat: "kurta" } },
    collar: { mat: "kurta", kind: "band" },
    legs: { mat: "pajama", half: [0.24, 0.185, 0.15], end: 1.93 },
    shoe: { mat: "sandal" },
  },
};

export const VIKAS: Character = {
  id: "vikas",
  skin: "skin.vikas",
  build: makeBuild({ wide: 0.9, deep: 0.9, shoulders: 1.1, limb: 0.9, legs: 1.1, torso: 1.03, arms: 1.05 }),
  head: {
    form: headForm({ wide: 0.95, jaw: 1.04, chin: 1.5, cheek: 0.97, brow: 0.008 }),
    face: { ...FACE_BASE, eyeX: 0.158, eyeW: 0.032, eyeH: 0.045, browT: 0.022, browArch: 0.008, browW: 0.16, noseLen: 0.086, noseWing: 0.054, mouthW: 0.095, mouthY: 0.315 },
    skin: "skin.vikas",
    hair: {
      mat: "hair",
      line: [
        [-180, 0.19],
        [-140, 0.17],
        [-100, 0.12],
        [-82, 0.1],
        [-68, -0.06],
        [-52, -0.22],
        [-30, -0.31],
        [0, -0.31],
        [26, -0.27],
        [50, -0.19],
        [68, -0.06],
        [82, 0.1],
        [100, 0.12],
        [140, 0.17],
        [180, 0.19],
      ],
      top: 0.06,
      side: 0.03,
      nape: 0.02,
      lip: 0.012,
    },
    moustache: { mat: "hair", y: 0.215, w: 0.13, h: 0.05, droop: 0.035 },
    glasses: { mat: "frame", w: 0.1, h: 0.08, lift: 0.045 },
  },
  outfit: {
    top: { mat: "shirt", hem: 1.07, sleeve: 1.1, cuff: { mat: "shirt", from: 0.98, to: 1.13 }, neck: { dip: 0.12, point: true }, ease: 0.012, placket: { to: 1.0, buttons: 4, mat: "shirt" } },
    collar: { mat: "shirt", kind: "wing" },
    legs: { mat: "trousers", half: [0.235, 0.18, 0.15], end: 1.95 },
    shoe: { mat: "shoe" },
  },
};

export const IRAKI: Character = {
  id: "iraki",
  skin: "skin.iraki",
  build: makeBuild({ wide: 1.14, deep: 1.1, chest: 0.06, belly: 0.07, shoulders: 1.05, limb: 1.12, legs: 0.95 }),
  head: {
    form: headForm({ wide: 1.05, jaw: 1.08, chin: 1.3 }),
    face: { ...FACE_BASE, browT: 0.027, browW: 0.165, browArch: 0.012, noseLen: 0.09, noseWing: 0.068, noseTip: 0.14, mouthW: 0.1, mouthY: 0.31 },
    skin: "skin.iraki",
    hair: {
      mat: "hair.iraki",
      line: [
        [0, -0.3],
        [50, -0.2],
        [68, -0.05],
        [82, 0.1],
        [100, 0.12],
        [140, 0.16],
        [180, 0.18],
      ],
      top: 0.02,
      side: 0.03,
      nape: 0.025,
    },
    cap: {
      mat: "cap",
      line: [
        [0, -0.31],
        [60, -0.27],
        [120, -0.21],
        [180, -0.17],
      ],
      grow: 0.028,
      top: 0.035,
    },
    beard: {
      mat: "hair.iraki",
      line: [
        [0, 0.205],
        [25, 0.175],
        [50, 0.13],
        [72, 0.06],
        [88, 0.0],
        [100, 0.02],
      ],
      end: 100,
      grow: 0.035,
      chin: 0.1,
    },
  },
  outfit: {
    top: { mat: "kurta.white", hem: 1.5, sleeve: 1.9, neck: { dip: 0.06 }, ease: 0.02 },
    over: { mat: "waistcoat", from: 0.0, hem: 0.98, neck: { dip: 0.36, point: true }, placket: { to: 0.92, buttons: 3, mat: "waistcoat", tone: "shade" } },
    collar: { mat: "kurta.white", kind: "band" },
    legs: { mat: "pajama", half: [0.25, 0.195, 0.16], end: 1.93 },
    shoe: { mat: "sandal" },
  },
};

export const BUYER: Character = {
  id: "buyer",
  skin: "skin.buyer",
  build: makeBuild({ wide: 0.86, deep: 0.88, limb: 0.86, legs: 1.03, shoulders: 0.96 }),
  head: {
    form: headForm({ wide: 0.92, jaw: 0.96, chin: 1.1, cheek: 0.95 }),
    face: { ...FACE_BASE, eyeX: 0.15, eyeW: 0.033, eyeH: 0.046, browT: 0.016, noseLen: 0.082, noseWing: 0.052, mouthW: 0.092 },
    skin: "skin.buyer",
    hair: {
      mat: "hair",
      line: [
        [0, -0.37],
        [30, -0.34],
        [55, -0.2],
        [70, -0.05],
        [82, 0.08],
        [100, 0.1],
        [140, 0.15],
        [180, 0.17],
      ],
      top: 0.028,
      side: 0.03,
      nape: 0.02,
    },
    moustache: { mat: "hair", y: 0.22, w: 0.105, h: 0.036, droop: 0.02 },
  },
  outfit: {
    top: { mat: "shirt.green", hem: 1.09, sleeve: 0.72, neck: { dip: 0.12, point: true }, ease: 0.014, placket: { to: 1.02, buttons: 4, mat: "shirt.green" } },
    collar: { mat: "shirt.green", kind: "wing" },
    legs: { mat: "trousers.brown", half: [0.225, 0.175, 0.145], end: 1.95 },
    shoe: { mat: "sandal" },
  },
};

// ---- people who are only ever seen as a dark shape: one material, so only the outline matters
const plainHair = (top: number, side: number): Character["head"]["hair"] => ({
  mat: "sil",
  line: [
    [0, -0.32],
    [40, -0.27],
    [62, -0.12],
    [80, 0.08],
    [100, 0.11],
    [140, 0.16],
    [180, 0.18],
  ],
  top,
  side,
  nape: 0.03,
});

/** A porter: lean, bare shins, short sleeves. */
export const PORTER: Character = {
  id: "porter",
  skin: "sil",
  build: makeBuild({ wide: 0.92, deep: 0.9, limb: 0.92, shoulders: 1.02, legs: 1.0 }),
  head: { form: headForm({ wide: 0.96, chin: 1.15 }), face: { ...FACE_BASE }, skin: "sil", hair: plainHair(0.03, 0.03), browMat: "sil" },
  outfit: {
    top: { mat: "sil", hem: 1.12, sleeve: 0.7, neck: { dip: 0.08 }, ease: 0.02 },
    legs: { mat: "sil", half: [0.27, 0.215, 0.19], end: 1.12 },
    shoe: { mat: "sil" },
  },
};

/** The two sons, as their father's shadow imagines them: taller than he is, bare-headed, in shirts and trousers. */
export const SON_A: Character = {
  id: "sonA",
  skin: "sil",
  build: makeBuild({ wide: 0.94, deep: 0.92, shoulders: 1.08, limb: 0.94, legs: 1.1, torso: 1.03, arms: 1.04 }),
  head: { form: headForm({ wide: 0.97, jaw: 1.04, chin: 1.35 }), face: { ...FACE_BASE }, skin: "sil", hair: plainHair(0.07, 0.04), browMat: "sil" },
  outfit: {
    top: { mat: "sil", hem: 1.08, sleeve: 1.9, neck: { dip: 0.1, point: true }, ease: 0.014 },
    legs: { mat: "sil", half: [0.235, 0.18, 0.15], end: 1.95 },
    shoe: { mat: "sil" },
  },
};

export const SON_B: Character = {
  id: "sonB",
  skin: "sil",
  build: makeBuild({ wide: 1.04, deep: 1.0, belly: 0.03, shoulders: 1.02, limb: 1.02, legs: 1.06 }),
  head: { form: headForm({ wide: 1.02, jaw: 1.06, chin: 1.25 }), face: { ...FACE_BASE }, skin: "sil", hair: plainHair(0.045, 0.035), browMat: "sil" },
  outfit: {
    top: { mat: "sil", hem: 1.1, sleeve: 1.9, neck: { dip: 0.1, point: true }, ease: 0.016 },
    legs: { mat: "sil", half: [0.245, 0.19, 0.155], end: 1.95 },
    shoe: { mat: "sil" },
  },
};

export const CAST = { rahul: RAHUL, vikas: VIKAS, iraki: IRAKI, buyer: BUYER, porter: PORTER, sonA: SON_A, sonB: SON_B } as const;

/** Base colours of the cast. Shadow and light tones are computed from these and the scene light. */
export const CAST_PALETTE: Palette = {
  ...FIGURE_PALETTE,
  "skin.rahul": "#c98a5e",
  "skin.vikas": "#b47850",
  "skin.iraki": "#b9794c",
  "skin.buyer": "#c18a62",
  hair: "#241c1e",
  "hair.iraki": "#2c2526",
  kurta: "#d9a233",
  "kurta.white": "#ece3d0",
  pajama: "#e8dcc4",
  shirt: "#3f6fa3",
  "shirt.green": "#a7c39c",
  trousers: "#3b3a48",
  "trousers.brown": "#6a5140",
  waistcoat: "#2f5d46",
  cap: "#f2ecdf",
  sandal: "#5b3d2e",
  shoe: "#2c2a30",
  /** the one flat tone of a figure that is only ever a dark shape (close to the lens, or a shadow on a wall) */
  sil: "#33262a",
};

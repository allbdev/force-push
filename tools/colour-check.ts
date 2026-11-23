/**
 * Colour-blind check of the floor colours (roadmap task 9): simulates protanopia, deuteranopia
 * and tritanopia (Machado, Oliveira & Fernandes 2009, severity 1.0), then measures every pair
 * with CIEDE2000. `npm run colours` prints the table; tests/tools/colour-check.test.ts holds the
 * threshold.
 */
import { BRANCH_COLOURS, BRANCHES, FLOOR_GREY } from "../src/content/branches";

type Rgb = readonly [number, number, number];
type Matrix = readonly [Rgb, Rgb, Rgb];

export const VISIONS: Readonly<Record<string, Matrix | null>> = {
  normal: null,
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Linear-light RGB as a colour-blind viewer would see it. */
export function simulate(rgb: Rgb, m: Matrix | null): Rgb {
  const lin = rgb.map(toLinear) as unknown as Rgb;
  if (!m) return lin;
  return m.map((row) =>
    clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]),
  ) as unknown as Rgb;
}

/** Linear sRGB → CIELAB (D65). */
export function linearToLab([r, g, b]: Rgb): Rgb {
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 colour difference. */
export function deltaE2000(a: Rgb, b: Rgb): number {
  const [L1, a1, b1] = a;
  const [L2, a2, b2] = b;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h = (bb: number, aa: number) => {
    if (bb === 0 && aa === 0) return 0;
    const d = Math.atan2(bb, aa) / rad;
    return d < 0 ? d + 360 : d;
  };
  const h1p = h(b1, a1p);
  const h2p = h(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lpm = (L1 + L2) / 2;
  const Cpm = (C1p + C2p) / 2;
  let hpm = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hpm += h1p + h2p < 360 ? 360 : -360;
    hpm /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hpm - 30) * rad) +
    0.24 * Math.cos(2 * hpm * rad) +
    0.32 * Math.cos((3 * hpm + 6) * rad) -
    0.2 * Math.cos((4 * hpm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2);
  const Sc = 1 + 0.045 * Cpm;
  const Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

export const FLOOR_COLOURS: Readonly<Record<string, string>> = {
  ...BRANCH_COLOURS,
  grey: FLOOR_GREY,
};

export type PairResult = { vision: string; a: string; b: string; deltaE: number };

/** Every pair of floor colours under every vision, smallest difference first. */
export function floorPairs(): PairResult[] {
  const names = [...BRANCHES, "grey"];
  const out: PairResult[] = [];
  for (const [vision, m] of Object.entries(VISIONS)) {
    const lab = new Map(
      names.map((n) => [n, linearToLab(simulate(hexToRgb(FLOOR_COLOURS[n]!), m))]),
    );
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++)
        out.push({
          vision,
          a: names[i]!,
          b: names[j]!,
          deltaE: deltaE2000(lab.get(names[i]!)!, lab.get(names[j]!)!),
        });
  }
  return out.sort((x, y) => x.deltaE - y.deltaE);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const p of floorPairs())
    console.log(
      `${p.vision.padEnd(13)} ${p.a.padEnd(8)} ${p.b.padEnd(8)} ΔE00 ${p.deltaE.toFixed(1)}`,
    );
}

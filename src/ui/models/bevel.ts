/**
 * The shared kit for the code-built models (GAME_PLAN.md §10): "everything is a box with a 3 cm
 * bevel". Geometries and materials are cached at module level so every instance shares them.
 * No DOM here: the builders run in Node for the unit tests.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type Material,
  type Object3D,
} from "three";

/** The bevel at tile scale: 1 tile = 1 unit = 1 m, so 3 cm. */
export const BEVEL = 0.03;

/** Material slots of a bevelled box, for a material array: the four sides, top and bottom, the bevels. */
export const SIDE_SLOT = 0;
export const CAP_SLOT = 1;
export const BEVEL_SLOT = 2;

type Vec = readonly [number, number, number];

const geometries = new Map<string, BufferGeometry>();
const materials = new Map<string, MeshStandardMaterial>();

/** Returns the geometry stored under `key`, building it on first use. */
export function cachedGeometry<T extends BufferGeometry>(key: string, make: () => T): T {
  const hit = geometries.get(key);
  if (hit) return hit as T;
  const made = make();
  geometries.set(key, made);
  return made;
}

/** A 3 cm bevel, less on parts too small to carry it. */
export function bevelFor(width: number, height: number, depth: number): number {
  return Math.min(BEVEL, Math.min(width, height, depth) * 0.25);
}

/**
 * A chamfered box centred on the origin, flat-shaded: 6 faces, 12 bevel strips, 8 corners
 * (44 triangles). Each face carries the whole 0..1 texture, upright and readable from outside.
 */
export function bevelBox(
  width: number,
  height: number,
  depth: number,
  bevel: number = bevelFor(width, height, depth),
): BufferGeometry {
  return cachedGeometry(`bevel|${width}|${height}|${depth}|${bevel}`, () =>
    makeBevelBox(width, height, depth, bevel),
  );
}

function makeBevelBox(w: number, h: number, d: number, b: number): BufferGeometry {
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  const px = (sx: number, sy: number, sz: number): Vec => [sx * hx, sy * (hy - b), sz * (hz - b)];
  const py = (sx: number, sy: number, sz: number): Vec => [sx * (hx - b), sy * hy, sz * (hz - b)];
  const pz = (sx: number, sy: number, sz: number): Vec => [sx * (hx - b), sy * (hy - b), sz * hz];

  const sides: Vec[][] = [];
  const caps: Vec[][] = [];
  const bevels: Vec[][] = [];
  const signs = [-1, 1] as const;
  for (const s of signs) {
    sides.push([px(s, -1, -1), px(s, 1, -1), px(s, 1, 1), px(s, -1, 1)]);
    sides.push([pz(-1, -1, s), pz(1, -1, s), pz(1, 1, s), pz(-1, 1, s)]);
    caps.push([py(-1, s, -1), py(1, s, -1), py(1, s, 1), py(-1, s, 1)]);
  }
  for (const a of signs) {
    for (const c of signs) {
      bevels.push([py(-1, a, c), pz(-1, a, c), pz(1, a, c), py(1, a, c)]);
      bevels.push([px(a, -1, c), pz(a, -1, c), pz(a, 1, c), px(a, 1, c)]);
      bevels.push([px(a, c, -1), py(a, c, -1), py(a, c, 1), px(a, c, 1)]);
      for (const e of signs) bevels.push([px(a, c, e), py(a, c, e), pz(a, c, e)]);
    }
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const geometry = new BufferGeometry();
  // In slot order: SIDE_SLOT, CAP_SLOT, BEVEL_SLOT.
  [sides, caps, bevels].forEach((polygons, slot) => {
    const start = positions.length / 3;
    for (const polygon of polygons) {
      const normal = outwardNormal(polygon);
      if (!normal) continue;
      const points = normal.flipped ? [...polygon].reverse() : polygon;
      for (let i = 1; i < points.length - 1; i++) {
        for (const p of [points[0]!, points[i]!, points[i + 1]!]) {
          positions.push(p[0], p[1], p[2]);
          normals.push(normal.n[0], normal.n[1], normal.n[2]);
          uvs.push(...faceUv(p, normal.n, w, h, d));
        }
      }
    }
    geometry.addGroup(start, positions.length / 3 - start, slot);
  });
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** The unit normal of a convex polygon around the origin, and whether its winding points inward. */
function outwardNormal(points: readonly Vec[]): { n: Vec; flipped: boolean } | null {
  const [a, b, c] = [points[0]!, points[1]!, points[2]!];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
  let n: Vec = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const length = Math.hypot(n[0], n[1], n[2]);
  if (length < 1e-12) return null;
  n = [n[0] / length, n[1] / length, n[2] / length];
  const flipped = n[0] * a[0] + n[1] * a[1] + n[2] * a[2] < 0;
  return { n: flipped ? [-n[0], -n[1], -n[2]] : n, flipped };
}

/** Planar UVs along the face's main axis: text reads left to right from outside, `v` is up. */
function faceUv(p: Vec, n: Vec, w: number, h: number, d: number): [number, number] {
  const ax = Math.abs(n[0]);
  const ay = Math.abs(n[1]);
  const az = Math.abs(n[2]);
  if (ay >= ax && ay >= az) return [0.5 + p[0] / w, 0.5 - p[2] / d];
  if (ax >= az) return [0.5 - (Math.sign(n[0]) * p[2]) / d, 0.5 + p[1] / h];
  return [0.5 + (Math.sign(n[2]) * p[0]) / w, 0.5 + p[1] / h];
}

/** A plain box (12 triangles) for details too small to show a bevel: eyes, drawstrings, screens. */
export function plainBox(width: number, height: number, depth: number): BufferGeometry {
  return cachedGeometry(
    `box|${width}|${height}|${depth}`,
    () => new BoxGeometry(width, height, depth),
  );
}

/** A unit sphere, scaled per mesh. Only the orb, the duck and the mug are round. */
export function unitSphere(widthSegments: number, heightSegments: number): BufferGeometry {
  return cachedGeometry(
    `sphere|${widthSegments}|${heightSegments}`,
    () => new SphereGeometry(1, widthSegments, heightSegments),
  );
}

export function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
): BufferGeometry {
  return cachedGeometry(
    `cylinder|${radiusTop}|${radiusBottom}|${height}|${segments}`,
    () => new CylinderGeometry(radiusTop, radiusBottom, height, segments),
  );
}

export function torus(
  radius: number,
  tube: number,
  radialSegments: number,
  tubularSegments: number,
  arc: number = Math.PI * 2,
): BufferGeometry {
  return cachedGeometry(
    `torus|${radius}|${tube}|${radialSegments}|${tubularSegments}|${arc}`,
    () => new TorusGeometry(radius, tube, radialSegments, tubularSegments, arc),
  );
}

export interface MaterialOptions {
  roughness?: number;
  metalness?: number;
  /** Emissive colour (hex); the material glows in it at `emissiveIntensity`. */
  emissive?: string;
  emissiveIntensity?: number;
}

/** A shared standard material for a colour: the same arguments always return the same object. */
export function material(colour: string, options: MaterialOptions = {}): MeshStandardMaterial {
  const { roughness = 0.75, metalness = 0, emissive = "", emissiveIntensity = 1 } = options;
  const key = `${colour}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}`;
  const hit = materials.get(key);
  if (hit) return hit;
  const made = new MeshStandardMaterial({ color: colour, roughness, metalness });
  if (emissive) {
    made.emissive = new Color(emissive);
    made.emissiveIntensity = emissiveIntensity;
  }
  materials.set(key, made);
  return made;
}

/** A colour made darker (`factor` < 1) or lighter (> 1), as `#rrggbb`. */
export function shade(colour: string, factor: number): string {
  const c = new Color(colour).multiplyScalar(factor);
  c.r = Math.min(1, c.r);
  c.g = Math.min(1, c.g);
  c.b = Math.min(1, c.b);
  return `#${c.getHexString()}`;
}

/** A mesh at a position, casting and receiving shadows. */
export function part(
  geometry: BufferGeometry,
  mat: Material | Material[],
  x = 0,
  y = 0,
  z = 0,
  name = "",
): Mesh {
  const mesh = new Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

export function namedGroup(name: string, x = 0, y = 0, z = 0): Group {
  const group = new Group();
  group.name = name;
  group.position.set(x, y, z);
  return group;
}

/** Triangles drawn for an object and everything under it (hidden parts included). */
export function countTriangles(object: Object3D): number {
  let total = 0;
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const geometry = child.geometry as BufferGeometry;
    const count = geometry.index ? geometry.index.count : geometry.getAttribute("position").count;
    total += count / 3;
  });
  return total;
}

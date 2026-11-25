/**
 * The office around the arena (board "Match", GAME_PLAN.md §10: "carpet tiles, glass walls, desks
 * around the arena"): chairs, plants, glass partitions, workstations, a water cooler and a
 * whiteboard, in the same bevelled-box toy style. `buildOffice` dresses everything outside the
 * floor tiles and merges it into one mesh per material, so the whole office is a dozen draw calls.
 */
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bevelBox, cachedGeometry, material, namedGroup, part, plainBox } from "./bevel";
import { DESK_DEPTH, DESK_HEIGHT, DESK_WIDTH } from "./desk";
import { PixelGrid, seededRandom, type Rgb } from "./pixel-texture";

/** Nothing of the office stands closer than this to the floor tiles (the corner desks live there). */
export const OFFICE_CLEARANCE = 1.9;
export const PARTITION_HEIGHT = 1.05;
export const CHAIR_HEIGHT = 0.62;
export const PLANT_HEIGHT = 0.8;
export const WATER_COOLER_HEIGHT = 0.86;
export const WHITEBOARD_HEIGHT = 1.0;

/** How far the wood floor reaches past the arena on every side. */
const FLOOR_REACH = 40;
/** Wood texture: one repeat covers this many tiles along the planks, and this many across them. */
const WOOD_REPEAT_ALONG = 8;
const WOOD_REPEAT_ACROSS = 2;
const WOOD_SIZE = 64;
const PLANK_PIXELS = 8;
/** Desks and chairs beyond the wall are a little bigger than the players' desks, like the board. */
const FURNITURE_SCALE = 1.25;

const WHITE = "#eef0f4";
const DARK = "#2a2e38";
const CHAIR_COLOUR = "#333a4d";
const SCREEN_COLOURS = ["#9cc4e8", "#a9d6d0", "#c3b8e6"] as const;

let glass: MeshStandardMaterial | null = null;
let wood: MeshStandardMaterial | null = null;

/** The pane of a partition: see-through, so the desks behind it still read. */
export function glassMaterial(): MeshStandardMaterial {
  glass ??= new MeshStandardMaterial({
    color: "#cfeaf6",
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });
  return glass;
}

function paintWood(): PixelGrid {
  const random = seededRandom(0x0ff1ce);
  const grid = new PixelGrid(WOOD_SIZE, WOOD_SIZE);
  const base: Rgb = [186, 171, 146];
  for (let row = 0; row < WOOD_SIZE / PLANK_PIXELS; row++) {
    // Two or three planks per row, joints staggered between rows.
    const joints = [Math.floor(random() * 24), 24 + Math.floor(random() * 20), WOOD_SIZE];
    let start = 0;
    for (const joint of joints) {
      const tone = 0.95 + random() * 0.09;
      const warm = (random() - 0.5) * 6;
      for (let x = start; x < joint; x++) {
        for (let y = 0; y < PLANK_PIXELS; y++) {
          const grain = 1 + (random() - 0.5) * 0.025;
          const edge = y === 0 || x === start ? 0.9 : 1;
          const k = tone * grain * edge;
          grid.set(x, row * PLANK_PIXELS + y, [
            Math.min(255, Math.round((base[0] + warm) * k)),
            Math.min(255, Math.round(base[1] * k)),
            Math.min(255, Math.round((base[2] - warm) * k)),
          ]);
        }
      }
      start = joint;
    }
  }
  return grid;
}

/** Light planks running across the screen, like the board. */
export function woodMaterial(): MeshStandardMaterial {
  if (!wood) {
    const texture = paintWood().toTexture(false);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.anisotropy = 4;
    wood = new MeshStandardMaterial({ map: texture, roughness: 0.82 });
  }
  return wood;
}

/** An office chair on y = 0, facing +z (the back is on the −z side). */
export function buildChair(): Group {
  const chair = namedGroup("chair");
  const fabric = material(CHAIR_COLOUR, { roughness: 0.85 });
  const metal = material(DARK, { roughness: 0.6, metalness: 0.2 });
  for (const turn of [0, Math.PI / 2]) {
    const foot = part(plainBox(0.36, 0.03, 0.05), metal, 0, 0.015, 0, "base");
    foot.rotation.y = turn + Math.PI / 4;
    chair.add(foot);
  }
  chair.add(part(plainBox(0.05, 0.2, 0.05), metal, 0, 0.13, 0, "stem"));
  chair.add(part(bevelBox(0.36, 0.08, 0.36, 0.025), fabric, 0, 0.27, 0, "seat"));
  chair.add(part(plainBox(0.04, 0.12, 0.03), metal, 0, 0.35, -0.17));
  chair.add(
    part(bevelBox(0.34, 0.26, 0.07, 0.025), fabric, 0, CHAIR_HEIGHT - 0.13, -0.175, "back"),
  );
  return chair;
}

/** A potted plant on y = 0: a white pot and a stack of leafy blocks. */
export function buildPlant(): Group {
  const plant = namedGroup("plant");
  const pot = material("#e4e7ec", { roughness: 0.6 });
  const soil = material("#4a3a2e", { roughness: 0.95 });
  const leafDark = material("#2f8f5b", { roughness: 0.8 });
  const leafLight = material("#49b877", { roughness: 0.8 });
  plant.add(part(bevelBox(0.3, 0.26, 0.3), pot, 0, 0.13, 0, "pot"));
  plant.add(part(plainBox(0.24, 0.02, 0.24), soil, 0, 0.262, 0, "soil"));
  const leaves = namedGroup("leaves");
  const blocks: readonly (readonly [number, number, number, number, number, number, number])[] = [
    // width, height, depth, x, y, z, turn
    [0.3, 0.2, 0.3, 0, 0.38, 0, 0.3],
    [0.24, 0.2, 0.22, 0.08, 0.5, -0.04, -0.4],
    [0.2, 0.18, 0.22, -0.09, 0.56, 0.05, 0.7],
    [0.16, 0.16, 0.16, 0.01, 0.72, 0, 0.2],
  ];
  blocks.forEach(([w, h, d, x, y, z, turn], i) => {
    const leaf = part(bevelBox(w, h, d), i % 2 ? leafLight : leafDark, x, y, z);
    leaf.rotation.y = turn;
    leaves.add(leaf);
  });
  plant.add(leaves);
  return plant;
}

/**
 * A glass partition `length` tiles long, centred on the origin and running along x: a thin dark
 * frame around a see-through pane.
 */
export function buildPartition(length = 2): Group {
  const partition = namedGroup("partition");
  const frame = material("#3a4050", { roughness: 0.5, metalness: 0.3 });
  const post = 0.05;
  const frameGroup = namedGroup("frame");
  for (const side of [-1, 1]) {
    frameGroup.add(
      part(
        plainBox(post, PARTITION_HEIGHT, post),
        frame,
        (side * (length - post)) / 2,
        PARTITION_HEIGHT / 2,
        0,
      ),
    );
  }
  frameGroup.add(part(plainBox(length - post * 2, post, post), frame, 0, post / 2, 0));
  frameGroup.add(
    part(plainBox(length - post * 2, post, post), frame, 0, PARTITION_HEIGHT - post / 2, 0),
  );
  partition.add(frameGroup);
  const pane = part(
    plainBox(length - post * 2, PARTITION_HEIGHT - post * 2, 0.015),
    glassMaterial(),
    0,
    PARTITION_HEIGHT / 2,
    0,
    "pane",
  );
  pane.castShadow = false;
  partition.add(pane);
  return partition;
}

/**
 * Somebody else's desk: white top, a monitor with a dim editor on it (never a branch colour: the
 * four bright desks are the players'), a keyboard, and now and then a second screen or a mug.
 * Faces +z like `buildDesk`.
 */
export function buildWorkstation(variant = 0): Group {
  const index = ((Math.trunc(variant) % 3) + 3) % 3;
  const station = namedGroup("workstation");
  const white = material(WHITE, { roughness: 0.6 });
  const dark = material(DARK, { roughness: 0.6, metalness: 0.2 });
  const screenColour = SCREEN_COLOURS[index]!;
  const screen = material(screenColour, {
    roughness: 0.3,
    emissive: screenColour,
    emissiveIntensity: 0.45,
  });
  const top = 0.05;
  station.add(
    part(bevelBox(DESK_WIDTH, top, DESK_DEPTH, 0.012), white, 0, DESK_HEIGHT - top / 2, 0, "top"),
  );
  const leg = DESK_HEIGHT - top;
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      station.add(
        part(
          plainBox(0.05, leg, 0.05),
          dark,
          x * (DESK_WIDTH / 2 - 0.06),
          leg / 2,
          z * (DESK_DEPTH / 2 - 0.06),
        ),
      );
    }
  }
  const monitors = index === 1 ? [-0.2, 0.2] : [index === 0 ? -0.1 : 0.08];
  monitors.forEach((x, i) => {
    const monitor = namedGroup("monitor", x, DESK_HEIGHT, -0.13);
    monitor.add(part(plainBox(0.16, 0.02, 0.1), dark, 0, 0.01, 0));
    monitor.add(part(plainBox(0.035, 0.1, 0.03), dark, 0, 0.07, -0.01));
    monitor.add(part(bevelBox(0.36, 0.23, 0.035, 0.01), dark, 0, 0.225, 0));
    monitor.add(part(plainBox(0.32, 0.19, 0.006), screen, 0, 0.225, 0.018, "screen"));
    monitor.rotation.y = monitors.length > 1 ? (i === 0 ? 0.22 : -0.22) : 0;
    station.add(monitor);
  });
  station.add(part(plainBox(0.26, 0.015, 0.1), dark, monitors[0]!, DESK_HEIGHT + 0.0075, 0.13));
  if (index !== 1) {
    const mug = material(index === 0 ? "#f2f3f5" : "#c9a15a", { roughness: 0.6 });
    station.add(part(bevelBox(0.07, 0.085, 0.07, 0.012), mug, 0.32, DESK_HEIGHT + 0.0425, 0.08));
  }
  return station;
}

/** The water cooler: a white cabinet with a pale blue bottle on top (a box: nothing here is round). */
export function buildWaterCooler(): Group {
  const cooler = namedGroup("water-cooler");
  const white = material(WHITE, { roughness: 0.5 });
  const water = material("#8fd0f0", { roughness: 0.15 });
  const dark = material(DARK, { roughness: 0.6, metalness: 0.2 });
  cooler.add(part(bevelBox(0.32, 0.56, 0.32), white, 0, 0.28, 0, "body"));
  cooler.add(part(plainBox(0.2, 0.1, 0.02), dark, 0, 0.38, 0.165, "tap"));
  cooler.add(
    part(bevelBox(0.24, 0.3, 0.24, 0.04), water, 0, WATER_COOLER_HEIGHT - 0.15, 0, "bottle"),
  );
  return cooler;
}

/** A whiteboard on legs, facing +z, with a few sticky notes and a scribbled diagram. */
export function buildWhiteboard(): Group {
  const whiteboard = namedGroup("whiteboard");
  const white = material("#f7f8fa", { roughness: 0.35 });
  const frame = material("#8f99a3", { roughness: 0.4, metalness: 0.5 });
  const ink = material("#39404f", { roughness: 0.6 });
  const notes = ["#ffe27a", "#ffb3c7", "#b6f0c2"] as const;
  const legs = namedGroup("legs");
  for (const side of [-1, 1]) {
    legs.add(part(plainBox(0.04, WHITEBOARD_HEIGHT - 0.04, 0.04), frame, side * 0.62, 0.48, 0));
    legs.add(part(plainBox(0.05, 0.03, 0.34), frame, side * 0.62, 0.015, 0));
  }
  whiteboard.add(legs);
  whiteboard.add(
    part(bevelBox(1.3, 0.68, 0.04, 0.012), frame, 0, WHITEBOARD_HEIGHT - 0.34, 0, "frame"),
  );
  whiteboard.add(
    part(plainBox(1.22, 0.6, 0.01), white, 0, WHITEBOARD_HEIGHT - 0.34, 0.02, "board"),
  );
  notes.forEach((colour, i) => {
    whiteboard.add(
      part(
        plainBox(0.12, 0.12, 0.006),
        material(colour, { roughness: 0.7 }),
        0.3 + (i % 2) * 0.16,
        WHITEBOARD_HEIGHT - 0.2 - Math.floor(i / 2) * 0.16,
        0.027,
        "note",
      ),
    );
  });
  // Three boxes and two arrows: every architecture diagram ever drawn.
  for (const [x, y, w, h] of [
    [-0.42, 0.78, 0.2, 0.014],
    [-0.42, 0.66, 0.2, 0.014],
    [-0.12, 0.72, 0.2, 0.014],
    [-0.27, 0.72, 0.08, 0.01],
    [-0.42, 0.72, 0.012, 0.12],
    [-0.3, 0.5, 0.44, 0.012],
  ] as const) {
    whiteboard.add(part(plainBox(w, h, 0.004), ink, x, y, 0.026));
  }
  return whiteboard;
}

type Placer = (object: Object3D, x: number, z: number, turn?: number, scale?: number) => void;

/** Lays the furniture out around a `width` × `height` floor (tile centres 0..width−1, 0..height−1). */
function furnish(width: number, height: number, place: Placer): void {
  const random = seededRandom(width * 131 + height * 17);
  const jitter = (amount: number) => (random() - 0.5) * 2 * amount;
  const left = -0.5 - OFFICE_CLEARANCE;
  const right = width - 0.5 + OFFICE_CLEARANCE;
  const far = -0.5 - OFFICE_CLEARANCE;
  const near = height - 0.5 + OFFICE_CLEARANCE;
  let variant = 0;

  /** A desk with its chair; `turn` 0 puts the screen towards +z and the chair in front of it. */
  const seat = (x: number, z: number, turn: number, empty = false) => {
    const angle = turn + jitter(0.12);
    place(buildWorkstation(variant++), x, z, angle, FURNITURE_SCALE);
    if (empty) return;
    const reach = (0.52 + random() * 0.12) * FURNITURE_SCALE;
    place(
      buildChair(),
      x + Math.sin(angle) * reach + jitter(0.05),
      z + Math.cos(angle) * reach + jitter(0.05),
      angle + Math.PI + jitter(0.5),
      FURNITURE_SCALE,
    );
  };

  // The glass room: a wall across the far side and one down each side, open towards the camera.
  const glassFar = far - 0.75;
  const glassLeft = left - 2.8;
  const glassRight = right + 2.8;
  for (let x = glassLeft + 1; x < glassRight; x += 2) place(buildPartition(2), x, glassFar);
  const sideSegments = Math.max(2, Math.floor((height * 0.72) / 2));
  for (let i = 0; i < sideSegments; i++) {
    const z = glassFar + 1 + i * 2;
    place(buildPartition(2), glassLeft, z, Math.PI / 2);
    place(buildPartition(2), glassRight, z, Math.PI / 2);
  }

  // Inside the glass: a column of desks down each side, screens towards the arena.
  const rows = Math.max(2, Math.floor((height + 1.5) / 2.6));
  const firstRow = (height - 1) / 2 - ((rows - 1) * 2.6) / 2;
  for (let i = 0; i < rows; i++) {
    const z = firstRow + i * 2.6;
    seat(left - 1.3 + jitter(0.1), z + jitter(0.15), Math.PI / 2, i === rows - 2);
    seat(right + 1.3 + jitter(0.1), z + jitter(0.15), -Math.PI / 2, i === 1);
  }
  // Outside it: a second column facing the other way.
  for (let i = 0; i < rows; i++) {
    const z = firstRow + 0.6 + i * 2.6;
    seat(glassLeft - 1.3 + jitter(0.1), z + jitter(0.15), -Math.PI / 2, i === 0);
    seat(glassRight + 1.3 + jitter(0.1), z + jitter(0.15), Math.PI / 2, i === rows - 1);
  }

  // Beyond the far wall: a row of desks facing the arena, and a second row back to back with it.
  const columns = Math.max(2, Math.floor((width + 6) / 2.5));
  const firstColumn = (width - 1) / 2 - ((columns - 1) * 2.5) / 2;
  for (let i = 0; i < columns; i++) {
    const x = firstColumn + i * 2.5;
    seat(x + jitter(0.12), glassFar - 1.4 + jitter(0.08), 0, i === 2);
    seat(x + jitter(0.12), glassFar - 2.95 + jitter(0.08), Math.PI, i === columns - 2);
  }
  // Near the camera: one row, backs to us, kept low so it never covers the floor.
  for (let i = 1; i < columns - 1; i += 2) {
    seat(firstColumn + i * 2.5 + jitter(0.2), near + 1.6 + jitter(0.1), Math.PI);
  }

  // Plants in the corners of the glass room and by the open ends of its side walls.
  const sideEnd = glassFar + sideSegments * 2 + 0.45;
  place(buildPlant(), glassLeft + 0.45, glassFar + 0.45, 0.4);
  place(buildPlant(), glassRight - 0.45, glassFar + 0.45, 1.1);
  place(buildPlant(), glassLeft, sideEnd, 2.0);
  place(buildPlant(), glassRight, sideEnd, 0.2);
  place(buildPlant(), left - 0.5, near + 0.5, 0.9);
  place(buildPlant(), right + 0.5, near + 0.5, 1.7);

  // The whiteboard and the water cooler stand against the far wall, either side of the middle.
  place(buildWhiteboard(), width * 0.3, glassFar + 0.3, 0);
  place(buildWaterCooler(), width * 0.72, glassFar + 0.32, 0);
  place(buildPlant(), width * 0.72 + 0.5, glassFar + 0.36, 2.6);
}

/** Bakes every mesh under `source` into one geometry per material (world transforms applied). */
function mergeByMaterial(source: Object3D): Map<Material, BufferGeometry> {
  source.updateMatrixWorld(true);
  const buckets = new Map<Material, BufferGeometry[]>();
  source.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const mat = child.material as Material | Material[];
    if (Array.isArray(mat)) throw new Error("Office parts take one material each.");
    const own = child.geometry as BufferGeometry;
    const baked = own.index ? own.toNonIndexed() : own.clone();
    baked.clearGroups();
    baked.applyMatrix4(child.matrixWorld);
    const bucket = buckets.get(mat);
    if (bucket) bucket.push(baked);
    else buckets.set(mat, [baked]);
  });
  const merged = new Map<Material, BufferGeometry>();
  for (const [mat, pieces] of buckets) {
    const geometry = mergeGeometries(pieces, false);
    for (const piece of pieces) piece.dispose();
    if (!geometry) throw new Error("Office parts must share their vertex attributes.");
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    merged.set(mat, geometry);
  }
  return merged;
}

const offices = new Map<string, Map<Material, BufferGeometry>>();

/**
 * Everything around a `width` × `height` arena: the wood floor, the glass room, the desks beyond
 * it. Nothing stands within `OFFICE_CLEARANCE` of the floor tiles, and the tall pieces are on the
 * far side and the flanks, where they lean away from the floor in the three-quarter view.
 * Children: `floor`, `furniture` (opaque, one mesh per material) and `glass`.
 */
export function buildOffice(width: number, height: number): Group {
  const office = namedGroup("office");

  const span = Math.max(width, height) + FLOOR_REACH * 2;
  const planks = cachedGeometry(`office-floor|${span}`, () => {
    const plane = new PlaneGeometry(span, span);
    const uv = plane.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        (uv.getX(i) * span) / WOOD_REPEAT_ALONG,
        (uv.getY(i) * span) / WOOD_REPEAT_ACROSS,
      );
    }
    plane.rotateX(-Math.PI / 2);
    return plane;
  });
  const floor = new Mesh(planks, woodMaterial());
  floor.name = "floor";
  floor.position.set((width - 1) / 2, -0.03, (height - 1) / 2);
  floor.receiveShadow = true;
  office.add(floor);

  const key = `${width}x${height}`;
  let merged = offices.get(key);
  if (!merged) {
    const loose = new Group();
    furnish(width, height, (object, x, z, turn = 0, scale = 1) => {
      object.position.set(x, 0, z);
      object.scale.setScalar(scale);
      object.rotation.y = turn;
      loose.add(object);
    });
    merged = mergeByMaterial(loose);
    offices.set(key, merged);
  }

  const furniture = namedGroup("furniture");
  for (const [mat, geometry] of merged) {
    const mesh = new Mesh(geometry, mat);
    if (mat === glassMaterial()) {
      mesh.name = "glass";
      mesh.renderOrder = 1;
      office.add(mesh);
      continue;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    furniture.add(mesh);
  }
  office.add(furniture);
  return office;
}

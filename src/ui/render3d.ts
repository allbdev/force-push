/**
 * The arena in three.js (GAME_PLAN.md §10): instanced floor tiles that take the branch colours
 * (with their patterns), racks, boxes, desks, power-ups, force-pushes, blasts and the four
 * developers, one sun with shadows, and the camera from src/ui/camera.ts.
 *
 * It only draws: it reads the states it's given and never feeds anything back. Own player from
 * the predicted state; everything else from the confirmed state, interpolated between ticks.
 */
import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from "three";
import { BRANCHES, BRANCH_COLOURS, FLOOR_GREY } from "../content/branches";
import { FLOOR_PATTERNS } from "../content/floor-patterns";
import { POWER_UPS } from "../content/power-ups";
import { RULES } from "../content/rules";
import { BOX, FROZEN, RACK } from "../core/map";
import type { GameEvent, GameState } from "../core/state";
import { followFraming, isPortrait, overviewFraming, type Framing } from "./camera";
import { patternTexture } from "./floor-texture";
import {
  BLAST_HEIGHT,
  bevelBox,
  blastGeometry,
  blastMaterial,
  buildBox,
  buildBoxDebris,
  buildDesk,
  buildDeveloper,
  buildForcePush,
  buildPowerUp,
  buildRack,
  material,
  poseDeveloper,
  setDuck,
  setFuse,
  updateRackLeds,
  type Facing,
  type PowerUpKind,
} from "./models";
import { blend, playerPoint, walkPhase, type Point } from "./positions";

const TILE_H = 0.08;
/** Owner classes for the floor: 0 grey, 1–4 branches, 5 frozen. */
const FLOOR_CLASSES = 6;

export type View = {
  readonly confirmed: GameState;
  readonly previous: GameState;
  readonly predicted: GameState;
  /** -1 when watching. */
  readonly seat: number;
  /** 0..1 between the previous and the current tick. */
  readonly alpha: number;
  readonly reducedMotion: boolean;
};

type Debris = { group: Group; age: number };
type Gain = { x: number; y: number; seat: number; n: number; age: number };

export class ArenaRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(34, 1, 0.1, 120);
  private readonly world = new Group();
  private readonly sun = new DirectionalLight("#fff3df", 2.7);
  private width = 0;
  private height = 0;
  private floors: InstancedMesh[] = [];
  private floorOwner = new Uint8Array(0);
  private boxes = new Map<number, Group>();
  private items = new Map<number, { kind: number; group: Group }>();
  private pushes = new Map<number, Group>();
  private blasts: InstancedMesh[] = [];
  private developers: Group[] = [];
  private debris: Debris[] = [];
  /** Recent blasts, for "+9 tiles → dev" labels (read by the HUD). */
  readonly gains: Gain[] = [];
  private cols = 0;
  private rows = 0;
  private framing: Framing | null = null;
  private readonly m = new Matrix4();
  private readonly v = new Vector3();
  private readonly at = new Vector3();
  private lastPoint: Point[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    this.scene.background = new Color("#b5a68c");
    this.scene.add(this.world);
    this.scene.add(new HemisphereLight("#eef3ff", "#8f95a3", 1.25));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.framing = null;
  }

  /** Builds the static arena for a match's first state. */
  setMatch(s: GameState): void {
    this.clear();
    this.cols = s.width;
    this.rows = s.height;
    const n = s.width * s.height;
    this.floorOwner = new Uint8Array(n).fill(255);

    const ground = new Mesh(new PlaneGeometry(200, 200), material("#b5a68c", { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(s.width / 2, -0.06, s.height / 2);
    ground.receiveShadow = true;
    this.world.add(ground);

    // A low wall around the floor.
    const wallMat = material("#d9dde5", { roughness: 0.6 });
    const wallGeo = bevelBox(1, 0.22, 0.18);
    for (let x = -1; x <= s.width; x++) {
      for (const z of [-0.6, s.height - 0.4]) this.addStatic(wallGeo, wallMat, x, 0.11, z);
    }
    const sideGeo = bevelBox(0.18, 0.22, 1);
    for (let z = 0; z < s.height; z++) {
      for (const x of [-0.6, s.width - 0.4]) this.addStatic(sideGeo, wallMat, x, 0.11, z);
    }

    // Floor: one instanced mesh per owner class.
    const tileGeo = bevelBox(0.96, TILE_H, 0.96, 0.025);
    const classColour = (c: number) =>
      c === 0 ? FLOOR_GREY : c === 5 ? "#4a5468" : BRANCH_COLOURS[BRANCHES[c - 1]!];
    for (let c = 0; c < FLOOR_CLASSES; c++) {
      const top = material(classColour(c), { roughness: 0.85 }).clone();
      if (c >= 1 && c <= 4) {
        top.map = patternTexture(FLOOR_PATTERNS[BRANCHES[c - 1]!]);
        if (c >= 1) top.emissive = new Color(classColour(c)).multiplyScalar(0.12);
      }
      const side = material(classColour(c), { roughness: 0.9 }).clone();
      side.color.multiplyScalar(0.8);
      const mats: Material[] = [side, top, side];
      const mesh = new InstancedMesh(tileGeo, mats, n);
      mesh.count = 0;
      mesh.receiveShadow = true;
      this.floors.push(mesh);
      this.world.add(mesh);
    }

    // Racks and desks never change.
    for (let i = 0; i < n; i++) {
      if (s.kind[i] !== RACK) continue;
      const rack = buildRack(i % 3);
      rack.position.set(i % s.width, TILE_H, Math.floor(i / s.width));
      this.world.add(rack);
    }
    s.desks.forEach((d, seat) => {
      const x = d % s.width;
      const y = Math.floor(d / s.width);
      const desk = buildDesk(BRANCHES[seat]!);
      const ox = x < s.width / 2 ? -1.35 : 1.35;
      const oz = y < s.height / 2 ? -1.3 : 1.3;
      desk.position.set(x + ox, 0, y + oz);
      desk.rotation.y = Math.atan2(-ox, -oz);
      this.world.add(desk);
    });

    // Blasts: one instanced mesh per branch.
    for (const branch of BRANCHES) {
      const mesh = new InstancedMesh(blastGeometry(), blastMaterial(branch), n);
      mesh.count = 0;
      mesh.renderOrder = 2;
      this.blasts.push(mesh);
      this.world.add(mesh);
    }

    this.developers = BRANCHES.map((b) => {
      const dev = buildDeveloper(b);
      this.world.add(dev);
      return dev;
    });
    this.lastPoint = s.players.map((p) => playerPoint(p));

    const extent = Math.max(s.width, s.height) / 2 + 3;
    const cam = this.sun.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.near = 1;
    cam.far = 60;
    cam.updateProjectionMatrix();
    this.sun.position.set(s.width / 2 - 6, 13, s.height / 2 + 7);
    this.sun.target.position.set(s.width / 2, 0, s.height / 2);
    this.framing = null;
  }

  private addStatic(geo: Mesh["geometry"], mat: Material, x: number, y: number, z: number): void {
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.world.add(mesh);
  }

  private clear(): void {
    this.world.clear();
    this.floors = [];
    this.blasts = [];
    this.boxes.clear();
    this.items.clear();
    this.pushes.clear();
    this.developers = [];
    this.debris = [];
    this.gains.length = 0;
  }

  /** Effects for events from confirmed ticks: debris and gain labels. */
  onEvents(events: readonly GameEvent[], reducedMotion: boolean): void {
    for (const e of events) {
      if (e.type === "box" && !reducedMotion) {
        const group = buildBoxDebris();
        group.position.set(e.x, TILE_H, e.y);
        this.world.add(group);
        this.debris.push({ group, age: 0 });
      }
      if (e.type === "blast" && e.gained > 0) {
        this.gains.push({ x: e.x, y: e.y, seat: e.seat, n: e.gained, age: 0 });
        if (this.gains.length > 6) this.gains.shift();
      }
    }
  }

  /** Draws one frame. `dt` in seconds since the last frame. */
  draw(view: View, dt: number, tick: number): void {
    const s = view.confirmed;
    if (this.cols !== s.width || this.floors.length === 0) this.setMatch(s);
    this.syncFloor(s);
    this.syncBoxes(s);
    this.syncItems(s, tick);
    this.syncPushes(view.predicted, view.seat);
    this.syncBlasts(s);
    this.syncPlayers(view);
    this.animateDebris(dt);
    for (const g of this.gains) g.age += dt;
    while (this.gains.length && this.gains[0]!.age > 1.6) this.gains.shift();
    updateRackLeds(tick);
    this.frame(view, dt);
    this.renderer.render(this.scene, this.camera);
  }

  private syncFloor(s: GameState): void {
    let changed = false;
    for (let i = 0; i < s.owner.length; i++) {
      const cls = s.kind[i] === RACK ? 254 : s.kind[i] === FROZEN ? 5 : s.owner[i]!;
      if (this.floorOwner[i] !== cls) {
        this.floorOwner[i] = cls;
        changed = true;
      }
    }
    if (!changed) return;
    const counts = new Array<number>(FLOOR_CLASSES).fill(0);
    for (let i = 0; i < this.floorOwner.length; i++) {
      const cls = this.floorOwner[i]!;
      if (cls >= FLOOR_CLASSES) continue;
      const mesh = this.floors[cls]!;
      this.m.makeTranslation(
        i % s.width,
        cls === 5 ? TILE_H / 2 + 0.03 : TILE_H / 2,
        Math.floor(i / s.width),
      );
      mesh.setMatrixAt(counts[cls]!++, this.m);
    }
    this.floors.forEach((mesh, c) => {
      mesh.count = counts[c]!;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  private syncBoxes(s: GameState): void {
    for (let i = 0; i < s.kind.length; i++) {
      const isBox = s.kind[i] === BOX;
      const have = this.boxes.get(i);
      if (isBox && !have) {
        const box = buildBox();
        box.position.set(i % s.width, TILE_H, Math.floor(i / s.width));
        box.rotation.y = (((i * 7919) % 7) - 3) * 0.02;
        this.world.add(box);
        this.boxes.set(i, box);
      } else if (!isBox && have) {
        this.world.remove(have);
        this.boxes.delete(i);
      }
    }
  }

  private syncItems(s: GameState, tick: number): void {
    for (const [i, item] of this.items) {
      if (s.item[i] !== item.kind) {
        this.world.remove(item.group);
        this.items.delete(i);
      }
    }
    for (let i = 0; i < s.item.length; i++) {
      const kind = s.item[i]!;
      if (!kind) continue;
      let item = this.items.get(i);
      if (!item) {
        const group = buildPowerUp(POWER_UPS[kind - 1] as PowerUpKind);
        group.position.set(i % s.width, TILE_H, Math.floor(i / s.width));
        this.world.add(group);
        item = { kind, group };
        this.items.set(i, item);
      }
      const spin = item.group.getObjectByName("item");
      if (spin) {
        spin.rotation.y = tick * 0.06 + i;
        spin.position.y = 0.05 + Math.sin(tick * 0.15 + i) * 0.02;
      }
    }
  }

  private syncPushes(s: GameState, seat: number): void {
    const seen = new Set<number>();
    for (const q of s.pushes) {
      seen.add(q.id);
      let model = this.pushes.get(q.id);
      if (!model) {
        model = buildForcePush(BRANCHES[q.owner]!);
        this.world.add(model);
        this.pushes.set(q.id, model);
      }
      model.position.set(q.x, TILE_H, q.y);
      setFuse(model, Math.max(0, Math.min(1, q.fuse / RULES.fuseTicks)));
    }
    for (const [id, model] of this.pushes) {
      if (!seen.has(id)) {
        this.world.remove(model);
        this.pushes.delete(id);
      }
    }
    void seat;
  }

  private syncBlasts(s: GameState): void {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < s.blast.length; i++) {
      const left = s.blast[i]!;
      if (!left) continue;
      const seat = s.blastSeat[i]!;
      const f = left / RULES.blastTicks;
      const scale = 0.55 + 0.45 * f;
      this.m.makeScale(scale, 0.4 + 0.6 * f, scale);
      this.m.setPosition(
        i % s.width,
        TILE_H + (BLAST_HEIGHT / 2) * (0.4 + 0.6 * f),
        Math.floor(i / s.width),
      );
      this.blasts[seat]!.setMatrixAt(counts[seat]!++, this.m);
    }
    this.blasts.forEach((mesh, seat) => {
      mesh.count = counts[seat]!;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  /** Where each player is drawn this frame (tile coordinates), for the HUD. */
  readonly drawn: Point[] = [];
  readonly visible: boolean[] = [];

  private syncPlayers(view: View): void {
    const { confirmed: s, previous, predicted } = view;
    s.players.forEach((p, seat) => {
      const dev = this.developers[seat]!;
      const own = seat === view.seat;
      const src = own ? predicted.players[seat]! : p;
      let point: Point;
      if (own) {
        // Smooth the prediction toward its target so corrections don't snap.
        const target = playerPoint(src);
        const last = this.lastPoint[seat] ?? target;
        point = blend(last, target, 0.5);
      } else {
        point = blend(playerPoint(previous.players[seat]!), playerPoint(p), view.alpha);
      }
      this.lastPoint[seat] = point;
      let visible = true;
      let falling = 0;
      if (src.out > 0) {
        const since = RULES.revertTicks - src.out;
        if (since < RULES.fallTicks) {
          falling = Math.min(1, (since + view.alpha) / (RULES.fallTicks * 0.6));
          point = { x: src.fellX, y: src.fellY };
        } else visible = false;
      } else if (src.grace > 0 && !view.reducedMotion) {
        visible = Math.floor(src.grace / 2) % 2 === 0;
      }
      dev.visible = visible;
      dev.position.set(point.x, TILE_H, point.y);
      poseDeveloper(dev, {
        walkPhase: walkPhase(point, src.dir !== -1),
        falling,
        facing: src.facing as Facing,
      });
      setDuck(dev, src.duck === 1);
      this.drawn[seat] = point;
      this.visible[seat] = visible || src.out > 0;
    });
  }

  private animateDebris(dt: number): void {
    for (const d of this.debris) {
      d.age += dt;
      const t = d.age;
      d.group.children.forEach((piece: Object3D) => {
        const dir = piece.userData.direction as [number, number, number] | undefined;
        if (!dir) return;
        piece.position.set(
          dir[0] * t * 1.6,
          Math.max(0, dir[1] * t * 2.2 - 4.9 * t * t) + 0.1,
          dir[2] * t * 1.6,
        );
        piece.rotation.set(t * 6 * dir[2], t * 4, t * 6 * dir[0]);
      });
    }
    for (const d of this.debris.filter((x) => x.age > 0.8)) this.world.remove(d.group);
    this.debris = this.debris.filter((x) => x.age <= 0.8);
  }

  private frame(view: View, dt: number): void {
    const aspect = this.width / Math.max(1, this.height);
    let target: Framing;
    if (isPortrait(this.width, this.height) && view.seat >= 0) {
      const me = this.drawn[view.seat] ?? { x: this.cols / 2, y: this.rows / 2 };
      target = followFraming(me.x, me.y, this.cols, this.rows, aspect);
    } else {
      target = overviewFraming(this.cols, this.rows, aspect);
    }
    const k = this.framing ? Math.min(1, dt * 6) : 1;
    const f = this.framing ?? target;
    const lerp = (a: readonly number[], b: readonly number[]) =>
      [
        a[0]! + (b[0]! - a[0]!) * k,
        a[1]! + (b[1]! - a[1]!) * k,
        a[2]! + (b[2]! - a[2]!) * k,
      ] as const;
    this.framing = { from: lerp(f.from, target.from), at: lerp(f.at, target.at), fov: target.fov };
    this.camera.position.set(...this.framing.from);
    this.at.set(...this.framing.at);
    this.camera.lookAt(this.at);
    if (this.camera.fov !== this.framing.fov) {
      this.camera.fov = this.framing.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Screen position (CSS px) of a point on the floor (tile coordinates) at a height. */
  toScreen(x: number, y: number, h: number): { x: number; y: number } {
    this.v.set(x, h, y).project(this.camera);
    return { x: ((this.v.x + 1) / 2) * this.width, y: ((1 - this.v.y) / 2) * this.height };
  }

  dispose(): void {
    this.clear();
    this.renderer.dispose();
  }
}

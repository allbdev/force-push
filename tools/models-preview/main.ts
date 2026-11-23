/**
 * Dev-only page to look at every code-built model: `npm run dev`, then /tools/models-preview/.
 * Not part of the production build (Vite only builds the root index.html).
 *
 *   ?view=arena | characters | items   which line-up to show (the last two mirror the boards)
 *   &t=<ticks>                         freeze the animation at a tick (for screenshots)
 *   &ui=0                              hide the view links
 */
import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import { BRANCHES, BRANCH_COLOURS, FLOOR_GREY, type Branch } from "../../src/content/branches";
import {
  POWER_UP_KINDS,
  bevelBox,
  buildBlastTile,
  buildBox,
  buildBoxDebris,
  buildDesk,
  buildDeveloper,
  buildForcePush,
  buildPowerUp,
  buildRack,
  countTriangles,
  material,
  part,
  poseDeveloper,
  setDuck,
  setFuse,
  updateRackLeds,
  type DeveloperPose,
} from "../../src/ui/models";

const TICKS_PER_SECOND = 20;
const FUSE_TICKS = 60;

interface Stage {
  root: Group;
  camera: { from: Vector3; at: Vector3; fov: number };
  /** Half the width the sun's shadow has to cover. */
  extent: number;
  ground: string;
  animate: (tick: number) => void;
}

function floorTile(colour: string, size = 0.96): Mesh {
  const tile = part(
    bevelBox(size, 0.08, size, 0.02),
    material(colour, { roughness: 0.9 }),
    0,
    -0.04,
    0,
  );
  tile.castShadow = false;
  return tile;
}

function place<T extends Object3D>(into: Group, object: T, x: number, z: number): T {
  object.position.x = x;
  object.position.z = z;
  into.add(object);
  return object;
}

function arena(): Stage {
  const root = new Group();
  const quadrant = (x: number, z: number): string => {
    if ((x * 7 + z * 13 + 100) % 11 === 0) return FLOOR_GREY;
    if (z <= 0) return x <= 0 ? BRANCH_COLOURS.main : BRANCH_COLOURS.feature;
    return x <= 0 ? BRANCH_COLOURS.hotfix : BRANCH_COLOURS.dev;
  };
  const isRack = (x: number, z: number): boolean => (x + 4) % 2 === 1 && (z + 3) % 2 === 1;
  for (let x = -4; x <= 4; x++) {
    for (let z = -3; z <= 3; z++) {
      place(root, floorTile(quadrant(x, z)), x, z);
      if (isRack(x, z)) place(root, buildRack(x + z), x, z);
    }
  }
  const boxes: [number, number, number][] = [
    [-4, 1, 0.1],
    [-2, -1, -0.15],
    [0, -1, 0.05],
    [4, 3, 0.2],
    [2, -3, -0.08],
    [-4, 0, 0.12],
    [4, 0, -0.2],
    [-1, 3, 0.07],
    [1, 3, -0.1],
  ];
  for (const [x, z, turn] of boxes) place(root, buildBox(), x, z).rotation.y = turn;
  const corners: [Branch, number, number, number][] = [
    ["main", -5.3, -4.1, 0.3],
    ["feature", 5.3, -4.1, -0.3],
    ["hotfix", -5.3, 4.1, 0.25],
    ["dev", 5.3, 4.1, -0.25],
  ];
  for (const [branch, x, z, turn] of corners) {
    place(root, buildDesk(branch), x, z).rotation.y = turn;
  }

  const main = place(root, buildDeveloper("main"), -4, -2);
  const feature = place(root, buildDeveloper("feature"), 4, -2);
  const hotfix = place(root, buildDeveloper("hotfix"), -3, 3);
  const dev = place(root, buildDeveloper("dev"), 0, 1);
  setDuck(hotfix, true);

  const pushes = [
    place(root, buildForcePush("main"), -2, -3),
    place(root, buildForcePush("hotfix"), 0, 3),
    place(root, buildForcePush("feature"), 2, -1),
  ];
  POWER_UP_KINDS.forEach((kind, index) => {
    const spots: [number, number][] = [
      [0, -3],
      [-2, 1],
      [-2, 3],
      [4, -1],
      [-4, -1],
    ];
    const [x, z] = spots[index]!;
    place(root, buildPowerUp(kind), x, z);
  });
  const cross: [number, number][] = [
    [2, 1],
    [1, 1],
    [0, 1],
    [3, 1],
    [4, 1],
    [2, 0],
    [2, 2],
    [2, 3],
  ];
  for (const [x, z] of cross) place(root, buildBlastTile("dev"), x, z);
  const debris = place(root, buildBoxDebris(), 2, 3);
  for (const piece of debris.children) {
    const direction = piece.userData.direction as [number, number, number];
    piece.position.x += direction[0] * 0.35;
    piece.position.y += direction[1] * 0.35;
    piece.position.z += direction[2] * 0.35;
  }

  return {
    root,
    camera: { from: new Vector3(0, 12.5, 8.6), at: new Vector3(0, 0, 0.35), fov: 33 },
    extent: 8,
    ground: "#b8ab96",
    animate: (tick) => {
      const phase = (tick % 10) / 10;
      poseDeveloper(main, { walkPhase: phase, falling: 0, facing: 1 });
      poseDeveloper(feature, { walkPhase: 0, falling: 0, facing: 2, cheer: 1 });
      poseDeveloper(hotfix, { walkPhase: phase, falling: 0, facing: 1 });
      poseDeveloper(dev, { walkPhase: 0, falling: Math.min(1, (tick % 60) / 12), facing: 3 });
      pushes.forEach((push, index) => {
        setFuse(push, 1 - ((tick + index * 20) % FUSE_TICKS) / FUSE_TICKS);
      });
    },
  };
}

/** The four developers on tiles of their colour, as on the board "The branches". */
function characters(): Stage {
  const root = new Group();
  const poses: Record<Branch, DeveloperPose> = {
    main: { walkPhase: 0, falling: 0, facing: 2 },
    feature: { walkPhase: 0, falling: 0, facing: 2, cheer: 1 },
    hotfix: { walkPhase: 0, falling: 0, facing: 2 },
    dev: { walkPhase: 0.2, falling: 0, facing: 2 },
  };
  const developers = BRANCHES.map((branch, index) => {
    const x = (index - 1.5) * 1.3;
    const tile = place(root, floorTile(BRANCH_COLOURS[branch], 1.1), x, 0);
    tile.position.y = 0;
    const developer = place(root, buildDeveloper(branch), x, 0);
    developer.position.y = 0.04;
    developer.rotation.y = 0.25 - index * 0.15;
    return { developer, branch };
  });
  return {
    root,
    camera: { from: new Vector3(0, 1.7, 4.3), at: new Vector3(0, 0.44, 0), fov: 24 },
    extent: 4.5,
    ground: "#a9b4c8",
    animate: (tick) => {
      for (const { developer, branch } of developers) {
        const pose = poses[branch];
        poseDeveloper(
          developer,
          branch === "dev" ? { ...pose, walkPhase: (tick % 10) / 10 } : pose,
        );
      }
    },
  };
}

/** The force-push, the power-ups, the box and the rack in a row, as on "Items and blocks". */
function items(): Stage {
  const root = new Group();
  const push = buildForcePush("main");
  const line: Object3D[] = [
    push,
    ...POWER_UP_KINDS.map((kind) => buildPowerUp(kind)),
    buildBox(),
    buildRack(1),
  ];
  line.forEach((object, index) => {
    place(root, object, (index - (line.length - 1) / 2) * 1.15, 0).rotation.y = -0.35;
  });
  return {
    root,
    camera: { from: new Vector3(0, 2.7, 7.8), at: new Vector3(0, 0.5, 0), fov: 23 },
    extent: 6,
    ground: "#a9b4c8",
    animate: (tick) => setFuse(push, 1 - (tick % FUSE_TICKS) / FUSE_TICKS),
  };
}

const params = new URLSearchParams(location.search);
const view = params.get("view");
const stage = view === "characters" ? characters() : view === "items" ? items() : arena();
const frozenAt = params.get("t");
const frozenTick = frozenAt === null ? null : Number.parseInt(frozenAt, 10) || 0;
if (params.get("ui") === "0") document.getElementById("views")?.remove();

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new Scene();
scene.background = new Color(stage.ground);
scene.add(stage.root);

const ground = new Mesh(new PlaneGeometry(80, 80), material(stage.ground, { roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.08;
ground.receiveShadow = true;
scene.add(ground);

scene.add(new HemisphereLight("#eef3ff", "#8f95a3", 1.25));
const sun = new DirectionalLight("#fff3df", 2.7);
sun.position.set(-5, 11, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -stage.extent;
sun.shadow.camera.right = stage.extent;
sun.shadow.camera.top = stage.extent;
sun.shadow.camera.bottom = -stage.extent;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const camera = new PerspectiveCamera(stage.camera.fov, 1, 0.1, 100);
camera.position.copy(stage.camera.from);
camera.lookAt(stage.camera.at);

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

console.info(`models preview: ${countTriangles(stage.root)} triangles in view`);

function frame(now: number): void {
  const tick = frozenTick ?? Math.floor((now / 1000) * TICKS_PER_SECOND);
  updateRackLeds(tick);
  stage.animate(tick);
  renderer.render(scene, camera);
  document.body.dataset.ready = "1";
  if (frozenTick === null) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

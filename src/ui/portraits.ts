/**
 * The lobby's seat portraits (board 2): each developer on a slab of their branch colour against a
 * light grey card. Rendered once with an offscreen WebGL canvas into data URLs (the CSP allows
 * `img-src data:`), then the context is thrown away.
 *
 * `buildPortraitStage` and `portraitFraming` have no DOM in them and are unit-tested.
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
  WebGLRenderer,
} from "three";
import { BRANCHES, BRANCH_COLOURS, type Branch } from "../content/branches";
import type { Framing } from "./camera";
import { createContext } from "./hero";
import {
  bevelBox,
  buildDeveloper,
  cachedGeometry,
  developerParts,
  material,
  part,
  poseDeveloper,
  shade,
} from "./models";

/** The card behind the figure. */
export const PORTRAIT_BACKGROUND = "#b3bccb";
export const PORTRAIT_MIN_SIZE = 64;
export const PORTRAIT_MAX_SIZE = 512;

const SLAB_HEIGHT = 0.1;

/**
 * A developer standing on a slab in their colour, turned a little towards the camera, each in
 * their own pose: `main` at ease, `feature` waving, `hotfix` behind the laptop, `dev` mid-step.
 * Children: `ground`, `slab`, `developer-<branch>`.
 */
export function buildPortraitStage(branch: Branch): Group {
  const stage = new Group();
  stage.name = `portrait-${branch}`;
  const colour = BRANCH_COLOURS[branch];

  const ground = new Mesh(
    cachedGeometry("portrait-ground", () => new PlaneGeometry(12, 12).rotateX(-Math.PI / 2)),
    material(PORTRAIT_BACKGROUND, { roughness: 1 }),
  );
  ground.name = "ground";
  ground.position.y = -SLAB_HEIGHT;
  ground.receiveShadow = true;
  stage.add(ground);

  const slab = part(
    bevelBox(1.05, SLAB_HEIGHT, 1.05),
    [
      material(shade(colour, 0.8), { roughness: 0.9 }),
      material(colour, { roughness: 0.85, emissive: colour, emissiveIntensity: 0.12 }),
      material(shade(colour, 0.8), { roughness: 0.9 }),
    ],
    0,
    -SLAB_HEIGHT / 2,
    0,
    "slab",
  );
  stage.add(slab);

  const developer = buildDeveloper(branch);
  poseDeveloper(developer, { walkPhase: branch === "dev" ? 0.13 : 0, falling: 0, facing: 2 });
  const parts = developerParts(developer);
  if (branch === "feature") {
    parts.armL.rotation.set(-2.8, 0, 0.2);
    parts.head.rotation.z = -0.06;
  }
  if (branch === "main") parts.head.rotation.y = 0.12;
  developer.rotation.y = branch === "hotfix" ? 0.1 : 0.32;
  stage.add(developer);
  return stage;
}

/** Head and shoulders down to the slab, from a little above and to the side, like the board. */
export function portraitFraming(): Framing {
  return { from: [0.68, 1.2, 2.6], at: [0, 0.45, 0], fov: 26 };
}

function clampSize(size: number): number {
  const whole = Number.isFinite(size) ? Math.round(size) : PORTRAIT_MIN_SIZE;
  return Math.min(PORTRAIT_MAX_SIZE, Math.max(PORTRAIT_MIN_SIZE, whole));
}

function renderAll(size: number): string[] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = createContext(canvas, { antialias: true, alpha: false, depth: true });
  if (!context) throw new Error("WebGL is not available.");
  const renderer = new WebGLRenderer({ canvas, context });
  try {
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);

    const scene = new Scene();
    scene.background = new Color(PORTRAIT_BACKGROUND);
    scene.add(new HemisphereLight("#eef3ff", "#8f95a3", 1.35));
    const sun = new DirectionalLight("#fff3df", 2.6);
    sun.position.set(-2.2, 5, 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    const reach = sun.shadow.camera;
    reach.left = -1.6;
    reach.right = 1.6;
    reach.top = 1.6;
    reach.bottom = -1.6;
    reach.near = 1;
    reach.far = 12;
    reach.updateProjectionMatrix();
    scene.add(sun, sun.target);

    const framing = portraitFraming();
    const camera = new PerspectiveCamera(framing.fov, 1, 0.1, 30);
    camera.position.set(...framing.from);
    camera.lookAt(...framing.at);

    return BRANCHES.map((branch) => {
      const stage = buildPortraitStage(branch);
      scene.add(stage);
      renderer.render(scene, camera);
      // Read back in the same task as the draw, before the browser clears the buffer.
      const url = canvas.toDataURL("image/png");
      scene.remove(stage);
      return url;
    });
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}

const cache = new Map<number, Promise<string[]>>();

/**
 * The four developers (main, feature, hotfix, dev) as square PNG data URLs, `size` pixels a side.
 * Rendered once per size and cached; rejects when WebGL is unavailable, and the lobby keeps its
 * placeholder.
 */
export function renderPortraits(size: number): Promise<string[]> {
  const side = clampSize(size);
  let pending = cache.get(side);
  if (!pending) {
    pending = new Promise<string[]>((resolve) => resolve(renderAll(side)));
    cache.set(side, pending);
  }
  return pending;
}

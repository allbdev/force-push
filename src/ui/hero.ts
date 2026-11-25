/**
 * The landing's hero (board 1): `main` in his blue hoodie behind a big force-push with its fuse
 * glowing, in a corridor of server racks that falls out of focus behind them.
 *
 * `buildHeroStage`, `heroFraming` and `poseHero` are plain three.js objects and maths (no DOM), so
 * they are unit-tested; `HeroScene` owns the WebGL context. The depth of field is faked without a
 * post-processing library: the racks are drawn small into a corner of the canvas, copied to a
 * texture, blown up through a blur, and the two figures are drawn sharp on top.
 */
import {
  CircleGeometry,
  Color,
  DirectionalLight,
  Fog,
  FramebufferTexture,
  Group,
  HemisphereLight,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RGBFormat,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  type Object3D,
} from "three";
import { BRANCH_COLOURS } from "../content/branches";
import type { Framing } from "./camera";
import {
  bevelBox,
  buildDeveloper,
  buildForcePush,
  buildPartition,
  buildRack,
  cachedGeometry,
  developerParts,
  material,
  poseDeveloper,
  setFuse,
  updateRackLeds,
} from "./models";

/** The racks, the floor and the far wall: drawn first, out of focus. */
export const HERO_BACKGROUND_LAYER = 0;
/** The developer and the force-push: drawn sharp, on top. */
export const HERO_FOREGROUND_LAYER = 1;
/** The haze the corridor fades into. */
export const HERO_SKY = "#a3abb6";

/** The background is drawn at this fraction of the canvas, then blurred back up. */
const BLUR_DOWNSCALE = 5;
const RACK_SCALE = 1.45;
/** Where the force-push stands: in front of the developer, to his left (our right). */
const ORB_POSITION = [0.2, 0, 2.3] as const;
const RACKS_PER_SIDE = 7;
const CORRIDOR_TILES = 16;

function onLayer(object: Object3D, layer: number): void {
  object.traverse((child) => child.layers.set(layer));
}

/** A soft dark disc under a figure: the blurred floor has no shadow map to catch a real one. */
function contactShadow(radius: number, x: number, z: number): Mesh {
  const disc = new Mesh(
    cachedGeometry(`hero-shadow|${radius}`, () => new CircleGeometry(radius, 24)),
    new MeshBasicMaterial({ color: "#05070c", transparent: true, opacity: 0.4, depthWrite: false }),
  );
  disc.name = "contact-shadow";
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, 0.004, z);
  return disc;
}

/**
 * The whole composition around the origin, where the developer stands facing +z (the camera).
 * Children: `backdrop` (background layer), `developer-main` and `force-push-main` (foreground).
 */
export function buildHeroStage(): Group {
  const stage = new Group();
  stage.name = "hero-stage";
  const backdrop = new Group();
  backdrop.name = "backdrop";

  // The corridor: three tiles wide, in main's blue, running away from the camera.
  const blue = BRANCH_COLOURS.main;
  const top = material(blue, { roughness: 0.85, emissive: blue, emissiveIntensity: 0.1 });
  const side = material("#2b62b8", { roughness: 0.9 });
  const tiles = new InstancedMesh(
    bevelBox(0.96, 0.08, 0.96, 0.025),
    [side, top, side],
    3 * CORRIDOR_TILES,
  );
  tiles.name = "corridor";
  const at = new Matrix4();
  for (let i = 0; i < 3 * CORRIDOR_TILES; i++) {
    at.makeTranslation((i % 3) - 1, -0.04, 3.5 - Math.floor(i / 3));
    tiles.setMatrixAt(i, at);
  }
  backdrop.add(tiles);
  const ground = new Mesh(
    cachedGeometry("hero-ground", () => new PlaneGeometry(60, 60).rotateX(-Math.PI / 2)),
    material("#39404f", { roughness: 1 }),
  );
  ground.name = "ground";
  ground.position.set(0, -0.045, -20);
  backdrop.add(ground);

  // Two rows of racks: the right one starts beside the camera, the left one further back.
  for (let i = 0; i < RACKS_PER_SIDE; i++) {
    for (const side01 of [0, 1]) {
      const rack = buildRack(i + side01);
      rack.scale.setScalar(RACK_SCALE);
      const gap = i === 2 ? 0.5 : 0;
      rack.position.set(
        side01 ? 2.08 : -2.15,
        0,
        (side01 ? 2.2 : -0.6) - i * (0.9 * RACK_SCALE + 0.12) - gap,
      );
      backdrop.add(rack);
    }
  }
  // The glass wall at the end of the corridor: its top rail is the line behind his shoulders.
  for (let x = -4; x <= 4; x += 2) {
    const wall = buildPartition(2);
    wall.position.set(x, 0, -9);
    wall.scale.y = 1.1;
    backdrop.add(wall);
  }
  backdrop.add(contactShadow(0.3, 0, 0.02));
  backdrop.add(contactShadow(0.36, ORB_POSITION[0], ORB_POSITION[2]));
  onLayer(backdrop, HERO_BACKGROUND_LAYER);
  stage.add(backdrop);

  const developer = buildDeveloper("main");
  poseDeveloper(developer, { walkPhase: 0, falling: 0, facing: 2 });
  onLayer(developer, HERO_FOREGROUND_LAYER);
  stage.add(developer);

  const push = buildForcePush("main");
  push.position.set(...ORB_POSITION);
  onLayer(push, HERO_FOREGROUND_LAYER);
  stage.add(push);

  poseHero(stage, 0);
  return stage;
}

/**
 * The idle loop at `seconds`: the fuse pulses, he looks about a little and breathes. A pure
 * function of time, and `seconds = 0` is the still frame (fuse at its brightest).
 */
export function poseHero(stage: Object3D, seconds: number): void {
  const push = stage.getObjectByName("force-push-main");
  if (push) {
    // One blink every 2.5 s; `setFuse` blinks on 7·burnt², so pick the burn that gives that phase.
    const phase = (0.5 + seconds / 2.5) % 1;
    setFuse(push, 1 - Math.sqrt(phase / 7));
  }
  const developer = stage.getObjectByName("developer-main");
  if (developer) {
    const parts = developerParts(developer);
    parts.head.rotation.set(
      Math.sin(seconds * 0.5) * 0.03,
      0.1 + Math.sin(seconds * 0.37) * 0.09,
      0,
    );
    const breath = Math.sin(seconds * 1.3);
    parts.body.scale.set(1, 1 + breath * 0.008, 1 + breath * 0.012);
    parts.armL.rotation.x = breath * 0.025;
    parts.armR.rotation.x = -breath * 0.025;
  }
}

/** How bright the fuse is at `seconds`, 0..1 (drives the warm light it throws on the orb). */
export function heroFuseGlow(seconds: number): number {
  return 0.5 - 0.5 * Math.cos(((0.5 + seconds / 2.5) % 1) * Math.PI * 2);
}

/**
 * The camera: low and close, with a long lens. On wide screens the figures sit right of centre,
 * clear of the text; on narrow ones they are centred and further away.
 */
export function heroFraming(aspect: number, seconds = 0): Framing {
  const wide = Math.min(1, Math.max(0, (aspect - 0.8) / 0.8));
  const sway = Math.sin(seconds * 0.21) * 0.035;
  // Looking left of the figures pushes them to the right of the frame.
  const offset = -0.44 * wide;
  const distance = 3.75 + (1 - wide) * 2.6;
  return {
    from: [offset * 0.3 + sway, 0.69, distance],
    at: [offset, 0.4, 0],
    fov: 30,
  };
}

const BLUR_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** Thirteen taps on two rings: enough to turn the upscaled pixels into a soft lens blur. */
const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 sum = texture2D(map, vUv).rgb * 0.16;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0471976;
    vec2 dir = vec2(cos(a), sin(a));
    sum += texture2D(map, vUv + dir * texel * 1.4).rgb * 0.09;
    sum += texture2D(map, vUv + dir.yx * texel * 2.9).rgb * 0.05;
  }
  gl_FragColor = vec4(sum, 1.0);
}`;

/** A WebGL 2 context, or `null` without logging when the browser has none to give. */
export function createContext(
  canvas: HTMLCanvasElement,
  attributes: WebGLContextAttributes,
): WebGL2RenderingContext | null {
  try {
    return canvas.getContext("webgl2", attributes);
  } catch {
    return null;
  }
}

export class HeroScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.1, 80);
  private readonly stage: Group;
  private readonly fuseLight = new PointLight("#ffd27a", 0, 3, 2);
  private readonly blurScene = new Scene();
  private readonly blurCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly blur: ShaderMaterial;
  private readonly corner = new Vector2(0, 0);
  private small: FramebufferTexture | null = null;
  private width = 1;
  private height = 1;

  /** Throws when WebGL isn't available; the landing then shows nothing behind the text. */
  constructor(canvas: HTMLCanvasElement) {
    const context = createContext(canvas, { antialias: true, alpha: false, depth: true });
    if (!context) throw new Error("WebGL is not available.");
    this.renderer = new WebGLRenderer({ canvas, context });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(new Color(HERO_SKY), 1);
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));

    this.scene.fog = new Fog(HERO_SKY, 4.5, 15);
    this.stage = buildHeroStage();
    this.scene.add(this.stage);
    const sky = new HemisphereLight("#eef3ff", "#59607a", 1.5);
    const key = new DirectionalLight("#fff3df", 2.2);
    key.position.set(-3, 5, 6);
    const rim = new DirectionalLight("#9fc4ff", 1.1);
    rim.position.set(3, 3, -4);
    this.fuseLight.position.set(ORB_POSITION[0], 0.85, ORB_POSITION[2] + 0.1);
    for (const light of [sky, key, rim, this.fuseLight]) {
      light.layers.enableAll();
      this.scene.add(light);
    }
    this.scene.add(key.target, rim.target);

    this.blur = new ShaderMaterial({
      uniforms: { map: { value: null }, texel: { value: new Vector2(1, 1) } },
      vertexShader: BLUR_VERTEX,
      fragmentShader: BLUR_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const screen = new Mesh(new PlaneGeometry(2, 2), this.blur);
    screen.frustumCulled = false;
    this.blurScene.add(screen);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    const ratio = this.renderer.getPixelRatio();
    const w = Math.max(2, Math.floor((this.width * ratio) / BLUR_DOWNSCALE));
    const h = Math.max(2, Math.floor((this.height * ratio) / BLUR_DOWNSCALE));
    this.small?.dispose();
    this.small = new FramebufferTexture(w, h);
    // The canvas has no alpha channel, and a copy can drop channels but never invent one.
    this.small.format = RGBFormat;
    this.small.internalFormat = "RGB8";
    this.small.minFilter = LinearFilter;
    this.small.magFilter = LinearFilter;
    this.blur.uniforms.map!.value = this.small;
    (this.blur.uniforms.texel!.value as Vector2).set(1 / w, 1 / h);
  }

  /** Draws the frame for `timeSeconds`; the same time always gives the same picture. */
  draw(timeSeconds: number): void {
    const small = this.small;
    if (!small) return;
    poseHero(this.stage, timeSeconds);
    updateRackLeds(Math.floor(timeSeconds * 20));
    this.fuseLight.intensity = 0.25 + heroFuseGlow(timeSeconds) * 1.6;
    const framing = heroFraming(this.camera.aspect, timeSeconds);
    this.camera.position.set(...framing.from);
    this.camera.lookAt(...framing.at);

    const r = this.renderer;
    const ratio = r.getPixelRatio();
    r.setViewport(0, 0, this.width, this.height);
    r.clear();
    // 1. The background, small, in the bottom-left corner.
    r.setViewport(0, 0, small.image.width / ratio, small.image.height / ratio);
    this.camera.layers.set(HERO_BACKGROUND_LAYER);
    r.render(this.scene, this.camera);
    r.copyFramebufferToTexture(small, this.corner);
    // 2. Blown up over the whole canvas through the blur.
    r.setViewport(0, 0, this.width, this.height);
    r.render(this.blurScene, this.blurCamera);
    // 3. The figures, sharp, over it.
    r.clearDepth();
    this.camera.layers.set(HERO_FOREGROUND_LAYER);
    r.render(this.scene, this.camera);
  }

  dispose(): void {
    this.small?.dispose();
    this.small = null;
    this.blur.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

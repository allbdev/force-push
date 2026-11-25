/**
 * One tile of a blast (board "Force-push"): a glowing slab in the branch colour, a tile wide so
 * the arms of the cross join up. One shared geometry and one material per branch, ready for an
 * `InstancedMesh`.
 */
import { Color, Mesh, MeshBasicMaterial, type BufferGeometry } from "three";
import { BRANCH_COLOURS, type Branch } from "../../content/branches";
import { bevelBox } from "./bevel";

export const BLAST_HEIGHT = 0.36;

const blastMaterials = new Map<Branch, MeshBasicMaterial>();

/** The slab, centred on the origin (lift it by `BLAST_HEIGHT / 2` to sit on the floor). */
export function blastGeometry(): BufferGeometry {
  return bevelBox(1, BLAST_HEIGHT, 1, 0.12);
}

/** The glow of a branch: its colour pushed towards white and over-bright, see-through and unlit. */
export function blastMaterial(branch: Branch): MeshBasicMaterial {
  let glow = blastMaterials.get(branch);
  if (!glow) {
    glow = new MeshBasicMaterial({
      color: new Color(BRANCH_COLOURS[branch]).lerp(new Color("#ffffff"), 0.22).multiplyScalar(1.3),
      transparent: true,
      opacity: 0.86,
      toneMapped: false,
      depthWrite: false,
    });
    blastMaterials.set(branch, glow);
  }
  return glow;
}

/** A single blast tile sitting on y = 0. It casts no shadow: it is light. */
export function buildBlastTile(branch: Branch): Mesh {
  const tile = new Mesh(blastGeometry(), blastMaterial(branch));
  tile.name = `blast-${branch}`;
  tile.position.y = BLAST_HEIGHT / 2;
  tile.castShadow = false;
  tile.receiveShadow = false;
  tile.renderOrder = 2;
  return tile;
}

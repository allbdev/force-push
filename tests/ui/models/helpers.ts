import { Box3, Mesh, type BufferGeometry, type Material, type Object3D } from "three";
import { expect } from "vitest";

/** The exact world-space bounds of an object (every vertex, hidden parts included). */
export function boundsOf(object: Object3D): Box3 {
  object.updateWorldMatrix(true, true);
  return new Box3().setFromObject(object, true);
}

export function meshesOf(object: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  object.traverse((child) => {
    if (child instanceof Mesh) meshes.push(child);
  });
  return meshes;
}

export function geometriesOf(object: Object3D): Set<BufferGeometry> {
  return new Set(meshesOf(object).map((mesh) => mesh.geometry as BufferGeometry));
}

export function materialsOf(object: Object3D): Set<Material> {
  return new Set(meshesOf(object).flatMap((mesh) => mesh.material as Material | Material[]));
}

/** True when no vertex and no transform under the object is NaN or infinite. */
export function isFinite3d(object: Object3D): boolean {
  object.updateMatrixWorld(true);
  let finite = true;
  object.traverse((child) => {
    if (!child.matrixWorld.elements.every(Number.isFinite)) finite = false;
    if (child instanceof Mesh) {
      const positions = (child.geometry as BufferGeometry).getAttribute("position").array;
      for (const value of positions) {
        if (!Number.isFinite(value)) finite = false;
      }
    }
  });
  return finite;
}

/** The model stands on the floor, inside its tile, and is no taller than `maxHeight`. */
export function expectFitsTile(object: Object3D, maxHeight: number, minHeight = 0.05): void {
  const box = boundsOf(object);
  expect(box.min.x).toBeGreaterThanOrEqual(-0.5);
  expect(box.max.x).toBeLessThanOrEqual(0.5);
  expect(box.min.z).toBeGreaterThanOrEqual(-0.5);
  expect(box.max.z).toBeLessThanOrEqual(0.5);
  expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
  expect(box.min.y).toBeLessThan(0.05);
  expect(box.max.y).toBeGreaterThan(minHeight);
  expect(box.max.y).toBeLessThanOrEqual(maxHeight);
}

/** Two builds share every geometry and material: nothing is allocated per instance. */
export function expectShared(first: Object3D, second: Object3D): void {
  expect(first).not.toBe(second);
  expect(geometriesOf(second)).toEqual(geometriesOf(first));
  expect(materialsOf(second)).toEqual(materialsOf(first));
  for (const mesh of meshesOf(first)) {
    expect(mesh.receiveShadow || mesh.castShadow || mesh.name.startsWith("blast")).toBe(true);
  }
}

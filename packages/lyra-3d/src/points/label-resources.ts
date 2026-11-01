import type { CanvasTexture, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

/** Label rendering resources, independent of semantic text and the application updater. */
export interface PointsLabelResources {
  canvas: HTMLCanvasElement | undefined;
  texture: CanvasTexture | undefined;
  material: ShaderMaterial | undefined;
  geometry: PlaneGeometry | undefined;
  mesh: Mesh<PlaneGeometry, ShaderMaterial> | undefined;
  disposed: boolean;
}

function inactiveDraw(): void {}

/** Clear ownership before callbacks and retire every independent label resource. */
export function disposePointsLabelResources(resources: PointsLabelResources): void {
  if (resources.disposed) return;
  resources.disposed = true;
  const { canvas, texture, material, geometry, mesh } = resources;
  resources.canvas = undefined; resources.texture = undefined; resources.material = undefined;
  resources.geometry = undefined; resources.mesh = undefined;
  if (mesh) { mesh.onBeforeRender = inactiveDraw; mesh.onAfterRender = inactiveDraw; }
  let failed = false, failure: unknown;
  const cleanup = (run: () => void): void => { try { run(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
  cleanup(() => { mesh?.removeFromParent(); });
  cleanup(() => { geometry?.dispose(); });
  cleanup(() => { material?.dispose(); });
  cleanup(() => { texture?.dispose(); });
  cleanup(() => { if (canvas) canvas.width = 1; });
  cleanup(() => { if (canvas) canvas.height = 1; });
  if (failed) throw failure;
}

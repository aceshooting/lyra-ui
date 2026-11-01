import type { InstancedBufferGeometry, Mesh, ShaderMaterial } from 'three';

type BatchMesh = Mesh<InstancedBufferGeometry, ShaderMaterial>;

/** Native point resources only; semantic rows and batch methods have a separate owner. */
export interface PointBatchResources {
  geometry: InstancedBufferGeometry | undefined;
  material: ShaderMaterial | undefined;
  pickMaterial: ShaderMaterial | undefined;
  mesh: BatchMesh | undefined;
  pick: BatchMesh | undefined;
  disposed: boolean;
}

/** Native visual-line resources, independent of their source endpoint array. */
export interface LineBatchResources {
  geometry: InstancedBufferGeometry | undefined;
  material: ShaderMaterial | undefined;
  mesh: BatchMesh | undefined;
  disposed: boolean;
}

function inactiveDraw(): void {}
function clearDrawHooks(mesh: BatchMesh | undefined): void {
  if (!mesh) return;
  mesh.onBeforeRender = inactiveDraw;
  mesh.onAfterRender = inactiveDraw;
}

/** Take ownership before callbacks and attempt every independent native resource release. */
export function disposePointBatchResources(resources: PointBatchResources): void {
  if (resources.disposed) return;
  resources.disposed = true;
  const { geometry, material, pickMaterial, mesh, pick } = resources;
  resources.geometry = undefined; resources.material = undefined; resources.pickMaterial = undefined;
  resources.mesh = undefined; resources.pick = undefined;
  clearDrawHooks(mesh); clearDrawHooks(pick);
  let failed = false, failure: unknown;
  const cleanup = (run: () => void): void => { try { run(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
  cleanup(() => { mesh?.removeFromParent(); });
  cleanup(() => { pick?.removeFromParent(); });
  cleanup(() => { material?.dispose(); });
  cleanup(() => { pickMaterial?.dispose(); });
  cleanup(() => { geometry?.dispose(); });
  if (failed) throw failure;
}

/** Shared by ordinary inline batches and later resource-only retirement owners. */
export function disposeLineBatchResources(resources: LineBatchResources): void {
  if (resources.disposed) return;
  resources.disposed = true;
  const { geometry, material, mesh } = resources;
  resources.geometry = undefined; resources.material = undefined; resources.mesh = undefined;
  clearDrawHooks(mesh);
  let failed = false, failure: unknown;
  const cleanup = (run: () => void): void => { try { run(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
  cleanup(() => { mesh?.removeFromParent(); });
  cleanup(() => { geometry?.dispose(); });
  cleanup(() => { material?.dispose(); });
  if (failed) throw failure;
}

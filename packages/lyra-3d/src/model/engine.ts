import { AmbientLight, Box3, Color, DirectionalLight, Line, LineBasicMaterial, Material, MeshBasicMaterial, Object3D, Points, PointsMaterial, PerspectiveCamera, Raycaster, SRGBColorSpace, Vector2, Vector3 } from 'three';
import { LYRA_3D_CONTRACT, type Lyra3dHost, type Lyra3dState, type Lyra3dStyle, type Lyra3dWorldPoint } from '../core/contract.js';
import { DEFAULT_ORBIT_CAMERA, LYRA_3D_FIELD_OF_VIEW, LYRA_3D_WORLD_LIMIT, orbitCameraPose, fitOrbitCamera, focusOrbitCamera, normalizeOrbitCamera, type Lyra3dOrbitCamera } from '../core/orbit.js';
import { DEFAULT_LYRA_3D_STYLE, type Lyra3dRgba } from '../core/style.js';
import { createLyra3dViewport, type Lyra3dViewport } from '../core/viewport.js';
import { createPointsEngine } from '../points/engine.js';
import type { PointsEngine, PointsEngineData } from '../points/types.js';
import { admitModel, ModelAdmissionError } from './admission.js';
import { snapshotModelInput } from './model-admission-policy.js';
import { aborted } from './model-parser-common.js';
import { createModelGpuAttributeWork, modelGpuAttributesNeedConversion } from './model-gpu-attributes.js';
import { runModelWork } from './model-work-runner.js';
import type { prepareModel } from './model-preparation.js';
import { parseModel, type ParsedModel } from './model-parsers.js';
import { MODEL_LIMITS } from './limits.js';
import type { ModelEngine } from './types.js';

interface ModelEngineServices {
  readonly viewport?: typeof createLyra3dViewport;
  readonly parse?: typeof parseModel;
  readonly prepare?: typeof prepareModel;
}
interface MaterialPaint { material: Material; highlight: Material; opacity: number; transparent: boolean }
interface Drawable { object: Object3D; center: Lyra3dWorldPoint; paints: MaterialPaint[]; array: boolean; original: Material | Material[] }
interface InstalledModel { parsed: ParsedModel; drawables: Drawable[]; points?: PointsEngine; conversion?: AbortController; released?: boolean }
const emptyState = (): Lyra3dState => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 });
function color(target: Color, value: Lyra3dRgba): void { target.setRGB(value.r, value.g, value.b, SRGBColorSpace); }
function release(model: InstalledModel | undefined): void {
  if (!model || model.released) return;
  model.released = true; model.conversion?.abort();
  for (const drawable of model.drawables) {
    (drawable.object as Object3D & { material: Material | Material[] }).material = drawable.original;
    for (const saved of drawable.paints) for (const material of [saved.material, saved.highlight]) {
      try { material.dispose(); } catch { /* Continue releasing all owned materials. */ }
    }
  }
  try { model.points?.dispose(); } catch { /* Continue releasing the parsed asset. */ }
  try { model.parsed.dispose(); } catch { /* Parsed disposal attempts every owned resource. */ }
}
function worldBounds(parsed: ParsedModel): void {
  if (!parsed.bounds) return;
  for (const value of [...parsed.bounds.min.toArray(), ...parsed.bounds.max.toArray()]) {
    if (!Number.isFinite(value) || Math.abs(value) > LYRA_3D_WORLD_LIMIT) throw new RangeError('Model exceeds the renderer world range');
  }
}
function pointData(parsed: ParsedModel): PointsEngineData | null {
  const clouds: Points[] = []; let other = false; let count = 0; let hasColors = false;
  parsed.object.updateMatrixWorld(true);
  parsed.object.traverse((object) => {
    if (object instanceof Points) {
      const material = object.material;
      if (!(material instanceof PointsMaterial) || material.map || material.opacity !== 1 || material.transparent || material.alphaTest > 0 || object.geometry.getAttribute('color')?.itemSize === 4) { other = true; return; }
      clouds.push(object); count += object.geometry.index?.count ?? object.geometry.getAttribute('position').count;
      hasColors ||= object.geometry.hasAttribute('color') || material.color.r !== 1 || material.color.g !== 1 || material.color.b !== 1;
    }
    else if ('geometry' in object) other = true;
  });
  if (other || !clouds.length || count > MODEL_LIMITS.vertices) return null;
  const positions = new Float32Array(count * 3); const colors = hasColors ? new Float32Array(count * 3) : undefined;
  const point = new Vector3(); let offset = 0;
  for (const cloud of clouds) {
    const position = cloud.geometry.getAttribute('position'); const rgb = cloud.geometry.getAttribute('color');
    const index = cloud.geometry.index; const tint = (cloud.material as PointsMaterial).color;
    for (let row = 0; row < (index?.count ?? position.count); row++) {
      const i = index?.getX(row) ?? row;
      point.fromBufferAttribute(position, i).applyMatrix4(cloud.matrixWorld);
      positions[offset] = point.x; positions[offset + 1] = point.y; positions[offset + 2] = point.z;
      if (colors) { colors[offset] = (rgb?.getX(i) ?? 1) * tint.r; colors[offset + 1] = (rgb?.getY(i) ?? 1) * tint.g; colors[offset + 2] = (rgb?.getZ(i) ?? 1) * tint.b; }
      offset += 3;
    }
  }
  return { positions, colors, mode: '3d' };
}
function drawableData(parsed: ParsedModel): { drawables: Drawable[]; convert: boolean } {
  let convert = false;
  const result: Drawable[] = []; const center = new Vector3();
  parsed.object.updateMatrixWorld(true);
  parsed.object.traverse((object) => {
    if (!('geometry' in object) || !('material' in object)) return;
    convert ||= modelGpuAttributesNeedConversion(object);
    const current = object as Object3D & { material: Material | Material[] };
    const original = current.material;
    const materials = Array.isArray(original) ? original : [original];
    const clones = materials.map((material) => material.clone());
    current.material = Array.isArray(current.material) ? clones : clones[0]!;
    const paints = clones.map((material): MaterialPaint => {
      const highlight = object instanceof Points ? new PointsMaterial({ size: (material as PointsMaterial).size, sizeAttenuation: (material as PointsMaterial).sizeAttenuation }) : object instanceof Line ? new LineBasicMaterial() : new MeshBasicMaterial({ side: material.side });
      return { material, highlight, opacity: material.opacity, transparent: material.transparent };
    });
    new Box3().setFromObject(object).getCenter(center);
    result.push({ object, center: { x: center.x, y: center.y, z: center.z }, paints, array: Array.isArray(current.material), original });
  });
  return { drawables: result, convert };
}

/** A model renderer with atomic admitted revisions and owned asynchronous parser lifetimes. */
export function createModelEngine(services: ModelEngineServices = {}): ModelEngine {
  let viewport: Lyra3dViewport | undefined; let host: Lyra3dHost | undefined;
  let current: InstalledModel | undefined; let revision = -1; let generation = 0;
  let controller: AbortController | undefined; let mounted = false; let disposed = false; let pendingFailure = false; let pendingProgress: readonly [number, number] | undefined;
  let style: Lyra3dStyle = DEFAULT_LYRA_3D_STYLE; let state = emptyState();
  let camera: Lyra3dOrbitCamera = DEFAULT_ORBIT_CAMERA; let authoredCamera = false;
  let ambient: AmbientLight | undefined; let directional: DirectionalLight | undefined;
  const raycaster = new Raycaster(); const pointer = new Vector2(); const rayCamera = new PerspectiveCamera(LYRA_3D_FIELD_OF_VIEW * 180 / Math.PI);
  const paint = (): void => {
    if (!viewport || disposed) return;
    const resolved = viewport.style;
    if (current?.points) { current.points.setStyle(style); current.points.setState?.(state); }
    else current?.drawables.forEach((drawable, index) => {
      const selected = state.selected.has(index) || state.hover === index;
      const override = state.focus === index || selected || resolved.forcedColors;
      const painted = drawable.paints.map((saved) => {
        const material = override ? saved.highlight : saved.material;
        if (override && 'color' in material && material.color instanceof Color) color(material.color, state.focus === index ? resolved.focus : selected ? resolved.accent : resolved.foreground);
        const dimmed = !resolved.forcedColors && state.dimmed.has(index);
        material.opacity = dimmed ? saved.opacity * 0.3 : saved.opacity;
        material.transparent = dimmed || saved.transparent;
        return material;
      });
      (drawable.object as Object3D & { material: Material | Material[] }).material = drawable.array ? painted : painted[0]!;
    });
    viewport.invalidate();
  };
  const pick = (x: number, y: number): number | null => {
    if (!viewport || disposed || viewport.lost || !current || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > viewport.width || y > viewport.height) return null;
    if (current.points) return current.points.pick?.(x, y) ?? null;
    pointer.set(x / viewport.width * 2 - 1, 1 - y / viewport.height * 2);
    const pose = orbitCameraPose(viewport.orbit);
    rayCamera.aspect = viewport.width / viewport.height; rayCamera.near = pose.near; rayCamera.far = Math.max(pose.near * 10, viewport.orbit.distance * 4 + 1e4);
    rayCamera.position.fromArray(pose.position); rayCamera.up.fromArray(pose.up); rayCamera.lookAt(...pose.target); rayCamera.updateProjectionMatrix(); rayCamera.updateMatrixWorld();
    raycaster.near = rayCamera.near; raycaster.far = rayCamera.far;
    viewport.scene.updateMatrixWorld(true); raycaster.setFromCamera(pointer, rayCamera);
    const hits = raycaster.intersectObjects(current.drawables.map((entry) => entry.object), false);
    if (!hits.length) return null;
    const index = current.drawables.findIndex((entry) => entry.object === hits[0]!.object); return index < 0 ? null : index;
  };
  const fit = (padding?: number): Lyra3dOrbitCamera => {
    camera = current?.points?.fit?.(padding) ?? fitOrbitCamera(current?.parsed.bounds ?? null, viewport ?? { width: 1, height: 1 }, padding);
    viewport?.setOrbit(camera); return camera;
  };
  const install = async (parsed: ParsedModel, expected: number, refreshing?: InstalledModel, completed?: () => void, signal?: AbortSignal): Promise<void> => {
    const candidate: InstalledModel = refreshing ?? { parsed, drawables: [] };
    let conversion: AbortController | undefined;
    let previous: InstalledModel | undefined; let committed = false;
    try {
      worldBounds(parsed);
      if (viewport) {
        const data = pointData(parsed);
        if (data) {
          const shared = new Proxy(viewport, { get(target, key) { return key === 'dispose' ? () => undefined : Reflect.get(target, key); } });
          candidate.points = createPointsEngine({ viewport: () => shared });
          candidate.points.setData(data, 0); candidate.points.setStyle(style); candidate.points.setState?.(state); candidate.points.setCamera(viewport.orbit);
          await candidate.points.mount({} as HTMLElement, host!);
        } else {
          const drawing = drawableData(parsed); candidate.drawables = drawing.drawables;
          if (drawing.convert) {
            if (refreshing) { conversion = new AbortController(); candidate.conversion = conversion; }
            await runModelWork(createModelGpuAttributeWork(candidate.drawables), conversion?.signal ?? signal);
          }
        }
      }
      if (disposed || (refreshing ? current !== refreshing : generation !== expected)) { release(candidate); return; }
      previous = current; current = candidate; committed = true;
      if (viewport && !candidate.points) viewport.world.add(parsed.object);
      if ((!previous || refreshing) && !authoredCamera && viewport) fit();
      paint(); completed?.(); if (previous?.parsed !== parsed) release(previous);
    } catch (error) {
      if (committed) current = previous;
      release(candidate);
      if (refreshing && (disposed || current !== refreshing)) return;
      throw error;
    } finally { if (conversion && candidate.conversion === conversion) candidate.conversion = undefined; }
  };
  const positionOf = (item: number): Lyra3dWorldPoint | null => {
    if (!Number.isSafeInteger(item) || item < 0) return null;
    if (current?.points) return current.points.positionOf?.(item) ?? null;
    const center = current?.drawables[item]?.center; return center ? { ...center } : null;
  };
  return {
    contract: LYRA_3D_CONTRACT,
    async mount(container, nextHost) {
      if (disposed || mounted) throw new Error('Model engine cannot be mounted twice');
      mounted = true; host = nextHost;
      const created = (services.viewport ?? createLyra3dViewport)(container, {
        hover: (item) => { if (!disposed) host?.hover(item); },
        pick: (item, modifiers) => { if (!disposed) host?.pick(item, modifiers); },
        camera: (value) => { if (!disposed) { camera = normalizeOrbitCamera(value, camera); authoredCamera = true; host?.camera(camera); } },
        lost: (reason, detail) => { if (!disposed) host?.lost(reason, detail); },
        rendering: (info) => { if (!disposed) host?.rendering?.(info); },
        restored: () => { if (!disposed) host?.restored?.(); },
      }, { pick, onRestore: paint });
      if (disposed) { created.dispose(); return; }
      viewport = created; viewport.setStyle(style); viewport.setOrbit(camera);
      ambient = new AmbientLight(0xffffff, 0.8); directional = new DirectionalLight(0xffffff, 1.8); directional.position.set(1, -1, 2);
      viewport.scene.add(ambient, directional);
      if (current) {
        const pending = current;
        await install(pending.parsed, generation, pending, undefined, controller?.signal);
      }
      paint();
      if (pendingProgress && !disposed) { host?.progress?.(...pendingProgress); pendingProgress = undefined; }
      if (pendingFailure && !disposed) { pendingFailure = false; host?.lost('error', 'model-parse-failed'); }
    },
    setData(data, nextRevision) {
      if (disposed) return;
      if (!Number.isSafeInteger(nextRevision) || nextRevision <= revision) throw new RangeError('Model revision must increase');
      const admitted = admitModel(data.bytes, data.format);
      revision = nextRevision; pendingFailure = false; pendingProgress = undefined; const expected = ++generation;
      controller?.abort(); controller = new AbortController(); const signal = controller.signal;
      void (services.parse ?? parseModel)(admitted, { signal }).then(async (parsed) => {
        if (disposed || expected !== generation) { release({ parsed, drawables: [] }); return; }
        await install(parsed, expected, undefined, undefined, signal);
        if (!disposed && expected === generation) {
          if (host) host.progress?.(admitted.encodedBytes, admitted.encodedBytes); else pendingProgress = [admitted.encodedBytes, admitted.encodedBytes];
        }
      }).catch(() => {
        if (!disposed && expected === generation) {
          if (host) host.lost('error', 'model-parse-failed'); else pendingFailure = true;
        }
      });
    },
    async setDataAsync(data, nextRevision, options = {}) {
      if (disposed) throw new DOMException('Model engine is disposed', 'AbortError');
      if (!Number.isSafeInteger(nextRevision) || nextRevision <= revision) throw new RangeError('Model revision must increase');
      const signal = options.signal;
      aborted(signal);
      const owned = snapshotModelInput(data.bytes, data.format);
      if (disposed) throw new DOMException('Model engine is disposed', 'AbortError');
      if (nextRevision <= revision) throw new RangeError('Model revision must increase');
      aborted(signal);
      revision = nextRevision; pendingFailure = false; pendingProgress = undefined; const expected = ++generation;
      controller?.abort(); const active = new AbortController(); controller = active;
      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const cleanup = (): void => { active.signal.removeEventListener('abort', cancelled); signal?.removeEventListener('abort', external); };
        const fail = (error: unknown): void => { if (settled) return; settled = true; cleanup(); reject(error); };
        const cancelled = (): void => {
          if (expected === generation) generation++;
          fail(new DOMException('Model preparation was aborted', 'AbortError'));
        };
        const external = (): void => active.abort();
        active.signal.addEventListener('abort', cancelled, { once: true }); signal?.addEventListener('abort', external, { once: true });
        if (signal?.aborted) external();
        const execute = async (): Promise<void> => {
          let parsed: ParsedModel | undefined;
          try {
            aborted(active.signal);
            const prepare = services.prepare ?? (await import('./model-preparation.js')).prepareModel;
            aborted(active.signal); parsed = await prepare(owned, { signal: active.signal });
            if (disposed || expected !== generation || active.signal.aborted) throw new DOMException('Model preparation was aborted', 'AbortError');
            const candidate = parsed; parsed = undefined;
            await install(candidate, expected, undefined, () => {
              settled = true; cleanup(); resolve();
              if (host) { try { host.progress?.(owned.bytes.length, owned.bytes.length); } catch { /* A host notification cannot undo a committed model. */ } }
              else pendingProgress = [owned.bytes.length, owned.bytes.length];
            }, active.signal);
            if (!settled) throw new DOMException('Model preparation was aborted', 'AbortError');
          } catch (error) {
            if (parsed) release({ parsed, drawables: [] });
            if (settled) return;
            if (disposed || expected !== generation || active.signal.aborted) { fail(new DOMException('Model preparation was aborted', 'AbortError')); return; }
            try { if (host) host.lost('error', 'model-parse-failed'); else pendingFailure = true; }
            catch { /* Preserve the preparation failure if a host callback throws. */ }
            fail(error instanceof ModelAdmissionError ? error : new ModelAdmissionError('invalid'));
          }
        };
        void execute();
      });
    },
    setStyle(next) { if (!disposed) { style = next; viewport?.setStyle(next); paint(); } },
    setState(next) { if (!disposed) { state = { ...next, selected: new Set(next.selected), dimmed: new Set(next.dimmed) }; paint(); } },
    setCamera(next) { if (!disposed) { authoredCamera = true; camera = normalizeOrbitCamera(next, camera); viewport?.setOrbit(camera); } },
    fit,
    focus(item, distance) {
      const point = positionOf(item); if (!point) return null;
      camera = focusOrbitCamera(viewport?.orbit ?? camera, point, distance); viewport?.setOrbit(camera); return camera;
    },
    pick,
    positionOf,
    project(item) { const point = positionOf(item); return point ? viewport?.project(point) ?? null : null; },
    resize(width, height) { if (!disposed) { viewport?.resize(width, height); current?.points?.resize(width, height); viewport?.invalidate(); } },
    dispose() {
      if (disposed) return; disposed = true; generation++; controller?.abort();
      release(current); current = undefined;
      ambient?.removeFromParent(); directional?.removeFromParent(); viewport?.dispose(); viewport = undefined; host = undefined;
    },
  };
}

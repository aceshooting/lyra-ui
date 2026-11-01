import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { Lyra3dGlow } from './glow.js';
import type { Lyra3dIdPicker } from './picking.js';

/** Actual renderer resources, independent of application and viewport callback ownership. */
export interface ViewportResourceRecord {
  readonly renderer: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly scene: Scene;
  readonly pickScene: Scene;
  readonly camera: PerspectiveCamera;
  picker: Lyra3dIdPicker | undefined;
  glow: Lyra3dGlow | undefined;
  restoreContextMethods: ((this: void) => void) | undefined;
  transferred: boolean;
  extrasRetired: boolean;
}

export interface ViewportResourceInput {
  readonly renderer: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly scene: Scene;
  readonly pickScene: Scene;
  readonly camera: PerspectiveCamera;
  readonly picker: Lyra3dIdPicker;
  readonly glow?: Lyra3dGlow;
  readonly restoreContextMethods: (this: void) => void;
}

/** Copy only owned resource handles; the input bag is never retained. */
export function createViewportResources(input: ViewportResourceInput): ViewportResourceRecord {
  return {
    renderer: input.renderer, canvas: input.canvas, scene: input.scene, pickScene: input.pickScene,
    camera: input.camera, picker: input.picker, glow: input.glow,
    restoreContextMethods: input.restoreContextMethods, transferred: false, extrasRetired: false,
  };
}

/** Exchange inline glow ownership without allocating, rendering or disposing either handle. */
export function replaceViewportGlow(resources: ViewportResourceRecord, next: Lyra3dGlow | undefined): Lyra3dGlow | undefined {
  if (resources.transferred || resources.extrasRetired) {
    throw new DOMException('Viewport resources are no longer inline.', 'InvalidStateError');
  }
  const previous = resources.glow;
  if (previous === next) return undefined;
  resources.glow = next;
  return previous;
}

/** Retire picker/glow only; renderer, scene resources, context and canvas have separate owners. */
export function retireViewportExtras(resources: ViewportResourceRecord): void {
  if (resources.extrasRetired) return;
  resources.extrasRetired = true;
  const glow = resources.glow, picker = resources.picker;
  resources.glow = undefined; resources.picker = undefined;
  let failed = false, failure: unknown;
  try { glow?.dispose(); } catch (error) { failed = true; failure = error; }
  try { picker?.dispose(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
}

/** Requires extras retirement and the caller's completed or attempted renderer disposal. */
export function restoreViewportContextMethods(resources: ViewportResourceRecord): void {
  if (!resources.extrasRetired) {
    throw new DOMException('Viewport extras have not retired.', 'InvalidStateError');
  }
  // Keep stale-handle guards installed through renderer disposal after context loss.
  const restore = resources.restoreContextMethods;
  resources.restoreContextMethods = undefined;
  restore?.();
}

/** Construct cleanup in a scope containing only the resource record. */
export function viewportResourceRetirement(resources: ViewportResourceRecord): () => void {
  return () => { retireViewportExtras(resources); };
}

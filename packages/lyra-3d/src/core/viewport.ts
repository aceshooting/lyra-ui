import {
  Color,
  Group,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import type { Lyra3dHost, Lyra3dPickModifiers, Lyra3dStyle, Lyra3dWorldPoint } from './contract.js';
import {
  DEFAULT_ORBIT_CAMERA,
  LYRA_3D_FIELD_OF_VIEW,
  interpolateOrbit,
  normalizeOrbitCamera,
  orbitBy,
  orbitCameraPose,
  panBy,
  projectOrbitPoint,
  zoomBy,
  type Lyra3dOrbitCamera,
  type Lyra3dProjectedPoint,
} from './orbit.js';
import { Lyra3dIdPicker } from './picking.js';
import { guardContextEpoch } from './context-epoch.js';
import { resolveLyra3dStyle, type Lyra3dRgba, type ResolvedLyra3dStyle } from './style.js';

/** Thrown by {@link createLyra3dViewport} when the browser cannot create a WebGL2 context. */
export class Lyra3dUnsupportedError extends Error {
  readonly code = 'webgl-unavailable';
  constructor(message = 'WebGL2 is not available.') {
    super(message);
    this.name = 'Lyra3dUnsupportedError';
  }
}

/** Pointer movement, in CSS pixels, below which a press counts as a click rather than a drag. */
const CLICK_SLOP = 5;
const ORBIT_RADIANS_PER_PIXEL = 0.008;
/** Camera transitions; reduced motion replaces them with an immediate jump. */
const TRANSITION_MS = 320;

type GlContext = WebGL2RenderingContext | WebGLRenderingContext;

function releaseContext(context: GlContext | null): void {
  if (context && !context.isContextLost()) context.getExtension('WEBGL_lose_context')?.loseContext();
}

/**
 * Whether the browser only offers WebGL2 with a major performance caveat (software rasterization).
 * The probe context is released at once, so it does not count against the page's context budget.
 */
export function probeSoftwareRendering(createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')): boolean {
  const context = createCanvas().getContext('webgl2', { failIfMajorPerformanceCaveat: true });
  releaseContext(context);
  return context === null;
}

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|lavapipe|software|microsoft basic render/iu;

/** Whether a WebGL renderer string names a software rasterizer (SwiftShader, llvmpipe and similar). */
export function isSoftwareRendererName(name: unknown): boolean {
  return typeof name === 'string' && SOFTWARE_RENDERER.test(name);
}

/**
 * The renderer string of a context: the plain `RENDERER` parameter, or the unmasked one when the
 * browser reports only a generic name and still offers the debug extension.
 */
function rendererName(gl: GlContext): string {
  const plain: unknown = gl.getParameter(gl.RENDERER);
  if (typeof plain === 'string' && !/^webkit webgl$/iu.test(plain.trim())) return plain;
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const unmasked: unknown = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : undefined;
  return typeof unmasked === 'string' ? unmasked : typeof plain === 'string' ? plain : '';
}

export interface Lyra3dViewportOptions {
  readonly antialias?: boolean;
  /** Evaluated at primary press: true pans instead of orbiting. Missing or false keeps orbit. */
  readonly primaryPan?: () => boolean;
  /** Whether a wheel event zooms; by default the page keeps scrolling over the view. */
  readonly wheelZoom?: (event: WheelEvent) => boolean;
  /**
   * Item under a CSS-pixel point, used for hover and activation. Defaults to
   * {@link Lyra3dViewport.pickAt}; `null` turns hover and activation off.
   */
  readonly pick?: ((x: number, y: number) => number | null) | null;
  /** Applies camera limits after every gesture (zoom range, locked pitch). */
  readonly constrain?: (camera: Lyra3dOrbitCamera) => Lyra3dOrbitCamera;
  /** Runs after a restored context got its renderer state back, before {@link Lyra3dHost.restored}. */
  readonly onRestore?: () => void;
}

export interface Lyra3dViewport {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  /** Add content here in world units; it is mirrored on `y` to keep the y-down convention. */
  readonly world: Group;
  /** A scene for id-colored pick meshes, mirrored like {@link Lyra3dViewport.world}. */
  readonly pickScene: Scene;
  readonly pickWorld: Group;
  readonly camera: PerspectiveCamera;
  /**
   * Whether the context renders in software: the browser refused a context without a major
   * performance caveat, or the renderer names a software rasterizer.
   */
  readonly software: boolean;
  readonly width: number;
  readonly height: number;
  readonly orbit: Lyra3dOrbitCamera;
  readonly style: ResolvedLyra3dStyle;
  readonly lost: boolean;
  readonly disposed: boolean;
  /** Moves the camera without notifying the host, cancelling a running transition. */
  setOrbit(camera: Lyra3dOrbitCamera): void;
  /** Moves to `camera`, animated unless the style asks for reduced motion; the host is notified. */
  transitionTo(camera: Lyra3dOrbitCamera): void;
  setStyle(style: Lyra3dStyle): ResolvedLyra3dStyle;
  resize(width: number, height: number): void;
  /** Schedules one render on the next animation frame. */
  invalidate(): void;
  /** Runs `callback` before every render; returns an unsubscribe function. */
  onFrame(callback: (time: number) => void): () => void;
  /** The item at a CSS-pixel point in {@link Lyra3dViewport.pickScene}, rendered now. */
  pickAt(x: number, y: number): number | null;
  project(point: Lyra3dWorldPoint): Lyra3dProjectedPoint | null;
  /** Renders immediately (tests, and engines that need a synchronous frame). */
  renderNow(): void;
  dispose(): void;
}

function setColor(target: Color, value: Lyra3dRgba): Color {
  return target.setRGB(value.r, value.g, value.b, SRGBColorSpace);
}

function mirroredGroup(): Group {
  const group = new Group();
  group.scale.set(1, -1, 1);
  return group;
}

/**
 * Creates the renderer, scene, orbit camera and pointer handling every engine shares, inside
 * `container`. The viewport owns its canvas: a fallback renderer always gets a fresh canvas,
 * because a canvas cannot change from a WebGL to a 2D context.
 *
 * Pointer input belongs to the viewport (drag to orbit, Shift-drag or a secondary button to pan,
 * optional wheel zoom, hover and activation through `options.pick`); keyboard input stays with
 * the component, which drives the camera through {@link Lyra3dViewport.transitionTo}.
 */
export function createLyra3dViewport(container: HTMLElement, host: Lyra3dHost, options: Lyra3dViewportOptions = {}): Lyra3dViewport {
  const caveat = probeSoftwareRendering();
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.inlineSize = '100%';
  canvas.style.blockSize = '100%';
  canvas.style.touchAction = 'none';
  let renderer: WebGLRenderer;
  let ownedContext: WebGL2RenderingContext | null = null;
  let restoreContextMethods: () => void = () => {};
  try {
    const attributes: WebGLContextAttributes = {
      alpha: true, depth: true, stencil: false, antialias: options.antialias ?? !caveat,
      premultipliedAlpha: true, preserveDrawingBuffer: false,
      powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false,
    };
    ownedContext = canvas.getContext('webgl2', attributes);
    if (!ownedContext) throw new Lyra3dUnsupportedError();
    restoreContextMethods = guardContextEpoch(ownedContext);
    renderer = new WebGLRenderer({ canvas, context: ownedContext, ...attributes });
  } catch {
    try { releaseContext(ownedContext); } finally { restoreContextMethods(); }
    throw new Lyra3dUnsupportedError();
  }
  let ownedPicker: Lyra3dIdPicker | undefined;
  let stopInitialization: (() => void) | undefined;
  const installedListeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];
  try {
    const gl = renderer.getContext();
    if (typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) {
      throw new Lyra3dUnsupportedError();
    }
    renderer.outputColorSpace = SRGBColorSpace;
    const software = caveat || isSoftwareRendererName(rendererName(gl));

    const scene = new Scene();
    const world = mirroredGroup();
    scene.add(world);
    const pickScene = new Scene();
    const pickWorld = mirroredGroup();
    pickScene.add(pickWorld);
    const camera = new PerspectiveCamera((LYRA_3D_FIELD_OF_VIEW * 180) / Math.PI, 1, 0.01, 1e8);
    const picker = ownedPicker = new Lyra3dIdPicker(renderer);
    const clear = new Color();
    const frameCallbacks = new Set<(time: number) => void>();
    const pick = options.pick === null ? undefined : (options.pick ?? ((x: number, y: number) => viewport.pickAt(x, y)));
    const constrain = (value: Lyra3dOrbitCamera) => (options.constrain ? normalizeOrbitCamera(options.constrain(value), value) : value);

    let style = resolveLyra3dStyle(undefined);
    let width = 1;
    let height = 1;
    let orbit: Lyra3dOrbitCamera = DEFAULT_ORBIT_CAMERA;
    let lost = false;
    let failed = false;
    let disposed = false;
    let frame = 0;
    let cameraChanged = false;
    let transition: { from: Lyra3dOrbitCamera; to: Lyra3dOrbitCamera; start: number } | undefined;
    let hoverPoint: { x: number; y: number } | undefined;
    /** The last pointer position over the canvas, re-picked after a restored context. */
    let pointer: { x: number; y: number } | undefined;
    let hovered: number | null = null;
    let gesture: { id: number; startX: number; startY: number; x: number; y: number; moved: boolean; pan: boolean } | undefined;
    let suppressContextMenu = false;

    const stopInteraction = (preservePointer = false) => {
      const captured = gesture?.id;
      gesture = undefined;
      transition = undefined;
      cameraChanged = false;
      hoverPoint = undefined;
      if (!preservePointer) pointer = undefined;
      suppressContextMenu = false;
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
      if (captured !== undefined) {
        try { canvas.releasePointerCapture(captured); } catch { /* Capture may already be released. */ }
      }
    };
    stopInitialization = () => { disposed = true; stopInteraction(); frameCallbacks.clear(); };
    // Host callbacks stay outside the renderer catch so application errors remain observable.
    const renderOperation = (operation: () => void): boolean => {
      let threw = false;
      try { operation(); } catch { threw = true; }
      if (threw) {
        if (!disposed && !failed) {
          failed = true;
          lost = true;
          stopInteraction();
          if (!disposed) host.lost('error', 'Rendering failed.');
        }
        return false;
      }
      return !disposed && !lost;
    };
    const applyCamera = () => {
      const pose = orbitCameraPose(orbit);
      camera.position.set(...pose.position);
      camera.up.set(...pose.up);
      camera.lookAt(...pose.target);
      camera.near = pose.near;
      camera.far = Math.max(pose.near * 10, orbit.distance * 4 + 1e4);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    };
    const applyRendererState = () => {
      renderer.setPixelRatio(style.devicePixelRatio);
      renderer.setSize(width, height, false);
      renderer.setClearColor(setColor(clear, style.background), style.background.a);
    };
    const render = (time: number) => {
      if (disposed || lost) return;
      if (transition) {
        const t = Math.min(1, (time - transition.start) / TRANSITION_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        orbit = interpolateOrbit(transition.from, transition.to, eased);
        cameraChanged = true;
        if (t >= 1) {
          orbit = transition.to;
          transition = undefined;
        }
      }
      for (const callback of frameCallbacks) {
        callback(time);
        if (disposed || lost) return;
      }
      applyCamera();
      if (!renderOperation(() => { renderer.render(scene, camera); })) return;
      if (cameraChanged) {
        cameraChanged = false;
        host.camera(orbit);
        if (disposed || lost) return;
      }
      if (hoverPoint && !gesture && pick) {
        const item = pick(hoverPoint.x, hoverPoint.y);
        if (disposed || lost) return;
        hoverPoint = undefined;
        if (item !== hovered) {
          hovered = item;
          host.hover(item);
        }
      }
      if (transition) invalidate();
    };
    const tick = (time: number) => {
      frame = 0;
      render(time);
    };
    function invalidate(): void {
      if (!disposed && !lost && frame === 0) frame = requestAnimationFrame(tick);
    }
    const userCamera = (next: Lyra3dOrbitCamera) => {
      if (disposed || lost) return;
      const target = constrain(next);
      if (disposed || lost) return;
      transition = undefined;
      orbit = target;
      cameraChanged = true;
      invalidate();
    };
    const local = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const modifiers = (event: MouseEvent, double: boolean): Lyra3dPickModifiers => ({
      shift: event.shiftKey,
      ctrl: event.ctrlKey || event.metaKey,
      double,
    });

    const pointerDown = (event: PointerEvent) => {
      if (disposed || lost || gesture || (event.button !== 0 && event.button !== 1 && event.button !== 2)) return;
      const pan = event.shiftKey || event.button !== 0 || options.primaryPan?.() === true;
      if (disposed || lost) return;
      gesture = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        pan,
      };
      suppressContextMenu = event.button === 2;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointers have no capture to set.
      }
    };
    const pointerMove = (event: PointerEvent) => {
      if (disposed || lost) return;
      pointer = local(event);
      if (!gesture) {
        hoverPoint = pointer;
        invalidate();
        return;
      }
      if (gesture.id !== event.pointerId) return;
      gesture.moved ||= Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > CLICK_SLOP;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      if (!gesture.moved) return;
      userCamera(gesture.pan ? panBy(orbit, dx, dy, { width, height }) : orbitBy(orbit, dx * ORBIT_RADIANS_PER_PIXEL, -dy * ORBIT_RADIANS_PER_PIXEL));
    };
    const endGesture = (event: PointerEvent, activate: boolean) => {
      const current = gesture;
      if (!current || current.id !== event.pointerId) return;
      gesture = undefined;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Already released.
      }
      if (!disposed && !lost && activate && event.button === 0 && !current.moved && pick) {
        const point = local(event);
        const item = pick(point.x, point.y);
        if (!disposed && !lost) host.pick(item, modifiers(event, false));
      }
    };
    const pointerUp = (event: PointerEvent) => endGesture(event, true);
    const pointerCancel = (event: PointerEvent) => endGesture(event, false);
    const pointerLeave = () => {
      hoverPoint = undefined;
      pointer = undefined;
      if (!disposed && !lost && !gesture && hovered !== null) {
        hovered = null;
        host.hover(null);
      }
    };
    const doubleClick = (event: MouseEvent) => {
      if (!pick || disposed || lost) return;
      const point = local(event);
      const item = pick(point.x, point.y);
      if (!disposed && !lost) host.pick(item, modifiers(event, true));
    };
    const wheel = (event: WheelEvent) => {
      if (disposed || lost || !options.wheelZoom?.(event)) return;
      if (disposed || lost) return;
      event.preventDefault();
      const delta = Math.min(300, Math.max(-300, Number.isFinite(event.deltaY) ? event.deltaY : 0));
      userCamera(zoomBy(orbit, Math.exp(delta * 0.002)));
    };
    const contextMenu = (event: MouseEvent) => {
      if (!suppressContextMenu) return;
      suppressContextMenu = false;
      event.preventDefault();
    };
    const contextLost = () => {
      if (disposed || lost) return;
      lost = true;
      stopInteraction(true);
      if (!disposed) host.lost('context-lost');
    };
    const contextRestored = () => {
      // The renderer restores its programs and buffers itself, but not renderer-level state such as
      // the clear color, so every setting is applied again before the first restored frame.
      if (disposed || failed || !lost) return;
      lost = false;
      if (!renderOperation(applyRendererState)) return;
      options.onRestore?.();
      if (disposed || lost) return;
      // The item under a resting pointer is checked again against the restored pick scene.
      if (pointer && !gesture) hoverPoint = pointer;
      invalidate();
      host.restored?.();
    };
    const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
      [canvas, 'pointerdown', pointerDown as EventListener],
      [canvas, 'pointermove', pointerMove as EventListener],
      [canvas, 'pointerup', pointerUp as EventListener],
      [canvas, 'pointercancel', pointerCancel as EventListener],
      [canvas, 'lostpointercapture', pointerCancel as EventListener],
      [canvas, 'pointerleave', pointerLeave],
      [canvas, 'dblclick', doubleClick as EventListener],
      [canvas, 'wheel', wheel as EventListener, { passive: false }],
      [canvas, 'contextmenu', contextMenu as EventListener],
      [canvas, 'webglcontextlost', contextLost],
      [canvas, 'webglcontextrestored', contextRestored],
    ];
    for (const entry of listeners) {
      installedListeners.push(entry);
      const [target, type, listener, listenerOptions] = entry;
      target.addEventListener(type, listener, listenerOptions);
    }

    container.append(canvas);
    applyRendererState();
    applyCamera();
    host.rendering?.({ software });

    const viewport: Lyra3dViewport = {
      canvas,
      renderer,
      scene,
      world,
      pickScene,
      pickWorld,
      camera,
      software,
      get width() {
        return width;
      },
      get height() {
        return height;
      },
      get orbit() {
        return orbit;
      },
      get style() {
        return style;
      },
      get lost() {
        return lost;
      },
      get disposed() {
        return disposed;
      },
      setOrbit(next) {
        transition = undefined;
        cameraChanged = false;
        orbit = normalizeOrbitCamera(next, orbit);
        invalidate();
      },
      transitionTo(next) {
        if (disposed || lost) return;
        const target = constrain(normalizeOrbitCamera(next, orbit));
        if (disposed || lost) return;
        if (style.reducedMotion) {
          transition = undefined;
          orbit = target;
          cameraChanged = true;
          invalidate();
          return;
        }
        transition = { from: orbit, to: target, start: performance.now() };
        invalidate();
      },
      setStyle(next) {
        style = resolveLyra3dStyle(next);
        if (style.reducedMotion && transition) {
          orbit = transition.to;
          transition = undefined;
          cameraChanged = true;
        }
        if (!disposed && !lost) renderOperation(applyRendererState);
        invalidate();
        return style;
      },
      resize(nextWidth, nextHeight) {
        width = Number.isFinite(nextWidth) ? Math.max(1, Math.round(nextWidth)) : width;
        height = Number.isFinite(nextHeight) ? Math.max(1, Math.round(nextHeight)) : height;
        if (!disposed && !lost) renderOperation(applyRendererState);
        invalidate();
      },
      invalidate,
      onFrame(callback) {
        frameCallbacks.add(callback);
        return () => frameCallbacks.delete(callback);
      },
      pickAt(x, y) {
        if (disposed || lost) return null;
        applyCamera();
        let item: number | null = null;
        return renderOperation(() => { item = picker.read(pickScene, camera, x, y, width, height); }) ? item : null;
      },
      project(point) {
        return projectOrbitPoint(point, orbit, { width, height });
      },
      renderNow() {
        if (frame !== 0) cancelAnimationFrame(frame);
        frame = 0;
        render(performance.now());
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        stopInteraction();
        frameCallbacks.clear();
        for (const [target, type, listener, listenerOptions] of listeners) target.removeEventListener(type, listener, listenerOptions);
        let failure: unknown; let threw = false;
        const cleanup = (run: () => void) => { try { run(); } catch (error) { if (!threw) { threw = true; failure = error; } } };
        cleanup(() => picker.dispose());
        cleanup(() => renderer.dispose());
        // Frees the GPU context now instead of at garbage collection; pages hold only a few at once.
        cleanup(() => releaseContext(gl));
        cleanup(restoreContextMethods);
        cleanup(() => canvas.remove());
        if (threw) throw failure;
      },
    };
    return viewport;
  } catch (error) {
    // No caller received the viewport, so release every acquired resource independently while
    // preserving the initialization or application callback error that made mounting fail.
    try { stopInitialization?.(); } catch { /* Continue with native resource cleanup. */ }
    for (const [target, type, listener, listenerOptions] of installedListeners) {
      try { target.removeEventListener(type, listener, listenerOptions); } catch { /* Continue detaching. */ }
    }
    try { ownedPicker?.dispose(); } catch { /* Renderer and context still need release. */ }
    try { renderer.dispose(); } catch { /* The WebGL context remains independently owned. */ }
    try { releaseContext(ownedContext); } catch { /* Preserve the original failure. */ }
    try { restoreContextMethods(); } catch { /* Preserve the original failure. */ }
    try { canvas.remove(); } catch { /* Preserve the original failure. */ }
    throw error;
  }
}

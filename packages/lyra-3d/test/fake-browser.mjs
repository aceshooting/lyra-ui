/**
 * The smallest browser a Node test needs to drive the real viewport and the real three.js
 * renderer: a document that makes canvases, canvases that behave like event targets, manual
 * animation frames, and a WebGL2 context that accepts every call. The context records its calls
 * and can lose itself, fail on demand and report a scripted pixel, which stands in for the GPU
 * only; every other line that runs is the shipped renderer and viewport code.
 */

class FakeWebGL2RenderingContext {}

export class FakeContainer {
  children = [];
  append(child) {
    child.remove();
    this.children.push(child);
    child.parent = this;
  }
}

export class FakeCanvas extends EventTarget {
  style = {};
  width = 300;
  height = 150;
  left = 0;
  top = 0;
  parent = undefined;
  captured = new Set();
  contexts = [];
  requests = [];
  /** Makes `getContext` hand out nothing, like a browser without WebGL2. */
  noContext;
  /** Replaces the context a granted request returns, for example a WebGL1-like object. */
  contextFactory = undefined;
  /** Capture calls fail for synthetic pointers, as in browsers. */
  captureFails = false;
  options;

  constructor(options) {
    super();
    this.options = options;
    this.noContext = options.noContext ?? false;
  }

  get ownerDocument() {
    return globalThis.document;
  }

  /** A recording 2D context, handed out only when `options.context2d` is set. */
  context2d() {
    this.drawing ??= { calls: [] };
    return new Proxy(this.drawing, {
      get: (state, name) => (name in state ? state[name] : (...args) => { state.calls.push([name, ...args]); }),
      set: (state, name, value) => { state[name] = value; return true; },
    });
  }

  getContext(kind, attributes) {
    this.requests.push({ kind, attributes });
    if (kind === '2d') return this.options.context2d ? this.context2d() : null;
    if (this.noContext || kind !== 'webgl2') return null;
    if (attributes?.failIfMajorPerformanceCaveat && this.options.caveat) return null;
    const context = this.contextFactory?.(this) ?? createFakeGl(this, this.options);
    this.contexts.push(context);
    return context;
  }

  getBoundingClientRect() {
    return { left: this.left, top: this.top, width: this.width, height: this.height };
  }

  setPointerCapture(id) {
    if (this.captureFails) throw new DOMException('No such pointer', 'NotFoundError');
    this.captured.add(id);
  }

  releasePointerCapture(id) {
    if (this.captureFails) throw new DOMException('No such pointer', 'NotFoundError');
    this.captured.delete(id);
  }

  hasPointerCapture(id) {
    return this.captured.has(id);
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = undefined;
  }
}

/**
 * A WebGL2 context for the real renderer. `options.renderer` names the GPU, `options.pixel` is what
 * `readPixels` reports, `gl.fail` maps a call name to an error it throws, and losing the context
 * (`gl.lose()`) makes `isContextLost()` true, as a browser would after a driver reset.
 */
export function createFakeGl(canvas, options = {}) {
  const ids = new Map();
  const names = new Map();
  const constant = (name) => {
    if (!ids.has(name)) {
      ids.set(name, ids.size + 1000);
      names.set(ids.get(name), name);
    }
    return ids.get(name);
  };
  const parameters = {
    VERSION: 'WebGL 2.0 (Fake)',
    SHADING_LANGUAGE_VERSION: 'WebGL GLSL ES 3.00',
    VENDOR: 'Fake',
    RENDERER: options.renderer ?? 'Fake GPU',
    ALIASED_LINE_WIDTH_RANGE: new Float32Array([1, 1]),
    ALIASED_POINT_SIZE_RANGE: new Float32Array([1, 64]),
    MAX_VIEWPORT_DIMS: new Int32Array([8192, 8192]),
    VIEWPORT: new Int32Array([0, 0, 300, 150]),
    SCISSOR_BOX: new Int32Array([0, 0, 300, 150]),
    COMPRESSED_TEXTURE_FORMATS: [],
    COLOR_WRITEMASK: [true, true, true, true],
    UNMASKED_RENDERER_WEBGL: options.unmasked,
    IMPLEMENTATION_COLOR_READ_FORMAT: () => constant('RGBA'),
    IMPLEMENTATION_COLOR_READ_TYPE: () => constant('UNSIGNED_BYTE'),
  };
  const calls = [];
  const state = {
    lost: false,
    calls,
    pixel: options.pixel ?? [0, 0, 0, 0],
    fail: new Map(),
    lose() { state.lost = true; },
    callsOf: (name) => calls.filter((call) => call[0] === name),
  };
  const known = {
    canvas,
    isContextLost: () => state.lost,
    getContextAttributes: () => ({
      alpha: true, depth: true, stencil: false, antialias: false, premultipliedAlpha: true,
      preserveDrawingBuffer: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false, desynchronized: false,
    }),
    getParameter(pname) {
      const name = names.get(pname);
      const value = parameters[name];
      return typeof value === 'function' ? value() : name in parameters ? value : 16;
    },
    getShaderPrecisionFormat: () => ({ rangeMin: 127, rangeMax: 127, precision: 23 }),
    getSupportedExtensions: () => [],
    getExtension(name) {
      if (name === 'WEBGL_lose_context') return { loseContext: () => { state.lost = true; state.loseContextCalls = (state.loseContextCalls ?? 0) + 1; } };
      if (name === 'WEBGL_debug_renderer_info' && options.unmasked !== undefined) return { UNMASKED_RENDERER_WEBGL: constant('UNMASKED_RENDERER_WEBGL') };
      return null;
    },
    getShaderParameter: (_shader, pname) => (names.get(pname) === 'COMPILE_STATUS' ? true : 0),
    getProgramParameter: (_program, pname) => (names.get(pname) === 'LINK_STATUS' ? true : 0),
    getShaderInfoLog: () => '',
    getProgramInfoLog: () => '',
    checkFramebufferStatus: () => constant('FRAMEBUFFER_COMPLETE'),
    getError: () => constant('NO_ERROR'),
    readPixels(_x, _y, _width, _height, _format, _type, buffer) {
      calls.push(['readPixels']);
      buffer.set(state.pixel);
    },
  };
  const target = Object.create(FakeWebGL2RenderingContext.prototype);
  const context = new Proxy(target, {
    get(object, name, receiver) {
      if (typeof name !== 'string' || Reflect.has(object, name)) return Reflect.get(object, name, receiver);
      if (name in known) {
        const value = known[name];
        return typeof value === 'function' ? (...args) => run(name, args, value) : value;
      }
      if (/^[A-Z][A-Z0-9_]*$/u.test(name)) return constant(name);
      return (...args) => run(name, args, () => ({}));
    },
  });
  function run(name, args, implementation) {
    calls.push([name, ...args]);
    const failure = state.fail.get(name);
    if (failure) throw failure;
    return implementation(...args);
  }
  Object.defineProperty(target, 'state', { value: state });
  return context;
}

/**
 * Installs the browser globals the viewport reads and returns the controls; call `restore()` in a
 * `finally` block so a failing test cannot leak globals into the next one.
 */
export function installFakeBrowser(options = {}) {
  const names = ['document', 'WebGL2RenderingContext', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const canvases = [];
  const frames = new Map();
  let nextFrame = 0;
  const browser = {
    options,
    canvases,
    container: new FakeContainer(),
    /** The canvas the viewport put in the container, or else the last one created. */
    get canvas() { return this.container.children[0] ?? canvases.at(-1); },
    get gl() { return this.canvas.contexts.at(-1)?.state; },
    pendingFrames: () => frames.size,
    /** Runs the frames requested so far, as one display refresh at `time`. */
    flushFrames(time = performance.now()) {
      const due = [...frames];
      frames.clear();
      for (const [, callback] of due) callback(time);
      return due.length;
    },
    restore() {
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
  const define = (name, value) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  define('document', {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error(`Unexpected element ${tag}`);
      const canvas = new FakeCanvas(options);
      canvases.push(canvas);
      return canvas;
    },
  });
  define('WebGL2RenderingContext', FakeWebGL2RenderingContext);
  define('requestAnimationFrame', (callback) => { nextFrame += 1; frames.set(nextFrame, callback); return nextFrame; });
  define('cancelAnimationFrame', (id) => { frames.delete(id); });
  return browser;
}

/** A DOM-like pointer or mouse event carrying only the fields the viewport reads. */
export function pointerEvent(type, fields = {}) {
  const event = new Event(type, { cancelable: true });
  return Object.assign(event, {
    pointerId: 1, button: 0, isPrimary: true, clientX: 0, clientY: 0,
    shiftKey: false, ctrlKey: false, metaKey: false, ...fields,
  });
}

export function wheelEvent(deltaY, fields = {}) {
  return Object.assign(new Event('wheel', { cancelable: true }), { deltaY, ...fields });
}

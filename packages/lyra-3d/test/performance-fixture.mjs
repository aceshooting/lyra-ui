/** Small dependency-injected harness for structural and performance comparisons. */
export function viewportHarness(three, orbit, style) {
  const canvas = new EventTarget();
  const captures = new Set();
  Object.assign(canvas, {
    setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id), getBoundingClientRect: () => ({ left: 0, top: 0 }),
  });
  const viewport = {
    canvas, world: new three.Group(), pickWorld: new three.Group(), scene: new three.Group(),
    width: 640, height: 480, orbit: orbit.DEFAULT_ORBIT_CAMERA, style: style.resolveLyra3dStyle(),
    lost: false, disposed: false, invalidations: 0,
    setStyle(value) { this.style = style.resolveLyra3dStyle(value); return this.style; },
    setOrbit(value) { this.orbit = value; },
    project(point) { return orbit.projectOrbitPoint(point, this.orbit, this); },
    invalidate() { this.invalidations++; },
    onFrame(callback) { this.tick = callback; return () => { this.tick = undefined; }; },
    pickAt() { return 0; }, resize(width, height) { this.width = width; this.height = height; },
    dispose() { this.disposed = true; },
  };
  return { viewport, host: { hover() {}, pick() {}, camera() {}, lost() {} } };
}

export const state = (extra = {}) => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });

export function graphData(count, spatial = false, translucent = false) {
  const positions = new Float32Array(count * 3);
  const source = new Uint32Array(count), target = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    positions.set([(i % 16) * 10, Math.floor(i / 16) * 10, i % 7], i * 3);
    source[i] = i; target[i] = (i + 1) % count;
  }
  return { nodeCount: count, positions, source, target,
    ...(spatial ? { spatialAppearance: translucent ? {
      nodeColors: new Float32Array(Array.from({ length: count * 4 }, (_, i) => i % 4 === 3 ? 0.5 : 0.4)),
      edgeColors: new Float32Array(Array.from({ length: count * 4 }, (_, i) => i % 4 === 3 ? 0.5 : 0.2)),
    } : {} } : {}),
  };
}

export function attributesOf(viewport) {
  const result = new Map(), seen = new Set();
  for (const rootName of ['world', 'pickWorld']) {
    let index = 0;
    viewport[rootName].traverse(object => {
      if (!object.geometry) return;
      const prefix = `${rootName}/${index++}`;
      for (const [name, value] of Object.entries({ ...object.geometry.attributes, instanceColor: object.instanceColor, instanceMatrix: object.instanceMatrix })) {
        if (!value || seen.has(value)) continue;
        seen.add(value); result.set(`${prefix}/${name}`, value);
      }
    });
  }
  return result;
}

export function visualSnapshot(viewport) {
  const attributes = Object.fromEntries([...attributesOf(viewport)].map(([key, value]) => [key, Array.from(value.array)]));
  const meshes = [];
  for (const rootName of ['world', 'pickWorld']) viewport[rootName].traverse(object => {
    if (object.geometry) meshes.push({ root: rootName, count: object.count ?? object.geometry.instanceCount ?? null,
      transparent: object.material.transparent, depthWrite: object.material.depthWrite, visible: object.visible });
  });
  return { attributes, meshes };
}

/** Real Three dispatch with a recording/copying GL sink; no actual GPU or timing claim. */
export function uploadRecorder(attributes, WebGLAttributes) {
  const buffers = new Map();
  let bound, calls = [];
  const gl = { ARRAY_BUFFER: 34962, FLOAT: 5126, UNSIGNED_SHORT: 5123,
    createBuffer() { const buffer = {}; buffers.set(buffer, undefined); return buffer; },
    bindBuffer(_target, buffer) { bound = buffer; },
    bufferData(_target, array) { buffers.set(bound, array.slice()); },
    bufferSubData(_target, offset, array, start = 0, length = array.length - start) {
      const key = [...attributes].find(([, attr]) => attr.array === array)?.[0];
      buffers.get(bound).set(array.subarray(start, start + length), offset / array.BYTES_PER_ELEMENT);
      calls.push({ key, offset, bytes: length * array.BYTES_PER_ELEMENT });
    },
    deleteBuffer(buffer) { buffers.delete(buffer); },
  };
  const renderer = WebGLAttributes(gl);
  const flush = () => { calls = []; for (const attr of attributes.values()) renderer.update(attr, gl.ARRAY_BUFFER); return calls; };
  flush();
  return { flush,
    mirrors() { return Object.fromEntries([...attributes].map(([name, attr]) => [name, Array.from(buffers.get(renderer.get(attr).buffer))])); },
    dispose() { for (const attr of attributes.values()) renderer.remove(attr); },
  };
}

export function countWrites(attributes) {
  const undo = [];
  let counts = {};
  for (const [key, attr] of attributes) for (const method of ['setX', 'setXY', 'setXYZ', 'setXYZW']) {
    const descriptor = Object.getOwnPropertyDescriptor(attr, method), original = attr[method];
    attr[method] = function (...args) {
      const name = `${key}.${method}`; counts[name] = (counts[name] ?? 0) + 1;
      return Reflect.apply(original, this, args);
    };
    undo.push(() => descriptor ? Object.defineProperty(attr, method, descriptor) : delete attr[method]);
  }
  return { reset() { counts = {}; }, read() { return { ...counts }; }, restore() { for (const fn of undo) fn(); } };
}

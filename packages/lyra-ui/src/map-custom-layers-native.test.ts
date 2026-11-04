import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './components/media/map/map.js';
import type { LyraMapCustomLayer, LyraMapCustomLayerContext, LyraMapCustomLayerFrame, LyraMapCustomLayerStatus } from './map-custom-layers.js';
import { addMapCustomLayer } from './map-custom-layers.js';

void LyraMap;
interface StateDetail { readonly state: string; readonly code?: string }
const style = (color = '#eeeeee') => ({ ...LYRA_MAP_EMPTY_STYLE, layers: [{ id: 'background', type: 'background', paint: { 'background-color': color } }] });
const vertexBody = `
uniform vec3 u_center;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec4 center = lrProjectPosition(u_center);
  gl_Position = center + vec4(corner * 0.25 * center.w, 0.0, 0.0);
}`;
const fragmentBody = `
out vec4 color;
void main() { color = vec4(1.0, 0.0, 0.0, 1.0); }`;

interface Probe {
  readonly contexts: LyraMapCustomLayerContext[];
  readonly frames: LyraMapCustomLayerFrame[];
  readonly disposals: boolean[];
  readonly pixels: number[][];
}
/** A coverage-marker quad at one geographic position, read back inside its own frame. */
function probeLayer(probe: Probe): LyraMapCustomLayer {
  return { id: 'probe', label: 'Probe', create(context) {
    probe.contexts.push(context);
    const { gl } = context;
    let program: WebGLProgram | null = null, key = '';
    const vao = gl.createVertexArray();
    // Frame services expire with the callback, so picking keeps the projected point it drew.
    let drawnAt: readonly [number, number] | undefined;
    return {
      render(frame) {
        probe.frames.push(frame);
        drawnAt = frame.geographic.project({ lngLat: [0, 0] }).point;
        const resolved = frame.geographic.resolve({ lngLat: [0, 0], altitude: 0 });
        if (resolved.status !== 'resolved') return;
        const origin = context.geographic.frameFor(resolved), shader = frame.geographic.shader(origin);
        const source = shader.defines + shader.vertexPrelude;
        if (source !== key) {
          if (program) gl.deleteProgram(program);
          program = gl.createProgram()!;
          for (const [type, prelude, body] of [[gl.VERTEX_SHADER, shader.vertexPrelude, vertexBody], [gl.FRAGMENT_SHADER, shader.fragmentPrelude, fragmentBody]] as const) {
            const object = gl.createShader(type)!;
            gl.shaderSource(object, `#version 300 es\nprecision highp float;\n${shader.defines}\n${prelude}\n${body}`);
            gl.compileShader(object);
            if (!gl.getShaderParameter(object, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(object) ?? 'compile');
            gl.attachShader(program, object);
          }
          gl.linkProgram(program); key = source;
        }
        gl.useProgram(program);
        for (const uniform of shader.uniforms) {
          const location = gl.getUniformLocation(program!, uniform.name);
          if (uniform.type === 'float') gl.uniform1f(location, uniform.value);
          else if (uniform.type === 'vec4') gl.uniform4fv(location, uniform.value);
          else gl.uniformMatrix4fv(location, false, uniform.value);
        }
        gl.uniform3fv(gl.getUniformLocation(program!, 'u_center'), frame.geographic.encode(resolved, origin));
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        const pixel = new Uint8Array(4);
        gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        probe.pixels.push([...pixel]);
      },
      dispose() {
        probe.disposals.push(gl.isContextLost());
        if (gl.isContextLost()) return;
        if (program) gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      },
      pick: async ([x, y]) => drawnAt && Math.hypot(drawnAt[0] - x, drawnAt[1] - y) < 20
        ? { id: 'center', position: { lngLat: [0, 0] } } : null,
    };
  } };
}

for (const engine of ['modular', 'maplibre'] as const) describe(`addMapCustomLayer() with the ${engine} engine`, function () {
  this.timeout(60000);
  let previousWorkerUrl: string;
  before(function () { if (!document.createElement('canvas').getContext('webgl2')) this.skip(); });
  beforeEach(() => { previousWorkerUrl = getWorkerUrl(); setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href); });
  afterEach(() => { fixtureCleanup(); setWorkerUrl(previousWorkerUrl); });

  async function mount(): Promise<LyraMap> {
    const element = await fixture<LyraMap>(html`<lr-map style="inline-size:400px;block-size:300px" .engine=${engine} .center=${[0, 0]} .zoom=${2}
      .mapStyle=${style()} .controls=${{ attribution: false }}></lr-map>`);
    await element.whenStyleReady(); await element.whenIdle();
    return element;
  }

  it('renders through the shared camera, replays styles, recovers a lost context and disposes on disconnect', async () => {
    const element = await mount();
    const probe: Probe = { contexts: [], frames: [], disposals: [], pixels: [] };
    const statuses: LyraMapCustomLayerStatus[] = [];
    const handle = addMapCustomLayer(element, probeLayer(probe), { onStateChange: status => statuses.push(status) });
    await waitUntil(() => handle.status.state === 'ready', 'custom layer ready', { timeout: 20000 });
    const frame = probe.frames.at(-1)!;
    expect([frame.width, frame.height]).to.deep.equal([400, 300]);
    expect(probe.pixels.at(-1)).to.deep.equal([255, 0, 0, 255], 'the quad at the map center is drawn');
    const gl = probe.contexts[0]!.gl;
    expect(gl.canvas === (element.map as unknown as { getCanvas(): HTMLCanvasElement }).getCanvas()).to.equal(true);

    const picked = await handle.pick([200, 150]);
    expect(picked).to.deep.equal({ id: 'center', position: { lngLat: [0, 0] } });
    expect(await handle.pick([5, 5])).to.equal(null);

    element.mapStyle = style('#dddddd');
    await element.whenStyleReady();
    await waitUntil(() => probe.contexts.length === 2 && handle.status.state === 'ready', 'remounted after the style replacement', { timeout: 20000 });
    expect(probe.disposals).to.deep.equal([false]);

    const lose = gl.getExtension('WEBGL_lose_context');
    expect(lose === null).to.equal(false, 'the browser can simulate context loss');
    if (lose) {
      // MapLibre warns that custom layers need re-adding after a restore; the bridge does exactly
      // that, so the engine's notice is expected here and every other warning still surfaces.
      const originalWarn = console.warn, unexpected: unknown[][] = [];
      console.warn = (...args: unknown[]) => {
        if (!/^Custom layer with id '[^']+' cannot be restored after WebGL context loss/u.test(String(args[0]))) unexpected.push(args);
      };
      try {
        lose.loseContext();
        await waitUntil(() => handle.status.state === 'unavailable', 'context loss reported', { timeout: 20000 });
        expect(handle.status.code).to.equal('context-lost');
        expect(probe.disposals.at(-1)).to.equal(true, 'disposal after loss performs no GL work');
        lose.restoreContext();
        await waitUntil(() => probe.contexts.length === 3 && handle.status.state === 'ready', 'remounted after restoration', { timeout: 20000 });
      } finally {
        console.warn = originalWarn;
      }
      expect(unexpected.map(args => String(args[0]))).to.deep.equal([]);
    }
    const disposals = probe.disposals.length;
    element.remove();
    expect(handle.status.state).to.equal('removed');
    expect(probe.disposals.length).to.equal(disposals + 1);
    expect(statuses.at(-1)).to.deep.equal({ state: 'removed' });
  });

  it('draws elevated arcs and reports the scene ready', async () => {
    const element = await mount();
    const states: StateDetail[] = [];
    element.addEventListener('lr-map-scene-state', event => states.push((event as CustomEvent<StateDetail>).detail));
    element.scene = { objects: [
      { id: 'uplink', label: 'Uplink', kind: 'arc', start: { lngLat: [-20, 0] }, end: { lngLat: [20, 10], altitude: 5000 }, height: 400000 },
      { id: 'flight', label: 'Flight', kind: 'path', positions: [{ lngLat: [170, -5], altitude: 9000 }, { lngLat: [-170, 5], altitude: 9000 }] },
    ] };
    await waitUntil(() => states.at(-1)?.state === 'ready', `scene ready (last ${JSON.stringify(states.at(-1))})`, { timeout: 30000 });
    expect(states.some(state => state.code === 'altitude')).to.equal(false);
  });
});

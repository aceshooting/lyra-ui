import type { LyraMapCustomLayer, LyraMapCustomLayerContext, LyraMapCustomLayerFrame,
  LyraMapGeographicShader } from '../../../internal/map-custom-layer-types.js';
import { canonicalLongitude, encodeTileVertex, lineWorldShift, MERCATOR_LATITUDE_LIMIT, type TileOrigin } from './map-scene-line-encoding.js';
import type { SceneLineCoordinate } from './map-scene-lines.js';

/** One path or arc with resolved presentation; `rgba` alpha already includes opacity. */
export interface ElevatedSceneLine {
  readonly id: string;
  readonly coordinates: readonly SceneLineCoordinate[];
  /** Per-vertex terrain weight, see `SceneLineGeometry.terrain`. */
  readonly terrain: readonly number[];
  readonly rgba: readonly [number, number, number, number];
  /** CSS pixels. */
  readonly width: number;
}

const FLOATS = 13;
const mercatorLatitude = (value: number): number => Math.max(-MERCATOR_LATITUDE_LIMIT, Math.min(MERCATOR_LATITUDE_LIMIT, value));
const vertexBody = `
in vec3 a_lr_position;
in vec3 a_lr_other;
in vec2 a_lr_side;
in vec4 a_lr_color;
in float a_lr_width;
uniform vec2 u_lr_viewport;
uniform float u_lr_pixel_ratio;
out vec4 v_lr_color;
out vec3 v_lr_sphere;
void main() {
  vec4 here = lrProjectPosition(a_lr_position);
  vec4 there = lrProjectPosition(a_lr_other);
  v_lr_color = a_lr_color;
  v_lr_sphere = lrHorizonPosition(a_lr_position);
  if (here.w <= 0.0 || there.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 halfSize = u_lr_viewport * 0.5;
  vec2 direction = (there.xy / there.w - here.xy / here.w) * halfSize * a_lr_side.y;
  float run = length(direction);
  vec2 normal = run > 0.0 ? vec2(-direction.y, direction.x) / run : vec2(0.0);
  vec2 offset = normal * a_lr_side.x * a_lr_width * 0.5 * u_lr_pixel_ratio;
  gl_Position = here + vec4(offset / halfSize * here.w, 0.0, 0.0);
}`;
const fragmentBody = `
in vec4 v_lr_color;
in vec3 v_lr_sphere;
out vec4 lr_color;
void main() {
  if (lrHorizonOccluded(v_lr_sphere)) discard;
  lr_color = vec4(v_lr_color.rgb * v_lr_color.a, v_lr_color.a);
}`;
const attributes = [['a_lr_position', 3, 0], ['a_lr_other', 3, 3], ['a_lr_side', 2, 6], ['a_lr_color', 4, 8], ['a_lr_width', 1, 12]] as const;

interface Program { readonly program: WebGLProgram; readonly shaders: readonly WebGLShader[]; readonly locations: Map<string, WebGLUniformLocation | null> }
interface LineBuffer { readonly vao: WebGLVertexArrayObject; readonly buffer: WebGLBuffer; key: string; count: number }

/**
 * Builds the triangle list for one line: each segment is a quad whose corners carry both endpoints
 * so the vertex shader extrudes `width` CSS pixels perpendicular to the projected segment.
 */
export function elevatedLineVertices(line: ElevatedSceneLine, tile: TileOrigin,
  heights: readonly number[]): Float32Array {
  const shift = lineWorldShift(line.coordinates[0]![0]);
  const encoded = line.coordinates.map((row, index) =>
    encodeTileVertex(row[0] + shift, row[1], row[2] + line.terrain[index]! * heights[index]!, tile));
  const data = new Float32Array(Math.max(0, encoded.length - 1) * 6 * FLOATS);
  const [red, green, blue, alpha] = line.rgba;
  let offset = 0;
  const push = (self: readonly number[], other: readonly number[], side: number, direction: number): void => {
    data.set([self[0]!, self[1]!, self[2]!, other[0]!, other[1]!, other[2]!, side, direction, red, green, blue, alpha, line.width], offset);
    offset += FLOATS;
  };
  for (let index = 1; index < encoded.length; index++) {
    const a = encoded[index - 1]!, b = encoded[index]!;
    push(a, b, -1, 1); push(a, b, 1, 1); push(b, a, -1, -1);
    push(b, a, -1, -1); push(a, b, 1, 1); push(b, a, 1, -1);
  }
  return data;
}

/** A custom 3D layer drawing elevated scene paths and arcs at their authored altitude. */
export function createElevatedSceneLineLayer(id: string, lines: readonly ElevatedSceneLine[]): LyraMapCustomLayer {
  return Object.freeze({ id, label: 'Scene paths and arcs', create(context: LyraMapCustomLayerContext) {
    const { gl } = context;
    const programs = new Map<string, Program>(), buffers = new Map<string, LineBuffer>();
    let disposed = false;

    function compile(shader: LyraMapGeographicShader): Program {
      const source = `${shader.defines}\n${shader.vertexPrelude}\n${shader.fragmentPrelude}`;
      const cached = programs.get(source);
      if (cached) return cached;
      const shaders: WebGLShader[] = [];
      for (const [type, prelude, body] of [[gl.VERTEX_SHADER, shader.vertexPrelude, vertexBody],
        [gl.FRAGMENT_SHADER, shader.fragmentPrelude, fragmentBody]] as const) {
        const created = gl.createShader(type);
        if (!created) throw new Error('Scene line shader unavailable');
        shaders.push(created);
        gl.shaderSource(created, `#version 300 es\nprecision highp float;\n${shader.defines}\n${prelude}\n${body}`);
        gl.compileShader(created);
        if (!gl.getShaderParameter(created, gl.COMPILE_STATUS)) throw new Error('Scene line shader failed to compile');
      }
      const program = gl.createProgram();
      if (!program) throw new Error('Scene line program unavailable');
      for (const created of shaders) gl.attachShader(program, created);
      attributes.forEach(([name], index) => { gl.bindAttribLocation(program, index, name); });
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Scene line program failed to link');
      const value: Program = { program, shaders, locations: new Map() };
      programs.set(source, value);
      return value;
    }
    function location(program: Program, name: string): WebGLUniformLocation | null {
      if (!program.locations.has(name)) program.locations.set(name, gl.getUniformLocation(program.program, name));
      return program.locations.get(name)!;
    }
    function bufferFor(line: ElevatedSceneLine): LineBuffer {
      let owned = buffers.get(line.id);
      if (owned) return owned;
      const vao = gl.createVertexArray(), buffer = gl.createBuffer();
      if (!vao || !buffer) throw new Error('Scene line buffer unavailable');
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      attributes.forEach(([, size, offset], index) => {
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index, size, gl.FLOAT, false, FLOATS * 4, offset * 4);
      });
      gl.bindVertexArray(null);
      owned = { vao, buffer, key: '', count: 0 };
      buffers.set(line.id, owned);
      return owned;
    }
    /** Absolute terrain heights per vertex, or undefined while any needed height is pending. */
    function heights(frame: LyraMapCustomLayerFrame, line: ElevatedSceneLine): readonly number[] | undefined {
      const result: number[] = [];
      for (let index = 0; index < line.coordinates.length; index++) {
        if (line.terrain[index] === 0) { result.push(0); continue; }
        const row = line.coordinates[index]!;
        const resolved = frame.geographic.resolve({ lngLat: [canonicalLongitude(row[0]), mercatorLatitude(row[1])], altitudeReference: 'terrain' });
        if (resolved.status === 'terrain-pending') return undefined;
        // Without displayed terrain the surface is sea level.
        result.push(resolved.status === 'resolved' ? resolved.altitude : 0);
      }
      return result;
    }

    return {
      render(frame: LyraMapCustomLayerFrame) {
        if (disposed) return;
        const viewport = [frame.width * frame.pixelRatio, frame.height * frame.pixelRatio] as const;
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        for (const line of lines) {
          if (line.coordinates.length < 2 || line.rgba[3] === 0) continue;
          const first = line.coordinates[0]!;
          const origin = context.geographic.frameFor({ lngLat: [canonicalLongitude(first[0]), mercatorLatitude(first[1])] });
          const terrainDependent = line.terrain.some(weight => weight !== 0);
          const key = `${origin.tile.z}/${origin.tile.x}/${origin.tile.y}/${origin.tile.wrap}/${terrainDependent ? frame.revision : 0}`;
          const owned = bufferFor(line);
          if (owned.key !== key) {
            const sampled = terrainDependent ? heights(frame, line) : line.coordinates.map(() => 0);
            if (!sampled) continue;
            const data = elevatedLineVertices(line, origin.tile, sampled);
            gl.bindBuffer(gl.ARRAY_BUFFER, owned.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
            owned.key = key; owned.count = data.length / FLOATS;
          }
          const shader = frame.geographic.shader(origin), program = compile(shader);
          gl.useProgram(program.program);
          for (const uniform of shader.uniforms) {
            const target = location(program, uniform.name);
            if (!target) continue;
            if (uniform.type === 'float') gl.uniform1f(target, uniform.value);
            else if (uniform.type === 'vec4') gl.uniform4fv(target, uniform.value);
            else gl.uniformMatrix4fv(target, false, uniform.value);
          }
          gl.uniform2f(location(program, 'u_lr_viewport'), viewport[0], viewport[1]);
          gl.uniform1f(location(program, 'u_lr_pixel_ratio'), frame.pixelRatio);
          gl.bindVertexArray(owned.vao);
          gl.drawArrays(gl.TRIANGLES, 0, owned.count);
        }
        gl.bindVertexArray(null);
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        if (gl.isContextLost()) { programs.clear(); buffers.clear(); return; }
        for (const owned of buffers.values()) { gl.deleteVertexArray(owned.vao); gl.deleteBuffer(owned.buffer); }
        for (const program of programs.values()) {
          gl.deleteProgram(program.program);
          for (const shader of program.shaders) gl.deleteShader(shader);
        }
        programs.clear(); buffers.clear();
      },
    };
  } });
}

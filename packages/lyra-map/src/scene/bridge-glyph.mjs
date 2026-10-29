const fail = () => { throw new TypeError('Scene glyph rendering is unavailable.'); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
let allocationSequence = 0;

const vertexBody = `
uniform vec3 u_lr_anchor;
uniform vec2 u_lr_radius_clip;
out vec2 v_lr_circle;
out vec3 v_lr_sphere;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec4 center = lrProjectPosition(u_lr_anchor);
  gl_Position = center + vec4(corner * u_lr_radius_clip * center.w, 0.0, 0.0);
  v_lr_circle = corner;
  v_lr_sphere = lrHorizonPosition(u_lr_anchor);
}`;

const fragmentBody = `
uniform vec4 u_lr_color;
in vec2 v_lr_circle;
in vec3 v_lr_sphere;
out vec4 lr_color;
void main() {
  float distanceToCenter = length(v_lr_circle);
  float edgeWidth = clamp(fwidth(distanceToCenter), 0.000001, 1.0);
  if (distanceToCenter > 1.0 || lrHorizonOccluded(v_lr_sphere)) discard;
  float coverage = 1.0 - smoothstep(1.0 - edgeWidth, 1.0, distanceToCenter);
  float alpha = u_lr_color.a * coverage;
  lr_color = vec4(u_lr_color.rgb * alpha, alpha);
}`;

const sameSource = (left, right) => left.defines === right.defines &&
  left.vertexPrelude === right.vertexPrelude && left.fragmentPrelude === right.fragmentPrelude;

function float(value) {
  if (!finite(value) || !finite(Math.fround(value))) fail();
  return Math.fround(value);
}

/** Owns one bounded, procedural circle renderer for a native scene context epoch. */
export function createSceneGlyphRenderer({ gl, geographic, reserve, isCurrent, withState }) {
  if (!gl || !geographic || typeof geographic.frameFor !== 'function' ||
      typeof reserve !== 'function' || typeof isCurrent !== 'function' || typeof withState !== 'function') fail();
  if (!Number.isSafeInteger(++allocationSequence)) fail();
  const lease = reserve([{ kind: 'bytes', key: `scene-glyph-staging-${allocationSequence}`,
    pool: 'cpu-buffer', byteLength: 36 }]);
  let staging;
  try { staging = new Float32Array(9); }
  catch { /* Return the owner so even an allocation failure keeps its reservation reachable. */ }
  let anchor = staging?.subarray(0, 3), radius = staging?.subarray(3, 5), color = staging?.subarray(5, 9);
  let vao, current, closed = false, active = false, released = false, releaseFailed = false;
  const variants = new Set();

  const check = () => { if (!isCurrent()) fail(); };
  // Record a returned allocation/deletion before the post-call currency check can fail.
  const call = (name, args, record) => {
    check();
    const result = gl[name](...args);
    record?.(result);
    check();
    return result;
  };
  const create = (name, args, record) => call(name, args, value => {
    if (value === null || value === undefined) fail();
    record(value);
  });

  function retireVariants(all) {
    let failed = false;
    const attempt = work => { try { work(); } catch { failed = true; } };
    for (const variant of variants) {
      if (!all && variant === current) continue;
      if (variant.program) attempt(() => {
        // A failed enclosing restore can leave our program current. Do not delete it.
        if (call('getParameter', [gl.CURRENT_PROGRAM]) === variant.program) fail();
        call('deleteProgram', [variant.program], () => { variant.program = undefined; });
      });
      // Attached shader storage remains owned until its program has actually retired.
      if (!variant.program) for (const key of ['vertex', 'fragment']) {
        if (variant[key]) attempt(() => call('deleteShader', [variant[key]], () => { variant[key] = undefined; }));
      }
      if (!variant.program && !variant.vertex && !variant.fragment) {
        variants.delete(variant);
        if (variant === current) current = undefined;
      }
    }
    if (all && vao) attempt(() => {
      if (call('getParameter', [gl.VERTEX_ARRAY_BINDING]) === vao) fail();
      call('deleteVertexArray', [vao], () => { vao = undefined; });
    });
    if (failed) fail();
  }

  function releaseStaging() {
    if (released || releaseFailed) return;
    staging = undefined; anchor = undefined; radius = undefined; color = undefined;
    try { lease.release(); released = true; }
    catch { releaseFailed = true; fail(); }
  }

  function programFor(shader) {
    if (current && sameSource(current.source, shader)) return current;
    // A retained retirement or partial candidate occupies the second program slot.
    if (variants.size > (current ? 1 : 0)) fail();
    const variant = { source: { defines: shader.defines, vertexPrelude: shader.vertexPrelude,
      fragmentPrelude: shader.fragmentPrelude }, locations: new Map() };
    variants.add(variant);
    for (const [key, type, prelude, body] of [
      ['vertex', gl.VERTEX_SHADER, shader.vertexPrelude, vertexBody],
      ['fragment', gl.FRAGMENT_SHADER, shader.fragmentPrelude, fragmentBody]
    ]) {
      create('createShader', [type], value => { variant[key] = value; });
      call('shaderSource', [variant[key], `#version 300 es\nprecision highp float;\n${shader.defines}\n${prelude}\n${body}`]);
      call('compileShader', [variant[key]]);
      if (!call('getShaderParameter', [variant[key], gl.COMPILE_STATUS])) fail();
    }
    create('createProgram', [], value => { variant.program = value; });
    call('attachShader', [variant.program, variant.vertex]);
    call('attachShader', [variant.program, variant.fragment]);
    call('linkProgram', [variant.program]);
    if (!call('getProgramParameter', [variant.program, gl.LINK_STATUS])) fail();
    check();
    current = variant;
    return variant;
  }

  function location(variant, name) {
    if (!variant.locations.has(name)) {
      const value = call('getUniformLocation', [variant.program, name]);
      variant.locations.set(name, value);
    }
    return variant.locations.get(name);
  }

  function admitTarget(frame) {
    const width = frame.width * frame.pixelRatio, height = frame.height * frame.pixelRatio;
    if (![frame.width, frame.height, frame.pixelRatio, width, height].every(value => finite(value) && value > 0) ||
        !Number.isSafeInteger(Math.round(width)) || !Number.isSafeInteger(Math.round(height))) fail();
    const viewport = call('getParameter', [gl.VIEWPORT]);
    const depthFunction = call('getParameter', [gl.DEPTH_FUNC]);
    const depthRange = call('getParameter', [gl.DEPTH_RANGE]);
    if (viewport.length !== 4 || viewport[0] !== 0 || viewport[1] !== 0 ||
        viewport[2] !== Math.round(width) || viewport[3] !== Math.round(height) ||
        depthFunction !== gl.LEQUAL || depthRange.length !== 2 || !depthRange.every(finite) ||
        depthRange[0] < 0 || depthRange[0] >= depthRange[1] || depthRange[1] > 1) fail();
  }

  function packets(frame, markers) {
    const result = [];
    for (const marker of markers) {
      check();
      if (marker.rgba[3] === 0) continue;
      const resolved = frame.geographic.resolve(marker.position);
      check();
      if (resolved.status !== 'resolved') continue;
      const origin = geographic.frameFor(resolved);
      check();
      const shader = frame.geographic.shader(origin);
      check();
      const encoded = frame.geographic.encode(resolved, origin);
      check();
      const projected = frame.geographic.project(resolved);
      check();
      const clip = projected.clip;
      if (!clip || clip.length !== 4 || !clip.every(finite)) fail();
      // The GPU clips the expanded quad, including centers outside the XY clip volume.
      const depth = clip[3] === 0 ? 0 : clip[2] / clip[3];
      if (!finite(depth)) fail();
      const radiusClip = [float(2 * marker.radiusCss / frame.width), float(2 * marker.radiusCss / frame.height)];
      if (marker.radiusCss <= 0 || radiusClip.some(value => value <= 0) || encoded.length !== 3) fail();
      for (let axis = 0; axis < 2; axis++) {
        const offset = float(radiusClip[axis] * clip[3]);
        float(clip[axis] - offset); float(clip[axis] + offset);
      }
      const position = encoded.map(float), rgba = marker.rgba.map(float);
      if (rgba.length !== 4 || rgba.some(value => value < 0 || value > 1)) fail();
      if (result.length && !sameSource(result[0].shader, shader)) fail();
      result.push({ shader, position, radiusClip, rgba, depth, order: result.length });
    }
    result.sort((a, b) => b.depth - a.depth || a.order - b.order);
    return result;
  }

  function draw(frame, draws) {
    check();
    if (closed || !staging) fail();
    admitTarget(frame);
    if (!draws.length) return;
    if (!vao) create('createVertexArray', [], value => { vao = value; });
    const variant = programFor(draws[0].shader);
    call('bindVertexArray', [vao]);
    call('useProgram', [variant.program]);
    call('enable', [gl.BLEND]);
    call('enable', [gl.DEPTH_TEST]);
    call('depthMask', [false]);
    call('colorMask', [true, true, true, true]);
    call('blendEquationSeparate', [gl.FUNC_ADD, gl.FUNC_ADD]);
    call('blendFuncSeparate', [gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA]);
    for (const name of ['STENCIL_TEST', 'CULL_FACE', 'RASTERIZER_DISCARD', 'SAMPLE_COVERAGE',
      'SAMPLE_ALPHA_TO_COVERAGE', 'POLYGON_OFFSET_FILL']) call('disable', [gl[name]]);
    for (const packet of draws) {
      check();
      if (closed) fail();
      for (const uniform of packet.shader.uniforms) {
        const target = location(variant, uniform.name);
        if (uniform.type === 'mat4') call('uniformMatrix4fv', [target, false, uniform.value]);
        else if (uniform.type === 'vec4') call('uniform4fv', [target, uniform.value]);
        else if (uniform.type === 'float') call('uniform1f', [target, uniform.value]);
        else fail();
      }
      anchor.set(packet.position); radius.set(packet.radiusClip); color.set(packet.rgba);
      call('uniform3fv', [location(variant, 'u_lr_anchor'), anchor]);
      call('uniform2fv', [location(variant, 'u_lr_radius_clip'), radius]);
      call('uniform4fv', [location(variant, 'u_lr_color'), color]);
      call('drawArrays', [gl.TRIANGLE_STRIP, 0, 4]);
    }
  }

  return Object.freeze({
    render(frame, markers) {
      if (active || closed) fail();
      active = true;
      let failed = false;
      try {
        const draws = packets(frame, markers);
        check();
        withState('draw', () => draw(frame, draws));
      }
      catch { failed = true; }
      finally {
        // A distinct disposal authority is admitted only after the draw guard restores entry state.
        if ([...variants].some(variant => variant !== current)) {
          try { withState('dispose', () => retireVariants(false)); }
          catch { failed = true; }
        }
        active = false;
      }
      if (failed) fail();
    },
    dispose({ contextLost = false } = {}) {
      closed = true;
      if (active) return;
      if (contextLost) { variants.clear(); current = undefined; vao = undefined; }
      let failed = false;
      if (variants.size || vao) {
        try { withState('dispose', () => retireVariants(true)); }
        catch { failed = true; }
      }
      try { releaseStaging(); } catch { failed = true; }
      if (failed || releaseFailed) fail();
    },
    retired() { return closed && !active && !variants.size && !vao && released && !releaseFailed; }
  });
}

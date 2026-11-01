import { readNativeFrameAuthority } from './native-frame-authority.mjs';

const renderers = new WeakMap(), observationPlans = new WeakMap();

const fail = () => { throw new TypeError('Scene glyph rendering is unavailable.'); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
let allocationSequence = 0;

const vertexBody = `
uniform vec3 u_lr_anchor;
uniform vec2 u_lr_radius_clip;
uniform vec2 u_lr_backing_size;
uniform highp int u_lr_observation_mode;
out vec2 v_lr_circle;
out vec3 v_lr_sphere;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec4 center = lrProjectPosition(u_lr_anchor);
  gl_Position = center + vec4(corner * u_lr_radius_clip * center.w, 0.0, 0.0);
  if (u_lr_observation_mode == 1) {
    vec2 topPixel = vec2(center.x / center.w + 1.0, 1.0 - center.y / center.w) * 0.5 * u_lr_backing_size;
    if (center.w <= 0.0 || center.z < -center.w || center.z > center.w ||
        any(lessThan(topPixel, vec2(0.0))) || any(greaterThanEqual(topPixel, u_lr_backing_size)) ||
        any(isnan(topPixel)) || any(isinf(topPixel))) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    } else {
      vec2 cell = floor(topPixel);
      cell.y = u_lr_backing_size.y - 1.0 - cell.y;
      vec2 clipXY = (cell + (corner + 1.0) * 0.5) / u_lr_backing_size * 2.0 - 1.0;
      gl_Position = vec4(clipXY * center.w, center.z, center.w);
    }
  }
  v_lr_circle = corner;
  v_lr_sphere = lrHorizonPosition(u_lr_anchor);
}`;

const fragmentBody = `
uniform vec4 u_lr_color;
uniform highp int u_lr_observation_mode;
in vec2 v_lr_circle;
in vec3 v_lr_sphere;
out vec4 lr_color;
void main() {
  if (u_lr_observation_mode == 1) {
    if (lrHorizonOccluded(v_lr_sphere)) discard;
    lr_color = vec4(1.0); return;
  }
  float distanceToCenter = length(v_lr_circle);
  float edgeWidth = clamp(fwidth(distanceToCenter), 0.000001, 1.0);
  if (distanceToCenter > 1.0 || lrHorizonOccluded(v_lr_sphere)) discard;
  float coverage = 1.0 - smoothstep(1.0 - edgeWidth, 1.0, distanceToCenter);
  float alpha = u_lr_color.a * coverage;
  if (u_lr_observation_mode == 2 && alpha <= 0.0) discard;
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
  const allocationSerial = allocationSequence;
  const lease = reserve([{ kind: 'bytes', key: `scene-glyph-staging-${allocationSerial}`,
    pool: 'cpu-buffer', byteLength: 36 }]);
  let staging;
  try { staging = new Float32Array(9); }
  catch { /* Return the owner so even an allocation failure keeps its reservation reachable. */ }
  let anchor = staging?.subarray(0, 3), radius = staging?.subarray(3, 5), color = staging?.subarray(5, 9);
  let vao, current, closed = false, active = false, released = false, releaseFailed = false;
  const variants = new Set();
  let completionLease, completionStorage, lastPaint;

  const check = () => { if (gl.isContextLost() || !isCurrent() || gl.isContextLost()) fail(); };
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
    completionStorage = undefined; lastPaint = undefined;
    if (completionLease) {
      const retained = completionLease;
      try { retained.release(); completionLease = undefined; }
      catch { releaseFailed = true; fail(); }
    }
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

  function packets(frame, markers, observing = false, includeTransparent = false) {
    const result = [];
    for (const marker of markers) {
      check();
      if (!includeTransparent && marker.rgba[3] === 0) continue;
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
      const packet = { shader, position, radiusClip, rgba, depth, order: result.length };
      if (observing) packet.marker = marker;
      result.push(packet);
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
    call('uniform1i', [location(variant, 'u_lr_observation_mode'), 0]);
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

  const result = Object.freeze({
    render(frame, markers, authority) {
      if (active || closed) fail();
      active = true;
      let failed = false;
      try {
        lastPaint = undefined;
        let target, observationAuthority;
        if (authority !== undefined) {
          try {
            readNativeFrameAuthority(authority, gl, 'render'); check();
            target = captureObservationTarget(frame);
            readNativeFrameAuthority(authority, gl, 'render');
            observationAuthority = authority;
          } catch { /* Completion admission cannot replace ordinary marker rendering. */ }
        }
        const draws = packets(frame, markers, observationAuthority !== undefined);
        check();
        withState('draw', () => draw(frame, draws));
        if (observationAuthority !== undefined) {
          try {
            check(); readNativeFrameAuthority(observationAuthority, gl, 'render');
            lastPaint = { frame, authority: observationAuthority, target, markerCount: markers.length,
              markers: [...markers], draws, plans: new Map() };
          } catch { /* A revoked completion scope cannot revoke successful marker paint. */ }
        }
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
      if (failed) { lastPaint = undefined; fail(); }
    },
    dispose({ contextLost = false } = {}) {
      closed = true; lastPaint = undefined;
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
    retired() { return closed && !active && !variants.size && !vao && released && !releaseFailed && !completionLease; }
  });
  function captureObservationTarget(frame) {
    const depthFunction = call('getParameter', [gl.DEPTH_FUNC]);
    const depthRange = Object.freeze(Array.from(call('getParameter', [gl.DEPTH_RANGE])));
    const viewport = Object.freeze(Array.from(call('getParameter', [gl.VIEWPORT])));
    const scissor = Object.freeze(Array.from(call('getParameter', [gl.SCISSOR_BOX])));
    const scissorEnabled = call('isEnabled', [gl.SCISSOR_TEST]);
    check();
    const backingWidth = gl.drawingBufferWidth, backingHeight = gl.drawingBufferHeight;
    check();
    if (![backingWidth, backingHeight].every(value => Number.isSafeInteger(value) && value > 0)) fail();
    return Object.freeze({ width: frame.width, height: frame.height, backingWidth, backingHeight,
      depthFunction, depthRange, viewport, scissor, scissorEnabled });
  }
  function observationCurrent(record) {
    if (closed || active || !lastPaint || record.paint !== lastPaint || record.authority !== lastPaint.authority) fail();
    if (gl.isContextLost()) fail();
    readNativeFrameAuthority(record.authority, gl, 'render'); check();
    if (closed || record.paint !== lastPaint || gl.isContextLost()) fail();
    readNativeFrameAuthority(record.authority, gl, 'render');
  }
  function observationCall(record, name, args) {
    observationCurrent(record);
    const value = gl[name](...args);
    observationCurrent(record);
    return value;
  }
  function prepareObservation(frame, marker, authority) {
    const paint = lastPaint;
    if (!paint || paint.frame !== frame || paint.authority !== authority || closed || active) fail();
    if (!paint.markers.includes(marker)) fail();
    let packet = paint.draws.find(value => value.marker === marker);
    const record = { paint, packet, authority };
    observationCurrent(record);
    if (paint.plans.has(marker)) return paint.plans.get(marker);
    try {
      if (!packet && marker.rgba[3] === 0) {
        packet = packets(frame, [marker], true, true)[0];
        observationCurrent(record);
      }
      if (!packet) fail();
      record.packet = packet;
      if (!completionLease) {
        completionLease = reserve([{ kind: 'bytes', key: `scene-glyph-observation-${allocationSerial}`,
          pool: 'cpu-buffer', byteLength: 256 }]);
        completionStorage = new Float32Array(64);
      }
      observationCurrent(record);
      withState('draw', () => {
        if (!vao) create('createVertexArray', [], value => { vao = value; });
        record.variant = programFor(packet.shader);
        observationCurrent(record);
      });
      observationCurrent(record);
      record.facts = Object.freeze({ ...paint.target, markerCount: paint.markerCount,
        altitudeReference: marker.position.altitudeReference ?? 'sea-level' });
      record.read = () => {
        observationCurrent(record);
        const transition = packet.shader.uniforms.find(uniform => uniform.name === 'u_projection_transition');
        if (transition?.type !== 'float' || transition.value !== 0 || packet.shader.horizonMode !== 'none') fail();
        return record.facts;
      };
      record.draw = mode => {
        observationCurrent(record);
        if (mode !== 1 && mode !== 2 || !completionStorage || current !== record.variant) fail();
        const invoke = (name, args) => observationCall(record, name, args);
        invoke('bindVertexArray', [vao]); invoke('useProgram', [record.variant.program]);
        for (const uniform of packet.shader.uniforms) {
          const target = location(record.variant, uniform.name);
          if (uniform.type === 'mat4') invoke('uniformMatrix4fv', [target, false, uniform.value]);
          else if (uniform.type === 'vec4') invoke('uniform4fv', [target, uniform.value]);
          else if (uniform.type === 'float') invoke('uniform1f', [target, uniform.value]);
          else fail();
        }
        invoke('uniform3fv', [location(record.variant, 'u_lr_anchor'), packet.position]);
        invoke('uniform2fv', [location(record.variant, 'u_lr_radius_clip'), packet.radiusClip]);
        invoke('uniform4fv', [location(record.variant, 'u_lr_color'), packet.rgba]);
        invoke('uniform2fv', [location(record.variant, 'u_lr_backing_size'), [paint.target.backingWidth, paint.target.backingHeight]]);
        invoke('uniform1i', [location(record.variant, 'u_lr_observation_mode'), mode]);
        invoke('drawArrays', [gl.TRIANGLE_STRIP, 0, 4]);
      };
      const plan = Object.freeze({}); observationPlans.set(plan, { gl, authority, record }); paint.plans.set(marker, plan);
      return plan;
    } catch { fail(); }
  }
  renderers.set(result, prepareObservation);
  return result;
}

export function captureSceneGlyphObservation(renderer, frame, marker, authority) {
  const capture = renderers.get(renderer);
  if (!capture) fail();
  return capture(frame, marker, authority);
}

export function readSceneGlyphObservation(plan, gl, authority) {
  const value = observationPlans.get(plan);
  if (!value || value.gl !== gl || value.authority !== authority) fail();
  return value.record.read();
}

export function drawSceneGlyphObservation(plan, gl, authority, mode) {
  const value = observationPlans.get(plan);
  if (!value || value.gl !== gl || value.authority !== authority) fail();
  value.record.draw(mode);
}

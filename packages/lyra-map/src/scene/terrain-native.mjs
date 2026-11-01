let identity = 0;
const invalid = () => { throw new TypeError('Invalid native terrain batch.'); };
function own(value, key) {
  if (!value || typeof value !== 'object') invalid();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalid();
  return descriptor.value;
}
function list(value, limit) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) invalid();
  const length = own(value, 'length');
  if (!Number.isSafeInteger(length) || length > limit || Reflect.ownKeys(value).length !== length + 1) invalid();
  const result = [];
  for (let index = 0; index < length; index++) result.push(own(value, String(index)));
  return result;
}

/** Borrows one native context and synchronously lends completed samples until onComplete returns. */
export function createTerrainNativeBatch(options = {}) {
  const { gl, withState, reserve, isCurrent, requestRender, onComplete, now = () => performance.now() } = options;
  if (!gl || [withState, reserve, isCurrent, requestRender, onComplete, now].some(value => typeof value !== 'function')) invalid();
  const prefix = `terrain-native-${++identity}`;
  let disposed = false, active = null, generation = 0, allocation = 0, resource = null, running = false, inGuard = false, cleaning = false, admitting = false, invalidated = false;
  const owned = new Set();
  const lost = () => invalidated ||= gl.isContextLost();
  function live(current) {
    if (disposed || active !== current || current.generation !== generation || lost()) return false;
    const accepted = isCurrent();
    return accepted && !disposed && active === current && current.generation === generation && !lost();
  }
  function guard(work) {
    if (inGuard) return work();
    return withState(() => { inGuard = true; try { return work(); } finally { inGuard = false; } });
  }
  function cleanup() {
    if (cleaning || !owned.size) return;
    if (!lost() && ![...owned].some(record => record.retired)) return;
    cleaning = true;
    let failure;
    const attempted = new Set();
    const release = record => {
      // Terminal ownership ends before invoking the external, potentially reentrant lease.
      owned.delete(record); record.cpu = null;
      try { record.lease.release(); } catch (error) { failure ??= error; }
    };
    try {
      while (owned.size) {
        if (lost()) {
          for (const record of owned) release(record);
          resource = null; break;
        }
        const eligible = [...owned].filter(record => record.retired && !attempted.has(record));
        if (!eligible.length) break;
        guard(() => {
          for (const record of eligible) {
            attempted.add(record);
            for (const [key, method] of [['fence', 'deleteSync'], ['pbo', 'deleteBuffer'], ['framebuffer', 'deleteFramebuffer'], ['atlas', 'deleteTexture'], ['scratch', 'deleteTexture']]) {
              if (!record[key] || key === 'scratch' && record.quarantined) continue;
              if (lost()) break;
              try { gl[method](record[key]); record[key] = null; } catch (error) { failure ??= error; }
            }
            if (lost() || !record.quarantined && !record.fence && !record.pbo && !record.framebuffer && !record.atlas && !record.scratch) release(record);
          }
        });
        // Envelope-exit callbacks may retire an existing live record or invalidate the context.
        // Process each record once here; failed live deletions require explicit later retirement.
      }
    } finally { cleaning = false; }
    if (failure) throw failure;
  }
  function detachFailedScratch(record) {
    // A native hook can leave our texture attached to its own cached framebuffer.
    // Remove only the exact current attachment, before the state guard restores bindings.
    if (lost()) return false;
    const framebuffer = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    if (!framebuffer || lost()) return false;
    const type = gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE);
    if (type !== gl.TEXTURE || lost()) return false;
    const texture = gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);
    if (texture !== record.scratch || lost()) return false;
    const before = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    if (before !== framebuffer || lost()) return false;
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    if (lost()) return false;
    const after = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    if (after !== framebuffer || lost()) return false;
    const remainingType = gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE);
    if (remainingType !== gl.NONE || lost()) return false;
    const remaining = gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);
    if (remaining !== null || lost()) return false;
    const verified = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    return verified === framebuffer && !lost();
  }
  function markRetired() {
    active = null; generation++;
    for (const record of owned) record.retired = true;
    resource = null;
  }
  function cancel() { markRetired(); if (!running) cleanup(); }
  function allocate(current) {
    if (resource) return resource;
    const key = `${prefix}-${++allocation}`;
    const texture = (purpose, width) => ({ kind: 'texture', key: `${key}-${purpose}`, pool: 'gpu-texture', width, height: 1, layers: 1, faces: 1, bytesPerPixel: 16, mipLevels: 1 });
    const lease = reserve([texture('scratch', 1), texture('atlas', 8),
      { kind: 'bytes', key: `${key}-pbo`, pool: 'gpu-buffer', byteLength: 128 },
      { kind: 'bytes', key: `${key}-cpu`, pool: 'cpu-buffer', byteLength: 128 }]);
    if (!lease || typeof lease.release !== 'function') invalid();
    const record = { lease, retired: false, quarantined: false, scratch: null, atlas: null, framebuffer: null, pbo: null, fence: null, cpu: null };
    // Own the returned lease locally before testing callbacks that may have canceled this operation.
    owned.add(record);
    if (!live(current)) { record.retired = true; return null; }
    resource = record; record.cpu = new Float32Array(32);
    for (const [name, method] of [['scratch', 'createTexture'], ['atlas', 'createTexture'], ['framebuffer', 'createFramebuffer'], ['pbo', 'createBuffer']]) {
      if (!live(current)) return null;
      record[name] = gl[method](); if (!record[name]) throw new Error('Terrain allocation unavailable.');
    }
    for (const [handle, width] of [[record.scratch, 1], [record.atlas, 8]]) {
      if (!live(current)) return null;
      gl.bindTexture(gl.TEXTURE_2D, handle); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    return record;
  }
  return Object.freeze({
    submit(value) {
      if (running || cleaning || admitting || disposed || active || lost()) return false;
      admitting = true;
      try {
        const admission = generation, accepted = isCurrent();
        if (!accepted || running || cleaning || disposed || active || generation !== admission || lost()) return false;
        const token = own(value, 'token'), span = own(value, 'span'), source = list(own(value, 'points'), 8);
        if (!token || typeof token !== 'object' || !source.length || !Number.isFinite(span) || span <= 0) invalid();
        const points = source.map(point => {
          const coordinate = list(point, 2);
          if (coordinate.length !== 2 || !coordinate.every(Number.isFinite) || coordinate[1] < 0 || coordinate[1] > 1) invalid();
          const bounds = [coordinate[0] - span / 2, coordinate[1] - span / 2, coordinate[0] + span / 2, coordinate[1] + span / 2];
          if (!bounds.every(Number.isFinite) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) invalid();
          return bounds;
        });
        if (disposed || active || generation !== admission || lost()) return false;
        const confirmed = isCurrent();
        if (!confirmed || running || cleaning || disposed || active || generation !== admission || lost()) return false;
        active = { token, points, generation, waiting: false, count: 0 }; return true;
      } finally { admitting = false; }
    },
    prerender(args) {
      if (running || cleaning || admitting || disposed || !active) return;
      const current = active; running = true;
      let unavailable = false, failure, result, completed = null;
      try {
        const start = now();
        if (!live(current)) markRetired();
        else {
          guard(() => {
            if (!live(current)) return;
            if (current.waiting) {
              const record = resource, status = gl.clientWaitSync(record.fence, 0, 0);
              if (!live(current)) return;
              if (status === gl.WAIT_FAILED) throw new Error('Terrain readback unavailable.');
              if (status === gl.TIMEOUT_EXPIRED) {
                const elapsed = now() - current.fencedAt;
                if (!live(current)) return;
                if (elapsed > 10000) throw new Error('Terrain readback unavailable.');
                return;
              }
              if (status !== gl.ALREADY_SIGNALED && status !== gl.CONDITION_SATISFIED) throw new Error('Terrain readback unavailable.');
              gl.bindBuffer(gl.PIXEL_PACK_BUFFER, record.pbo);
              const rgba = record.cpu.subarray(0, current.count * 4);
              gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, rgba);
              if (!live(current)) return;
              for (let index = 0; index < current.count; index++) {
                const alpha = rgba[index * 4 + 3];
                if ((alpha !== 0 && alpha !== 1) || (alpha === 1 && !Number.isFinite(rgba[index * 4]))) throw new Error('Terrain readback unavailable.');
              }
              gl.deleteSync(record.fence); record.fence = null;
              completed = { rgba, count: current.count }; return;
            }
            const render = args?.renderTerrainHeightMap;
            if (!live(current)) return;
            if (typeof render !== 'function' || !gl.getExtension('EXT_color_buffer_float')) { unavailable = true; return; }
            if (!live(current)) return;
            const record = allocate(current);
            if (!record || !live(current)) return;
            for (const bounds of current.points) {
              const elapsed = now() - start;
              if (!live(current)) return;
              if (current.count && elapsed >= 4) break;
              try { render.call(args, { texture: record.scratch, width: 1, height: 1, bounds }); }
              catch (error) {
                // Ambiguous native attachment lifetime holds the compound lease until context loss.
                disposed = true; record.quarantined = true;
                try { record.quarantined = !detachFailedScratch(record); } catch { /* Keep the reservation when proof fails. */ }
                throw error;
              }
              if (!live(current)) return;
              gl.bindFramebuffer(gl.READ_FRAMEBUFFER, record.framebuffer);
              gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, record.scratch, 0); gl.readBuffer(gl.COLOR_ATTACHMENT0);
              if (gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Terrain framebuffer unavailable.');
              gl.bindTexture(gl.TEXTURE_2D, record.atlas); gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, current.count, 0, 0, 0, 1, 1); current.count++;
            }
            gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, record.atlas, 0);
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, record.pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, 128, gl.STREAM_READ);
            for (const name of ['PACK_ROW_LENGTH', 'PACK_SKIP_PIXELS', 'PACK_SKIP_ROWS']) gl.pixelStorei(gl[name], 0);
            gl.pixelStorei(gl.PACK_ALIGNMENT, 1); gl.readPixels(0, 0, current.count, 1, gl.RGBA, gl.FLOAT, 0);
            record.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); if (!record.fence) throw new Error('Terrain fence unavailable.');
            gl.flush(); current.waiting = true; current.fencedAt = now();
          });
          if (!live(current) || unavailable) {
            markRetired(); result = unavailable ? { status: 'terrain-unavailable' } : undefined;
          } else {
            if (completed) {
              // Protected synchronous borrow: no submit/prerender may reuse this storage until return.
              onComplete(current.token, completed);
              if (active === current) active = null;
            } else requestRender();
            if (lost() || disposed || active && !isCurrent()) markRetired();
          }
        }
      } catch (error) { failure = error; markRetired(); }
      finally {
        running = false;
        if (lost()) markRetired();
        try { cleanup(); } catch (error) { failure ??= error; }
      }
      if (failure) throw new Error('Terrain batch unavailable.');
      return result;
    },
    cancel,
    dispose({ contextLost = false } = {}) {
      disposed = true; invalidated ||= contextLost; markRetired();
      if (!running) cleanup();
    }
  });
}

const contexts = new WeakMap(), frames = new WeakMap(), scopes = new WeakMap(), authorities = new WeakMap();
const unqualified = Object.freeze({ status: 'unqualified' }), refused = Object.freeze({ status: 'refused' });
const object = value => value !== null && (typeof value === 'object' || typeof value === 'function');
const opaque = () => Object.freeze(Object.create(null));
const unavailable = () => { throw new TypeError('Native frame authority unavailable.'); };

function fields(value, keys) {
  if (!object(value)) unavailable();
  const names = Reflect.ownKeys(value);
  if (names.length !== keys.length || names.some(key => !keys.includes(key))) unavailable();
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) unavailable();
    result[key] = descriptor.value;
  }
  return result;
}

function copyFrameFacts(value) {
  const source = fields(value, ['styleGeneration', 'orderedLayers', 'terrainEnabled', 'projection',
    'projectionTransition', 'debug', 'tailDraws']);
  if (!Number.isSafeInteger(source.styleGeneration) || source.styleGeneration < 0 ||
      typeof source.terrainEnabled !== 'boolean' || typeof source.debug !== 'boolean' ||
      typeof source.tailDraws !== 'boolean' || typeof source.projection !== 'string' ||
      source.projection.length === 0 || source.projection.length > 128 ||
      !Number.isFinite(source.projectionTransition) || source.projectionTransition < 0 || source.projectionTransition > 1 ||
      !Array.isArray(source.orderedLayers)) unavailable();
  const length = Object.getOwnPropertyDescriptor(source.orderedLayers, 'length')?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > 10000 ||
      Reflect.ownKeys(source.orderedLayers).length !== length + 1) unavailable();
  const orderedLayers = [], ids = new Set();
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(source.orderedLayers, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) unavailable();
    const layer = fields(descriptor.value, ['id', 'type']);
    if (typeof layer.id !== 'string' || !layer.id.trim() || layer.id.length > 1024 || ids.has(layer.id) ||
        typeof layer.type !== 'string' || !layer.type || layer.type.length > 128) unavailable();
    ids.add(layer.id);
    orderedLayers.push(Object.freeze({ id: layer.id, type: layer.type }));
  }
  return Object.freeze({ styleGeneration: source.styleGeneration, orderedLayers: Object.freeze(orderedLayers),
    terrainEnabled: source.terrainEnabled, projection: source.projection,
    projectionTransition: source.projectionTransition, debug: source.debug, tailDraws: source.tailDraws });
}

function copyPhaseFacts(value, length) {
  const source = fields(value, ['pass', 'currentLayer']);
  if (typeof source.pass !== 'string' || source.pass.length > 128 ||
      !Number.isSafeInteger(source.currentLayer) || source.currentLayer < 0 || source.currentLayer >= length) unavailable();
  return Object.freeze({ pass: source.pass, currentLayer: source.currentLayer });
}

function revoke(frame) {
  if (!frame) return;
  frame.revoked = true;
  frame.gl = frame.frameContext = undefined;
  for (const scope of frame.scopes) {
    scope.authorityRecord.scope = undefined;
    scope.implementation = scope.render = scope.args = undefined;
  }
}

function trim(context) {
  while (context.stack.at(-1)?.closed) context.stack.pop();
}

function registration(context, implementation, render) {
  return object(implementation) && typeof render === 'function' ? context.registrations.get(implementation)?.get(render) : undefined;
}

function currentFrame(frame) {
  return frame && !frame.revoked && frame.context.active && frame.context.demand > 0 &&
    frame.context.current === frame && contexts.get(frame.gl) === frame.context;
}

function currentScope(scope, stage) {
  if (!scope || !currentFrame(scope.frame) || !scope.registration.active || !scope.admitted) return false;
  if (stage === 'render') return !scope.closed && !scope.frame.closed && scope.frame.currentScope === scope &&
    scope.frame.context.stack.at(-1) === scope.frame;
  return stage === 'completed' && scope.closed && scope.normal && scope.frame.sealed;
}

/** Enrolls only an exact native implementation and render identity. */
export function registerNativeFrameDemand(gl, implementation, render) {
  if (!object(gl) || !object(implementation) || typeof render !== 'function') unavailable();
  let context = contexts.get(gl);
  if (!context) {
    context = { active: true, demand: 0, registrations: new WeakMap(), stack: [], current: undefined };
    contexts.set(gl, context);
  }
  if (context.demand === Number.MAX_SAFE_INTEGER) unavailable();
  let renders = context.registrations.get(implementation);
  if (!renders) { renders = new WeakMap(); context.registrations.set(implementation, renders); }
  let entry = renders.get(render);
  if (!entry?.active) { entry = { active: true, count: 0 }; renders.set(render, entry); }
  entry.count++; context.demand++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.count--; context.demand--;
    if (entry.count === 0) {
      entry.active = false;
      for (const frame of new Set([...context.stack, context.current])) {
        if (!frame) continue;
        for (const scope of frame.scopes) if (scope.registration === entry) {
          scope.authorityRecord.scope = undefined;
          scope.implementation = scope.render = scope.args = undefined;
        }
      }
    }
    if (context.demand === 0) revoke(context.current);
  };
}

export function hasNativeFrameDemand(gl) {
  return object(gl) && (contexts.get(gl)?.demand ?? 0) > 0;
}

/** Invalidates the previous paint before examining any new native facts. */
export function beginNativeFrame(gl, frameContext, facts) {
  const context = object(gl) ? contexts.get(gl) : undefined;
  if (!context?.active || context.demand === 0) return undefined;
  revoke(context.current);
  if (!object(frameContext)) return undefined;
  trim(context);
  const nested = context.stack.length > 0;
  if (nested) for (const previous of context.stack) revoke(previous);
  const token = opaque(), frame = { gl, frameContext, context, revoked: nested, closed: false, sealed: false,
    facts: undefined, scopes: new Set(), seen: new WeakSet(), currentScope: undefined };
  frames.set(token, frame);
  context.current = frame; context.stack.push(frame);
  if (!nested) {
    try {
      const copied = copyFrameFacts(facts);
      if (currentFrame(frame) && context.stack.at(-1) === frame && !frame.closed) frame.facts = copied;
      else revoke(frame);
    } catch { revoke(frame); }
  }
  return token;
}

/** Opens bookkeeping around the original native callback; it never calls that callback. */
export function enterNativeCustomRender(token, implementation, render, args, facts) {
  if (token === undefined) return undefined;
  const frame = object(token) ? frames.get(token) : undefined;
  if (!frame || frame.closed || frame.context.current !== frame) unavailable();
  if (frame.currentScope) { revoke(frame); return undefined; }
  if (!currentFrame(frame)) return undefined;
  const entry = registration(frame.context, implementation, render);
  if (!entry?.active) return undefined;
  if (!object(args) || frame.seen.has(implementation)) { revoke(frame); unavailable(); }
  frame.seen.add(implementation);
  const scopeToken = opaque(), authority = opaque(), authorityRecord = { scope: undefined };
  const scope = { frame, registration: entry, implementation, render, args, authorityRecord,
    closed: false, normal: false, admitted: false, result: refused };
  authorityRecord.scope = scope; authorities.set(authority, authorityRecord); scopes.set(scopeToken, scope);
  frame.currentScope = scope; frame.scopes.add(scope);
  try {
    const phase = copyPhaseFacts(facts, frame.facts.orderedLayers.length);
    if (currentFrame(frame) && !frame.closed && frame.currentScope === scope && !scope.closed && entry.active) {
      scope.admitted = phase.pass === 'translucent';
      if (scope.admitted) scope.result = Object.freeze({ status: 'admitted', authority,
        facts: Object.freeze({ frame: frame.facts, phase }) });
    } else revoke(frame);
  } catch { revoke(frame); }
  return scopeToken;
}

export function leaveNativeCustomRender(token, normal) {
  const scope = object(token) ? scopes.get(token) : undefined;
  if (!scope || scope.closed) return;
  scope.closed = true; scope.normal = normal === true;
  if (scope.frame.currentScope === scope) scope.frame.currentScope = undefined;
  if (!scope.normal) revoke(scope.frame);
}

export function sealNativeFrame(token) {
  if (token === undefined) return undefined;
  const frame = object(token) ? frames.get(token) : undefined;
  if (!frame || frame.closed || frame.currentScope) return false;
  const normal = currentFrame(frame) && frame.context.stack.at(-1) === frame;
  frame.closed = true; frame.sealed = normal;
  if (!normal) revoke(frame);
  trim(frame.context);
  return normal;
}

export function abortNativeFrame(token) {
  const frame = object(token) ? frames.get(token) : undefined;
  if (!frame) return;
  revoke(frame); frame.closed = true;
  trim(frame.context);
}

export function loseNativeFrameContext(gl) {
  const context = object(gl) ? contexts.get(gl) : undefined;
  if (!context) return;
  context.active = false;
  for (const frame of new Set([...context.stack, context.current])) revoke(frame);
  contexts.delete(gl);
}

export function captureNativeFrameAuthority(gl, implementation, render, args) {
  const context = object(gl) ? contexts.get(gl) : undefined;
  if (!context?.active || context.demand === 0) return unqualified;
  const scope = context.current?.currentScope;
  return currentScope(scope, 'render') && scope.implementation === implementation && scope.render === render && scope.args === args ?
    scope.result : refused;
}

/** Reads detached facts through an exact current private receipt, without touching native identities. */
export function readNativeFrameAuthority(authority, gl, stage) {
  const scope = object(authority) ? authorities.get(authority)?.scope : undefined;
  if (!currentScope(scope, stage) || scope.frame.gl !== gl) unavailable();
  return scope.result.facts;
}

function assertAuthority(authority, gl, implementation, render, args, stage) {
  const scope = object(authority) ? authorities.get(authority)?.scope : undefined;
  if (!currentScope(scope, stage) || scope.frame.gl !== gl || scope.implementation !== implementation ||
      scope.render !== render || scope.args !== args) unavailable();
}

export function assertNativeFrameRenderAuthority(authority, gl, implementation, render, args) {
  assertAuthority(authority, gl, implementation, render, args, 'render');
}

export function assertNativeFrameCompletedAuthority(authority, gl, implementation, render, args) {
  assertAuthority(authority, gl, implementation, render, args, 'completed');
}

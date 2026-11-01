import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { serializeJavaScript } from './code-serialization.mjs';

const pins = Object.freeze({
  painter: 'edf08f62a0a52cce51847c154413c9b054b6d9a3d988d82fe50e3fa3d8ad090c',
  drawCustom: 'c029531a50a329339e3b37f419a081c6e50e3e5d5dcde90473099a684a320b74'
});
const digest = value => createHash('sha256').update(value).digest('hex');
const paths = Object.freeze({ painter: 'render/painter.ts', drawCustom: 'webgl/draw/draw_custom.ts' });

/** An additional capability check after the build's ordinary upstream integrity checks. */
export function nativeFrameSourcesMatch(value) {
  try {
    return typeof value?.painter === 'string' && typeof value?.drawCustom === 'string' &&
      digest(value.painter) === pins.painter && digest(value.drawCustom) === pins.drawCustom;
  } catch { return false; }
}

function replaceOne(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Native frame source anchor changed.');
  return source.replace(before, after);
}

function transportSource(registryId) {
  return `import { beginNativeFrame, abortNativeFrame, hasNativeFrameDemand } from ${serializeJavaScript(registryId)};
const nativeFrames = new WeakMap(), styleGenerations = new WeakMap();
let nextStyleGeneration = 0;

export function beginNativePainter(frameContext, style, renderToTexture) {
  const gl = frameContext.context.gl;
  if (!hasNativeFrameDemand(gl)) return undefined;
  let facts;
  try {
    let styleGeneration = styleGenerations.get(style);
    if (styleGeneration === undefined) {
      if (nextStyleGeneration === Number.MAX_SAFE_INTEGER) throw new Error('Native style generation exhausted.');
      styleGeneration = ++nextStyleGeneration;
      styleGenerations.set(style, styleGeneration);
    }
    const order = style._order;
    if (!Array.isArray(order) || order.length > 10000) throw new Error('Native layer order unavailable.');
    const orderedLayers = order.map(id => ({ id, type: style._layers[id].type }));
    const data = frameContext.data;
    if ([data.showOverdrawInspector, data.showTileBoundaries, data.showPadding, data.isRenderingGlobe]
      .some(value => typeof value !== 'boolean')) throw new Error('Native frame flags unavailable.');
    facts = { styleGeneration, orderedLayers, terrainEnabled: frameContext.terrain !== null,
      projection: style.projection.name, projectionTransition: data.projectionTransition,
      debug: data.showOverdrawInspector || data.showTileBoundaries || data.showPadding,
      tailDraws: data.isRenderingGlobe || data.showTileBoundaries || data.showPadding || renderToTexture || Boolean(data.sky) };
  } catch {
    // An invalid begin still revokes the previous paint before native work resumes.
    facts = undefined;
  }
  const frame = beginNativeFrame(gl, frameContext, facts);
  if (frame !== undefined) nativeFrames.set(frameContext, frame);
  return frame;
}

export function nativeFrameFor(frameContext) {
  return nativeFrames.get(frameContext);
}

export function finishNativePainter(frameContext, frame, sealed) {
  if (nativeFrames.get(frameContext) === frame) nativeFrames.delete(frameContext);
  if (!sealed) abortNativeFrame(frame);
}
`;
}

/** Creates an isolated native phase transform; it does not enable terrain specialization. */
export function createNativeFramePlugin({ enabled = false, registryId, upstreamRoot } = {}) {
  if (typeof enabled !== 'boolean' || typeof registryId !== 'string' || !isAbsolute(registryId) ||
      typeof upstreamRoot !== 'string' || !isAbsolute(upstreamRoot)) throw new TypeError('Invalid native frame transform options.');
  const registry = resolve(registryId), sourceRoot = resolve(upstreamRoot, 'src');
  const transportId = resolve(sourceRoot, 'modular/native-frame-transport.ts');
  const ids = new Map(Object.entries(paths).map(([name, relative]) => [resolve(sourceRoot, relative), name]));
  const changed = new Map();
  const transport = enabled ? transportSource(registry) : undefined;
  return Object.freeze({
    name: 'native-frame-authority',
    changed,
    resolveId(id) { if (enabled && id === transportId) return transportId; },
    load(id) { if (enabled && id === transportId) return transport; },
    transform(original, id) {
      const name = ids.get(id);
      if (!enabled || !name) return undefined;
      if (typeof original !== 'string' || digest(original) !== pins[name]) throw new Error('Native frame source differs from its capability pin.');
      let code = original;
      if (name === 'painter') {
        code = replaceOne(code, '        this.lineAtlas = style.lineAtlas;',
          `        const nativeCompletionFrame = hasNativeFrameDemand(this.context.gl) ?
            beginNativePainter(frameRenderContext, style, Boolean(this.renderToTexture)) : undefined;
        let nativeCompletionSealed = false;
        try {
        this.lineAtlas = style.lineAtlas;`);
        code = replaceOne(code,
          '        this.context.setDefault();\n    }\n\n    /**\n     * Invalidates cached terrain depth',
          `        this.context.setDefault();
        if (nativeCompletionFrame !== undefined) nativeCompletionSealed = sealNativeFrame(nativeCompletionFrame);
        } finally {
            if (nativeCompletionFrame !== undefined) finishNativePainter(frameRenderContext, nativeCompletionFrame, nativeCompletionSealed);
        }
    }

    /**
     * Invalidates cached terrain depth`);
        code = `import { hasNativeFrameDemand, sealNativeFrame } from ${serializeJavaScript(registry)};\n` +
          `import { beginNativePainter, finishNativePainter } from ${serializeJavaScript(transportId)};\n` + code;
      } else {
        code = replaceOne(code, '        implementation.render(context.gl, customLayerArgs);',
          `        const nativeCompletionFrame = hasNativeFrameDemand(context.gl) ? nativeFrameFor(frameRenderContext) : undefined;
        if (nativeCompletionFrame === undefined) {
            implementation.render(context.gl, customLayerArgs);
        } else {
            const nativeCompletionRender = implementation.render;
            let nativeCompletionScope;
            try {
                nativeCompletionScope = enterNativeCustomRender(nativeCompletionFrame, implementation, nativeCompletionRender,
                    customLayerArgs, { pass: frameRenderContext.currentPass, currentLayer: frameRenderContext.currentLayer });
            } catch {
                abortNativeFrame(nativeCompletionFrame);
            }
            let nativeCompletionReturned = false;
            try {
                Reflect.apply(nativeCompletionRender, implementation, [context.gl, customLayerArgs]);
                nativeCompletionReturned = true;
            } finally {
                leaveNativeCustomRender(nativeCompletionScope, nativeCompletionReturned);
            }
        }`);
        code = `import { hasNativeFrameDemand, enterNativeCustomRender, leaveNativeCustomRender, abortNativeFrame } from ${serializeJavaScript(registry)};\n` +
          `import { nativeFrameFor } from ${serializeJavaScript(transportId)};\n` + code;
      }
      changed.set(paths[name], { original: Buffer.byteLength(original), transformed: Buffer.byteLength(code) });
      return { code };
    }
  });
}

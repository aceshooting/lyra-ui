import { LoadingManager } from 'three';
import { ModelAdmissionError, readModelAdmission } from './admission.js';
import { aborted, disposeParserContext, type FormatParser, type ModelParserContext, type ParsedModel } from './model-parser-common.js';
import { validateParsedModel } from './model-validation.js';
import type { ModelAdmission, ModelFormat } from './types.js';

export type { ParsedModel } from './model-parser-common.js';
export interface ModelParseOptions { readonly signal?: AbortSignal }
interface ModelParserServices { readonly loadFormat?: (format: ModelFormat) => Promise<FormatParser> }

async function loadFormat(format: ModelFormat): Promise<FormatParser> {
  switch (format) {
    case 'xyz': return (await import('./parsers/xyz.js')).parse;
    case 'obj': return (await import('./parsers/obj.js')).parse;
    case 'ply': return (await import('./parsers/ply.js')).parse;
    case 'pcd': return (await import('./parsers/pcd.js')).parse;
    case 'stl': return (await import('./parsers/stl.js')).parse;
    case 'gltf':
    case 'glb': return (await import('./parsers/gltf.js')).parse;
  }
}

/** Parse an opaque admission receipt with no external requests or format extension plugins. */
export async function parseModel(admission: ModelAdmission, options: ModelParseOptions = {}, services: ModelParserServices = {}): Promise<ParsedModel> {
  aborted(options.signal); const input = readModelAdmission(admission);
  const manager = new LoadingManager(); manager.setURLModifier(() => { throw new ModelAdmissionError('external-resource'); });
  const context: ModelParserContext = { input, admission, manager, signal: options.signal, roots: [], textures: new Set(), images: new Set(), retirement: [] };
  let transferred = false;
  try {
    const parse = await (services.loadFormat ?? loadFormat)(input.format);
    aborted(options.signal);
    const object = await parse(context);
    if (!context.roots.includes(object)) context.roots.push(object);
    aborted(options.signal); const allScenes = validateParsedModel(context.roots, admission);
    const measured = context.roots.length === 1 ? allScenes : validateParsedModel([object], admission);
    let disposed = false; transferred = true;
    return { object, ...measured, dispose() { if (!disposed) { disposed = true; disposeParserContext(context); } } };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (error instanceof ModelAdmissionError) throw error;
    throw new ModelAdmissionError('invalid');
  } finally {
    if (!transferred) {
      // A cleanup listener must not replace the original parse/abort failure.
      try { disposeParserContext(context); } catch { /* Every owned resource was attempted. */ }
    }
  }
}

import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { basePlugin } from './base-transform.mjs';
import { transformWorker } from './worker-transform.mjs';
import { transformMetadata } from './metadata-transform.mjs';
import { transformSpriteKeys } from './sprite-key-transform.mjs';

const base = dirname(fileURLToPath(import.meta.resolve('maplibre-gl/package.json')));
export const src = resolve(base, 'src');
export const virtual = new Map();
export const changed = new Map();
const moduleId = (name) => resolve(src, 'modular', name + '.ts');
const path = (p) => JSON.stringify(resolve(src, p));
const runtimeId = moduleId('runtime');
const prepareId = moduleId('prepare');
function replace(code, old, value, count = 1) {
  const n = code.split(old).length - 1;
  if (n !== count) throw Error(`Patch mismatch ${old.slice(0, 80)}: ${n} != ${count}`);
  return code.replaceAll(old, value);
}
function family(name) {
  if (name === 'prelude' || name === 'projectionMercator' || name === 'clippingMask' || name === 'depth') return 'core';
  if (name.startsWith('projectionGlobe')) return 'globe';
  if (name.startsWith('fillExtrusion')) return 'fill-extrusion';
  if (name.startsWith('hillshade')) return 'hillshade';
  if (name.startsWith('colorRelief')) return 'color-relief';
  if (name.startsWith('collision') || name.startsWith('symbol')) return 'symbol';
  if (name.startsWith('terrain')) return 'terrain';
  if (name === 'sky' || name === 'atmosphere') return 'sky';
  for (const p of ['background', 'circle', 'heatmap', 'fill', 'line', 'raster', 'debug'])
    if (name.startsWith(p)) return p;
  if (name === 'layerOpacity') return 'layer-opacity';
  throw Error(`Unclassified program ${name}`);
}

virtual.set(
  runtimeId,
  `export const runtimeFeatures={};
let symbolReady,terrainReady;
export async function prepareSymbols(){return symbolReady??=(Promise.all([import(${path(
    'style/pauseable_placement.ts'
  )}),import(${path('symbol/cross_tile_symbol_index.ts')}),import(${path(
    'data/bucket/symbol_bucket.ts'
  )})]).then(([p,c,b])=>Object.assign(runtimeFeatures,{PauseablePlacement:p.PauseablePlacement,CrossTileSymbolIndex:c.CrossTileSymbolIndex,SymbolBucket:b.SymbolBucket})).catch(e=>{symbolReady=undefined;throw e;}));}
export async function prepareTerrain(){return terrainReady??=(Promise.all([import(${path(
    'render/terrain.ts'
  )}),import(${path(
    'webgl/render_to_texture.ts'
  )})]).then(([t,r])=>Object.assign(runtimeFeatures,{Terrain:t.Terrain,RenderToTexture:r.RenderToTexture})).catch(e=>{terrainReady=undefined;throw e;}));}`
);
virtual.set(
  prepareId,
  `import {derefLayers} from '@maplibre/maplibre-gl-style-spec';import {MessageType} from ${path(
    'util/actor_messages.ts'
  )};import {prepareStyleLayers} from ${path('style/create_style_layer.ts')};
import {prepareSources} from ${path('source/source.ts')};
import {prepareDraws} from ${path('webgl/draw/index.ts')};
import {prepareShaders} from ${path('shaders/shaders.ts')};
import {prepareUniforms} from ${path('webgl/program/program_uniforms.ts')};
import {prepareProjection} from ${path('geo/projection/projection_factory.ts')};
import {prepareSymbols,prepareTerrain} from ${JSON.stringify(runtimeId)};
export function snapshotStyle(value){if(Array.isArray(value))return value.map(snapshotStyle);if(value&&typeof value==='object'){const prototype=Object.getPrototypeOf(value);if(prototype===null||Object.getPrototypeOf(prototype)===null)return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,snapshotStyle(item)]));}return value;}
import {validateStyleAndEmit} from ${path('style/validate_style.ts')};
export async function prepareReplacement(style,json,options,controller){const previous=options.transformStyle?style.serialize():undefined;const state=snapshotStyle(options.transformStyle?options.transformStyle(previous,json):json);if((options.validate??true)&&validateStyleAndEmit(style,state))return;await prepareTransaction(style,state,controller);return state;}
export async function prepareMapFeatures(map,requirements,options={}){options.signal?.throwIfAborted();map._lazyInitEmptyStyle();const style=map.style;const state=snapshotStyle({version:8,sources:{},layers:[],...requirements});const controller=new AbortController();const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();(style._modularFeaturePreparations??=new Set()).add(controller);try{await abortable(Promise.resolve(style._modularReady),controller.signal);await prepareTransaction(style,state,controller);if(map.style!==style||map._removed)throw new DOMException('Map removed or style replaced','AbortError');}finally{options.signal?.removeEventListener('abort',abort);style._modularFeaturePreparations.delete(controller);}}
export function beginPreparation(style){style._modularPreparation?.abort();return style._modularPreparation=new AbortController();}
async function abortable(promise,signal){signal.throwIfAborted();let listener;try{return await Promise.race([promise,new Promise((_,reject)=>{listener=()=>reject(new DOMException('Style preparation aborted','AbortError'));signal.addEventListener('abort',listener,{once:true});})]);}finally{signal.removeEventListener('abort',listener);}}
export async function prepareTransaction(style,state,controller){try{
 const signal=controller.signal;await abortable(prepareStyle(state),signal);const actors=await abortable(style.dispatcher.actorsPromise,signal);signal.throwIfAborted();
 await Promise.all(actors.map(actor=>actor.sendAsync({type:MessageType.prepareFeatures,data:{layers:derefLayers(state.layers).map(layer=>({type:layer.type})),sources:Object.values(state.sources).map(s=>s.type)}},controller)));signal.throwIfAborted();
}catch(error){if(error?.name!=='AbortError'&&error instanceof Error)error.modularPreparationFailure=true;throw error;}}
export async function prepareStyle(style){
 const layers=derefLayers(style.layers??[]);const types=[...new Set(layers.map(l=>l.type))];
 const programs=[...types,'debug','sky'];if(types.includes('line')||types.includes('fill'))programs.push('layer-opacity');
 const projection=style.projection?.type??'mercator';if(projection!=='mercator')programs.push('globe');
 if(style.terrain)programs.push('terrain');
 await Promise.all([prepareStyleLayers(layers),prepareSources(Object.values(style.sources??{}).map(s=>s.type)),prepareDraws(types),prepareShaders(programs),prepareUniforms(programs),prepareProjection(projection),types.includes('symbol')?prepareSymbols():undefined,style.terrain?prepareTerrain():undefined]);
}`
);

async function shaderTable(code, id) {
  const imports = new Map(
    [...code.matchAll(/^import (\w+) from '([^']+)';$/gm)].map((m) => [m[1], resolve(dirname(id), m[2])])
  );
  const marker = '} = {';
  const start = code.indexOf('export const shaders:');
  const objectStart = code.indexOf(marker, start) + marker.length;
  const end = code.indexOf('\n};', objectStart);
  if (start < 0 || objectStart < marker.length || end < 0) throw Error('Shader table drift');
  const entries = [...code.slice(objectStart, end).matchAll(/(\w+): prepare\((\w+), (\w+)\)/g)];
  if (entries.length !== 37) throw Error(`Shader entries ${entries.length}`);
  const groups = Object.groupBy(entries, (m) => family(m[1]));
  const core = groups.core;
  delete groups.core;
  const importCode = (items) =>
    [...new Set(items.flatMap((m) => [m[2], m[3]]))]
      .map((n) => `import ${n} from ${JSON.stringify(imports.get(n))};`)
      .join('\n');
  const objectCode = (items) => items.map((m) => `${m[1]}:prepare(${m[2]},${m[3]})`).join(',');
  const loaders = [];
  for (const [group, items] of Object.entries(groups)) {
    const v = moduleId('shader-' + group);
    virtual.set(
      v,
      `${importCode(items)}\nimport {prepare} from ${JSON.stringify(id)};export default {${objectCode(items)}};`
    );
    loaders.push(`${JSON.stringify(group)}:()=>import(${JSON.stringify(v)})`);
  }
  const tail = code.slice(end + 3).replace('function prepare(', 'export function prepare(');
  return `${importCode(core)}\nexport const shaders={${objectCode(
    core
  )}};${tail}\nconst loaders={${loaders}};const pending={};export async function prepareShaders(groups){await Promise.all([...new Set(groups)].map(g=>!loaders[g]?undefined:pending[g]??=(loaders[g]().then(m=>Object.assign(shaders,m.default)).catch(e=>{delete pending[g];throw e;}))));}`;
}
function uniformTable(code, id) {
  const imports = new Map();
  for (const m of code.matchAll(/^import \{([^}]+)\} from '([^']+)';$/gm))
    for (const name of m[1]
      .split(',')
      .map((x) => x.trim())
      .filter((x) => !x.startsWith('type ')))
      imports.set(name, resolve(dirname(id), m[2]));
  const start = code.indexOf('} = {');
  const end = code.indexOf('\n};', start);
  if (start < 0 || end < 0) throw Error('Uniform table drift');
  const entries = [...code.slice(start + 5, end).matchAll(/(\w+): (\w+)/g)];
  if (entries.length !== 34) throw Error(`Uniform entries ${entries.length}`);
  const groups = Object.groupBy(entries, (m) => family(m[1]));
  const core = groups.core ?? [];
  delete groups.core;
  const generate = (items) => {
    const defs = [...new Set(items.map((m) => m[2]).filter((n) => n !== 'emptyUniforms'))]
      .map((n) => `import {${n}} from ${JSON.stringify(imports.get(n))};`)
      .join('\n');
    return `${defs}\nconst emptyUniforms=()=>({});export default {${items.map((m) => `${m[1]}:${m[2]}`)}};`;
  };
  const loaders = [];
  for (const [group, items] of Object.entries(groups)) {
    const v = moduleId('uniform-' + group);
    virtual.set(v, generate(items));
    loaders.push(`${JSON.stringify(group)}:()=>import(${JSON.stringify(v)})`);
  }
  return `const emptyUniforms=()=>({});export const programUniforms={${core.map(
    (m) => `${m[1]}:${m[2]}`
  )}};const loaders={${loaders}};const pending={};export async function prepareUniforms(groups){await Promise.all([...new Set(groups)].map(g=>!loaders[g]?undefined:pending[g]??=(loaders[g]().then(m=>Object.assign(programUniforms,m.default)).catch(e=>{delete pending[g];throw e;}))));}`;
}

export const completePlugin = {
  name: 'complete-modular-renderer',
  resolveId(id) {
    if (virtual.has(id)) return id;
  },
  load(id) {
    return virtual.get(id);
  },
  async transform(original, id) {
    if (!id.startsWith(src + '/') || virtual.has(id)) return;
    const rel = id.slice(src.length + 1);
    let code = (await basePlugin.transform(original, id))?.code ?? original;
    if (rel === 'util/config.ts')
      code = replace(code, '    REGISTERED_PROTOCOLS: {},', '    REGISTERED_PROTOCOLS: Object.create(null),');
    if (rel === 'source/protocol_crud.ts')
      code = replace(
        code,
        "    return config.REGISTERED_PROTOCOLS[url.substring(0, url.indexOf('://'))];",
        "    const protocol = url.substring(0, url.indexOf('://'));\n    return Object.hasOwn(config.REGISTERED_PROTOCOLS, protocol) ? config.REGISTERED_PROTOCOLS[protocol] : undefined;"
      );
    code = transformMetadata(code, rel) ?? code;
    code = transformSpriteKeys(code, rel) ?? code;
    if (rel === 'shaders/shaders.ts') code = await shaderTable(original, id);
    if (rel === 'webgl/program/program_uniforms.ts') code = uniformTable(original, id);
    if (rel === 'source/source.ts')
      code = code.replace(
        "if(!Object.hasOwn(loaders,t))throw new Error('Unknown feature '+t);",
        "if(!Object.hasOwn(loaders,t)){if(!Object.hasOwn(Object.prototype,t)&&getSourceType(t))return;throw new Error('Unknown feature '+t);}"
      );
    if (rel === 'geo/projection/projection_factory.ts') {
      const loaders = [];
      code = code.replace(
        /^import \{([^}]+)\} from '(\.\/(?:globe|vertical_perspective)[^']+)';$/gm,
        (line, name, p) => {
          loaders.push(`import(${JSON.stringify(p)}).then(m=>{${name}=m.${name};})`);
          return `let ${name};`;
        }
      );
      if (loaders.length !== 6) throw Error('Projection imports drift');
      code += `\nlet projectionReady;export async function prepareProjection(name){if(name==='mercator')return;return projectionReady??=(Promise.all([${loaders}]).catch(e=>{projectionReady=undefined;throw e;}));}`;
    }
    if (rel === 'ui/map.ts') {
      code = `import {prepareReplacement,prepareMapFeatures,beginPreparation} from ${JSON.stringify(
        prepareId
      )};\n${code}`;
      code = replace(
        code,
        'setStyle(style: StyleSpecification | string | null, options?: StyleSwapOptions & StyleOptions): this {',
        'setStyle(style: StyleSpecification | string | null, options?: StyleSwapOptions & StyleOptions): this {\n        this._modularReplacement?.abort();this._modularReplacement=undefined;'
      );
      code = replace(
        code,
        '_updateStyle(style: StyleSpecification | string | null, options?: StyleSwapOptions & StyleOptions): this {',
        `prepareFeatures(requirements,options={}) {return prepareMapFeatures(this,requirements,options);}
    _updateStyle(style: StyleSpecification | string | null, options?: StyleSwapOptions & StyleOptions): this {
        if(!style||!this.style?._loaded)return this._commitStyle(style,options);
        this._diffStyleRequest?.abort();this._diffStyleRequest=null;
        const target=this.style;const controller=beginPreparation(target);this._modularReplacement=controller;
        void (async()=>{try{
            let json=style;
            if(typeof style==='string'){const request=await this._requestManager.transformRequest(style,ResourceType.Style);controller.signal.throwIfAborted();json=(await getJSON(request,controller)).data;}
            const state=await prepareReplacement(target,json,options??{},controller);controller.signal.throwIfAborted();
            if(!state||this.style!==target||this._removed)return;
            this._commitStyle(state,{...options,transformStyle:undefined,modularPrepared:true});
        }catch(error){if(!isAbortError(error))this.fire(new ErrorEvent(ensureError(error)));}})();return this;
    }
    _commitStyle(style: StyleSpecification | string | null, options?: StyleSwapOptions & StyleOptions): this {`
      );
      code = replace(code, 'remove(): void {', 'remove(): void {\n        this._modularReplacement?.abort();');

      code = replace(
        code,
        "import {Terrain} from '../render/terrain.ts';",
        `import {runtimeFeatures} from ${JSON.stringify(runtimeId)};`
      );
      code = replace(code, "import {RenderToTexture} from '../webgl/render_to_texture.ts';", '');
      code = replace(code, 'new Terrain(', 'new runtimeFeatures.Terrain(');
      code = replace(code, 'new RenderToTexture(', 'new runtimeFeatures.RenderToTexture(');
      code = replace(
        code,
        'this.style.placement.symbolFadeChange(now())',
        'this.style.placement?.symbolFadeChange(now()) ?? 1'
      );
      code = replace(code, 'this.style.placement.variableOffsets', 'this.style.placement?.variableOffsets ?? {}');
      code = replace(
        code,
        '_updateDiff(style: StyleSpecification, options?: StyleSwapOptions & StyleOptions): void {',
        'async _updateDiff(style: StyleSpecification, options?: StyleSwapOptions & StyleOptions): Promise<void> { const targetStyle=this.style;\n        if(options?.transformStyle){const transform=options.transformStyle;let called=false,result;options={...options,transformStyle:(previous,next)=>{if(!called){result=transform(previous,next);called=true;}return result;}};}'
      );
      code = replace(
        code,
        'if (this.style.setState(style, options)) {',
        'if (await targetStyle.setState(style, options)) {'
      );
      code = replace(
        code,
        '        } catch (e) {\n            warnOnce(\n                `Unable to perform style diff:',
        '        } catch (e) {\n            if(isAbortError(e)||this.style!==targetStyle)return;\n            if(e?.modularPreparationFailure){this.fire(new ErrorEvent(ensureError(e)));return;}\n            warnOnce(\n                `Unable to perform style diff:'
      );
    }
    if (rel === 'tile/tile.ts') {
      code = replace(
        code,
        "import {SymbolBucket} from '../data/bucket/symbol_bucket.ts';",
        `import {runtimeFeatures} from ${JSON.stringify(runtimeId)};`
      );
      code = replace(
        code,
        'bucket instanceof SymbolBucket',
        'runtimeFeatures.SymbolBucket && bucket instanceof runtimeFeatures.SymbolBucket',
        2
      );
    }
    if (rel === 'data/bucket/symbol_bucket.ts')
      code += `\nimport {runtimeFeatures} from ${JSON.stringify(runtimeId)};runtimeFeatures.SymbolBucket=SymbolBucket;`;
    if (rel === 'style/style.ts') {
      code = replace(
        code,
        "import {PauseablePlacement} from './pauseable_placement.ts';",
        `import {runtimeFeatures} from ${JSON.stringify(
          runtimeId
        )};import {beginPreparation,prepareTransaction,snapshotStyle} from ${JSON.stringify(prepareId)};`
      );
      code = replace(code, "import {CrossTileSymbolIndex} from '../symbol/cross_tile_symbol_index.ts';", '');
      code = replace(
        code,
        'this.crossTileSymbolIndex = new CrossTileSymbolIndex();',
        'this.crossTileSymbolIndex = undefined;'
      );
      code = replace(
        code,
        'new (this.crossTileSymbolIndex?.constructor || Object)()',
        'runtimeFeatures.CrossTileSymbolIndex ? new runtimeFeatures.CrossTileSymbolIndex() : undefined'
      );
      code = replace(code, 'new PauseablePlacement(', 'new runtimeFeatures.PauseablePlacement(');
      code = replace(
        code,
        'let symbolBucketsChanged = false;',
        'if (!runtimeFeatures.PauseablePlacement) return false;\n        this.crossTileSymbolIndex ??= new runtimeFeatures.CrossTileSymbolIndex();\n        let symbolBucketsChanged = false;'
      );
      code = replace(
        code,
        '_load(json: StyleSpecification, options: StyleSwapOptions & StyleSetterOptions, previousStyle?: StyleSpecification): void {',
        'async _load(json: StyleSpecification, options: StyleSwapOptions & StyleSetterOptions, previousStyle?: StyleSpecification): Promise<void> {'
      );
      code = replace(
        code,
        'let nextState = options.transformStyle ? options.transformStyle(previousStyle, json) : json;',
        'const preparation=beginPreparation(this);\n        const generation=this._modularGeneration=(this._modularGeneration??0)+1;\n        let nextState = snapshotStyle(options.transformStyle ? options.transformStyle(previousStyle, json) : json);\n        if(options.validate && validateStyleAndEmit(this,nextState))return;\n        if(!options.modularPrepared)await prepareTransaction(this,nextState,preparation);\n        if(generation!==this._modularGeneration||this.map.style!==this)return;'
      );
      code = replace(
        code,
        '        if (options.validate && validateStyleAndEmit(this, nextState)) {\n            return;\n        }',
        ''
      );
      code = replace(
        code,
        'if (error && !abortController.signal.aborted) {',
        'if (error && !abortController.signal.aborted && !isAbortError(error)) {'
      );
      code = replace(
        code,
        'this._load(response.data, options, previousStyle);',
        'await this._load(response.data, options, previousStyle);'
      );
      code = replace(
        code,
        'this._load(json, options, previousStyle);',
        'return this._load(json, options, previousStyle);'
      );
      code = replace(
        code,
        '}).catch(() => {}); // ignore abort',
        '}).catch(error => { if (!isAbortError(error)) this.fire(new ErrorEvent(ensureError(error))); }); // report non-abort preparation failures'
      );
      code = `import {isAbortError} from '../util/abort_error.ts';\n${code}`;
      code = replace(
        code,
        'this._load(empty, {validate: false});',
        'this._modularReady=this._load(empty, {validate: false});void this._modularReady.catch(error=>{if(!isAbortError(error))this.fire(new ErrorEvent(ensureError(error)));});'
      );
      code = replace(
        code,
        'setState(nextState: StyleSpecification, options: StyleSwapOptions & StyleSetterOptions = {}): boolean {',
        'async setState(nextState: StyleSpecification, options: StyleSwapOptions & StyleSetterOptions = {}): Promise<boolean> {'
      );
      code = replace(
        code,
        'nextState = options.transformStyle ? options.transformStyle(serializedStyle, nextState) : nextState;',
        'nextState = options.transformStyle ? options.transformStyle(serializedStyle, nextState) : nextState;\n        if((options.validate??true) && validateStyleAndEmit(this,nextState))return false;\n        nextState=snapshotStyle(nextState);\n        const preparation=beginPreparation(this);\n        const generation=this._modularGeneration=(this._modularGeneration??0)+1;\n        await prepareTransaction(this,nextState,preparation);\n        if(generation!==this._modularGeneration||this.map.style!==this)return false;'
      );
      code = replace(code, 'nextState = clone(nextState);', 'nextState = snapshotStyle(nextState);');
      code = replace(
        code,
        'const changes = diffStyles(serializedStyle, nextState);',
        'const changes = diffStyles(this.serialize(), nextState);'
      );
      code = replace(
        code,
        '        const validate = options.validate ?? true;\n        if (validate && validateStyleAndEmit(this, nextState)) return false;',
        ''
      );
      code = replace(
        code,
        '_remove(mapRemoved: boolean = true): void {',
        '_remove(mapRemoved: boolean = true): void {\n        this._modularGeneration=(this._modularGeneration??0)+1;this._modularPreparation?.abort();for(const controller of this._modularFeaturePreparations??[])controller.abort();'
      );
    }
    if (
      [
        'source/worker.ts',
        'util/actor_messages.ts',
        'render/subdivision.ts',
        'render/subdivision_granularity_settings.ts'
      ].includes(rel)
    )
      code = transformWorker(original, rel) ?? original;
    if (code !== original) {
      changed.set(rel, { original: Buffer.byteLength(original), transformed: Buffer.byteLength(code) });
      return { code };
    }
  }
};

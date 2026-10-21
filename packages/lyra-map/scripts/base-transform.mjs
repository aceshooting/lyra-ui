import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const base = dirname(fileURLToPath(import.meta.resolve('maplibre-gl/package.json')));
const src = resolve(base, 'src');
const layerClass = {
  CircleStyleLayer: 'circle',
  HeatmapStyleLayer: 'heatmap',
  HillshadeStyleLayer: 'hillshade',
  ColorReliefStyleLayer: 'color-relief',
  FillStyleLayer: 'fill',
  FillExtrusionStyleLayer: 'fill-extrusion',
  LineStyleLayer: 'line',
  SymbolStyleLayer: 'symbol',
  BackgroundStyleLayer: 'background',
  RasterStyleLayer: 'raster',
  CustomStyleLayer: 'custom'
};
const sourceClass = {
  VectorTileSource: 'vector',
  RasterTileSource: 'raster',
  RasterDEMTileSource: 'raster-dem',
  GeoJSONSource: 'geojson',
  VideoSource: 'video',
  ImageSource: 'image',
  CanvasSource: 'canvas'
};
function registry(code, classes, prepare) {
  const loaders = [];
  code = code.replace(/^import \{([^}]+)\} from '([^']+)';$/gm, (line, names, path) => {
    const name = names.split(',')[0].trim();
    if (!classes[name]) return line;
    loaders.push(`${JSON.stringify(classes[name])}:()=>import(${JSON.stringify(path)}).then(m=>{${name}=m.${name}})`);
    return `let ${name};`;
  });
  return `${code}\nconst loaders={${loaders}};const pending=Object.create(null);export async function ${prepare}(types){if('${prepare}'==='prepareStyleLayers')types=types.map(layer=>typeof layer==='string'?layer:layer.type);await Promise.all([...new Set(types)].map(t=>{if(!Object.hasOwn(loaders,t))throw new Error('Unknown feature '+t);return pending[t]??=(loaders[t]().catch(e=>{delete pending[t];throw e;}));}));}\n`;
}
export const basePlugin = {
  name: 'map-feature-registry',
  async transform(code, id) {
    if (!id.startsWith(src)) return;
    const relative = id.slice(src.length + 1);
    const original = code;
    if (relative === 'style/create_style_layer.ts') code = registry(code, layerClass, 'prepareStyleLayers');
    if (relative === 'source/source.ts') code = registry(code, sourceClass, 'prepareSources');
    // Predicates are simple type discriminants in upstream; retaining their class module defeats the boundary.
    code = code.replace(/^import \{(is\w+StyleLayer)\} from '[^']+style_layer\/[^']+';$/gm, (line, name) => {
      const cls = name.slice(2);
      const type = layerClass[cls];
      return type ? `const ${name}=(layer)=>layer.type===${JSON.stringify(type)};` : line;
    });
    if (relative === 'webgl/draw/index.ts') {
      const imports = [...code.matchAll(/^import \{([^}]+)\} from '([^']+)';$/gm)];
      const defs = imports.flatMap((m) => m[1].split(',').map((s) => ({ name: s.trim(), path: m[2] })));
      const mapping = {
        symbol: 'drawSymbols',
        circle: 'drawCircles',
        heatmap: 'drawHeatmap',
        line: 'drawLine',
        fill: 'drawFill',
        'fill-extrusion': 'drawFillExtrusion',
        hillshade: 'drawHillshade',
        'color-relief': 'drawColorRelief',
        raster: 'drawRaster',
        background: 'drawBackground',
        custom: 'drawCustom'
      };
      const keys = {
        drawSymbols: 'symbol',
        drawCircles: 'circle',
        drawHeatmap: 'heatmap',
        drawLine: 'line',
        drawFill: 'fill',
        drawFillExtrusion: 'fillExtrusion',
        drawHillshade: 'hillshade',
        drawColorRelief: 'colorRelief',
        drawRaster: 'raster',
        drawBackground: 'background',
        drawCustom: 'custom',
        drawDebug: 'debug',
        drawDebugPadding: 'debugPadding',
        drawDepth: 'terrainDepth',
        drawSky: 'sky',
        drawAtmosphere: 'atmosphere'
      };
      const groups = Object.groupBy(defs, (x) => x.path);
      const loaders = [];
      for (const [path, items] of Object.entries(groups))
        loaders.push(
          `${JSON.stringify(path)}:()=>import(${JSON.stringify(path)}).then(m=>{${items
            .map(
              (x) => `${x.name}=m.${x.name};${keys[x.name] ? `webglDrawFunctions.${keys[x.name]}=m.${x.name};` : ''}`
            )
            .join('')}})`
        );
      const paths = Object.fromEntries(
        Object.entries(mapping).map(([type, name]) => [type, defs.find((x) => x.name === name).path])
      );
      code = `export let ${defs
        .map((x) => x.name)
        .join(',')};export const webglDrawFunctions={};const paths=${JSON.stringify(
        paths
      )};const loaders={${loaders}};const pending={};export async function prepareDraws(types){const list=['./draw_debug.ts','./draw_terrain.ts','./draw_sky.ts',...types.map(t=>paths[t]).filter(Boolean)];await Promise.all([...new Set(list)].map(p=>pending[p]??=loaders[p]().catch(e=>{delete pending[p];throw e;})));}`;
    }
    if (code !== original) {
      return { code };
    }
  }
};

/** Adds metadata validation to the pinned resource loaders before their results reach rendering. */
const tileValidation = `
function _lyraMetadataObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function _lyraValidateTileMetadata(value, type, layers) {
    const fail = field => { throw new Error('Invalid TileJSON ' + field); };
    if (!Array.isArray(value.tiles) || value.tiles.length === 0 ||
        Array.from(value.tiles).some(url => typeof url !== 'string' || !url.trim())) fail('tiles');
    for (const field of ['minzoom', 'maxzoom', 'tileSize']) {
        if (value[field] !== undefined && (typeof value[field] !== 'number' || !Number.isFinite(value[field]))) fail(field);
    }
    if (value.tileSize !== undefined && (value.tileSize <= 0 || (type === 'vector' && value.tileSize !== 512))) fail('tileSize');
    if ((value.minzoom ?? 0) > (value.maxzoom ?? 22)) fail('zoom range');
    if (value.scheme !== undefined && !['xyz', 'tms'].includes(value.scheme)) fail('scheme');
    if (value.encoding !== undefined) {
        const encodings = type === 'vector' ? ['mvt', 'mlt'] : type === 'raster-dem' ? ['mapbox', 'terrarium', 'custom'] : undefined;
        if (encodings && !encodings.includes(value.encoding)) fail('encoding');
    }
    if (value.attribution !== undefined && typeof value.attribution !== 'string') fail('attribution');
    if (value.bounds !== undefined && (!Array.isArray(value.bounds) || value.bounds.length !== 4 ||
        Array.from(value.bounds).some(number => typeof number !== 'number' || !Number.isFinite(number)) || value.bounds[1] > value.bounds[3])) fail('bounds');
    if (layers !== undefined && (!Array.isArray(layers) || Array.from(layers).some(layer => !_lyraMetadataObject(layer) || typeof layer.id !== 'string'))) fail('vector_layers');
}
`;

const spriteValidation = `
function _lyraSpriteObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function _lyraValidateSpriteEntry(value, width, height, id) {
    const fail = field => { throw new Error('Invalid sprite metadata for ' + id + ': ' + field); };
    if (!_lyraSpriteObject(value)) fail('entry');
    for (const field of ['x', 'y', 'width', 'height']) {
        if (!Number.isSafeInteger(value[field]) || value[field] < (field === 'width' || field === 'height' ? 1 : 0)) fail(field);
    }
    if (value.width > width - value.x || value.height > height - value.y) fail('image bounds');
    if (value.pixelRatio !== undefined && (typeof value.pixelRatio !== 'number' || !Number.isFinite(value.pixelRatio) || value.pixelRatio <= 0)) fail('pixelRatio');
    if (value.sdf !== undefined && typeof value.sdf !== 'boolean') fail('sdf');
    for (const [field, size] of [['stretchX', value.width], ['stretchY', value.height]]) {
        const stretches = value[field];
        if (stretches === undefined) continue;
        if (!Array.isArray(stretches)) fail(field);
        let last = 0;
        for (const pair of stretches) {
            if (!Array.isArray(pair) || pair.length !== 2 || Array.from(pair).some(number => typeof number !== 'number' || !Number.isFinite(number)) ||
                pair[0] < last || pair[1] < pair[0] || pair[1] > size) fail(field);
            last = pair[1];
        }
    }
    if (value.content !== undefined) {
        const content = value.content;
        if (!Array.isArray(content) || content.length !== 4 || Array.from(content).some(number => typeof number !== 'number' || !Number.isFinite(number)) ||
            content[0] < 0 || content[1] < 0 || content[2] < content[0] || content[3] < content[1] ||
            content[2] > value.width || content[3] > value.height) fail('content');
    }
    for (const field of ['textFitWidth', 'textFitHeight']) {
        if (value[field] !== undefined && !['stretchOrShrink', 'stretchOnly', 'proportional'].includes(value[field])) fail(field);
    }
}
`;

/** Exact anchors fail closed if a pinned loader changes. */
export function transformMetadata(code, relativePath) {
  if (!['source/load_tilejson.ts', 'style/load_sprite.ts'].includes(relativePath)) return undefined;
  const replace = (before, after) => {
    if (code.split(before).length !== 2) throw new Error('Metadata transform anchor changed in ' + relativePath);
    code = code.replace(before, after);
  };
  if (relativePath === 'source/load_tilejson.ts') {
    replace(
      '        tileJSON = response.data;',
      "        tileJSON = response.data;\n        if (!_lyraMetadataObject(tileJSON)) throw new Error('Invalid TileJSON object');"
    );
    replace(
      "    if ('vector_layers' in tileJSON && tileJSON.vector_layers) {",
      "    _lyraValidateTileMetadata(result, options.type, tileJSON.vector_layers);\n    if ('vector_layers' in tileJSON && tileJSON.vector_layers) {"
    );
    return code + tileValidation;
  }
  replace(
    '        const json = (await jsonsMap[spriteName]).data;',
    "        const json = (await jsonsMap[spriteName]).data;\n        if (!_lyraSpriteObject(json)) throw new Error('Invalid sprite metadata object');\n        for (const id of Object.keys(json)) _lyraValidateSpriteEntry(json[id], context.canvas.width, context.canvas.height, id);"
  );
  replace(
    '        for (const id in json) {',
    '        for (const id of Object.keys(json)) {'
  );
  replace(
    'const {width, height, x, y, sdf, pixelRatio, stretchX, stretchY, content, textFitWidth, textFitHeight} = json[id];',
    'const {width, height, x, y, sdf = false, pixelRatio = 1, stretchX, stretchY, content, textFitWidth, textFitHeight} = json[id];'
  );
  return code + spriteValidation;
}

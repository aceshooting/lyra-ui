/** Keeps sprite and image registry names independent of Object.prototype members. */
export function transformSpriteKeys(code, relativePath) {
  if (!['style/load_sprite.ts', 'render/image_manager.ts', 'source/worker_tile.ts', 'render/image_atlas.ts', 'util/web_worker_transfer.ts', 'style/style.ts'].includes(relativePath)) return undefined;
  const replace = (before, after, count = 1) => {
    if (code.split(before).length - 1 !== count) throw new Error('Sprite key transform anchor changed in ' + relativePath);
    code = code.split(before).join(after);
  };
  if (relativePath === 'style/load_sprite.ts') {
    replace('const jsonsMap: {[id: string]: Promise<GetResourceResponse<SpriteJSON>>} = {};',
      'const jsonsMap: {[id: string]: Promise<GetResourceResponse<SpriteJSON>>} = Object.create(null);');
    replace('const imagesMap: {[id: string]: Promise<GetResourceResponse<HTMLImageElement | ImageBitmap>>} = {};',
      'const imagesMap: {[id: string]: Promise<GetResourceResponse<HTMLImageElement | ImageBitmap>>} = Object.create(null);');
    replace('const result = {} as {[spriteName: string]: {[id: string]: StyleImage}};',
      'const result = Object.create(null) as {[spriteName: string]: {[id: string]: StyleImage}};');
    replace('        result[spriteName] = {};', '        result[spriteName] = Object.create(null);');
    return code;
  }
  if (relativePath === 'style/style.ts') {
    replace('this._changedImages = {};', 'this._changedImages = Object.create(null);', 3);
    return code;
  }
  if (relativePath === 'source/worker_tile.ts') {
    replace('            iconDependencies: {},', '            iconDependencies: Object.create(null),');
    replace('            patternDependencies: {},', '            patternDependencies: Object.create(null),');
    return code;
  }
  if (relativePath === 'render/image_atlas.ts') {
    replace('const iconPositions = {}, patternPositions = {};', 'const iconPositions = Object.create(null), patternPositions = Object.create(null);');
    replace('for (const id in icons) {', 'for (const id of Object.keys(icons)) {');
    replace('for (const id in patterns) {', 'for (const id of Object.keys(patterns)) {');
    replace('for (const id in images) {', 'for (const id of Object.keys(images)) {');
    return code;
  }
  if (relativePath === 'util/web_worker_transfer.ts') {
    replace('    const klass = (input.constructor as any);', '    const prototype = Object.getPrototypeOf(input);\n    const klass = prototype === null ? Object : prototype.constructor;');
    replace('            if (!input.hasOwnProperty(key)) continue;', '            if (!Object.hasOwn(input, key)) continue;');
    replace(
      '            properties[key] = registry[classRegistryKey].shallow.includes(key) ?\n                property :\n                serialize(property, transferables);',
      '            Object.defineProperty(properties, key, {\n                value: registry[classRegistryKey].shallow.includes(key) ? property : serialize(property, transferables),\n                enumerable: true, writable: true, configurable: true\n            });'
    );
    replace(
      '        result[key] = registry[classRegistryKey].shallow.includes(key) ? value : deserialize(value);',
      '        Object.defineProperty(result, key, {\n            value: registry[classRegistryKey].shallow.includes(key) ? value : deserialize(value),\n            enumerable: true, writable: true, configurable: true\n        });'
    );
    return code;
  }
  replace('this.images = {};', 'this.images = Object.create(null);');
  replace('this._spriteImagesIds = {};', 'this._spriteImagesIds = Object.create(null);', 3);
  replace('this._renderCallbacksDispatchedThisFrame = {};', 'this._renderCallbacksDispatchedThisFrame = Object.create(null);', 2);
  replace('const image = this.images[id];', 'const image = Object.hasOwn(this.images, id) ? this.images[id] : undefined;', 3);
  replace('if (this.images[id]) throw', 'if (Object.hasOwn(this.images, id)) throw');
  replace('const oldImage = this.images[id];', 'const oldImage = Object.hasOwn(this.images, id) ? this.images[id] : undefined;');
  replace('this._spriteImagesIds[spriteId] ?? []', '(Object.hasOwn(this._spriteImagesIds, spriteId) ? this._spriteImagesIds[spriteId] : undefined) ?? []', 2);
  replace('for (const id in images) {', 'for (const id of Object.keys(images)) {');
  replace('if (imageId in this.images) {', 'if (Object.hasOwn(this.images, imageId)) {');
  replace('if (!this.images[id]) {', 'if (!Object.hasOwn(this.images, id)) {');
  replace('if (this._renderCallbacksDispatchedThisFrame[id]) continue;', 'if (Object.hasOwn(this._renderCallbacksDispatchedThisFrame, id)) continue;');
  replace('const response: GetImagesResponse = {};', 'const response: GetImagesResponse = Object.create(null);');
  replace('const clonedImages: Record<string, StyleImage> = {};', 'const clonedImages: Record<string, StyleImage> = Object.create(null);');
  replace('for (const id in this.images) {', 'for (const id of Object.keys(this.images)) {');
  return code;
}

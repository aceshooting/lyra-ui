import { type Object3D } from 'three';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import type { ModelParserContext } from '../model-parser-common.js';

export function parse({ input, manager }: ModelParserContext): Object3D {
  return new PCDLoader(manager).parse(input.bytes.buffer);
}

import { type Object3D } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { ModelParserContext } from '../model-parser-common.js';

export function parse({ input, manager }: ModelParserContext): Object3D {
  return new OBJLoader(manager).parse(new TextDecoder().decode(input.bytes));
}

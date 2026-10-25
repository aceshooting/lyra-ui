import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { ModelParserContext } from '../model-parser-common.js';

export function parse({ input, manager }: ModelParserContext): Object3D {
  const geometry = new STLLoader(manager).parse(input.bytes.buffer);
  return new Mesh(geometry, new MeshStandardMaterial({ vertexColors: geometry.hasAttribute('color'), flatShading: !geometry.hasAttribute('normal') }));
}

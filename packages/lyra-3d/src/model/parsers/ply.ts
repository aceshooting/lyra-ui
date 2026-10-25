import { Mesh, MeshStandardMaterial, Points, PointsMaterial, type Object3D } from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import type { ModelParserContext } from '../model-parser-common.js';

export function parse({ input, manager }: ModelParserContext): Object3D {
  const geometry = new PLYLoader(manager).parse(input.bytes.buffer); const hasColors = geometry.hasAttribute('color');
  return !geometry.index ? new Points(geometry, new PointsMaterial({ vertexColors: hasColors })) : new Mesh(geometry, new MeshStandardMaterial({ vertexColors: hasColors, flatShading: !geometry.hasAttribute('normal') }));
}

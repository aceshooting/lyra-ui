import { BufferAttribute, BufferGeometry, Color, Points, PointsMaterial, SRGBColorSpace } from 'three';
import { requireValid, type ModelParserContext } from '../model-parser-common.js';

export function parse({ input, admission }: ModelParserContext): Points {
  const vertices = admission.vertices;
  const positions = new Float32Array(vertices * 3);
  let colors: Float32Array | undefined; let color: Color | undefined; let offset = 0;
  const text = new TextDecoder().decode(input.bytes);
  for (let start = 0; start < text.length;) {
    const found = text.indexOf('\n', start); const end = found < 0 ? text.length : found;
    const line = text.slice(start, end).trim(); start = end + 1;
    if (!line || line.startsWith('#')) continue;
    const row = line.split(/\s+/).map(Number);
    requireValid(offset + 3 <= positions.length);
    positions[offset] = row[0]!; positions[offset + 1] = row[1]!; positions[offset + 2] = row[2]!;
    if (row.length === 6) {
      if (!colors) { colors = new Float32Array(positions.length); colors.fill(1, 0, offset); }
      color ??= new Color(); color.setRGB(row[3]! / 255, row[4]! / 255, row[5]! / 255, SRGBColorSpace);
      colors[offset] = color.r; colors[offset + 1] = color.g; colors[offset + 2] = color.b;
    } else if (colors) { colors[offset] = 1; colors[offset + 1] = 1; colors[offset + 2] = 1; }
    offset += 3;
  }
  requireValid(offset === positions.length);
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(positions, 3));
  if (colors) geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return new Points(geometry, new PointsMaterial({ vertexColors: colors !== undefined }));
}

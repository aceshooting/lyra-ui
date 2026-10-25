import { readGltfPolicy } from './model-gltf-policy.js';
import { ModelAdmissionError } from './model-admission-error.js';
import { MODEL_LIMITS as LIMIT } from './limits.js';
import { modelAdmissionCheck as check, modelAdmissionInteger as integer, modelAdmissionNumber as number, modelAdmissionNumeric as numeric, chargeModelBytes as charge, chargeModelGeometry as geometry, type ModelResourceBudget as Budget } from './model-admission-policy.js';
import type { AdmittedFormatPlan, ModelScalarPlan, OwnedModelInput } from './model-prepared-types.js';
import { decodeModelText, ModelLineCursor } from './model-text-work.js';
import type { ModelWorkGenerator } from './model-work-generator.js';
function fail(code: 'invalid' | 'limit' | 'unsupported' | 'external-resource' = 'invalid'): never { throw new ModelAdmissionError(code); }
function text(bytes: Uint8Array): string { try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return fail(); } }
function tokens(line: string): string[] { return line.split(/\s+/); }
function numericInteger(value: string | undefined, max = Number.MAX_SAFE_INTEGER, min = 0): number {
  check(value !== undefined && /^[+-]?\d+$/.test(value)); return integer(Number(value), max, min);
}
function* obj(bytes: Uint8Array, budget: Budget): ModelWorkGenerator<AdmittedFormatPlan> {
  let vertices = 0; let normals = 0; let uvs = 0; let output = 0; let entries = 0;
  const cursor = new ModelLineCursor(yield* decodeModelText(bytes), LIMIT.lineBytes, LIMIT.indices + LIMIT.vertices);
  yield* cursor.forEach(line => {
    check(!line.includes('\\'), 'unsupported');
    if (!line || line.startsWith('#')) return;
    check(!line.includes('#'), 'unsupported');
    const [directive, ...values] = tokens(line);
    if (directive === 'mtllib' || directive === 'usemtl') fail('external-resource');
    if (directive === 'v' || directive === 'vn' || directive === 'vt') {
      check(values.length === (directive === 'vt' ? 2 : 3) || (directive === 'v' && values.length === 6), 'unsupported');
      values.forEach(numeric);
      if (directive === 'v') vertices++;
      else if (directive === 'vn') normals++;
      else uvs++;
      check(vertices <= LIMIT.vertices && normals <= LIMIT.vertices && uvs <= LIMIT.vertices, 'limit');
    } else if (directive === 'f' || directive === 'l' || directive === 'p') {
      // The point and line loader splits references on literal spaces.
      if (directive !== 'f') check(tokens(line).join(' ') === line, 'unsupported');
      const minimum = directive === 'f' ? 3 : directive === 'l' ? 2 : 1;
      integer(values.length, LIMIT.polygonVertices, minimum);
      for (const value of values) {
        const parts = value.split('/'); check(parts.length <= (directive === 'p' ? 1 : directive === 'l' ? 2 : 3));
        check(parts[0] !== '');
        for (let i = 0; i < parts.length; i++) {
          if (i === 1 && parts[i] === '' && parts.length === 3) continue;
          const limit = [vertices, uvs, normals][i]!;
          const index = numericInteger(parts[i], Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER);
          check(index !== 0 && (index > 0 ? index <= limit : -index <= limit));
        }
      }
      output += directive === 'f' ? (values.length - 2) * 3 : directive === 'l' ? (values.length - 1) * 2 : values.length;
      check(output <= LIMIT.vertices, 'limit');
    } else if (directive === 'o' || directive === 'g' || directive === 's') {
      check(++entries <= LIMIT.entries, 'limit');
      if (directive === 's') check(values.length === 1 && (values[0] === 'off' || values[0] === 'on' || /^\d+$/.test(values[0]!)));
    } else fail('unsupported');
  });
  charge(budget, vertices * 6 * 8 + normals * 3 * 8 + uvs * 2 * 8);
  geometry(budget, output || vertices, 0);
  return { format: 'obj', vertices, normals, uvs, outputVertices: output || vertices, entries };
}
function* stl(bytes: Uint8Array, budget: Budget): ModelWorkGenerator<AdmittedFormatPlan> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 84) {
    const faces = view.getUint32(80, true);
    if (84 + faces * 50 === bytes.length) {
      integer(faces * 3, LIMIT.vertices);
      let offset = 84; let scalar = 0;
      if (faces) yield { unit: 'scalars', run(limit) {
        let used = 0;
        while (used < limit && offset < bytes.length) {
          number(view.getFloat32(offset + scalar * 4, true)); used++;
          if (++scalar === 12) { scalar = 0; offset += 50; }
        }
        return { used, done: offset === bytes.length };
      } };
      geometry(budget, faces * 3, 0); return { format: 'stl', variant: 'binary', facets: faces, dataOffset: 84 };
    }
  }
  let state = 0; let vertices = 0; let solids = 0;
  const solidName = (row: string[]): void => {
    const name = row.slice(1).join(' ');
    check(name.length <= 1024 && !/(solid|facet|vertex|normal|outer|loop)/i.test(name), 'unsupported');
  };
  const cursor = new ModelLineCursor(yield* decodeModelText(bytes), LIMIT.lineBytes, LIMIT.indices + LIMIT.vertices);
  yield* cursor.forEach(line => {
    if (!line) return;
    const row = tokens(line);
    if (state === 0) { check(row[0] === 'solid'); solidName(row); check(++solids <= LIMIT.entries, 'limit'); state = 1; }
    else if (state === 1) {
      if (row[0] === 'endsolid') { solidName(row); state = 0; return; }
      check(row.length === 5 && row[0] === 'facet' && row[1] === 'normal'); row.slice(2).forEach(numeric); state = 2;
    } else if (state === 2) { check(line === 'outer loop'); state = 3; }
    else if (state >= 3 && state <= 5) {
      check(row.length === 4 && row[0] === 'vertex'); row.slice(1).forEach(numeric);
      check(++vertices <= LIMIT.vertices, 'limit'); state++;
    } else if (state === 6) { check(line === 'endloop'); state = 7; }
    else { check(line === 'endfacet'); state = 1; }
  });
  check(state === 0 && solids > 0); geometry(budget, vertices, 0);
  return { format: 'stl', variant: 'ascii', facets: vertices / 3, dataOffset: 0 };
}
function* header(bytes: Uint8Array, end: (line: string) => boolean, canonicalPly = false): ModelWorkGenerator<{ lines: string[]; offset: number }> {
  const result: string[] = []; let start = 0;
  const crlf = bytes[3] === 13 && bytes[4] === 10;
  if (canonicalPly) check(bytes[0] === 112 && bytes[1] === 108 && bytes[2] === 121 && (bytes[3] === 10 || crlf), 'unsupported');
  let offset = 0; let ended = false;
  if (bytes.length) yield { unit: 'bytes', run(limit) {
    let used = 0;
    while (used < limit && offset < bytes.length && offset < LIMIT.headerBytes) {
      const i = offset++; used++;
      check(bytes[i]! < 128 && bytes[i] !== 0);
      if (canonicalPly && bytes[i] === 13) check(crlf && bytes[i + 1] === 10, 'unsupported');
      if (bytes[i] !== 10) continue;
      if (canonicalPly) check((bytes[i - 1] === 13) === crlf, 'unsupported');
      check(i - start <= LIMIT.lineBytes, 'limit');
      const raw = text(bytes.subarray(start, canonicalPly && crlf ? i - 1 : i));
      const line = raw.trim(); start = i + 1;
      // The loader uses the magic line to choose its byte offset and an exact terminator.
      if (canonicalPly && (result.length === 0 || end(line))) check(raw === line, 'unsupported');
      // ASCII body extraction also searches for this marker without a line anchor.
      if (canonicalPly && !end(line)) check(!line.includes('end_header'), 'unsupported');
      result.push(line); check(result.length <= LIMIT.entries, 'limit');
      if (end(line)) { ended = true; break; }
    }
    return { used, done: ended || offset === bytes.length || offset === LIMIT.headerBytes };
  } };
  if (ended) return { lines: result, offset: start };
  return fail(bytes.length >= LIMIT.headerBytes ? 'limit' : 'invalid');
}
interface Scalar { size: number; float: boolean; signed: boolean }
const plyScalars: Record<string, Scalar> = {
  char: { size: 1, float: false, signed: true }, int8: { size: 1, float: false, signed: true },
  uchar: { size: 1, float: false, signed: false }, uint8: { size: 1, float: false, signed: false },
  short: { size: 2, float: false, signed: true }, int16: { size: 2, float: false, signed: true },
  ushort: { size: 2, float: false, signed: false }, uint16: { size: 2, float: false, signed: false },
  int: { size: 4, float: false, signed: true }, int32: { size: 4, float: false, signed: true },
  uint: { size: 4, float: false, signed: false }, uint32: { size: 4, float: false, signed: false },
  float: { size: 4, float: true, signed: true }, float32: { size: 4, float: true, signed: true },
  double: { size: 8, float: true, signed: true }, float64: { size: 8, float: true, signed: true },
};
function scalarType(type: string | undefined): Scalar { check(type !== undefined && Object.hasOwn(plyScalars, type), 'unsupported'); return plyScalars[type]!; }
function scalarValue(value: number, type: Scalar): number {
  number(value);
  if (!type.float) integer(value, 2 ** (type.size * 8 - (type.signed ? 1 : 0)) - 1, type.signed ? -(2 ** (type.size * 8 - 1)) : 0);
  return value;
}
function asciiScalar(value: string | undefined, type: Scalar): number {
  return scalarValue(type.float ? numeric(value) : numericInteger(value, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER), type);
}
function binaryScalar(view: DataView, offset: number, type: Scalar, little: boolean): number {
  check(offset + type.size <= view.byteLength);
  return scalarValue(type.float ? type.size === 8 ? view.getFloat64(offset, little) : view.getFloat32(offset, little) : type.size === 1 ? type.signed ? view.getInt8(offset) : view.getUint8(offset) : type.size === 2 ? type.signed ? view.getInt16(offset, little) : view.getUint16(offset, little) : type.signed ? view.getInt32(offset, little) : view.getUint32(offset, little), type);
}
function* ply(bytes: Uint8Array, budget: Budget): ModelWorkGenerator<AdmittedFormatPlan> {
  const source = yield* header(bytes, (line) => line === 'end_header', true);
  check(source.lines[0] === 'ply'); const format = source.lines[1];
  check(format === 'format ascii 1.0' || format === 'format binary_little_endian 1.0' || format === 'format binary_big_endian 1.0', 'unsupported');
  const properties: { name: string; type: Scalar }[] = [];
  let vertexCount = -1; let faceCount = 0; let element = ''; let faceName = ''; let faceType: Scalar | undefined; let countType: Scalar | undefined;
  for (const line of source.lines.slice(2, -1)) {
    yield 'records';
    if (line.startsWith('comment ') || line === 'comment' || line.startsWith('obj_info ')) continue;
    const row = tokens(line);
    if (row[0] === 'element') {
      check(row.length === 3);
      if (row[1] === 'vertex') { check(vertexCount === -1 && !element); vertexCount = numericInteger(row[2], LIMIT.vertices); element = 'vertex'; }
      else if (row[1] === 'face') { check(vertexCount >= 0 && element === 'vertex'); faceCount = numericInteger(row[2], LIMIT.indices / 3); element = 'face'; }
      else fail('unsupported');
    } else if (row[0] === 'property') {
      if (element === 'vertex') {
        check(row.length === 3 && ['x', 'y', 'z', 'nx', 'ny', 'nz', 'red', 'green', 'blue', 'alpha', 's', 't', 'u', 'v'].includes(row[2]!), 'unsupported');
        check(!properties.some((property) => property.name === row[2]));
        const type = scalarType(row[1]);
        if (['red', 'green', 'blue', 'alpha'].includes(row[2]!)) check(type.size === 1 && !type.signed && !type.float, 'unsupported');
        properties.push({ name: row[2]!, type });
      } else {
        check(element === 'face' && !faceType && row.length === 5 && row[1] === 'list' && (row[4] === 'vertex_indices' || row[4] === 'vertex_index'), 'unsupported');
        faceName = row[4]!; countType = scalarType(row[2]); faceType = scalarType(row[3]); check(!countType.float && !faceType.float);
      }
    } else fail('unsupported');
  }
  check(vertexCount >= 0 && ['x', 'y', 'z'].every((name) => properties.some((property) => property.name === name)));
  check(element !== 'face' || (faceType && countType));
  let indices = 0;
  const addFace = (count: number, read: () => number): void => {
    integer(count, 4, 3); indices += (count - 2) * 3; check(indices <= LIMIT.indices, 'limit');
    for (let i = 0; i < count; i++) integer(read(), vertexCount - 1);
  };
  if (format === 'format ascii 1.0') {
    const cursor = new ModelLineCursor(yield* decodeModelText(bytes.subarray(source.offset)), LIMIT.lineBytes, LIMIT.indices + LIMIT.vertices); let rowIndex = 0;
    yield* cursor.forEach(line => {
      if (!line) return;
      const row = tokens(line);
      if (rowIndex < vertexCount) {
        check(row.length === properties.length); row.forEach((value, i) => asciiScalar(value, properties[i]!.type));
      } else {
        check(rowIndex < vertexCount + faceCount);
        const count = asciiScalar(row[0], countType!); check(row.length === count + 1);
        let index = 1; addFace(count, () => asciiScalar(row[index++], faceType!));
      }
      rowIndex++;
    });
    check(rowIndex === vertexCount + faceCount);
  } else {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let offset = source.offset;
    const little = format === 'format binary_little_endian 1.0';
    const read = (type: Scalar): number => { const value = binaryScalar(view, offset, type, little); offset += type.size; return value; };
    let vertex = 0; let property = 0;
    if (vertexCount) yield { unit: 'scalars', run(limit) {
      let used = 0;
      while (used < limit && vertex < vertexCount) {
        read(properties[property]!.type); used++;
        if (++property === properties.length) { property = 0; vertex++; }
      }
      return { used, done: vertex === vertexCount };
    } };
    let face = 0;
    if (faceCount) yield { unit: 'records', run(limit) {
      const count = Math.min(limit, faceCount - face);
      for (let index = 0; index < count; index++) { addFace(read(countType!), () => read(faceType!)); face++; }
      return { used: count, done: face === faceCount };
    } };
    check(offset === bytes.length);
  }
  charge(budget, vertexCount * properties.length * 8 + indices * 8);
  geometry(budget, vertexCount, indices);
  const elements: Extract<AdmittedFormatPlan, { format: 'ply' }>['elements'][number][] = [{ name: 'vertex', count: vertexCount, properties: properties.map(property => ({ name: property.name, kind: 'scalar', scalar: planScalar(property.type) })) }];
  if (element === 'face') elements.push({ name: 'face', count: faceCount, properties: [{ name: faceName, kind: 'list', count: planScalar(countType!), item: planScalar(faceType!) }] });
  return { format: 'ply', variant: format === 'format ascii 1.0' ? 'ascii' : format === 'format binary_little_endian 1.0' ? 'binary-le' : 'binary-be', dataOffset: source.offset, elements };
}
function* pcd(bytes: Uint8Array, budget: Budget): ModelWorkGenerator<AdmittedFormatPlan> {
  const source = yield* header(bytes, (line) => line.startsWith('DATA '));
  for (const line of text(bytes.subarray(0, source.offset)).split('\n')) {
    yield 'records';
    check(line === line.trim(), 'unsupported');
    if (line && !line.startsWith('#')) check(tokens(line).join(' ') === line, 'unsupported');
  }
  const values: Record<string, string[]> = {};
  for (const line of source.lines) {
    yield 'records';
    if (!line || line.startsWith('#')) continue;
    const [key, ...row] = tokens(line);
    check(key !== undefined && ['VERSION', 'FIELDS', 'SIZE', 'TYPE', 'COUNT', 'WIDTH', 'HEIGHT', 'VIEWPOINT', 'POINTS', 'DATA'].includes(key), 'unsupported');
    check(!Object.hasOwn(values, key)); values[key] = row;
  }
  check(values['VERSION']?.length === 1 && ['.7', '0.7'].includes(values['VERSION'][0]!));
  const names = values['FIELDS']; const sizes = values['SIZE']; const types = values['TYPE'];
  check(names && sizes && types && names.length <= 8 && sizes.length === names.length && types.length === names.length);
  check(['x', 'y', 'z'].every((name) => names.includes(name)) && new Set(names).size === names.length);
  const normalFields = ['normal_x', 'normal_y', 'normal_z'];
  check(!normalFields.some((name) => names.includes(name)) || normalFields.every((name) => names.includes(name)));
  const counts = values['COUNT'] ?? names.map(() => '1'); check(counts.length === names.length);
  const scalarTypes = names.map((name, i) => {
    check(['x', 'y', 'z', 'normal_x', 'normal_y', 'normal_z', 'rgb'].includes(name), 'unsupported');
    check(numericInteger(sizes[i]) === 4 && numericInteger(counts[i]) === 1, 'unsupported');
    check(types[i] === 'F' || (name === 'rgb' && types[i] === 'U'), 'unsupported');
    return { size: 4, signed: types[i] === 'F', float: types[i] === 'F' };
  });
  const oneInteger = (key: string, max: number): number => { check(values[key]?.length === 1); return numericInteger(values[key]![0], max); };
  const points = oneInteger('POINTS', LIMIT.vertices); const width = oneInteger('WIDTH', LIMIT.vertices); const height = oneInteger('HEIGHT', LIMIT.vertices);
  check(width * height === points && height > 0);
  if (values['VIEWPOINT']) { check(values['VIEWPOINT'].length === 7); values['VIEWPOINT'].forEach(numeric); }
  check(values['DATA']?.length === 1); const mode = values['DATA'][0]; check(mode === 'ascii' || mode === 'binary', 'unsupported');
  if (mode === 'ascii') {
    let count = 0;
    const cursor = new ModelLineCursor(yield* decodeModelText(bytes.subarray(source.offset)), LIMIT.lineBytes, LIMIT.indices + LIMIT.vertices);
    yield* cursor.forEach(line => {
      if (!line) return;
      const row = tokens(line); check(row.length === names.length && count < points);
      row.forEach((value, i) => scalarValue(numeric(value), scalarTypes[i]!)); count++;
    }, true);
    check(count === points);
  } else {
    check(bytes.length - source.offset === points * names.length * 4);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let offset = source.offset;
    let point = 0; let field = 0;
    if (points) yield { unit: 'scalars', run(limit) {
      let used = 0;
      while (used < limit && point < points) {
        // Packed RGB may have a NaN float representation; the parser consumes its raw integer bits.
        if (names[field] !== 'rgb') binaryScalar(view, offset, scalarTypes[field]!, true);
        offset += 4; used++;
        if (++field === names.length) { field = 0; point++; }
      }
      return { used, done: point === points };
    } };
  }
  charge(budget, points * names.length * 8); geometry(budget, points, 0);
  return { format: 'pcd', variant: mode, dataOffset: source.offset, fields: names.map((name, i) => ({ name, scalar: planScalar(scalarTypes[i]!) })), width, height, points, viewpoint: values['VIEWPOINT']?.map(Number) ?? null };
}


function planScalar(type: Scalar): ModelScalarPlan { return { bytes: type.size as 1 | 2 | 4 | 8, kind: type.float ? 'float' : type.signed ? 'signed' : 'unsigned' }; }
export function* readModelFormatPolicy(input: OwnedModelInput, budget: Budget): ModelWorkGenerator<AdmittedFormatPlan> {
  if (input.format === 'gltf' || input.format === 'glb') return yield* readGltfPolicy(input.bytes, input.format, budget);
  if (input.format === 'obj') return yield* obj(input.bytes, budget);
  if (input.format === 'stl') return yield* stl(input.bytes, budget);
  if (input.format === 'ply') return yield* ply(input.bytes, budget);
  if (input.format === 'pcd') return yield* pcd(input.bytes, budget);
  return fail('unsupported');
}

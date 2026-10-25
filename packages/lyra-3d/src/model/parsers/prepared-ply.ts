import { modelAdmissionCheck } from '../model-admission-policy.js';
import { ModelWorkMeter } from '../model-work.js';
import type { AdmittedModelInput, ModelAttributeDescriptor, ModelAttributeScalarKind, ModelDecoderServices, ModelDescriptor, ModelNumericArray, ModelPreparedDecoder, ModelScalarPlan } from '../model-prepared-types.js';

class PlyValues {
  private offset: number;
  private paid = 0;
  private text = '';
  private character = 0;
  private token = '';
  private ready = false;
  private ended = false;
  private readonly decoder = new TextDecoder();
  private view: DataView | undefined;
  constructor(private bytes: Uint8Array<ArrayBuffer>, offset: number, private readonly ascii: boolean, private readonly little: boolean) {
    this.offset = offset;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  next(type: ModelScalarPlan, meter: ModelWorkMeter): number | undefined {
    if (!this.ascii) {
      const charge = Math.min(type.bytes - this.paid, meter.remaining('bytes'));
      if (charge > 0) { meter.take('bytes', charge); this.paid += charge; }
      if (this.paid < type.bytes || !meter.take('scalars')) return undefined;
      const at = this.offset; const size = type.bytes;
      const value = type.kind === 'float' ? size === 8 ? this.view!.getFloat64(at, this.little) : this.view!.getFloat32(at, this.little)
        : size === 1 ? type.kind === 'signed' ? this.view!.getInt8(at) : this.view!.getUint8(at)
          : size === 2 ? type.kind === 'signed' ? this.view!.getInt16(at, this.little) : this.view!.getUint16(at, this.little)
            : type.kind === 'signed' ? this.view!.getInt32(at, this.little) : this.view!.getUint32(at, this.little);
      this.offset += size; this.paid = 0; return value;
    }
    for (;;) {
      if (this.ready) {
        if (!meter.take('scalars')) return undefined;
        const value = type.kind === 'float' ? parseFloat(this.token) : parseInt(this.token, 10);
        this.token = ''; this.ready = false; return value;
      }
      if (this.character < this.text.length) {
        if (!meter.take('scalars')) return undefined;
        const value = this.text.charAt(this.character++);
        if (/\s/.test(value)) { if (this.token) this.ready = true; }
        else this.token += value;
        continue;
      }
      if (this.ended) {
        modelAdmissionCheck(this.token.length > 0);
        this.ready = true; continue;
      }
      const count = Math.min(4096, meter.remaining('bytes'), this.bytes.length - this.offset);
      if (count > 0) {
        meter.take('bytes', count);
        this.text = this.decoder.decode(this.bytes.subarray(this.offset, this.offset + count), { stream: true });
        this.offset += count; this.character = 0;
      } else if (this.offset === this.bytes.length) {
        this.text = this.decoder.decode(); this.character = 0; this.ended = true;
      } else return undefined;
    }
  }
  dispose(): void { this.bytes = new Uint8Array(); this.view = undefined; this.text = ''; this.token = ''; }
}

function attributeKind(type: ModelScalarPlan): ModelAttributeScalarKind {
  if (type.kind === 'float') return type.bytes === 8 ? 'f64' : 'f32';
  if (type.kind === 'signed') return type.bytes === 1 ? 'i8' : type.bytes === 2 ? 'i16' : 'i32';
  return type.bytes === 1 ? 'u8' : type.bytes === 2 ? 'u16' : 'u32';
}
interface PlyOutput { readonly name: string; readonly fields: readonly string[]; readonly kind: ModelAttributeScalarKind; readonly size: 2 | 3; array?: ModelNumericArray }

export const createPreparedPly: ModelPreparedDecoder = (input: AdmittedModelInput, services: ModelDecoderServices) => {
  modelAdmissionCheck(input.input.format === 'ply' && input.plan.format === 'ply', 'unsupported');
  const plan = input.plan;
  let source: AdmittedModelInput | undefined = input;
  let reader: PlyValues | undefined;
  let phase: 'setup' | 'allocate' | 'vertices' | 'vertex-output' | 'faces' | 'face-output' | 'narrow' | 'finish' | 'done' | 'disposed' = 'setup';
  let outputs: PlyOutput[] = [];
  let attributes: Record<string, ModelAttributeDescriptor> = {};
  let indices: Uint8Array | Uint16Array | Uint32Array | null = null;
  let narrowed: Uint8Array | Uint16Array | Uint32Array | undefined;
  let vertexCount = 0; let faceCount = 0; let vertex = 0; let property = 0; let face = 0;
  let output = 0; let component = 0; let allocation = 0; let indexOffset = 0; let maximumIndex = 0; let narrowOffset = 0;
  let row: Record<string, number> = {};
  let faceValues: number[] = []; let faceLength = -1; let faceRead = 0; let faceWrite = 0;
  let vertexProperties: readonly { readonly name: string; readonly kind: 'scalar'; readonly scalar: ModelScalarPlan }[] = [];
  let countType: ModelScalarPlan | undefined; let indexType: ModelScalarPlan | undefined;
  const release = (): void => {
    reader?.dispose(); reader = undefined; source = undefined; outputs = []; attributes = {}; indices = null; narrowed = undefined;
    row = {}; faceValues = []; vertexProperties = [];
  };
  return {
    step(budget) {
      if (phase === 'done' || phase === 'disposed' || !source) throw new Error('Model decoder work is no longer active');
      const meter = new ModelWorkMeter(budget);
      for (;;) {
        if (phase === 'setup') {
          if (!meter.take('records')) break;
          const vertices = plan.elements.find(element => element.name === 'vertex');
          const faces = plan.elements.find(element => element.name === 'face');
          modelAdmissionCheck(vertices && vertices.properties.every(value => value.kind === 'scalar'));
          vertexProperties = vertices.properties as typeof vertexProperties; vertexCount = vertices.count; faceCount = faces?.count ?? 0;
          if (faces) {
            const list = faces.properties[0]; modelAdmissionCheck(list?.kind === 'list');
            countType = list.count; indexType = list.item;
          }
          const add = (name: string, fields: readonly string[], size: 2 | 3): void => {
            const first = vertexProperties.find(value => value.name === fields[0]);
            if (first && fields.every(field => vertexProperties.some(value => value.name === field)) && (name === 'position' || vertexCount > 0)) {
              outputs.push({ name, fields, kind: name === 'color' ? 'u8' : attributeKind(first.scalar), size });
            }
          };
          add('position', ['x', 'y', 'z'], 3); add('normal', ['nx', 'ny', 'nz'], 3);
          add('uv', [vertexProperties.some(value => value.name === 's') ? 's' : 'u', vertexProperties.some(value => value.name === 't') ? 't' : 'v'], 2);
          add('color', ['red', 'green', 'blue'], 3);
          reader = new PlyValues(source.input.bytes, plan.dataOffset, plan.variant === 'ascii', plan.variant === 'binary-le');
          phase = 'allocate';
        } else if (phase === 'allocate') {
          if (allocation < outputs.length) {
            if (!meter.take('records')) break;
            const target = outputs[allocation++]!;
            target.array = services.allocateAttribute(target.kind, vertexCount * target.size);
            attributes[target.name] = { array: target.array, itemSize: target.size, normalized: target.name === 'color', count: vertexCount, stride: target.size, offset: 0,
              ...(target.name === 'color' ? { colorConversion: { space: 'srgb' as const, scale: 255 as const, output: 'u8-normalized' as const } } : {}) };
          } else {
            if (source.counts.indices > 0) {
              if (!meter.take('records')) break;
              indices = services.allocateIndex('u32', source.counts.indices);
            }
            phase = 'vertices';
          }
        } else if (phase === 'vertices') {
          if (vertex === vertexCount) { phase = 'faces'; continue; }
          if (property === vertexProperties.length) { output = 0; component = 0; phase = 'vertex-output'; continue; }
          const field = vertexProperties[property]!;
          const value = reader!.next(field.scalar, meter); if (value === undefined) break;
          row[field.name] = value; property++;
        } else if (phase === 'vertex-output') {
          if (output === outputs.length) {
            if (!meter.take('records')) break;
            vertex++; property = 0; row = {}; phase = 'vertices'; continue;
          }
          if (!meter.take('scalars')) break;
          const target = outputs[output]!;
          target.array![vertex * target.size + component] = row[target.fields[component]!]!;
          if (++component === target.size) { output++; component = 0; }
        } else if (phase === 'faces') {
          if (face === faceCount) {
            modelAdmissionCheck(indexOffset === source.counts.indices);
            if (indices && maximumIndex < 65535) {
              if (!meter.take('records')) break;
              narrowed = services.allocateIndex('u16', indices.length); phase = 'narrow';
            } else phase = 'finish';
            continue;
          }
          if (faceLength < 0) {
            const count = reader!.next(countType!, meter); if (count === undefined) break;
            faceLength = count; modelAdmissionCheck(count === 3 || count === 4);
          } else if (faceRead < faceLength) {
            const value = reader!.next(indexType!, meter); if (value === undefined) break;
            faceValues[faceRead++] = value;
          } else { faceWrite = 0; phase = 'face-output'; }
        } else if (phase === 'face-output') {
          const length = faceLength === 3 ? 3 : 6;
          if (faceWrite === length) {
            if (!meter.take('records')) break;
            face++; faceRead = 0; faceLength = -1; faceValues = []; phase = 'faces'; continue;
          }
          if (!meter.take('scalars')) break;
          const index = faceLength === 3 ? faceWrite : [0, 1, 3, 1, 2, 3][faceWrite]!;
          const value = faceValues[index]!;
          indices![indexOffset++] = value; maximumIndex = Math.max(maximumIndex, value); faceWrite++;
        } else if (phase === 'narrow') {
          if (narrowOffset === indices!.length) { indices = narrowed!; narrowed = undefined; phase = 'finish'; continue; }
          if (!meter.take('scalars')) break;
          narrowed![narrowOffset] = indices![narrowOffset]!; narrowOffset++;
        } else {
          if (!meter.take('records')) break;
          const vertexColors = attributes['color'] !== undefined;
          const material = { name: '', color: [1, 1, 1] as const, opacity: 1, transparent: false, alphaTest: 0, depthWrite: true, side: 0 as const, vertexColors };
          const value: ModelDescriptor = {
            protocol: 1, roots: [0], selectedRoot: 0,
            nodes: [{ kind: indices ? 'mesh' : 'points', name: '', matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], children: [], geometry: 0, materials: [0] }],
            geometries: [{ attributes, index: indices, groups: [], drawRange: { start: 0, count: null } }],
            materials: [indices ? { ...material, kind: 'mesh-standard', flatShading: attributes['normal'] === undefined, roughness: 1, metalness: 0, emissive: [0, 0, 0], normalScale: [1, 1], aoMapIntensity: 1, maps: { baseColor: null, normal: null, metalness: null, roughness: null, emissive: null, ao: null } }
              : { ...material, kind: 'points', size: 1, sizeAttenuation: true, map: null }], textures: [],
          };
          release(); phase = 'done'; return { done: true, used: meter.used, value };
        }
      }
      return { done: false, used: meter.used };
    },
    dispose() { release(); phase = 'disposed'; },
  };
};

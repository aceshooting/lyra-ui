import { modelAdmissionCheck } from '../model-admission-policy.js';
import { ModelWorkMeter } from '../model-work.js';
import type { AdmittedModelInput, ModelAttributeDescriptor, ModelDecoderServices, ModelDescriptor, ModelNumericArray, ModelPreparedDecoder } from '../model-prepared-types.js';

class PcdValues {
  private offset: number;
  private paid = 0;
  private token = '';
  private ready = false;
  private view: DataView | undefined;
  constructor(private bytes: Uint8Array<ArrayBuffer>, offset: number, private readonly ascii: boolean) {
    this.offset = offset; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  next(packed: boolean, meter: ModelWorkMeter): number | undefined {
    if (!this.ascii) {
      const charge = Math.min(4 - this.paid, meter.remaining('bytes'));
      if (charge > 0) { meter.take('bytes', charge); this.paid += charge; }
      if (this.paid < 4 || !meter.take('scalars')) return undefined;
      const value = packed ? this.view!.getUint32(this.offset, true) : this.view!.getFloat32(this.offset, true);
      this.offset += 4; this.paid = 0; return value;
    }
    for (;;) {
      if (this.ready) {
        if (!meter.take('scalars')) return undefined;
        const value = parseFloat(this.token); this.token = ''; this.ready = false; return value;
      }
      if (this.offset === this.bytes.length) { modelAdmissionCheck(this.token.length > 0); this.ready = true; continue; }
      if (meter.remaining('bytes') === 0 || meter.remaining('scalars') === 0) return undefined;
      meter.take('bytes'); meter.take('scalars');
      const byte = this.bytes[this.offset++]!;
      if (byte === 32 || byte === 10) { if (this.token) this.ready = true; }
      else this.token += String.fromCharCode(byte);
    }
  }
  dispose(): void { this.bytes = new Uint8Array(); this.view = undefined; this.token = ''; }
}
interface PcdOutput { readonly name: string; readonly fields: readonly string[]; array?: ModelNumericArray }

export const createPreparedPcd: ModelPreparedDecoder = (input: AdmittedModelInput, services: ModelDecoderServices) => {
  modelAdmissionCheck(input.input.format === 'pcd' && input.plan.format === 'pcd', 'unsupported');
  const plan = input.plan;
  let source: AdmittedModelInput | undefined = input;
  let reader: PcdValues | undefined;
  let phase: 'setup' | 'allocate' | 'read' | 'output' | 'finish' | 'done' | 'disposed' = 'setup';
  let outputs: PcdOutput[] = [];
  let attributes: Record<string, ModelAttributeDescriptor> = {};
  let row: Record<string, number> = {};
  let point = 0; let field = 0; let allocation = 0; let output = 0; let component = 0;
  let floatBits: DataView | undefined;
  const release = (): void => { reader?.dispose(); reader = undefined; source = undefined; outputs = []; attributes = {}; row = {}; floatBits = undefined; };
  return {
    step(budget) {
      if (phase === 'done' || phase === 'disposed' || !source) throw new Error('Model decoder work is no longer active');
      const meter = new ModelWorkMeter(budget);
      for (;;) {
        if (phase === 'setup') {
          if (!meter.take('records')) break;
          if (plan.points > 0) {
            outputs.push({ name: 'position', fields: ['x', 'y', 'z'] });
            if (plan.fields.some(value => value.name === 'normal_x')) outputs.push({ name: 'normal', fields: ['normal_x', 'normal_y', 'normal_z'] });
            if (plan.fields.some(value => value.name === 'rgb')) outputs.push({ name: 'color', fields: ['rgb', 'rgb', 'rgb'] });
          }
          if (plan.variant === 'ascii' && plan.fields.some(value => value.name === 'rgb' && value.scalar.kind === 'float')) {
            const scratch = services.allocateAttribute('f32', 1);
            floatBits = new DataView(scratch.buffer, scratch.byteOffset, scratch.byteLength);
          }
          reader = new PcdValues(source.input.bytes, plan.dataOffset, plan.variant === 'ascii'); phase = 'allocate';
        } else if (phase === 'allocate') {
          if (allocation === outputs.length) { phase = 'read'; continue; }
          if (!meter.take('records')) break;
          const target = outputs[allocation++]!;
          target.array = services.allocateAttribute(target.name === 'color' ? 'u8' : 'f32', plan.points * 3);
          attributes[target.name] = { array: target.array, itemSize: 3, normalized: false, count: plan.points, stride: 3, offset: 0,
            ...(target.name === 'color' ? { colorConversion: { space: 'srgb' as const, scale: 255 as const, output: 'f32' as const } } : {}) };
        } else if (phase === 'read') {
          if (point === plan.points) { phase = 'finish'; continue; }
          if (field === plan.fields.length) { output = 0; component = 0; phase = 'output'; continue; }
          const item = plan.fields[field]!;
          let value = reader!.next(item.name === 'rgb', meter); if (value === undefined) break;
          if (item.name === 'rgb' && floatBits) { floatBits.setFloat32(0, value, true); value = floatBits.getUint32(0, true); }
          row[item.name] = value; field++;
        } else if (phase === 'output') {
          if (output === outputs.length) {
            if (!meter.take('records')) break;
            point++; field = 0; row = {}; phase = 'read'; continue;
          }
          if (!meter.take('scalars')) break;
          const target = outputs[output]!; const value = row[target.fields[component]!]!;
          target.array![point * 3 + component] = target.name === 'color' ? (value >>> ((2 - component) * 8)) & 255 : value;
          if (++component === 3) { output++; component = 0; }
        } else {
          if (!meter.take('records')) break;
          const value: ModelDescriptor = {
            protocol: 1, roots: [0], selectedRoot: 0,
            nodes: [{ kind: 'points', name: '', matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], children: [], geometry: 0, materials: [0] }],
            geometries: [{ attributes, index: null, groups: [], drawRange: { start: 0, count: null } }],
            materials: [{ kind: 'points', name: '', color: [1, 1, 1], opacity: 1, transparent: false, alphaTest: 0, depthWrite: true, side: 0, vertexColors: attributes['color'] !== undefined, size: 0.005, sizeAttenuation: true, map: null }], textures: [],
          };
          release(); phase = 'done'; return { done: true, used: meter.used, value };
        }
      }
      return { done: false, used: meter.used };
    },
    dispose() { release(); phase = 'disposed'; },
  };
};

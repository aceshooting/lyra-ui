import type { ModelAdmissionFailure } from './types.js';
import type { ModelDescriptor, OwnedModelInput } from './model-prepared-types.js';
import { createModelGeneratorWork } from './model-work-generator.js';

export interface ModelWorkerStart { readonly protocol: 1; readonly job: number; readonly type: 'start'; readonly input: OwnedModelInput }
export type ModelWorkerResult = { readonly protocol: 1; readonly job: number; readonly type: 'ready' }
  | { readonly protocol: 1; readonly job: number; readonly type: 'result'; readonly descriptor: ModelDescriptor }
  | { readonly protocol: 1; readonly job: number; readonly type: 'error'; readonly code: ModelAdmissionFailure };
export interface ModelWorkerScope { addEventListener(type: 'message', listener: (event: MessageEvent) => void): void; postMessage(message: ModelWorkerResult, transfers: Transferable[]): void }

export function createModelTransferWork(descriptor: ModelDescriptor) {
  return createModelGeneratorWork(function* () {
    const buffers = new Set<ArrayBuffer>();
    const add = (array: ArrayBufferView | null | undefined): void => { if (array?.buffer instanceof ArrayBuffer) buffers.add(array.buffer); };
    for (const geometry of descriptor.geometries) {
      for (const attribute of Object.values(geometry.attributes)) { yield 'records'; add(attribute.array); add(attribute.colorConversion?.authoredRows); }
      yield 'records'; add(geometry.index); add(geometry.indexAttribute?.array);
    }
    return [...buffers];
  });
}

import { ModelAdmissionError } from './admission.js';
import { createModelAdmissionWork } from './model-admission-kernel.js';
import { createModelDecoderServices } from './model-decoder-services.js';
import { aborted } from './model-parser-common.js';
import type { AdmittedModelInput, ModelAllocationHooks, ModelDescriptor, ModelPreparedDecoder, OwnedModelInput } from './model-prepared-types.js';
import { runModelWork } from './model-work-runner.js';

async function decoder(format: OwnedModelInput['format']): Promise<ModelPreparedDecoder> {
  switch (format) {
    case 'xyz': return (await import('./parsers/prepared-xyz.js')).createPreparedXyz;
    case 'obj': return (await import('./parsers/prepared-obj.js')).createPreparedObj;
    case 'ply': return (await import('./parsers/prepared-ply.js')).createPreparedPly;
    case 'pcd': return (await import('./parsers/prepared-pcd.js')).createPreparedPcd;
    case 'stl': return (await import('./parsers/prepared-stl.js')).createPreparedStl;
    case 'gltf': case 'glb': return (await import('./parsers/prepared-gltf.js')).createPreparedGltf;
    default: throw new ModelAdmissionError('unsupported');
  }
}
export async function decodePreparedModel(admitted: AdmittedModelInput, signal?: AbortSignal, allocations?: ModelAllocationHooks): Promise<ModelDescriptor> {
  aborted(signal); const create = await decoder(admitted.input.format); aborted(signal);
  return runModelWork(create(admitted, createModelDecoderServices(admitted, allocations).services), signal);
}
export async function decodeOwnedModel(input: OwnedModelInput, signal?: AbortSignal): Promise<ModelDescriptor> {
  const admitted = await runModelWork(createModelAdmissionWork(input), signal); aborted(signal);
  return decodePreparedModel(admitted, signal);
}

import { modelAdmissionCheck, snapshotModelInput } from './model-admission-policy.js';
import { createModelAdmissionWork } from './model-admission-kernel.js';
import { ModelJsonString } from './model-json-string.js';
import { drainModelWork } from './model-work.js';
import type { ModelAdmission, ModelFormat, ModelParserInput } from './types.js';

export { ModelAdmissionError } from './model-admission-error.js';

const snapshots = new WeakMap<ModelAdmission, ModelParserInput>();

/** Validate bounded supported format subsets before invoking any loader or decoder. */
export function admitModel(input: ArrayBuffer | Uint8Array, format: ModelFormat): ModelAdmission {
  const admitted = drainModelWork(createModelAdmissionWork(snapshotModelInput(input, format)));
  const resources = admitted.resources.map(resource => ({ ...resource, uri: resource.uri instanceof ModelJsonString ? resource.uri.chunks.join('') : resource.uri }));
  const counts = admitted.counts;
  const plan: ModelAdmission = Object.freeze({ format, encodedBytes: counts.encodedBytes, decodedBytes: counts.decodedBytes, vertices: counts.vertices, indices: counts.indices, resources: counts.resources, imagePixels: counts.imagePixels });
  snapshots.set(plan, { format, bytes: admitted.input.bytes, resources }); return plan;
}

/** Return a detached snapshot only for a genuine admission receipt. */
export function readModelAdmission(plan: ModelAdmission): ModelParserInput {
  const source = snapshots.get(plan); modelAdmissionCheck(source);
  return { format: source.format, bytes: source.bytes.slice(), resources: source.resources.map((resource) => ({ ...resource, bytes: resource.bytes.slice() })) };
}

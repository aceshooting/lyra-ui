import { ModelAdmissionError } from './admission.js';
import { createModelAdmissionWork } from './model-admission-kernel.js';
import { createModelDescriptorValidation } from './model-descriptor-validation.js';
import { createModelMaterialization, decodePreparedImages } from './model-materialization.js';
import { aborted, type ParsedModel } from './model-parser-common.js';
import { decodePreparedModel } from './model-preparation-kernel.js';
import type { AdmittedModelInput, ModelDescriptor, OwnedModelInput } from './model-prepared-types.js';
import type { ModelWorkerResult, ModelWorkerStart } from './model-worker-protocol.js';
import { runModelWork } from './model-work-runner.js';

interface ModelPreparationServices { readonly worker?: () => Worker | undefined }
let nextJob = 0;
const createWorker = (): Worker | undefined => typeof Worker === 'function' ? new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' }) : undefined;

function decode(admitted: AdmittedModelInput, signal: AbortSignal | undefined, services: ModelPreparationServices): Promise<ModelDescriptor> {
  let worker: Worker | undefined;
  try { worker = (services.worker ?? createWorker)(); } catch { /* Unsupported worker startup uses the same bounded local decoder. */ }
  if (!worker) return decodePreparedModel(admitted, signal);
  const active = worker;
  nextJob = nextJob === Number.MAX_SAFE_INTEGER ? 1 : nextJob + 1; const job = nextJob;
  return new Promise<ModelDescriptor>((resolve, reject) => {
    let settled = false; let heard = false; let fallingBack = false; let workerClosed = false;
    const closeWorker = (): void => {
      if (workerClosed) return; workerClosed = true;
      active.removeEventListener('message', message); active.removeEventListener('error', error); active.removeEventListener('messageerror', unreadable);
      try { active.terminate(); } catch { /* Completion still releases operation ownership. */ }
    };
    const cleanup = (): void => { closeWorker(); signal?.removeEventListener('abort', cancel); };
    const fail = (reason: unknown): void => { if (settled) return; settled = true; cleanup(); reject(reason); };
    const finish = (descriptor: ModelDescriptor): void => { if (settled) return; settled = true; cleanup(); resolve(descriptor); };
    const cancel = (): void => fail(new DOMException('Model preparation was aborted', 'AbortError'));
    const fallback = (): void => { if (settled || fallingBack) return; fallingBack = true; closeWorker(); void decodePreparedModel(admitted, signal).then(finish, fail); };
    const message = (event: MessageEvent): void => {
      if (settled || fallingBack) return;
      const value = event.data as Partial<ModelWorkerResult> | null;
      if (!value || value.protocol !== 1 || value.job !== job) { fail(new ModelAdmissionError('invalid')); return; }
      if (value.type === 'ready' && !heard) { heard = true; return; }
      if (!heard) { fail(new ModelAdmissionError('invalid')); return; }
      if (value.type === 'result' && value.descriptor) finish(value.descriptor);
      else if (value.type === 'error' && value.code && ['invalid', 'limit', 'unsupported', 'external-resource'].includes(value.code)) fail(new ModelAdmissionError(value.code));
      else fail(new ModelAdmissionError('invalid'));
    };
    const error = (event: ErrorEvent): void => { event.preventDefault(); if (!heard) fallback(); else fail(new ModelAdmissionError('invalid')); };
    const unreadable = (): void => { if (!heard) fallback(); else fail(new ModelAdmissionError('invalid')); };
    active.addEventListener('message', message); active.addEventListener('error', error); active.addEventListener('messageerror', unreadable);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    try { active.postMessage({ protocol: 1, job, type: 'start', input: admitted.input } satisfies ModelWorkerStart); }
    catch { fallback(); }
  });
}

export async function prepareModel(input: OwnedModelInput, options: { readonly signal?: AbortSignal } = {}, services: ModelPreparationServices = {}): Promise<ParsedModel> {
  const { signal } = options;
  aborted(signal);
  const admitted = await runModelWork(createModelAdmissionWork(input), signal); aborted(signal);
  const descriptor = await decode(admitted, signal, services); aborted(signal);
  await runModelWork(createModelDescriptorValidation(descriptor, admitted), signal); aborted(signal);
  let images: Map<number, ImageBitmap> | undefined = await decodePreparedImages(admitted, signal);
  try {
    aborted(signal); const parsed = await runModelWork(createModelMaterialization(descriptor, admitted, images), signal); images = undefined;
    try { aborted(signal); return parsed; } catch (error) { parsed.dispose(); throw error; }
  } finally { if (images) for (const image of images.values()) try { image.close(); } catch { /* Release all images if construction did not accept ownership. */ } }
}

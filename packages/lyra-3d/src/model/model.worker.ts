import { ModelAdmissionError } from './admission.js';
import { snapshotModelInput } from './model-admission-policy.js';
import { decodeOwnedModel } from './model-preparation-kernel.js';
import { createModelTransferWork, type ModelWorkerScope, type ModelWorkerStart } from './model-worker-protocol.js';
import { runModelWork } from './model-work-runner.js';

export function serveModelPreparation(scope: ModelWorkerScope): void {
  let started = false;
  scope.addEventListener('message', (event) => {
    if (started) return;
    const message = event.data as Partial<ModelWorkerStart> | null;
    if (!message || message.protocol !== 1 || message.type !== 'start' || !Number.isSafeInteger(message.job) || message.job! <= 0) return;
    started = true; const job = message.job!;
    scope.postMessage({ protocol: 1, job, type: 'ready' }, []);
    const execute = async (): Promise<void> => {
      try {
        if (!message.input) throw new ModelAdmissionError('invalid');
        const owned = snapshotModelInput(message.input.bytes, message.input.format);
        const descriptor = await decodeOwnedModel(owned);
        const transfers = await runModelWork(createModelTransferWork(descriptor));
        scope.postMessage({ protocol: 1, job, type: 'result', descriptor }, transfers);
      } catch (error) {
        scope.postMessage({ protocol: 1, job, type: 'error', code: error instanceof ModelAdmissionError ? error.code : 'invalid' }, []);
      }
    };
    void execute();
  });
}

if (typeof document === 'undefined' && typeof globalThis.addEventListener === 'function' && typeof globalThis.postMessage === 'function') serveModelPreparation(globalThis as unknown as ModelWorkerScope);

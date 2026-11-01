import { isSignalProxy } from '#graph-layout-signal-brand';
import { admitGraphDag, admitGraphDagOptions, ASYNC_LIMITS } from './admission.js';
import { createGraphDagKernel } from './kernel.js';
import type { GraphDagKernelStep } from './kernel.js';
import { GraphDagLayoutError } from './types.js';
import type {
  GraphDagLayoutExecution,
  GraphDagLayoutInput,
  GraphDagLayoutOptions,
  GraphDagLayoutProgress,
  GraphDagLayoutResult,
} from './types.js';

const abortedGetter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!;
const addListener = EventTarget.prototype.addEventListener;
const removeListener = EventTarget.prototype.removeEventListener;
const SLICE_OPERATIONS = 4096;
const CLOCK_CHECK_OPERATIONS = 256;
const SLICE_MILLISECONDS = 4;

interface AdmittedExecution {
  signal?: AbortSignal;
  onProgress?: (progress: GraphDagLayoutProgress) => void;
}

function executionField(execution: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(execution, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor)) throw new GraphDagLayoutError('invalid-options');
  return descriptor.value;
}

function admitExecution(execution: GraphDagLayoutExecution | undefined): AdmittedExecution {
  if (execution === undefined) return {};
  try {
    if (execution === null || typeof execution !== 'object' || Array.isArray(execution)) {
      throw new GraphDagLayoutError('invalid-options');
    }
    const signal = executionField(execution, 'signal');
    const onProgress = executionField(execution, 'onProgress');
    if (onProgress !== undefined && typeof onProgress !== 'function') {
      throw new GraphDagLayoutError('invalid-options');
    }
    if (signal !== undefined) {
      if (isSignalProxy(signal)) throw new GraphDagLayoutError('invalid-options');
      abortedGetter.call(signal);
    }
    return { signal: signal as AbortSignal | undefined, onProgress: onProgress as AdmittedExecution['onProgress'] };
  } catch {
    throw new GraphDagLayoutError('invalid-options');
  }
}

/**
 * Computes deterministic DAG geometry in cancellable main-thread macrotasks.
 * Input columns are borrowed and must remain unchanged until the promise settles.
 */
export function layoutGraphDagAsync(
  input: GraphDagLayoutInput,
  options?: GraphDagLayoutOptions,
  execution?: GraphDagLayoutExecution,
): Promise<GraphDagLayoutResult> {
  return new Promise((resolve, reject) => {
    let admitted: AdmittedExecution;
    try {
      admitted = admitExecution(execution);
    } catch (error) {
      reject(error);
      return;
    }
    let signal = admitted.signal;
    let onProgress = admitted.onProgress;
    let borrowedInput: GraphDagLayoutInput | undefined = input;
    let capturedOptions: GraphDagLayoutOptions | undefined;
    let iterator: ReturnType<typeof createGraphDagKernel> | undefined;
    let lastStep: GraphDagKernelStep | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    let listening = false;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (listening && signal) removeListener.call(signal, 'abort', abort);
      listening = false;
      const ownedIterator = iterator;
      iterator = undefined;
      lastStep = undefined;
      signal = undefined;
      onProgress = undefined;
      borrowedInput = undefined;
      capturedOptions = undefined;
      // Closing the generator runs its scratch-buffer release path.
      ownedIterator?.return(undefined as never);
    };
    const fail = (error: unknown) => {
      if (!active) return;
      active = false;
      cleanup();
      reject(error);
    };
    function abort() {
      fail(new DOMException('The operation was aborted.', 'AbortError'));
    }
    const checkAbort = () => {
      if (!active) return true;
      if (signal && abortedGetter.call(signal)) abort();
      return !active;
    };
    const report = (phase = lastStep!.phase) => {
      if (checkAbort()) return;
      const step = lastStep!;
      onProgress?.(Object.freeze({
        phase,
        operations: step.operations,
        nodeCount: step.nodeCount,
        edgeCount: step.edgeCount,
      }));
      checkAbort();
    };
    const schedule = () => {
      if (!checkAbort()) timer = setTimeout(runSlice, 0);
    };
    function runSlice() {
      timer = undefined;
      if (checkAbort()) return;
      try {
        if (!iterator) {
          const admission = admitGraphDag(borrowedInput!, capturedOptions, ASYNC_LIMITS);
          if (checkAbort()) return;
          borrowedInput = undefined;
          capturedOptions = undefined;
          iterator = createGraphDagKernel(admission);
        }
        const startOperations = lastStep?.operations ?? 0;
        let checkedOperations = startOperations;
        const deadline = performance.now() + SLICE_MILLISECONDS;
        while (active) {
          if (checkAbort()) return;
          const next = iterator.next();
          if (next.done) {
            if (checkAbort()) return;
            report('complete');
            if (checkAbort()) return;
            active = false;
            cleanup();
            resolve(next.value);
            return;
          }
          lastStep = next.value;
          const operations = lastStep.operations;
          let endSlice = lastStep.header || lastStep.allocation || operations - startOperations >= SLICE_OPERATIONS;
          if (operations - checkedOperations >= CLOCK_CHECK_OPERATIONS) {
            checkedOperations = operations;
            endSlice ||= performance.now() >= deadline;
          }
          if (endSlice) break;
        }
        if (checkAbort()) return;
        report();
        if (checkAbort()) return;
        schedule();
      } catch (error) {
        fail(error);
      }
    }
    try {
      if (checkAbort()) return;
      capturedOptions = admitGraphDagOptions(options);
      if (checkAbort()) return;
      if (signal) {
        listening = true;
        addListener.call(signal, 'abort', abort);
        if (checkAbort()) return;
      }
      schedule();
    } catch (error) {
      fail(error);
    }
  });
}

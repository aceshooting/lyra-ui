import { acquireXrPreparation, acquireXrSession, releaseXrSession } from '../dist/xr/coordinator.js';
import { createXrPresentationController } from '../dist/xr/controller.js';

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export async function turns() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

export function fixture(options = {}) {
  const request = deferred(), binding = deferred(), ending = deferred(), retirement = deferred();
  const trace = [], finalizers = [], applicationErrors = [], endListeners = new Set();
  const documentKey = options.documentKey ?? {}, engineKey = {}, lease = acquireXrPreparation(engineKey);
  let ended = false, submitted, failure, lastFailure, unsubscriptions = 0;
  const nativeSession = {
    end() { trace.push('end'); return ending.promise; },
    observeEnd(listener) {
      endListeners.add(listener); if (ended) listener();
      return () => { endListeners.delete(listener); };
    },
  };
  const owner = {
    request() { trace.push('request'); if (options.requestError) throw options.requestError; return request.promise; },
    bind(value, callback) { trace.push('bind'); if (value !== nativeSession) throw new Error('Wrong owned session'); submitted = callback; return binding.promise; },
    observeFailure(listener) { failure = lastFailure = listener; return () => { failure = undefined; unsubscriptions++; }; },
    detach() { trace.push('detach'); },
    retire() { trace.push('retire'); return retirement.promise; },
  };
  const controller = createXrPresentationController({ preparationLease: lease, documentKey, nativeOwner: owner,
    validatePrepared: () => options.invalid ?? null,
    enqueueFinalizer: callback => { finalizers.push(callback); },
    reportApplicationError: error => { applicationErrors.push(error); } }, {
    onStateChange(state) { trace.push(`state:${state}`); options.onStateChange?.(state, controller); },
  });
  return {
    controller, request, binding, ending, retirement, nativeSession, trace, finalizers, applicationErrors, documentKey, engineKey, lease,
    end() { ended = true; for (const listener of [...endListeners]) listener(); },
    submit() { submitted?.(); }, fail(reason = 'failed') { failure?.(reason); }, lateFailure(reason = 'failed') { lastFailure?.(reason); },
    get failureUnsubscriptions() { return unsubscriptions; },
    get listeners() { return endListeners.size; },
    async grant() { request.resolve(nativeSession); await turns(); },
    async present() { const entered = controller.enter(); await this.grant(); binding.resolve(); await turns(); this.submit(); await entered; return entered; },
    async flush() { await turns(); while (finalizers.length) { finalizers.shift()(); await turns(); } },
    async finish() { this.end(); ending.resolve(); binding.resolve(); await this.flush(); retirement.resolve(); await this.flush(); },
    documentBusy() { try { const token = acquireXrSession(documentKey); releaseXrSession(token); return false; } catch (error) { if (error.code === 'busy') return true; throw error; } },
  };
}

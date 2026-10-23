/** Installed before application imports, observes the existing protocol without changing messages. */
export function observeGraphWorkers() {
  const NativeWorker = window.Worker;
  let record, serial = 0;
  window.__layoutObservation = {
    reset() { record = undefined; serial++; },
    read() { return record ? structuredClone(record) : null; },
  };
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args);
      let token = -1;
      this.addEventListener('message', event => {
        const message = event.data;
        if (token !== serial || !record || record.invalidated || message?.type !== 'output') return;
        const output = message.output;
        if (output?.epoch !== record.epoch) return;
        if (![output?.iteration, output?.alpha, output?.maxSpeed].every(Number.isFinite)) return;
        record.samples.push({ epoch: output.epoch, iteration: output.iteration, alpha: output.alpha, maxSpeed: output.maxSpeed, done: message.done, elapsedMs: performance.now() - record.startedAt });
        Object.assign(record, record.samples.at(-1));
      });
      const post = this.postMessage;
      this.postMessage = (...messages) => {
        const message = messages[0], data = message?.input?.data;
        if (message?.type === 'start' && message.input?.type === 'start' && Number.isInteger(data?.nodeCount) && data.pinned instanceof Uint8Array) {
          token = ++serial;
          record = { startedAt: performance.now(), nodeCount: data.nodeCount,
            movable: data.pinned.reduce((count, pin) => count + (pin === 0 ? 1 : 0), 0),
            options: { ...data.options }, epoch: 0, samples: [], done: false };
        }
        if (token === serial && record && message?.type === 'update' && message.input?.type === 'pins') { record.epoch++; record.done = false; record.invalidated = 'pin-update'; }
        return post.apply(this, messages);
      };
    }
  };
}

/** Mirrors completion branches, never promotes the iteration ceiling into convergence. */
export function completionReason(record) {
  if (!record.done) return 'incomplete';
  if (record.movable === 0) return 'no-movable-nodes';
  if (record.iteration >= (record.options.maxSteps ?? 500)) return 'budget-exhausted';
  if (record.alpha <= (record.options.minAlpha ?? 0.001)) return 'cooled';
  // Intermediate outputs may be coalesced. The remaining actual done branch is stability;
  // do not estimate its count from the delivered samples.
  return 'stable';
}

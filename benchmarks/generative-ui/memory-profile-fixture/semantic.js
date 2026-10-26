const require = (condition, message) => { if (!condition) throw new TypeError(message); };
const untilAbort = (promise, signal) => new Promise((resolve, reject) => {
  const finish = (callback, value) => { signal.removeEventListener('abort', abort); callback(value); };
  const abort = () => finish(reject, new Error('Semantic host operation aborted.'));
  signal.addEventListener('abort', abort, { once: true });
  void Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
  if (signal.aborted) abort();
});

/** Executes a host operation's real commit contract without a clock or timing result. */
export function createSemanticHostExecutor() {
  let pending = 0;
  return {
    get pendingOperations() { return pending; },
    async measureOperation({ operation, generation, signal, trigger, waitForCommit, readOracle }) {
      require(pending === 0 && operation?.trigger === 'host' && typeof trigger === 'function'
        && typeof waitForCommit === 'function' && typeof readOracle === 'function', 'Semantic executor requires one host operation.');
      const controller = new AbortController(), abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort(); pending++;
      try {
        require(!controller.signal.aborted && readOracle().generation === generation, 'Semantic operation is aborted or stale.');
        const committed = Promise.resolve(waitForCommit({ signal: controller.signal })); void committed.catch(() => {});
        await untilAbort(Promise.resolve(trigger({ signal: controller.signal })), controller.signal);
        await untilAbort(committed, controller.signal);
        const oracle = readOracle();
        require(oracle.generation === generation && oracle.status === 'committed' && oracle.fingerprint === operation.expectedFingerprint
          && oracle.connected === true && oracle.visible === true, 'Semantic host result did not commit.');
        return { method: 'semantic-only', id: operation.id, generation, fingerprint: oracle.fingerprint, semanticAssertionsPassed: true };
      } finally { controller.abort(); signal?.removeEventListener('abort', abort); pending--; }
    },
  };
}

/** Input identities describe the strings retained by the actual X fixture until dispose. */
export function xOwnershipMetrics(prepared, executor, views) {
  const json = prepared?.inputs?.json?.utf16Units, markup = prepared?.inputs?.markup?.utf16Units;
  require(Number.isSafeInteger(json) && json > 0 && Number.isSafeInteger(markup) && markup > 0, 'X retained input lengths are unavailable.');
  require(executor && Number.isSafeInteger(executor.pendingOperations) && executor.pendingOperations >= 0, 'X pending-work ownership is unavailable.');
  return { sourceCharacters: json + markup, controllerParts: views.filter(view => Boolean(view.document)).length,
    controllerIslands: views.length, pendingOperations: executor.pendingOperations };
}
export function validateXDisposal(receipt, connected, executor) {
  require(receipt?.connectedNodes === 0 && receipt.connectedElements === 0 && receipt.retainedSources === 0 && receipt.pendingOperations === 0,
    'Actual X fixture disposal retained owned state.');
  require(connected.nodes === 0 && connected.elements === 0 && executor.pendingOperations === 0, 'X disposal disagrees with live ownership counters.');
  return receipt;
}

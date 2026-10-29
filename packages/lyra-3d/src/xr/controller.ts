import { acquireXrSession, releaseXrPreparation, releaseXrSession, verifyXrPreparationLease,
  type XrPreparationLease, type XrSessionLease } from './coordinator.js';
import { Lyra3dXrError, type Lyra3dXrErrorCode, type Lyra3dXrOptions, type Lyra3dXrPresentation, type Lyra3dXrState } from './types.js';

/** Internal wrapper; the native adapter observes end from grant and replays it to late observers. */
export interface XrOwnedSession {
  end(): Promise<void>;
  observeEnd(listener: () => void): () => void;
}
export interface XrNativeOwner {
  request(): Promise<XrOwnedSession>;
  bind(session: XrOwnedSession, submitted: () => void): Promise<void>;
  observeFailure(listener: (reason: 'failed' | 'context-lost' | 'aborted') => void): () => void;
  detach(): void;
  retire(): Promise<void>;
}
export interface XrControllerServices {
  readonly preparationLease: XrPreparationLease;
  /** Dedicated scope token with no engine, component or document backreference. */
  readonly documentKey: object;
  readonly nativeOwner: XrNativeOwner;
  validatePrepared(this: void): Lyra3dXrErrorCode | null;
  enqueueFinalizer(this: void, job: () => void): void;
  reportApplicationError(this: void, error: unknown): void;
}

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
  reject(reason: Lyra3dXrErrorCode): void;
}
function deferred(): Deferred {
  let resolve!: () => void, reject!: (error: Lyra3dXrError) => void;
  let settled = false;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  // Cleanup may fail before anyone calls exit. Observe it without replacing its public Promise.
  void promise.catch(() => {});
  return { promise,
    resolve() { if (!settled) { settled = true; resolve(); } },
    reject(reason) { if (!settled) { settled = true; reject(new Lyra3dXrError(reason)); } },
  };
}
function platformReason(error: unknown): Lyra3dXrErrorCode {
  try {
    const name = error !== null && typeof error === 'object' && 'name' in error ? error.name : undefined;
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'not-allowed';
    if (name === 'NotSupportedError') return 'unavailable';
    if (name === 'AbortError') return 'aborted';
  } catch { /* Malformed native failures still have a fixed public reason. */ }
  return 'failed';
}
function optionCallback(options: Lyra3dXrOptions | undefined): Lyra3dXrOptions['onStateChange'] {
  if (options === undefined) return undefined;
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Invalid XR presentation options');
  const descriptor = Object.getOwnPropertyDescriptor(options, 'onStateChange');
  if (descriptor && (!Object.hasOwn(descriptor, 'value') || (descriptor.value !== undefined && typeof descriptor.value !== 'function'))) {
    throw new TypeError('Invalid XR presentation options');
  }
  return descriptor?.value as Lyra3dXrOptions['onStateChange'];
}

interface CapturedServices {
  preparationLease: XrPreparationLease;
  documentKey: object;
  validatePrepared: () => Lyra3dXrErrorCode | null;
  request: () => Promise<XrOwnedSession>;
  bind: (session: XrOwnedSession, submitted: () => void) => Promise<void>;
  observeFailure: XrNativeOwner['observeFailure'];
  detach: () => void;
  retire: () => Promise<void>;
  enqueueFinalizer: (job: () => void) => void;
  reportApplicationError: (error: unknown) => void;
  callback: Lyra3dXrOptions['onStateChange'];
}
const claimedPreparation = new WeakSet<XrPreparationLease>();

/** No browser/renderer access: native ownership and successful submissions are supplied facts. */
export function createXrPresentationController(services: XrControllerServices, options?: Lyra3dXrOptions): Lyra3dXrPresentation {
  const callback = optionCallback(options);
  verifyXrPreparationLease(services.preparationLease);
  if (claimedPreparation.has(services.preparationLease)) throw new Lyra3dXrError('busy');
  const owner = services.nativeOwner;
  const captured: CapturedServices = {
    preparationLease: services.preparationLease, documentKey: services.documentKey,
    validatePrepared: services.validatePrepared,
    request: owner.request.bind(owner), bind: owner.bind.bind(owner), observeFailure: owner.observeFailure.bind(owner),
    detach: owner.detach.bind(owner), retire: owner.retire.bind(owner),
    enqueueFinalizer: services.enqueueFinalizer, reportApplicationError: services.reportApplicationError, callback,
  };
  claimedPreparation.add(services.preparationLease);
  return createController(captured);
}

function createController(captured: CapturedServices): Lyra3dXrPresentation {
  let state: Lyra3dXrState = 'ready', lastNotified: Lyra3dXrState = 'ready';
  let callback = captured.callback, validatePrepared: CapturedServices['validatePrepared'] | undefined = captured.validatePrepared;
  let requestNative: CapturedServices['request'] | undefined = captured.request;
  let bindNative: CapturedServices['bind'] | undefined = captured.bind;
  let observeFailure: CapturedServices['observeFailure'] | undefined = captured.observeFailure;
  let detachNative: CapturedServices['detach'] | undefined = captured.detach;
  let retireNative: CapturedServices['retire'] | undefined = captured.retire;
  let documentKey: object | undefined = captured.documentKey;
  const preparationLease = captured.preparationLease, enqueueFinalizer = captured.enqueueFinalizer, reportApplicationError = captured.reportApplicationError;
  let sessionLease: XrSessionLease | undefined, session: XrOwnedSession | undefined;
  let unsubscribeEnd: (() => void) | undefined, unsubscribeFailure: (() => void) | undefined;
  let entry: Deferred | undefined, exiting: Deferred | undefined;
  let attempted = false, active = false, explicitlyDisposed = false, detached = false;
  let requestSettled = false, nativeEnded = false, bindingSettled = true, bindingSucceeded = false, submitted = false;
  let endRequested = false, finalizerQueued = false, retirementStarted = false, retirementFailed = false, cleaned = false;
  // Clear the owned transfer record so it cannot retain handles after their local owners clear them.
  for (const key of Object.keys(captured)) Reflect.deleteProperty(captured, key);

  const notify = (next: Lyra3dXrState): void => {
    if (explicitlyDisposed) return;
    state = next;
    if (lastNotified === next) return;
    lastNotified = next;
    try { callback?.(next); }
    catch (error) { queueMicrotask(() => { reportApplicationError(error); }); }
  };
  const removeFailureObserver = (): void => {
    const remove = unsubscribeFailure; unsubscribeFailure = undefined;
    try { remove?.(); } catch { exiting?.reject('failed'); }
  };
  const dropUnused = (): void => {
    active = false; state = 'disposed'; callback = undefined; validatePrepared = undefined;
    requestNative = undefined; bindNative = undefined; observeFailure = undefined; detachNative = undefined; retireNative = undefined; documentKey = undefined;
    releaseXrPreparation(preparationLease); cleaned = true;
  };
  const completeRetirement = (): void => {
    cleaned = true;
    session = undefined; requestNative = undefined; bindNative = undefined; observeFailure = undefined;
    detachNative = undefined; retireNative = undefined; validatePrepared = undefined; documentKey = undefined;
    if (sessionLease) { releaseXrSession(sessionLease); sessionLease = undefined; }
    releaseXrPreparation(preparationLease);
    exiting?.resolve(); notify('disposed'); callback = undefined;
  };
  const failRetirement = (): void => {
    retirementFailed = true; exiting?.reject('failed');
    // No release certificate exists in this protocol: the native leases stay quarantined.
  };
  const mayRetire = (): boolean => attempted && !active && requestSettled && (!session || nativeEnded) && bindingSettled &&
    !retirementStarted && !retirementFailed && !cleaned;
  const queueRetirement = (): void => {
    if (finalizerQueued || !mayRetire()) return;
    finalizerQueued = true;
    try {
      enqueueFinalizer(() => {
        finalizerQueued = false;
        if (!mayRetire()) return;
        retirementStarted = true;
        const remove = unsubscribeEnd; unsubscribeEnd = undefined;
        try { remove?.(); } catch { exiting?.reject('failed'); }
        try { void Promise.resolve(retireNative!()).then(completeRetirement, failRetirement); }
        catch { failRetirement(); }
      });
    } catch { finalizerQueued = false; failRetirement(); }
  };
  const requestEnd = (): void => {
    if (!session || nativeEnded || endRequested) return;
    endRequested = true;
    try {
      void Promise.resolve(session.end()).then(queueRetirement, () => { exiting?.reject('failed'); queueRetirement(); });
    } catch { exiting?.reject('failed'); queueRetirement(); }
  };
  const detach = (reason: Lyra3dXrErrorCode): void => {
    active = false; entry?.reject(reason); validatePrepared = undefined;
    bindNative = undefined; observeFailure = undefined; requestNative = undefined;
    removeFailureObserver();
    if (!detached) {
      detached = true;
      const stop = detachNative; detachNative = undefined;
      try { stop?.(); } catch { exiting?.reject('failed'); }
    }
    notify('ending'); requestEnd(); queueRetirement();
  };
  const observeNativeEnd = (): void => {
    if (nativeEnded || cleaned) return;
    nativeEnded = true; detach('aborted');
  };
  const markPresented = (): void => {
    if (!active || nativeEnded || !bindingSucceeded || !submitted) return;
    entry?.resolve(); notify('presenting');
  };
  const observeSubmission = (): void => {
    if (!active || nativeEnded) return;
    submitted = true; markPresented();
  };
  const observeNativeFailure: Parameters<XrNativeOwner['observeFailure']>[0] = reason => {
    if (!active || cleaned) return;
    detach(reason === 'context-lost' ? 'context-lost' : reason === 'aborted' ? 'aborted' : 'failed');
  };
  const granted = (value: XrOwnedSession): void => {
    requestSettled = true; session = value;
    try { unsubscribeEnd = value.observeEnd(observeNativeEnd); }
    catch { detach('failed'); return; }
    // observeEnd may synchronously replay end; never bind a dead or locally cancelled grant.
    if (!active || nativeEnded) { requestEnd(); queueRetirement(); return; }
    bindingSettled = false;
    try {
      const bind = bindNative!;
      void Promise.resolve(bind(value, observeSubmission)).then(() => {
        bindingSettled = true; bindingSucceeded = true;
        if (active && !nativeEnded) markPresented(); else queueRetirement();
      }, () => { bindingSettled = true; detach('failed'); });
    } catch { bindingSettled = true; detach('failed'); }
  };
  const denied = (error: unknown): void => { requestSettled = true; detach(platformReason(error)); };

  return Object.freeze({
    get state() { return state; },
    enter(): Promise<void> {
      if (state === 'disposed') return Promise.reject(new Lyra3dXrError('aborted'));
      if (state !== 'ready' || attempted) return Promise.reject(new Lyra3dXrError('busy'));
      let invalid: Lyra3dXrErrorCode | null;
      try { invalid = validatePrepared!(); } catch { invalid = 'failed'; }
      if (invalid) { dropUnused(); return Promise.reject(new Lyra3dXrError(invalid)); }
      try { sessionLease = acquireXrSession(documentKey!); }
      catch { return Promise.reject(new Lyra3dXrError('busy')); }
      attempted = true; active = true; state = 'requesting'; entry = deferred(); exiting = deferred(); validatePrepared = undefined;
      const result = entry.promise, request = requestNative!;
      requestNative = undefined;
      let pending: Promise<XrOwnedSession>;
      try {
        // Transient activation must reach this native request before any application notification.
        pending = request();
      } catch (error) { denied(error); return result; }
      void Promise.resolve(pending).then(granted, denied);
      try {
        if (active && observeFailure) {
          const remove = observeFailure(observeNativeFailure);
          if (active) unsubscribeFailure = remove; else { try { remove(); } catch { exiting.reject('failed'); } }
        }
        if (active) notify('requesting');
      } catch { detach('failed'); }
      return result;
    },
    exit(): Promise<void> {
      if (!attempted) return Promise.resolve();
      if (active) detach('aborted');
      return exiting!.promise;
    },
    dispose(): void {
      if (explicitlyDisposed) return;
      explicitlyDisposed = true; callback = undefined; state = 'disposed';
      if (!attempted) { dropUnused(); return; }
      if (!cleaned) detach('aborted');
    },
  });
}

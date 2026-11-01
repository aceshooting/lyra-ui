import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { XrNativeOwner, XrOwnedSession } from './controller.js';
import { observeNativeXrSession, type NativeXrSessionRecord } from './native-session.js';

/** Package-owned handles; cleanup must retain only resources, never a viewport or component. */
export interface ThreeXrNativeTransfer {
  xr: Pick<XRSystem, 'requestSession'>;
  renderer: WebGLRenderer;
  canvas: HTMLCanvasElement;
  scene: Scene;
  camera: PerspectiveCamera;
  stopInline(this: void): void;
  prepareFrame(this: void, frame: XRFrame, space: XRReferenceSpace): boolean;
  detachApplication(this: void): void;
  retireResources(this: void): void | Promise<void>;
  afterRendererDispose?(this: void): void;
}

interface CapturedTransfer extends Omit<ThreeXrNativeTransfer, 'xr'> {
  requestSession: XRSystem['requestSession'];
}
type FailureListener = Parameters<XrNativeOwner['observeFailure']>[0];
type FailureReason = Parameters<FailureListener>[0];

/** Transfer one renderer to a single native attempt without starting work during preparation. */
export function createThreeXrNativeOwner(transfer: ThreeXrNativeTransfer): XrNativeOwner {
  return createOwner({
    requestSession: transfer.xr.requestSession.bind(transfer.xr),
    renderer: transfer.renderer, canvas: transfer.canvas, scene: transfer.scene, camera: transfer.camera,
    stopInline: transfer.stopInline, prepareFrame: transfer.prepareFrame,
    detachApplication: transfer.detachApplication, retireResources: transfer.retireResources,
    afterRendererDispose: transfer.afterRendererDispose,
  });
}

function createOwner(captured: CapturedTransfer): XrNativeOwner {
  let renderer: WebGLRenderer | undefined = captured.renderer, canvas: HTMLCanvasElement | undefined = captured.canvas;
  let scene: Scene | undefined = captured.scene, camera: PerspectiveCamera | undefined = captured.camera;
  let requestSession: CapturedTransfer['requestSession'] | undefined = captured.requestSession;
  let stopInline: CapturedTransfer['stopInline'] | undefined = captured.stopInline;
  let prepareFrame: CapturedTransfer['prepareFrame'] | undefined = captured.prepareFrame;
  let detachApplication: CapturedTransfer['detachApplication'] | undefined = captured.detachApplication;
  let retireResources: CapturedTransfer['retireResources'] | undefined = captured.retireResources;
  let afterRendererDispose: CapturedTransfer['afterRendererDispose'] = captured.afterRendererDispose;
  let record: NativeXrSessionRecord | undefined, removeNativeEnd: (() => void) | undefined;
  let reference: XRReferenceSpace | undefined, submitted: (() => void) | undefined;
  let failure: FailureReason | undefined;
  const failureListeners = new Set<FailureListener>();
  let attempted = false, active = false, detached = false, requestSettled = false, bindingPending = false;
  let bindingStarted = false, contextObserved = false, startObserved = false;
  let retirement: Promise<void> | undefined, contextReleased: (() => void) | undefined;
  for (const key of Object.keys(captured)) Reflect.deleteProperty(captured, key);

  const reportFailure = (reason: FailureReason): void => {
    if (!active || detached) return;
    failure ??= reason;
    for (const listener of [...failureListeners]) {
      if (!active || detached) break;
      listener(failure);
    }
  };
  const onContextLost = (): void => {
    contextReleased?.();
    reportFailure('context-lost');
  };
  const onReset = (): void => { reportFailure('aborted'); };
  const observeReference = (): void => {
    if (!active || detached || !record || record.ended || !renderer) return;
    const next = renderer.xr.getReferenceSpace();
    if (!next || next === reference) return;
    reference?.removeEventListener('reset', onReset);
    reference = next;
    reference.addEventListener('reset', onReset);
  };
  const onFrame = (_time: number, frame?: XRFrame): void => {
    if (!active || detached || !renderer || !record || record.ended || !frame ||
      frame.session !== record.native || renderer.xr.getSession() !== record.native ||
      record.native?.visibilityState === 'hidden') return;
    try {
      if (renderer.getContext().isContextLost()) { reportFailure('context-lost'); return; }
      const space = renderer.xr.getReferenceSpace();
      if (!space || !prepareFrame || !scene || !camera || !frame.getViewerPose(space)) return;
      if (!prepareFrame(frame, space) || !active || detached || record.ended || !renderer || !scene || !camera) return;
      renderer.render(scene, camera);
      if (renderer.getContext().isContextLost()) { reportFailure('context-lost'); return; }
      if (active && !detached && !record.ended) submitted?.();
    } catch { reportFailure('failed'); }
  };
  const detach = (): void => {
    if (detached || !attempted) return;
    active = false; detached = true;
    submitted = undefined; prepareFrame = undefined; scene = undefined; camera = undefined;
    requestSession = undefined; stopInline = undefined;
    failureListeners.clear(); failure = undefined;
    const detachApplicationNow = detachApplication; detachApplication = undefined;
    let failed = false;
    try { reference?.removeEventListener('reset', onReset); } catch { failed = true; }
    reference = undefined;
    try { if (startObserved) renderer!.xr.removeEventListener('sessionstart', observeReference); } catch { failed = true; }
    startObserved = false;
    try { renderer!.setAnimationLoop(null); } catch { failed = true; }
    try { detachApplicationNow?.(); } catch { failed = true; }
    if (failed) throw new Error('XR application detachment failed.');
  };
  const releaseContext = (): Promise<void> => {
    const gl = renderer!.getContext();
    if (gl.isContextLost()) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      contextReleased = resolve;
      try {
        const extension = gl.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('XR context release is unavailable.');
        extension.loseContext();
        if (gl.isContextLost()) resolve();
      } catch { reject(new Error('XR context release failed.')); }
    });
  };
  const retire = async (): Promise<void> => {
    let failed = false;
    const cleanupResources = retireResources; retireResources = undefined;
    try { await cleanupResources?.(); } catch { failed = true; }
    try { renderer!.setAnimationLoop(null); } catch { failed = true; }
    try { renderer!.dispose(); } catch { failed = true; }
    const cleanupAfterRenderer = afterRendererDispose; afterRendererDispose = undefined;
    try { cleanupAfterRenderer?.(); } catch { failed = true; }
    try { await releaseContext(); } catch { failed = true; }
    contextReleased = undefined;
    try { if (contextObserved) canvas!.removeEventListener('webglcontextlost', onContextLost); } catch { failed = true; }
    contextObserved = false;
    try { removeNativeEnd?.(); } catch { failed = true; }
    removeNativeEnd = undefined;
    try { record?.release(); } catch { failed = true; }
    record = undefined;
    if (failed) throw new Error('XR resource retirement failed.');
    renderer = undefined; canvas = undefined;
  };

  return {
    request() {
      if (attempted || detached) throw new DOMException('The XR attempt is already consumed.', 'InvalidStateError');
      attempted = true; active = true;
      const requestNative = requestSession!; requestSession = undefined;
      const stop = stopInline; stopInline = undefined;
      try {
        canvas!.addEventListener('webglcontextlost', onContextLost); contextObserved = true;
        stop!();
        const requested = requestNative('immersive-vr', { requiredFeatures: ['local'] });
        const result = requested.then(native => {
          record = observeNativeXrSession(native);
          removeNativeEnd = record.owned.observeEnd(() => { active = false; });
          requestSettled = true;
          return record.owned;
        }, (error: unknown) => { requestSettled = true; throw error; });
        void result.catch(() => {});
        return result;
      } catch (error) { requestSettled = true; throw error; }
    },
    bind(session: XrOwnedSession, onSubmitted: () => void) {
      if (!record || session !== record.owned) throw new TypeError('The XR session belongs to another owner.');
      if (!active || detached || record.ended || bindingStarted) {
        throw new DOMException('The XR session cannot be bound.', 'InvalidStateError');
      }
      bindingStarted = true; bindingPending = true; submitted = onSubmitted;
      try {
        renderer!.xr.enabled = true;
        renderer!.xr.setReferenceSpaceType('local');
        renderer!.xr.addEventListener('sessionstart', observeReference); startObserved = true;
        renderer!.setAnimationLoop(onFrame);
        const binding = renderer!.xr.setSession(record.native!).then(() => {
          bindingPending = false; observeReference();
        }, (error: unknown) => { bindingPending = false; throw error; });
        void binding.catch(() => {});
        return binding;
      } catch (error) { bindingPending = false; throw error; }
    },
    observeFailure(listener) {
      if (!active || detached) return () => {};
      failureListeners.add(listener);
      if (failure) listener(failure);
      return () => { failureListeners.delete(listener); };
    },
    detach,
    retire() {
      if (retirement) return retirement;
      if (!attempted || !detached || !requestSettled || bindingPending || (record && !record.ended)) {
        return Promise.reject(new DOMException('XR ownership is not quiescent.', 'InvalidStateError'));
      }
      // Cache the promise before running cleanup callbacks, including reentrant trusted cleanup.
      retirement = Promise.resolve().then(retire);
      void retirement.catch(() => {});
      return retirement;
    },
  };
}

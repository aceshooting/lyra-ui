import { NoToneMapping, UnsignedByteType, WebGLRenderer, WebGLRenderTarget } from 'three';
import { createOwnedGlEpoch } from './owned-gl-context.js';
import type { GlHandleSnapshot, OwnedGlBudget, OwnedGlEpoch, ThreeGlEntry } from './owned-gl-context.js';

export interface BorrowedThreeHost {
  readonly gl: WebGL2RenderingContext; readonly canvas: HTMLCanvasElement;
  isCurrent(epoch: number): boolean;
  withThreeState<T>(operation: 'construct' | 'frame' | 'dispose', work: (entry: ThreeGlEntry) => T): T;
}
export interface BorrowedRendererEpoch {
  readonly handles: GlHandleSnapshot;
  dispose(): void; lose(): void;
}
interface ExternalFramebufferRenderer extends WebGLRenderer {
  setRenderTargetFramebuffer(target: WebGLRenderTarget, framebuffer: WebGLFramebuffer | null | undefined): void;
}
/** Retains retirement ownership when construction cannot publish a usable renderer epoch. */
export class BorrowedRendererConstructionError extends Error {
  readonly retirement: BorrowedRendererEpoch;
  constructor(retirement: BorrowedRendererEpoch) {
    super('Borrowed graphics initialization failed');
    this.name = 'BorrowedRendererConstructionError';
    this.retirement = retirement;
    Object.defineProperty(this, 'retirement', { value: retirement, enumerable: true, writable: false, configurable: false });
  }
}
const unavailable = (): never => { throw new Error('Borrowed graphics capability unavailable'); };

/** Initializes pinned Three caches without transferring ownership of the host context or target. */
export function createBorrowedRendererEpoch(host: BorrowedThreeHost, budget: OwnedGlBudget): BorrowedRendererEpoch {
  if (!host || typeof host.isCurrent !== 'function' || typeof host.withThreeState !== 'function') throw new TypeError('Invalid graphics host');
  let owner: OwnedGlEpoch | undefined, renderer: WebGLRenderer | undefined, epochNumber: number | undefined;
  let lost = false, disposed = false, disposing = false, rendererDisposed = false, rendererDisposeFailed = false;
  const currentOwner = () => owner ?? unavailable();
  const cpuDispose = () => {
    if (!rendererDisposed) {
      rendererDisposed = true;
      try { renderer?.dispose(); } catch { rendererDisposeFailed = true; }
    }
    if (rendererDisposeFailed) return unavailable();
  };
  const retirement: BorrowedRendererEpoch = Object.freeze({
    get handles() { return currentOwner().handles; },
    lose() { if (lost || disposed) return; lost = true; currentOwner().lose(); },
    dispose() {
      if (disposed || disposing) return;
      disposing = true;
      try {
        if (lost) {
          const result = currentOwner().retireAfterLoss([cpuDispose]); renderer = undefined;
          if (result.failed) return unavailable();
          disposed = true;
        } else {
          host.withThreeState('dispose', entry => {
            if (entry.epoch !== epochNumber) return unavailable();
            currentOwner().run(entry, () => {
              let failed = false;
              try { cpuDispose(); } catch { failed = true; }
              try { renderer?.resetState(); } catch { failed = true; }
              try { currentOwner().sweep(); } catch { failed = true; }
              if (failed) return unavailable();
            });
          });
          currentOwner().retire(); disposed = true; renderer = undefined;
        }
      } finally { disposing = false; }
    }
  });
  try {
    host.withThreeState('construct', entry => {
      epochNumber = entry.epoch;
      owner = createOwnedGlEpoch({ epoch: entry.epoch, gl: host.gl, canvas: host.canvas,
        isCurrent: () => !lost && !disposed && host.isCurrent(entry.epoch), budget });
      owner.run(entry, (gl, canvas) => {
        try {
          renderer = new WebGLRenderer({ canvas, context: gl, outputBufferType: UnsignedByteType, reversedDepthBuffer: false });
          renderer.autoClear = false; renderer.autoClearColor = false; renderer.autoClearDepth = false; renderer.autoClearStencil = false;
          renderer.xr.enabled = false; renderer.toneMapping = NoToneMapping;
          renderer.debug.checkShaderErrors = true; renderer.debug.onShaderError = unavailable;
          renderer.resetState();
          const target = entry.target;
          if (target.draw !== null) {
            // This CPU target is only a borrowed association; disposing it would delete host storage.
            const external = new WebGLRenderTarget(target.width, target.height);
            external.viewport.set(...target.viewport); external.scissor.set(...target.scissor); external.scissorTest = target.scissorTest;
            (renderer as ExternalFramebufferRenderer).setRenderTargetFramebuffer(external, target.draw);
            renderer.setRenderTarget(external);
          } else renderer.setRenderTarget(null);
          renderer.setViewport(...target.viewport); renderer.setScissor(...target.scissor); renderer.setScissorTest(target.scissorTest);
          gl.drawBuffers([...target.drawBuffers]); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.read); gl.readBuffer(target.readBuffer);
          gl.depthRange(...target.depthRange); gl.depthFunc(target.depthFunc);
          gl.isContextLost(); renderer.resetState();
        } catch {
          try { cpuDispose(); } catch { /* Retirement receipt retains any unresolved ownership. */ }
          try { currentOwner().sweep(); } catch { /* A later admitted retirement owns remaining handles. */ }
          return unavailable();
        }
      });
    });
    currentOwner().assertCurrent();
    return retirement;
  } catch {
    if (!owner) throw new TypeError('Invalid graphics host');
    try { retirement.dispose(); } catch { /* The structured error retains the recovery capability. */ }
    throw new BorrowedRendererConstructionError(retirement);
  }
}

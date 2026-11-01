/** Lifecycle of a prepared, single-attempt immersive presentation. */
export type Lyra3dXrState = 'ready' | 'requesting' | 'presenting' | 'ending' | 'disposed';

/** Bounded failure reasons that do not expose platform error details. */
export type Lyra3dXrErrorCode = 'unavailable' | 'not-allowed' | 'busy'
  | 'unsupported-scene' | 'context-lost' | 'failed' | 'aborted';

export interface Lyra3dXrOptions {
  /** Receives each live state transition; explicit disposal ends notifications. */
  readonly onStateChange?: (state: Lyra3dXrState) => void;
}

export interface Lyra3dXrPresentation {
  readonly state: Lyra3dXrState;
  /** Resolves after binding and the first successful valid-pose render submission. */
  enter(): Promise<void>;
  /** Resolves after native ownership, binding and renderer retirement have completed. */
  exit(): Promise<void>;
  /** Releases an unused preparation without touching inline rendering; otherwise detaches
   * immediately and suppresses callbacks while native cleanup continues. */
  dispose(): void;
}

const errorMessages: Readonly<Record<Lyra3dXrErrorCode, string>> = Object.freeze({
  unavailable: 'Immersive presentation is unavailable.',
  'not-allowed': 'Immersive presentation was not allowed.',
  busy: 'Immersive presentation is already in use.',
  'unsupported-scene': 'This scene does not support immersive presentation.',
  'context-lost': 'The rendering context was lost.',
  failed: 'Immersive presentation failed.',
  aborted: 'Immersive presentation was aborted.',
});

/** A fixed-message presentation error with a closed, platform-independent reason. */
export class Lyra3dXrError extends Error {
  readonly code: Lyra3dXrErrorCode;

  constructor(code: Lyra3dXrErrorCode) {
    if (typeof code !== 'string' || !Object.hasOwn(errorMessages, code)) {
      throw new TypeError('Invalid immersive presentation error code.');
    }
    super(errorMessages[code]);
    this.name = 'Lyra3dXrError';
    this.code = code;
  }
}

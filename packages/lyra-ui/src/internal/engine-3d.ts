import { literalSetConverter } from './converters.js';
import { LYRA_DEFAULT_engine3dContextLost, LYRA_DEFAULT_engine3dError, LYRA_DEFAULT_engine3dLoading, LYRA_DEFAULT_engine3dShowingBuiltin, LYRA_DEFAULT_engine3dShowingList, LYRA_DEFAULT_engine3dSoftwareRendering, LYRA_DEFAULT_engine3dUnavailable, LYRA_DEFAULT_engine3dUnsupported } from './default-strings/shared.generated.js';
import type { LyraMessage } from './localization-types.js';

/**
 * Which renderer an element prefers for its 3D view. `'webgl'` is a preference, not a requirement:
 * when the companion engine is missing, WebGL2 is unavailable, or the context is lost or fails, the
 * element falls back to its built-in renderer and then to its list or text alternative.
 */
export type Engine3dPreference = 'builtin' | 'webgl';

/**
 * Normalizes the `engine` attribute and direct property writes alike: anything other than
 * `'webgl'` resolves to `'builtin'`, so a typo never opts an application into a download.
 */
export const ENGINE_3D_PREFERENCE = literalSetConverter<Engine3dPreference>(['builtin', 'webgl'], 'builtin');

/** What currently renders: the WebGL engine, the element's built-in renderer, or its list or text alternative. */
export type Engine3dRenderer = 'webgl' | 'builtin' | 'list';

/** Why an element moved down its fallback chain. */
export type Engine3dFallbackReason = 'unavailable' | 'unsupported' | 'context-lost' | 'error';

/** Detail of the `lr-engine-fallback` event an element emits on every step down its chain. */
export interface Engine3dFallbackDetail {
  readonly from: Engine3dRenderer;
  readonly to: Engine3dRenderer;
  readonly reason: Engine3dFallbackReason;
}

export type Engine3dMessageKey =
  | 'engine3dLoading'
  | 'engine3dUnavailable'
  | 'engine3dUnsupported'
  | 'engine3dContextLost'
  | 'engine3dError'
  | 'engine3dSoftwareRendering'
  | 'engine3dShowingBuiltin'
  | 'engine3dShowingList';

/** English defaults an element merges into its own `defaultStrings` when it adopts the `engine` property. */
export const ENGINE_3D_DEFAULT_STRINGS: Readonly<Record<Engine3dMessageKey, LyraMessage>> = Object.freeze({
  engine3dLoading: LYRA_DEFAULT_engine3dLoading,
  engine3dUnavailable: LYRA_DEFAULT_engine3dUnavailable,
  engine3dUnsupported: LYRA_DEFAULT_engine3dUnsupported,
  engine3dContextLost: LYRA_DEFAULT_engine3dContextLost,
  engine3dError: LYRA_DEFAULT_engine3dError,
  engine3dSoftwareRendering: LYRA_DEFAULT_engine3dSoftwareRendering,
  engine3dShowingBuiltin: LYRA_DEFAULT_engine3dShowingBuiltin,
  engine3dShowingList: LYRA_DEFAULT_engine3dShowingList,
});

/** Why an element fell back, as a message key; plain literal tables keep `localize()` keys checkable. */
export const ENGINE_3D_REASON_MESSAGE = {
  unavailable: 'engine3dUnavailable',
  unsupported: 'engine3dUnsupported',
  'context-lost': 'engine3dContextLost',
  error: 'engine3dError',
} as const satisfies Readonly<Record<Engine3dFallbackReason, Engine3dMessageKey>>;

/** What a fallback shows now, as a message key. A fallback never lands on the WebGL renderer. */
export const ENGINE_3D_SHOWING_MESSAGE = {
  webgl: 'engine3dShowingList',
  builtin: 'engine3dShowingBuiltin',
  list: 'engine3dShowingList',
} as const satisfies Readonly<Record<Engine3dRenderer, Engine3dMessageKey>>;

/**
 * The two message keys of a fallback notice: why the element fell back, then what it shows now.
 * They are separate sentences, each translated whole and rendered in its own node.
 */
export function engine3dFallbackNotice(detail: Engine3dFallbackDetail): {
  readonly reason: Engine3dMessageKey;
  readonly showing: Engine3dMessageKey;
} {
  return {
    reason: ENGINE_3D_REASON_MESSAGE[detail.reason],
    showing: ENGINE_3D_SHOWING_MESSAGE[detail.to],
  };
}

/**
 * Maps an engine `mount()` rejection to a fallback reason. The companion rejects with
 * `code: 'webgl-unavailable'` when the browser has no WebGL2; anything else is an engine error.
 */
export function engine3dFailureReason(error: unknown): Engine3dFallbackReason {
  return typeof error === 'object' && error !== null && (error as { readonly code?: unknown }).code === 'webgl-unavailable'
    ? 'unsupported'
    : 'error';
}

/**
 * Whether this browser can create a WebGL2 context at all, checked before downloading an engine.
 * The probe context is released at once so it does not count against the page's context budget.
 */
export function webgl2Available(createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')): boolean {
  try {
    const context = createCanvas().getContext('webgl2');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return context !== null;
  } catch {
    return false;
  }
}

/**
 * The renderer state machine behind an element's `engine` property, kept free of rendering so the
 * same rules apply to every component: the preference switches live, a failure moves one step down
 * the chain (`webgl` -> `builtin` when the element has one -> `list`), and a restored context or a
 * fresh preference write returns to WebGL.
 */
export class Engine3dSelection {
  private currentPreference: Engine3dPreference = 'builtin';
  private currentRenderer: Engine3dRenderer;

  /** `hasBuiltin`: whether the element has its own renderer between WebGL and the list. */
  constructor(private readonly hasBuiltin: boolean) {
    this.currentRenderer = hasBuiltin ? 'builtin' : 'list';
  }

  get preference(): Engine3dPreference {
    return this.currentPreference;
  }

  get renderer(): Engine3dRenderer {
    return this.currentRenderer;
  }

  /** Applies a normalized preference; returns whether the renderer to show changed. */
  prefer(value: unknown): boolean {
    const preference = ENGINE_3D_PREFERENCE.normalize(value);
    const previous = this.currentRenderer;
    this.currentPreference = preference;
    this.currentRenderer = preference === 'webgl' ? 'webgl' : this.hasBuiltin ? 'builtin' : 'list';
    return previous !== this.currentRenderer;
  }

  /**
   * Moves one step down the chain after `reason` stopped the current renderer. Returns the event
   * detail to emit, or `null` when the list or text alternative is already showing.
   */
  fail(reason: Engine3dFallbackReason): Engine3dFallbackDetail | null {
    const from = this.currentRenderer;
    const to: Engine3dRenderer | null = from === 'webgl' ? (this.hasBuiltin ? 'builtin' : 'list') : from === 'builtin' ? 'list' : null;
    if (to === null) return null;
    this.currentRenderer = to;
    return Object.freeze({ from, to, reason });
  }

  /** Returns to WebGL after a restored context when WebGL is still preferred; reports a change. */
  restore(): boolean {
    if (this.currentPreference !== 'webgl' || this.currentRenderer === 'webgl') return false;
    this.currentRenderer = 'webgl';
    return true;
  }
}

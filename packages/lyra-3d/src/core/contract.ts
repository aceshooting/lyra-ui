/**
 * The engine contract shared by every entry point. A component owns data, selection, keyboard
 * handling, localization and accessibility; an engine only renders, lays out and picks, and
 * reports back through {@link Lyra3dHost}. Items are indices into the order the component owns.
 */

/** The contract version every engine reports and every host validates before use. */
export const LYRA_3D_CONTRACT = 1;

export type Lyra3dContractVersion = typeof LYRA_3D_CONTRACT;

/** Keyboard modifiers and click count of a pointer activation. */
export interface Lyra3dPickModifiers {
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly double: boolean;
}

/** Why an engine stopped rendering: a lost WebGL context or an unrecoverable error. */
export type Lyra3dLostReason = 'context-lost' | 'error';

/** What the engine learned about the WebGL context it rendered with. */
export interface Lyra3dRenderingInfo {
  /**
   * `true` when the browser refuses a context that avoids a major performance caveat, which in
   * practice means software rasterization. Components lower their detail defaults in response.
   */
  readonly software: boolean;
}

/** Callbacks from an engine to its component. */
export interface Lyra3dHost {
  /** The item under the pointer changed; `null` when no item is under it. */
  hover(item: number | null): void;
  /** The pointer activated an item, or empty space when `item` is `null`. */
  pick(item: number | null, modifiers: Lyra3dPickModifiers): void;
  /** The user moved the camera. Called at most once per animation frame. */
  camera(camera: unknown): void;
  /** File-loading progress in bytes, for engines that load resources. */
  progress?(loaded: number, total: number): void;
  /** The engine stopped rendering; the component shows its notice and waits or falls back. */
  lost(reason: Lyra3dLostReason, detail?: string): void;
  /** Reported once after mounting, so software rendering is never silent. */
  rendering?(info: Lyra3dRenderingInfo): void;
  /** A lost context was restored and the engine re-applied its renderer state. */
  restored?(): void;
}

/**
 * Plain style values the component resolved from its design tokens. Colors are CSS color strings
 * in `#hex`, `rgb()`/`rgba()` or `color(srgb ...)` form; sizes are CSS pixels.
 */
export interface Lyra3dStyle {
  readonly background: string;
  readonly foreground: string;
  readonly muted: string;
  readonly accent: string;
  readonly focus: string;
  /** Categorical colors, indexed by an item's category. */
  readonly palette: readonly string[];
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly pointSize: number;
  readonly lineWidth: number;
  readonly devicePixelRatio: number;
  readonly reducedMotion: boolean;
  readonly forcedColors: boolean;
}

/** Selection and focus state the component owns. `hover` and `focus` are `-1` for none. */
export interface Lyra3dState {
  readonly selected: ReadonlySet<number>;
  readonly dimmed: ReadonlySet<number>;
  readonly hover: number;
  readonly focus: number;
}

export interface Lyra3dScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface Lyra3dWorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** One engine instance. Each entry point exports `createEngine()` returning this shape. */
export interface Lyra3dEngine<Data, Camera> {
  readonly contract: Lyra3dContractVersion;
  /** Creates the engine's own canvas inside `container`. Rejects when WebGL2 is unavailable. */
  mount(container: HTMLElement, host: Lyra3dHost): Promise<void>;
  /** Replaces the data; `revision` increases with every replacement. */
  setData(data: Data, revision: number): void;
  setStyle(style: Lyra3dStyle): void;
  setState?(state: Lyra3dState): void;
  /** Moves the camera without calling {@link Lyra3dHost.camera}. */
  setCamera(camera: Camera): void;
  fit?(padding?: number): Camera;
  focus?(item: number, zoom?: number): Camera | null;
  pick?(x: number, y: number): number | null;
  project?(item: number): Lyra3dScreenPoint | null;
  positionOf?(item: number): Lyra3dWorldPoint | null;
  /** The container's new size in CSS pixels. */
  resize(width: number, height: number): void;
  /** Releases the WebGL context, listeners, workers and the canvas. Idempotent. */
  dispose(): void;
}

/** The shape every engine entry point exports. */
export interface Lyra3dEngineModule<Data, Camera> {
  createEngine(): Lyra3dEngine<Data, Camera>;
}

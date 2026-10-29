import { devWarnOnce } from './dev-warning.js';
import {
  createOptionalPeerLoader,
  type OptionalPeerLoader,
} from './optional-peer-capabilities.js';

/**
 * The WebGL engines a component can load from the optional `@aceshooting/lyra-3d` companion, one
 * package entry point each.
 */
export type Engine3dEntryPoint = 'graph' | 'points' | 'panorama' | 'model';

/** The engine contract version this library speaks. */
export const ENGINE_3D_CONTRACT = 1;

/** Keyboard modifiers and click count the engine reports with an activation. */
export interface Engine3dPickModifiers {
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly double: boolean;
}

/**
 * Callbacks a component hands to its engine. Owned structurally here so the optional companion's
 * declarations never enter this library's public type graph.
 */
export interface Engine3dHost {
  hover(item: number | null): void;
  pick(item: number | null, modifiers: Engine3dPickModifiers): void;
  camera(camera: unknown): void;
  progress?(loaded: number, total: number): void;
  lost(reason: 'context-lost' | 'error', detail?: string): void;
  rendering?(info: { readonly software: boolean }): void;
  restored?(): void;
}

/** Platform-independent states of an optional immersive presentation. */
export type Engine3dXrState = 'ready' | 'requesting' | 'presenting' | 'ending' | 'disposed';

/** Structural options owned here without importing the optional companion's declarations. */
export interface Engine3dXrOptions {
  readonly onStateChange?: (state: Engine3dXrState) => void;
}

/** A prepared presentation owns its native lifetime independently of the loader. */
export interface Engine3dXrPresentation {
  readonly state: Engine3dXrState;
  enter(): Promise<void>;
  exit(): Promise<void>;
  dispose(): void;
}

/** The engine surface a component calls; data, camera and style stay opaque to the loader. */
export interface Engine3dInstance {
  readonly contract: typeof ENGINE_3D_CONTRACT;
  mount(container: HTMLElement, host: Engine3dHost): Promise<void>;
  setData(data: unknown, revision: number): void;
  setStyle(style: unknown): void;
  setState?(state: {
    readonly selected: ReadonlySet<number>;
    readonly dimmed: ReadonlySet<number>;
    readonly hover: number;
    readonly focus: number;
  }): void;
  setCamera(camera: unknown): void;
  fit?(padding?: number): unknown;
  focus?(item: number, zoom?: number): unknown;
  pick?(x: number, y: number): number | null;
  project?(item: number): { readonly x: number; readonly y: number } | null;
  positionOf?(item: number): { readonly x: number; readonly y: number; readonly z: number } | null;
  resize(width: number, height: number): void;
  prepareXrPresentation?(options?: Engine3dXrOptions): Promise<Engine3dXrPresentation>;
  dispose(): void;
}

/** What every engine entry point exports. */
export interface Engine3dModule {
  createEngine(): unknown;
}

const REQUIRED_METHODS = ['mount', 'setData', 'setStyle', 'setCamera', 'resize', 'dispose'] as const;
const OPTIONAL_METHODS = ['setState', 'fit', 'focus', 'pick', 'project', 'positionOf', 'prepareXrPresentation'] as const;

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

/** Whether a loaded entry point exposes a callable `createEngine`. */
export function isEngine3dModule(candidate: unknown): candidate is Engine3dModule {
  return isObjectLike(candidate) && typeof candidate['createEngine'] === 'function';
}

/**
 * The first contract violation of a created engine, or `undefined` when it speaks this library's
 * contract version and every required method (and every present optional one) is callable.
 */
export function engine3dContractViolation(candidate: unknown): string | undefined {
  if (!isObjectLike(candidate)) return 'engine object';
  if (candidate['contract'] !== ENGINE_3D_CONTRACT) return 'contract';
  for (const method of REQUIRED_METHODS) {
    if (typeof candidate[method] !== 'function') return method;
  }
  for (const method of OPTIONAL_METHODS) {
    if (candidate[method] !== undefined && typeof candidate[method] !== 'function') return method;
  }
  return undefined;
}

export interface Engine3dLoaderOptions {
  readonly entry: Engine3dEntryPoint;
  /** The requesting element's tag name, from `tag()`, for the development diagnostic. */
  readonly tag: string;
  /**
   * Imports the entry point. Each component writes its own literal
   * `() => import('@aceshooting/lyra-3d/<entry>')` so bundlers split it into a lazy chunk and an
   * application that never opts in never downloads it.
   */
  readonly load: () => Promise<unknown>;
}

export interface Engine3dLoader extends OptionalPeerLoader<Engine3dModule> {
  readonly entry: Engine3dEntryPoint;
  /**
   * Loads the entry point (sharing one in-flight or successful load, retrying after a failure)
   * and creates a validated engine. Resolves `null` when the companion is missing, the entry
   * point lacks `createEngine`, creation throws, or the engine speaks another contract version.
   */
  create(): Promise<Engine3dInstance | null>;
}

/**
 * The shared loader for one `@aceshooting/lyra-3d` entry point. A failed import or an unusable
 * module is never cached, so installing the companion or a transient network failure clears on the
 * next attempt. Development builds warn once per entry point and failure kind; importer errors are
 * never included because they can carry local paths.
 */
export function createEngine3dLoader(options: Engine3dLoaderOptions): Engine3dLoader {
  const specifier = `@aceshooting/lyra-3d/${options.entry}`;
  const peer = createOptionalPeerLoader<Engine3dModule>({
    load: options.load,
    isCapability: isEngine3dModule,
    warningKey: `lyra-3d-${options.entry}-unavailable`,
    warning:
      `<${options.tag}> could not load its optional \`${specifier}\` engine — install it with ` +
      '`pnpm add @aceshooting/lyra-3d`.',
  });
  const incompatible = () =>
    devWarnOnce(
      `lyra-3d-${options.entry}-incompatible`,
      `<${options.tag}> cannot use the installed \`${specifier}\` engine: it does not implement ` +
        `engine contract ${ENGINE_3D_CONTRACT}. Install a matching @aceshooting/lyra-3d version.`,
    );
  let generation = 0;
  const clear = () => {
    generation += 1;
    peer.clear();
  };
  return {
    ...peer,
    clear,
    override(importer) {
      generation += 1;
      peer.override(importer);
    },
    entry: options.entry,
    async create() {
      const owner = generation;
      const module = await peer.get();
      if (!module) return null;
      try {
        const engine = module.createEngine();
        if (engine3dContractViolation(engine) === undefined) return engine as Engine3dInstance;
      } catch {
        // A factory or a contract member getter can fail before an engine is usable.
      }
      if (owner === generation) clear();
      incompatible();
      return null;
    },
  };
}

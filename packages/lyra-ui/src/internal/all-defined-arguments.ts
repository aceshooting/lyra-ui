import type { LyraDefinitionRoot } from './definition-registry.js';

/** Options object accepted by `allDefined()` as its only argument. */
export interface AllDefinedWaitOptions {
  /** Returns `true` for a lowercase tag name that must be defined before resolving. When omitted,
   *  the known `lr-*` tags are awaited. */
  readonly match?: (tagName: string) => boolean;
  /** Extra tag names to await even when they are not on the page yet. */
  readonly additionalElements?: string | readonly string[];
  /** Where to look for undefined elements. Defaults to `document`. */
  readonly root?: LyraDefinitionRoot;
  /** Milliseconds to wait before warning and resolving anyway. Defaults to 2000;
   *  `Infinity` waits indefinitely. */
  readonly timeout?: number;
}

export type NormalizedAllDefinedArguments =
  | { readonly mode: 'root'; readonly root: LyraDefinitionRoot | undefined; readonly options: unknown }
  | {
      readonly mode: 'options';
      readonly root: LyraDefinitionRoot | undefined;
      readonly match: ((tagName: string) => boolean) | undefined;
      readonly additionalElements: readonly string[];
      readonly timeout: number;
    };

export const ALL_DEFINED_DEFAULT_TIMEOUT = 2000;

function isNodeLike(value: unknown): boolean {
  return typeof value === 'object' && value !== null && typeof (value as { nodeType?: unknown }).nodeType === 'number';
}

/**
 * Tells the `(root?, traversalOptions?)` call shape from the `(waitOptions)` one. A first argument
 * that is `undefined` or a node is always the first shape, so every existing call keeps its meaning;
 * only a plain non-node object selects the options shape.
 */
export function normalizeAllDefinedArguments(
  first: unknown,
  second?: unknown,
  defaultRoot?: () => LyraDefinitionRoot | undefined,
): NormalizedAllDefinedArguments {
  if (first === undefined || first === null || isNodeLike(first) || typeof first !== 'object') {
    return { mode: 'root', root: (first as LyraDefinitionRoot | undefined) ?? defaultRoot?.(), options: second };
  }
  const options = first as AllDefinedWaitOptions;
  const timeout = options.timeout ?? ALL_DEFINED_DEFAULT_TIMEOUT;
  if (typeof timeout !== 'number' || Number.isNaN(timeout) || timeout < 0) {
    throw new RangeError('allDefined() timeout must be a number >= 0 (or Infinity)');
  }
  if (options.match !== undefined && typeof options.match !== 'function') {
    throw new TypeError('allDefined() match must be a function');
  }
  const extra = options.additionalElements;
  const list = extra === undefined ? [] : typeof extra === 'string' ? [extra] : [...extra];
  const additionalElements = [...new Set(list.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  return {
    mode: 'options',
    root: options.root ?? defaultRoot?.(),
    match: options.match,
    additionalElements,
    timeout,
  };
}

/**
 * Library-level registry of syntax grammars for `<lr-code-block>` and `<lr-code-block-core>`.
 *
 * A grammar registered here is available to every code block on the page, so an application can
 * register a language once instead of passing a `languages` or `languageLoaders` map to each
 * element. A per-element map always wins over this registry for the same language, and a block
 * whose language is registered after it rendered re-highlights immediately.
 *
 * The module is side-effect-free and holds no element references: each connected code block
 * subscribes while connected and unsubscribes when it disconnects.
 */

import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { normalizeShikiLanguage } from '../../../internal/shiki/core.js';
import type { ShikiLanguageSource } from '../../../internal/shiki/core.js';

const LISTENER_WARNING_KEY = 'lyra-code-grammar-listener-threw';
const LISTENER_WARNING = '<lr-code-block> ignored a throwing code grammar listener.';

/** Longest language name or alias accepted. */
const MAX_GRAMMAR_NAME_LENGTH = 64;
/** Most aliases accepted for one grammar. */
const MAX_GRAMMAR_ALIASES = 32;
/** A language id: letters, digits and the punctuation real ids use (`c++`, `objective-c`, `f#`). */
const GRAMMAR_NAME_PATTERN = /^[a-z0-9][a-z0-9._+#-]*$/;

/** Options for {@link registerCodeGrammar}. */
export interface LyraCodeGrammarOptions {
  /** Further language ids that resolve to the same grammar (for example `['gcl']`). */
  aliases?: readonly string[];
}

interface RegisteredGrammar {
  readonly owner: string;
  readonly source: ShikiLanguageSource;
}

const grammars = new Map<string, RegisteredGrammar>();
const listeners = new Set<(keys: ReadonlySet<string>) => void>();
let version = 0;
let snapshot: Readonly<Record<string, ShikiLanguageSource>> | undefined;

function validId(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new TypeError(`${what} must be a string.`);
  const id = normalizeShikiLanguage(value);
  if (id.length === 0 || id.length > MAX_GRAMMAR_NAME_LENGTH || !GRAMMAR_NAME_PATTERN.test(id)) {
    throw new TypeError(
      `${what} must be 1-${MAX_GRAMMAR_NAME_LENGTH} characters of letters, digits and . _ + # -.`,
    );
  }
  return id;
}

function notify(keys: ReadonlySet<string>): void {
  version += 1;
  snapshot = undefined;
  if (keys.size === 0) return;
  // A throwing listener must not strand the rest of the subscribers mid-notification.
  for (const listener of [...listeners]) {
    try {
      listener(keys);
    } catch {
      devWarnOnce(LISTENER_WARNING_KEY, LISTENER_WARNING);
    }
  }
}

/**
 * Registers a grammar for every `<lr-code-block>` and `<lr-code-block-core>`, replacing one already
 * registered under the same name. `grammarOrLoader` is a Shiki grammar object (or an array of them,
 * as a grammar module's default export) or a lazy loader such as
 * `() => import('@shikijs/langs/rust')`; a loader runs the first time a block needs that language.
 * A language set on the element's own `languages` or `languageLoaders` map takes priority over the
 * registry. Code blocks already showing that language re-highlight at once, so registration may
 * happen after they rendered. A loader that fails leaves the block on its localized plain-text
 * fallback. Names and aliases are case-insensitive; an alias that is already registered by another
 * grammar moves to this one.
 *
 * @throws {TypeError} when the name, an alias or the grammar is invalid; nothing is registered then.
 */
export function registerCodeGrammar(
  name: string,
  grammarOrLoader: ShikiLanguageSource,
  options: LyraCodeGrammarOptions = {},
): void {
  const id = validId(name, 'registerCodeGrammar() name');
  if (
    grammarOrLoader === null ||
    (typeof grammarOrLoader !== 'object' && typeof grammarOrLoader !== 'function')
  ) {
    throw new TypeError('registerCodeGrammar() needs a grammar object or a loader function.');
  }
  const rawAliases: unknown = options?.aliases;
  if (rawAliases !== undefined && !Array.isArray(rawAliases)) {
    throw new TypeError('registerCodeGrammar() aliases must be an array of strings.');
  }
  if (rawAliases && rawAliases.length > MAX_GRAMMAR_ALIASES) {
    throw new TypeError(`registerCodeGrammar() accepts at most ${MAX_GRAMMAR_ALIASES} aliases.`);
  }
  const ids = new Set<string>([id]);
  for (const alias of (rawAliases ?? []) as unknown[]) ids.add(validId(alias, 'registerCodeGrammar() alias'));

  const changed = new Set<string>(ids);
  for (const [key, entry] of grammars) {
    if (entry.owner === id) {
      grammars.delete(key);
      changed.add(key);
    }
  }
  const entry: RegisteredGrammar = { owner: id, source: grammarOrLoader };
  for (const key of ids) grammars.set(key, entry);
  notify(changed);
}

/** Removes a grammar registered under `name` together with its aliases. Code blocks showing that
 *  language fall back to their default highlighting. Unknown names are ignored. */
export function unregisterCodeGrammar(name: string): void {
  if (typeof name !== 'string') return;
  const id = normalizeShikiLanguage(name);
  const changed = new Set<string>();
  for (const [key, entry] of grammars) {
    if (entry.owner === id) {
      grammars.delete(key);
      changed.add(key);
    }
  }
  notify(changed);
}

/** The grammar source registered for `name` (or one of its aliases), or `undefined`. */
export function getCodeGrammar(name: string): ShikiLanguageSource | undefined {
  if (typeof name !== 'string') return undefined;
  return grammars.get(normalizeShikiLanguage(name))?.source;
}

/** Subscribes to registry changes; the listener receives every language id (names and aliases)
 *  affected. The returned function unsubscribes. Used by connected code blocks.
 *  @internal */
export function subscribeCodeGrammars(listener: (keys: ReadonlySet<string>) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const noElementMap = {};
const mergedByElementMap = new WeakMap<object, { version: number; merged: Readonly<Record<string, ShikiLanguageSource>> }>();

function registeredSnapshot(): Readonly<Record<string, ShikiLanguageSource>> {
  if (!snapshot) {
    const next = Object.create(null) as Record<string, ShikiLanguageSource>;
    for (const [key, entry] of grammars) next[key] = entry.source;
    snapshot = Object.freeze(next);
  }
  return snapshot;
}

/**
 * The language map a code block highlights from: its own `elementMap` plus the registry, with the
 * element's entries winning. Returns `elementMap` itself while the registry is empty, and a map that
 * is stable per (element map, registry version) otherwise, because highlighters are cached by map
 * identity.
 * @internal
 */
export function withRegisteredCodeGrammars(
  elementMap: Readonly<Record<string, ShikiLanguageSource>> | undefined,
): Readonly<Record<string, ShikiLanguageSource>> | undefined {
  if (grammars.size === 0) return elementMap;
  const key: object = elementMap !== null && typeof elementMap === 'object' ? elementMap : noElementMap;
  const cached = mergedByElementMap.get(key);
  if (cached && cached.version === version) return cached.merged;
  const merged = Object.create(null) as Record<string, ShikiLanguageSource>;
  Object.assign(merged, registeredSnapshot());
  if (key !== noElementMap) {
    let names: string[] = [];
    try { names = Object.getOwnPropertyNames(key); } catch { /* unreadable map: registry only */ }
    for (const name of names) {
      let descriptor: PropertyDescriptor | undefined;
      try { descriptor = Object.getOwnPropertyDescriptor(key, name); } catch { continue; }
      if (!descriptor?.enumerable || !('value' in descriptor) || descriptor.value === undefined) continue;
      merged[name] = descriptor.value as ShikiLanguageSource;
      // The block looks a language up under its normalized id first, so an element entry under a
      // raw spelling must also shadow the registry's normalized entry.
      const normalized = normalizeShikiLanguage(name);
      if (normalized !== name && !Object.hasOwn(key, normalized)) merged[normalized] = descriptor.value as ShikiLanguageSource;
    }
  }
  Object.freeze(merged);
  mergedByElementMap.set(key, { version, merged });
  return merged;
}

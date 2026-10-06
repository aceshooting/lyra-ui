import type { ReactiveElement } from 'lit';
import { warnDeprecatedUsage } from './dev-mode-attribute-warning.js';

/** Converts one side of a deprecated alias pair into the other side's value. */
export type LyraAliasMapping = (value: unknown) => unknown;

/**
 * A component's deprecated property aliases, keyed by the deprecated property name. The value is
 * the canonical property name, or a tuple of the canonical name, the alias-to-canonical mapping
 * and the canonical-to-alias mapping (both default to the identity).
 *
 * Both sides stay ordinary reactive properties with their own attribute, converter and reflection,
 * so a deprecated name keeps its exact public shape until it is removed. {@link LyraElement} keeps
 * each pair in step on every property write -- the last write wins -- and warns once in development
 * when author code writes the deprecated side.
 */
export type LyraDeprecatedAliases = Readonly<
  Record<string, string | readonly [canonical: string, toCanonical?: LyraAliasMapping, toAlias?: LyraAliasMapping]>
>;

/** Mapping for an inverted boolean pair (`closable` versus `without-close-button`). */
export const invertAlias: LyraAliasMapping = (value) => !value;

interface AliasLink {
  readonly partner: string;
  readonly map: LyraAliasMapping | undefined;
  readonly deprecated: boolean;
}

type AliasHost = ReactiveElement & Record<string, unknown>;
type AliasConstructor = typeof ReactiveElement & { deprecatedAliases?: LyraDeprecatedAliases };

const linkCache = new WeakMap<object, Map<string, AliasLink[]>>();
const syncing = new WeakSet<object>();

function linksFor(ctor: AliasConstructor): Map<string, AliasLink[]> {
  let links = linkCache.get(ctor);
  if (links) return links;
  links = new Map();
  const add = (name: string, link: AliasLink): void => {
    const list = links!.get(name);
    if (list) list.push(link);
    else links!.set(name, [link]);
  };
  const seen = new Set<string>();
  for (let current: unknown = ctor; current; current = Object.getPrototypeOf(current)) {
    if (!Object.hasOwn(current as object, 'deprecatedAliases')) continue;
    const table = (current as AliasConstructor).deprecatedAliases ?? {};
    for (const [alias, entry] of Object.entries(table)) {
      if (seen.has(alias)) continue;
      seen.add(alias);
      const [canonical, toCanonical, toAlias] = typeof entry === 'string' ? [entry] : entry;
      add(alias, { partner: canonical, map: toCanonical, deprecated: true });
      add(canonical, { partner: alias, map: toAlias, deprecated: false });
    }
  }
  linkCache.set(ctor, links);
  return links;
}

function attributeName(ctor: AliasConstructor, property: string): string {
  const attribute = ctor.elementProperties.get(property)?.attribute;
  return typeof attribute === 'string' ? attribute : attribute === false ? property : property.toLowerCase();
}

/**
 * Keeps a written alias or canonical property in step with its partners. Called from
 * `LyraElement.requestUpdate()` for every changed reactive property. A field initializer (old
 * value `undefined` before the first update) or a write made by this sync never warns.
 */
export function syncDeprecatedAlias(host: AliasHost, name: PropertyKey | undefined, oldValue: unknown): void {
  if (typeof name !== 'string') return;
  const ctor = host.constructor as AliasConstructor;
  // Nearly every class declares no aliases: test that before touching the shared WeakSet.
  if (!ctor.deprecatedAliases || syncing.has(host)) return;
  const links = linksFor(ctor);
  const own = links.get(name);
  const value = host[name];
  if (!own || Object.is(value, oldValue)) return;
  const assign = (property: string, next: unknown): void => {
    if (!Object.is(host[property], next)) host[property] = next;
  };
  syncing.add(host);
  try {
    for (const link of own) {
      if (!link.deprecated) {
        assign(link.partner, link.map ? link.map(value) : value);
        continue;
      }
      if (!(oldValue === undefined && !host.hasUpdated)) {
        warnDeprecatedUsage(host, 'property', name, attributeName(ctor, link.partner));
      }
      assign(link.partner, link.map ? link.map(value) : value);
      // The canonical property's other aliases follow it.
      const canonical = host[link.partner];
      for (const sibling of links.get(link.partner) ?? []) {
        if (sibling.partner !== name) assign(sibling.partner, sibling.map ? sibling.map(canonical) : canonical);
      }
    }
  } finally {
    syncing.delete(host);
  }
}

/** The deprecated alias property that `attribute` sets on `host`, if any. */
export function deprecatedAliasForAttribute(host: ReactiveElement, attribute: string): string | undefined {
  const ctor = host.constructor as AliasConstructor;
  if (!ctor.deprecatedAliases) return undefined;
  for (const [property, links] of linksFor(ctor)) {
    if (links.some((link) => link.deprecated) && attributeName(ctor, property) === attribute) return property;
  }
  return undefined;
}

/**
 * Warns when an authored attribute changed a deprecated alias property. Covers the one case the
 * write path cannot tell from a field initializer: an alias whose default is `undefined`, written
 * by markup before the first update. Reflection never changes the property, so it never warns.
 */
export function warnAuthoredAliasAttribute(host: ReactiveElement, alias: string, before: unknown): void {
  const record = host as AliasHost;
  if (Object.is(before, record[alias])) return;
  const ctor = host.constructor as AliasConstructor;
  const canonical = linksFor(ctor).get(alias)?.find((link) => link.deprecated)?.partner;
  if (canonical) warnDeprecatedUsage(host, 'property', alias, attributeName(ctor, canonical));
}


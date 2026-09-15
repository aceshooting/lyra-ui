#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

// Builds `src/testing/lyra-tag-event-map.ts` — the tag-keyed event registry
// `src/testing/event-factory.ts`'s `createLyraEvent()` validates against.
//
// This is deliberately NOT part of the `pnpm run events` pipeline (`generate-event-types.mjs`,
// which owns `src/events.ts`): that file is keyed by EVENT NAME (a union across every component
// that dispatches it), which is the right shape for `element.addEventListener()` but the wrong
// shape for constructing one specific component's event, where the detail shape depends on which
// TAG is asking. Re-running `pnpm run events` never touches this file or vice versa.
//
// Two facts, from two different already-existing analyses, neither reimplemented here:
//   * The TYPE side (tag -> its own `Lyra*EventMap` interface) reuses `collectEventMaps()`
//     (`generate-event-types.mjs`) plus the manifest's `superclass` chain, for the handful of
//     tags (chart variants, `lr-radio-button`, `lr-drawer`, ...) that inherit their event map
//     from a base class without redeclaring it.
//   * The RUNTIME side (which of those events are `cancelable`) reuses
//     `eventCancelabilityFromDescription()` (`component-inventory.mjs`) against the manifest's
//     own authored event descriptions — the same text `check-event-contracts.mjs` already
//     cross-checks against every component's real `this.emit()` call sites, so it is accurate
//     even for an event a component only forwards from a composed child (`lr-agent-trace`'s
//     `lr-span-toggle`, actually dispatched by `lr-trace-tree`) or re-derives dynamically at
//     runtime. A per-file source scan of `this.emit()` calls (also available via
//     `check-event-contracts.mjs`'s `runtimeEventCancelabilityFromSource()`) was tried first and
//     rejected: over a fifth of the library's events are declared in one file but actually
//     dispatched from another, which that function does not follow.
//
// Scope: only `lr-*`-named members. The handful of native-named re-emits a few form controls
// list in their own event map (`input`, `change`, `blur`, `focus`, ...) already have real DOM
// event types and dispatch semantics of their own (see `docs/agents/form-controls.md`) that this
// factory does not model; `event-factory.ts`'s `Name` type parameter filters to `lr-${string}`
// regardless of what this file emits, so listing them here would be inert, not wrong.

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { collectEventMaps } from './generate-event-types.mjs';
import { eventCancelabilityFromDescription } from './component-inventory.mjs';
import { expandManifestInheritance } from './manifest-compact.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestFile = path.join(packageDir, 'custom-elements.json');
const outputFile = path.join(packageDir, 'src', 'testing', 'lyra-tag-event-map.ts');

const byLocale = (a, b) => a.localeCompare(b);

function readManifest() {
  return JSON.parse(readFileSync(manifestFile, 'utf8'));
}

// `collectEventMaps()`'s specifiers are relative to `src/`, correct for a file living directly
// there (like `src/events.ts`). This generator's own output lives one directory deeper, under
// `src/testing/`, so every specifier needs the same `../` prefix instead.
function specifierFromTesting(specifier) {
  return specifier.replace(/^\.\//, '../');
}

/**
 * tag -> the `Lyra*EventMap` interface that governs it: either the one declared directly on its
 * own class, or (for a tag whose class inherits its event map without redeclaring it) the nearest
 * ancestor's, walked through the manifest's own `superclass` chain.
 */
function resolveTagEventMaps({ manifest, maps }) {
  const mapByClassName = new Map(maps.map((map) => [map.name.slice(0, -'EventMap'.length), map]));
  const superclassByClassName = new Map();
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.superclass) {
        superclassByClassName.set(declaration.name, declaration.superclass.name);
      }
    }
  }

  const expanded = expandManifestInheritance(manifest);
  const tagByClassName = new Map();
  for (const module of expanded.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.customElement && declaration.tagName) {
        tagByClassName.set(declaration.name, declaration.tagName);
      }
    }
  }

  const resolved = new Map();
  for (const [className, tag] of tagByClassName) {
    let current = className;
    const seen = new Set();
    while (current && !mapByClassName.has(current)) {
      if (seen.has(current)) {
        current = undefined;
        break;
      }
      seen.add(current);
      current = superclassByClassName.get(current);
    }
    if (current) resolved.set(tag, mapByClassName.get(current));
  }
  return resolved;
}

/** tag -> event name -> observed `cancelable`, `lr-*` events only, from the manifest's own prose. */
function resolveTagCancelability(manifest) {
  const expanded = expandManifestInheritance(manifest);
  const result = new Map();
  for (const module of expanded.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (!declaration.customElement || !declaration.tagName) continue;
      const events = (declaration.events ?? []).filter((event) => event.name.startsWith('lr-'));
      if (events.length === 0) continue;
      const byName = new Map();
      for (const event of events) {
        const cancelability = eventCancelabilityFromDescription(event.description, 'lyra', event.name);
        byName.set(event.name, cancelability !== 'never');
      }
      result.set(declaration.tagName, byName);
    }
  }
  return result;
}

export function buildRegistrySource() {
  const manifest = readManifest();
  // Deleted first (rather than merely overwritten) so a stale previous run's imports can never
  // leak into the freshly computed set below, whatever this generator's output shape becomes.
  // `LyraTagEventTypes` itself deliberately does NOT end in the literal `EventMap` suffix
  // `collectEventMaps()` scans for (see the file header): if it did, this generator's own output
  // would register itself as a fake component event map on every run after the first, and worse,
  // `generate-event-types.mjs` would pick up the same false match the next time `pnpm run events`
  // regenerates `src/events.ts`.
  if (existsSync(outputFile)) unlinkSync(outputFile);
  const maps = collectEventMaps();
  const tagEventMaps = resolveTagEventMaps({ manifest, maps });
  const tagCancelability = resolveTagCancelability(manifest);

  const tags = [...tagEventMaps.keys()].sort(byLocale);
  const usedMaps = [...new Set(tags.map((tag) => tagEventMaps.get(tag)))].sort(
    (a, b) => byLocale(a.specifier, b.specifier) || byLocale(a.name, b.name),
  );
  const importsBySpecifier = new Map();
  for (const map of usedMaps) {
    const specifier = specifierFromTesting(map.specifier);
    if (!importsBySpecifier.has(specifier)) importsBySpecifier.set(specifier, []);
    importsBySpecifier.get(specifier).push(map.name);
  }

  const lines = [];
  lines.push(
    '// GENERATED FILE — do not edit by hand.',
    '// Regenerate with `node scripts/build-testing-event-registry.mjs` (repo root: packages/lyra-ui)',
    '// after adding, renaming or re-scoping a component event; `event-factory.test.ts` does not',
    '// gate freshness automatically, so re-run this after any `Lyra*EventMap` change reachable from',
    '// `createLyraEvent()`.',
    '// Consumed by `event-factory.ts` — see that file, and this generator\'s own header comment,',
    '// for what the two exports below mean and where each one\'s data comes from.',
    '',
  );

  for (const [specifier, names] of [...importsBySpecifier].sort(([a], [b]) => byLocale(a, b))) {
    const sortedNames = [...names].sort(byLocale);
    lines.push(`import type { ${sortedNames.join(', ')} } from '${specifier}';`);
  }
  lines.push('');

  lines.push(
    '/** Every `lr-*` custom element tag with at least one documented event, mapped to the',
    " * `Lyra*EventMap` interface that types it -- its own class's, or (for a tag that inherits its",
    ' * event map without redeclaring it) the nearest ancestor\'s that does. Consumed only by',
    " * `createLyraEvent()`'s generic parameters; never imported for its runtime value. */",
    'export interface LyraTagEventTypes {',
  );
  for (const tag of tags) {
    lines.push(`  '${tag}': ${tagEventMaps.get(tag).name};`);
  }
  lines.push('}', '');

  lines.push(
    '/** tag -> event name -> whether that component\'s own `this.emit()` call site passes',
    ' * `{ cancelable: true }`, derived from the same authored event descriptions',
    ' * `check-event-contracts.mjs` already cross-checks against real dispatch call sites.',
    ' * Absent entries (an unlisted tag, or an unlisted event on a listed tag) are never cancelable. */',
    'export const LYRA_EVENT_CANCELABLE: {',
    '  readonly [tag: string]: { readonly [name: string]: boolean } | undefined;',
    '} = {',
  );
  for (const tag of tags) {
    const byName = tagCancelability.get(tag);
    if (!byName) continue;
    const entries = [...byName]
      .filter(([, cancelable]) => cancelable)
      .sort(([a], [b]) => byLocale(a, b));
    if (entries.length === 0) continue;
    const fields = entries.map(([name]) => `'${name}': true`).join(', ');
    lines.push(`  '${tag}': { ${fields} },`);
  }
  lines.push('};', '');

  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

function main() {
  const text = buildRegistrySource();
  writeFileSync(outputFile, text);
  const tagCount = text.match(/^  '[^']+': Lyra/gm)?.length ?? 0;
  console.log(
    `Wrote ${path.relative(packageDir, outputFile)} (${tagCount} tags, ${text.split('\n').length} lines).`,
  );
}

if (isMainModule(import.meta.url)) {
  main();
}

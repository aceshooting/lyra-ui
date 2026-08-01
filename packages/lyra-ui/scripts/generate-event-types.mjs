#!/usr/bin/env node

// Generates `src/events.ts` — the package's global typed-event surface.
//
// Why generated rather than authored: the library dispatches hundreds of events across ~200
// components, and a hand-maintained global map would drift on the first component that renamed a
// detail field. Everything here is derived from two artifacts that already exist and are already
// gated:
//
//   * the per-component `export interface Lyra*EventMap` declarations (checked for reachability by
//     `check-event-barrel.mjs` and for parity with the JSDoc/manifest/docs by
//     `check-event-contracts.mjs`) — these carry the real TypeScript detail types, so they stay
//     the precise, per-element source of truth and are referenced by indexed access rather than
//     copied;
//   * `custom-elements.json` — the tag inventory. It supplies the `<lr-*>` names quoted in the
//     generated doc comments and acts as the completeness cross-check: every element event the
//     manifest advertises must be typed here, or generation fails.
//
// The output is deterministic (stable sort order, no timestamps, no absolute paths) so
// `check-event-types.mjs` can regenerate it in memory and diff.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceDir = path.join(packageDir, 'src');
const outputFile = path.join(sourceDir, 'events.ts');
const manifestFile = path.join(packageDir, 'custom-elements.json');
const prefixFile = path.join(sourceDir, 'internal', 'prefix.ts');

const EVENT_MAP_NAME_RE = /^Lyra\w*EventMap$/;
const DOC_WIDTH = 96;

const byLocale = (a, b) => a.localeCompare(b);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

// The generated file itself lives under src/ and declares `LyraGlobalEventMap`, which matches the
// same naming convention this script scans for — reading it back would fold the previous run's
// output into the next one and grow the file on every regeneration (i.e. destroy determinism).
const isShippedSource = (file) =>
  file !== outputFile &&
  file.endsWith('.ts') &&
  !file.endsWith('.test.ts') &&
  !file.endsWith('.stories.ts') &&
  !file.endsWith('.d.ts');

/**
 * The tag prefix is a single constant in `src/internal/prefix.ts`; read it rather than hard-coding
 * it, so a rename regenerates a correct file instead of silently producing a dead map. (The
 * generated output naturally contains the literal event names — that is the point of it.)
 */
function readTagPrefix() {
  const source = readFileSync(prefixFile, 'utf8');
  const match = source.match(/export const LYRA_PREFIX\s*=\s*'([^']+)'/);
  if (!match) {
    throw new Error(
      'src/internal/prefix.ts no longer declares `export const LYRA_PREFIX = \'…\'`; ' +
        'update scripts/generate-event-types.mjs to read the tag prefix from its new home.',
    );
  }
  return match[1];
}

function propertyKey(node) {
  if (!node) return undefined;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'Identifier') return node.name;
  return undefined;
}

function moduleSpecifier(file) {
  const relative = path.relative(sourceDir, file).replaceAll(path.sep, '/');
  return `./${relative.replace(/\.ts$/, '.js')}`;
}

/**
 * Every exported `Lyra*EventMap` interface in the shipped source, with the event names it declares
 * *directly*. Inherited members are deliberately not resolved: an inherited name is declared
 * directly by the base interface, which this scan visits in its own right, so the union assembled
 * per event name already covers it — without this script needing to re-implement the heritage
 * resolution (`extends` / `Omit` / `Pick`) that `check-event-contracts.mjs` owns.
 */
function collectEventMaps() {
  const maps = [];
  for (const file of walk(sourceDir).filter(isShippedSource).sort(byLocale)) {
    const source = readFileSync(file, 'utf8');
    if (!/export\s+interface\s+Lyra\w*EventMap\b/.test(source)) continue;

    const parsed = parseSync(file, source);
    if (parsed.errors.length > 0) {
      const details = parsed.errors.map((error) => error.message ?? String(error)).join('\n');
      throw new SyntaxError(`${path.relative(packageDir, file)} could not be parsed:\n${details}`);
    }

    for (const statement of parsed.program.body) {
      if (statement.type !== 'ExportNamedDeclaration') continue;
      const declaration = statement.declaration;
      if (declaration?.type !== 'TSInterfaceDeclaration') continue;
      const name = declaration.id.name;
      if (!EVENT_MAP_NAME_RE.test(name)) continue;

      const events = [];
      for (const member of declaration.body.body) {
        if (member.type !== 'TSPropertySignature') continue;
        const key = propertyKey(member.key);
        if (key !== undefined) events.push(key);
      }
      maps.push({ name, specifier: moduleSpecifier(file), events });
    }
  }

  const duplicates = maps
    .map(({ name }) => name)
    .filter((name, index, names) => names.indexOf(name) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `event-map interface name declared in more than one module: ${[...new Set(duplicates)].sort(byLocale).join(', ')}`,
    );
  }
  return maps;
}

/** Tag names and advertised event names, keyed by the declaring class name. */
function readManifest() {
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const tagByClassName = new Map();
  const manifestEvents = new Set();
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (!declaration.customElement || !declaration.tagName) continue;
      tagByClassName.set(declaration.name, declaration.tagName);
      for (const event of declaration.events ?? []) manifestEvents.add(event.name);
    }
  }
  return { tagByClassName, manifestEvents };
}

function aliasTypeName(eventName, prefix) {
  const segments = eventName.slice(prefix.length + 1).split('-');
  if (segments.some((segment) => segment === '')) {
    throw new Error(`event name ${JSON.stringify(eventName)} has an empty name segment`);
  }
  const pascal = segments.map((segment) => segment[0].toUpperCase() + segment.slice(1)).join('');
  return `Lyra${pascal}Event`;
}

/** Greedy fixed-width wrap so a long emitter list stays deterministic and readable. */
function wrap(text, width) {
  const lines = [];
  let current = '';
  for (const word of text.split(' ')) {
    if (current === '') current = word;
    else if (`${current} ${word}`.length <= width) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

function docComment(paragraphs, indent = '') {
  const lines = [`${indent}/**`];
  paragraphs.forEach((paragraph, index) => {
    if (index > 0) lines.push(`${indent} *`);
    for (const line of wrap(paragraph, DOC_WIDTH)) lines.push(`${indent} * ${line}`);
  });
  lines.push(`${indent} */`);
  return lines;
}

export function generate({ write = true } = {}) {
  const prefix = readTagPrefix();
  const eventPrefix = `${prefix}-`;
  const maps = collectEventMaps();
  const { tagByClassName, manifestEvents } = readManifest();

  const mapByName = new Map(maps.map((map) => [map.name, map]));

  /** event name -> declaring event-map interface names (sorted). */
  const declarers = new Map();
  const nativeEventNames = new Set();
  for (const map of maps) {
    for (const event of map.events) {
      if (!event.startsWith(eventPrefix)) {
        nativeEventNames.add(event);
        continue;
      }
      if (!declarers.has(event)) declarers.set(event, new Set());
      declarers.get(event).add(map.name);
    }
  }

  // A manifest event this file cannot type is a real hole in the surface, not a formatting nit.
  const untyped = [...manifestEvents]
    .filter((event) => event.startsWith(eventPrefix) && !declarers.has(event))
    .sort(byLocale);
  if (untyped.length > 0) {
    throw new Error(
      `custom-elements.json advertises ${untyped.length} event(s) that no Lyra*EventMap declares: ` +
        `${untyped.join(', ')}. Add them to the owning component's event map first ` +
        '(`pnpm run check:event-contracts` explains where).',
    );
  }

  const labelFor = (mapName) => {
    const className = mapName.slice(0, -'EventMap'.length);
    const tag = tagByClassName.get(className);
    return tag ? `\`<${tag}>\`` : `\`${mapName}\``;
  };

  const eventNames = [...declarers.keys()].sort(byLocale);
  const entries = eventNames.map((event) => {
    const owners = [...declarers.get(event)].sort(byLocale);
    const alias = aliasTypeName(event, prefix);
    const labels = [...new Set(owners.map(labelFor))].sort(byLocale);
    return { event, owners, alias, labels };
  });

  const aliasDuplicates = entries
    .map(({ alias }) => alias)
    .filter((alias, index, all) => all.indexOf(alias) !== index);
  if (aliasDuplicates.length > 0) {
    throw new Error(
      `two event names collapse to the same alias type: ${[...new Set(aliasDuplicates)].sort(byLocale).join(', ')}`,
    );
  }

  // Only interfaces that actually contribute a prefixed event get imported — an unused import
  // would fail `noUnusedLocals`.
  const usedMaps = [...new Set(entries.flatMap(({ owners }) => owners))]
    .map((name) => mapByName.get(name))
    .sort((a, b) => byLocale(a.specifier, b.specifier) || byLocale(a.name, b.name));
  const importsBySpecifier = new Map();
  for (const map of usedMaps) {
    if (!importsBySpecifier.has(map.specifier)) importsBySpecifier.set(map.specifier, []);
    importsBySpecifier.get(map.specifier).push(map.name);
  }

  // Only the four-line banner is a leading `//` comment: those survive into the emitted `.js`.
  // Everything else is a doc comment on a type declaration, which is erased with the declaration,
  // keeping the compiled module down to `export {};`.
  const lines = [];
  lines.push(
    '// GENERATED FILE — do not edit by hand. Global typed-event surface for this library.',
    '// Regenerate with `pnpm --filter @aceshooting/lyra-ui run events`',
    '// (`node scripts/generate-event-types.mjs`); `scripts/check-event-types.mjs` gates freshness.',
    '// Types only — this module compiles to `export {};` and costs zero runtime bytes.',
    '',
  );

  for (const [specifier, names] of [...importsBySpecifier].sort(([a], [b]) => byLocale(a, b))) {
    const sortedNames = [...names].sort(byLocale);
    const single = `import type { ${sortedNames.join(', ')} } from '${specifier}';`;
    // A one-name import always stays on one line: breaking it buys no width back, since the
    // module specifier is what makes these lines long.
    if (sortedNames.length === 1 || single.length <= 110) {
      lines.push(single);
      continue;
    }
    lines.push('import type {');
    for (const name of sortedNames) lines.push(`  ${name},`);
    lines.push(`} from '${specifier}';`);
  }
  lines.push('');

  for (const { event, alias, labels, owners } of entries) {
    const emitters =
      labels.length === 1
        ? `dispatched by ${labels[0]}.`
        : `dispatched by ${labels.length} components: ${labels.join(', ')}.`;
    const paragraphs = [`\`${event}\` — ${emitters}`];
    if (owners.length === 1) {
      paragraphs.push(`Detail type: \`${owners[0]}['${event}']\`.`);
    } else {
      paragraphs.push(
        `A union of ${owners.length} component entries, so \`event.detail\` here exposes only what all ` +
          `of them share. For one component's exact detail, index its own map — e.g. ` +
          `\`${owners[0]}['${event}']\`.`,
      );
    }
    lines.push(...docComment(paragraphs));
    if (owners.length === 1) {
      lines.push(`export type ${alias} = ${owners[0]}['${event}'];`);
    } else {
      lines.push(`export type ${alias} =`);
      owners.forEach((owner, index) => {
        lines.push(`  | ${owner}['${event}']${index === owners.length - 1 ? ';' : ''}`);
      });
    }
    lines.push('');
  }

  lines.push(
    ...docComment([
      `Every \`${eventPrefix}*\` event this library dispatches, keyed by event name. Mixed into the global ` +
        'event maps below; also exported so an application can write its own typed helper — e.g. ' +
        '`function on<K extends keyof LyraGlobalEventMap>(target: EventTarget, type: K, listener: ' +
        '(event: LyraGlobalEventMap[K]) => void)`.',
      'Component events bubble and are `composed: true`, so they reach ancestors, `document`, and ' +
        '`window` — but a listener attached there has no element type to key off and would otherwise ' +
        'receive a bare `Event`. Augmenting `GlobalEventHandlersEventMap` types all of those in one ' +
        'place.',
      'The per-component `Lyra*EventMap` interfaces stay the precise source of truth, and are ' +
        'referenced by indexed access here rather than copied. A lyra element reference resolves its ' +
        'own map first (`LyraElement` overrides `addEventListener`), so ' +
        "`tabGroup.addEventListener('lr-tab-show', …)` is typed by `LyraTabGroupEventMap` and is " +
        'unaffected by anything here. This global map is the fallback for a delegating ancestor, ' +
        '`document`/`window`, or an untyped `HTMLElement` handle — and because one event name can be ' +
        'dispatched by several components with different details, each entry is the *union* of those ' +
        "components' own entries.",
      `Native-named events some form controls re-emit (${[...nativeEventNames]
        .sort(byLocale)
        .map((name) => `\`${name}\``)
        .join(', ')}) are intentionally absent: they already exist in the DOM's own event maps with ` +
        'their standard types, and redeclaring them globally would either conflict or widen a ' +
        'built-in. Those stay typed per component through the component\'s own event map.',
    ]),
    'export interface LyraGlobalEventMap {',
  );
  for (const { event, alias } of entries) lines.push(`  '${event}': ${alias};`);
  lines.push('}', '');

  lines.push('declare global {');
  lines.push(
    ...docComment(
      [
        'Extended rather than re-declared member by member so `LyraGlobalEventMap` remains the one ' +
          'definition. `HTMLElementEventMap`, `DocumentEventMap`, `WindowEventMap`, and ' +
          '`SVGElementEventMap` all extend this interface, so a single augmentation types ' +
          '`element.addEventListener`, `document.addEventListener`, and `window.addEventListener` alike.',
      ],
      '  ',
    ),
  );
  lines.push('  interface GlobalEventHandlersEventMap extends LyraGlobalEventMap {}');
  lines.push('}', '');

  const text = `${lines.join('\n').replace(/\n+$/, '')}\n`;
  const output = new Map([[outputFile, text]]);
  if (write) {
    for (const [file, contents] of output) writeFileSync(file, contents);
  }
  return output;
}

function main() {
  const output = generate({ write: true });
  const [[file, text]] = [...output];
  const eventCount = text.match(/^  '/gm)?.length ?? 0;
  console.log(
    `Wrote ${path.relative(packageDir, file)} (${eventCount} events, ${text.split('\n').length} lines).`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

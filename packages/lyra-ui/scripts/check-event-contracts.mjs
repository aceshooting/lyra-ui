#!/usr/bin/env node

// Keeps the four public event-name surfaces synchronized:
//   * a component's EventMap type,
//   * the class JSDoc that feeds the manifest,
//   * custom-elements.json,
//   * and the authored llms/<family>.md Events contract.
//
// This script only compares those four surfaces to each other, so all four could once agree while
// disagreeing with the code that actually dispatches: `emit()` took a bare `string` name and an
// unconstrained detail. That fifth surface is now gated by the type system instead —
// `LyraElement.emit()` is keyed by the component's own EventMap (see `LyraEmitArgs` in
// `src/internal/lyra-element.ts`, asserted by `type-tests/emit.ts`), so a name or detail that this
// script would call undeclared fails `tsc` first. A component that declares no EventMap keeps the
// permissive default and is checked here only.
//
// Interface inheritance is intentionally asymmetric. Events declared directly by a component's
// own EventMap must be advertised by that component. Inherited mixin events may instead be
// documented once as a shared contract, but any event a component does advertise still has to be
// present in its effective (inherited) EventMap. Ordinary subclass aliases inherit both the base
// class JSDoc and EventMap so their CEM surface remains checkable without duplicating @event tags.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EVENT_NAME_RE = /^(?:lr-[a-z0-9]+(?:-[a-z0-9]+)*|beforeinput|input|change|focus|blur|ended|error|load|loadedmetadata|pause|play|request|timeupdate|volumechange)$/;

const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
const setDifference = (left, right) => sorted(left).filter((value) => !right.has(value));

function jsDocBlocks(source) {
  return [...source.matchAll(/\/\*\*[\s\S]*?\*\//g)].map((match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function eventNamesFromJsDocBlock(block) {
  const events = new Set();
  for (const match of block.matchAll(/^\s*\*\s*@event\s+(.+)$/gm)) {
    let declaration = match[1].trim();
    if (declaration.startsWith('{')) {
      let depth = 0;
      let end = -1;
      for (let index = 0; index < declaration.length; index += 1) {
        if (declaration[index] === '{') depth += 1;
        else if (declaration[index] === '}' && --depth === 0) {
          end = index;
          break;
        }
      }
      if (end >= 0) declaration = declaration.slice(end + 1).trim();
    }
    const name = declaration.match(/^([a-z][a-z0-9-]*)\b/)?.[1];
    if (name && EVENT_NAME_RE.test(name)) events.add(name);
  }
  return events;
}

/**
 * Returns the @event names on the JSDoc block for one custom element tag.
 */
export function eventNamesFromComponentJsDoc(source, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const customElement = new RegExp(`@customElement\\s+${escaped}(?:\\s|\\*|$)`);
  const block = jsDocBlocks(source).find(({ text }) => customElement.test(text));
  return block ? eventNamesFromJsDocBlock(block.text) : new Set();
}

function maskFencedCode(text) {
  let fenceCharacter;
  let fenceLength = 0;

  return text
    .split('\n')
    .map((line) => {
      const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1];
      if (!fenceCharacter) {
        if (!marker) return line;
        fenceCharacter = marker[0];
        fenceLength = marker.length;
        return ' '.repeat(line.length);
      }

      const trimmed = line.trimStart();
      const run = trimmed.match(fenceCharacter === '`' ? /^`+/ : /^~+/)?.[0];
      if (
        run &&
        run.length >= fenceLength &&
        trimmed.slice(run.length).trim() === ''
      ) {
        fenceCharacter = undefined;
        fenceLength = 0;
      }
      return ' '.repeat(line.length);
    })
    .join('\n');
}

function codeSpans(text) {
  const source = maskFencedCode(text);
  const spans = [];
  const isEscaped = (index) => {
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) {
      slashes += 1;
    }
    return slashes % 2 === 1;
  };

  for (let start = 0; start < source.length; start += 1) {
    if (source[start] !== '`' || isEscaped(start)) continue;
    let openerEnd = start + 1;
    while (source[openerEnd] === '`') openerEnd += 1;
    const delimiterLength = openerEnd - start;

    for (let cursor = openerEnd; cursor < source.length; cursor += 1) {
      if (source[cursor] !== '`' || isEscaped(cursor)) continue;
      let closerEnd = cursor + 1;
      while (source[closerEnd] === '`') closerEnd += 1;
      if (closerEnd - cursor !== delimiterLength) {
        cursor = closerEnd - 1;
        continue;
      }

      let value = source.slice(openerEnd, cursor).replace(/\r?\n/g, ' ');
      if (
        value.startsWith(' ') &&
        value.endsWith(' ') &&
        value.trim().length > 0
      ) {
        value = value.slice(1, -1);
      }
      spans.push({ value: value.trim(), start });
      start = closerEnd - 1;
      break;
    }
  }

  return spans;
}

function eventNamesFromCodeSpans(text) {
  const events = new Set();
  for (const span of codeSpans(text)) {
    const candidate = span.value;
    if (EVENT_NAME_RE.test(candidate)) events.add(candidate);
  }
  return events;
}

function declaredEventNamesFromBlock(text) {
  const events = new Set();
  const firstContentOffset = text.search(/\S/);
  let continuationOpen = false;
  let sawEventLikeSpan = false;
  for (const span of codeSpans(text)) {
    const candidate = span.value;
    if (!EVENT_NAME_RE.test(candidate)) continue;
    const startsEventList = !sawEventLikeSpan;
    sawEventLikeSpan = true;
    const lineStart = text.lastIndexOf('\n', span.start - 1) + 1;
    const before = text.slice(lineStart, span.start);
    const previousLines = text.slice(0, lineStart).trimEnd();
    const previousLine = previousLines.slice(previousLines.lastIndexOf('\n') + 1);
    const startsBlock = before.trim() === '' && span.start === firstContentOffset;
    const startsListOrTableRow = /^\s*[-|]\s*$/.test(before);
    const continuesWrappedList =
      continuationOpen &&
      before.trim() === '' &&
      /(?:[,;:/]|\b(?:and|or|plus|then))\s*$/.test(previousLine);
    const continuesInlineList =
      continuationOpen &&
      /(?:[,;:/.]\s*|\b(?:and|or|plus|then)\s+)$/.test(before);
    if (
      startsEventList ||
      startsBlock ||
      startsListOrTableRow ||
      continuesWrappedList ||
      continuesInlineList
    ) {
      events.add(candidate);
      continuationOpen = true;
    } else {
      // An event-shaped code span in explanatory prose (often an `lr-*` child tag) ends the
      // declaration chain. A later "or `lr-*`" in that prose must not become a phantom event.
      continuationOpen = false;
    }
  }
  return events;
}

/**
 * Extracts the Markdown bodies of explicit authored Events blocks. Names elsewhere in a component
 * section can be tags, properties, slots, examples, or prose and do not satisfy this contract.
 */
function authoredEventBlocks(sectionText) {
  const lines = sectionText.split('\n');
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = line.match(/^(\s*)(#{3,6})\s+Events\s*$/i);
    const inline = line.match(/\*\*Events:\*\*/i);
    if (!heading && !inline) continue;

    const collected = [];
    if (inline) {
      const afterLabel = line.slice(inline.index + inline[0].length);
      if (/^\s*none\b/i.test(afterLabel)) continue;
      collected.push(afterLabel);
    }

    const headingDepth = heading?.[2].length;
    let sawContent = collected.some((value) => value.trim() !== '');
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = lines[cursor];
      if (next.trim() === '') {
        if (sawContent) break;
        collected.push(next);
        continue;
      }
      const nextHeading = next.match(/^\s*(#{2,6})\s+/);
      if (nextHeading && (!headingDepth || nextHeading[1].length <= headingDepth)) break;

      const nextApiLabel = next.match(/^\s*\*\*([^*]+):\*\*/);
      if (nextApiLabel && !/^Events$/i.test(nextApiLabel[1].trim())) break;

      // A compact authored section can put the next API label on the same line. Keep only the
      // event-side prefix in that case.
      const laterApiLabel = next.match(/\s+\*\*[^*]+:\*\*/);
      if (laterApiLabel) {
        collected.push(next.slice(0, laterApiLabel.index));
        break;
      }
      collected.push(next);
      sawContent = true;
    }
    blocks.push(collected.join('\n'));
  }
  return blocks;
}

export function eventNamesFromAuthoredSection(sectionText) {
  const events = new Set();
  for (const block of authoredEventBlocks(sectionText)) {
    for (const event of declaredEventNamesFromBlock(block)) events.add(event);
  }
  return events;
}

function mentionedEventNamesFromAuthoredSection(sectionText) {
  const events = new Set();
  for (const block of authoredEventBlocks(sectionText)) {
    for (const event of eventNamesFromCodeSpans(block)) events.add(event);
  }
  return events;
}

export function splitAuthoredEventSections(text, file = 'llms/family.md') {
  const lines = text.split('\n');
  const sections = [];
  let fenced = false;
  let current;

  for (const line of lines) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (!fenced && /^##\s+/.test(line)) {
      current = { file, title: line.replace(/^##\s+/, '').trim(), lines: [line], tags: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    current.lines.push(line);
    if (!fenced && /^#{3,6}\s+/.test(line)) {
      current.tags.push(...(line.match(/lr-[a-z0-9-]+/g) ?? []));
    }
  }

  return sections.map((section) => {
    const sectionText = section.lines.join('\n');
    return {
      file: section.file,
      title: section.title,
      tags: [
        ...new Set([
          ...(section.title.match(/lr-[a-z0-9-]+/g) ?? []),
          ...section.tags,
        ]),
      ],
      events: eventNamesFromAuthoredSection(sectionText),
      mentionedEvents: mentionedEventNamesFromAuthoredSection(sectionText),
    };
  });
}

function finding(code, event, message) {
  return { code, event, message };
}

/**
 * Pure set comparison used by both the repository scan and the fixture self-test.
 */
export function findEventContractDrift({ components, authoredSections }) {
  const findings = [];
  const byTag = new Map(components.map((component) => [component.tag, component]));

  for (const component of components) {
    const {
      tag,
      className,
      sourceFile,
      eventMapName,
      directEventMapEvents,
      effectiveEventMapEvents,
      jsdocEvents,
      cemEvents,
    } = component;
    const mapLabel = eventMapName ? `\`${eventMapName}\`` : `${className}'s effective EventMap`;

    for (const event of setDifference(directEventMapEvents, jsdocEvents)) {
      findings.push(
        finding(
          'eventmap-event-missing-jsdoc',
          event,
          `${sourceFile}: ${mapLabel} declares \`${event}\`, but ${tag}'s class JSDoc has no matching ` +
            `\`@event ${event}\`; update the JSDoc directly above \`${className}\`.`,
        ),
      );
    }
    for (const event of setDifference(directEventMapEvents, cemEvents)) {
      findings.push(
        finding(
          'eventmap-event-missing-cem',
          event,
          `${sourceFile}: ${mapLabel} declares \`${event}\`, but ${tag}'s custom-elements.json entry ` +
            'does not; align the class JSDoc, then run `pnpm manifest`.',
        ),
      );
    }
    for (const event of setDifference(jsdocEvents, effectiveEventMapEvents)) {
      findings.push(
        finding(
          'jsdoc-event-untyped',
          event,
          `${sourceFile}: ${tag}'s class JSDoc advertises \`${event}\`, but its effective EventMap ` +
            `does not; add the event to ${mapLabel} or remove the stale @event.`,
        ),
      );
    }
    for (const event of setDifference(cemEvents, effectiveEventMapEvents)) {
      findings.push(
        finding(
          'cem-event-untyped',
          event,
          `${sourceFile}: ${tag}'s custom-elements.json entry advertises \`${event}\`, but its ` +
            `effective EventMap does not; add the type or regenerate the manifest after correcting JSDoc.`,
        ),
      );
    }
    for (const event of setDifference(jsdocEvents, cemEvents)) {
      findings.push(
        finding(
          'jsdoc-event-missing-cem',
          event,
          `${sourceFile}: ${tag}'s class JSDoc declares \`${event}\`, but custom-elements.json does ` +
            'not; run `pnpm manifest` and commit the generated result.',
        ),
      );
    }
    for (const event of setDifference(cemEvents, jsdocEvents)) {
      findings.push(
        finding(
          'cem-event-missing-jsdoc',
          event,
          `${sourceFile}: ${tag}'s custom-elements.json entry declares \`${event}\`, but the ` +
            'effective class JSDoc does not; correct the source JSDoc or regenerate a stale manifest.',
        ),
      );
    }
  }

  const documentedTags = new Set();
  for (const section of authoredSections) {
    const sectionComponents = section.tags.map((tag) => byTag.get(tag)).filter(Boolean);
    if (sectionComponents.length === 0) continue;
    for (const component of sectionComponents) documentedTags.add(component.tag);

    const expected = new Set(
      sectionComponents.flatMap((component) => [...component.cemEvents]),
    );
    const mentionedEvents = section.mentionedEvents ?? section.events;
    for (const event of setDifference(expected, mentionedEvents)) {
      findings.push(
        finding(
          'cem-event-missing-authored',
          event,
          `${section.file} (${section.title}): custom-elements.json advertises \`${event}\`, but ` +
            'the authored Events contract does not; add it to this component section.',
        ),
      );
    }
    for (const event of setDifference(section.events, expected)) {
      findings.push(
        finding(
          'authored-event-missing-cem',
          event,
          `${section.file} (${section.title}): the authored Events contract advertises \`${event}\`, ` +
            'but no tag in this section exposes it in custom-elements.json; correct the prose or source contract.',
        ),
      );
    }
  }

  for (const component of components) {
    if (documentedTags.has(component.tag)) continue;
    for (const event of sorted(component.cemEvents)) {
      findings.push(
        finding(
          'cem-event-missing-authored',
          event,
          `${component.sourceFile}: ${component.tag} exposes \`${event}\`, but no authored component ` +
            'section covers that tag; add it to the matching llms/<family>.md file.',
        ),
      );
    }
  }

  return findings.sort(
    (a, b) =>
      a.message.localeCompare(b.message) ||
      a.code.localeCompare(b.code) ||
      a.event.localeCompare(b.event),
  );
}

function resolveImportFile(fromFile, specifier) {
  if (!specifier.startsWith('.')) return undefined;
  const base = path.resolve(path.dirname(fromFile), specifier.replace(/\.[cm]?[jt]s$/, ''));
  return [`${base}.ts`, path.join(base, 'index.ts')].find((candidate) => existsSync(candidate));
}

function propertyName(node) {
  if (!node) return undefined;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  return undefined;
}

function unwrapDeclaration(statement) {
  return statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
    ? statement.declaration
    : statement;
}

function parseModule(file) {
  const source = readFileSync(file, 'utf8');
  const parsed = parseSync(file, source);
  if (parsed.errors.length > 0) {
    const details = parsed.errors.map((error) => error.message ?? String(error)).join('\n');
    throw new SyntaxError(`${file} could not be parsed:\n${details}`);
  }

  const imports = new Map();
  const interfaces = new Map();
  const classes = new Map();
  for (const statement of parsed.program.body) {
    if (statement.type === 'ImportDeclaration') {
      const target = resolveImportFile(file, statement.source.value);
      if (!target) continue;
      for (const specifier of statement.specifiers) {
        if (specifier.type !== 'ImportSpecifier') continue;
        imports.set(specifier.local.name, {
          imported: propertyName(specifier.imported),
          file: target,
        });
      }
      continue;
    }

    const declaration = unwrapDeclaration(statement);
    if (declaration?.type === 'TSInterfaceDeclaration') {
      interfaces.set(declaration.id.name, declaration);
    } else if (declaration?.type === 'ClassDeclaration' && declaration.id) {
      classes.set(declaration.id.name, declaration);
    }
  }
  return { file, source, imports, interfaces, classes };
}

function moduleGraph() {
  const cache = new Map();
  return {
    get(file) {
      const absolute = path.resolve(file);
      if (!cache.has(absolute)) cache.set(absolute, parseModule(absolute));
      return cache.get(absolute);
    },
  };
}

function resolveNamedDeclaration(graph, module, localName, collection) {
  const local = module[collection].get(localName);
  if (local) return { module, declaration: local, name: localName };
  const imported = module.imports.get(localName);
  if (!imported?.file || !imported.imported) return undefined;
  const target = graph.get(imported.file);
  const declaration = target[collection].get(imported.imported);
  return declaration
    ? { module: target, declaration, name: imported.imported }
    : undefined;
}

function directInterfaceEvents(interfaceDeclaration) {
  const events = new Set();
  for (const member of interfaceDeclaration.body.body) {
    if (member.type !== 'TSPropertySignature') continue;
    const name = propertyName(member.key);
    if (name && EVENT_NAME_RE.test(name)) events.add(name);
  }
  return events;
}

function effectiveInterfaceEvents(graph, resolved, seen = new Set()) {
  const key = `${resolved.module.file}#${resolved.name}`;
  if (seen.has(key)) return new Set();
  seen.add(key);

  const events = directInterfaceEvents(resolved.declaration);
  for (const heritage of resolved.declaration.extends ?? []) {
    const parentName = propertyName(heritage.expression);
    if (!parentName) continue;
    if (parentName === 'Omit' || parentName === 'Pick') {
      const [baseType, keysType] = heritage.typeArguments?.params ?? [];
      const baseName =
        baseType?.type === 'TSTypeReference' && baseType.typeName?.type === 'Identifier'
          ? baseType.typeName.name
          : undefined;
      const base = baseName
        ? resolveNamedDeclaration(graph, resolved.module, baseName, 'interfaces')
        : undefined;
      if (!base) continue;
      const inherited = effectiveInterfaceEvents(graph, base, seen);
      const keys = new Set();
      const collectLiteralKeys = (node) => {
        if (node?.type === 'TSLiteralType' && typeof node.literal?.value === 'string') {
          keys.add(node.literal.value);
        } else if (node?.type === 'TSUnionType') {
          for (const type of node.types) collectLiteralKeys(type);
        }
      };
      collectLiteralKeys(keysType);
      for (const event of inherited) {
        if ((parentName === 'Omit' && !keys.has(event)) || (parentName === 'Pick' && keys.has(event))) {
          events.add(event);
        }
      }
      continue;
    }

    const parent = resolveNamedDeclaration(graph, resolved.module, parentName, 'interfaces');
    if (parent) {
      for (const event of effectiveInterfaceEvents(graph, parent, seen)) events.add(event);
    }
  }
  return events;
}

function resolveBaseClass(graph, module, classDeclaration) {
  if (classDeclaration.superClass?.type !== 'Identifier') return undefined;
  return resolveNamedDeclaration(
    graph,
    module,
    classDeclaration.superClass.name,
    'classes',
  );
}

function eventMapForClass(graph, module, classDeclaration, seen = new Set()) {
  const className = classDeclaration.id?.name;
  if (!className) return undefined;
  const key = `${module.file}#${className}`;
  if (seen.has(key)) return undefined;
  seen.add(key);

  const ownName = `${className}EventMap`;
  const own = resolveNamedDeclaration(graph, module, ownName, 'interfaces');
  // Only a same-module convention-named map counts as directly owned. An imported interface with
  // the same name is an inherited/shared type and must not force duplicate per-component docs.
  if (own && own.module.file === module.file) {
    return {
      name: ownName,
      direct: directInterfaceEvents(own.declaration),
      effective: effectiveInterfaceEvents(graph, own),
    };
  }

  const typeArgument = classDeclaration.superTypeArguments?.params?.[0];
  if (typeArgument?.type === 'TSTypeReference' && typeArgument.typeName?.type === 'Identifier') {
    const explicit = resolveNamedDeclaration(
      graph,
      module,
      typeArgument.typeName.name,
      'interfaces',
    );
    if (explicit) {
      return {
        name: explicit.name,
        direct: explicit.module.file === module.file
          ? directInterfaceEvents(explicit.declaration)
          : new Set(),
        effective: effectiveInterfaceEvents(graph, explicit),
      };
    }
  }

  const base = resolveBaseClass(graph, module, classDeclaration);
  return base
    ? eventMapForClass(graph, base.module, base.declaration, seen)
    : undefined;
}

function jsDocBlockForClass(module, classDeclaration) {
  const candidates = jsDocBlocks(module.source).filter((block) => block.end <= classDeclaration.start);
  const block = candidates.at(-1);
  if (!block) return undefined;
  const between = module.source.slice(block.end, classDeclaration.start);
  return /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?$/.test(between)
    ? block.text
    : undefined;
}

function effectiveClassJsDocEvents(graph, module, classDeclaration, seen = new Set()) {
  const className = classDeclaration.id?.name;
  const key = `${module.file}#${className ?? '<anonymous>'}`;
  if (seen.has(key)) return new Set();
  seen.add(key);

  const ownBlock = jsDocBlockForClass(module, classDeclaration);
  const events = ownBlock ? eventNamesFromJsDocBlock(ownBlock) : new Set();
  const base = resolveBaseClass(graph, module, classDeclaration);
  if (base) {
    for (const event of effectiveClassJsDocEvents(graph, base.module, base.declaration, seen)) {
      events.add(event);
    }
  }
  return events;
}

function familyFromModulePath(modulePath) {
  return modulePath.match(/^src\/components\/([^/]+)\//)?.[1];
}

export function collectRepositoryEventContracts(root = packageDir) {
  const manifestPath = path.join(root, 'custom-elements.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const graph = moduleGraph();
  const components = [];

  for (const manifestModule of manifest.modules ?? []) {
    const sourceFile = path.join(root, manifestModule.path);
    if (!existsSync(sourceFile)) continue;
    const module = graph.get(sourceFile);
    for (const declaration of manifestModule.declarations ?? []) {
      if (!declaration.customElement || !declaration.tagName) continue;
      const classDeclaration = module.classes.get(declaration.name);
      if (!classDeclaration) {
        throw new Error(
          `${manifestModule.path}: custom-elements.json names class ${declaration.name}, but the source declaration was not found`,
        );
      }
      const eventMap = eventMapForClass(graph, module, classDeclaration);
      components.push({
        tag: declaration.tagName,
        className: declaration.name,
        sourceFile: manifestModule.path,
        family: familyFromModulePath(manifestModule.path),
        eventMapName: eventMap?.name,
        directEventMapEvents: eventMap?.direct ?? new Set(),
        effectiveEventMapEvents: eventMap?.effective ?? new Set(),
        jsdocEvents: effectiveClassJsDocEvents(graph, module, classDeclaration),
        cemEvents: new Set((declaration.events ?? []).map((event) => event.name)),
      });
    }
  }

  const families = new Set(components.map(({ family }) => family).filter(Boolean));
  const authoredSections = [];
  for (const family of sorted(families)) {
    const authoredFile = path.join(root, 'llms', `${family}.md`);
    if (!existsSync(authoredFile)) {
      throw new Error(`missing authored event source llms/${family}.md`);
    }
    authoredSections.push(
      ...splitAuthoredEventSections(
        readFileSync(authoredFile, 'utf8'),
        `llms/${family}.md`,
      ),
    );
  }

  const componentTags = new Set(components.map(({ tag }) => tag));
  const knownEventNames = new Set(
    components.flatMap((component) => [
      ...component.directEventMapEvents,
      ...component.effectiveEventMapEvents,
      ...component.jsdocEvents,
      ...component.cemEvents,
    ]),
  );
  for (const section of authoredSections) {
    section.events = new Set(
      [...section.events].filter(
        (event) => !componentTags.has(event) || knownEventNames.has(event),
      ),
    );
  }

  return {
    components,
    authoredSections,
    findings: findEventContractDrift({ components, authoredSections }),
  };
}

export function formatEventContractFindings(findings) {
  return findings
    .map(({ code, message }) => `  - [${code}] ${message}`)
    .join('\n');
}

async function main() {
  const { components, findings } = collectRepositoryEventContracts();
  if (findings.length > 0) {
    console.error(
      `Event-contract parity check failed (${findings.length} issue${findings.length === 1 ? '' : 's'}):\n`,
    );
    console.error(formatEventContractFindings(findings));
    console.error(
      '\nKeep EventMap members, class @event tags, custom-elements.json, and each authored Events ' +
        'contract aligned. Regenerate the manifest only after correcting source JSDoc/types.',
    );
    process.exitCode = 1;
    return;
  }

  const eventCount = components.reduce((count, component) => count + component.cemEvents.size, 0);
  console.log(
    `Event-contract parity check passed (${components.length} components, ${eventCount} CEM events).`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

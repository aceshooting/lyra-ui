#!/usr/bin/env node

// Keeps the four public event-name surfaces synchronized:
//   * a component's EventMap type,
//   * the class JSDoc that feeds the manifest,
//   * custom-elements.json,
//   * and the authored llms/<family>.md Events contract.
// Event names/details are also gated by the type system: `LyraElement.emit()` is keyed by the
// component EventMap. Cancelability cannot be expressed there, so this checker derives it from
// every statically resolvable `this.emit()` call and compares that runtime truth with JSDoc/CEM.
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
import { eventCancelabilityFromDescription } from './component-inventory.mjs';
import { expandManifestInheritance } from './manifest-compact.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EVENT_NAME_RE = /^(?:lr-[a-z0-9]+(?:-[a-z0-9]+)*|beforeinput|input|change|focus|blur|ended|error|load|loadedmetadata|pause|play|request|timeupdate|volumechange)$/;
const RUNTIME_EVENT_MIXINS = new Set([
  'DocumentAnchorTarget',
  'FormAssociated',
  'TextViewerTarget',
]);

const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
const setDifference = (left, right) => sorted(left).filter((value) => !right.has(value));

/** Effective custom-element declarations from a compact or expanded manifest. */
export function eventContractManifestDeclarations(manifest) {
  return (expandManifestInheritance(manifest).modules ?? []).flatMap((module) =>
    (module.declarations ?? [])
      .filter((declaration) => declaration.customElement && declaration.tagName)
      .map((declaration) => ({ modulePath: module.path, declaration })),
  );
}

function jsDocBlocks(source) {
  return [...source.matchAll(/\/\*\*[\s\S]*?\*\//g)].map((match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function eventContractsFromJsDocBlock(block) {
  const events = new Map();
  const lines = block
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*\/\*\*?\s?/u, '').replace(/^\s*\*\/?\s?/u, ''));
  for (let index = 0; index < lines.length; index += 1) {
    const firstLine = lines[index].match(/^@event\s+(.+)$/u);
    if (!firstLine) continue;
    const declarationLines = [firstLine[1]];
    while (index + 1 < lines.length && !/^@[a-z]/iu.test(lines[index + 1])) {
      declarationLines.push(lines[index + 1]);
      index += 1;
    }
    let declaration = declarationLines.join(' ').replace(/\s+/gu, ' ').trim();
    let type;
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
      if (end >= 0) {
        type = declaration.slice(1, end).trim();
        declaration = declaration.slice(end + 1).trim();
      }
    }
    const name = declaration.match(/^([a-z][a-z0-9-]*)\b/)?.[1];
    if (!name || !EVENT_NAME_RE.test(name)) continue;
    const description = declaration
      .slice(name.length)
      .replace(/^\s*-\s*/u, '')
      .trim();
    events.set(name, { type, description });
  }
  return events;
}

function eventNamesFromJsDocBlock(block) {
  return new Set(eventContractsFromJsDocBlock(block).keys());
}

function eventTypesFromJsDocBlock(block) {
  return new Map(
    [...eventContractsFromJsDocBlock(block)]
      .filter(([, contract]) => contract.type !== undefined)
      .map(([name, contract]) => [name, contract.type]),
  );
}

function eventCancelabilityFromJsDocBlock(block) {
  return new Map(
    [...eventContractsFromJsDocBlock(block)].map(([name, contract]) => [
      name,
      eventCancelabilityFromDescription(contract.description, 'lyra', name),
    ]),
  );
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

/** Returns normalized cancelability from one component's authored @event descriptions. */
export function eventCancelabilityFromComponentJsDoc(source, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const customElement = new RegExp(`@customElement\\s+${escaped}(?:\\s|\\*|$)`);
  const block = jsDocBlocks(source).find(({ text }) => customElement.test(text));
  return block ? eventCancelabilityFromJsDocBlock(block.text) : new Map();
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

function canonicalTypeText(value) {
  const source = String(value ?? '').trim();
  let result = '';
  let quote;
  let escaped = false;
  for (const character of source) {
    if (quote) {
      result += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      result += character;
    } else if (!/\s/u.test(character)) {
      result += character;
    }
  }
  return result;
}

function unquotedTypeText(value) {
  const source = String(value ?? '');
  let result = '';
  let quote;
  let escaped = false;
  for (const character of source) {
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = undefined;
      result += ' ';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      result += ' ';
    } else {
      result += character;
    }
  }
  return result;
}

const typeContainsAny = (value) =>
  /\bany\b(?!\s*\??\s*(?::|\())/u.test(unquotedTypeText(value));
const isBareCustomEventType = (value) => canonicalTypeText(value) === 'CustomEvent';
const isImplicitAnyEventType = (value) =>
  typeContainsAny(value) || isBareCustomEventType(value);

function stripBalancedOuterParentheses(type) {
  let text = String(type ?? '').trim();
  while (text.startsWith('(') && text.endsWith(')')) {
    let depth = 0;
    let quote;
    let closesAtEnd = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quote) {
        if (character === quote && text[index - 1] !== '\\') quote = undefined;
        continue;
      }
      if (character === "'" || character === '"' || character === '`') quote = character;
      else if (character === '(') depth += 1;
      else if (character === ')' && --depth === 0) {
        closesAtEnd = index === text.length - 1;
        break;
      }
    }
    if (!closesAtEnd) break;
    text = text.slice(1, -1).trim();
  }
  return text;
}

function splitTopLevelTypeUnion(type) {
  const text = stripBalancedOuterParentheses(type);
  const members = [];
  let start = 0;
  let depth = 0;
  let quote;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === quote && text[index - 1] !== '\\') quote = undefined;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') quote = character;
    else if ('([{<'.includes(character)) depth += 1;
    else if ([')', ']', '}', '>'].includes(character)) depth = Math.max(0, depth - 1);
    else if (character === '|' && depth === 0) {
      members.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  members.push(text.slice(start).trim());
  return members.filter(Boolean);
}

function customEventDetailType(type) {
  const text = stripBalancedOuterParentheses(type);
  const opening = /^CustomEvent\s*</u.exec(text);
  if (!opening) return undefined;
  const start = opening[0].lastIndexOf('<');
  let depth = 0;
  let quote;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === quote && text[index - 1] !== '\\') quote = undefined;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') quote = character;
    else if (character === '<') depth += 1;
    else if (character === '>' && --depth === 0) {
      return text.slice(index + 1).trim() === ''
        ? text.slice(start + 1, index).trim()
        : undefined;
    }
  }
  return undefined;
}

function isUnknownEventType(type) {
  const text = stripBalancedOuterParentheses(type);
  if (splitTopLevelTypeUnion(text).includes('unknown')) return true;
  const detail = customEventDetailType(text);
  return detail !== undefined && splitTopLevelTypeUnion(detail).includes('unknown');
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
      directEventMapTypes = new Map(),
      effectiveEventMapTypes = new Map(),
      jsdocEvents,
      jsdocEventTypes = new Map(),
      jsdocEventCancelability = new Map(),
      cemEvents,
      cemEventTypes = new Map(),
      cemEventCancelability = new Map(),
      runtimeEventCancelability = new Map(),
      unresolvedRuntimeEmitCalls = 0,
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

    for (const [event, type] of directEventMapTypes) {
      if (isImplicitAnyEventType(type)) {
        findings.push(
          finding(
            'eventmap-event-type-any',
            event,
            `${sourceFile}: ${mapLabel} types \`${event}\` as \`${type}\`; replace \`any\` with a ` +
              'concrete event/detail schema.',
          ),
        );
      } else if (isUnknownEventType(type)) {
        findings.push(
          finding(
            'eventmap-event-type-unknown',
            event,
            `${sourceFile}: ${mapLabel} types \`${event}\` as \`${type}\`; replace top-level ` +
              '`unknown` with a concrete event/detail schema.',
          ),
        );
      }
    }

    for (const [surface, types, anyCode, mismatchCode, label] of [
      ['JSDoc', jsdocEventTypes, 'jsdoc-event-type-any', 'jsdoc-event-type-mismatch', 'class JSDoc'],
      ['CEM', cemEventTypes, 'cem-event-type-any', 'cem-event-type-mismatch', 'custom-elements.json'],
    ]) {
      for (const [event, type] of types) {
        if (isImplicitAnyEventType(type)) {
          findings.push(
            finding(
              anyCode,
              event,
              `${sourceFile}: ${tag}'s ${label} types \`${event}\` as \`${type}\`; public event ` +
                'metadata cannot use `any`.',
            ),
          );
          continue;
        }
        if (isUnknownEventType(type)) {
          findings.push(
            finding(
              anyCode.replace(/-any$/u, '-unknown'),
              event,
              `${sourceFile}: ${tag}'s ${label} types \`${event}\` as \`${type}\`; public event ` +
                'metadata cannot use top-level `unknown`.',
            ),
          );
          continue;
        }
        const expected = effectiveEventMapTypes.get(event);
        if (
          !expected ||
          isImplicitAnyEventType(expected) ||
          isUnknownEventType(expected)
        ) {
          continue;
        }
        if (canonicalTypeText(type) === canonicalTypeText(expected)) continue;
        findings.push(
          finding(
            mismatchCode,
            event,
            `${sourceFile}: ${tag}'s ${surface} type for \`${event}\` is \`${type}\`, but ` +
              `${mapLabel} declares \`${expected}\`; align the public detail schema.`,
          ),
        );
      }
    }

    if (unresolvedRuntimeEmitCalls > 0) {
      findings.push(
        finding(
          'runtime-event-name-unresolved',
          '<dynamic>',
          `${sourceFile}: ${tag} has ${unresolvedRuntimeEmitCalls} \`this.emit()\` call${
            unresolvedRuntimeEmitCalls === 1 ? '' : 's'
          } whose event name cannot be resolved statically; use a literal, literal union, or a ` +
            'helper whose call sites supply literal event names.',
        ),
      );
    }

    for (const [event, runtime] of runtimeEventCancelability) {
      if (!effectiveEventMapEvents.has(event)) {
        findings.push(
          finding(
            'runtime-event-untyped',
            event,
            `${sourceFile}: ${tag} emits \`${event}\` at runtime, but its effective EventMap does ` +
              'not declare that event.',
          ),
        );
      }
      if (!jsdocEvents.has(event)) {
        findings.push(
          finding(
            'runtime-event-missing-jsdoc',
            event,
            `${sourceFile}: ${tag} emits \`${event}\` at runtime, but its effective class JSDoc ` +
              'does not advertise that event.',
          ),
        );
      }
      if (!cemEvents.has(event)) {
        findings.push(
          finding(
            'runtime-event-missing-cem',
            event,
            `${sourceFile}: ${tag} emits \`${event}\` at runtime, but custom-elements.json does ` +
              'not advertise that event.',
          ),
        );
      }
      if (runtime === 'unresolved') {
        findings.push(
          finding(
            'runtime-event-cancelability-unresolved',
            event,
            `${sourceFile}: ${tag} emits \`${event}\` with an EventInit whose \`cancelable\` value ` +
              'cannot be resolved statically; use an object literal or an explicitly constrained type.',
          ),
        );
        continue;
      }
      for (const [documented, code, label] of [
        [jsdocEventCancelability, 'jsdoc-event-cancelability-mismatch', 'class JSDoc'],
        [cemEventCancelability, 'cem-event-cancelability-mismatch', 'custom-elements.json'],
      ]) {
        const advertised = documented.get(event);
        if (advertised === undefined || advertised === runtime) continue;
        findings.push(
          finding(
            code,
            event,
            `${sourceFile}: ${tag}'s ${label} describes \`${event}\` as ${advertised}, but ` +
              `runtime \`this.emit()\` paths are ${runtime}; align the public contract with the dispatch options.`,
          ),
        );
      }
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

function walkAst(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) walkAst(child, visitor);
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      walkAst(value, visitor);
    }
  }
}

function literalEventNamesFromType(node) {
  if (!node) return [];
  if (node.type === 'TSTypeAnnotation' || node.type === 'TSParenthesizedType') {
    return literalEventNamesFromType(node.typeAnnotation);
  }
  if (node.type === 'TSLiteralType') return literalEventNames(node.literal);
  if (node.type === 'TSUnionType') {
    return node.types.flatMap((type) => literalEventNamesFromType(type));
  }
  return [];
}

function literalEventNames(node, bindings = new Map(), seen = new Set()) {
  if (!node) return [];
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return EVENT_NAME_RE.test(node.value) ? [node.value] : [];
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    const value = node.quasis[0]?.value?.cooked ?? node.quasis[0]?.value?.raw;
    return typeof value === 'string' && EVENT_NAME_RE.test(value) ? [value] : [];
  }
  if (node.type === 'Identifier' && bindings.has(node.name) && !seen.has(node.name)) {
    const nextSeen = new Set(seen).add(node.name);
    return [...bindings.get(node.name)].flatMap((value) =>
      typeof value === 'string' ? [value] : literalEventNames(value, bindings, nextSeen));
  }
  if (node.type === 'ConditionalExpression') {
    return [
      ...literalEventNames(node.consequent, bindings, seen),
      ...literalEventNames(node.alternate, bindings, seen),
    ];
  }
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'ChainExpression'
  ) {
    return literalEventNames(node.expression, bindings, seen);
  }
  return [];
}

function callableParameterTarget(parameter) {
  return parameter?.type === 'AssignmentPattern' ? parameter.left : parameter;
}

function addSeededEventNames(seeds, callable, parameterName, names) {
  if (!parameterName || names.length === 0) return false;
  const callableSeeds = seeds.get(callable) ?? new Map();
  const parameterSeeds = callableSeeds.get(parameterName) ?? new Set();
  const before = parameterSeeds.size;
  for (const name of names) parameterSeeds.add(name);
  callableSeeds.set(parameterName, parameterSeeds);
  seeds.set(callable, callableSeeds);
  return parameterSeeds.size !== before;
}

function isCallableNode(node) {
  return (
    node?.type === 'FunctionExpression' ||
    node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionDeclaration'
  );
}

function directNestedCallables(callable) {
  const nested = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (isCallableNode(node)) {
      nested.push(node);
      return;
    }
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent' || key === 'start' || key === 'end') continue;
      if (Array.isArray(value)) {
        for (const child of value) visit(child);
      } else if (value && typeof value === 'object' && typeof value.type === 'string') {
        visit(value);
      }
    }
  };
  visit(callable.body);
  return nested;
}

function callableTree(roots) {
  const callables = [];
  const pending = [...roots];
  while (pending.length > 0) {
    const callable = pending.shift();
    callables.push(callable);
    pending.push(...directNestedCallables(callable));
  }
  return callables;
}

function directClassBodies(node) {
  if (node?.type === 'ClassBody') return [node];
  if (node?.type === 'ClassDeclaration' || node?.type === 'ClassExpression') {
    return node.body ? [node.body] : [];
  }
  if (node?.type !== 'Program') return [];
  return node.body
    .map((statement) => unwrapDeclaration(statement))
    .filter((statement) => statement?.type === 'ClassDeclaration')
    .map((statement) => statement.body);
}

function runtimeCancelabilityContexts(node) {
  const classBodies = directClassBodies(node);
  if (classBodies.length === 0) return [{ classBody: undefined, scopes: [node], methods: new Map() }];
  return classBodies.map((classBody) => {
    const methods = new Map();
    const roots = [];
    for (const member of classBody.body ?? []) {
      let callable;
      if (member.type === 'MethodDefinition' && member.value) callable = member.value;
      else if (
        member.type === 'PropertyDefinition' &&
        (member.value?.type === 'ArrowFunctionExpression' ||
          member.value?.type === 'FunctionExpression')
      ) {
        callable = member.value;
      }
      if (!callable) continue;
      roots.push(callable);
      const name = propertyName(member.key);
      // Only private helpers have a closed set of class-internal call sites. A public/protected
      // string parameter may be invoked externally with an arbitrary name and must fail closed.
      if (name && member.accessibility === 'private') methods.set(name, callable);
    }
    return { classBody, scopes: callableTree(roots), methods };
  });
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (current.type === 'TSAsExpression' ||
      current.type === 'TSTypeAssertion' ||
      current.type === 'TSNonNullExpression' ||
      current.type === 'ChainExpression' ||
      current.type === 'ParenthesizedExpression')
  ) {
    current = current.expression;
  }
  return current;
}

function booleanValuesFromType(node) {
  if (!node) return undefined;
  if (node.type === 'TSTypeAnnotation' || node.type === 'TSParenthesizedType') {
    return booleanValuesFromType(node.typeAnnotation);
  }
  if (
    node.type === 'TSLiteralType' &&
    node.literal?.type === 'Literal' &&
    typeof node.literal.value === 'boolean'
  ) {
    return [node.literal.value];
  }
  if (node.type === 'TSBooleanKeyword') return [false, true];
  if (node.type === 'TSUnionType') {
    const values = node.types.flatMap((type) => booleanValuesFromType(type) ?? []);
    return values.length > 0 ? [...new Set(values)] : undefined;
  }
  return undefined;
}

function eventInitValuesFromType(node) {
  if (!node) return undefined;
  if (node.type === 'TSTypeAnnotation' || node.type === 'TSParenthesizedType') {
    return eventInitValuesFromType(node.typeAnnotation);
  }
  if (node.type === 'TSUnionType') {
    const values = [];
    for (const type of node.types) {
      const branch = eventInitValuesFromType(type);
      if (!branch) return undefined;
      values.push(...branch);
    }
    return [...new Set(values)];
  }
  if (node.type !== 'TSTypeLiteral') return undefined;
  const member = [...node.members].reverse().find(
    (candidate) =>
      candidate.type === 'TSPropertySignature' &&
      propertyName(candidate.key) === 'cancelable',
  );
  if (!member) return undefined;
  const values = booleanValuesFromType(member.typeAnnotation);
  if (!values) return undefined;
  return member.optional ? [...new Set([false, ...values])] : values;
}

function booleanExpressionObservations(expression, booleanMembers) {
  const value = unwrapExpression(expression);
  if (value?.type === 'Literal' && typeof value.value === 'boolean') return [value.value];
  if (
    value?.type === 'MemberExpression' &&
    value.object?.type === 'ThisExpression'
  ) {
    const memberValue = booleanMembers.get(propertyName(value.property));
    if (typeof memberValue === 'boolean') return [memberValue];
  }
  if (value?.type === 'ConditionalExpression') {
    return [...new Set([
      ...booleanExpressionObservations(value.consequent, booleanMembers),
      ...booleanExpressionObservations(value.alternate, booleanMembers),
    ])];
  }
  return [false, true];
}

function objectPropertyName(entry) {
  if (!entry.computed) return propertyName(entry.key);
  const key = unwrapExpression(entry.key);
  if (key?.type === 'Literal' && typeof key.value === 'string') return key.value;
  if (key?.type === 'TemplateLiteral' && key.expressions.length === 0) {
    return key.quasis[0]?.value?.cooked ?? key.quasis[0]?.value?.raw;
  }
  return undefined;
}

function cancelabilityObservations(
  options,
  booleanMembers = new Map(),
  eventInitBindings = new Map(),
) {
  const value = unwrapExpression(options);
  if (!value || (value.type === 'Identifier' && value.name === 'undefined')) return [false];
  if (value.type === 'Identifier') {
    const observations = eventInitBindings.get(value.name);
    return observations ? [...observations] : ['unresolved'];
  }
  if (value.type !== 'ObjectExpression') return ['unresolved'];

  let observations = [false];
  for (const entry of value.properties) {
    if (entry.type === 'SpreadElement') {
      // A spread that comes after an explicit key may omit, replace, or change that key. Keeping
      // both outcomes is conservative; a later explicit property still overwrites it below.
      observations = [false, true];
      continue;
    }
    if (entry.type !== 'Property') continue;
    const key = objectPropertyName(entry);
    if (entry.computed && key === undefined) {
      // The key may or may not be `cancelable`; retain the prior value and the value this property
      // would assign when it is. A later explicit key still overwrites both possibilities.
      observations = [...new Set([
        ...observations,
        ...booleanExpressionObservations(entry.value, booleanMembers),
      ])];
      continue;
    }
    if (key !== 'cancelable') continue;
    observations = booleanExpressionObservations(entry.value, booleanMembers);
  }
  return observations;
}

function cloneBinding(binding) {
  return {
    events: binding.events ? new Set(binding.events) : null,
    init: [...binding.init],
  };
}

function cloneBindingStack(stack) {
  return stack.map((scope) => new Map(
    [...scope].map(([name, binding]) => [name, cloneBinding(binding)]),
  ));
}

function assignBinding(stack, name, binding) {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (!stack[index].has(name)) continue;
    stack[index].set(name, binding);
    return;
  }
  stack.at(-1).set(name, binding);
}

function mergeBindingStacks(target, branches) {
  for (let scopeIndex = 0; scopeIndex < target.length; scopeIndex += 1) {
    for (const name of target[scopeIndex].keys()) {
      const bindings = branches.map((branch) => branch[scopeIndex].get(name));
      const events = bindings.every((binding) => binding?.events)
        ? new Set(bindings.flatMap((binding) => [...binding.events]))
        : null;
      const init = [...new Set(bindings.flatMap((binding) => binding?.init ?? ['unresolved']))];
      target[scopeIndex].set(name, { events, init });
    }
  }
}

function eventNameBindingsFromStack(stack) {
  const bindings = new Map();
  for (const scope of stack) {
    for (const [name, binding] of scope) {
      bindings.set(name, binding.events ?? new Set());
    }
  }
  return bindings;
}

function eventInitBindingsFromStack(stack) {
  const bindings = new Map();
  for (const scope of stack) {
    for (const [name, binding] of scope) bindings.set(name, binding.init);
  }
  return bindings;
}

function eventNamesAt(node, stack) {
  const names = literalEventNames(node, eventNameBindingsFromStack(stack));
  return names.length > 0 ? new Set(names) : null;
}

function eventInitAt(node, stack, booleanMembers) {
  return cancelabilityObservations(
    node,
    booleanMembers,
    eventInitBindingsFromStack(stack),
  );
}

function bindingForDeclaration(target, initializer, stack, booleanMembers, seededNames) {
  const typeNames = literalEventNamesFromType(target.typeAnnotation);
  const initializedNames = eventNamesAt(initializer, stack);
  const events = new Set([
    ...(seededNames ?? []),
    ...typeNames,
    ...(initializedNames ?? []),
  ]);
  const typeInit = eventInitValuesFromType(target.typeAnnotation);
  const initializedInit = initializer
    ? eventInitAt(initializer, stack, booleanMembers)
    : undefined;
  return {
    events: events.size > 0 ? events : null,
    init: initializedInit ?? typeInit ?? ['unresolved'],
  };
}

/**
 * Walks one callable in lexical/source order. Nested callables are separate analysis scopes, so a
 * shadowed callback parameter or local can never inherit a same-spelled outer EventInit binding.
 */
function walkCallableLexically(callable, seededNames, booleanMembers, onCall) {
  const parameters = new Map();
  for (const parameter of callable.params ?? []) {
    const target = callableParameterTarget(parameter);
    if (target?.type !== 'Identifier') continue;
    parameters.set(
      target.name,
      bindingForDeclaration(
        target,
        parameter.type === 'AssignmentPattern' ? parameter.right : undefined,
        [parameters],
        booleanMembers,
        seededNames?.get(target.name),
      ),
    );
  }
  let stack = [parameters];

  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (isCallableNode(node) || node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      return;
    }
    if (node.type === 'BlockStatement') {
      stack.push(new Map());
      for (const statement of node.body ?? []) visit(statement);
      stack.pop();
      return;
    }
    if (node.type === 'IfStatement') {
      visit(node.test);
      const original = stack;
      const consequent = cloneBindingStack(original);
      stack = consequent;
      visit(node.consequent);
      const alternate = cloneBindingStack(original);
      stack = alternate;
      visit(node.alternate);
      stack = original;
      mergeBindingStacks(original, [consequent, alternate]);
      return;
    }
    if (
      node.type === 'WhileStatement' ||
      node.type === 'DoWhileStatement' ||
      node.type === 'ForStatement' ||
      node.type === 'ForInStatement' ||
      node.type === 'ForOfStatement'
    ) {
      const original = stack;
      const zeroIterations = cloneBindingStack(original);
      const iteration = cloneBindingStack(original);
      stack = iteration;
      // Visit in source order where possible; merging with the zero-iteration snapshot keeps any
      // outer binding assigned in a loop conservative after it exits.
      if (node.type === 'ForStatement') {
        visit(node.init);
        visit(node.test);
        visit(node.body);
        visit(node.update);
      } else if (node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
        visit(node.right);
        visit(node.left);
        visit(node.body);
      } else {
        visit(node.test);
        visit(node.body);
      }
      stack = original;
      mergeBindingStacks(original, [zeroIterations, iteration]);
      return;
    }
    if (node.type === 'VariableDeclaration') {
      for (const declaration of node.declarations ?? []) {
        visit(declaration.init);
        if (declaration.id?.type !== 'Identifier') continue;
        stack.at(-1).set(
          declaration.id.name,
          bindingForDeclaration(
            declaration.id,
            declaration.init,
            stack,
            booleanMembers,
          ),
        );
      }
      return;
    }
    if (node.type === 'AssignmentExpression' && node.left?.type === 'Identifier') {
      visit(node.right);
      assignBinding(
        stack,
        node.left.name,
        bindingForDeclaration(node.left, node.right, stack, booleanMembers),
      );
      return;
    }
    if (node.type === 'UpdateExpression' && node.argument?.type === 'Identifier') {
      assignBinding(stack, node.argument.name, { events: null, init: ['unresolved'] });
      return;
    }
    if (node.type === 'CallExpression') onCall(node, stack);

    for (const [key, value] of Object.entries(node)) {
      if (
        key === 'parent' ||
        key === 'start' ||
        key === 'end' ||
        key === 'typeAnnotation' ||
        key === 'returnType' ||
        key === 'typeArguments' ||
        key === 'typeParameters'
      ) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const child of value) visit(child);
      } else if (value && typeof value === 'object' && typeof value.type === 'string') {
        visit(value);
      }
    }
  };
  visit(callable.body ?? callable);
}

function directEmittedParameterNames(callable) {
  const parameterNames = new Set(
    (callable.params ?? [])
      .map((parameter) => callableParameterTarget(parameter))
      .filter((parameter) => parameter?.type === 'Identifier')
      .map((parameter) => parameter.name),
  );
  const emitted = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (isCallableNode(node) || node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      return;
    }
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      const argument = unwrapExpression(node.arguments[0]);
      if (
        callee?.type === 'MemberExpression' &&
        unwrapExpression(callee.object)?.type === 'ThisExpression' &&
        propertyName(callee.property) === 'emit' &&
        argument?.type === 'Identifier' &&
        parameterNames.has(argument.name)
      ) {
        emitted.add(argument.name);
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent' || key === 'start' || key === 'end') continue;
      if (Array.isArray(value)) {
        for (const child of value) visit(child);
      } else if (value && typeof value === 'object' && typeof value.type === 'string') {
        visit(value);
      }
    }
  };
  visit(callable.body);
  return emitted;
}

function privateHelperEventNameSeeds(context, booleanMembers) {
  const seeds = new Map();
  let changed = true;
  while (changed) {
    changed = false;
    for (const caller of context.scopes) {
      walkCallableLexically(caller, seeds.get(caller), booleanMembers, (candidate, stack) => {
        const callee = candidate.callee;
        if (
          callee?.type !== 'MemberExpression' ||
          callee.object?.type !== 'ThisExpression'
        ) {
          return;
        }
        const target = context.methods.get(propertyName(callee.property));
        if (!target) return;
        for (let index = 0; index < (target.params?.length ?? 0); index += 1) {
          const parameter = callableParameterTarget(target.params[index]);
          if (parameter?.type !== 'Identifier') continue;
          const names = eventNamesAt(candidate.arguments[index], stack);
          if (!names) continue;
          changed = addSeededEventNames(
            seeds,
            target,
            parameter.name,
            [...names],
          ) || changed;
        }
      });
    }
  }
  return seeds;
}

function constructorWrittenMembers(classBody) {
  const written = new Set();
  const constructor = (classBody?.body ?? []).find(
    (member) => member.type === 'MethodDefinition' && member.kind === 'constructor',
  );
  if (!constructor) return written;
  walkAst(constructor.value?.body, (candidate) => {
    if (candidate.type !== 'AssignmentExpression') return;
    const target = unwrapExpression(candidate.left);
    if (target?.type !== 'MemberExpression') return;
    const object = unwrapExpression(target.object);
    if (object?.type !== 'ThisExpression') return;
    const name = propertyName(target.property);
    if (name) written.add(name);
  });
  return written;
}

function literalBooleanMembersForClassBody(classBody, inherited = new Map()) {
  const members = new Map(inherited);
  const constructorWrites = constructorWrittenMembers(classBody);
  for (const member of classBody?.body ?? []) {
    const name = propertyName(member.key);
    if (!name) continue;
    // Every direct override first invalidates a base invariant. Only the two proven immutable
    // shapes below may establish a replacement constant.
    members.delete(name);
    let value;
    if (
      member.type === 'MethodDefinition' &&
      member.kind === 'get' &&
      member.value?.body?.body?.length === 1 &&
      member.value.body.body[0].type === 'ReturnStatement'
    ) {
      value = member.value.body.body[0].argument;
    } else if (
      member.type === 'PropertyDefinition' &&
      member.readonly &&
      !constructorWrites.has(name)
    ) {
      value = member.value;
    }
    if (value?.type === 'Literal' && typeof value.value === 'boolean') {
      members.set(name, value.value);
    }
  }
  return members;
}

function isThisEmitCall(candidate) {
  const callee = candidate?.callee;
  return (
    candidate?.type === 'CallExpression' &&
    callee?.type === 'MemberExpression' &&
    unwrapExpression(callee.object)?.type === 'ThisExpression' &&
    propertyName(callee.property) === 'emit'
  );
}

function runtimeEventAnalysisFromNode(node, suppliedBooleanMembers) {
  const observations = new Map();
  let unresolvedNames = 0;
  for (const context of runtimeCancelabilityContexts(node)) {
    const booleanMembers = suppliedBooleanMembers ??
      literalBooleanMembersForClassBody(context.classBody);
    const seeds = privateHelperEventNameSeeds(context, booleanMembers);
    const helperEventParameters = new Map(
      [...context.methods.values()].map((callable) => [
        callable,
        directEmittedParameterNames(callable),
      ]),
    );

    // A private helper is closed-world only when every event-carrying argument resolves. Keep a
    // dynamic call visible even if another call seeded the same helper with a literal.
    for (const scope of context.scopes) {
      walkCallableLexically(scope, seeds.get(scope), booleanMembers, (candidate, stack) => {
        const callee = candidate.callee;
        if (
          callee?.type !== 'MemberExpression' ||
          callee.object?.type !== 'ThisExpression'
        ) {
          return;
        }
        const target = context.methods.get(propertyName(callee.property));
        if (!target) return;
        const eventParameters = helperEventParameters.get(target);
        for (let index = 0; index < (target.params?.length ?? 0); index += 1) {
          const parameter = callableParameterTarget(target.params[index]);
          if (
            parameter?.type === 'Identifier' &&
            eventParameters.has(parameter.name) &&
            !eventNamesAt(candidate.arguments[index], stack)
          ) {
            unresolvedNames += 1;
          }
        }
      });
    }

    for (const scope of context.scopes) {
      walkCallableLexically(scope, seeds.get(scope), booleanMembers, (candidate, stack) => {
        if (!isThisEmitCall(candidate)) return;
        const names = eventNamesAt(candidate.arguments[0], stack);
        if (!names) {
          unresolvedNames += 1;
          return;
        }
        const values = eventInitAt(candidate.arguments[2], stack, booleanMembers);
        for (const name of names) {
          const observed = observations.get(name) ?? new Set();
          for (const value of values) observed.add(value);
          observations.set(name, observed);
        }
      });
    }
  }
  return {
    events: new Map(
      [...observations]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, values]) => [
          name,
          values.has('unresolved')
            ? 'unresolved'
            : values.size > 1
              ? 'conditional'
              : values.has(true)
                ? 'always'
                : 'never',
        ]),
    ),
    unresolvedNames,
  };
}

/** Derives observed cancelability from statically named `this.emit()` calls in TypeScript source. */
export function runtimeEventCancelabilityFromSource(source, file = 'event-contract-fixture.ts') {
  const parsed = parseSync(file, source);
  if (parsed.errors.length > 0) {
    const details = parsed.errors.map((error) => error.message ?? String(error)).join('\n');
    throw new SyntaxError(`${file} could not be parsed:\n${details}`);
  }
  const analysis = runtimeEventAnalysisFromNode(parsed.program);
  if (analysis.unresolvedNames > 0) {
    throw new Error(
      `${file}: could not statically resolve ${analysis.unresolvedNames} emitted event name${
        analysis.unresolvedNames === 1 ? '' : 's'
      }`,
    );
  }
  const unresolvedEvents = [...analysis.events]
    .filter(([, cancelability]) => cancelability === 'unresolved')
    .map(([event]) => event);
  if (unresolvedEvents.length > 0) {
    throw new Error(`${file}: unresolved EventInit cancelability for ${unresolvedEvents.join(', ')}`);
  }
  return analysis.events;
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
  const mixinAliases = new Map();
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
    } else if (declaration?.type === 'VariableDeclaration') {
      for (const variable of declaration.declarations ?? []) {
        const initializer = unwrapExpression(variable.init);
        if (
          variable.id?.type === 'Identifier' &&
          initializer?.type === 'CallExpression' &&
          initializer.callee?.type === 'Identifier' &&
          RUNTIME_EVENT_MIXINS.has(initializer.callee.name)
        ) {
          mixinAliases.set(variable.id.name, initializer.callee.name);
        }
      }
    }
  }
  return { file, source, program: parsed.program, imports, interfaces, classes, mixinAliases };
}

function moduleGraph() {
  const cache = new Map();
  return {
    runtimeMixins: new Map(),
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

function directInterfaceEventTypes(module, interfaceDeclaration) {
  const events = new Map();
  for (const member of interfaceDeclaration.body.body) {
    if (member.type !== 'TSPropertySignature') continue;
    const name = propertyName(member.key);
    if (!name || !EVENT_NAME_RE.test(name)) continue;
    const typeNode = member.typeAnnotation?.typeAnnotation ?? member.typeAnnotation;
    const type = typeNode
      ? module.source.slice(typeNode.start, typeNode.end).trim()
      : 'any';
    events.set(name, type);
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
      const inherited = effectiveInterfaceEvents(graph, base, new Set(seen));
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
      for (const event of effectiveInterfaceEvents(graph, parent, new Set(seen))) events.add(event);
    }
  }
  return events;
}

function effectiveInterfaceEventTypes(graph, resolved, seen = new Set()) {
  const key = `${resolved.module.file}#${resolved.name}`;
  if (seen.has(key)) return new Map();
  seen.add(key);

  const events = directInterfaceEventTypes(resolved.module, resolved.declaration);
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
      const inherited = effectiveInterfaceEventTypes(graph, base, new Set(seen));
      const keys = new Set();
      const collectLiteralKeys = (node) => {
        if (node?.type === 'TSLiteralType' && typeof node.literal?.value === 'string') {
          keys.add(node.literal.value);
        } else if (node?.type === 'TSUnionType') {
          for (const type of node.types) collectLiteralKeys(type);
        }
      };
      collectLiteralKeys(keysType);
      for (const [event, type] of inherited) {
        const included =
          (parentName === 'Omit' && !keys.has(event)) ||
          (parentName === 'Pick' && keys.has(event));
        if (included && !events.has(event)) events.set(event, type);
      }
      continue;
    }

    const parent = resolveNamedDeclaration(graph, resolved.module, parentName, 'interfaces');
    if (!parent) continue;
    for (const [event, type] of effectiveInterfaceEventTypes(graph, parent, new Set(seen))) {
      if (!events.has(event)) events.set(event, type);
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
      directTypes: directInterfaceEventTypes(own.module, own.declaration),
      effectiveTypes: effectiveInterfaceEventTypes(graph, own),
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
        directTypes: explicit.module.file === module.file
          ? directInterfaceEventTypes(explicit.module, explicit.declaration)
          : new Map(),
        effectiveTypes: effectiveInterfaceEventTypes(graph, explicit),
      };
    }
  }

  const base = resolveBaseClass(graph, module, classDeclaration);
  return base
    ? eventMapForClass(graph, base.module, base.declaration, seen)
    : undefined;
}

/**
 * Resolves every manifest-authored public event against its component EventMap and source
 * module/class identity. This is consumed by CEM/inventory generation so analyzer-omitted
 * `@event` types never degrade to `unknown`; `any` and top-level `unknown` fail closed instead of
 * becoming compatibility wildcards. An inherited/shared EventMap member that a component does not
 * advertise is intentionally outside this projection; the event contract checker separately
 * requires every directly owned EventMap member to be documented.
 */
export function sourceEventTypeContracts(manifest, root = packageDir) {
  const graph = moduleGraph();
  const contracts = new Map();
  for (const moduleDoc of manifest.modules ?? []) {
    const relative = String(moduleDoc.path ?? '').replace(/^\/+/, '');
    const sourceFile = path.join(root, relative);
    if (!relative || !existsSync(sourceFile)) continue;
    const module = graph.get(sourceFile);
    for (const declaration of moduleDoc.declarations ?? []) {
      if (!declaration.customElement || !declaration.tagName) continue;
      const classDeclaration = module.classes.get(declaration.name);
      if (!classDeclaration) continue;
      const eventMap = eventMapForClass(graph, module, classDeclaration);
      if (!eventMap) continue;
      const contract = {};
      const publicEvents = new Set(
        (declaration.events ?? []).map((event) => event.name).filter(Boolean),
      );
      for (const [event, type] of eventMap.effectiveTypes) {
        if (!publicEvents.has(event)) continue;
        if (
          isImplicitAnyEventType(type) ||
          isUnknownEventType(type)
        ) {
          throw new Error(
            `${declaration.tagName}#${event}: source EventMap must publish a concrete type, got ${type}`,
          );
        }
        contract[event] = type;
      }
      contracts.set(declaration.tagName, contract);
    }
  }
  return contracts;
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

function effectiveClassJsDocEventTypes(graph, module, classDeclaration, seen = new Set()) {
  const className = classDeclaration.id?.name;
  const key = `${module.file}#${className ?? '<anonymous>'}`;
  if (seen.has(key)) return new Map();
  seen.add(key);

  const ownBlock = jsDocBlockForClass(module, classDeclaration);
  const events = ownBlock ? eventTypesFromJsDocBlock(ownBlock) : new Map();
  const base = resolveBaseClass(graph, module, classDeclaration);
  if (base) {
    for (const [event, type] of effectiveClassJsDocEventTypes(
      graph,
      base.module,
      base.declaration,
      seen,
    )) {
      if (!events.has(event)) events.set(event, type);
    }
  }
  return events;
}

function effectiveClassJsDocEventCancelability(graph, module, classDeclaration, seen = new Set()) {
  const className = classDeclaration.id?.name;
  const key = `${module.file}#${className ?? '<anonymous>'}`;
  if (seen.has(key)) return new Map();
  seen.add(key);

  const ownBlock = jsDocBlockForClass(module, classDeclaration);
  const events = ownBlock ? eventCancelabilityFromJsDocBlock(ownBlock) : new Map();
  const base = resolveBaseClass(graph, module, classDeclaration);
  if (base) {
    for (const [event, cancelability] of effectiveClassJsDocEventCancelability(
      graph,
      base.module,
      base.declaration,
      seen,
    )) {
      if (!events.has(event)) events.set(event, cancelability);
    }
  }
  return events;
}

function mergeRuntimeCancelability(target, source) {
  for (const [event, cancelability] of source) {
    const observed = target.get(event) ?? new Set();
    if (cancelability === 'always' || cancelability === 'conditional') observed.add(true);
    if (cancelability === 'never' || cancelability === 'conditional') observed.add(false);
    if (cancelability === 'unresolved') observed.add('unresolved');
    target.set(event, observed);
  }
}

function runtimeAnalysisFromObservations(observations, unresolvedNames) {
  return {
    events: new Map(
      [...observations]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([event, values]) => [
          event,
          values.has('unresolved')
            ? 'unresolved'
            : values.size > 1
              ? 'conditional'
              : values.has(true)
                ? 'always'
                : 'never',
        ]),
    ),
    unresolvedNames,
  };
}

function runtimeMixinNamesFromExpression(module, expression, names = new Set()) {
  const value = unwrapExpression(expression);
  if (!value) return names;
  if (value.type === 'Identifier') {
    const alias = module.mixinAliases.get(value.name);
    if (alias) names.add(alias);
    return names;
  }
  if (value.type !== 'CallExpression') return names;
  if (value.callee?.type === 'Identifier') {
    const importedName = module.imports.get(value.callee.name)?.imported ?? value.callee.name;
    if (RUNTIME_EVENT_MIXINS.has(importedName)) names.add(value.callee.name);
  }
  for (const argument of value.arguments ?? []) {
    runtimeMixinNamesFromExpression(module, argument, names);
  }
  return names;
}

function runtimeMixinAnalysis(graph, fromModule, localName, seen = new Set()) {
  const imported = fromModule.imports.get(localName);
  const canonicalName = imported?.imported ?? localName;
  if (!RUNTIME_EVENT_MIXINS.has(canonicalName) || !imported?.file) {
    return { events: new Map(), unresolvedNames: 0 };
  }
  const key = `${imported.file}#${canonicalName}`;
  if (graph.runtimeMixins.has(key)) return graph.runtimeMixins.get(key);
  if (seen.has(key)) return { events: new Map(), unresolvedNames: 0 };
  const nextSeen = new Set(seen).add(key);
  const module = graph.get(imported.file);
  const observations = new Map();
  let unresolvedNames = 0;
  const classBodies = [];
  walkAst(module.program, (candidate) => {
    if (candidate.type === 'ClassBody') classBodies.push(candidate);
  });
  for (const classBody of classBodies) {
    const own = runtimeEventAnalysisFromNode(classBody);
    mergeRuntimeCancelability(observations, own.events);
    unresolvedNames += own.unresolvedNames;
  }
  walkAst(module.program, (candidate) => {
    if (candidate.type !== 'ClassDeclaration' && candidate.type !== 'ClassExpression') return;
    for (const dependency of runtimeMixinNamesFromExpression(module, candidate.superClass)) {
      const inherited = runtimeMixinAnalysis(graph, module, dependency, nextSeen);
      mergeRuntimeCancelability(observations, inherited.events);
      unresolvedNames += inherited.unresolvedNames;
    }
  });
  const analysis = runtimeAnalysisFromObservations(observations, unresolvedNames);
  graph.runtimeMixins.set(key, analysis);
  return analysis;
}

function runtimeMixinAnalysisForClass(graph, module, classDeclaration, localName) {
  const analysis = runtimeMixinAnalysis(graph, module, localName);
  const canonicalName = module.imports.get(localName)?.imported ?? localName;
  if (canonicalName !== 'DocumentAnchorTarget') return analysis;
  const classSource = module.source.slice(classDeclaration.start, classDeclaration.end);
  if (/\bbindTextSelection\s*\(/u.test(classSource)) return analysis;
  const events = new Map(analysis.events);
  events.delete('lr-text-select');
  return { events, unresolvedNames: analysis.unresolvedNames };
}

function effectiveClassLiteralBooleanMembers(graph, module, classDeclaration, seen = new Set()) {
  const className = classDeclaration.id?.name;
  const key = `${module.file}#${className ?? '<anonymous>'}`;
  if (seen.has(key)) return new Map();
  seen.add(key);
  const base = resolveBaseClass(graph, module, classDeclaration);
  const members = base
    ? effectiveClassLiteralBooleanMembers(graph, base.module, base.declaration, seen)
    : new Map();
  return literalBooleanMembersForClassBody(classDeclaration.body, members);
}

function effectiveClassRuntimeEventAnalysis(
  graph,
  module,
  classDeclaration,
  seen = new Set(),
  booleanMembers = effectiveClassLiteralBooleanMembers(graph, module, classDeclaration),
) {
  const className = classDeclaration.id?.name;
  const key = `${module.file}#${className ?? '<anonymous>'}`;
  if (seen.has(key)) return { events: new Map(), unresolvedNames: 0 };
  seen.add(key);

  const own = runtimeEventAnalysisFromNode(classDeclaration.body, booleanMembers);
  const observations = new Map();
  mergeRuntimeCancelability(observations, own.events);
  let unresolvedNames = own.unresolvedNames;
  for (const mixin of runtimeMixinNamesFromExpression(module, classDeclaration.superClass)) {
    const mixed = runtimeMixinAnalysisForClass(graph, module, classDeclaration, mixin);
    mergeRuntimeCancelability(observations, mixed.events);
    unresolvedNames += mixed.unresolvedNames;
  }
  const base = resolveBaseClass(graph, module, classDeclaration);
  if (base) {
    const inherited = effectiveClassRuntimeEventAnalysis(
      graph,
      base.module,
      base.declaration,
      seen,
      booleanMembers,
    );
    mergeRuntimeCancelability(observations, inherited.events);
    unresolvedNames += inherited.unresolvedNames;
  }
  return runtimeAnalysisFromObservations(observations, unresolvedNames);
}

function familyFromModulePath(modulePath) {
  return modulePath.match(/^src\/components\/([^/]+)\//)?.[1];
}

export function collectRepositoryEventContracts(root = packageDir, manifestOverride) {
  const manifest = manifestOverride ?? JSON.parse(
    readFileSync(path.join(root, 'custom-elements.json'), 'utf8'),
  );
  const graph = moduleGraph();
  const components = [];

  for (const { modulePath, declaration } of eventContractManifestDeclarations(manifest)) {
    const sourceFile = path.join(root, modulePath);
    if (!existsSync(sourceFile)) continue;
    const module = graph.get(sourceFile);
    const classDeclaration = module.classes.get(declaration.name);
    if (!classDeclaration) {
      throw new Error(
        `${modulePath}: custom-elements.json names class ${declaration.name}, but the source declaration was not found`,
      );
    }
    const eventMap = eventMapForClass(graph, module, classDeclaration);
    const runtimeAnalysis = effectiveClassRuntimeEventAnalysis(
      graph,
      module,
      classDeclaration,
    );
    components.push({
      tag: declaration.tagName,
      className: declaration.name,
      sourceFile: modulePath,
      family: familyFromModulePath(modulePath),
      eventMapName: eventMap?.name,
      directEventMapEvents: eventMap?.direct ?? new Set(),
      effectiveEventMapEvents: eventMap?.effective ?? new Set(),
      directEventMapTypes: eventMap?.directTypes ?? new Map(),
      effectiveEventMapTypes: eventMap?.effectiveTypes ?? new Map(),
      jsdocEvents: effectiveClassJsDocEvents(graph, module, classDeclaration),
      jsdocEventTypes: effectiveClassJsDocEventTypes(graph, module, classDeclaration),
      jsdocEventCancelability: effectiveClassJsDocEventCancelability(
        graph,
        module,
        classDeclaration,
      ),
      cemEvents: new Set((declaration.events ?? []).map((event) => event.name)),
      cemEventTypes: new Map(
        (declaration.events ?? [])
          .filter((event) => typeof event.type?.text === 'string' && event.type.text.trim() !== '')
          .map((event) => [event.name, event.type.text]),
      ),
      cemEventCancelability: new Map(
        (declaration.events ?? []).map((event) => [
          event.name,
          eventCancelabilityFromDescription(event.description, 'lyra', event.name),
        ]),
      ),
      runtimeEventCancelability: runtimeAnalysis.events,
      unresolvedRuntimeEmitCalls: runtimeAnalysis.unresolvedNames,
    });
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


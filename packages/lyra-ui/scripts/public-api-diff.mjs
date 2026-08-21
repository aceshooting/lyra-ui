#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseSync } from 'oxc-parser';
import { expandManifestInheritance } from './manifest-compact.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.dirname(scriptsDir);
const repoRoot = path.resolve(packageDir, '..', '..');
const BUMP_RANK = Object.freeze({ none: 0, patch: 1, minor: 2, major: 3 });
const VALID_BUMPS = new Set(Object.keys(BUMP_RANK));

function normalizeWhitespace(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}()[\],;:?<>])\s*/g, '$1');
}

const PAIRS = Object.freeze({ '(': ')', '[': ']', '{': '}', '<': '>' });

function matchingIndex(text, start) {
  const opening = text[start];
  const closing = PAIRS[opening];
  if (!closing) return -1;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === opening) depth += 1;
    else if (character === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitTopLevel(text, delimiters) {
  const wanted = new Set(Array.isArray(delimiters) ? delimiters : [delimiters]);
  const parts = [];
  let start = 0;
  let quote = '';
  let escaped = false;
  const stack = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (PAIRS[character]) stack.push(PAIRS[character]);
    else if (stack.at(-1) === character) stack.pop();
    else if (stack.length === 0 && wanted.has(character)) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function findTopLevel(text, wanted) {
  let quote = '';
  let escaped = false;
  const stack = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (PAIRS[character]) stack.push(PAIRS[character]);
    else if (stack.at(-1) === character) stack.pop();
    else if (stack.length === 0 && wanted.includes(character)) return index;
  }
  return -1;
}

function stripOuterParens(text) {
  let value = text.trim();
  while (value.startsWith('(') && matchingIndex(value, 0) === value.length - 1) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function normalizeBalancedChildren(text) {
  let output = '';
  let quote = '';
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      output += character;
      continue;
    }
    if (PAIRS[character]) {
      const end = matchingIndex(text, index);
      if (end > index) {
        const inner = text.slice(index + 1, end);
        // A `<...>` generic instantiation's content is a comma-separated ARGUMENT LIST, not a
        // single type -- handing the whole blob to normalizeType() lets its top-level union
        // splitting see straight through the (unbracketed) argument boundaries, merging one
        // argument's bare union with an unrelated argument's bare union into one alphabetized bag
        // and swallowing non-union arguments (an object literal, a bare type reference) into
        // whichever atom they landed next to. The generated framework prop types are exactly
        // `LyraReactElementProps<Host, PropsUnion, {}, EventMap, EventsUnion, CssPropsUnion,
        // AttrAliases>`, so this fired on real component declarations. Split on top-level commas
        // first and normalize each argument independently, then rejoin -- `(` and `[` don't need
        // this: a parenthesized type and an index/tuple type are each a single type, not an
        // argument list, in every place this text originates from.
        const normalizedInner = character === '<'
          ? splitTopLevel(inner, ',').map(normalizeType).join(',')
          : normalizeType(inner);
        output += `${character}${normalizedInner}${PAIRS[character]}`;
        index = end;
        continue;
      }
    }
    output += character;
  }
  return output;
}

function normalizeObjectMember(member) {
  const value = member.trim();
  if (!value) return '';
  const colon = findTopLevel(value, ':');
  if (colon === -1) return normalizeWhitespace(normalizeBalancedChildren(value));
  return `${normalizeWhitespace(value.slice(0, colon))}:${normalizeType(value.slice(colon + 1))}`;
}

export function normalizeType(typeText) {
  let value = stripOuterParens(String(typeText ?? 'unknown'));
  // A leading `|` before the first member (this codebase's generated multi-line union style,
  // `| 'a'\n| 'b'`) carries no meaning of its own. Strip it up front, before counting members:
  // otherwise a union that CURRENTLY has exactly one member normalizes with the bar still
  // attached (splitTopLevel's leading empty segment gets filtered out, so the member count reads
  // as 1 and the code below never takes the union branch that would strip it). That stray "|"
  // then reappears as a bogus empty-string atom when typeAtoms() re-splits the result, so the
  // moment a second member is added the atom-count comparison desyncs and a purely additive
  // change (e.g. a component's event union gaining its second event) reads as breaking.
  value = value.replace(/^\s*\|\s*/, '');
  const union = splitTopLevel(value, '|').map((part) => part.trim()).filter(Boolean);
  if (union.length > 1) return [...new Set(union.map(normalizeType))].sort().join('|');
  const intersection = splitTopLevel(value, '&').map((part) => part.trim()).filter(Boolean);
  if (intersection.length > 1) {
    return [...new Set(intersection.map(normalizeType))].sort().join('&');
  }
  if (value.startsWith('{') && matchingIndex(value, 0) === value.length - 1) {
    const members = splitTopLevel(value.slice(1, -1), [';', ','])
      .map(normalizeObjectMember)
      .filter(Boolean)
      .sort();
    return `{${members.join(';')}}`;
  }
  value = normalizeBalancedChildren(value);
  return normalizeWhitespace(value);
}

function typeAtoms(typeText) {
  return new Set(splitTopLevel(normalizeType(typeText), '|').map(normalizeType));
}

/**
 * A generic instantiation (`Name<A, B, …>`) split into its name and top-level type arguments, or
 * `null` when `text` is not one.
 */
function genericTypeParts(text) {
  const normalized = normalizeType(text);
  const open = normalized.indexOf('<');
  if (open === -1 || !normalized.endsWith('>')) return null;
  const name = normalized.slice(0, open).trim();
  if (name.length === 0) return null;
  const args = splitTopLevel(normalized.slice(open + 1, -1), ',').map(normalizeType);
  return { name, args };
}

const FRAMEWORK_ELEMENT_HELPERS = new Set([
  'LyraReactElementProps',
  'LyraSvelteElementProps',
  'LyraVueCustomElement',
]);

/**
 * The generated framework declarations represent a component with no events as the paired
 * arguments `{}, never`. Its first event changes both arguments to `EventMap, 'lr-event'`.
 * Inside the helpers that pair is consumed together to create optional listener props/emits, so
 * the transition is additive even though `{}` -> `EventMap` is not a generally safe generic
 * widening. Keep this exception bound to the three generated helpers and to the complete pair.
 */
function frameworkEventIntroduction(before, after) {
  if (
    before.name !== after.name ||
    !FRAMEWORK_ELEMENT_HELPERS.has(before.name) ||
    before.args.length !== 7 ||
    after.args.length !== 7
  ) {
    return false;
  }
  return before.args[3] === '{}'
    && after.args[3] !== '{}'
    && before.args[4] === 'never'
    && after.args[4] !== 'never';
}

function uniqueAliasDefinition(typeTextValue, snapshot) {
  const normalized = normalizeType(typeTextValue);
  if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(normalized)) return undefined;
  const definitions = snapshot?.typeAliases?.[normalized];
  return Array.isArray(definitions) && definitions.length === 1
    ? definitions[0]
    : undefined;
}

function resolveUniqueAliases(typeTextValue, snapshot, seen = new Set()) {
  let value = normalizeType(typeTextValue);
  while (!seen.has(value)) {
    const definition = uniqueAliasDefinition(value, snapshot);
    if (definition === undefined) break;
    seen.add(value);
    value = normalizeType(definition);
  }
  return value;
}

/**
 * Whether `after` only widens `before`.
 *
 * Two shapes count. A plain union gaining members is the original rule. The second is a generic
 * instantiation whose NAME and arity are unchanged and whose type arguments are each either
 * identical or themselves a widening -- which is the shape every additive component property
 * produces in the generated framework declarations. `LyraFlagReactProps` is
 * `LyraReactElementProps<…, '{}'|'fidelity'|'label'|…, …>`, so adding one optional property widens
 * a union nested inside a type argument; the top-level text has no `|` at all, so the union rule
 * alone sees a single changed atom and classifies a purely additive property as `major`. Without
 * this, every additive property in the library would demand a major release.
 *
 * Caveat worth stating: this assumes the widened argument sits in a covariant position, which is
 * true for the props-name unions this exists for but is not provable in general. It is the same
 * assumption the plain-union rule above already makes.
 */
/**
 * Members of an object-literal type (`{ 'a'?: X; b: Y }`) as a name -> member map, or `null` when
 * `text` is not a single object literal. Keyed by property name so a member whose type changed
 * reads as a change rather than one removal plus one addition.
 */
function objectTypeMembers(text) {
  const normalized = normalizeType(text);
  if (!normalized.startsWith('{') || !normalized.endsWith('}')) return null;
  const body = normalized.slice(1, -1).trim();
  if (body.length === 0) return new Map();
  const members = new Map();
  for (const raw of splitTopLevel(body, [';', ','])) {
    const member = normalizeType(raw);
    if (member.length === 0) continue;
    const separator = member.indexOf(':');
    if (separator === -1) return null;
    const rawName = member.slice(0, separator).trim();
    if (rawName.length === 0) return null;
    members.set(rawName.replace(/\?$/, ''), {
      optional: rawName.endsWith('?'),
      type: normalizeType(member.slice(separator + 1)),
    });
  }
  return members;
}

/**
 * Whether an object-literal type only GAINED optional members, every pre-existing member keeping
 * its name, optionality and type.
 *
 * This is the `AttributeAliases` argument of the generated framework props: adding one attribute
 * rewrites that whole object's text. A gained REQUIRED member stays major -- that breaks anyone
 * implementing the interface -- as does any change to an existing member.
 */
function isObjectTypeWidening(before, after) {
  const oldMembers = objectTypeMembers(before);
  const newMembers = objectTypeMembers(after);
  if (!oldMembers || !newMembers) return false;
  if (newMembers.size <= oldMembers.size) return false;
  for (const [name, member] of oldMembers) {
    const next = newMembers.get(name);
    if (!next || next.optional !== member.optional || next.type !== member.type) return false;
  }
  for (const [name, member] of newMembers) {
    if (!oldMembers.has(name) && !member.optional) return false;
  }
  return true;
}

function isTypeWidening(before, after, baseline, current) {
  const resolvedBefore = resolveUniqueAliases(before, baseline);
  const resolvedAfter = resolveUniqueAliases(after, current);
  if (resolvedBefore !== normalizeType(before) || resolvedAfter !== normalizeType(after)) {
    return isTypeWidening(resolvedBefore, resolvedAfter, baseline, current);
  }
  if (isObjectTypeWidening(before, after)) return true;
  const oldAtoms = typeAtoms(before);
  const newAtoms = typeAtoms(after);
  if (oldAtoms.size < newAtoms.size && [...oldAtoms].every((atom) => newAtoms.has(atom))) {
    return true;
  }

  // A union can widen on two axes at once: it gains atoms AND one of its existing atoms is itself
  // widened. The generated framework prop types do exactly this -- each is
  // `{'attr-name'?: T; ...} | 'propName' | ...`, so adding ONE component property appends an
  // optional key to the union's object member and appends a literal beside it, in the same edit.
  // The verbatim-superset check above only sees the second axis, so the mutated object atom reads
  // as a removal and the whole type reports as breaking. That single gap produced 39 `:type` plus
  // 39 `:contract` false majors in the 10.0.1 -> 11.0.0 diff.
  //
  // Pair the leftovers up instead: every old atom that did not survive verbatim must be widened by
  // some new atom that is itself unaccounted for, and each new atom may only settle one old atom.
  // An old atom with no widened counterpart -- a genuine removal -- still fails, as does an atom
  // that narrowed.
  // Only when at least one side actually decomposed into multiple atoms. A non-union decomposes to
  // a single atom that IS the input, so pairing it against the other side's single atom would
  // re-enter this branch with the same two strings forever -- a real stack overflow, caught by the
  // existing suite. `typeAtoms()` splits on top-level `|`, so an atom never contains one itself and
  // the recursion below always terminates one level down.
  const decomposedIntoUnion = oldAtoms.size > 1 || newAtoms.size > 1;
  if (decomposedIntoUnion && oldAtoms.size <= newAtoms.size) {
    const dropped = [...oldAtoms].filter((atom) => !newAtoms.has(atom));
    const added = [...newAtoms].filter((atom) => !oldAtoms.has(atom));
    if (dropped.length > 0 && dropped.length <= added.length) {
      const unclaimed = new Set(added);
      const everyDroppedAtomWidened = dropped.every((oldAtom) => {
        for (const candidate of unclaimed) {
          if (isTypeWidening(oldAtom, candidate, baseline, current)) {
            unclaimed.delete(candidate);
            return true;
          }
        }
        return false;
      });
      if (everyDroppedAtomWidened) return true;
    }
  }

  const beforeGeneric = genericTypeParts(before);
  const afterGeneric = genericTypeParts(after);
  if (
    !beforeGeneric ||
    !afterGeneric ||
    beforeGeneric.name !== afterGeneric.name ||
    beforeGeneric.args.length !== afterGeneric.args.length
  ) {
    return false;
  }
  const firstFrameworkEvent = frameworkEventIntroduction(beforeGeneric, afterGeneric);
  let widened = false;
  for (const [index, beforeArg] of beforeGeneric.args.entries()) {
    const afterArg = afterGeneric.args[index];
    if (beforeArg === afterArg) continue;
    if (firstFrameworkEvent && (index === 3 || index === 4)) {
      widened = true;
      continue;
    }
    if (!isTypeWidening(beforeArg, afterArg, baseline, current)) return false;
    widened = true;
  }
  return widened;
}

function normalizeDefault(value) {
  if (value === undefined) return null;
  return normalizeWhitespace(value);
}

function typeText(value) {
  return normalizeType(value?.text ?? value ?? 'unknown');
}

function eventCancelability(event) {
  if (event.cancelable === true || event.cancelable === 'always') return true;
  if (event.cancelable === false || event.cancelable === 'never') return false;
  const description = String(event.description ?? '');
  if (/\b(?:(?:not|never)\s+cancelable|non[- ]?cancelable)\b/i.test(description)) return false;
  if (/\bcancelable\b/i.test(description)) return true;
  return undefined;
}

function addEntry(entries, id, surface, semantic, value, label = id) {
  const entry = { surface, semantic, value, label };
  if (entries.has(id)) {
    if (JSON.stringify(entries.get(id)) === JSON.stringify(entry)) return;
    throw new Error(`Duplicate normalized public API entry: ${id}`);
  }
  entries.set(id, entry);
}

function addPresence(entries, id, surface, label = id) {
  addEntry(entries, id, surface, 'presence', true, label);
}

function normalizeParameterText(parameter) {
  const value = parameter.trim();
  const colon = findTopLevel(value, ':');
  const left = colon === -1 ? value : value.slice(0, colon).trim();
  const right = colon === -1 ? 'unknown' : value.slice(colon + 1).trim();
  const equals = findTopLevel(right, '=');
  const type = equals === -1 ? right : right.slice(0, equals);
  const rawName = left.replace(/^\.\.\./, '').replace(/[?=].*$/, '').trim();
  return [
    left.startsWith('...') ? 'rest' : 'value',
    rawName,
    left.includes('?') || equals !== -1 ? 'optional' : 'required',
    normalizeType(type),
  ].join(':');
}

function findTopLevelOpeningParen(text) {
  let quote = '';
  let escaped = false;
  const stack = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '(' && stack.length === 0) return index;
    if (PAIRS[character]) stack.push(PAIRS[character]);
    else if (stack.at(-1) === character) stack.pop();
  }
  return -1;
}

function cleanPublicName(value) {
  const name = value
    .trim()
    .replace(/^readonly\s+/, '')
    .replace(/\?$/, '')
    .trim();
  if ((name.startsWith("'") && name.endsWith("'")) || (name.startsWith('"') && name.endsWith('"'))) {
    return name.slice(1, -1);
  }
  return normalizeWhitespace(name);
}

function parseTypeMember(member) {
  const value = member.trim();
  const readonly = /^readonly\s+/.test(value);
  const withoutReadonly = value.replace(/^readonly\s+/, '').trim();
  const openingParen = findTopLevelOpeningParen(withoutReadonly);
  if (openingParen !== -1) {
    const closingParen = matchingIndex(withoutReadonly, openingParen);
    const before = withoutReadonly.slice(0, openingParen).trim();
    const after = withoutReadonly.slice(closingParen + 1).trim().replace(/^:/, '').trim();
    const parameters = splitTopLevel(withoutReadonly.slice(openingParen + 1, closingParen), ',')
      .map((parameter) => parameter.trim())
      .filter(Boolean)
      .map(normalizeParameterText);
    return {
      kind: before === '' ? 'call' : 'method',
      name: cleanPublicName(before || 'call'),
      optional: before.endsWith('?'),
      readonly,
      parameters,
      type: after || 'unknown',
    };
  }
  const colon = findTopLevel(withoutReadonly, ':');
  const rawName = colon === -1 ? withoutReadonly : withoutReadonly.slice(0, colon).trim();
  return {
    kind: rawName.startsWith('[') ? 'index' : 'property',
    name: cleanPublicName(rawName || 'property'),
    optional: rawName.endsWith('?'),
    readonly,
    type: colon === -1 ? 'unknown' : withoutReadonly.slice(colon + 1),
  };
}

function typeLiteralBody(typeText) {
  const value = stripOuterParens(String(typeText ?? 'unknown'));
  return value.startsWith('{') && matchingIndex(value, 0) === value.length - 1
    ? value.slice(1, -1)
    : undefined;
}

function addTypeSurface(entries, baseId, surface, typeTextValue, label) {
  const body = typeLiteralBody(typeTextValue);
  if (body !== undefined) {
    addEntry(entries, `${baseId}:type-kind`, surface, 'shape', 'object', label);
    for (const rawMember of splitTopLevel(body, [';', ',']).map((value) => value.trim()).filter(Boolean)) {
      const member = parseTypeMember(rawMember);
      const memberBase = `${baseId}:${member.kind}:${member.name}`;
      addPresence(entries, memberBase, surface, `${label} ${member.name}`);
      addEntry(entries, `${memberBase}:optional`, surface, 'optional', member.optional, label);
      addEntry(
        entries,
        `${memberBase}:readonly`,
        surface,
        'readonly',
        member.readonly,
        label,
      );
      if (member.parameters) {
        addEntry(
          entries,
          `${memberBase}:parameters`,
          surface,
          'parameters',
          member.parameters,
          label,
        );
      }
      addTypeSurface(entries, memberBase, surface, member.type, label);
    }
    return;
  }

  addEntry(
    entries,
    `${baseId}:type`,
    surface,
    'type',
    normalizeType(typeTextValue),
    label,
  );
}

function normalizeManifest(manifest, entries) {
  for (const module of manifest?.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (!declaration.customElement || !declaration.tagName) continue;
      const tagName = declaration.tagName;
      const elementBase = `cem:${tagName}`;
      addPresence(entries, elementBase, 'cem', `<${tagName}>`);

      for (const member of declaration.members ?? []) {
        if (member.privacy === 'private') continue;
        const kind = member.kind ?? 'field';
        const normalizedParameters = (member.parameters ?? []).map((parameter) => ({
          name: parameter.name,
          type: typeText(parameter.type),
          optional: Boolean(parameter.optional || parameter.default !== undefined),
          default: normalizeDefault(parameter.default),
        }));
        const signature = kind === 'method'
          ? `(${normalizedParameters.map((parameter) =>
            `${parameter.name}:${parameter.optional ? '?' : ''}${parameter.type}`).join(',')})`
          : '';
        const memberBase = `${elementBase}:member:${kind}:${member.name}${signature}`;
        addPresence(entries, memberBase, 'cem', `${tagName}.${member.name}`);
        addEntry(entries, `${memberBase}:type`, 'cem', 'type', typeText(member.type), memberBase);
        addEntry(
          entries,
          `${memberBase}:privacy`,
          'cem',
          'privacy',
          member.privacy ?? 'public',
          memberBase,
        );
        addEntry(
          entries,
          `${memberBase}:readonly`,
          'cem',
          'readonly',
          Boolean(member.readonly),
          memberBase,
        );
        addEntry(
          entries,
          `${memberBase}:static`,
          'cem',
          'static',
          Boolean(member.static),
          memberBase,
        );
        addEntry(
          entries,
          `${memberBase}:default`,
          'cem',
          'default',
          normalizeDefault(member.default),
          memberBase,
        );
        addEntry(
          entries,
          `${memberBase}:attribute`,
          'cem',
          'attribute',
          member.attribute ?? null,
          memberBase,
        );
        addEntry(
          entries,
          `${memberBase}:reflects`,
          'cem',
          'reflects',
          Boolean(member.reflects),
          memberBase,
        );
        if (kind === 'method') {
          addEntry(
            entries,
            `${memberBase}:parameters`,
            'cem',
            'parameters',
            normalizedParameters,
            memberBase,
          );
          addEntry(
            entries,
            `${memberBase}:return`,
            'cem',
            'type',
            typeText(member.return?.type ?? member.return),
            memberBase,
          );
        }
      }

      for (const attribute of declaration.attributes ?? []) {
        const base = `${elementBase}:attribute:${attribute.name}`;
        addPresence(entries, base, 'cem', `${tagName}[${attribute.name}]`);
        addEntry(entries, `${base}:type`, 'cem', 'type', typeText(attribute.type), base);
        addEntry(
          entries,
          `${base}:default`,
          'cem',
          'default',
          normalizeDefault(attribute.default),
          base,
        );
        addEntry(entries, `${base}:field`, 'cem', 'field', attribute.fieldName ?? null, base);
      }

      for (const event of declaration.events ?? []) {
        const base = `${elementBase}:event:${event.name}`;
        addPresence(entries, base, 'cem', `${tagName} ${event.name}`);
        addEntry(entries, `${base}:type`, 'cem', 'type', typeText(event.type), base);
        const cancelable = eventCancelability(event);
        if (cancelable !== undefined) {
          addEntry(
            entries,
            `${base}:cancelable`,
            'cem',
            'cancelable',
            cancelable,
            base,
          );
        }
      }

      for (const [collection, segment] of [
        ['slots', 'slot'],
        ['cssParts', 'css-part'],
        ['cssProperties', 'css-property'],
        ['cssStates', 'css-state'],
      ]) {
        for (const item of declaration[collection] ?? []) {
          const publicName = item.name === '' ? '(default)' : item.name;
          const base = `${elementBase}:${segment}:${publicName}`;
          addPresence(entries, base, 'cem', `${tagName} ${segment} ${publicName}`);
          if (collection === 'cssProperties') {
            addEntry(
              entries,
              `${base}:default`,
              'cem',
              'default',
              normalizeDefault(item.default),
              base,
            );
          }
        }
      }
    }
  }
}

function normalizeExports(exportsValue, entries, packageFiles = []) {
  const normalizedPackageFiles = [...new Set(packageFiles)]
    .map((file) => `./${String(file).replace(/^\.\//, '').replaceAll(path.sep, '/')}`)
    .sort();
  const wildcardExpansions = [];
  const targets = new Map();

  const addTarget = (specifier, condition, value, label = `${specifier} (${condition})`) => {
    const id = `package-export:${specifier}:${condition}`;
    if (!entries.has(id)) {
      addEntry(entries, id, 'package-export', 'target', value, label);
      targets.set(id, { specifier, condition, target: value });
    }
  };

  const expandWildcard = (specifier, condition, target) => {
    if (!specifier.includes('*') || !target.includes('*')) return;
    const [targetPrefix, targetSuffix] = target.split('*');
    for (const packageFile of normalizedPackageFiles) {
      if (!packageFile.startsWith(targetPrefix) || !packageFile.endsWith(targetSuffix)) continue;
      // Broad runtime wildcards also match the declaration siblings that happen to be packed.
      // Those are type authorities for the `.js` route, not a second supported `.d.ts` import
      // surface. Explicit `types` wildcard conditions remain eligible.
      if (
        !condition.split('.').includes('types')
        && /\.d\.[cm]?ts$/u.test(packageFile)
      ) {
        continue;
      }
      const captured = packageFile.slice(
        targetPrefix.length,
        packageFile.length - targetSuffix.length || undefined,
      );
      const publicSpecifier = specifier.replaceAll('*', captured);
      const publicTarget = target.replaceAll('*', captured);
      wildcardExpansions.push({
        publicSpecifier,
        condition,
        publicTarget,
        specificity: specifier.length,
      });
    }
  };

  const addWildcardExpansions = () => {
    wildcardExpansions
      .sort((left, right) => right.specificity - left.specificity)
      .forEach(({ publicSpecifier, condition, publicTarget }) =>
        addTarget(publicSpecifier, condition, publicTarget));
  };

  const walk = (specifier, value, conditions = []) => {
    if (typeof value === 'string' || value === null) {
      const condition = conditions.length > 0 ? conditions.join('.') : 'default';
      addTarget(specifier, condition, value);
      if (typeof value === 'string') expandWildcard(specifier, condition, value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(specifier, item, [...conditions, String(index)]));
      return;
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      for (const key of keys) {
        walk(specifier, value[key], [...conditions, key]);
      }
      if (keys.length > 1) {
        const orderId = `package-export:${specifier}:${conditions.join('.') || 'root'}:condition-order`;
        if (!entries.has(orderId)) {
          addEntry(entries, orderId, 'package-export', 'order', keys, `${specifier} condition order`);
        }
      }
    }
  };

  if (typeof exportsValue === 'string' || Array.isArray(exportsValue)) {
    walk('.', exportsValue);
    addWildcardExpansions();
    return [...targets.values()];
  }
  const rootKeys = Object.keys(exportsValue ?? {});
  if (rootKeys.length > 0 && rootKeys.every((key) => !key.startsWith('.'))) {
    // Node's conditional-main sugar: an object whose keys are all conditions is the `.` export,
    // not a collection of bare package specifiers named `types`, `import`, or `default`.
    walk('.', exportsValue);
  } else {
    for (const specifier of rootKeys.sort()) {
      walk(specifier, exportsValue[specifier]);
    }
  }
  addWildcardExpansions();
  return [...targets.values()];
}

function normalizedFileKey(file) {
  return path.posix
    .normalize(String(file).replaceAll('\\', '/'))
    .replace(/^\.\//, '');
}

function nodeText(module, node) {
  return node && Number.isInteger(node.start) && Number.isInteger(node.end)
    ? module.source.slice(node.start, node.end)
    : '';
}

function propertyName(node, module) {
  if (!node) return undefined;
  if (node.type === 'Identifier' || node.type === 'PrivateIdentifier') return node.name;
  if (node.type === 'Literal') return String(node.value);
  const text = nodeText(module, node);
  return text ? normalizeWhitespace(text) : undefined;
}

function declarationName(node, module) {
  if (!node) return undefined;
  if (node.type === 'VariableDeclarator') return propertyName(node.id, module);
  if (node.type === 'TSModuleDeclaration') return entityNameParts(node.id)[0];
  return propertyName(node.id, module);
}

function declarationKind(node) {
  if (node?.type === 'TSInterfaceDeclaration' || node?.type === 'TSTypeAliasDeclaration') {
    return 'type';
  }
  return 'value';
}

function declarationRecords(node, module) {
  if (!node) return [];
  if (node.type === 'VariableDeclaration') {
    return (node.declarations ?? [])
      .map((declaration) => ({ node: declaration, name: declarationName(declaration, module) }))
      .filter((record) => record.name);
  }
  const name = declarationName(node, module);
  return name ? [{ node, name }] : [];
}

function symbolPathKey(parts) {
  return JSON.stringify(parts);
}

const MODULE_NAMESPACE_SEGMENT = '\0module';
const ANONYMOUS_DEFAULT_SEGMENT = '\0default';

function rememberSymbol(module, parts, record) {
  const key = symbolPathKey(parts);
  const records = module.symbols.get(key) ?? [];
  records.push({ ...record, path: parts });
  module.symbols.set(key, records);
  if (parts.length === 1) {
    const topLevel = module.declarations.get(parts[0]) ?? [];
    topLevel.push({ ...record, path: parts });
    module.declarations.set(parts[0], topLevel);
  }
}

function ensureNamespace(module, parts, node) {
  const key = symbolPathKey(parts);
  const namespace = module.namespaces.get(key) ?? {
    path: parts,
    records: [],
    members: new Map(),
  };
  if (node && !namespace.records.some((record) => record.node === node)) {
    namespace.records.push({ node, name: parts.at(-1), path: parts });
  }
  module.namespaces.set(key, namespace);
  return namespace;
}

function exposeNamespaceMember(module, parentPath, exportedName, binding) {
  const namespace = ensureNamespace(module, parentPath);
  namespace.members.set(exportedName, binding);
}

function indexDeclaration(module, declaration, context = [], exported = false) {
  if (!declaration) return [];
  if (declaration.type === 'TSModuleDeclaration') {
    const ownParts = entityNameParts(declaration.id);
    if (ownParts.length === 0) return [];
    const fullPath = [...context, ...ownParts];
    for (let index = 0; index < ownParts.length; index += 1) {
      const namespacePath = [...context, ...ownParts.slice(0, index + 1)];
      ensureNamespace(
        module,
        namespacePath,
        index === ownParts.length - 1 ? declaration : undefined,
      );
      if ((index > 0 || exported) && namespacePath.length > 1) {
        exposeNamespaceMember(
          module,
          namespacePath.slice(0, -1),
          namespacePath.at(-1),
          { kind: 'value', localPath: namespacePath },
        );
      }
    }
    if (declaration.body?.type === 'TSModuleBlock') {
      for (const statement of declaration.body.body ?? []) {
        if (statement.type === 'ExportNamedDeclaration') {
          if (statement.declaration) {
            indexDeclaration(module, statement.declaration, fullPath, true);
          } else {
            for (const specifier of statement.specifiers ?? []) {
              const exportedName = propertyName(specifier.exported, module);
              const localName = propertyName(specifier.local, module);
              if (!exportedName || !localName) continue;
              exposeNamespaceMember(module, fullPath, exportedName, {
                kind:
                  statement.exportKind === 'type' || specifier.exportKind === 'type'
                    ? 'type'
                    : 'value',
                localPath: [...fullPath, localName],
                source: statement.source?.value ?? null,
              });
            }
          }
        } else if (statement.type === 'ExportAllDeclaration') {
          // Namespace export-stars are rare in declaration output. Keep the explicit namespace
          // alias form resolvable; plain stars are represented on external modules below.
          const exportedName = propertyName(statement.exported, module);
          if (exportedName) {
            exposeNamespaceMember(module, fullPath, exportedName, {
              kind: statement.exportKind === 'type' ? 'type' : 'value',
              local: '*',
              source: statement.source.value,
            });
          }
        } else {
          indexDeclaration(module, statement, fullPath, false);
        }
      }
    } else if (declaration.body?.type === 'TSModuleDeclaration') {
      indexDeclaration(module, declaration.body, fullPath, true);
    }
    return [{ name: ownParts[0], path: [...context, ownParts[0]], node: declaration }];
  }

  const indexed = [];
  for (const record of declarationRecords(declaration, module)) {
    const parts = [...context, record.name];
    rememberSymbol(module, parts, record);
    if (exported && context.length > 0) {
      exposeNamespaceMember(module, context, record.name, {
        kind: declarationKind(record.node),
        localPath: parts,
      });
    }
    indexed.push({ ...record, path: parts });
  }
  return indexed;
}

function augmentationModuleName(module, node) {
  if (node.global || node.kind === 'global') return 'global';
  if (node.id?.type === 'Literal' && typeof node.id.value === 'string') return node.id.value;
  return undefined;
}

function augmentationDeclarations(module) {
  const declarations = [];
  const visit = (node, moduleName, namespace = []) => {
    if (!node) return;
    if (node.type === 'TSModuleDeclaration') {
      const augmentation = augmentationModuleName(module, node);
      const nextModule = augmentation ?? moduleName;
      const nextNamespace = augmentation
        ? []
        : [...namespace, ...entityNameParts(node.id)];
      if (node.body?.type === 'TSModuleBlock') {
        for (const statement of node.body.body ?? []) {
          visit(
            statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement,
            nextModule,
            nextNamespace,
          );
        }
      } else {
        visit(node.body, nextModule, nextNamespace);
      }
      return;
    }
    if (!moduleName) return;
    for (const record of declarationRecords(node, module)) {
      declarations.push({
        moduleName,
        namespace,
        resolved: {
          module,
          records: [record],
          path: [`augmentation:${moduleName}`, ...namespace, record.name],
        },
      });
    }
  };
  module.body.forEach((statement) => visit(statement, undefined));
  return declarations;
}

function nodePositionKey(node) {
  return node && Number.isInteger(node.start) && Number.isInteger(node.end)
    ? `${node.start}:${node.end}`
    : undefined;
}

function leftmostEntityIdentifier(node) {
  if (!node) return undefined;
  if (node.type === 'Identifier') return node;
  if (node.type === 'TSQualifiedName') return leftmostEntityIdentifier(node.left);
  if (node.type === 'MemberExpression' && !node.computed) {
    return leftmostEntityIdentifier(node.object);
  }
  return undefined;
}

/** Record alpha-equivalent names for every TypeScript type binder. Names are keyed by AST
 * position, not by spelling, so a nested binder may shadow an outer binder without conflating the
 * two. The depth/index pair is deterministic across spelling-only edits. */
function collectTypeBinderNames(module) {
  const canonical = new Map();
  const resolveBinder = (scopes, name) => {
    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      if (scopes[index].has(name)) return scopes[index].get(name);
    }
    return undefined;
  };
  const rememberReference = (entity, scopes) => {
    const identifier = leftmostEntityIdentifier(entity);
    const replacement = identifier && resolveBinder(scopes, identifier.name);
    const key = nodePositionKey(identifier);
    if (replacement && key) canonical.set(key, replacement);
  };
  const inferParameters = (node, output = []) => {
    if (!node || typeof node !== 'object') return output;
    if (node.type === 'TSInferType' && node.typeParameter) output.push(node.typeParameter);
    for (const [key, child] of Object.entries(node)) {
      if (key === 'type' || key === 'start' || key === 'end') continue;
      if (Array.isArray(child)) child.forEach((item) => inferParameters(item, output));
      else inferParameters(child, output);
    }
    return output;
  };
  const binderScope = (parameters, depth) => {
    const scope = new Map();
    for (const [index, parameter] of parameters.entries()) {
      const name = propertyName(parameter.name, module);
      if (!name) continue;
      const replacement = `T${depth}_${index}`;
      scope.set(name, replacement);
      const key = nodePositionKey(parameter.name);
      if (key) canonical.set(key, replacement);
    }
    return scope;
  };
  const visit = (value, scopes = [], handledTypeParameters = false) => {
    if (!value || typeof value !== 'object') return;

    if (value.type === 'TSConditionalType') {
      visit(value.checkType, scopes);
      const parameters = inferParameters(value.extendsType);
      const scope = binderScope(parameters, scopes.length);
      visit(value.extendsType, [...scopes, scope]);
      visit(value.trueType, [...scopes, scope]);
      visit(value.falseType, scopes);
      return;
    }

    if (value.type === 'TSMappedType') {
      visit(value.constraint, scopes);
      const parameter = { name: value.key };
      const scope = binderScope([parameter], scopes.length);
      visit(value.nameType, [...scopes, scope]);
      visit(value.typeAnnotation, [...scopes, scope]);
      return;
    }

    let activeScopes = scopes;
    const parameters = handledTypeParameters ? [] : value.typeParameters?.params ?? [];
    if (parameters.length > 0) {
      const scope = binderScope(parameters, scopes.length);
      activeScopes = [...scopes, scope];
      for (const parameter of parameters) {
        visit(parameter.constraint, activeScopes);
        visit(parameter.default, activeScopes);
      }
    }

    if (value.type === 'TSTypeReference') rememberReference(value.typeName, activeScopes);
    else if (value.type === 'TSInterfaceHeritage' || value.type === 'TSClassImplements') {
      rememberReference(value.expression, activeScopes);
    } else if (value.type === 'ClassDeclaration') {
      rememberReference(value.superClass, activeScopes);
    }

    for (const [key, child] of Object.entries(value)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'typeParameters') continue;
      if (Array.isArray(child)) child.forEach((item) => visit(item, activeScopes));
      else visit(child, activeScopes);
    }
  };
  module.body.forEach((statement) => visit(statement));
  return canonical;
}

function parseDeclarationModule(file, source, { publicGraph = false } = {}) {
  const parsed = parseSync(file, source, { lang: 'ts', sourceType: 'module' });
  if (parsed.errors.length > 0) {
    const details = parsed.errors.map((error) => error.message ?? String(error)).join('\n');
    throw new SyntaxError(`${file} could not be parsed:\n${details}`);
  }
  if (publicGraph) {
    const explicitlyUnsupported = parsed.program.body.find((statement) =>
      statement.type === 'TSNamespaceExportDeclaration'
        || statement.type === 'TSExportAssignment');
    if (explicitlyUnsupported) {
      throw new SyntaxError(
        `Unsupported public declaration form in ${file}: ${explicitlyUnsupported.type}.`,
      );
    }
    const isExternalModule = parsed.program.body.some((statement) =>
      statement.type === 'ImportDeclaration'
        || statement.type === 'ExportNamedDeclaration'
        || statement.type === 'ExportDefaultDeclaration'
        || statement.type === 'ExportAllDeclaration');
    const unsupportedGlobalScriptStatement = !isExternalModule
      && parsed.program.body.find((statement) =>
        statement.type !== 'EmptyStatement'
          && !(statement.type === 'TSModuleDeclaration'
            && statement.id?.type === 'Literal'
            && typeof statement.id.value === 'string'));
    if (unsupportedGlobalScriptStatement) {
      throw new SyntaxError(
        `Unsupported public declaration form in ${file}: global-script ${unsupportedGlobalScriptStatement.type}.`,
      );
    }
  }
  const module = {
    file,
    source,
    body: parsed.program.body,
    declarations: new Map(),
    directExports: new Map(),
    exportStars: [],
    moduleReferences: [],
    externalReExports: [],
    imports: new Map(),
    canonicalTypeNames: new Map(),
    symbols: new Map(),
    namespaces: new Map(),
    binderNames: new Map(),
    resolveImportSource: undefined,
    resolveImportedTypeName: undefined,
    resolveImportTypeIdentity: undefined,
    augmentations: [],
  };

  for (const statement of module.body) {
    if (statement.type === 'ImportDeclaration') {
      module.moduleReferences.push(statement.source.value);
      for (const specifier of statement.specifiers ?? []) {
        const local = propertyName(specifier.local, module);
        if (!local) continue;
        const imported = specifier.type === 'ImportDefaultSpecifier'
          ? 'default'
          : specifier.type === 'ImportNamespaceSpecifier'
            ? '*'
            : propertyName(specifier.imported, module);
        module.imports.set(local, { imported, source: statement.source.value });
        if (imported) {
          module.canonicalTypeNames.set(local, imported === '*' ? '$namespace' : imported);
        }
      }
      continue;
    }

    if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
      const records = indexDeclaration(module, statement.declaration, [], true);
      for (const record of records) {
        module.directExports.set(record.name, {
          kind:
            statement.exportKind === 'type'
              ? 'type'
              : declarationKind(record.node),
          localPath: record.path,
          source: null,
        });
      }
    } else if (statement.type === 'ExportNamedDeclaration') {
      if (statement.source) module.moduleReferences.push(statement.source.value);
      for (const specifier of statement.specifiers ?? []) {
        const exported = propertyName(specifier.exported, module);
        const local = propertyName(specifier.local, module);
        if (!exported || !local) continue;
        module.directExports.set(exported, {
          local,
          source: statement.source?.value ?? null,
          kind:
            statement.exportKind === 'type' || specifier.exportKind === 'type'
              ? 'type'
              : 'value',
        });
        if (statement.source && !String(statement.source.value).startsWith('.')) {
          module.externalReExports.push({
            exported,
            imported: local,
            kind:
              statement.exportKind === 'type' || specifier.exportKind === 'type'
                ? 'type'
                : 'value',
            source: statement.source.value,
            mode: 'named',
          });
        }
      }
    } else if (statement.type === 'ExportDefaultDeclaration') {
      const declaration = statement.declaration;
      if (declaration?.type === 'Identifier') {
        module.directExports.set('default', {
          local: declaration.name,
          source: null,
          kind: 'value',
        });
      } else if (declaration) {
        const name = declarationName(declaration, module);
        if (name) {
          indexDeclaration(module, declaration);
          module.directExports.set('default', {
            localPath: [name],
            source: null,
            kind: declarationKind(declaration),
          });
        } else {
          const record = { node: declaration, name: 'default' };
          rememberSymbol(module, [ANONYMOUS_DEFAULT_SEGMENT], record);
          module.directExports.set('default', {
            localPath: [ANONYMOUS_DEFAULT_SEGMENT],
            source: null,
            kind: declarationKind(declaration),
          });
        }
      }
    } else if (statement.type === 'ExportAllDeclaration') {
      module.moduleReferences.push(statement.source.value);
      if (statement.exported) {
        const exported = propertyName(statement.exported, module);
        if (exported) {
          module.directExports.set(exported, {
            local: '*',
            source: statement.source.value,
            kind: statement.exportKind === 'type' ? 'type' : 'value',
            namespace: true,
          });
        }
        if (!String(statement.source.value).startsWith('.')) {
          module.externalReExports.push({
            exported: propertyName(statement.exported, module),
            imported: '*',
            kind: statement.exportKind === 'type' ? 'type' : 'value',
            source: statement.source.value,
            mode: 'namespace',
          });
        }
      } else {
        module.exportStars.push({
          source: statement.source.value,
          kind: statement.exportKind === 'type' ? 'type' : 'value',
        });
        if (!String(statement.source.value).startsWith('.')) {
          module.externalReExports.push({
            exported: '*',
            imported: '*',
            kind: statement.exportKind === 'type' ? 'type' : 'value',
            source: statement.source.value,
            mode: 'star',
          });
        }
      }
    } else {
      indexDeclaration(module, statement);
    }
  }
  module.binderNames = collectTypeBinderNames(module);
  module.augmentations = augmentationDeclarations(module);
  return module;
}

function resolveDeclarationFile(files, fromFile, specifier) {
  if (typeof specifier !== 'string' || !specifier.startsWith('.')) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = [base];
  if (/\.mjs$/.test(base)) candidates.push(base.replace(/\.mjs$/, '.d.mts'));
  if (/\.cjs$/.test(base)) candidates.push(base.replace(/\.cjs$/, '.d.cts'));
  if (/\.js$/.test(base)) candidates.push(base.replace(/\.js$/, '.d.ts'));
  if (!/\.(?:d\.)?[cm]?[jt]s$/.test(base)) {
    candidates.push(`${base}.d.ts`, path.posix.join(base, 'index.d.ts'));
  }
  return candidates.find((candidate) => files.has(normalizedFileKey(candidate)));
}

function declarationGraph(filesValue) {
  const files = new Map(
    Object.entries(filesValue ?? {}).map(([file, source]) => [normalizedFileKey(file), source]),
  );
  const moduleCache = new Map();
  const exportCache = new Map();
  const getModule = (file) => {
    const key = normalizedFileKey(file);
    if (!files.has(key)) return undefined;
    if (!moduleCache.has(key)) {
      const module = parseDeclarationModule(key, files.get(key), { publicGraph: true });
      module.resolveImportSource = (source) => resolveDeclarationFile(files, key, source);
      module.resolveImportedTypeName = (localName, position) => {
        const containingNamespaces = [...module.namespaces.values()]
          .filter((namespace) => namespace.records.some(({ node }) =>
            node.start <= position && position <= node.end))
          .sort((left, right) => right.path.length - left.path.length);
        if (containingNamespaces.some((namespace) =>
          resolveLocalDeclaration(module, [...namespace.path, localName]))) {
          return localName;
        }
        const imported = module.imports.get(localName);
        if (!imported || imported.imported === '*') return undefined;
        const target = resolveDeclarationFile(files, key, imported.source);
        const resolved = target
          ? resolveExportDeclaration(graph, target, imported.imported)
          : undefined;
        return resolved?.path?.at(-1) ?? resolved?.records[0]?.name;
      };
      module.resolveImportTypeIdentity = (source, qualifier) => {
        const target = resolveDeclarationFile(files, key, source);
        if (!target) return undefined;
        const resolved = qualifier.length > 0
          ? resolveQualifiedExportDeclaration(graph, target, qualifier)
          : resolveModuleNamespace(graph, target);
        return resolved
          ? { file: resolved.module.file, qualifier: resolved.moduleNamespace ? [] : resolved.path }
          : { file: target, qualifier };
      };
      moduleCache.set(key, module);
    }
    return moduleCache.get(key);
  };
  const getExports = (file, ancestry = new Set()) => {
    const key = normalizedFileKey(file);
    if (exportCache.has(key)) return exportCache.get(key);
    if (ancestry.has(key)) return new Map();
    const module = getModule(key);
    if (!module) return new Map();
    const table = new Map(module.directExports);
    exportCache.set(key, table);
    const nextAncestry = new Set(ancestry).add(key);
    for (const star of module.exportStars) {
      const target = resolveDeclarationFile(files, key, star.source);
      if (!target) continue;
      for (const [name, binding] of getExports(target, nextAncestry)) {
        if (name === 'default' || table.has(name)) continue;
        table.set(name, {
          local: name,
          source: star.source,
          kind: star.kind === 'type' ? 'type' : binding.kind,
        });
      }
    }
    return table;
  };
  const graph = {
    files,
    modules: moduleCache,
    getModule,
    getExports,
    declarationSurfaceCache: new Map(),
    declarationContractCache: new Map(),
    dependencyContractCache: new Map(),
    dependencyEdgeDefinitions: new Map(),
    dependencyIdCache: new Map(),
    dependencyDefinitions: new Map(),
    reachableDefinitions: new Map(),
    contractIdCache: new Map(),
    contractDefinitions: new Map(),
    referencedTypeCache: new Map(),
    typeDependencyCache: new Map(),
    moduleDependencyCache: new Map(),
    directDependencyCache: new Map(),
  };
  return graph;
}

/**
 * Retain unique, non-generic alias definitions as semantic comparison aids. Public members often
 * adopt a newly named union while preserving their old atom (`number` -> `ZoomValue`, where
 * `ZoomValue = number | Stops`). Comparing only printed text calls that breaking. Duplicate names
 * with different definitions remain as multiple candidates and deliberately cannot be resolved.
 */
function normalizedTypeAliases(graph) {
  const aliases = new Map();
  for (const module of graph?.modules?.values() ?? []) {
    for (const records of module.symbols.values()) {
      for (const record of records) {
        const node = record.node;
        if (
          node.type !== 'TSTypeAliasDeclaration' ||
          (node.typeParameters?.params?.length ?? 0) > 0
        ) {
          continue;
        }
        const definition = typeNodeText(module, node.typeAnnotation);
        const names = new Set([
          record.name,
          ...(record.path?.length > 1 ? [record.path.join('.')] : []),
        ]);
        for (const name of names) {
          if (!name || name.includes(MODULE_NAMESPACE_SEGMENT)) continue;
          const definitions = aliases.get(name) ?? new Set();
          definitions.add(definition);
          aliases.set(name, definitions);
        }
      }
    }
  }
  return Object.fromEntries(
    [...aliases]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, definitions]) => [name, [...definitions].sort()]),
  );
}

function resolveLocalDeclaration(module, pathParts) {
  const key = symbolPathKey(pathParts);
  const records = module.symbols.get(key) ?? [];
  const namespace = module.namespaces.get(key);
  if (records.length === 0 && !namespace) return undefined;
  const mergedRecords = [...records];
  for (const record of namespace?.records ?? []) {
    if (!mergedRecords.some((candidate) => candidate.node === record.node)) {
      mergedRecords.push(record);
    }
  }
  return {
    module,
    records: mergedRecords,
    path: pathParts,
    namespace: Boolean(namespace),
    namespaceEntry: namespace,
  };
}

function resolveModuleNamespace(graph, file) {
  const module = graph.getModule(file);
  return module
    ? {
      module,
      records: [],
      path: [MODULE_NAMESPACE_SEGMENT],
      namespace: true,
      moduleNamespace: true,
    }
    : undefined;
}

function resolveExportDeclaration(graph, file, exportedName, seen = new Set()) {
  const key = `${normalizedFileKey(file)}#${exportedName}`;
  if (seen.has(key)) return undefined;
  seen.add(key);
  const module = graph.getModule(file);
  const binding = graph.getExports(file).get(exportedName);
  if (!module || !binding) return undefined;

  if (binding.source) {
    const target = resolveDeclarationFile(graph.files, module.file, binding.source);
    if (!target) return undefined;
    if (binding.namespace || binding.local === '*') return resolveModuleNamespace(graph, target);
    const resolved = resolveExportDeclaration(graph, target, binding.local, seen);
    if (resolved) {
      module.canonicalTypeNames.set(
        exportedName,
        resolved.path?.at(-1) ?? resolved.records[0]?.name ?? binding.local,
      );
    }
    return resolved;
  }
  const localPath = binding.localPath ?? (binding.local ? [binding.local] : undefined);
  const local = localPath && resolveLocalDeclaration(module, localPath);
  if (local) return local;
  const imported = module.imports.get(binding.local);
  if (!imported || imported.imported === '*') return undefined;
  const target = resolveDeclarationFile(graph.files, module.file, imported.source);
  if (!target) return undefined;
  const resolved = resolveExportDeclaration(graph, target, imported.imported, seen);
  if (resolved) {
    module.canonicalTypeNames.set(
      binding.local,
      resolved.path?.at(-1) ?? resolved.records[0]?.name ?? imported.imported,
    );
  }
  return resolved;
}

function namespaceMemberBindings(graph, resolved) {
  if (!resolved?.namespace) return [];
  if (resolved.moduleNamespace) {
    return [...graph.getExports(resolved.module.file)]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, binding]) => ({ name, binding, moduleExport: true }));
  }
  return [...(resolved.namespaceEntry?.members ?? [])]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, binding]) => ({ name, binding, moduleExport: false }));
}

function resolveNamespaceMember(graph, resolved, memberName, seen = new Set()) {
  const member = namespaceMemberBindings(graph, resolved)
    .find((candidate) => candidate.name === memberName);
  if (!member) return undefined;
  if (member.moduleExport) {
    return resolveExportDeclaration(graph, resolved.module.file, memberName, seen);
  }
  const { binding } = member;
  if (binding.source) {
    const target = resolveDeclarationFile(graph.files, resolved.module.file, binding.source);
    if (!target) return undefined;
    if (binding.local === '*') return resolveModuleNamespace(graph, target);
    return resolveExportDeclaration(graph, target, binding.local ?? memberName, seen);
  }
  return binding.localPath
    ? resolveLocalDeclaration(resolved.module, binding.localPath)
    : undefined;
}

function resolveQualifiedDeclaration(graph, resolved, memberParts, seen = new Set()) {
  let current = resolved;
  for (const memberName of memberParts) {
    current = resolveNamespaceMember(graph, current, memberName, seen);
    if (!current) return undefined;
  }
  return current;
}

function resolveQualifiedExportDeclaration(graph, file, qualifierParts) {
  if (qualifierParts.length === 0) return resolveModuleNamespace(graph, file);
  const [head, ...tail] = qualifierParts;
  const root = resolveExportDeclaration(graph, file, head);
  return root ? resolveQualifiedDeclaration(graph, root, tail) : undefined;
}

function unwrapTypeAnnotation(node) {
  return node?.type === 'TSTypeAnnotation' ? node.typeAnnotation : node;
}

function typeNodeText(module, node) {
  return normalizeType(canonicalNodeText(module, unwrapTypeAnnotation(node)) || 'unknown');
}

function entityNameParts(node) {
  if (!node) return [];
  if (node.type === 'Identifier') return [node.name];
  if (node.type === 'TSQualifiedName') {
    return [...entityNameParts(node.left), ...entityNameParts(node.right)];
  }
  if (node.type === 'MemberExpression' && !node.computed) {
    return [...entityNameParts(node.object), ...entityNameParts(node.property)];
  }
  return [];
}

/** Canonicalize imported identifiers only where the TypeScript AST says they are type/entity
 * references. A textual replacement also rewrites string literal types and property keys that
 * merely happen to share an import alias, creating false breaking changes. */
function canonicalNodeText(module, node, includeUnresolvedImportAuthority = true) {
  if (!node) return '';
  const replacements = new Map();
  for (const [key, value] of module.binderNames) {
    const [start, end] = key.split(':').map(Number);
    if (start >= node.start && end <= node.end) {
      replacements.set(key, { start, end, value });
    }
  }
  const seen = new Set();
  const rememberEntity = (entity) => {
    if (!entity || typeof entity !== 'object') return;
    if (entity.type === 'Identifier') {
      const canonical = module.binderNames.get(nodePositionKey(entity))
        ?? module.resolveImportedTypeName?.(entity.name, entity.start)
        ?? (includeUnresolvedImportAuthority
          ? (() => {
            const imported = module.imports.get(entity.name);
            return imported
              ? `import(${JSON.stringify(imported.source)}).${imported.imported}`
              : undefined;
          })()
          : undefined)
        ?? module.canonicalTypeNames.get(entity.name);
      if (canonical && canonical !== entity.name) {
        replacements.set(nodePositionKey(entity), {
          start: entity.start,
          end: entity.end,
          value: canonical,
        });
      }
      return;
    }
    if (entity.type === 'TSQualifiedName') {
      rememberEntity(entity.left);
      return;
    }
    if (entity.type === 'MemberExpression' && !entity.computed) {
      rememberEntity(entity.object);
    }
  };
  const visit = (value) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value.type === 'TSTypeReference') rememberEntity(value.typeName);
    else if (value.type === 'TSInterfaceHeritage' || value.type === 'TSClassImplements') {
      rememberEntity(value.expression);
    } else if (value.type === 'TSTypeQuery') rememberEntity(value.exprName);
    else if (value.type === 'ClassDeclaration') rememberEntity(value.superClass);
    if (value.type === 'TSImportType') {
      const source = value.source;
      const qualifierParts = entityNameParts(value.qualifier);
      const identity = module.resolveImportTypeIdentity?.(source?.value, qualifierParts);
      const target = identity?.file ?? module.resolveImportSource?.(source?.value);
      if (target && source) {
        replacements.set(nodePositionKey(source), {
          start: source.start,
          end: source.end,
          value: JSON.stringify(target),
        });
      }
      if (identity && value.qualifier) {
        replacements.set(nodePositionKey(value.qualifier), {
          start: value.qualifier.start,
          end: value.qualifier.end,
          value: identity.qualifier.join('.'),
        });
      }
      visit(value.typeArguments);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'type' || key === 'start' || key === 'end') continue;
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  visit(node);
  const source = nodeText(module, node);
  if (replacements.size === 0) return source;
  let output = '';
  let cursor = node.start;
  for (const replacement of [...replacements.values()].sort((left, right) =>
    left.start - right.start)) {
    output += module.source.slice(cursor, replacement.start);
    output += replacement.value;
    cursor = replacement.end;
  }
  output += module.source.slice(cursor, node.end);
  return output;
}

function normalizeTypeParameters(module, node) {
  return (node?.typeParameters?.params ?? []).map((parameter) => ({
    name:
      module.binderNames.get(nodePositionKey(parameter.name))
      ?? propertyName(parameter.name, module)
      ?? 'T',
    constraint: parameter.constraint
      ? normalizeType(canonicalNodeText(module, parameter.constraint))
      : null,
    default: parameter.default
      ? normalizeType(canonicalNodeText(module, parameter.default))
      : null,
    in: Boolean(parameter.in),
    out: Boolean(parameter.out),
    const: Boolean(parameter.const),
  }));
}

function typeParameterSignature(parameters) {
  if (parameters.length === 0) return '';
  return `<${parameters.map((parameter) => [
    parameter.in ? 'in' : '',
    parameter.out ? 'out' : '',
    parameter.const ? 'const' : '',
    parameter.name,
    parameter.constraint ? `extends:${parameter.constraint}` : '',
    parameter.default ? `default:${parameter.default}` : '',
  ].filter(Boolean).join(':')).join(',')}>`;
}

function normalizeParameterNode(module, parameter) {
  return normalizeParameterText(canonicalNodeText(module, parameter) || 'value: unknown');
}

function memberDescriptor(module, member) {
  const methodNode = member.value && typeof member.value === 'object' ? member.value : member;
  let kind = 'property';
  if (member.type === 'TSMethodSignature' || member.type === 'MethodDefinition') kind = 'method';
  else if (member.type === 'TSCallSignatureDeclaration') kind = 'call';
  else if (member.type === 'TSConstructSignatureDeclaration') kind = 'construct';
  else if (member.type === 'TSIndexSignature') kind = 'index';
  else if (member.kind === 'constructor') kind = 'constructor';
  const parameters = methodNode.params ?? member.parameters;
  const name = kind === 'call' || kind === 'construct' || kind === 'index'
    ? kind
    : propertyName(member.key, module) ?? member.kind ?? 'member';
  const normalizedParameters = parameters?.map((parameter) => normalizeParameterNode(module, parameter));
  const typeParameters = normalizeTypeParameters(module, methodNode);
  const genericSignature = typeParameterSignature(typeParameters);
  const signature = normalizedParameters ? `(${normalizedParameters.join(',')})` : '';
  return {
    member,
    kind,
    name,
    idName: `${name}${genericSignature}${signature}`,
    parameters: normalizedParameters,
    typeParameters,
    optional: Boolean(member.optional),
    readonly: Boolean(member.readonly),
    static: Boolean(member.static),
    accessibility: member.accessibility ?? 'public',
    type: typeNodeText(
      module,
      methodNode.returnType ?? member.returnType ?? member.typeAnnotation ?? member.key?.typeAnnotation,
    ),
    sortKey: normalizeWhitespace(nodeText(module, member)),
  };
}

function addMemberSurfaces(entries, base, surface, label, module, members) {
  const descriptors = members
    .map((member) => memberDescriptor(module, member))
    .filter(({ member, accessibility }) =>
      member.key?.type !== 'PrivateIdentifier' && accessibility !== 'private')
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey));
  for (const descriptor of descriptors) {
    const memberBase = `${base}:${descriptor.kind}:${descriptor.idName}`;
    addPresence(entries, memberBase, surface, `${label}.${descriptor.name}`);
    addEntry(entries, `${memberBase}:optional`, surface, 'optional', descriptor.optional, memberBase);
    addEntry(entries, `${memberBase}:readonly`, surface, 'readonly', descriptor.readonly, memberBase);
    addEntry(entries, `${memberBase}:static`, surface, 'static', descriptor.static, memberBase);
    addEntry(
      entries,
      `${memberBase}:accessibility`,
      surface,
      'privacy',
      descriptor.accessibility,
      memberBase,
    );
    if (descriptor.parameters) {
      addEntry(
        entries,
        `${memberBase}:parameters`,
        surface,
        'parameters',
        descriptor.parameters,
        memberBase,
      );
    }
    if (descriptor.parameters || descriptor.typeParameters.length > 0) {
      addEntry(
        entries,
        `${memberBase}:type-parameters`,
        surface,
        'parameters',
        descriptor.typeParameters,
        memberBase,
      );
    }
    addTypeSurface(entries, memberBase, surface, descriptor.type, memberBase);
  }
}

function addDeclarationSurface(entries, base, surface, label, resolved, graph) {
  const { module, records } = resolved;
  const nodes = records.map((record) => record.node);
  const primary = nodes.find((node) => node.type !== 'TSModuleDeclaration');
  if (resolved.namespace && graph) {
    addEntry(
      entries,
      `${base}:namespace`,
      surface,
      'shape',
      true,
      label,
    );
    for (const { name, binding } of namespaceMemberBindings(graph, resolved)) {
      const memberBase = `${base}:namespace-member:${name}`;
      addPresence(entries, memberBase, surface, `${label}.${name}`);
      addEntry(
        entries,
        `${memberBase}:kind`,
        surface,
        'shape',
        binding.kind ?? 'value',
        `${label}.${name}`,
      );
    }
  }
  if (!primary) return;
  const kind = primary.type === 'TSInterfaceDeclaration'
    ? 'interface'
    : primary.type === 'TSTypeAliasDeclaration'
      ? 'type'
      : primary.type === 'ClassDeclaration'
        ? 'class'
        : primary.type === 'VariableDeclarator'
          ? 'variable'
          : primary.type === 'TSDeclareFunction' || primary.type === 'FunctionDeclaration'
            ? 'function'
            : primary.type;
  addEntry(entries, `${base}:declaration-kind`, surface, 'shape', kind, label);

  if (kind === 'interface') {
    addEntry(
      entries,
      `${base}:type-parameters`,
      surface,
      'parameters',
      normalizeTypeParameters(module, primary),
      label,
    );
    const heritage = nodes
      .flatMap((node) => node.extends ?? [])
      .map((item) => normalizeType(canonicalNodeText(module, item)))
      .sort();
    addEntry(entries, `${base}:extends`, surface, 'heritage', heritage, label);
    addMemberSurfaces(
      entries,
      base,
      surface,
      label,
      module,
      nodes.flatMap((node) => node.body?.body ?? []),
    );
    return;
  }
  if (kind === 'type') {
    addEntry(
      entries,
      `${base}:type-parameters`,
      surface,
      'parameters',
      normalizeTypeParameters(module, primary),
      label,
    );
    addTypeSurface(entries, base, surface, typeNodeText(module, primary.typeAnnotation), label);
    return;
  }
  if (kind === 'class') {
    addEntry(
      entries,
      `${base}:type-parameters`,
      surface,
      'parameters',
      normalizeTypeParameters(module, primary),
      label,
    );
    const heritage = primary.superClass
      ? [
        normalizeType(
          `${canonicalNodeText(module, primary.superClass)}` +
            `${canonicalNodeText(module, primary.superTypeArguments)}`,
        ),
      ]
      : [];
    addEntry(entries, `${base}:extends`, surface, 'heritage', heritage, label);
    addMemberSurfaces(entries, base, surface, label, module, primary.body?.body ?? []);
    return;
  }
  if (kind === 'function') {
    for (const node of [...nodes].sort((left, right) =>
      nodeText(module, left).localeCompare(nodeText(module, right)))) {
      const parameters = (node.params ?? []).map((parameter) =>
        normalizeParameterNode(module, parameter));
      const typeParameters = normalizeTypeParameters(module, node);
      const overloadBase = `${base}:overload:${typeParameterSignature(typeParameters)}(${parameters.join(',')})`;
      addPresence(entries, overloadBase, surface, label);
      addEntry(entries, `${overloadBase}:parameters`, surface, 'parameters', parameters, label);
      addEntry(
        entries,
        `${overloadBase}:type-parameters`,
        surface,
        'parameters',
        typeParameters,
        label,
      );
      addTypeSurface(
        entries,
        overloadBase,
        surface,
        typeNodeText(module, node.returnType),
        label,
      );
    }
    return;
  }
  if (kind === 'variable') {
    addTypeSurface(entries, base, surface, typeNodeText(module, primary.id?.typeAnnotation), label);
  }
}

function normalizeFrameworkDeclarations(framework, text, entries) {
  const module = parseDeclarationModule(`${framework}.d.ts`, text);
  const groups = new Map();
  const visit = (statements, namespace = '', nested = false) => {
    for (const statement of statements) {
      const exported = statement.type === 'ExportNamedDeclaration';
      const declaration = exported ? statement.declaration : statement;
      if (!declaration) continue;
      if (declaration.type === 'TSModuleDeclaration') {
        const moduleName = propertyName(declaration.id, module) ?? 'module';
        const nextNamespace = namespace ? `${namespace}.${moduleName}` : moduleName;
        let body = declaration.body;
        while (body?.type === 'TSModuleDeclaration') body = body.body;
        if (body?.type === 'TSModuleBlock') visit(body.body, nextNamespace, true);
        continue;
      }
      if (!nested && !exported) continue;
      for (const record of declarationRecords(declaration, module)) {
        const prefix = `framework:${framework}:${namespace ? `${namespace}:` : ''}`;
        const key = `${prefix}${record.name}`;
        const group = groups.get(key) ?? { base: key, label: record.name, module, records: [] };
        group.records.push(record);
        groups.set(key, group);
      }
    }
  };
  visit(module.body);
  for (const group of [...groups.values()].sort((left, right) =>
    left.base.localeCompare(right.base))) {
    addPresence(entries, group.base, `framework:${framework}`, group.label);
    addDeclarationSurface(
      entries,
      group.base,
      `framework:${framework}`,
      group.label,
      group,
    );
  }
}

function referencedTypeNames(module, records) {
  const names = new Set();
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value.type === 'TSTypeReference') {
      const identifier = leftmostEntityIdentifier(value.typeName);
      if (module.binderNames.has(nodePositionKey(identifier))) return;
      const name = entityNameParts(value.typeName).join('.');
      if (name) names.add(name);
    } else if (value.type === 'TSInterfaceHeritage') {
      const identifier = leftmostEntityIdentifier(value.expression);
      if (module.binderNames.has(nodePositionKey(identifier))) return;
      const name = entityNameParts(value.expression).join('.');
      if (name) names.add(name);
    } else if (value.type === 'TSTypeQuery') {
      const name = entityNameParts(value.exprName).join('.');
      if (name) names.add(name);
    } else if (value.type === 'ClassDeclaration') {
      const name = entityNameParts(value.superClass).join('.');
      if (name) names.add(name);
      visit(value.typeParameters);
      visit(value.superTypeArguments);
      (value.implements ?? []).forEach(visit);
      for (const member of value.body?.body ?? []) {
        if (member.accessibility === 'private' || member.key?.type === 'PrivateIdentifier') continue;
        visit(member);
      }
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'type' || key === 'start' || key === 'end') continue;
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  records.forEach(({ node }) => visit(node));
  return [...names].sort();
}

function referencedImportTypes(records) {
  const references = [];
  const seenNodes = new Set();
  const seenReferences = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object' || seenNodes.has(value)) return;
    seenNodes.add(value);
    if (value.type === 'TSImportType') {
      const source = value.source?.value;
      const qualifier = entityNameParts(value.qualifier);
      if (typeof source === 'string') {
        const key = `${source}#${qualifier.join('.')}`;
        if (!seenReferences.has(key)) {
          seenReferences.add(key);
          references.push({ source, qualifier });
        }
      }
    }
    if (value.type === 'ClassDeclaration') {
      visit(value.typeParameters);
      visit(value.superClass);
      visit(value.superTypeArguments);
      (value.implements ?? []).forEach(visit);
      for (const member of value.body?.body ?? []) {
        if (member.accessibility === 'private' || member.key?.type === 'PrivateIdentifier') continue;
        visit(member);
      }
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'type' || key === 'start' || key === 'end') continue;
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  records.forEach(({ node }) => visit(node));
  return references.sort((left, right) =>
    left.source.localeCompare(right.source)
      || left.qualifier.join('.').localeCompare(right.qualifier.join('.')));
}

function moduleExportDependencies(graph, file) {
  const key = normalizedFileKey(file);
  if (!graph.moduleDependencyCache.has(key)) {
    const resolved = resolveModuleNamespace(graph, key);
    graph.moduleDependencyCache.set(key, resolved ? [{ resolved, suffix: '' }] : []);
  }
  return graph.moduleDependencyCache.get(key);
}

function resolveScopedLocalDeclaration(module, ownerPath, referenceParts) {
  const namespacePath = ownerPath?.[0] === MODULE_NAMESPACE_SEGMENT
    ? []
    : (ownerPath ?? []).slice(0, -1);
  for (let length = namespacePath.length; length >= 0; length -= 1) {
    const resolved = resolveLocalDeclaration(
      module,
      [...namespacePath.slice(0, length), ...referenceParts],
    );
    if (resolved) return resolved;
  }
  return undefined;
}

function resolveTypeDependencies(graph, owner, referenceName) {
  const { module } = owner;
  const [localName, ...memberParts] = String(referenceName).split('.');
  const local = resolveScopedLocalDeclaration(
    module,
    owner.path,
    [localName, ...memberParts],
  );
  if (local) return [{ resolved: local, suffix: '' }];

  const imported = module.imports.get(localName);
  if (imported) {
    const target = resolveDeclarationFile(graph.files, module.file, imported.source);
    if (!target) return [];
    if (imported.imported === '*') {
      if (memberParts.length === 0) return moduleExportDependencies(graph, target);
      const resolved = resolveQualifiedExportDeclaration(graph, target, memberParts);
      return resolved ? [{ resolved, suffix: '' }] : [];
    }
    const importedRoot = resolveExportDeclaration(graph, target, imported.imported);
    const resolved = importedRoot
      ? resolveQualifiedDeclaration(graph, importedRoot, memberParts)
      : undefined;
    return resolved ? [{ resolved, suffix: '' }] : [];
  }

  return [];
}

function declarationIdentity(resolved) {
  const pathParts = resolved.path?.length > 0
    ? resolved.path
    : resolved.records.map(({ name, node }) =>
      name ?? declarationName(node, resolved.module) ?? declarationKind(node));
  return `${resolved.module.file}#${JSON.stringify(pathParts)}`;
}

/** Materializing one declaration surface walks every public member and normalizes every nested
 * type. Granular routes intentionally expose the same class/type through several registration,
 * class, family, and wildcard paths, so doing that work independently per route grows into
 * gigabytes. Cache a base-independent template by declaration identity. */
function declarationSurfaceTemplate(graph, resolved) {
  const identity = declarationIdentity(resolved);
  let template = graph.declarationSurfaceCache.get(identity);
  if (!template) {
    const templateEntries = new Map();
    addDeclarationSurface(templateEntries, '$', 'declaration-template', '$', resolved, graph);
    template = [...templateEntries.entries()];
    graph.declarationSurfaceCache.set(identity, template);
  }
  return template;
}

function addCachedDeclarationSurface(entries, base, surface, label, graph, resolved) {
  const template = declarationSurfaceTemplate(graph, resolved);
  for (const [templateId, entry] of template) {
    const suffix = templateId.slice(1);
    const projectedLabel = entry.label === '$'
      ? label
      : entry.label.startsWith('$')
        ? `${base}${entry.label.slice(1)}`
        : entry.label;
    addEntry(
      entries,
      `${base}${suffix}`,
      surface,
      entry.semantic,
      entry.value,
      projectedLabel,
    );
  }
}

/** Store granular declaration details as one compact, route-namespaced contract. This retains
 * additive-vs-breaking member classification while avoiding hundreds of duplicated Map entries
 * for every `.js`/`.d.ts` alias of the same declaration. Contract objects are cached and shared
 * in memory across routes; only their stable route entry is duplicated. */
function declarationContractValue(graph, resolved) {
  const identity = declarationIdentity(resolved);
  if (!graph.declarationContractCache.has(identity)) {
    const contract = Object.fromEntries(
      declarationSurfaceTemplate(graph, resolved).map(([templateId, entry]) => [
        templateId.slice(1),
        { semantic: entry.semantic, value: entry.value },
      ]),
    );
    graph.declarationContractCache.set(identity, contract);
  }
  return graph.declarationContractCache.get(identity);
}

function declarationContractReference(graph, resolved) {
  const identity = declarationIdentity(resolved);
  if (!graph.contractIdCache.has(identity)) {
    const contract = declarationContractValue(graph, resolved);
    graph.contractIdCache.set(
      identity,
      registerDeclarationContract(graph, identity, contract),
    );
  }
  return graph.contractIdCache.get(identity);
}

function registerDeclarationContract(graph, identity, contract) {
  const serialized = JSON.stringify(contract);
  const id = createHash('sha256').update(serialized).digest('hex');
  const existing = graph.contractDefinitions.get(id);
  if (existing && JSON.stringify(existing) !== serialized) {
    throw new Error(`Declaration contract digest collision for ${identity}.`);
  }
  graph.contractDefinitions.set(id, contract);
  return id;
}

function mergedDeclarationContract(graph, resolvedDeclarations) {
  const declarationsByIdentity = new Map();
  for (const resolved of resolvedDeclarations) {
    const identity = declarationIdentity(resolved);
    const merged = declarationsByIdentity.get(identity) ?? { ...resolved, records: [] };
    merged.records.push(...resolved.records);
    declarationsByIdentity.set(identity, merged);
  }
  const entries = new Map();
  for (const resolved of [...declarationsByIdentity.values()].sort((left, right) =>
    declarationIdentity(left).localeCompare(declarationIdentity(right)))) {
    for (const [id, entry] of Object.entries(declarationContractValue(graph, resolved))) {
      const existing = entries.get(id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(entry)) {
        if (
          id === ':extends'
          && existing.semantic === 'heritage'
          && entry.semantic === 'heritage'
          && Array.isArray(existing.value)
          && Array.isArray(entry.value)
        ) {
          entries.set(id, {
            ...existing,
            value: [...new Set([...existing.value, ...entry.value])].sort(),
          });
          continue;
        }
        throw new Error(`Conflicting merged public declaration entry: ${id}`);
      }
      entries.set(id, entry);
    }
  }
  return Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right)));
}

function addCompactDeclarationSurface(entries, base, surface, label, graph, resolved) {
  addEntry(
    entries,
    `${base}:contract`,
    surface,
    'declaration-contract-ref',
    declarationContractReference(graph, resolved),
    label,
  );
}

function cachedReferencedTypeNames(graph, resolved) {
  const identity = declarationIdentity(resolved);
  if (!graph.referencedTypeCache.has(identity)) {
    graph.referencedTypeCache.set(
      identity,
      referencedTypeNames(
        resolved.module,
        resolved.records.filter(({ node }) => node.type !== 'TSModuleDeclaration'),
      ),
    );
  }
  return graph.referencedTypeCache.get(identity);
}

function cachedImportTypeReferences(graph, resolved) {
  const identity = declarationIdentity(resolved);
  const key = `${identity}:import-types`;
  if (!graph.referencedTypeCache.has(key)) {
    graph.referencedTypeCache.set(
      key,
      referencedImportTypes(
        resolved.records.filter(({ node }) => node.type !== 'TSModuleDeclaration'),
      ),
    );
  }
  return graph.referencedTypeCache.get(key);
}

function canonicalDependencyReference(resolved) {
  return `declaration:${declarationIdentity(resolved)}`;
}

function canonicalImportTypeReference(resolved) {
  return `declaration:${declarationIdentity(resolved)}`;
}

function resolveImportTypeDependencies(graph, module, reference) {
  const target = resolveDeclarationFile(graph.files, module.file, reference.source);
  if (!target) return [];
  if (reference.qualifier.length === 0) return moduleExportDependencies(graph, target);
  const resolved = resolveQualifiedExportDeclaration(graph, target, reference.qualifier);
  return resolved ? [{ resolved, suffix: '' }] : [];
}

function cachedTypeDependencies(graph, resolved, referenceName) {
  const key = `${declarationIdentity(resolved)}#${referenceName}`;
  if (!graph.typeDependencyCache.has(key)) {
    graph.typeDependencyCache.set(key, resolveTypeDependencies(graph, resolved, referenceName));
  }
  return graph.typeDependencyCache.get(key);
}

function directDependencyRecords(graph, resolved) {
  const rootIdentity = declarationIdentity(resolved);
  if (!graph.directDependencyCache.has(rootIdentity)) {
    const candidates = [
      ...namespaceMemberBindings(graph, resolved).map(({ name }) => {
        const dependency = resolveNamespaceMember(graph, resolved, name);
        return {
          dependencies: dependency ? [{ resolved: dependency, suffix: '' }] : [],
          namespaceMember: name,
        };
      }),
      ...cachedReferencedTypeNames(graph, resolved).map((localName) => ({
        dependencies: cachedTypeDependencies(graph, resolved, localName),
      })),
      ...cachedImportTypeReferences(graph, resolved).map((importType) => ({
        dependencies: resolveImportTypeDependencies(graph, resolved.module, importType),
      })),
    ];
    const dependencies = new Map();
    for (const candidate of candidates) {
      for (const dependency of candidate.dependencies) {
        const targetReference = candidate.namespaceMember
          ? `namespace-member:${candidate.namespaceMember}`
          : candidate.importType
            ? canonicalImportTypeReference(dependency.resolved)
            : canonicalDependencyReference(dependency.resolved);
        const reference = dependency.suffix
          ? `${targetReference}.${dependency.suffix}`
          : targetReference;
        const key = `${reference}#${declarationIdentity(dependency.resolved)}`;
        dependencies.set(key, { reference, resolved: dependency.resolved });
      }
    }
    graph.directDependencyCache.set(
      rootIdentity,
      [...dependencies.values()].sort((left, right) =>
        left.reference.localeCompare(right.reference)
          || declarationIdentity(left.resolved).localeCompare(declarationIdentity(right.resolved))),
    );
  }
  return graph.directDependencyCache.get(rootIdentity);
}

function dependencyEdgeReference(graph, value) {
  const serialized = JSON.stringify(value);
  const id = createHash('sha256').update(serialized).digest('hex');
  const existing = graph.dependencyEdgeDefinitions.get(id);
  if (existing && existing !== serialized) {
    throw new Error('Dependency edge digest collision.');
  }
  graph.dependencyEdgeDefinitions.set(id, serialized);
  return id;
}

/** Returns the deterministic edge-digest closure for every declaration reachable from one public
 * root. Each declaration identity is visited once, so cycles terminate and diamond graphs do not
 * emit one copy per path. Only fixed-size edge digests survive the traversal: retaining every
 * expanded closure for every granular route otherwise duplicates hundreds of megabytes. */
function reachableContractValue(graph, resolved) {
  const rootIdentity = declarationIdentity(resolved);
  const contracts = new Set();
  const visited = new Set();
  // identity -> contract reference, for EVERY declaration the walk touches. This is what lets a
  // changed fingerprint be explained declaration by declaration instead of only counted; see
  // `dependencyContractBump()`. It is one entry per reachable declaration, not per edge, and the
  // whole map is interned by `reachableContractReference()`, so routes that reach the same closure
  // (every chart subclass, say) share a single stored copy.
  const reachable = new Map();
  const queue = [resolved];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const identity = declarationIdentity(current);
    if (visited.has(identity)) continue;
    visited.add(identity);
    const ownerContract = declarationContractReference(graph, current);
    reachable.set(identity, ownerContract);
    for (const dependency of directDependencyRecords(graph, current)) {
      const targetIdentity = declarationIdentity(dependency.resolved);
      const targetContract = declarationContractReference(graph, dependency.resolved);
      reachable.set(targetIdentity, targetContract);
      contracts.add(dependencyEdgeReference(graph, [
        identity,
        ownerContract,
        dependency.reference,
        targetIdentity,
        targetContract,
      ]));
      if (!visited.has(targetIdentity)) {
        queue.push(dependency.resolved);
      }
    }
  }
  // The ROOT's own entry is deliberately excluded: `addCachedDeclarationSurface()` already emits its
  // full surface (including its `:contract`) under the same base, immediately before this runs, so
  // including it here would be redundant -- and, far more importantly, it would make every root's
  // map unique and destroy the interning below. 120 roots over one shared 80-declaration chain went
  // from one stored closure to 120 copies, blowing the serialization budget by 2.2x.
  reachable.delete(rootIdentity);
  return {
    edges: [...contracts].sort(),
    reachable: Object.fromEntries([...reachable].sort(([left], [right]) => left.localeCompare(right))),
  };
}

function reachableContractReference(graph, resolved) {
  const rootIdentity = declarationIdentity(resolved);
  if (!graph.dependencyIdCache.has(rootIdentity)) {
    const contract = reachableContractValue(graph, resolved);
    const serialized = JSON.stringify(contract);
    const id = createHash('sha256').update(serialized).digest('hex');
    const existing = graph.dependencyDefinitions.get(id);
    if (existing && existing.edgeCount !== contract.edges.length) {
      throw new Error(`Dependency contract digest collision for ${rootIdentity}.`);
    }
    // Interned separately from the edge digest. The edges embed the root identity, so every root
    // gets a distinct dependency id even when the CLOSURE it reaches is identical -- which is the
    // common case (every chart subclass reaches the same internals). Keying the closure by its own
    // digest lets all of them share one stored copy.
    const reachableSerialized = JSON.stringify(contract.reachable);
    const reachableId = createHash('sha256').update(reachableSerialized).digest('hex');
    graph.reachableDefinitions.set(reachableId, contract.reachable);
    graph.dependencyDefinitions.set(id, {
      edgeCount: contract.edges.length,
      reachableId,
    });
    graph.dependencyContractCache.set(rootIdentity, { edgeCount: contract.edges.length, id });
    graph.dependencyIdCache.set(rootIdentity, id);
  }
  return graph.dependencyIdCache.get(rootIdentity);
}

function addReachableTypeSurfaces(entries, base, surface, graph, resolved) {
  addEntry(
    entries,
    `${base}:dependencies`,
    surface,
    'dependency-contract-ref',
    reachableContractReference(graph, resolved),
    `${base} reachable declaration contract`,
  );
}

function normalizeNamedExports(declarations, entries, graph) {
  const entryFile = normalizedFileKey(declarations.namedEntry ?? 'dist/lyra.d.ts');
  if (!graph?.files.has(entryFile)) return;
  const exportTable = graph.getExports(entryFile);
  for (const [name, binding] of [...exportTable].sort(([left], [right]) =>
    left.localeCompare(right))) {
    if (name === 'default') continue;
    const resolved = resolveExportDeclaration(graph, entryFile, name);
    const resolvedKind = resolved?.records.every(({ node }) => declarationKind(node) === 'type')
      ? 'type'
      : 'value';
    const kind = binding.kind === 'type' || resolvedKind === 'type' ? 'type' : 'value';
    const base = `named-export:${name}`;
    addEntry(entries, base, 'named-export', 'export', { kind }, name);
    if (resolved) {
      addCachedDeclarationSurface(entries, base, 'named-export', name, graph, resolved);
      addReachableTypeSurfaces(entries, base, 'named-export', graph, resolved);
    }
  }
}

function declarationFileForTarget(graph, target) {
  if (typeof target !== 'string') return undefined;
  const normalized = normalizedFileKey(target);
  const candidates = [normalized];
  if (/\.mjs$/.test(normalized)) {
    candidates.push(normalized.replace(/\.mjs$/, '.d.mts'), normalized.replace(/\.mjs$/, '.d.ts'));
  } else if (/\.cjs$/.test(normalized)) {
    candidates.push(normalized.replace(/\.cjs$/, '.d.cts'), normalized.replace(/\.cjs$/, '.d.ts'));
  } else if (/\.js$/.test(normalized)) {
    candidates.push(normalized.replace(/\.js$/, '.d.ts'));
  }
  return candidates.find((candidate) => graph.files.has(candidate));
}

function declarationVariants(exportTargets, graph) {
  const targetsBySpecifier = new Map();
  for (const record of exportTargets) {
    const records = targetsBySpecifier.get(record.specifier) ?? [];
    records.push(record);
    targetsBySpecifier.set(record.specifier, records);
  }
  const variants = [];
  for (const [specifier, records] of [...targetsBySpecifier].sort(([left], [right]) =>
    left.localeCompare(right))) {
    const byFile = new Map();
    for (const record of records) {
      const entryFile = declarationFileForTarget(graph, record.target);
      if (!entryFile) continue;
      const variant = byFile.get(entryFile) ?? { entryFile, conditions: [], specifier };
      variant.conditions.push(record.condition);
      byFile.set(entryFile, variant);
    }
    const fileVariants = [...byFile.values()].sort((left, right) =>
      left.entryFile.localeCompare(right.entryFile));
    for (const variant of fileVariants) {
      const canonicalCondition = [...variant.conditions].sort((left, right) => {
        const leftTypes = left.split('.').includes('types') ? 1 : 0;
        const rightTypes = right.split('.').includes('types') ? 1 : 0;
        return rightTypes - leftTypes || left.localeCompare(right);
      })[0];
      variants.push({
        ...variant,
        condition: fileVariants.length > 1 ? canonicalCondition : undefined,
      });
    }
  }
  return variants;
}

/** Normalizes the declaration graph behind every supported non-root package subpath. Package
 * export target presence alone cannot detect a breaking signature change while the pathname stays
 * stable. Keep each declaration namespaced by its public specifier so two routes may intentionally
 * export different views of the same local name without colliding. */
function normalizeSubpathDeclarations(exportTargets, entries, graph) {
  if (!graph) return;
  for (const variant of declarationVariants(exportTargets, graph)) {
    const conditionNamespace = variant.condition ? `:${variant.condition}` : '';
    const exportTable = graph.getExports(variant.entryFile);
    for (const [name, binding] of [...exportTable].sort(([left], [right]) =>
      left.localeCompare(right))) {
      const resolved = resolveExportDeclaration(graph, variant.entryFile, name);
      const resolvedKind = resolved?.records.every(({ node }) => declarationKind(node) === 'type')
        ? 'type'
        : 'value';
      const kind = binding.kind === 'type' || resolvedKind === 'type' ? 'type' : 'value';
      const base = `subpath-export:${variant.specifier}${conditionNamespace}:${name}`;
      addEntry(entries, base, 'subpath-export', 'export', { kind }, `${variant.specifier} ${name}`);
      if (resolved) {
        addCompactDeclarationSurface(
          entries,
          base,
          'subpath-export',
          `${variant.specifier} ${name}`,
          graph,
          resolved,
        );
        addReachableTypeSurfaces(entries, base, 'subpath-export', graph, resolved);
      }
    }
  }
}

function normalizeAugmentations(exportTargets, entries, graph) {
  if (!graph) return;
  for (const variant of declarationVariants(exportTargets, graph)) {
    const reachableFiles = new Set();
    const queue = [variant.entryFile];
    for (let index = 0; index < queue.length; index += 1) {
      const file = queue[index];
      if (reachableFiles.has(file)) continue;
      reachableFiles.add(file);
      const module = graph.getModule(file);
      for (const reference of module?.moduleReferences ?? []) {
        const target = resolveDeclarationFile(graph.files, file, reference);
        if (target && !reachableFiles.has(target)) queue.push(target);
      }
    }
    const grouped = new Map();
    for (const file of [...reachableFiles].sort()) {
      const module = graph.getModule(file);
      if (!module) continue;
      for (const augmentation of module.augmentations) {
        const record = augmentation.resolved.records[0];
        const key = JSON.stringify([
          augmentation.moduleName,
          augmentation.namespace,
          record?.name ?? 'declaration',
        ]);
        const group = grouped.get(key) ?? {
          moduleName: augmentation.moduleName,
          namespace: augmentation.namespace,
          resolvedDeclarations: [],
        };
        group.resolvedDeclarations.push(augmentation.resolved);
        grouped.set(key, group);
      }
    }
    for (const augmentation of [...grouped.values()].sort((left, right) =>
      left.moduleName.localeCompare(right.moduleName)
        || left.namespace.join('.').localeCompare(right.namespace.join('.'))
        || declarationIdentity(left.resolvedDeclarations[0])
          .localeCompare(declarationIdentity(right.resolvedDeclarations[0])))) {
      const record = augmentation.resolvedDeclarations[0].records[0];
      const base = [
        'augmentation',
        variant.specifier,
        ...(variant.condition ? [variant.condition] : []),
        JSON.stringify(augmentation.moduleName),
        ...augmentation.namespace,
        record?.name ?? 'declaration',
      ].join(':');
      addPresence(entries, base, 'augmentation', base);
      const contract = mergedDeclarationContract(graph, augmentation.resolvedDeclarations);
      addEntry(
        entries,
        `${base}:contract`,
        'augmentation',
        'declaration-contract-ref',
        registerDeclarationContract(graph, base, contract),
        base,
      );
    }
  }
}

function normalizeExternalReExports(exportTargets, entries, graph) {
  if (!graph) return;
  for (const variant of declarationVariants(exportTargets, graph)) {
    const module = graph.getModule(variant.entryFile);
    for (const authority of [...(module?.externalReExports ?? [])].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)))) {
      const base = [
        'external-re-export',
        variant.specifier,
        ...(variant.condition ? [variant.condition] : []),
        authority.mode,
        authority.exported,
      ].join(':');
      addEntry(
        entries,
        base,
        'external-re-export',
        'authority',
        {
          source: authority.source,
          imported: authority.imported,
          kind: authority.kind,
        },
        `${variant.specifier} external ${authority.mode} re-export`,
      );
    }
  }
}

export function normalizePublicApi({ packageJson, manifest, declarations = {} }) {
  if (!packageJson?.name || !packageJson?.version) {
    throw new Error('Public API input requires packageJson.name and packageJson.version.');
  }
  const entries = new Map();
  const exportTargets = normalizeExports(packageJson.exports, entries, declarations.packageFiles);
  const declarationFiles = { ...(declarations.files ?? {}) };
  const namedEntry = normalizedFileKey(declarations.namedEntry ?? 'dist/lyra.d.ts');
  if (typeof declarations.named === 'string') declarationFiles[namedEntry] = declarations.named;
  const graph = Object.keys(declarationFiles).length > 0
    ? declarationGraph(declarationFiles)
    : undefined;
  // Published manifests before v8 flattened standard superclass surfaces into every subclass,
  // while the compact v8 representation stores them once on the resolvable base declaration.
  // Compare effective public surfaces, not those two byte-level encodings; expansion is
  // idempotent for an already-flattened manifest because subclass entries override inherited
  // entries by public name.
  normalizeManifest(expandManifestInheritance(manifest), entries);
  normalizeNamedExports(declarations, entries, graph);
  normalizeSubpathDeclarations(exportTargets, entries, graph);
  normalizeAugmentations(exportTargets, entries, graph);
  normalizeExternalReExports(exportTargets, entries, graph);
  for (const framework of ['react', 'vue', 'svelte']) {
    if (typeof declarations[framework] === 'string') {
      normalizeFrameworkDeclarations(framework, declarations[framework], entries);
    }
  }
  return {
    packageName: packageJson.name,
    version: packageJson.version,
    entries: Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right))),
    contracts: Object.fromEntries(
      [...(graph?.contractDefinitions ?? [])].sort(([left], [right]) =>
        left.localeCompare(right)),
    ),
    dependencies: Object.fromEntries(
      [...(graph?.dependencyDefinitions ?? [])].sort(([left], [right]) =>
        left.localeCompare(right)),
    ),
    reachableClosures: Object.fromEntries(
      [...(graph?.reachableDefinitions ?? [])].sort(([left], [right]) =>
        left.localeCompare(right)),
    ),
    typeAliases: normalizedTypeAliases(graph),
  };
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function declarationContractBump(before, after, baseline, current) {
  let bump = 'none';
  const ids = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const id of ids) {
    const beforeEntry = before?.[id];
    const afterEntry = after?.[id];
    if (!beforeEntry) bump = maxBump(bump, 'minor');
    else if (!afterEntry) return 'major';
    else if (!sameValue(beforeEntry.value, afterEntry.value)) {
      bump = maxBump(
        bump,
        changedBump(afterEntry, beforeEntry.value, afterEntry.value, baseline, current),
      );
    }
  }
  return bump;
}

/**
 * Whether a heritage clause list only SPECIALIZED a defaulted generic, e.g.
 * `LyraElement` -> `LyraElement<LyraSequenceStripEventMap>`.
 *
 * `LyraElement` is declared `class LyraElement<Events = LyraEventMap>`, so naming the argument is
 * how a component gains a typed event map -- the shape every event-emitting component in the
 * library already has. Comparing the clause as an opaque string reports that as a base-class
 * change, which it is not.
 *
 * A different base name, a different list length, or arguments CHANGING rather than being added
 * all stay `major`: those really can break a subclass or a structural assignment.
 */
function isHeritageSpecialization(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after)) return false;
  if (before.length !== after.length || before.length === 0) return false;
  let specialized = false;
  for (const [index, beforeClause] of before.entries()) {
    const afterClause = after[index];
    if (beforeClause === afterClause) continue;
    const beforeGeneric = genericTypeParts(beforeClause);
    const afterGeneric = genericTypeParts(afterClause);
    // Only "no arguments" -> "arguments" counts; anything else is a real heritage change.
    if (beforeGeneric || !afterGeneric) return false;
    if (normalizeType(beforeClause) !== afterGeneric.name) return false;
    specialized = true;
  }
  return specialized;
}

/**
 * Bump for a changed `:dependencies` fingerprint — the set of declarations transitively REACHABLE
 * from a public export.
 *
 * This used to return an unconditional `major`, which made the gate unusable for additive releases.
 * Adding one property to a widely-composed base class rewrites the reachable fingerprint of every
 * subclass and of every subpath that re-exports it: 11.0.0 was reported as 287 breaking changes on
 * that basis, not one of which removed or altered a public member. A gate that calls every additive
 * release breaking gets overridden rather than heeded, which is worse than one that is merely
 * coarse.
 *
 * Only the edge COUNT survives into the snapshot — `reachableContractValue()` deliberately discards
 * the expanded closure because retaining it costs hundreds of megabytes — so this compares counts:
 *
 * - grew   -> `minor`. The reachable set gained declarations; nothing became unreachable.
 * - shrank -> `major`. Something became unreachable.
 * - equal but a different digest -> `major`. Same size, different set: an edge may have been
 *   swapped, which can hide a removal, and the retained fingerprint cannot tell the two apart.
 * - either count missing -> `major`, so a malformed or truncated snapshot fails closed.
 *
 * The one unsound case is a rewiring that removes fewer edges than it adds. That is narrow rather
 * than theoretical hand-waving: removing a public declaration emits its own `removed` entry, and
 * changing a declaration's shape moves its `:contract` entry through `declarationContractBump()` —
 * both independently `major`. What is left is an edge rewiring invisible to both, which is not an
 * observable break in the public surface.
 */
function dependencyContractBump(before, after, baseline, current) {
  const beforeDefinition = baseline?.dependencies?.[before];
  const afterDefinition = current?.dependencies?.[after];
  if (!beforeDefinition || !afterDefinition) return 'major';

  const beforeReachable = beforeDefinition.reachable
    ?? baseline?.reachableClosures?.[beforeDefinition.reachableId];
  const afterReachable = afterDefinition.reachable
    ?? current?.reachableClosures?.[afterDefinition.reachableId];
  if (!beforeReachable || !afterReachable) {
    // A snapshot produced before the `reachable` map existed -- comparing against an older
    // published baseline. Degrade to the count rule rather than failing or silently passing.
    const beforeCount = beforeDefinition.edgeCount;
    const afterCount = afterDefinition.edgeCount;
    if (typeof beforeCount !== 'number' || typeof afterCount !== 'number') return 'major';
    return afterCount > beforeCount ? 'minor' : 'major';
  }

  // Explain the changed fingerprint declaration by declaration, and classify each on its own
  // merits. This is the whole point of retaining the map: an edge digest embeds both endpoints'
  // CONTRACT hashes, so adding a member to any reachable declaration rewrites the fingerprint while
  // leaving the edge count untouched -- indistinguishable, by count alone, from a rewiring that
  // dropped something. Counting could only answer `major`, which made every additive release read
  // as breaking.
  let bump = 'none';
  const identities = new Set([...Object.keys(beforeReachable), ...Object.keys(afterReachable)]);
  for (const identity of identities) {
    const beforeContract = beforeReachable[identity];
    const afterContract = afterReachable[identity];
    // Newly reachable: additive.
    if (beforeContract === undefined) {
      bump = maxBump(bump, 'minor');
      continue;
    }
    // No longer reachable: a consumer's type could have depended on it.
    if (afterContract === undefined) return 'major';
    if (beforeContract === afterContract) continue;
    // Same declaration, different shape -- exactly what declarationContractBump() decides, and the
    // reason a reachable-but-unexported type narrowing is still caught here. It has no entry of its
    // own in the diff, so this is the only place it can surface.
    bump = maxBump(
      bump,
      declarationContractBump(
        baseline?.contracts?.[beforeContract],
        current?.contracts?.[afterContract],
        baseline,
        current,
      ),
    );
  }
  return bump;
}

function changedBump(entry, before, after, baseline, current) {
  if (entry.semantic === 'declaration-contract-ref') {
    const beforeContract = baseline?.contracts?.[before];
    const afterContract = current?.contracts?.[after];
    if (!beforeContract || !afterContract) return 'major';
    return declarationContractBump(beforeContract, afterContract, baseline, current);
  }
  if (entry.semantic === 'dependency-contract-ref') {
    return dependencyContractBump(before, after, baseline, current);
  }
  if (entry.semantic === 'type' && isTypeWidening(before, after, baseline, current)) return 'minor';
  if (entry.semantic === 'heritage' && isHeritageSpecialization(before, after)) return 'minor';
  if (entry.semantic === 'optional' && before === false && after === true) return 'minor';
  if (entry.semantic === 'readonly' && before === true && after === false) return 'minor';
  if (entry.semantic === 'privacy' && before === 'protected' && after === 'public') return 'minor';
  return 'major';
}

export function diffPublicApi(baseline, current) {
  if (baseline.packageName !== current.packageName) {
    throw new Error(
      `Cannot compare different packages: ${baseline.packageName} and ${current.packageName}.`,
    );
  }
  const changes = [];
  const ids = new Set([...Object.keys(baseline.entries), ...Object.keys(current.entries)]);
  for (const id of [...ids].sort()) {
    const beforeEntry = baseline.entries[id];
    const afterEntry = current.entries[id];
    if (!beforeEntry) {
      changes.push({
        id,
        surface: afterEntry.surface,
        bump: 'minor',
        kind: 'added',
        before: null,
        after: afterEntry.value,
        summary: `Added ${afterEntry.label}`,
      });
      continue;
    }
    if (!afterEntry) {
      changes.push({
        id,
        surface: beforeEntry.surface,
        bump: 'major',
        kind: 'removed',
        before: beforeEntry.value,
        after: null,
        summary: `Removed ${beforeEntry.label}`,
      });
      continue;
    }
    if (!sameValue(beforeEntry.value, afterEntry.value)) {
      changes.push({
        id,
        surface: afterEntry.surface,
        bump: changedBump(afterEntry, beforeEntry.value, afterEntry.value, baseline, current),
        kind: 'changed',
        before: beforeEntry.value,
        after: afterEntry.value,
        summary: `Changed ${afterEntry.label}`,
      });
    }
  }
  return changes;
}

function assertBump(value, label) {
  if (!VALID_BUMPS.has(value)) {
    throw new Error(`${label} must be one of ${[...VALID_BUMPS].join(', ')}; received ${value}.`);
  }
}

function maxBump(...bumps) {
  for (const bump of bumps) assertBump(bump, 'bump');
  return bumps.reduce((highest, bump) => (BUMP_RANK[bump] > BUMP_RANK[highest] ? bump : highest), 'none');
}

export function minimumRequiredBump(changes) {
  let required = 'none';
  for (const change of changes) required = maxBump(required, change.bump);
  return required;
}

function parseVersion(version, label) {
  const match = String(version).match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  );
  if (!match) throw new Error(`${label} must be a semver version; received ${version}.`);
  return match.slice(1).map(Number);
}

export function versionBump(baselineVersion, currentVersion) {
  const before = parseVersion(baselineVersion, 'baselineVersion');
  const after = parseVersion(currentVersion, 'currentVersion');
  for (let index = 0; index < 3; index += 1) {
    if (after[index] < before[index]) {
      throw new Error(`currentVersion ${currentVersion} is older than baselineVersion ${baselineVersion}.`);
    }
    if (after[index] > before[index]) return ['major', 'minor', 'patch'][index];
  }
  return 'none';
}

export function evaluateSemverGate({
  changes,
  baselineVersion,
  currentVersion,
  changesetBump = 'none',
}) {
  assertBump(changesetBump, 'changesetBump');
  const required = minimumRequiredBump(changes);
  const declared = maxBump(versionBump(baselineVersion, currentVersion), changesetBump);
  return { required, declared, passes: BUMP_RANK[declared] >= BUMP_RANK[required] };
}

export function parseChangesetText(text) {
  const frontmatter = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) return new Map();
  const releases = [];
  const pattern = /^\s*(["']?)(@?[^"':\s]+(?:\/[^"':\s]+)?)\1\s*:\s*(major|minor|patch)\s*$/gm;
  for (const match of frontmatter.matchAll(pattern)) releases.push([match[2], match[3]]);
  return new Map(releases.sort(([left], [right]) => left.localeCompare(right)));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

function exactValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

export function applyReviewedExceptions(changes, config = { exceptions: [] }) {
  if (!config || !Array.isArray(config.exceptions)) {
    throw new Error('Public API exception config must contain an exceptions array.');
  }
  const adjusted = changes.map((change) => ({ ...change }));
  const seenIds = new Set();
  for (const exception of config.exceptions) {
    if (!exception || typeof exception !== 'object') throw new Error('Each API exception must be an object.');
    for (const field of [
      'changeId',
      'requiredBump',
      'allowedBump',
      'reason',
      'reviewer',
      'reviewedOn',
    ]) {
      if (typeof exception[field] !== 'string' || exception[field].trim() === '') {
        throw new Error(`API exception ${exception.changeId ?? '(unknown)'} requires a non-empty ${field}.`);
      }
    }
    assertBump(exception.requiredBump, 'exception.requiredBump');
    assertBump(exception.allowedBump, 'exception.allowedBump');
    if (BUMP_RANK[exception.allowedBump] >= BUMP_RANK[exception.requiredBump]) {
      throw new Error(`API exception ${exception.changeId} must lower the required bump.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.reviewedOn)) {
      throw new Error(`API exception ${exception.changeId} reviewedOn must use YYYY-MM-DD.`);
    }
    if (seenIds.has(exception.changeId)) {
      throw new Error(`Duplicate API exception for ${exception.changeId}.`);
    }
    seenIds.add(exception.changeId);
    const match = adjusted.find(
      (change) =>
        change.id === exception.changeId &&
        change.bump === exception.requiredBump &&
        exactValue(change.before, exception.before) &&
        exactValue(change.after, exception.after),
    );
    if (!match) {
      throw new Error(
        `Reviewed API exception ${exception.changeId} does not match any current API change; remove or update it.`,
      );
    }
    match.bump = exception.allowedBump;
    match.exception = {
      reason: exception.reason,
      reviewer: exception.reviewer,
      reviewedOn: exception.reviewedOn,
      originalBump: exception.requiredBump,
    };
  }
  return adjusted;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function parseNpmPackOutput(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch (error) {
    throw new Error(
      `npm pack did not return valid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }
  // Some npm versions (observed: 12.0.2) report `npm pack --json` as an object keyed by package
  // name rather than an array of one entry -- normalize both shapes the same way
  // scripts/check-package-size.mjs's readPackedMetrics() does.
  const entries = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null
      ? Object.values(parsed)
      : [];
  if (
    entries.length !== 1 ||
    typeof entries[0]?.filename !== 'string' ||
    !entries[0].filename.endsWith('.tgz')
  ) {
    throw new Error('npm pack must produce exactly one tarball filename.');
  }
  return entries[0].filename;
}

export function validateTarEntries(entries) {
  for (const rawEntry of entries) {
    const entry = String(rawEntry).replace(/\/$/, '');
    const segments = entry.split('/');
    if (
      entry === '' ||
      entry.startsWith('/') ||
      entry.includes('\\') ||
      entry.includes('\0') ||
      segments.some((segment) => segment === '..' || segment === '.') ||
      (entry !== 'package' && !entry.startsWith('package/'))
    ) {
      throw new Error(`Refusing unsafe archive entry in published baseline: ${rawEntry}`);
    }
  }
}

export function validateTarEntryTypes(verboseEntries) {
  for (const entry of verboseEntries) {
    const type = String(entry)[0];
    if (type !== '-' && type !== 'd') {
      throw new Error(
        `Refusing link or special-file entry in published baseline: ${entry}`,
      );
    }
  }
}

export function acquirePublishedBaseline(
  packageName,
  { run = execFileSync, temporaryDirectory = tmpdir() } = {},
) {
  const workingDirectory = mkdtempSync(path.join(temporaryDirectory, 'lyra-public-api-'));
  const execute = (command, args) =>
    run(command, args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  try {
    const versionValue = JSON.parse(
      execute('npm', ['view', `${packageName}@latest`, 'version', '--json']),
    );
    const version = Array.isArray(versionValue) ? versionValue.at(-1) : versionValue;
    parseVersion(version, 'published package version');
    const packOutput = execute('npm', [
      'pack',
      `${packageName}@${version}`,
      '--json',
      '--ignore-scripts',
      '--pack-destination',
      workingDirectory,
    ]);
    const filename = parseNpmPackOutput(packOutput);
    const tarball = path.join(workingDirectory, path.basename(filename));
    if (!existsSync(tarball)) throw new Error(`npm pack did not create ${tarball}.`);
    const entries = execute('tar', ['-tzf', tarball])
      .split(/\r?\n/)
      .filter(Boolean);
    validateTarEntries(entries);
    const verboseEntries = execute('tar', ['-tvzf', tarball, '--numeric-owner'])
      .split(/\r?\n/)
      .filter(Boolean);
    validateTarEntryTypes(verboseEntries);
    execute('tar', [
      '-xzf',
      tarball,
      '-C',
      workingDirectory,
      '--no-same-owner',
      '--no-same-permissions',
    ]);
    const root = path.join(workingDirectory, 'package');
    if (!existsSync(path.join(root, 'package.json'))) {
      throw new Error('Published baseline tarball does not contain package/package.json.');
    }
    return {
      root,
      version,
      cleanup: () => rmSync(workingDirectory, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(workingDirectory, { recursive: true, force: true });
    throw error;
  }
}

const DECLARATION_FILES = Object.freeze({
  named: 'dist/lyra.d.ts',
  react: 'dist/custom-elements-jsx.d.ts',
  vue: 'dist/vue.d.ts',
  svelte: 'dist/svelte.d.ts',
});

export function readPackageApi(root) {
  const packageJsonFile = path.join(root, 'package.json');
  const manifestFile = path.join(root, 'custom-elements.json');
  const namedDeclarationsFile = path.join(root, DECLARATION_FILES.named);
  if (!existsSync(packageJsonFile)) throw new Error(`Missing public API package metadata: ${packageJsonFile}`);
  if (!existsSync(manifestFile)) throw new Error(`Missing custom-elements manifest: ${manifestFile}`);
  if (!existsSync(namedDeclarationsFile)) {
    throw new Error(
      `Missing built public declarations: ${namedDeclarationsFile}. Run the package build before the public API gate.`,
    );
  }
  const declarations = { files: {}, packageFiles: [] };
  const collectFiles = (directory, relativeDirectory) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) collectFiles(absolute, relative);
      else if (entry.isFile()) {
        declarations.packageFiles.push(relative);
        if (/\.d\.[cm]?ts$/.test(entry.name)) {
          declarations.files[relative] = readFileSync(absolute, 'utf8');
        }
      }
    }
  };
  collectFiles(path.join(root, 'dist'), 'dist');
  declarations.packageFiles.sort();
  for (const [name, relativeFile] of Object.entries(DECLARATION_FILES)) {
    const file = path.join(root, relativeFile);
    if (existsSync(file)) declarations[name] = readFileSync(file, 'utf8');
  }
  declarations.namedEntry = DECLARATION_FILES.named;
  return { packageJson: readJson(packageJsonFile), manifest: readJson(manifestFile), declarations };
}

export function readChangesetBump(changesetDir, packageName) {
  if (!existsSync(changesetDir)) return 'none';
  const bumps = [];
  for (const name of readdirSync(changesetDir).sort()) {
    if (!name.endsWith('.md') || name === 'README.md') continue;
    const releases = parseChangesetText(readFileSync(path.join(changesetDir, name), 'utf8'));
    if (releases.has(packageName)) bumps.push(releases.get(packageName));
  }
  return maxBump('none', ...bumps);
}

function parseArgs(argv) {
  const options = {
    current: packageDir,
    changesets: path.join(repoRoot, '.changeset'),
    exceptions: path.join(scriptsDir, 'public-api-semver-exceptions.json'),
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    if (!['--baseline', '--current', '--changesets', '--exceptions'].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value) throw new Error(`${argument} requires a path.`);
    options[argument.slice(2)] = path.resolve(value);
    index += 1;
  }
  return options;
}

function reportResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(
    `Public API semver gate: ${result.packageName} ${result.baselineVersion} -> ${result.currentVersion}`,
  );
  console.log(`Required bump: ${result.gate.required}; declared bump: ${result.gate.declared}`);
  const counts = { major: 0, minor: 0, patch: 0, none: 0 };
  for (const change of result.changes) counts[change.bump] += 1;
  console.log(
    `Normalized changes: ${counts.major} major, ${counts.minor} minor, ` +
      `${counts.patch} reviewed patch, ${counts.none} reviewed no-release`,
  );
  for (const change of result.changes.slice(0, 100)) {
    const reviewed = change.exception ? ` (reviewed: ${change.exception.reason})` : '';
    console.log(`  [${change.bump}] ${change.id}${reviewed}`);
  }
  if (result.changes.length > 100) console.log(`  ... ${result.changes.length - 100} more change(s)`);
  console.log(result.gate.passes ? 'Public API semver gate passed.' : 'Public API semver gate failed.');
}

export function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const currentInput = readPackageApi(options.current);
  const published = options.baseline
    ? undefined
    : acquirePublishedBaseline(currentInput.packageJson.name);
  try {
    const baselineRoot = options.baseline ?? published.root;
    const baseline = normalizePublicApi(readPackageApi(baselineRoot));
    const current = normalizePublicApi(currentInput);
    let changes = diffPublicApi(baseline, current);
    const exceptionConfig = existsSync(options.exceptions)
      ? readJson(options.exceptions)
      : { exceptions: [] };
    changes = applyReviewedExceptions(changes, exceptionConfig);
    const changesetBump = readChangesetBump(options.changesets, current.packageName);
    const gate = evaluateSemverGate({
      changes,
      baselineVersion: baseline.version,
      currentVersion: current.version,
      changesetBump,
    });
    const result = {
      packageName: current.packageName,
      baselineVersion: baseline.version,
      currentVersion: current.version,
      baselineSource: options.baseline ?? `${current.packageName}@${published.version}`,
      changesetBump,
      gate,
      changes,
    };
    reportResult(result, options.json);
    return gate.passes ? 0 : 1;
  } finally {
    published?.cleanup();
  }
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    console.error(`Public API semver gate error: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

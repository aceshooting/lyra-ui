#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { expandManifestInheritance } from './manifest-compact.mjs';
import { SLIM_MANIFEST_FILE } from './slim-manifest.mjs';
import {
  findTopLevel,
  matchingIndex,
  normalizeType,
  normalizeWhitespace,
  PAIRS,
  splitTopLevel,
  stripOuterParens,
} from './public-api-diff-types.mjs';
export { normalizeType } from './public-api-diff-types.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.dirname(scriptsDir);
const repoRoot = path.resolve(packageDir, '..', '..');
const BUMP_RANK = Object.freeze({ none: 0, patch: 1, minor: 2, major: 3 });
const VALID_BUMPS = new Set(Object.keys(BUMP_RANK));

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

// Inline `import("file").Name` spellings of declarations a comparison proved relocated, mapped
// from the baseline spelling to the current one. Reset by every diffPublicApi() call.
let relocatedImportSpellings = new Map();

/** Rewrite every non-generic, uniquely defined alias, `typeof CONSTANT` and
 * `Interface['member']` reference in a normalized type text to its definition, repeating until
 * nothing changes. Property keys, parameter names, qualified members and string literals are left
 * alone, as is any name the text itself binds as a type parameter. The result is only used to
 * prove two spellings equivalent; it never replaces a recorded contract value. */
function expandTypeReferences(typeTextValue, snapshot) {
  const aliases = snapshot?.typeAliases ?? {};
  const constants = snapshot?.constantTypes ?? {};
  const interfaces = snapshot?.interfaceMembers ?? {};
  const identifier = /[A-Za-z_$][\w$]*/y;
  const expandOnce = (text) => {
    let output = '';
    let changed = false;
    let index = 0;
    while (index < text.length) {
      const character = text[index];
      if (character === "'" || character === '"' || character === '`') {
        let end = index + 1;
        while (end < text.length && text[end] !== character) end += text[end] === '\\' ? 2 : 1;
        const body = text.slice(index + 1, end);
        output += character !== '`' && !/['\\]/.test(body) ? `'${body}'` : text.slice(index, end + 1);
        index = end + 1;
        continue;
      }
      if (!/[A-Za-z_$]/.test(character) || /[\w$.]/.test(text[index - 1] ?? '')) {
        output += character;
        index += 1;
        continue;
      }
      identifier.lastIndex = index;
      const name = identifier.exec(text)[0];
      let end = index + name.length;
      const rest = text.slice(end);
      if (name === 'typeof') {
        identifier.lastIndex = end + (/^\s*/.exec(rest)[0].length);
        const target = identifier.exec(text)?.[0];
        const after = identifier.lastIndex;
        if (target && !/^\s*[.<[]/.test(text.slice(after)) && constants[target] !== undefined) {
          output += `(${constants[target]})`;
          index = after;
          changed = true;
          continue;
        }
        output += name;
        index = end;
        continue;
      }
      // A name the text binds itself (`infer X`, `X extends ...`, `<X>(...)`) is a type parameter.
      const escaped = name.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
      const bound = new RegExp(`\\binfer\\s+${escaped}\\b|\\b${escaped}\\s+extends\\b|<[^<>]*\\b${escaped}\\b[^<>]*>\\s*\\(`).test(text);
      if (/^\s*\??:/.test(rest) || /^\s*[(<]/.test(rest) || bound || name.length < 2) {
        output += name;
        index = end;
        continue;
      }
      const member = /^\[\s*'([^'\\]*)'\s*\]/.exec(rest) ?? /^\[\s*"([^"\\]*)"\s*\]/.exec(rest);
      const memberType = member && (interfaces[name] && Object.hasOwn(interfaces[name], member[1])
        ? interfaces[name][member[1]]
        : aliasMemberType(aliases[name], member[1])) || undefined;
      if (memberType !== undefined) {
        output += `(${memberType})`;
        end += member[0].length;
        changed = true;
      } else if (Array.isArray(aliases[name]) && aliases[name].length === 1) {
        output += `(${aliases[name][0]})`;
        changed = true;
      } else output += name;
      index = end;
    }
    return { output, changed };
  };
  // `(readonly['a','b'])[number]` is the element union a `typeof TUPLE[number]` alias names.
  const tupleElements = (text) => text.replace(
    /\(\s*(?:\(\s*)?(?:readonly\s*)?\[\s*('[^'\\]*'(?:\s*,\s*'[^'\\]*')*)\s*,?\s*\](?:\s*\))?\s*\)\s*\[number\]/g,
    (_, elements) => `(${elements.split(',').map((element) => element.trim()).filter(Boolean).join('|')})`,
  );
  let value = normalizeType(typeTextValue);
  for (let pass = 0; pass < 12; pass += 1) {
    const { output, changed } = expandOnce(value);
    const next = normalizeType(tupleElements(output));
    if (!changed && next === value) break;
    value = next;
  }
  // Nested unions only flatten once their parentheses are gone; settle the normal form.
  for (let pass = 0; pass < 4; pass += 1) {
    // Only a grouping parenthesis may go: never a call/parameter list, an array or indexed
    // operand, or one that keeps a union/intersection/function boundary inside a larger type.
    const next = normalizeType(value.replace(/\(([^()]*)\)/g, (match, inner, offset) => {
      const before = value.slice(0, offset);
      const after = value.slice(offset + match.length);
      if (/[\w$\]>)]\s*$/.test(before) || /^\s*(?:=>|\[)/.test(after) || inner.includes(':')) return match;
      const operators = /[|&]/.test(inner);
      const bounded = (/(?:^|[<,|(])\s*$/.test(before) || before.trim() === '')
        && (/^\s*(?:$|[>,|)])/.test(after));
      return !operators || bounded ? inner : match;
    }));
    if (next === value) break;
    value = next;
  }
  return value;
}

/** `Alias['key']` for an alias of object literals (optionally `Readonly<...>`, optionally a
 * union of them) that each declare `key`: the union of those member types. */
function aliasMemberType(definitions, key) {
  if (!Array.isArray(definitions) || definitions.length !== 1) return undefined;
  const types = [];
  for (let atom of typeAtoms(definitions[0])) {
    const readonly = genericTypeParts(atom);
    if (readonly?.name === 'Readonly' && readonly.args.length === 1) atom = readonly.args[0];
    const members = objectTypeMembers(atom);
    if (!members) return undefined;
    const entry = [...members].find(([name]) => name.replace(/^readonly\s+/, '') === key)?.[1];
    if (!entry) return undefined;
    types.push(entry.optional ? `${entry.type}|undefined` : entry.type);
  }
  return types.length > 0 ? normalizeType(types.map((type) => `(${type})`).join('|')) : undefined;
}

/** Apply proven relocations to a baseline type text's inline import spellings. */
function translateRelocatedSpellings(typeTextValue) {
  let value = String(typeTextValue);
  for (const [before, after] of relocatedImportSpellings) value = value.split(before).join(after);
  return value;
}

/** Whether two spellings denote the same type once aliases, constants and relocations resolve. */
function isEquivalentType(before, after, baseline, current) {
  if (typeof before !== 'string' || typeof after !== 'string') return false;
  return expandTypeReferences(translateRelocatedSpellings(before), baseline)
    === expandTypeReferences(after, current);
}

/** Intersections whose members pair up one-to-one, each identical or an object that only gained
 * optional members, e.g. `Detail & {a?: X}` -> `Detail & {a?: X; b?: Y}`. */
function isIntersectionWidening(before, after) {
  const oldMembers = splitTopLevel(normalizeType(before), '&').map(normalizeType);
  const newMembers = splitTopLevel(normalizeType(after), '&').map(normalizeType);
  if (oldMembers.length < 2 || oldMembers.length !== newMembers.length) return false;
  const unclaimed = [...newMembers];
  let widened = false;
  for (const member of oldMembers) {
    let index = unclaimed.indexOf(member);
    if (index < 0) {
      index = unclaimed.findIndex((candidate) => isObjectTypeWidening(member, candidate));
      if (index < 0) return false;
      widened = true;
    }
    unclaimed.splice(index, 1);
  }
  return widened;
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

/** Prove additive literal members in readonly arrays, including unchanged-shape Readonly objects
 * containing them. Other leaves, mutable containers and arbitrary generic wrappers are opaque. */
function isReadonlyLiteralCollectionWidening(before, after, baseline, current) {
  const parseType = (text) => {
    const normalized = normalizeType(text);
    if (!/^(?:readonly\b|Readonly<)/.test(normalized)) return undefined;
    const source = `type Collection = ${normalized};`;
    const parsed = parseSync('readonly-collection.d.ts', source, { lang: 'ts', sourceType: 'module' });
    const declaration = parsed.program.body[0];
    if (parsed.errors.length > 0 || parsed.program.body.length !== 1
      || declaration?.type !== 'TSTypeAliasDeclaration') return undefined;
    return { source, node: declaration.typeAnnotation };
  };
  const oldType = parseType(before);
  const nextType = parseType(after);
  if (!oldType || !nextType) return false;
  const unwrap = (node) => {
    while (node?.type === 'TSTypeAnnotation' || node?.type === 'TSParenthesizedType') {
      node = node.typeAnnotation;
    }
    return node;
  };
  const literalElements = (node) => {
    if (node?.type !== 'TSTypeOperator' || node.operator !== 'readonly') return undefined;
    const array = unwrap(node.typeAnnotation);
    if (array?.type !== 'TSArrayType') return undefined;
    const literals = new Set();
    const collect = (element) => {
      element = unwrap(element);
      if (element?.type === 'TSUnionType') return element.types.every(collect);
      if (element?.type !== 'TSLiteralType' || typeof element.literal?.value !== 'string') return false;
      literals.add(element.literal.value);
      return true;
    };
    return collect(array.elementType) && literals.size > 0 ? literals : undefined;
  };
  const readonlyMembers = (node) => {
    if (baseline?.shadowedReadonly || current?.shadowedReadonly) return undefined;
    if (node?.type !== 'TSTypeReference' || node.typeName?.type !== 'Identifier'
      || node.typeName.name !== 'Readonly' || node.typeArguments?.params?.length !== 1) return undefined;
    const object = unwrap(node.typeArguments.params[0]);
    if (object?.type !== 'TSTypeLiteral') return undefined;
    const members = new Map();
    for (const member of object.members) {
      if (member.type !== 'TSPropertySignature' || member.computed || !member.typeAnnotation) return undefined;
      const key = member.key?.type === 'Identifier' ? member.key.name
        : member.key?.type === 'Literal' && typeof member.key.value === 'string' ? member.key.value
          : undefined;
      if (key === undefined || members.has(key)) return undefined;
      members.set(key, member);
    }
    return members;
  };
  const widen = (oldNode, nextNode) => {
    oldNode = unwrap(oldNode);
    nextNode = unwrap(nextNode);
    const oldElements = literalElements(oldNode);
    const nextElements = literalElements(nextNode);
    if (oldElements || nextElements) {
      return Boolean(oldElements && nextElements && nextElements.size > oldElements.size
        && [...oldElements].every((literal) => nextElements.has(literal)));
    }
    const oldMembers = readonlyMembers(oldNode);
    const nextMembers = readonlyMembers(nextNode);
    if (!oldMembers || !nextMembers || oldMembers.size !== nextMembers.size) return false;
    let widened = false;
    for (const [name, member] of oldMembers) {
      const next = nextMembers.get(name);
      if (!next || Boolean(member.optional) !== Boolean(next.optional)
        || Boolean(member.readonly) !== Boolean(next.readonly)) return false;
      const oldAnnotation = unwrap(member.typeAnnotation);
      const nextAnnotation = unwrap(next.typeAnnotation);
      if (normalizeType(nodeText(oldType, oldAnnotation)) === normalizeType(nodeText(nextType, nextAnnotation))) continue;
      if (!widen(oldAnnotation, nextAnnotation)) return false;
      widened = true;
    }
    return widened;
  };
  return widen(oldType.node, nextType.node);
}

function isTypeWidening(before, after, baseline, current, allowReadonlyCollections = true) {
  const resolvedBefore = resolveUniqueAliases(before, baseline);
  const resolvedAfter = resolveUniqueAliases(after, current);
  if (resolvedBefore !== normalizeType(before) || resolvedAfter !== normalizeType(after)) {
    return isTypeWidening(resolvedBefore, resolvedAfter, baseline, current, allowReadonlyCollections);
  }
  if (allowReadonlyCollections && isReadonlyLiteralCollectionWidening(before, after, baseline, current)) return true;
  if (isObjectTypeWidening(before, after) || isIntersectionWidening(before, after)) return true;
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
          if (isTypeWidening(oldAtom, candidate, baseline, current, false)) {
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
    if (!isTypeWidening(beforeArg, afterArg, baseline, current, false)) return false;
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

function maskDeclarationComments(source, comments) {
  let output = '';
  let cursor = 0;
  for (const comment of comments) {
    output += source.slice(cursor, comment.start);
    // Preserve AST offsets and line breaks while removing prose from type/member text.
    // Parser ranges distinguish comments from slash-containing string and template literals.
    output += source.slice(comment.start, comment.end).replace(/[^\r\n\u2028\u2029]/g, ' ');
    cursor = comment.end;
  }
  return output + source.slice(cursor);
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
    source: maskDeclarationComments(source, parsed.comments),
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
          // Ambient value declarations can carry a type exportKind in the parser AST.
          // Their declaration still exposes a runtime value; explicit type-only specifiers
          // are handled separately below.
          kind: declarationKind(record.node),
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
  if (base.endsWith('.mjs')) candidates.push(base.replace(/\.mjs$/, '.d.mts'));
  if (base.endsWith('.cjs')) candidates.push(base.replace(/\.cjs$/, '.d.cts'));
  if (base.endsWith('.js')) candidates.push(base.replace(/\.js$/, '.d.ts'));
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
    tupleElementAliasCache: new Map(),
    moduleDependencyCache: new Map(),
    directDependencyCache: new Map(),
    publicOrigins: new Map(),
    publicAliasCandidates: new Map(),
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
        const definition = tupleElementAliasType(graph, { module, records: [record], path: record.path })
          ?? typeNodeText(module, node.typeAnnotation);
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

/** Declared types of ambient constants and the members of plain interfaces, keyed by name. They
 * let a type text that names `typeof CONSTANT` or `Interface['member']` be compared with an
 * equivalent spelling. A name declared more than once keeps every definition, which disables its
 * expansion; generic or extending interfaces are omitted because their members need substitution
 * or merging first. */
function normalizedStructuralNames(graph) {
  const constants = new Map();
  const interfaces = new Map();
  const remember = (map, name, value) => {
    const values = map.get(name) ?? [];
    values.push(value);
    map.set(name, values);
  };
  // Only declarations the public graph reaches: a private-only helper must not enter the snapshot.
  const reachable = graph?.directDependencyCache ?? new Map();
  for (const module of graph?.modules?.values() ?? []) {
    for (const records of module.symbols.values()) {
      for (const record of records) {
        const node = record.node;
        if (!record.name || record.name.includes(MODULE_NAMESPACE_SEGMENT)) continue;
        if (!reachable.has(declarationIdentity({ module, records: [record], path: record.path }))) continue;
        if (node.type === 'VariableDeclarator') {
          remember(constants, record.name, node.id?.typeAnnotation
            ? typeNodeText(module, node.id.typeAnnotation)
            : null);
        } else if (node.type === 'TSInterfaceDeclaration') {
          if (node.typeParameters?.params?.length || node.extends?.length) {
            remember(interfaces, record.name, null);
            continue;
          }
          const members = {};
          let supported = true;
          for (const member of node.body?.body ?? []) {
            const key = member.type === 'TSPropertySignature' && !member.computed
              ? propertyName(member.key, module)
              : undefined;
            if (key === undefined || !member.typeAnnotation || Object.hasOwn(members, key)) {
              supported = false;
              break;
            }
            const type = typeNodeText(module, member.typeAnnotation);
            members[key] = member.optional ? normalizeType(`${type}|undefined`) : type;
          }
          remember(interfaces, record.name, supported ? members : null);
        } else if (node.type === 'ClassDeclaration' || node.type === 'TSEnumDeclaration') {
          // A same-named value or class makes a bare name ambiguous for both maps.
          remember(constants, record.name, null);
          remember(interfaces, record.name, null);
        }
      }
    }
  }
  const unique = (map) => Object.fromEntries([...map]
    .filter(([, values]) => values.length === 1 && values[0] !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, [value]]) => [name, value]));
  return { constantTypes: unique(constants), interfaceMembers: unique(interfaces) };
}

/** Public routes with competing or unresolved wildcard exports cannot prove one alias authority. */
function recordPublicOrigin(graph, base, entryFile, name, resolved) {
  graph.publicOrigins.set(base, declarationIdentity(resolved));
  if (resolved.records.length !== 1 || resolved.records[0].node.type !== 'TSTypeAliasDeclaration') return;
  const seen = new Set();
  let file = entryFile;
  let exported = name;
  while (file) {
    const key = JSON.stringify([file, exported]);
    if (seen.has(key)) return;
    seen.add(key);
    const module = graph.getModule(file);
    const binding = module?.directExports.get(exported);
    if (binding && !binding.source) {
      const local = binding.localPath ?? (binding.local ? [binding.local] : undefined);
      if (local && resolveLocalDeclaration(module, local)) {
        graph.publicAliasCandidates.set(base, resolved);
        return;
      }
      const imported = module.imports.get(binding.local);
      if (!imported || imported.imported === '*') return;
      file = resolveDeclarationFile(graph.files, file, imported.source);
      exported = imported.imported;
    } else if (binding) {
      file = resolveDeclarationFile(graph.files, file, binding.source);
      exported = binding.local;
    } else {
      if (module?.exportStars.length !== 1) return;
      file = resolveDeclarationFile(graph.files, file, module.exportStars[0].source);
    }
  }
}

/** A proof for public, non-generic string-union aliases. Only a local declaration or a direct
 * relative named import can supply a referenced alias. Preserve the original declaration text
 * and dependency edges for every other part of the comparison. */
function publicLiteralAliasSets(graph) {
  if (!graph) return {};
  const cache = new Map();
  const visiting = new Set();
  const fingerprints = {};
  const literals = (owner) => {
    const declaration = owner?.records.length === 1 && owner.records[0].node;
    if (!declaration || declaration.type !== 'TSTypeAliasDeclaration' ||
        declaration.typeParameters?.params?.length || owner.namespace) return undefined;
    if (cache.has(declaration)) return cache.get(declaration);
    if (visiting.has(declaration)) return undefined;
    visiting.add(declaration);
    const values = new Set();
    const collect = (node) => {
      if (node.type === 'TSParenthesizedType') return collect(node.typeAnnotation);
      if (node.type === 'TSUnionType') return node.types.every(collect);
      if (node.type === 'TSLiteralType' && typeof node.literal?.value === 'string') {
        values.add(node.literal.value);
        return true;
      }
      if (node.type !== 'TSTypeReference' || node.typeName.type !== 'Identifier' ||
          node.typeArguments?.params?.length) return false;
      const name = node.typeName.name;
      let target = resolveScopedLocalDeclaration(owner.module, owner.path, [name]);
      if (!target) {
        const imported = owner.module.imports.get(name);
        const file = imported && resolveDeclarationFile(graph.files, owner.module.file, imported.source);
        const module = file && graph.getModule(file);
        const binding = module?.directExports.get(imported.imported);
        if (!binding || binding.source) return false;
        const local = binding.localPath ?? (binding.local ? [binding.local] : undefined);
        target = local && resolveLocalDeclaration(module, local);
      }
      const nested = literals(target);
      if (!nested) return false;
      for (const value of nested) values.add(value);
      return true;
    };
    const result = collect(declaration.typeAnnotation) ? values : undefined;
    visiting.delete(declaration);
    cache.set(declaration, result);
    return result;
  };
  const byDeclaration = new Map();
  for (const [route, owner] of graph.publicAliasCandidates) {
    if (!byDeclaration.has(owner.records[0].node)) {
      const values = literals(owner);
      byDeclaration.set(owner.records[0].node, values && createHash('sha256')
        .update(JSON.stringify([...values].sort())).digest('hex'));
    }
    const proof = byDeclaration.get(owner.records[0].node);
    if (proof) fingerprints[route] = proof;
  }
  return fingerprints;
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
    kind: kind === 'property' && member.static ? 'static-property' : kind,
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

function accessorType(module, descriptor) {
  const { member } = descriptor;
  if (!['TSMethodSignature', 'MethodDefinition'].includes(member.type)
    || !['get', 'set'].includes(member.kind) || member.computed || member.optional
    || member.abstract || member.decorators?.length) return undefined;
  const method = member.value && typeof member.value === 'object' ? member.value : member;
  const parameters = method.params ?? member.parameters;
  if (!Array.isArray(parameters) || method.typeParameters?.params?.length
    || method.async || method.generator) return undefined;
  if (member.kind === 'get') {
    if (parameters.length !== 0 || !method.returnType) return undefined;
    return { read: typeNodeText(module, method.returnType), write: null };
  }
  const [parameter] = parameters;
  if (parameters.length !== 1 || parameter.type !== 'Identifier' || parameter.optional
    || parameter.name === 'this' || !parameter.typeAnnotation || method.returnType) return undefined;
  return { read: null, write: typeNodeText(module, parameter.typeAnnotation) };
}

/** Explicit accessors share a property identity; unsupported or conflicting declarations retain
 * their complete shape instead of guessing read/write capabilities from incomplete annotations. */
function memberDescriptors(module, members) {
  const descriptors = members
    .map((member) => memberDescriptor(module, member))
    .filter(({ member, accessibility }) =>
      member.key?.type !== 'PrivateIdentifier' && accessibility !== 'private')
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey));
  const groups = new Map();
  for (const descriptor of descriptors) {
    const key = JSON.stringify([descriptor.name, descriptor.static]);
    const group = groups.get(key) ?? [];
    group.push(descriptor);
    groups.set(key, group);
  }
  return [...groups.values()].flatMap((group) => {
    if (!group.some(({ member }) => member.kind === 'get' || member.kind === 'set')) return group;
    const types = group.map((descriptor) => accessorType(module, descriptor));
    const supported = types.every(Boolean)
      && new Set(group.map(({ accessibility }) => accessibility)).size === 1
      && new Set(group.map(({ member }) => member.kind)).size === group.length;
    const first = group[0];
    const common = {
      ...first,
      idName: first.name,
      parameters: undefined,
      typeParameters: [],
    };
    if (!supported) return [{
      ...common,
      kind: first.static ? 'static-unsupported-accessor' : 'unsupported-accessor',
      unsupportedAccessor: true,
      type: group.map(({ member }) => normalizeWhitespace(canonicalNodeText(module, member))).sort(),
    }];
    const access = {
      read: types.find((type) => type.read !== null)?.read ?? null,
      write: types.find((type) => type.write !== null)?.write ?? null,
    };
    return [{ ...common, kind: first.static ? 'static-property' : 'property',
      readonly: access.write === null, access }];
  });
}

function addMemberSurfaces(entries, base, surface, label, module, members) {
  const descriptors = memberDescriptors(module, members);
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
    if (descriptor.access || descriptor.unsupportedAccessor) {
      addEntry(entries, `${memberBase}:type`, surface,
        descriptor.access ? 'property-access' : 'shape', descriptor.access ?? descriptor.type, memberBase);
    } else addTypeSurface(entries, memberBase, surface, descriptor.type, memberBase);
  }
}

// A single nongeneric method returning void can forward the exact argument tuple of its
// direct base method without adding a member. Parameters cannot preserve overloads, method
// generics or explicit this parameters, so those shapes deliberately remain conservative.
// A generic base is supported only when its type parameters do not occur in the method.
function inheritedParameterForwarder(graph, resolved, primary, member) {
  const method = member.value;
  const ordinaryVoidMethod = (candidate) => candidate.type === 'MethodDefinition'
    && candidate.kind === 'method' && !candidate.computed && !candidate.static
    && !candidate.abstract && !candidate.optional && !candidate.decorators?.length
    && (candidate.accessibility ?? 'public') === 'public'
    && !candidate.value?.typeParameters?.params?.length
    && candidate.value?.returnType?.typeAnnotation?.type === 'TSVoidKeyword';
  if (!graph || !primary.superClass
    || primary.typeParameters?.params?.length || resolved.records.length !== 1 || resolved.path?.length !== 1
    || !ordinaryVoidMethod(member) || method.params.length !== 1) return false;
  const parameter = method.params[0];
  const type = parameter.typeAnnotation?.typeAnnotation;
  if (parameter.type !== 'RestElement' || parameter.optional
    || type?.type !== 'TSTypeReference' || type.typeName?.type !== 'Identifier'
    || type.typeName.name !== 'Parameters' || type.typeArguments?.params?.length !== 1
    || resolved.module.imports.has('Parameters')
    || resolveTypeDependencies(graph, resolved, 'Parameters').length) return false;
  const indexed = type.typeArguments.params[0];
  const key = propertyName(member.key, resolved.module);
  if (indexed.type !== 'TSIndexedAccessType'
    || indexed.indexType?.type !== 'TSLiteralType' || indexed.indexType.literal?.value !== key
    || indexed.objectType?.type !== 'TSTypeReference' || indexed.objectType.typeArguments) return false;
  const heritage = entityNameParts(primary.superClass).join('.');
  const target = entityNameParts(indexed.objectType.typeName).join('.');
  if (!heritage || target !== heritage) return false;
  const parents = resolveTypeDependencies(graph, resolved, heritage);
  if (parents.length !== 1) return false;
  const parent = parents[0].resolved;
  if (parent.records.length !== 1) return false;
  const parentClass = parent.records[0].node;
  if (parentClass.type !== 'ClassDeclaration') return false;
  const ownGroup = primary.body.body.filter((candidate) =>
    propertyName(candidate.key, resolved.module) === key);
  const inherited = parentClass.body.body.filter((candidate) =>
    propertyName(candidate.key, parent.module) === key);
  const parentParameters = new Set((parentClass.typeParameters?.params ?? []).map((type) => type.name.name));
  const dependsOnInstance = (node) => node && typeof node === 'object'
    && (node.type === 'TSThisType' || node.type === 'ThisExpression'
      || (node.type === 'Identifier' && parentParameters.has(node.name))
      || Object.values(node).some((value) =>
        Array.isArray(value) ? value.some(dependsOnInstance) : dependsOnInstance(value)));
  return ownGroup.length === 1 && inherited.length === 1 && ordinaryVoidMethod(inherited[0])
    && !inherited[0].value.params.some((argument) => argument.name === 'this' || dependsOnInstance(argument));
}

// Lit is a runtime dependency whose declarations are not part of this package, so a class's
// chain ends at `LitElement`. The lifecycle members every element inherits from it are restated
// here exactly as lit's own typings declare them (lit 3, `@lit/reactive-element` 2), so removing
// a redundant override resolves to the member that remains reachable instead of to nothing.
// Anything not listed stays unresolved, which keeps a removal conservative.
const EXTERNAL_BASE_CLASSES = new Map([
  ['lit#LitElement', `import type { PropertyValues } from 'lit';
export declare class LitElement {
  connectedCallback(): void;
  disconnectedCallback(): void;
  attributeChangedCallback(name: string, _old: string | null, value: string | null): void;
  protected createRenderRoot(): HTMLElement | DocumentFragment;
  protected shouldUpdate(_changedProperties: PropertyValues): boolean;
  protected willUpdate(_changedProperties: PropertyValues): void;
  protected update(changedProperties: PropertyValues): void;
  protected updated(_changedProperties: PropertyValues): void;
  protected firstUpdated(_changedProperties: PropertyValues): void;
  protected render(): unknown;
}`],
]);
const externalBaseCache = new Map();

function externalBaseClass(module, reference) {
  const imported = module.imports.get(reference);
  if (!imported || imported.imported === '*' || /^[./]/.test(imported.source)) return undefined;
  const key = `${imported.source}#${imported.imported}`;
  if (!EXTERNAL_BASE_CLASSES.has(key)) return undefined;
  if (!externalBaseCache.has(key)) {
    const external = parseDeclarationModule(`\0external/${key}.d.ts`, EXTERNAL_BASE_CLASSES.get(key));
    const records = external.symbols.get(symbolPathKey([imported.imported])) ?? [];
    externalBaseCache.set(key, records.length === 1
      ? { module: external, records, path: [imported.imported], external: true }
      : undefined);
  }
  return externalBaseCache.get(key);
}

/** Whether an inherited member's recorded text means the same thing when projected into the
 * deriving class. Its spelling must be free of `this`/`typeof`/inline imports and of the
 * ancestor's own type parameters, and every named type must either carry an external package
 * authority in the recorded text or resolve to the same declaration from both scopes. */
function scopeSafeInheritedMember(graph, ancestor, derived, member) {
  if (!['MethodDefinition', 'PropertyDefinition'].includes(member.type)
    || (member.type === 'MethodDefinition' && !['method', 'get', 'set'].includes(member.kind))
    || member.computed || member.abstract || member.decorators?.length
    || member.accessibility === 'private' || member.key?.type === 'PrivateIdentifier') return false;
  const { module } = ancestor;
  const sameDeclaration = (name) => {
    const leftmost = name.split('.')[0];
    const imported = module.imports.get(leftmost);
    if (imported && imported.imported !== '*' && !/^[./]/.test(imported.source)
      && !module.resolveImportSource?.(imported.source)) return true;
    if (!graph || ancestor.external) return false;
    const from = resolveTypeDependencies(graph, ancestor, name);
    const to = resolveTypeDependencies(graph, derived, name);
    return from.length === 1 && to.length === 1
      && declarationIdentity(from[0].resolved) === declarationIdentity(to[0].resolved);
  };
  const scopeDependent = new Set(['TSTypeQuery', 'TSImportType', 'TSThisType', 'ThisExpression']);
  const visit = (node) => {
    if (!node || typeof node !== 'object') return true;
    if (scopeDependent.has(node.type)) return false;
    if (node.type === 'TSTypeReference') {
      const leftmost = leftmostEntityIdentifier(node.typeName);
      if (!leftmost || module.binderNames.has(nodePositionKey(leftmost))) return false;
      if (!sameDeclaration(entityNameParts(node.typeName).join('.'))) return false;
      return visit(node.typeArguments);
    }
    return Object.entries(node).every(([key, value]) =>
      key === 'type' || key === 'start' || key === 'end'
        || (Array.isArray(value) ? value.every(visit) : visit(value)));
  };
  return visit(member);
}

/** Member names a mixin's constructor type adds, or undefined when one cannot be resolved. */
function mixinInstanceMemberNames(graph, owner, constructorType, seen = new Set()) {
  const names = new Set();
  const unwrap = (node) => {
    while (node?.type === 'TSParenthesizedType' || node?.type === 'TSTypeAnnotation') node = node.typeAnnotation;
    return node;
  };
  const collect = (resolvedOwner, node) => {
    node = unwrap(node);
    if (node?.type === 'TSIntersectionType') return node.types.every((part) => collect(resolvedOwner, part));
    let targets;
    if (node?.type === 'TSTypeReference') {
      targets = resolveTypeDependencies(graph, resolvedOwner, entityNameParts(node.typeName).join('.'));
    } else if (node?.type === 'TSImportType' && typeof node.source?.value === 'string') {
      targets = resolveImportTypeDependencies(graph, resolvedOwner.module,
        { source: node.source.value, qualifier: entityNameParts(node.qualifier) });
    } else if (node?.type === 'TSTypeLiteral') {
      for (const member of node.members) {
        const name = propertyName(member.key, resolvedOwner.module);
        if (name === undefined) return false;
        names.add(name);
      }
      return true;
    } else return false;
    if (targets.length !== 1 || targets[0].resolved.records.length !== 1) return false;
    const target = targets[0].resolved;
    const identity = declarationIdentity(target);
    if (seen.has(identity)) return true;
    seen.add(identity);
    const declaration = target.records[0].node;
    if (declaration.type === 'TSTypeAliasDeclaration') return collect(target, declaration.typeAnnotation);
    if (declaration.type !== 'TSInterfaceDeclaration' && declaration.type !== 'ClassDeclaration') return false;
    for (const member of declaration.body?.body ?? []) {
      const name = propertyName(member.key, target.module);
      if (name === undefined) return false;
      names.add(name);
    }
    if (declaration.type === 'ClassDeclaration' && declaration.superClass) return false;
    return (declaration.extends ?? []).every((heritage) => collect(target, {
      type: 'TSTypeReference', typeName: heritage.expression, typeArguments: heritage.typeArguments,
    }));
  };
  const constructor = unwrap(constructorType);
  if (constructor?.type !== 'TSConstructorType') return undefined;
  return collect(owner, constructor.returnType) ? names : undefined;
}

/** The next class up a heritage chain. A `typeof Base & (new (...) => Mixin)` constant, the
 * declaration a mixin call leaves behind, continues at `Base`; the mixin's own members are
 * returned so they shadow, rather than inherit, anything `Base` declares under those names. */
function nextHeritageClass(graph, owner, reference, seen) {
  const dependencies = resolveTypeDependencies(graph, owner, reference);
  if (dependencies.length === 0) {
    const external = externalBaseClass(owner.module, reference);
    return external ? { ancestor: external, node: external.records[0].node, mixinNames: [] } : undefined;
  }
  if (dependencies.length !== 1) return undefined;
  const ancestor = dependencies[0].resolved;
  const identity = declarationIdentity(ancestor);
  if (seen.has(identity) || ancestor.records.length !== 1) return undefined;
  seen.add(identity);
  const node = ancestor.records[0].node;
  if (node.type === 'ClassDeclaration') return { ancestor, node, mixinNames: [] };
  let type = node.type === 'VariableDeclarator' ? node.id?.typeAnnotation?.typeAnnotation : undefined;
  while (type?.type === 'TSParenthesizedType') type = type.typeAnnotation;
  if (type?.type !== 'TSIntersectionType') return undefined;
  const queries = type.types.filter((part) => part.type === 'TSTypeQuery');
  const baseName = queries.length === 1 && !queries[0].typeArguments
    ? entityNameParts(queries[0].exprName).join('.')
    : '';
  if (!baseName) return undefined;
  const mixinNames = [];
  for (const part of type.types) {
    if (part === queries[0]) continue;
    const names = mixinInstanceMemberNames(graph, ancestor, part);
    if (!names) return undefined;
    mixinNames.push(...names);
  }
  const next = nextHeritageClass(graph, ancestor, baseName, seen);
  return next && { ...next, mixinNames: [...mixinNames, ...next.mixinNames] };
}

/** Project inherited members into the effective class contract when their text provably means
 * the same thing in the deriving class. An explicit identical override then retains the same
 * entries, a changed override is still compared with the inherited signature, and removing a
 * redundant override leaves the inherited member in place. Nearest declarations shadow whole
 * overload groups and accessor pairs; an unresolvable step ends the walk conservatively. */
function addClassMemberSurfaces(entries, base, surface, label, resolved, primary, graph) {
  const ownMembers = (primary.body?.body ?? []).filter((member) =>
    !inheritedParameterForwarder(graph, resolved, primary, member));
  addMemberSurfaces(entries, base, surface, label, resolved.module, ownMembers);
  if (!graph || !primary.superClass) return;
  // Member entry IDs share a name across static and instance sides. Do not project an
  // inherited entry over a same-named own member; its static flag remains part of the diff.
  const memberKey = (module, member) => propertyName(member.key, module);
  const shadowed = new Set(ownMembers.map((member) =>
    memberKey(resolved.module, member)));
  let ancestor = resolved;
  let ancestorNode = primary;
  const seen = new Set([declarationIdentity(resolved)]);
  while (ancestorNode.superClass) {
    const reference = entityNameParts(ancestorNode.superClass).join('.');
    if (!reference) break;
    const step = nextHeritageClass(graph, ancestor, reference, seen);
    if (!step || step.node.type !== 'ClassDeclaration') break;
    for (const name of step.mixinNames) shadowed.add(name);
    ancestor = step.ancestor;
    ancestorNode = step.node;
    const groups = new Map();
    for (const member of ancestorNode.body?.body ?? []) {
      const key = memberKey(ancestor.module, member);
      const group = groups.get(key) ?? [];
      group.push(member);
      groups.set(key, group);
    }
    for (const [key, inherited] of groups) {
      if (shadowed.has(key)) continue;
      shadowed.add(key);
      if (inherited.every((member) => scopeSafeInheritedMember(graph, ancestor, resolved, member))) {
        addMemberSurfaces(entries, base, surface, label, ancestor.module, inherited);
      }
    }
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
    addTypeSurface(entries, base, surface,
      tupleElementAliasType(graph, resolved) ?? typeNodeText(module, primary.typeAnnotation), label);
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
    addClassMemberSurfaces(entries, base, surface, label, resolved, primary, graph);
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

/** A whole alias of a nonempty readonly string tuple's element type exposes a union, not its
 * indices or length. Project only that complete, resolved shape; every other tuple use keeps
 * its ordinary declaration contract and dependency edges. */
function tupleElementAliasType(graph, resolved) {
  if (!graph) return undefined;
  const identity = declarationIdentity(resolved);
  if (graph.tupleElementAliasCache.has(identity)) return graph.tupleElementAliasCache.get(identity);
  const project = () => {
    if (resolved.records.length !== 1) return undefined;
    const alias = resolved.records[0].node;
    if (alias.type !== 'TSTypeAliasDeclaration' || (alias.typeParameters?.params?.length ?? 0) > 0) {
      return undefined;
    }
    const unwrap = (node) => {
      while (node?.type === 'TSTypeAnnotation' || node?.type === 'TSParenthesizedType') {
        node = node.typeAnnotation;
      }
      return node;
    };
    const indexed = unwrap(alias.typeAnnotation);
    if (indexed?.type !== 'TSIndexedAccessType' || indexed.indexType?.type !== 'TSNumberKeyword') {
      return undefined;
    }
    const query = unwrap(indexed.objectType);
    if (query?.type !== 'TSTypeQuery' || (query.typeArguments?.params?.length ?? 0) > 0) return undefined;
    const parts = entityNameParts(query.exprName);
    if (parts.length === 0) return undefined;
    const localRoot = resolveScopedLocalDeclaration(resolved.module, resolved.path, [parts[0]]);
    let target = localRoot
      ? resolveLocalDeclaration(resolved.module, [...localRoot.path, ...parts.slice(1)])
      : undefined;
    if (!localRoot) {
      const imported = resolved.module.imports.get(parts[0]);
      const file = imported && resolveDeclarationFile(graph.files, resolved.module.file, imported.source);
      const module = file && graph.getModule(file);
      const [exported, ...members] = imported?.imported === '*'
        ? parts.slice(1)
        : [imported?.imported, ...parts.slice(1)];
      // Only direct exports prove one authority here. Re-export chains and ambiguous stars
      // retain their normal dependency contracts until their resolution can be proved.
      const binding = module?.directExports.get(exported);
      if (!binding || binding.source) return undefined;
      const local = binding.localPath ?? (binding.local ? [binding.local] : undefined);
      target = local && resolveLocalDeclaration(module, [...local, ...members]);
    }
    if (!target) return undefined;
    if (target.records.length !== 1) return undefined;
    const variable = target.records[0].node;
    if (variable.type !== 'VariableDeclarator' || variable.id?.type !== 'Identifier') return undefined;
    const annotation = unwrap(variable.id.typeAnnotation);
    if (annotation?.type !== 'TSTypeOperator' || annotation.operator !== 'readonly') return undefined;
    const tuple = unwrap(annotation.typeAnnotation);
    if (tuple?.type !== 'TSTupleType' || !Array.isArray(tuple.elementTypes)
      || tuple.elementTypes.length === 0) return undefined;
    if (!tuple.elementTypes.every((element) =>
      element.type === 'TSLiteralType' && typeof element.literal?.value === 'string')) return undefined;
    const literals = [...new Set(tuple.elementTypes.map((element) => JSON.stringify(element.literal.value)))];
    return normalizeType(literals.sort().join('|'));
  };
  const projected = project();
  graph.tupleElementAliasCache.set(identity, projected);
  return projected;
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
    template = [...templateEntries.entries()].sort(([left], [right]) => left.localeCompare(right));
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
      tupleElementAliasType(graph, resolved) !== undefined
        ? []
        : referencedTypeNames(
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
    const serialized = JSON.stringify([rootIdentity, contract]);
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
      root: rootIdentity,
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
      recordPublicOrigin(graph, base, entryFile, name, resolved);
      addCachedDeclarationSurface(entries, base, 'named-export', name, graph, resolved);
      addReachableTypeSurfaces(entries, base, 'named-export', graph, resolved);
    }
  }
}

function declarationFileForTarget(graph, target) {
  if (typeof target !== 'string') return undefined;
  const normalized = normalizedFileKey(target);
  const candidates = [normalized];
  if (normalized.endsWith('.mjs')) {
    candidates.push(normalized.replace(/\.mjs$/, '.d.mts'), normalized.replace(/\.mjs$/, '.d.ts'));
  } else if (normalized.endsWith('.cjs')) {
    candidates.push(normalized.replace(/\.cjs$/, '.d.cts'), normalized.replace(/\.cjs$/, '.d.ts'));
  } else if (normalized.endsWith('.js')) {
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
        recordPublicOrigin(graph, base, variant.entryFile, name, resolved);
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
    publicOrigins: Object.fromEntries(
      [...(graph?.publicOrigins ?? [])].sort(([left], [right]) => left.localeCompare(right)),
    ),
    dependencyTopology: Object.fromEntries(
      [...(graph?.directDependencyCache ?? [])]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([identity, dependencies]) => [identity, dependencies.map(({ reference, resolved }) => {
          const target = declarationIdentity(resolved);
          const prefix = `declaration:${target}`;
          return [reference.startsWith(prefix) ? `declaration${reference.slice(prefix.length)}` : reference, target];
        })]),
    ),
    typeAliases: normalizedTypeAliases(graph),
    ...normalizedStructuralNames(graph),
    literalAliasSets: publicLiteralAliasSets(graph),
    shadowedReadonly: [...(graph?.modules.values() ?? [])].some((module) =>
      module.imports.has('Readonly') || [...module.symbols.values()].some((records) =>
        records.some((record) => record.name === 'Readonly'))),
  };
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Input unions and optional object members preserve existing arguments without assuming
 * covariance of an arbitrary generic or callback type.
 */
function isInputTypeWidening(before, after, baseline, current) {
  const old = resolveUniqueAliases(before, baseline);
  const next = resolveUniqueAliases(after, current);
  if (old === next || isObjectTypeWidening(old, next)
    || isEquivalentType(before, after, baseline, current)) return true;
  const oldAtoms = typeAtoms(old);
  const newAtoms = typeAtoms(next);
  return newAtoms.size > oldAtoms.size && [...oldAtoms].every((atom) => newAtoms.has(atom));
}

/** Compare parameters positionally, retaining defaults and required/rest semantics. */
function isParameterWidening(before, after, baseline, current) {
  if (!Array.isArray(before) || !Array.isArray(after) || after.length < before.length) return false;
  const parameter = (value) => {
    if (typeof value === 'string') {
      const match = /^(value|rest):([^:]+):(optional|required):(.*)$/s.exec(value);
      return match ? { rest: match[1] === 'rest', optional: match[3] === 'optional', type: match[4], default: null } : null;
    }
    if (!value || typeof value.type !== 'string' || typeof value.optional !== 'boolean') return null;
    return { rest: Boolean(value.rest), optional: value.optional, type: value.type, default: value.default };
  };
  for (const [index, raw] of before.entries()) {
    const old = parameter(raw);
    const next = parameter(after[index]);
    if (!old || !next || old.rest !== next.rest || (old.optional && !next.optional)
      || !sameValue(old.default, next.default)
      || !isInputTypeWidening(old.type, next.type, baseline, current)) return false;
  }
  return after.slice(before.length).every((raw) => {
    const next = parameter(raw);
    return next?.optional === true && !next.rest;
  });
}

/** Signature text identifies overloads, but a compatible replacement keeps the same callable.
 * Match complete records one-to-one, so widening parameters cannot hide metadata or return breaks.
 */
function alignCompatibleCallables(before, after, baseline, current) {
  const groups = (entries, other) => {
    const result = new Map();
    for (const [id, entry] of Object.entries(entries)) {
      const marker = /:(?:method|overload):/.exec(id);
      if (other[id] || !marker || entry.semantic !== 'presence' || !id.endsWith(')')) continue;
      const start = marker.index + marker[0].length;
      const opening = findTopLevelOpeningParen(id.slice(start));
      if (opening < 0) continue;
      const family = id.slice(0, start + opening);
      const members = Object.fromEntries(Object.entries(entries)
        .filter(([key]) => key === id || key.startsWith(`${id}:`))
        .map(([key, value]) => [key.slice(id.length), value]));
      result.set(id, { family, members });
    }
    return result;
  };
  const oldGroups = groups(before, after);
  if (!oldGroups.size) return after;
  const newGroups = groups(after, before);
  const candidates = new Map();
  for (const [id, old] of oldGroups) {
    if (newGroups.has(id)) continue;
    const matches = [];
    for (const [nextId, next] of newGroups) {
      if (oldGroups.has(nextId) || old.family !== next.family) continue;
      const compatible = Object.entries(old.members).every(([suffix, entry]) => {
        const replacement = next.members[suffix];
        return replacement && replacement.semantic === entry.semantic
          && (sameValue(entry.value, replacement.value)
            || (entry.semantic === 'parameters' && suffix === ':parameters'
              && isParameterWidening(entry.value, replacement.value, baseline, current)));
      });
      if (compatible) matches.push(nextId);
    }
    candidates.set(id, matches);
  }
  const owners = new Map();
  const assign = (id, seen) => {
    for (const candidate of candidates.get(id) ?? []) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      const owner = owners.get(candidate);
      if (!owner || assign(owner, seen)) { owners.set(candidate, id); return true; }
    }
    return false;
  };
  for (const id of candidates.keys()) assign(id, new Set());
  if (!owners.size) return after;
  const aligned = { ...after };
  for (const [nextId, id] of owners) {
    for (const [suffix, entry] of Object.entries(newGroups.get(nextId).members)) {
      delete aligned[`${nextId}${suffix}`];
      aligned[`${id}${suffix}`] = entry;
    }
  }
  return aligned;
}

/** Compare a plain property's existing type/readonly surface with an explicit accessor surface.
 * Property-only comparisons retain their established type-widening policy. Optional properties,
 * object projections and incomplete records keep their conservative diff: reconstructing their
 * read contract from normalized text can lose undefined/function-return union precedence. */
function alignPropertyAccess(before, after) {
  const ids = new Set([...Object.entries(before), ...Object.entries(after)]
    .filter(([, entry]) => entry.semantic === 'property-access').map(([id]) => id));
  const align = (entries) => {
    let aligned = entries;
    for (const id of ids) {
      const entry = entries[id];
      if (entry?.semantic !== 'type' || typeof entry.value !== 'string' || !id.endsWith(':type')) continue;
      const base = id.slice(0, -':type'.length);
      const readonly = entries[`${base}:readonly`];
      if (entries[base]?.semantic !== 'presence' || readonly?.semantic !== 'readonly'
        || typeof readonly.value !== 'boolean' || entries[`${base}:optional`]?.value !== false) continue;
      if (aligned === entries) aligned = { ...entries };
      aligned[id] = { ...entry, semantic: 'property-access', value: {
        read: entry.value,
        write: readonly.value ? null : entry.value,
      } };
    }
    return aligned;
  };
  return { before: align(before), after: align(after) };
}

function propertyAccessBump(before, after, baseline, current) {
  const valid = (access) => access && typeof access === 'object' && !Array.isArray(access)
    && Object.keys(access).sort().join(',') === 'read,write'
    && [access.read, access.write].every((type) => type === null || typeof type === 'string');
  if (!valid(before) || !valid(after)) return 'major';
  if (before.read !== after.read && before.read !== null) return 'major';
  if (before.write !== after.write && before.write !== null
    && (after.write === null || !isInputTypeWidening(before.write, after.write, baseline, current))) return 'major';
  return 'minor';
}

// One invocation can reach the same declaration through hundreds of exports. Reset between
// comparisons so callers may mutate snapshots between runs without retaining a stale result.
let declarationBumpCache = new WeakMap();
let declarationOrigins = { forward: new Map(), conflicts: new Set() };
let dependencyTopologyBumps = new Map();
function declarationContractBump(before, after, baseline, current) {
  const cacheable = before && after && typeof before === 'object' && typeof after === 'object';
  const cache = cacheable ? declarationBumpCache.get(before) : undefined;
  const cached = cache?.get(after);
  if (cached) return cached;
  const originalBefore = before;
  const originalAfter = after;
  const finish = (bump) => {
    if (cacheable) {
      const entries = cache ?? new WeakMap();
      entries.set(originalAfter, bump);
      declarationBumpCache.set(originalBefore, entries);
    }
    return bump;
  };
  const frameworkMap = 'subpath-export:./framework-types:LyraComponentTypeMap:contract';
  const isFrameworkMap = baseline?.contracts?.[baseline.entries[frameworkMap]?.value] === before
    && current?.contracts?.[current.entries[frameworkMap]?.value] === after;
  ({ before, after } = alignPropertyAccess(before ?? {}, after ?? {}));
  after = alignCompatibleCallables(before, after, baseline, current);
  let bump = 'none';
  const ids = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const id of ids) {
    const beforeEntry = before?.[id];
    const afterEntry = after?.[id];
    if (beforeEntry && !sameValue(beforeEntry.value, afterEntry?.value)
      && isReviewedMemberChange(id, before, after)) continue;
    if (!beforeEntry) bump = maxBump(bump, 'minor');
    else if (!afterEntry) {
      if (isFrameworkMap && isFrameworkFirstEventMap(id, before, after)) {
        bump = maxBump(bump, 'minor');
        continue;
      }
      return finish('major');
    } else if (!sameValue(beforeEntry.value, afterEntry.value)) {
      // The generated map uses never for a component with no CSS custom property or event names.
      if (isFrameworkMap && /^:property:lr-[a-z0-9-]+:property:(?:cssNames|eventNames):type$/.test(id)
        && beforeEntry.value === 'never' && typeof afterEntry.value === 'string'
        && [...typeAtoms(afterEntry.value)].every((atom) => (id.endsWith(':cssNames:type')
          ? /^'--lr-[a-z0-9-]+'$/ : /^'lr-[a-z0-9-]+'$/).test(atom))) {
        bump = maxBump(bump, 'minor');
        continue;
      }
      bump = maxBump(
        bump,
        changedBump(afterEntry, beforeEntry.value, afterEntry.value, baseline, current,
          (name) => Boolean(after[`:property:${name}`])),
      );
    }
  }
  return finish(bump);
}

/** The generated framework map spells a component with no events as `events: {}` and gives it
 * its event map once it has one. Dropping the empty object literal's shape for that named map is
 * the first-event counterpart of the `never` -> names transition, not a removal. */
function isFrameworkFirstEventMap(id, before, after) {
  const match = /^(:property:lr-[a-z0-9-]+:property:events):type-kind$/.exec(id);
  if (!match || before[id]?.value !== 'object') return false;
  const prefix = `${match[1]}:property:`;
  return !Object.keys(before).some((key) => key.startsWith(prefix))
    && typeof after[`${match[1]}:type`]?.value === 'string'
    && /^Lyra[A-Za-z0-9]*EventMap$/.test(after[`${match[1]}:type`].value);
}

// Member-level reviewed exceptions active while a reviewed change is re-evaluated. Each accepts
// one contract member's exact before -> after value (after `null` for a removal, which also
// accepts the removal of that member's own sub-entries).
let reviewedMemberChanges = [];
function isReviewedMemberChange(id, before, after) {
  for (const accepted of reviewedMemberChanges) {
    const exact = id === accepted.key;
    const nested = !exact && accepted.after === null && id.startsWith(`${accepted.key}:`)
      && before[accepted.key] && !after[accepted.key];
    if (!exact && !nested) continue;
    if (nested) {
      if (after[id] !== undefined) continue;
    } else if (!exactValue(before[id]?.value ?? null, accepted.before)
      || !exactValue(after[id]?.value ?? null, accepted.after)) continue;
    accepted.used = true;
    return true;
  }
  return false;
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

/** Interface heritage that keeps every clause, adds clauses, or adjusts a `Pick`/`Omit` clause
 * only in ways that cannot lose a member: a `Pick` may name more keys, and an `Omit` may name
 * more keys only when the extending declaration declares each of them itself. */
function isHeritageWidening(before, after, ownProperty) {
  if (!Array.isArray(before) || !Array.isArray(after) || after.length < before.length) return false;
  const keyed = (clause) => {
    const generic = genericTypeParts(clause);
    if (!generic || !['Omit', 'Pick'].includes(generic.name) || generic.args.length !== 2) return undefined;
    const keys = [...typeAtoms(generic.args[1])];
    if (!keys.every((key) => /^'[^'\\]*'$/.test(key))) return undefined;
    return { name: generic.name, base: generic.args[0], keys: new Set(keys.map((key) => key.slice(1, -1))) };
  };
  const unclaimed = after.map(normalizeType);
  let changed = after.length > before.length;
  for (const clause of before.map(normalizeType)) {
    let index = unclaimed.indexOf(clause);
    if (index < 0) {
      const old = keyed(clause);
      index = old ? unclaimed.findIndex((candidate) => {
        const next = keyed(candidate);
        if (!next || next.name !== old.name || next.base !== old.base
          || ![...old.keys].every((key) => next.keys.has(key))) return false;
        return old.name === 'Pick'
          || [...next.keys].every((key) => old.keys.has(key) || ownProperty(key));
      }) : -1;
      if (index < 0) return false;
      changed = true;
    }
    unclaimed.splice(index, 1);
  }
  return changed;
}

/** Physical graph identities remain distinct within each snapshot. Only an unchanged public
 * export can establish correspondence across snapshots, and aliases must agree one-to-one. */
function publicOriginCorrespondence(baseline, current) {
  const proposed = new Map();
  const reverse = new Map();
  for (const [route, before] of Object.entries(baseline.publicOrigins ?? {})) {
    const after = current.publicOrigins?.[route];
    const beforeExport = baseline.entries[route];
    const afterExport = current.entries[route];
    if (!after || beforeExport?.semantic !== 'export' || afterExport?.semantic !== 'export'
      || !sameValue(beforeExport.value, afterExport.value)) continue;
    // A move needs edge evidence from both snapshots; legacy metadata cannot prove it.
    if (before !== after && (!baseline.dependencyTopology || !current.dependencyTopology)) continue;
    if (!proposed.has(before)) proposed.set(before, new Set());
    if (!reverse.has(after)) reverse.set(after, new Set());
    proposed.get(before).add(after);
    reverse.get(after).add(before);
  }
  const forward = new Map();
  const conflicts = new Set();
  for (const [before, targets] of proposed) {
    const [after] = targets;
    if (targets.size !== 1 || reverse.get(after).size !== 1) conflicts.add(before);
    else forward.set(before, after);
  }
  // An unexported declaration has no route to anchor it, but a move between internal modules
  // leaves one identity that exists only before and one that exists only after under the same
  // declaration path. Pair those when the path is unique on both sides; the pair's contracts and
  // edges are then compared exactly like a public relocation, so any shape change still counts.
  if (baseline.dependencyTopology && current.dependencyTopology) {
    const declarationPath = (identity) => identity.slice(identity.indexOf('#') + 1);
    const onlyIn = (left, right) => {
      const byPath = new Map();
      for (const identity of Object.keys(left)) {
        if (Object.hasOwn(right, identity) || forward.has(identity) || reverse.has(identity)
          || conflicts.has(identity)) continue;
        const group = byPath.get(declarationPath(identity)) ?? [];
        group.push(identity);
        byPath.set(declarationPath(identity), group);
      }
      return byPath;
    };
    const removed = onlyIn(baseline.dependencyTopology, current.dependencyTopology);
    const added = onlyIn(current.dependencyTopology, baseline.dependencyTopology);
    for (const [pathKey, [before, ...otherBefore]] of removed) {
      const [after, ...otherAfter] = added.get(pathKey) ?? [];
      if (after && otherBefore.length === 0 && otherAfter.length === 0) forward.set(before, after);
    }
  }
  return { forward, conflicts };
}

/** Inline `import("file").Name` spellings of every relocated declaration. */
function relocationSpellings(forward) {
  const spellings = new Map();
  const spelling = (identity) => {
    const separator = identity.indexOf('#');
    let pathParts;
    try {
      pathParts = JSON.parse(identity.slice(separator + 1));
    } catch {
      return undefined;
    }
    if (!Array.isArray(pathParts) || pathParts.some((part) => typeof part !== 'string'
      || part.includes(MODULE_NAMESPACE_SEGMENT) || part.includes(ANONYMOUS_DEFAULT_SEGMENT))) return undefined;
    return `import(${JSON.stringify(identity.slice(0, separator))}).${pathParts.join('.')}`;
  };
  for (const [before, after] of forward) {
    const from = spelling(before);
    const to = spelling(after);
    if (from && to && from !== to) spellings.set(from, to);
  }
  return spellings;
}

/** Compare each declaration's direct edges once, even when many public roots share it. */
function dependencyTopologyBump(identity, baseline, current) {
  if (!baseline.dependencyTopology || !current.dependencyTopology) return 'none';
  if (dependencyTopologyBumps.has(identity)) return dependencyTopologyBumps.get(identity);
  const translated = (value) => declarationOrigins.forward.get(value) ?? value;
  const beforeEdges = baseline.dependencyTopology[identity];
  const afterEdges = current.dependencyTopology[translated(identity)];
  let bump = 'major';
  if (beforeEdges && afterEdges) {
    const afterSet = new Set(afterEdges.map((edge) => JSON.stringify(edge)));
    const lost = beforeEdges.filter(([reference, target]) =>
      !afterSet.has(JSON.stringify([reference, translated(target)])));
    // A dropped edge is explained when nothing else now answers to the target's name (a
    // same-named replacement is a rewiring and stays breaking) and the target is either a deleted
    // internal declaration or one that still exists, e.g. now reached through a base class.
    // A target that still exists stays checked by the reachable-contract comparison, which
    // fails when it is no longer reachable at all.
    // Any edge that replaces a dropped one must lead to a declaration the baseline did not have;
    // re-pointing at an existing declaration, however it is spelled, is a rewiring.
    const beforeSet = new Set(beforeEdges.map(([reference, target]) => JSON.stringify([reference, translated(target)])));
    const relocatedTargets = new Set(declarationOrigins.forward.values());
    const rewired = lost.length > 0 && afterEdges.some((edge) => !beforeSet.has(JSON.stringify(edge))
      && (Object.hasOwn(baseline.dependencyTopology, edge[1]) || relocatedTargets.has(edge[1])));
    const afterPaths = new Set(afterEdges.map(([, target]) => declarationPathKey(target)));
    if (!rewired && lost.every(([, target]) => !afterPaths.has(declarationPathKey(target))
      && (isRetiredInternalDeclaration(target, baseline, current)
        || Object.hasOwn(current.dependencyTopology, translated(target))))) {
      bump = afterEdges.length > beforeEdges.length - lost.length ? 'minor' : 'none';
    }
  }
  dependencyTopologyBumps.set(identity, bump);
  return bump;
}

function declarationPathKey(identity) {
  return String(identity).slice(String(identity).indexOf('#') + 1);
}

/** A declaration no public route ever named, which the current package no longer declares at
 * all and which no relocation explains. Consumers could only observe it through the public
 * declarations that referenced it, and those are compared on their own. */
function isRetiredInternalDeclaration(identity, baseline, current) {
  if (!baseline.dependencyTopology || !current.dependencyTopology) return false;
  if (declarationOrigins.forward.has(identity) || declarationOrigins.conflicts.has(identity)) return false;
  if (Object.hasOwn(current.dependencyTopology ?? {}, identity)) return false;
  return !Object.values(baseline.publicOrigins ?? {}).includes(identity);
}

/** Explain a changed reachable fingerprint using full declaration contracts and direct edges.
 * Older snapshots without retained closures keep their conservative count-based fallback. */
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
  const translated = (identity) => declarationOrigins.forward.get(identity) ?? identity;
  const matched = new Set();
  const identities = Object.keys(beforeReachable);
  if (beforeDefinition.root) identities.push(beforeDefinition.root);
  for (const identity of identities) {
    if (declarationOrigins.conflicts.has(identity)) return 'major';
    const target = translated(identity);
    if (identity === beforeDefinition.root && target !== afterDefinition.root) return 'major';
    // A deleted internal declaration has no edges of its own left to compare; the edges that
    // referenced it are compared on the declarations that held them.
    if (identity !== beforeDefinition.root && target === identity && afterReachable[identity] === undefined
      && isRetiredInternalDeclaration(identity, baseline, current)) continue;
    // Include the root's edges even though it is excluded from the interned reachable map.
    // Otherwise rewiring a signature could preserve its complete reachable declaration set.
    bump = maxBump(bump, dependencyTopologyBump(identity, baseline, current));
    if (bump === 'major') return bump;
    if (identity === beforeDefinition.root) continue;
    const beforeContract = beforeReachable[identity];
    const afterContract = afterReachable[target];
    // No longer reachable: a consumer's type could have depended on it.
    if (afterContract === undefined) return 'major';
    matched.add(target);
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
  if (Object.keys(afterReachable).some((identity) => !matched.has(identity))) {
    bump = maxBump(bump, 'minor');
  }
  return bump;
}

function changedBump(entry, before, after, baseline, current, ownProperty = () => false) {
  if (entry.semantic === 'property-access') return propertyAccessBump(before, after, baseline, current);
  if (entry.semantic === 'declaration-contract-ref') {
    const beforeContract = baseline?.contracts?.[before];
    const afterContract = current?.contracts?.[after];
    if (!beforeContract || !afterContract) return 'major';
    return declarationContractBump(beforeContract, afterContract, baseline, current);
  }
  if (entry.semantic === 'dependency-contract-ref') {
    return dependencyContractBump(before, after, baseline, current);
  }
  if (entry.semantic === 'parameters' && isParameterWidening(before, after, baseline, current)) return 'minor';
  if (entry.semantic === 'type' && typeof before === 'string' && typeof after === 'string') {
    if (isTypeWidening(before, after, baseline, current)) return 'minor';
    // A spelling change (an extracted alias, `typeof` constant, interface member lookup or a
    // relocated inline import) that resolves to the same structure is no change at all; one that
    // resolves to a widening is the widening.
    if (isEquivalentType(before, after, baseline, current)) return 'none';
    if (isTypeWidening(expandTypeReferences(translateRelocatedSpellings(before), baseline),
      expandTypeReferences(after, current), baseline, current)) return 'minor';
  }
  if (entry.semantic === 'heritage' && (isHeritageSpecialization(before, after)
    || isHeritageWidening(before, after, ownProperty))) return 'minor';
  if (entry.semantic === 'optional' && before === false && after === true) return 'minor';
  if (entry.semantic === 'readonly' && before === true && after === false) return 'minor';
  if (entry.semantic === 'privacy' && before === 'protected' && after === 'public') return 'minor';
  return 'major';
}

/** A finite union can keep exactly the same members when its spelling changes. A matching
 * set explains only the alias body, never a change to its other metadata or its dependencies. */
function samePublicLiteralAlias(id, before, after, baseline, current) {
  const separator = id.lastIndexOf(':');
  const field = id.slice(separator + 1);
  if (field !== 'type' && field !== 'contract') return false;
  const base = id.slice(0, separator);
  const origin = baseline.publicOrigins?.[base];
  const proof = baseline.literalAliasSets?.[base];
  if (!proof || origin !== current.publicOrigins?.[base] ||
      proof !== current.literalAliasSets?.[base]) return false;
  if (field === 'type') return before.semantic === 'type' && after.semantic === 'type';
  const old = baseline.contracts?.[before.value];
  const next = current.contracts?.[after.value];
  return old?.[':type']?.semantic === 'type' && next?.[':type']?.semantic === 'type' &&
    Object.keys(old).length === Object.keys(next).length &&
    Object.entries(old).every(([key, entry]) => key === ':type' || sameValue(entry, next[key]));
}

function prepareComparison(baseline, current) {
  declarationBumpCache = new WeakMap();
  declarationOrigins = publicOriginCorrespondence(baseline, current);
  relocatedImportSpellings = relocationSpellings(declarationOrigins.forward);
  dependencyTopologyBumps = new Map();
}

export function diffPublicApi(baseline, current) {
  prepareComparison(baseline, current);
  if (baseline.packageName !== current.packageName) {
    throw new Error(
      `Cannot compare different packages: ${baseline.packageName} and ${current.packageName}.`,
    );
  }
  const changes = [];
  const aligned = alignPropertyAccess(baseline.entries, current.entries);
  const currentEntries = alignCompatibleCallables(aligned.before, aligned.after, baseline, current);
  const ids = new Set([...Object.keys(aligned.before), ...Object.keys(currentEntries)]);
  for (const id of [...ids].sort()) {
    const beforeEntry = aligned.before[id];
    const afterEntry = currentEntries[id];
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
      if (samePublicLiteralAlias(id, beforeEntry, afterEntry, baseline, current)) continue;
      changes.push({
        id,
        surface: afterEntry.surface,
        bump: changedBump(afterEntry, beforeEntry.value, afterEntry.value, baseline, current,
          (name) => Boolean(currentEntries[`${id.slice(0, id.lastIndexOf(':'))}:property:${name}`])),
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

/** `*` is the only wildcard; every other character matches itself. */
function changeIdPattern(changeId) {
  return new RegExp(`^${changeId.split('*').map((part) => part.replace(/[\\^$.|?+()[\]{}]/g, '\\$&')).join('.*')}$`);
}

/** Re-evaluate one contract change with reviewed member changes accepted, so everything else in
 * the same contract is still classified normally. */
function reevaluateWithReviewedMembers(change, members, { baseline, current }) {
  const beforeEntry = baseline.entries[change.id];
  const afterEntry = current.entries[change.id];
  if (!beforeEntry || !afterEntry
    || !['declaration-contract-ref', 'dependency-contract-ref'].includes(afterEntry.semantic)) return undefined;
  prepareComparison(baseline, current);
  reviewedMemberChanges = members;
  try {
    return changedBump(afterEntry, beforeEntry.value, afterEntry.value, baseline, current);
  } finally {
    reviewedMemberChanges = [];
    prepareComparison(baseline, current);
  }
}

/**
 * Lower reviewed changes. A plain exception names one change exactly, with its exact before and
 * after values. A member exception instead lists contract members (`key`, exact `before`, exact
 * `after`, `null` meaning absent) and may use `*` in `changeId` to cover every route that reaches
 * the same declaration; each matching change is re-evaluated with only those members accepted,
 * so any other difference in that contract keeps its own classification. Both forms fail when
 * they no longer match, so a stale review cannot linger.
 */
export function applyReviewedExceptions(changes, config = { exceptions: [] }, snapshots = undefined) {
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
    const review = {
      reason: exception.reason,
      reviewer: exception.reviewer,
      reviewedOn: exception.reviewedOn,
      originalBump: exception.requiredBump,
    };
    if (exception.members !== undefined) {
      if (!Array.isArray(exception.members) || exception.members.length === 0
        || exception.members.some((member) => !member || typeof member.key !== 'string'
          || !Object.hasOwn(member, 'before') || !Object.hasOwn(member, 'after'))) {
        throw new Error(`API exception ${exception.changeId} members need key, before and after.`);
      }
      if (!snapshots) throw new Error(`API exception ${exception.changeId} needs the compared snapshots.`);
      const members = exception.members.map((member) => ({ ...member, used: false }));
      const pattern = changeIdPattern(exception.changeId);
      let applied = 0;
      for (const change of adjusted) {
        if (change.exception || change.kind !== 'changed' || change.bump !== exception.requiredBump
          || !pattern.test(change.id)) continue;
        const bump = reevaluateWithReviewedMembers(change, members, snapshots);
        if (bump === undefined || BUMP_RANK[bump] > BUMP_RANK[exception.allowedBump]) continue;
        change.bump = bump;
        change.exception = review;
        applied += 1;
      }
      const unused = members.filter((member) => !member.used).map((member) => member.key);
      if (applied === 0 || unused.length > 0) {
        throw new Error(
          `Reviewed API exception ${exception.changeId} does not match the current API changes`
            + (unused.length ? ` (unused members: ${unused.join(', ')})` : '') + '; remove or update it.',
        );
      }
      continue;
    }
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
    match.exception = review;
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

/**
 * The IDE manifest also carries the companion packages' elements (module paths under
 * `lyra-docs/`, `lyra-gen/`, ...); lyra-ui's own checkout manifest lists only its `src/` modules.
 * Comparing the two unfiltered reports every companion element as a lyra-ui removal.
 */
export function ownPackageManifest(manifest) {
  return { ...manifest, modules: (manifest.modules ?? []).filter((module) => module.path?.startsWith('src/')) };
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
    // A baseline from the split onward has no full manifest of its own (later releases point
    // `customElements` at the slim discovery manifest only): take the same version's from the IDE package.
    if (packageName === '@aceshooting/lyra-ui' && !existsSync(path.join(root, 'custom-elements.json'))) {
      const ideDirectory = path.join(workingDirectory, 'ide');
      mkdirSync(ideDirectory);
      const ideTarball = path.join(ideDirectory, path.basename(parseNpmPackOutput(execute('npm', [
        'pack', `@aceshooting/lyra-ide@${version}`, '--json', '--ignore-scripts', '--pack-destination', ideDirectory,
      ]))));
      validateTarEntries(execute('tar', ['-tzf', ideTarball]).split(/\r?\n/).filter(Boolean));
      validateTarEntryTypes(execute('tar', ['-tvzf', ideTarball, '--numeric-owner']).split(/\r?\n/).filter(Boolean));
      execute('tar', ['-xzf', ideTarball, '-C', ideDirectory, '--no-same-owner', '--no-same-permissions', 'package/custom-elements.json']);
      const ideManifest = readJson(path.join(ideDirectory, 'package', 'custom-elements.json'));
      writeFileSync(path.join(root, 'custom-elements.json'), JSON.stringify(ownPackageManifest(ideManifest)));
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

const FRAMEWORK_DECLARATION_FILES = Object.freeze({
  react: 'dist/custom-elements-jsx.d.ts',
  vue: 'dist/vue.d.ts',
  svelte: 'dist/svelte.d.ts',
});

/**
 * The manifest the gate compares. The full `custom-elements.json` wins whenever it sits at the root:
 * a checkout keeps it beside the sources, and a published baseline from 27.0.0 on gets the same
 * version's copy from @aceshooting/lyra-ide. `customElements` may name the prose-free slim discovery
 * manifest, which drops descriptions, privacy and inheritance edges; diffing it against a full one
 * reports every dropped detail as a break, so it never feeds the gate.
 */
export function publicApiManifestFile(root, packageJson) {
  const full = path.join(root, 'custom-elements.json');
  if (existsSync(full)) return full;
  const target = packageJson.customElements;
  if (typeof target !== 'string') return undefined;
  if (path.posix.basename(target.replaceAll('\\', '/')) === SLIM_MANIFEST_FILE) {
    throw new Error(
      `${packageJson.name ?? root} points customElements at the slim discovery manifest (${target}); `
        + 'place the full custom-elements.json from @aceshooting/lyra-ide at the package root to compare its API.',
    );
  }
  const manifestFile = path.join(root, target);
  if (!existsSync(manifestFile)) throw new Error(`Missing custom-elements manifest: ${manifestFile}`);
  return manifestFile;
}

export function readPackageApi(root) {
  const packageJsonFile = path.join(root, 'package.json');
  if (!existsSync(packageJsonFile)) throw new Error(`Missing public API package metadata: ${packageJsonFile}`);
  const packageJson = readJson(packageJsonFile);
  const manifestFile = publicApiManifestFile(root, packageJson);
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
  for (const listed of packageJson.files ?? []) {
    const relative = String(listed).replace(/^\.\//, '').replaceAll('\\', '/');
    const absolute = path.join(root, relative);
    if (!existsSync(absolute)) continue;
    const entry = readdirSync(path.dirname(absolute), { withFileTypes: true })
      .find((candidate) => candidate.name === path.basename(absolute));
    if (entry?.isDirectory()) collectFiles(absolute, relative);
    else if (entry?.isFile()) {
      declarations.packageFiles.push(relative);
      if (/\.d\.[cm]?ts$/.test(relative)) declarations.files[relative] = readFileSync(absolute, 'utf8');
    }
  }
  declarations.packageFiles.sort();
  for (const [name, relativeFile] of Object.entries(FRAMEWORK_DECLARATION_FILES)) {
    const file = path.join(root, relativeFile);
    if (existsSync(file)) declarations[name] = readFileSync(file, 'utf8');
  }
  const rootExport = packageJson.exports?.['.'] ?? packageJson.exports;
  const rootTypes = packageJson.types
    ?? (rootExport && typeof rootExport === 'object' && !Array.isArray(rootExport)
      ? rootExport.types
      : undefined);
  if (typeof rootTypes === 'string') {
    const namedEntry = normalizedFileKey(rootTypes);
    const namedDeclarationsFile = path.join(root, namedEntry);
    if (!existsSync(namedDeclarationsFile)) {
      throw new Error(
        `Missing built public declarations: ${namedDeclarationsFile}. Run the package build before the public API gate.`,
      );
    }
    declarations.namedEntry = namedEntry;
    declarations.named = readFileSync(namedDeclarationsFile, 'utf8');
    declarations.files[namedEntry] = declarations.named;
  }
  return {
    packageJson,
    manifest: manifestFile ? readJson(manifestFile) : { schemaVersion: '1.0.0', modules: [] },
    declarations,
  };
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
    exceptions: undefined,
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
  options.exceptions ??= path.join(options.current, 'scripts', 'public-api-semver-exceptions.json');
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
  const prioritized = result.changes.toSorted((left, right) => BUMP_RANK[right.bump] - BUMP_RANK[left.bump]);
  for (const change of prioritized.slice(0, 100)) {
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
    changes = applyReviewedExceptions(changes, exceptionConfig, { baseline, current });
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

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    console.error(`Public API semver gate error: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
        output += `${character}${normalizeType(text.slice(index + 1, end))}${PAIRS[character]}`;
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

function isTypeWidening(before, after) {
  const oldAtoms = typeAtoms(before);
  const newAtoms = typeAtoms(after);
  return oldAtoms.size < newAtoms.size && [...oldAtoms].every((atom) => newAtoms.has(atom));
}

function normalizeDefault(value) {
  if (value === undefined) return null;
  return normalizeWhitespace(value);
}

function typeText(value) {
  return normalizeType(value?.text ?? value ?? 'unknown');
}

function addEntry(entries, id, surface, semantic, value, label = id) {
  if (entries.has(id)) {
    throw new Error(`Duplicate normalized public API entry: ${id}`);
  }
  entries.set(id, { surface, semantic, value, label });
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
        const memberBase = `${elementBase}:member:${kind}:${member.name}`;
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
            (member.parameters ?? []).map((parameter) => ({
              name: parameter.name,
              type: typeText(parameter.type),
              optional: Boolean(parameter.optional || parameter.default !== undefined),
              default: normalizeDefault(parameter.default),
            })),
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
      }

      for (const [collection, segment] of [
        ['slots', 'slot'],
        ['cssParts', 'css-part'],
        ['cssProperties', 'css-property'],
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

function normalizeExports(exportsValue, entries) {
  const walk = (specifier, value, conditions = []) => {
    if (typeof value === 'string' || value === null) {
      const condition = conditions.length > 0 ? conditions.join('.') : 'default';
      addEntry(
        entries,
        `package-export:${specifier}:${condition}`,
        'package-export',
        'target',
        value,
        `${specifier} (${condition})`,
      );
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(specifier, item, [...conditions, String(index)]));
      return;
    }
    if (value && typeof value === 'object') {
      for (const key of Object.keys(value).sort()) {
        walk(specifier, value[key], [...conditions, key]);
      }
    }
  };

  if (typeof exportsValue === 'string' || Array.isArray(exportsValue)) {
    walk('.', exportsValue);
    return;
  }
  for (const specifier of Object.keys(exportsValue ?? {}).sort()) {
    walk(specifier, exportsValue[specifier]);
  }
}

function moduleNameText(name, sourceFile) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return sourceText(name, sourceFile);
}

function declarationIsPublic(statement, nested) {
  return nested || hasModifier(statement, ts.SyntaxKind.ExportKeyword);
}

function normalizeFrameworkDeclarations(framework, text, entries) {
  const sourceFile = ts.createSourceFile(
    `${framework}.d.ts`,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const visit = (statements, namespace = '', nested = false) => {
    for (const statement of statements) {
      if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) continue;
      if (ts.isModuleDeclaration(statement)) {
        const moduleName = moduleNameText(statement.name, sourceFile);
        const nextNamespace = namespace ? `${namespace}.${moduleName}` : moduleName;
        let body = statement.body;
        while (body && ts.isModuleDeclaration(body)) body = body.body;
        if (body && ts.isModuleBlock(body)) visit(body.statements, nextNamespace, true);
        continue;
      }
      if (!declarationIsPublic(statement, nested)) continue;

      const prefix = `framework:${framework}:${namespace ? `${namespace}:` : ''}`;
      if (ts.isInterfaceDeclaration(statement)) {
        const base = `${prefix}interface:${statement.name.text}`;
        addPresence(entries, base, `framework:${framework}`, statement.name.text);
        addEntry(
          entries,
          `${base}:extends`,
          `framework:${framework}`,
          'heritage',
          (statement.heritageClauses ?? [])
            .flatMap((clause) => clause.types.map((type) => sourceText(type, sourceFile)))
            .sort(),
          statement.name.text,
        );
        for (const member of statement.members) {
          const name = propertyNameText(member.name, sourceFile) || 'call';
          const kind = ts.isMethodSignature(member)
            ? 'method'
            : ts.isIndexSignatureDeclaration(member)
              ? 'index'
              : ts.isCallSignatureDeclaration(member)
                ? 'call'
                : 'property';
          const memberBase = `${base}:${kind}:${name}`;
          addPresence(entries, memberBase, `framework:${framework}`, `${statement.name.text}.${name}`);
          if ('questionToken' in member) {
            addEntry(
              entries,
              `${memberBase}:optional`,
              `framework:${framework}`,
              'optional',
              Boolean(member.questionToken),
              memberBase,
            );
          }
          addEntry(
            entries,
            `${memberBase}:readonly`,
            `framework:${framework}`,
            'readonly',
            hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
            memberBase,
          );
          if ('parameters' in member && member.parameters) {
            addEntry(
              entries,
              `${memberBase}:parameters`,
              `framework:${framework}`,
              'parameters',
              member.parameters.map((parameter) => normalizeParameter(parameter, sourceFile)),
              memberBase,
            );
          }
          addTypeSurface(
            entries,
            memberBase,
            `framework:${framework}`,
            member.type,
            sourceFile,
            memberBase,
          );
        }
        continue;
      }

      if (ts.isTypeAliasDeclaration(statement)) {
        const base = `${prefix}type:${statement.name.text}`;
        addPresence(entries, base, `framework:${framework}`, statement.name.text);
        addTypeSurface(
          entries,
          base,
          `framework:${framework}`,
          statement.type,
          sourceFile,
          statement.name.text,
        );
        continue;
      }

      if (ts.isFunctionDeclaration(statement) && statement.name) {
        const base = `${prefix}function:${statement.name.text}`;
        addPresence(entries, base, `framework:${framework}`, statement.name.text);
        addEntry(
          entries,
          `${base}:parameters`,
          `framework:${framework}`,
          'parameters',
          statement.parameters.map((parameter) => normalizeParameter(parameter, sourceFile)),
          base,
        );
        addTypeSurface(
          entries,
          base,
          `framework:${framework}`,
          statement.type,
          sourceFile,
          base,
        );
        continue;
      }

      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const name = propertyNameText(declaration.name, sourceFile);
          const base = `${prefix}variable:${name}`;
          addPresence(entries, base, `framework:${framework}`, name);
          addTypeSurface(
            entries,
            base,
            `framework:${framework}`,
            declaration.type,
            sourceFile,
            name,
          );
        }
      }
    }
  };

  visit(sourceFile.statements);
}

function normalizeNamedExports(text, entries) {
  const sourceFile = ts.createSourceFile(
    'named-exports.d.ts',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      const from = statement.moduleSpecifier
        ? ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : sourceText(statement.moduleSpecifier, sourceFile)
        : null;
      if (!statement.exportClause) {
        addEntry(
          entries,
          `named-export:*:${from ?? '(local)'}`,
          'named-export',
          'export',
          { kind: statement.isTypeOnly ? 'type' : 'value', from },
          `export * from ${from}`,
        );
        continue;
      }
      if (ts.isNamedExports(statement.exportClause)) {
        for (const specifier of statement.exportClause.elements) {
          const exported = specifier.name.text;
          addEntry(
            entries,
            `named-export:${exported}`,
            'named-export',
            'export',
            {
              kind: statement.isTypeOnly || specifier.isTypeOnly ? 'type' : 'value',
              imported: specifier.propertyName?.text ?? exported,
              from,
            },
            exported,
          );
        }
      }
      continue;
    }
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword) || !statement.name) continue;
    const name = propertyNameText(statement.name, sourceFile);
    addEntry(
      entries,
      `named-export:${name}`,
      'named-export',
      'export',
      { kind: ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement) ? 'type' : 'value', from: null },
      name,
    );
  }
}

export function normalizePublicApi({ packageJson, manifest, declarations = {} }) {
  if (!packageJson?.name || !packageJson?.version) {
    throw new Error('Public API input requires packageJson.name and packageJson.version.');
  }
  const entries = new Map();
  normalizeExports(packageJson.exports, entries);
  normalizeManifest(manifest, entries);
  if (typeof declarations.named === 'string') normalizeNamedExports(declarations.named, entries);
  for (const framework of ['react', 'vue', 'svelte']) {
    if (typeof declarations[framework] === 'string') {
      normalizeFrameworkDeclarations(framework, declarations[framework], entries);
    }
  }
  return {
    packageName: packageJson.name,
    version: packageJson.version,
    entries: Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right))),
  };
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedBump(entry, before, after) {
  if (entry.semantic === 'type' && isTypeWidening(before, after)) return 'minor';
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
        bump: changedBump(afterEntry, beforeEntry.value, afterEntry.value),
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
  return maxBump('none', ...changes.map((change) => change.bump));
}

function parseVersion(version, label) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/);
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

const DECLARATION_FILES = Object.freeze({
  named: 'dist/lyra.d.ts',
  react: 'dist/custom-elements-jsx.d.ts',
  vue: 'dist/vue.d.ts',
  svelte: 'dist/svelte.d.ts',
});

export function readPackageApi(root) {
  const packageJsonFile = path.join(root, 'package.json');
  const manifestFile = path.join(root, 'custom-elements.json');
  if (!existsSync(packageJsonFile)) throw new Error(`Missing public API package metadata: ${packageJsonFile}`);
  if (!existsSync(manifestFile)) throw new Error(`Missing custom-elements manifest: ${manifestFile}`);
  const declarations = {};
  for (const [name, relativeFile] of Object.entries(DECLARATION_FILES)) {
    const file = path.join(root, relativeFile);
    if (existsSync(file)) declarations[name] = readFileSync(file, 'utf8');
  }
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
  if (!options.baseline) {
    throw new Error(
      'Missing --baseline <unpacked-package-dir>. Fetch the last published tarball separately and pass its package directory.',
    );
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
  const counts = { major: 0, minor: 0, patch: 0 };
  for (const change of result.changes) counts[change.bump] += 1;
  console.log(
    `Normalized changes: ${counts.major} major, ${counts.minor} minor, ${counts.patch} reviewed patch`,
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
  const baseline = normalizePublicApi(readPackageApi(options.baseline));
  const current = normalizePublicApi(readPackageApi(options.current));
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
    changesetBump,
    gate,
    changes,
  };
  reportResult(result, options.json);
  return gate.passes ? 0 : 1;
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

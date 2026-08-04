#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
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

function eventCancelability(event) {
  if (event.cancelable === true || event.cancelable === 'always') return true;
  if (event.cancelable === false || event.cancelable === 'never') return false;
  const description = String(event.description ?? '');
  if (/\b(?:(?:not|never)\s+cancelable|non[- ]?cancelable)\b/i.test(description)) return false;
  if (/\bcancelable\b/i.test(description)) return true;
  return undefined;
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

  const addTarget = (specifier, condition, value, label = `${specifier} (${condition})`) => {
    const id = `package-export:${specifier}:${condition}`;
    if (!entries.has(id)) {
      addEntry(entries, id, 'package-export', 'target', value, label);
    }
  };

  const expandWildcard = (specifier, condition, target) => {
    if (!specifier.includes('*') || !target.includes('*')) return;
    const [targetPrefix, targetSuffix] = target.split('*');
    for (const packageFile of normalizedPackageFiles) {
      if (!packageFile.startsWith(targetPrefix) || !packageFile.endsWith(targetSuffix)) continue;
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
      for (const key of Object.keys(value).sort()) {
        walk(specifier, value[key], [...conditions, key]);
      }
    }
  };

  if (typeof exportsValue === 'string' || Array.isArray(exportsValue)) {
    walk('.', exportsValue);
    addWildcardExpansions();
    return;
  }
  for (const specifier of Object.keys(exportsValue ?? {}).sort()) {
    walk(specifier, exportsValue[specifier]);
  }
  addWildcardExpansions();
}

function normalizedFileKey(file) {
  return String(file).replace(/^\.\//, '').replaceAll('\\', '/');
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

function parseDeclarationModule(file, source) {
  const parsed = parseSync(file, source, { lang: 'ts', sourceType: 'module' });
  if (parsed.errors.length > 0) {
    const details = parsed.errors.map((error) => error.message ?? String(error)).join('\n');
    throw new SyntaxError(`${file} could not be parsed:\n${details}`);
  }
  const module = {
    file,
    source,
    body: parsed.program.body,
    declarations: new Map(),
    directExports: new Map(),
    exportStars: [],
    imports: new Map(),
  };
  const rememberDeclaration = (record) => {
    const records = module.declarations.get(record.name) ?? [];
    records.push(record);
    module.declarations.set(record.name, records);
  };

  for (const statement of module.body) {
    if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers ?? []) {
        const local = propertyName(specifier.local, module);
        if (!local) continue;
        const imported = specifier.type === 'ImportDefaultSpecifier'
          ? 'default'
          : specifier.type === 'ImportNamespaceSpecifier'
            ? '*'
            : propertyName(specifier.imported, module);
        module.imports.set(local, { imported, source: statement.source.value });
      }
      continue;
    }

    const wrapper = statement.type === 'ExportNamedDeclaration' ? statement : undefined;
    const declaration = wrapper?.declaration ?? statement;
    for (const record of declarationRecords(declaration, module)) {
      rememberDeclaration(record);
      if (wrapper) {
        module.directExports.set(record.name, {
          local: record.name,
          source: null,
          kind: wrapper.exportKind === 'type' ? 'type' : declarationKind(record.node),
        });
      }
    }

    if (statement.type === 'ExportNamedDeclaration' && !statement.declaration) {
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
      }
    } else if (statement.type === 'ExportAllDeclaration') {
      if (statement.exported) {
        const exported = propertyName(statement.exported, module);
        if (exported) {
          module.directExports.set(exported, {
            local: '*',
            source: statement.source.value,
            kind: statement.exportKind === 'type' ? 'type' : 'value',
          });
        }
      } else {
        module.exportStars.push({
          source: statement.source.value,
          kind: statement.exportKind === 'type' ? 'type' : 'value',
        });
      }
    }
  }
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
      moduleCache.set(key, parseDeclarationModule(key, files.get(key)));
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
  return { files, getModule, getExports };
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
    return target
      ? resolveExportDeclaration(graph, target, binding.local, seen)
      : undefined;
  }
  const records = module.declarations.get(binding.local);
  if (records?.length) return { module, records };
  const imported = module.imports.get(binding.local);
  if (!imported || imported.imported === '*') return undefined;
  const target = resolveDeclarationFile(graph.files, module.file, imported.source);
  return target
    ? resolveExportDeclaration(graph, target, imported.imported, seen)
    : undefined;
}

function unwrapTypeAnnotation(node) {
  return node?.type === 'TSTypeAnnotation' ? node.typeAnnotation : node;
}

function typeNodeText(module, node) {
  const text = nodeText(module, unwrapTypeAnnotation(node));
  return text || 'unknown';
}

function normalizeTypeParameters(module, node) {
  return (node?.typeParameters?.params ?? []).map((parameter) => ({
    name: propertyName(parameter.name, module) ?? 'T',
    constraint: parameter.constraint
      ? normalizeType(nodeText(module, parameter.constraint))
      : null,
    default: parameter.default
      ? normalizeType(nodeText(module, parameter.default))
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
  return normalizeParameterText(nodeText(module, parameter) || 'value: unknown');
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

function addDeclarationSurface(entries, base, surface, label, resolved) {
  const { module, records } = resolved;
  const nodes = records.map((record) => record.node);
  const primary = nodes[0];
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
      .map((item) => normalizeType(nodeText(module, item)))
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
          `${nodeText(module, primary.superClass)}${nodeText(module, primary.superTypeArguments)}`,
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

function leftmostTypeName(node) {
  if (!node) return undefined;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'TSQualifiedName') return leftmostTypeName(node.left);
  return undefined;
}

function referencedTypeNames(records) {
  const names = new Set();
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value.type === 'TSTypeReference') {
      const name = leftmostTypeName(value.typeName);
      if (name) names.add(name);
    } else if (value.type === 'TSInterfaceHeritage') {
      const name = leftmostTypeName(value.expression);
      if (name) names.add(name);
    } else if (value.type === 'TSTypeQuery') {
      const name = leftmostTypeName(value.exprName);
      if (name) names.add(name);
    } else if (value.type === 'ClassDeclaration') {
      const name = leftmostTypeName(value.superClass);
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

function resolveTypeDependency(graph, module, localName) {
  const records = module.declarations.get(localName);
  if (records?.length) return { module, records };
  const imported = module.imports.get(localName);
  if (!imported || imported.imported === '*') return undefined;
  const target = resolveDeclarationFile(graph.files, module.file, imported.source);
  return target
    ? resolveExportDeclaration(graph, target, imported.imported)
    : undefined;
}

function declarationIdentity(resolved) {
  return `${resolved.module.file}#${resolved.records
    .map(({ node }) => `${node.start}:${node.end}`)
    .sort()
    .join(',')}`;
}

function addReachableTypeSurfaces(
  entries,
  base,
  surface,
  graph,
  resolved,
  ancestry = new Set([declarationIdentity(resolved)]),
) {
  for (const localName of referencedTypeNames(resolved.records)) {
    const dependency = resolveTypeDependency(graph, resolved.module, localName);
    if (!dependency) continue;
    const identity = declarationIdentity(dependency);
    if (ancestry.has(identity)) continue;
    const dependencyBase = `${base}:dependency:${localName}`;
    addPresence(entries, dependencyBase, surface, `${localName} (reachable from ${base})`);
    addDeclarationSurface(
      entries,
      dependencyBase,
      surface,
      localName,
      dependency,
    );
    addReachableTypeSurfaces(
      entries,
      dependencyBase,
      surface,
      graph,
      dependency,
      new Set(ancestry).add(identity),
    );
  }
}

function normalizeNamedExports(declarations, entries) {
  const filesValue = { ...(declarations.files ?? {}) };
  const entryFile = normalizedFileKey(declarations.namedEntry ?? 'dist/lyra.d.ts');
  if (typeof declarations.named === 'string') filesValue[entryFile] = declarations.named;
  if (!filesValue[entryFile]) return;
  const graph = declarationGraph(filesValue);
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
      addDeclarationSurface(entries, base, 'named-export', name, resolved);
      addReachableTypeSurfaces(entries, base, 'named-export', graph, resolved);
    }
  }
}

export function normalizePublicApi({ packageJson, manifest, declarations = {} }) {
  if (!packageJson?.name || !packageJson?.version) {
    throw new Error('Public API input requires packageJson.name and packageJson.version.');
  }
  const entries = new Map();
  normalizeExports(packageJson.exports, entries, declarations.packageFiles);
  // Published manifests before v8 flattened standard superclass surfaces into every subclass,
  // while the compact v8 representation stores them once on the resolvable base declaration.
  // Compare effective public surfaces, not those two byte-level encodings; expansion is
  // idempotent for an already-flattened manifest because subclass entries override inherited
  // entries by public name.
  normalizeManifest(expandManifestInheritance(manifest), entries);
  normalizeNamedExports(declarations, entries);
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

#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { literalLocalizeCalls } from './check-default-strings.mjs';
import { DEFAULT_STRING_SLICE_EXCLUSIONS } from './default-string-slice-exclusions.mjs';

const defaultPackageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IMPORT_START = '// GENERATED DEFAULT-STRING SLICE IMPORT: START';
const IMPORT_END = '// GENERATED DEFAULT-STRING SLICE IMPORT: END';
const CLASS_START = '  // GENERATED DEFAULT-STRING SLICE: START';
const CLASS_END = '  // GENERATED DEFAULT-STRING SLICE: END';

function parseProgram(file, source) {
  const result = parseSync(file, source);
  if (result.errors.length > 0) {
    throw new SyntaxError(
      `${file} could not be parsed:\n${result.errors.map((error) => error.message ?? String(error)).join('\n')}`,
    );
  }
  return result.program;
}

function visitAst(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) for (const child of value) visitAst(child, visitor);
    else if (value && typeof value === 'object') visitAst(value, visitor);
  }
}

function literalString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return undefined;
}

/**
 * True for a `this.localize(...)`-shaped callee: a non-computed MemberExpression whose property
 * is `localize`. Mirrors `literalLocalizeCalls()` in check-default-strings.mjs exactly.
 */
function isLocalizeMethodCallee(callee) {
  return (
    callee?.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property?.type === 'Identifier' &&
    callee.property.name === 'localize'
  );
}

/** True for a bare `resolveLyraString(...)` call (src/internal/localization-runtime.ts), whose
 *  key is its second argument -- `resolveLyraString(host, key, overrides?, fallback?, ...)`. */
function isResolveLyraStringCallee(callee) {
  return callee?.type === 'Identifier' && callee.name === 'resolveLyraString';
}

/**
 * True for a BARE `localize(...)` identifier call. Shared helper modules take the bound function as
 * a parameter and call it directly rather than through `this` -- e.g. `code-block-shared.ts`'s
 * `codeBlockCopyLabel(localize, justCopied)` returning `localize('copyCode')`. Its key sits at
 * argument 0, exactly like the method form; missing this shape silently drops every message a
 * component resolves through such a helper.
 */
function isLocalizeIdentifierCallee(callee) {
  return callee?.type === 'Identifier' && callee.name === 'localize';
}

/**
 * Collects every literal reachable from a key-argument position, following the one legitimate
 * non-literal shape this repo uses for that position: a ternary of literals, e.g.
 * `this.localize(expanded ? 'jsonCollapseLabel' : 'jsonExpandLabel')` (json-viewer.class.ts).
 */
function collectKeyLiterals(node, sink) {
  const value = literalString(node);
  if (value !== undefined) {
    sink.add(value);
    return;
  }
  if (node?.type === 'ConditionalExpression') {
    collectKeyLiterals(node.consequent, sink);
    collectKeyLiterals(node.alternate, sink);
  }
}

/**
 * Strict, call-scoped counterpart of the broad literal walk below: a literal only counts as a
 * reachable catalog key when it is the key argument of an actual
 * `this.localize(...)`/`resolveLyraString(...)` call -- never merely a string literal that
 * textually collides with a catalog key name (a type-union member, an object-literal tag, a Lit
 * `changed.has('propName')` check, ...).
 */
function collectLocalizeCallKeys(program, catalogKeys, found) {
  visitAst(program, (node) => {
    if (node.type !== 'CallExpression') return;
    let keyArgIndex;
    if (isLocalizeMethodCallee(node.callee) || isLocalizeIdentifierCallee(node.callee)) keyArgIndex = 0;
    else if (isResolveLyraStringCallee(node.callee)) keyArgIndex = 1;
    else return;
    const argument = node.arguments?.[keyArgIndex];
    if (!argument) return;
    const keys = new Set();
    collectKeyLiterals(argument, keys);
    for (const key of keys) if (catalogKeys.has(key)) found.add(key);
  });
}

function literalLocalizeCallKeys(program, catalogKeys) {
  const found = new Set();
  collectLocalizeCallKeys(program, catalogKeys, found);
  return found;
}

/** Adds every binding name a parameter pattern introduces (plain, defaulted, rest, destructured). */
function collectParameterNames(pattern, sink) {
  if (!pattern || typeof pattern !== 'object') return;
  switch (pattern.type) {
    case 'Identifier':
      sink.add(pattern.name);
      return;
    case 'AssignmentPattern':
      collectParameterNames(pattern.left, sink);
      return;
    case 'RestElement':
      collectParameterNames(pattern.argument, sink);
      return;
    case 'ArrayPattern':
      for (const element of pattern.elements ?? []) collectParameterNames(element, sink);
      return;
    case 'ObjectPattern':
      for (const property of pattern.properties ?? []) {
        collectParameterNames(property.value ?? property.argument, sink);
      }
      return;
    default:
      return;
  }
}

/**
 * True for the one module whose non-literal `localize` key is pure plumbing rather than a real
 * lookup: `LyraElement.localize(key, ...)` forwards its own `key` parameter into
 * `resolveLyraString(this, key, ...)`. Every component inherits that method, so counting it as a
 * dynamic key would mark EVERY graph dynamic, switch the broad literal walk back on library-wide,
 * and re-admit exactly the incidental literals this narrowing exists to remove.
 *
 * Deliberately just this one file. A component-local forwarder is NOT plumbing -- e.g.
 * `document-compare.class.ts`'s `versionLabel(version, fallbackKey)` and `kbd.class.ts`'s
 * `parseShortcut(..., (key) => this.localize(key))` both take the key as a parameter, but their
 * real key literals sit at the call sites, so those graphs must stay "dynamic" and get the broad
 * walk or the messages silently vanish and the raw key name renders to the user.
 */
function isLocalizeForwarderModule(file) {
  return file.endsWith(path.join('internal', 'lyra-element.ts'));
}

/**
 * True when this module contains at least one `this.localize(...)`/`resolveLyraString(...)` call
 * whose key argument does NOT resolve to literals -- a genuinely dynamic key such as
 * `this.localize(FILE_SIZE_UNIT_KEYS[unit])` (file-icon/file-input/attachment-chip/email-viewer),
 * `this.localize(key)` over a class-file key map (citation-badge), or a key forwarded through a
 * component-local helper (document-compare, kbd). That is the one shape whose key cannot be read
 * off the call expression, so it is what makes the broad literal walk necessary. The sole exemption
 * is the base-class forwarder -- see isLocalizeForwarderModule() above.
 */
function hasDynamicLocalizeKey(program, file) {
  let dynamic = false;
  const exemptForwardedParameters = isLocalizeForwarderModule(file);
  const walk = (node, parameters) => {
    if (dynamic || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child, parameters);
      return;
    }
    let scope = parameters;
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    ) {
      scope = new Set(parameters);
      for (const parameter of node.params ?? []) collectParameterNames(parameter, scope);
    }
    if (node.type === 'CallExpression') {
      let keyArgIndex;
      if (isLocalizeMethodCallee(node.callee) || isLocalizeIdentifierCallee(node.callee)) keyArgIndex = 0;
      else if (isResolveLyraStringCallee(node.callee)) keyArgIndex = 1;
      if (keyArgIndex !== undefined) {
        const argument = node.arguments?.[keyArgIndex];
        if (argument) {
          const keys = new Set();
          collectKeyLiterals(argument, keys);
          const forwardedParameter =
            exemptForwardedParameters && argument.type === 'Identifier' && scope.has(argument.name);
          if (keys.size === 0 && !forwardedParameter) dynamic = true;
        }
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'start' || key === 'end') continue;
      if (value && typeof value === 'object') walk(value, scope);
    }
  };
  walk(program, new Set());
  return dynamic;
}

function propertyName(property) {
  if (property?.computed) return undefined;
  if (property?.key?.type === 'Identifier') return property.key.name;
  if (property?.key?.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }
  return undefined;
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    [
      'ChainExpression',
      'ParenthesizedExpression',
      'TSAsExpression',
      'TSInstantiationExpression',
      'TSNonNullExpression',
      'TSSatisfiesExpression',
      'TypeCastExpression',
    ].includes(current.type)
  ) {
    current = current.expression;
  }
  return current;
}

function parameterIdentifier(pattern) {
  const current = unwrapExpression(pattern);
  if (current?.type === 'Identifier') return current.name;
  if (current?.type === 'AssignmentPattern') return parameterIdentifier(current.left);
  if (current?.type === 'RestElement') return parameterIdentifier(current.argument);
  return undefined;
}

function isFunctionNode(node) {
  return (
    node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionDeclaration' ||
    node?.type === 'FunctionExpression'
  );
}

function memberName(member) {
  const property = unwrapExpression(member?.property);
  if (!member?.computed && property?.type === 'Identifier') return property.name;
  return literalString(property);
}

/**
 * Resolves the closed, module-local key maps that feed a dynamic localize() call. This is narrower
 * than the conservative whole-graph literal fallback: it follows identifier initializers, computed
 * object lookups, and named local-function parameters back to their call arguments. It exists so a
 * configured false-positive exclusion cannot later mask a real key added to time-input's segment
 * map or kbd's local callback/map chain.
 */
function dynamicLocalizeCallKeys(program, catalogKeys) {
  const parents = new WeakMap();
  const declarations = new Map();
  const fields = new Map();
  const calls = new Map();
  const index = (node, parent) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) index(child, parent);
      return;
    }
    if (parent) parents.set(node, parent);
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && node.init) {
      const values = declarations.get(node.id.name) ?? [];
      values.push(node.init);
      declarations.set(node.id.name, values);
    } else if (node.type === 'PropertyDefinition' && node.value) {
      const name = propertyName(node);
      if (name !== undefined) {
        const values = fields.get(name) ?? [];
        values.push(node.value);
        fields.set(name, values);
      }
    } else if (node.type === 'AssignmentExpression') {
      if (node.left?.type === 'Identifier') {
        const values = declarations.get(node.left.name) ?? [];
        values.push(node.right);
        declarations.set(node.left.name, values);
      } else if (
        node.left?.type === 'MemberExpression' &&
        unwrapExpression(node.left.object)?.type === 'ThisExpression'
      ) {
        const name = memberName(node.left);
        if (name !== undefined) {
          const values = fields.get(name) ?? [];
          values.push(node.right);
          fields.set(name, values);
        }
      }
    }
    if (node.type === 'CallExpression') {
      const callee = unwrapExpression(node.callee);
      if (callee?.type === 'Identifier') {
        const entries = calls.get(callee.name) ?? [];
        entries.push(node);
        calls.set(callee.name, entries);
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'start' || key === 'end') continue;
      if (value && typeof value === 'object') index(value, node);
    }
  };
  index(program, undefined);

  const containingParameter = (identifier) => {
    let current = parents.get(identifier);
    while (current) {
      if (isFunctionNode(current)) {
        const parameterIndex = (current.params ?? [])
          .findIndex((parameter) => parameterIdentifier(parameter) === identifier.name);
        return parameterIndex >= 0 ? { functionNode: current, parameterIndex } : undefined;
      }
      current = parents.get(current);
    }
    return undefined;
  };
  const functionBindingName = (functionNode) => {
    if (functionNode.id?.type === 'Identifier') return functionNode.id.name;
    const parent = parents.get(functionNode);
    if (
      parent?.type === 'VariableDeclarator' &&
      parent.init === functionNode &&
      parent.id?.type === 'Identifier'
    ) {
      return parent.id.name;
    }
    if (
      parent?.type === 'AssignmentExpression' &&
      parent.right === functionNode &&
      parent.left?.type === 'Identifier'
    ) {
      return parent.left.name;
    }
    return undefined;
  };

  const found = new Set();
  const resolvingValues = new Set();
  const resolvingObjects = new Set();
  const memberValueNodes = (member) => {
    if (unwrapExpression(member.object)?.type === 'ThisExpression') {
      const requested = memberName(member);
      return requested === undefined
        ? [...fields.values()].flat()
        : fields.get(requested) ?? [];
    }
    const objectCandidates = objectNodes(member.object);
    const requested = memberName(member);
    const values = [];
    for (const object of objectCandidates) {
      for (const entry of object.properties ?? []) {
        if (entry.type !== 'Property') continue;
        const name = propertyName(entry);
        if (requested === undefined || name === requested) values.push(entry.value);
      }
    }
    return values;
  };
  const parameterArguments = (identifier) => {
    const parameter = containingParameter(identifier);
    if (!parameter) return [];
    const binding = functionBindingName(parameter.functionNode);
    if (!binding) return [];
    return (calls.get(binding) ?? [])
      .map((call) => call.arguments?.[parameter.parameterIndex])
      .filter(Boolean);
  };
  function objectNodes(expression) {
    const node = unwrapExpression(expression);
    if (!node || resolvingObjects.has(node)) return [];
    resolvingObjects.add(node);
    let objects = [];
    if (node.type === 'ObjectExpression') objects = [node];
    else if (node.type === 'Identifier') {
      for (const value of declarations.get(node.name) ?? []) objects.push(...objectNodes(value));
      for (const value of parameterArguments(node)) objects.push(...objectNodes(value));
    } else if (node.type === 'MemberExpression') {
      for (const value of memberValueNodes(node)) objects.push(...objectNodes(value));
    } else if (node.type === 'ConditionalExpression') {
      objects.push(...objectNodes(node.consequent), ...objectNodes(node.alternate));
    } else if (node.type === 'LogicalExpression') {
      objects.push(...objectNodes(node.left), ...objectNodes(node.right));
    }
    resolvingObjects.delete(node);
    return objects;
  }
  function resolveExpression(expression) {
    const node = unwrapExpression(expression);
    if (!node || resolvingValues.has(node)) return;
    resolvingValues.add(node);
    const literal = literalString(node);
    if (literal !== undefined) {
      if (catalogKeys.has(literal)) found.add(literal);
    } else if (node.type === 'Identifier') {
      for (const value of declarations.get(node.name) ?? []) resolveExpression(value);
      for (const value of parameterArguments(node)) resolveExpression(value);
    } else if (node.type === 'MemberExpression') {
      for (const value of memberValueNodes(node)) resolveExpression(value);
    } else if (node.type === 'ConditionalExpression') {
      resolveExpression(node.consequent);
      resolveExpression(node.alternate);
    } else if (node.type === 'LogicalExpression') {
      resolveExpression(node.left);
      resolveExpression(node.right);
    } else if (node.type === 'ArrayExpression') {
      for (const value of node.elements ?? []) resolveExpression(value);
    } else if (node.type === 'ObjectExpression') {
      for (const entry of node.properties ?? []) {
        if (entry.type === 'Property') resolveExpression(entry.value);
        else if (entry.type === 'SpreadElement') resolveExpression(entry.argument);
      }
    }
    resolvingValues.delete(node);
  }

  visitAst(program, (node) => {
    if (node.type !== 'CallExpression') return;
    let keyArgIndex;
    if (isLocalizeMethodCallee(node.callee) || isLocalizeIdentifierCallee(node.callee)) keyArgIndex = 0;
    else if (isResolveLyraStringCallee(node.callee)) keyArgIndex = 1;
    else return;
    const argument = node.arguments?.[keyArgIndex];
    if (!argument) return;
    const literalKeys = new Set();
    collectKeyLiterals(argument, literalKeys);
    if (literalKeys.size === 0) resolveExpression(argument);
  });
  return found;
}

export function catalogEntries(source, file = 'localization.ts') {
  const program = parseProgram(file, source);
  let object;
  visitAst(program, (node) => {
    if (
      !object &&
      node.type === 'VariableDeclarator' &&
      node.id?.type === 'Identifier' &&
      node.id.name === 'DEFAULT_STRINGS' &&
      node.init?.type === 'ObjectExpression'
    ) {
      object = node.init;
    }
  });
  if (!object) throw new Error(`${file} does not declare DEFAULT_STRINGS as an object literal`);
  const entries = new Map();
  for (const property of object.properties) {
    if (property.type !== 'Property') continue;
    const key = propertyName(property);
    if (!key) throw new Error(`${file}: DEFAULT_STRINGS contains an unsupported computed key`);
    if (!/^[$A-Z_a-z][$\w]*$/.test(key)) {
      throw new Error(`${file}: default-string key ${JSON.stringify(key)} is not an identifier`);
    }
    if (entries.has(key)) throw new Error(`${file}: duplicate DEFAULT_STRINGS key ${key}`);
    entries.set(key, source.slice(property.value.start, property.value.end));
  }
  return entries;
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    if (entry.isFile() && entry.name.endsWith('.class.ts')) return [fullPath];
    return [];
  }));
  return nested.flat();
}

function runtimeImports(program) {
  const imports = [];
  for (const node of program.body) {
    if (typeof node.source?.value !== 'string') continue;
    if (node.type === 'ImportDeclaration') {
      if (node.importKind === 'type') continue;
      if (
        node.specifiers.length > 0 &&
        node.specifiers.every(
          (specifier) => specifier.type === 'ImportSpecifier' && specifier.importKind === 'type',
        )
      ) continue;
      imports.push(node.source.value);
      continue;
    }
    if (node.type === 'ExportNamedDeclaration') {
      if (node.exportKind === 'type') continue;
      if (
        node.specifiers.length > 0 &&
        node.specifiers.every(
          (specifier) => specifier.type === 'ExportSpecifier' && specifier.exportKind === 'type',
        )
      ) continue;
      imports.push(node.source.value);
      continue;
    }
    if (node.type === 'ExportAllDeclaration' && node.exportKind !== 'type') {
      imports.push(node.source.value);
    }
  }
  return imports;
}

function dependencyCandidates(file, specifier) {
  if (!specifier.startsWith('.')) return [];
  const absolute = path.resolve(path.dirname(file), specifier);
  if (specifier.endsWith('.js')) return [absolute.slice(0, -3) + '.ts'];
  if (specifier.endsWith('.ts')) return [absolute];
  if (path.extname(specifier)) return [];
  return [`${absolute}.ts`, path.join(absolute, 'index.ts')];
}

function isRuntimeHelper(rootFile, candidate, sourceRoot) {
  const relative = path.relative(sourceRoot, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  if (
    candidate.endsWith('.test.ts') ||
    candidate.endsWith('.stories.ts') ||
    candidate.endsWith('.styles.ts') ||
    candidate.endsWith('default-strings.generated.ts') ||
    candidate.endsWith(path.join('internal', 'localization.ts')) ||
    candidate.endsWith(path.join('internal', 'localization-runtime.ts'))
  ) {
    return false;
  }
  return true;
}

/**
 * Collect catalog keys that can reach one component class through its authored runtime import
 * graph. Class, story, test and style imports are deliberate graph boundaries: another class owns
 * its own slice, while non-runtime sources must never pull messages into a component bundle.
 *
 * Key collection is call-scoped (collectLocalizeCallKeys()) for the root class file AND for helper
 * modules -- a literal that merely textually collides with a catalog key name never counts. The one
 * exception is the shape that genuinely hides its key from the call expression: a dynamic argument
 * such as `this.localize(FILE_SIZE_UNIT_KEYS[unit])` or `this.localize(key)`. When (and only when)
 * some module in this graph contains such a call, EVERY scanned module in the graph -- the root
 * class file included -- falls back to the broad literal walk, so the key map feeding that dynamic
 * call is picked up wherever it happens to live. Restricting that fallback to helper modules is not
 * enough: the map is just as often a module-level constant in the class file itself.
 *
 * Without that condition every helper in the graph leaked its incidental literals: `internal/a11y.ts`
 * re-exports `accessibility-visibility.ts`, whose `visibility === 'collapse'`,
 * `localName !== 'details'` and `hasAttribute('open')` checks made `collapse`/`details`/`open` look
 * like reachable message keys for every component that touches a11y helpers -- e.g.
 * `lr-typing-indicator`, which only ever localizes `thinking`.
 */
async function reachableCatalogKeys(rootFile, catalogKeys, sourceRoot, sourceCache) {
  const found = new Set();
  const visited = new Set();
  // Phase 1: walk the graph once, parsing each reachable module and recording whether any of them
  // needs the broad walk. Parsed programs are kept so phase 2 never re-parses.
  const programs = [];
  let graphHasDynamicKey = false;
  const visitFile = async (file) => {
    if (visited.has(file) || !isRuntimeHelper(rootFile, file, sourceRoot)) return;
    visited.add(file);
    let source;
    try {
      source = sourceCache.get(file) ?? await readFile(file, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    sourceCache.set(file, source);
    const clean = withoutGeneratedBlocks(source);
    const program = parseProgram(file, clean);
    programs.push({ file, program });
    if (!graphHasDynamicKey && hasDynamicLocalizeKey(program, file)) graphHasDynamicKey = true;
    for (const specifier of runtimeImports(program)) {
      for (const candidate of dependencyCandidates(file, specifier)) {
        await visitFile(candidate);
      }
    }
  };
  await visitFile(rootFile);

  // Phase 2: collect keys, now that we know whether the broad walk is warranted at all.
  //
  // A nested class file contributes nothing either way: it may be traversed because it re-exports a
  // runtime key map (attachment-chip.class.ts does this for file-size units), but its own message
  // literals belong to its own generated slice, never to this one.
  for (const { file, program } of programs) {
    if (file !== rootFile && file.endsWith('.class.ts')) continue;
    if (graphHasDynamicKey) {
      // The broad walk covers the ROOT class file too, not just helpers: a key map feeding a
      // dynamic call frequently lives in the class file itself (lr-citation-badge's
      // `STATUS_MESSAGE_KEY` -> `this.localize(key)`), and skipping the root there silently drops
      // every one of those messages, which surfaces as the raw key name rendering in the UI.
      visitAst(program, (node) => {
        const value = literalString(node);
        if (value !== undefined && catalogKeys.has(value)) found.add(value);
      });
    } else {
      collectLocalizeCallKeys(program, catalogKeys, found);
    }
  }
  return [...found].sort();
}

function withoutGeneratedBlocks(source) {
  const importPattern = new RegExp(
    `\\n?${IMPORT_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?` +
      `${IMPORT_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`,
    'g',
  );
  const classPattern = new RegExp(
    `\\n?${CLASS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?` +
      `${CLASS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`,
    'g',
  );
  return source.replace(importPattern, '').replace(classPattern, '');
}

function constantName(key) {
  return `LYRA_DEFAULT_${key}`;
}

function relativeImport(fromFile, generatedFile) {
  let specifier = path.relative(path.dirname(fromFile), generatedFile).replaceAll(path.sep, '/');
  if (!specifier.startsWith('.')) specifier = `./${specifier}`;
  return specifier.replace(/\.ts$/, '.js');
}

function packageRelativePath(packageDir, file) {
  return path.relative(packageDir, file).split(path.sep).join('/');
}

function validateConfiguredExclusions(config, catalogKeys, classFiles) {
  const configuredPaths = Object.keys(config);
  const sortedPaths = [...configuredPaths].sort();
  if (configuredPaths.join('\0') !== sortedPaths.join('\0')) {
    throw new Error('Default-string slice exclusion paths must be sorted.');
  }
  for (const file of configuredPaths) {
    if (!classFiles.has(file)) {
      throw new Error(`${file}: default-string slice exclusion target is not a discovered class file`);
    }
    const keys = config[file];
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error(`${file}: default-string slice exclusions must be a non-empty array`);
    }
    const sortedKeys = [...new Set(keys)].sort();
    if (keys.join('\0') !== sortedKeys.join('\0')) {
      throw new Error(`${file}: default-string slice exclusions must be sorted and unique`);
    }
    for (const key of keys) {
      if (!catalogKeys.has(key)) {
        throw new Error(`${file}: excluded default-string key ${key} has no DEFAULT_STRINGS entry`);
      }
    }
  }
}

function applyConfiguredExclusions({
  packageDir,
  file,
  source,
  keys,
  catalogKeys,
  exclusions,
}) {
  const relativeFile = packageRelativePath(packageDir, file);
  const excludedKeys = exclusions[relativeFile] ?? [];
  if (excludedKeys.length === 0) return keys;
  const discovered = new Set(keys);
  const program = parseProgram(file, withoutGeneratedBlocks(source));
  const direct = literalLocalizeCallKeys(program, catalogKeys);
  const dynamic = dynamicLocalizeCallKeys(program, catalogKeys);
  for (const key of excludedKeys) {
    if (!discovered.has(key)) {
      throw new Error(
        `${relativeFile}: excluded default-string key ${key} is no longer discovered; ` +
          'remove the stale exclusion',
      );
    }
    if (direct.has(key)) {
      throw new Error(
        `${relativeFile}: excluded default-string key ${key} is now used by a literal ` +
          'localize()/resolveLyraString() call',
      );
    }
    if (dynamic.has(key)) {
      throw new Error(
        `${relativeFile}: excluded default-string key ${key} is now used by a dynamic ` +
          'localize() flow',
      );
    }
  }
  const excluded = new Set(excludedKeys);
  return keys.filter((key) => !excluded.has(key));
}

export function rewriteClassSource(source, file, generatedFile, keys) {
  const clean = withoutGeneratedBlocks(source);
  if (keys.length === 0) return clean;
  const program = parseProgram(file, clean);
  const exportedClassNames = new Set(
    program.body
      .filter((node) => node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'ClassDeclaration')
      .map((node) => node.declaration.id?.name)
      .filter(Boolean),
  );
  const classes = [];
  visitAst(program, (node) => {
    if (node.type !== 'ClassDeclaration' || !/^Lyra[A-Z]/.test(node.id?.name ?? '')) return;
    const classKeys = [...new Set(
      literalLocalizeCalls(clean.slice(node.start, node.end), file)
        .map(({ key }) => key),
    )].sort();
    classes.push({ node, keys: classKeys });
  });
  let classifiedKeys = [...new Set(classes.flatMap((entry) => entry.keys))].sort();
  const unclassifiedKeys = keys.filter((key) => !classifiedKeys.includes(key));
  if (unclassifiedKeys.length > 0) {
    const exported = classes.filter(({ node }) => exportedClassNames.has(node.id?.name));
    const target = exported.length === 1 ? exported[0] : classes.length === 1 ? classes[0] : undefined;
    if (target) target.keys = [...new Set([...target.keys, ...unclassifiedKeys])].sort();
  }
  classifiedKeys = [...new Set(classes.flatMap((entry) => entry.keys))].sort();
  const localizedClasses = classes.filter((entry) => entry.keys.length > 0);
  if (localizedClasses.length === 0 || classifiedKeys.join('\0') !== keys.join('\0')) {
    throw new Error(
      `${file}: could not assign every literal localize key to a Lyra class ` +
        `(file=${keys.join(',')}; classes=${classifiedKeys.join(',')})`,
    );
  }
  const importNames = keys.map(constantName);
  const importBlock =
    `${IMPORT_START}\n` +
    `import type { LyraLocaleStrings } from '${relativeImport(file, generatedFile).replace(/default-strings\.generated\.js$/, 'localization.js')}';\n` +
    `import { ${importNames.join(', ')} } from '${relativeImport(file, generatedFile)}';\n` +
    `${IMPORT_END}\n`;
  const lastImportEnd = program.body
    .filter((node) => node.type === 'ImportDeclaration')
    .at(-1)?.end ?? 0;
  let withImport = clean.slice(0, lastImportEnd) +
    `${lastImportEnd === 0 ? '' : '\n'}${importBlock}` + clean.slice(lastImportEnd);
  // The import insertion precedes the class and shifts its original body offset by exactly this
  // many characters. Insert into the freshly shifted source without reparsing or touching any
  // unrelated class text.
  const importDelta = withImport.length - clean.length;
  for (const entry of localizedClasses.sort((a, b) => b.node.body.start - a.node.body.start)) {
    const ownDefaults = entry.keys
      .map((key) => `    ${key}: ${constantName(key)},`)
      .join('\n');
    const classBlock =
      `\n${CLASS_START}\n` +
      `  /** @internal */\n` +
      `  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {\n` +
      `    ...super.defaultStrings,\n${ownDefaults}\n` +
      `  };\n${CLASS_END}\n`;
    const bodyStart = entry.node.body.start + importDelta;
    withImport = withImport.slice(0, bodyStart + 1) + classBlock + withImport.slice(bodyStart + 1);
  }
  return withImport;
}

function generatedCatalogSource(entries, usedKeys) {
  const lines = [
    '// GENERATED by scripts/generate-default-string-slices.mjs -- do not edit by hand.',
    "import type { LyraMessage } from './localization.js';",
    '',
  ];
  for (const key of usedKeys) {
    lines.push(`export const ${constantName(key)}: LyraMessage = ${entries.get(key)};`);
  }
  lines.push('');
  return lines.join('\n');
}

async function readOptionalFile(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function assertSourceSnapshotUnchanged(packageDir, file, snapshot) {
  if (await readOptionalFile(file) === snapshot) return;
  throw new Error(
    `${packageRelativePath(packageDir, file)} changed while default-string slices were being ` +
      'generated; refusing to overwrite it',
  );
}

export async function generateDefaultStringSlices({
  packageDir = defaultPackageDir,
  write = false,
  exclusions = DEFAULT_STRING_SLICE_EXCLUSIONS,
  beforeWrite,
} = {}) {
  const catalogFile = path.join(packageDir, 'src', 'internal', 'localization.ts');
  const generatedFile = path.join(packageDir, 'src', 'internal', 'default-strings.generated.ts');
  const catalogSource = await readFile(catalogFile, 'utf8');
  const entries = catalogEntries(catalogSource, catalogFile);
  const catalogKeys = new Set(entries.keys());
  const componentsDir = path.join(packageDir, 'src', 'components');
  const files = (await sourceFiles(componentsDir)).sort();
  validateConfiguredExclusions(
    exclusions,
    catalogKeys,
    new Set(files.map((file) => packageRelativePath(packageDir, file))),
  );
  const sourceRoot = path.join(packageDir, 'src');
  const sourceCache = new Map();
  const rewrites = [];
  const allUsedKeys = new Set();
  for (const file of files) {
    let source = sourceCache.get(file);
    if (source === undefined) {
      source = await readFile(file, 'utf8');
      sourceCache.set(file, source);
    }
    const discoveredKeys = await reachableCatalogKeys(file, catalogKeys, sourceRoot, sourceCache);
    const keys = applyConfiguredExclusions({
      packageDir,
      file,
      source,
      keys: discoveredKeys,
      catalogKeys,
      exclusions,
    });
    for (const key of keys) {
      if (!entries.has(key)) throw new Error(`${file}: localize key ${key} has no DEFAULT_STRINGS entry`);
      allUsedKeys.add(key);
    }
    const expected = rewriteClassSource(source, file, generatedFile, keys);
    if (expected !== source) rewrites.push({ file, source: expected });
  }
  const usedKeys = [...allUsedKeys].sort();
  const unusedKeys = [...entries.keys()].filter((key) => !allUsedKeys.has(key)).sort();
  const generated = generatedCatalogSource(entries, usedKeys);
  const actualGenerated = await readOptionalFile(generatedFile);
  const generatedChanged = actualGenerated !== generated;
  if (write && (rewrites.length > 0 || generatedChanged)) {
    await beforeWrite?.();
    const currentFiles = (await sourceFiles(componentsDir)).sort();
    if (currentFiles.join('\0') !== files.join('\0')) {
      throw new Error(
        'src/components class-file inventory changed while default-string slices were being ' +
          'generated; refusing to write stale output',
      );
    }
    await Promise.all([
      assertSourceSnapshotUnchanged(packageDir, catalogFile, catalogSource),
      ...[...sourceCache].map(([file, snapshot]) =>
        assertSourceSnapshotUnchanged(packageDir, file, snapshot)),
      ...(generatedChanged
        ? [assertSourceSnapshotUnchanged(packageDir, generatedFile, actualGenerated)]
        : []),
    ]);
    await Promise.all(rewrites.map(({ file, source }) => writeFile(file, source)));
    if (generatedChanged) await writeFile(generatedFile, generated);
  }
  return {
    classFileCount: files.length,
    rewrittenFileCount: rewrites.length,
    usedKeyCount: usedKeys.length,
    unusedKeys,
    generatedChanged,
    fingerprint: createHash('sha256').update(generated).digest('hex'),
  };
}

/**
 * The CLI's whole pass/fail decision, as data so it can be tested without spawning a process.
 *
 * Two independent failures, both reported in one run rather than one-at-a-time:
 *
 *   1. STALE SLICES -- the committed per-class slices no longer match the catalog. Only meaningful
 *      in check mode; `--write` has just fixed them by definition.
 *   2. ORPHANED KEYS -- a `DEFAULT_STRINGS` entry no component can reach. This walk already
 *      computes exactly that set (it is the complement of `usedKeys`), and nothing else in the
 *      repo does: `check-default-strings.mjs` proves every *used* key has an entry, the opposite
 *      direction. An orphan is not free -- `check-translations.mjs` enforces key parity in BOTH
 *      directions across all ten shipped catalogs, so one dead key is eleven dead strings that
 *      every translator re-reviews and every consumer downloads forever. Reported in `--write`
 *      mode too: regenerating cannot delete a catalog entry, so staying silent there would let an
 *      orphan land in exactly the run most likely to be the one that introduced it.
 */
export function generationFailures(result, { write = false } = {}) {
  const failures = [];
  if (!write && (result.rewrittenFileCount > 0 || result.generatedChanged)) {
    failures.push(
      `Default-string slices are stale (${result.rewrittenFileCount} class files, ` +
        `${result.generatedChanged ? 'generated catalog changed' : 'catalog current'}); rerun with --write.`,
    );
  }
  if (result.unusedKeys.length > 0) {
    failures.push(
      `DEFAULT_STRINGS has ${result.unusedKeys.length} orphaned key(s) that no component can ` +
        `reach:\n${result.unusedKeys.map((key) => `  - ${key}`).join('\n')}\n` +
        'Delete each one from src/internal/localization.ts, from the LyraMessageKey union in ' +
        'src/internal/localization-types.ts, and from every src/translations/<tag>.ts catalog ' +
        '(check-translations.mjs requires key parity in both directions, so an orphan ships as a ' +
        'dead translated string in all ten locales).',
    );
  }
  return failures;
}

if (isMainModule(import.meta.url)) {
  const write = process.argv.includes('--write');
  const result = await generateDefaultStringSlices({ write });
  const failures = generationFailures(result, { write });
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
  } else {
    console.log(
      `Default-string slices ${write ? 'generated' : 'verified'}: ${result.usedKeyCount} keys across ` +
        `${result.classFileCount} class files (${result.fingerprint.slice(0, 12)}).`,
    );
  }
}

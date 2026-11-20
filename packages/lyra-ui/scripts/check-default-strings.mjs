#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProgram, visitAst } from './lib/ast.mjs';

// Measured, not aspirational (see docs/agents/ci-and-gates.md on budgets that are red on day one):
// the number of `localize()` call sites whose key this script cannot resolve to a set today. It is
// a ratchet, so a new component cannot quietly widen the blind spot -- lower it when a call site
// becomes decidable, raise it (with the reason in the commit) only when a genuinely runtime key is
// unavoidable. `node scripts/check-default-strings.mjs --list-unresolved` prints the current set.
// Raised 27 -> 28: `<lr-span-waterfall>`'s duration text used to call `Intl.NumberFormat` directly,
// which silently defeated `registerLyraLocale()` and `.strings` for both its visible text and its
// `aria-label`. Routing it through the shared `durationMessageValue()` helper fixes that and makes
// it consistent with `<lr-thinking-panel>` and `<lr-tool-result-dialog>`, which already localize the
// same way -- but that helper picks its key by magnitude (ms/s/m/h) at runtime, so the call site
// cannot take a literal shape. One unavoidable runtime key traded for one real localization bug.
// Raised 28 -> 29: `<lr-diff-view>` gained the viewer-family `search()`/`searchNext()`/
// `searchPrevious()`/`clearSearch()` surface, and its `lr-search-change` announcements route
// through the shared `internal/viewer-search.ts#announceSearchResult()` helper exactly like
// `<lr-ebook-viewer>`'s existing occurrence -- that helper takes a `localize` callback parameter,
// so its call site's key argument is a forwarded parameter, not a literal, by construction.
// Bare `localize()` calls now count (+1), and `<lr-chart>` names its type through a literal
// switch (-1).
// Lowered 29 -> 25: `<lr-agent-run>`'s status text, the shared short-duration formatter (waterfall
// and thinking-panel durations) and `<lr-pagination>`'s plural text now take decidable shapes (-5);
// `<lr-qr-code>` stores its error message key and localizes it at render (+1).
// Raised 25 -> 28: the optional-renderer controllers of `<lr-image-viewer>`, `<lr-video>` and
// `<lr-graph>` receive `localize` as a forwarding callback whose key parameter is a closed
// Engine3dMessageKey union (+3); their fallback notices read literal tables and stay decidable.
// Measured 19 unresolved after resolving local aliases and finite imported callback keys.
const UNRESOLVED_CEILING = 19;

const componentsRoot = fileURLToPath(new URL('../src/components/', import.meta.url));
const internalRoot = fileURLToPath(new URL('../src/internal/', import.meta.url));
const localizationFile = fileURLToPath(new URL('../src/internal/localization.ts', import.meta.url));
const packageRoot = fileURLToPath(new URL('../', import.meta.url));



function literalString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return undefined;
}

/** Wrappers TypeScript puts around an expression without changing the value it produces. */
const TRANSPARENT = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
  'ParenthesizedExpression',
]);

const unwrap = (node) => {
  let current = node;
  while (current && TRANSPARENT.has(current.type)) current = current.expression;
  return current;
};

/** Read an object made entirely of string-valued data properties. */
function stringTable(node) {
  if (node?.type !== 'ObjectExpression' || node.properties.length === 0) return undefined;
  const byProperty = new Map();
  for (const property of node.properties) {
    const value = property.type === 'Property' && !property.computed ? literalString(property.value) : undefined;
    const name =
      property.type === 'Property' && !property.computed
        ? property.key.type === 'Identifier'
          ? property.key.name
          : property.key.type === 'Literal'
            ? String(property.key.value)
            : undefined
        : undefined;
    // One non-literal member and the table stops being a closed set of keys, so the whole
    // constant is dropped rather than half-resolved into a misleadingly short list.
    if (value === undefined || name === undefined) {
      return undefined;
    }
    byProperty.set(name, value);
  }
  return byProperty;
}

/**
 * `Map<name, {scalar?: string, byProperty: Map<string, string>, values: string[]}>` for every
 * module-level `const` whose value is a string literal or an object literal of string literals.
 *
 * These are the lookup tables the dynamic call sites read from (`STATUS_KEY[this.phase]`,
 * `KIND_LABEL_KEY[k]`, `keys[name]!`). Every value in such a table is a key that can actually reach
 * `localize()`, so resolving the table resolves the call site to a small, exact set.
 */
export function stringConstants(program) {
  const constants = new Map();
  // Names another module can import, so the runner can resolve a shared table
  // (`FILE_SIZE_UNIT_KEYS`, declared once beside <lr-attachment-chip> and read by five components).
  const exported = new Set();
  for (const statement of program.body ?? []) {
    if (statement.type !== 'ExportNamedDeclaration') continue;
    for (const declarator of statement.declaration?.declarations ?? []) {
      if (declarator.id?.type === 'Identifier') exported.add(declarator.id.name);
    }
  }
  visitAst(program, (node) => {
    if (node.type !== 'VariableDeclarator' || node.id?.type !== 'Identifier') return;
    const init = unwrap(node.init);
    const scalar = literalString(init);
    if (scalar !== undefined) {
      constants.set(node.id.name, {
        scalar,
        byProperty: new Map(),
        values: [scalar],
        exported: exported.has(node.id.name),
      });
      return;
    }
    const byProperty = stringTable(init);
    if (byProperty) {
      constants.set(node.id.name, {
        byProperty,
        values: [...byProperty.values()],
        exported: exported.has(node.id.name),
      });
    }
  });
  return constants;
}

/**
 * The complete set of keys an expression can hand to `localize()`, or `undefined` when that set is
 * not statically decidable.
 *
 * `undefined` is the important half. Before this existed, every non-literal argument was silently
 * treated as "nothing to check", so 131 of 1739 call sites — every ternary, every lookup table, and
 * the components whose whole localized surface is a table read (`lr-browser-frame`,
 * `lr-agent-trace`, `lr-tool-result-dialog`) — were invisible to a gate whose entire job is
 * catching a key with no English default. Resolving what is decidable and *counting* what is not is
 * the difference between a gate that is quiet because the code is clean and a gate that is quiet
 * because it is not looking.
 */
export function resolveKeys(node, constants) {
  const expression = unwrap(node);
  if (!expression) return undefined;
  const literal = literalString(expression);
  if (literal !== undefined) return [literal];

  const union = (...groups) => {
    if (groups.some((group) => group === undefined)) return undefined;
    return [...new Set(groups.flat())];
  };

  switch (expression.type) {
    case 'ConditionalExpression':
      // `cond ? 'a' : 'b'`, nested arbitrarily deep -- both arms are reachable, so both count.
      return union(
        resolveKeys(expression.consequent, constants),
        resolveKeys(expression.alternate, constants),
      );
    case 'LogicalExpression':
      // `TABLE[x] ?? TABLE.fallback`, `a || 'b'`. `&&` yields its right side when truthy; its left
      // side only surfaces when falsy, which is never a usable key, so only the right side counts.
      return expression.operator === '&&'
        ? resolveKeys(expression.right, constants)
        : union(resolveKeys(expression.left, constants), resolveKeys(expression.right, constants));
    case 'BinaryExpression': {
      if (expression.operator !== '+') return undefined;
      const left = resolveKeys(expression.left, constants);
      const right = resolveKeys(expression.right, constants);
      if (!left || !right) return undefined;
      return [...new Set(left.flatMap((prefix) => right.map((suffix) => prefix + suffix)))];
    }
    case 'TemplateLiteral': {
      // `\`prefix${suffixExpression}\`` -- resolvable exactly when every hole is.
      let combinations = [expression.quasis[0]?.value.cooked ?? ''];
      for (const [index, hole] of expression.expressions.entries()) {
        const resolved = resolveKeys(hole, constants);
        if (!resolved) return undefined;
        const tail = expression.quasis[index + 1]?.value.cooked ?? '';
        combinations = combinations.flatMap((prefix) =>
          resolved.map((piece) => `${prefix}${piece}${tail}`),
        );
      }
      return [...new Set(combinations)];
    }
    case 'MemberExpression': {
      const object = unwrap(expression.object);
      const byProperty = object?.type === 'Identifier'
        ? constants.get(object.name)?.byProperty
        : stringTable(object);
      if (!byProperty) return undefined;
      // `TABLE[whatever]` can produce any value in the table; `TABLE.named` produces exactly one.
      if (expression.computed) return [...new Set(byProperty.values())];
      const property =
        expression.property?.type === 'Identifier'
          ? expression.property.name
          : expression.property?.type === 'Literal'
            ? String(expression.property.value)
            : undefined;
      const value = property === undefined ? undefined : byProperty.get(property);
      return value === undefined ? undefined : [value];
    }
    case 'Identifier': {
      const constant = constants.get(expression.name);
      return constant?.scalar === undefined ? undefined : [constant.scalar];
    }
    default:
      return undefined;
  }
}

function lineAt(source, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

export function defaultStringKeys(source, file = 'localization.ts') {
  const program = parseProgram(file, source);
  let defaults;
  visitAst(program, (node) => {
    if (
      defaults ||
      node.type !== 'VariableDeclarator' ||
      node.id?.type !== 'Identifier' ||
      node.id.name !== 'DEFAULT_STRINGS' ||
      node.init?.type !== 'ObjectExpression'
    ) {
      return;
    }
    defaults = node.init;
  });
  if (!defaults) throw new Error(`${file} does not declare DEFAULT_STRINGS as an object literal`);

  const keys = new Set();
  for (const property of defaults.properties) {
    if (property.type !== 'Property' || property.computed) continue;
    const key =
      property.key.type === 'Identifier'
        ? property.key.name
        : property.key.type === 'Literal' && typeof property.key.value === 'string'
          ? property.key.value
          : undefined;
    if (key) keys.add(key);
  }
  return keys;
}

/** Add bindings from parameters and declarations, dropping destructured property names. */
function collectBindings(pattern, names) {
  switch (pattern?.type) {
    case 'Identifier':
      names.add(pattern.name);
      break;
    case 'TSParameterProperty':
      collectBindings(pattern.parameter, names);
      break;
    case 'RestElement':
      collectBindings(pattern.argument, names);
      break;
    case 'AssignmentPattern':
      collectBindings(pattern.left, names);
      break;
    case 'ArrayPattern':
      for (const element of pattern.elements) collectBindings(element, names);
      break;
    case 'ObjectPattern':
      for (const property of pattern.properties) {
        collectBindings(property.type === 'Property' ? property.value : property, names);
      }
      break;
  }
}

/** Look for a preceding const in the call's own block or a parameterless expression closure. */
function localAlias(argument, call, parents) {
  const expression = unwrap(argument);
  if (expression?.type !== 'Identifier') return undefined;
  let statement = call;
  for (let parent = parents.get(statement); parent; parent = parents.get(statement)) {
    if (parent.type === 'BlockStatement') {
      for (const declaration of parent.body) {
        if (declaration === statement) break;
        if (declaration.type !== 'VariableDeclaration' || declaration.kind !== 'const') continue;
        const binding = declaration.declarations.find((item) =>
          item.id.type === 'Identifier' && item.id.name === expression.name
        );
        if (binding) return binding.init;
      }
      return undefined;
    }
    const simpleClosure = parent.type === 'ArrowFunctionExpression' &&
      parent.params.length === 0 && parent.body === statement;
    if ((!simpleClosure && parent.type.includes('Function')) || parent.type.startsWith('For') ||
        parent.type === 'CatchClause' || parent.type === 'ClassExpression' ||
        parent.type === 'SwitchStatement') return undefined;
    statement = parent;
  }
  return undefined;
}

function literalTypeKeys(type) {
  if (!type) return undefined;
  const members = type.type === 'TSUnionType' ? type.types : [type];
  const keys = members.map((member) =>
    member.type === 'TSLiteralType' ? literalString(member.literal) : undefined
  );
  return keys.every((key) => key !== undefined) ? keys : undefined;
}

/** A callback whose only uses are invocations with literal keys needs no type inference. */
function directCallbackKeys(body, name) {
  const keys = new Set();
  let references = 0;
  let calls = 0;
  visitAst(body, (node) => {
    if (node.type === 'Identifier' && node.name === name) references++;
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || node.callee.name !== name) return;
    const key = literalString(node.arguments[0]);
    if (key !== undefined) {
      calls++;
      keys.add(key);
    }
  });
  return calls > 0 && references === calls ? [...keys] : undefined;
}

/** Collect explicit string-literal unions used by exported functions' callback parameters. */
function exportedCallbackKeys(program) {
  const types = new Map();
  for (const statement of program.body) {
    const declaration = statement.declaration ?? statement;
    if (declaration.type !== 'TSTypeAliasDeclaration' || declaration.typeParameters) continue;
    const keys = literalTypeKeys(declaration.typeAnnotation);
    if (keys) types.set(declaration.id.name, keys);
  }
  const callbacks = new Map();
  for (const statement of program.body) {
    const declaration = statement.declaration;
    if (statement.type !== 'ExportNamedDeclaration' || declaration?.type !== 'FunctionDeclaration') continue;
    const parameters = declaration.params.map((parameter) => {
      const callback = parameter.typeAnnotation?.typeAnnotation;
      if (callback?.type === 'TSFunctionType' && !callback.typeParameters) {
        const type = callback.params[0]?.typeAnnotation?.typeAnnotation;
        const keys = type?.type === 'TSTypeReference' && !type.typeArguments
          ? types.get(type.typeName.name)
          : literalTypeKeys(type);
        if (keys) return keys;
      }
      return parameter.type === 'Identifier' && callback
        ? directCallbackKeys(declaration.body, parameter.name)
        : undefined;
    });
    if (parameters.some(Boolean)) callbacks.set(declaration.id.name, parameters);
  }
  return callbacks;
}

function importedCallbackKeys(program, file, modules, localBindings) {
  const callbacks = new Map();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type') continue;
    const specifier = literalString(statement.source);
    if (!specifier?.startsWith('.') || !specifier.endsWith('.js')) continue;
    const functions = modules.get(join(dirname(file), specifier.replace(/\.js$/, '.ts')));
    if (!functions) continue;
    for (const entry of statement.specifiers) {
      if (entry.type !== 'ImportSpecifier' || entry.importKind === 'type' || localBindings.has(entry.local.name)) continue;
      const parameters = functions.get(entry.imported.name);
      if (parameters) callbacks.set(entry.local.name, parameters);
    }
  }
  return callbacks;
}

function forwardedKeys(argument, call, parents, callbacks) {
  const expression = unwrap(argument);
  const arrow = parents.get(call);
  if (expression?.type !== 'Identifier' || arrow?.type !== 'ArrowFunctionExpression' ||
      arrow.body !== call || arrow.params[0]?.type !== 'Identifier' ||
      arrow.params[0].name !== expression.name) return undefined;
  const invocation = parents.get(arrow);
  if (invocation?.type !== 'CallExpression' || invocation.callee.type !== 'Identifier') return undefined;
  const index = invocation.arguments.indexOf(arrow);
  if (index < 0 || invocation.arguments.slice(0, index).some(({ type }) => type === 'SpreadElement')) {
    return undefined;
  }
  return callbacks.get(invocation.callee.name)?.[index];
}

/**
 * Every `localize()` call in `source` as `{ keys, line, expression }`.
 *
 * `keys` is `undefined` for a call whose argument is not statically decidable (a bare parameter, a
 * property read off a runtime object). Those are the calls the gate cannot vouch for, and the
 * runner counts and lists them rather than passing over them in silence.
 */
export function localizeCalls(source, file = 'component.ts', sharedConstants = new Map(), callbackModules = new Map()) {
  const program = parseProgram(file, source);
  // A module's own declarations win; the shared pool only fills in names it imported.
  const constants = new Map([...sharedConstants, ...stringConstants(program)]);
  const calls = [];
  const callExpressions = [];
  const parents = new WeakMap();
  const localBindings = new Set();
  visitAst(program, (node) => {
    for (const child of Object.values(node)) {
      for (const item of Array.isArray(child) ? child : [child]) {
        if (item?.type) parents.set(item, node);
      }
    }
    if (node.type === 'CallExpression') callExpressions.push(node);
    if (node.type === 'VariableDeclarator') {
      const statement = parents.get(parents.get(node));
      if (statement?.type !== 'Program' && statement?.type !== 'ExportNamedDeclaration') {
        collectBindings(node.id, localBindings);
      }
    }
    if (node.type.includes('Function')) {
      for (const parameter of node.params ?? []) collectBindings(parameter, localBindings);
      collectBindings(node.id, localBindings);
    }
    if (node.type === 'CatchClause') collectBindings(node.param, localBindings);
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      collectBindings(node.id, localBindings);
    }
  });
  // Refuse to resolve an alias's input through a table or scalar that can be shadowed.
  const aliasConstants = new Map([...constants].filter(([name]) => !localBindings.has(name)));
  const callbacks = importedCallbackKeys(program, file, callbackModules, localBindings);
  for (const node of callExpressions) {
    // Helpers that receive `localize` as a parameter call it bare.
    const memberCall =
      node.callee?.type === 'MemberExpression' &&
      !node.callee.computed &&
      node.callee.property?.type === 'Identifier' &&
      node.callee.property.name === 'localize';
    const bareCall = node.callee?.type === 'Identifier' && node.callee.name === 'localize';
    if (!memberCall && !bareCall) continue;
    const argument = node.arguments?.[0];
    const alias = localAlias(argument, node, parents);
    const keys = (alias ? resolveKeys(alias, aliasConstants) : resolveKeys(argument, constants)) ??
      forwardedKeys(argument, node, parents, callbacks);
    calls.push({
      keys: keys && keys.length > 0 ? keys : undefined,
      line: lineAt(source, node.start ?? 0),
      expression:
        argument === undefined
          ? '(no argument)'
          : source.slice(argument.start ?? 0, argument.end ?? 0).replace(/\s+/g, ' ').trim(),
    });
  }
  return calls;
}

/**
 * The statically resolved keys only, flattened — the shape the original literal-only helper
 * returned, kept because it is what the freshness tooling and the self-test read.
 */
export function literalLocalizeCalls(source, file = 'component.ts', sharedConstants = new Map()) {
  return localizeCalls(source, file, sharedConstants)
    .filter(({ keys }) => keys !== undefined)
    .flatMap(({ keys, line }) => keys.map((key) => ({ key, line })));
}

/** The calls whose argument no static analysis of this file can pin down. */
export function unresolvedLocalizeCalls(source, file = 'component.ts', sharedConstants = new Map()) {
  return localizeCalls(source, file, sharedConstants).filter(({ keys }) => keys === undefined);
}

/**
 * The exported string tables of every scanned module, keyed by name.
 *
 * A name declared differently in two modules is dropped rather than merged: an over-wide key set
 * would invent findings, and "cannot resolve this" is the honest answer when two files disagree.
 */
export function sharedStringConstants(componentSources) {
  const shared = new Map();
  const conflicting = new Set();
  for (const { file, source } of componentSources) {
    for (const [name, constant] of stringConstants(parseProgram(file, source))) {
      if (!constant.exported || conflicting.has(name)) continue;
      const existing = shared.get(name);
      if (!existing) {
        shared.set(name, constant);
      } else if (existing.values.join('\u0000') !== constant.values.join('\u0000')) {
        conflicting.add(name);
        shared.delete(name);
      }
    }
  }
  return shared;
}

export function findMissingDefaultStrings(componentSources, localizationSource) {
  return missingDefaultStrings(scanLocalizeCalls(componentSources), defaultStringKeys(localizationSource));
}

function scanLocalizeCalls(sources) {
  const shared = sharedStringConstants(sources);
  const modules = new Map(sources.map(({ file, source }) =>
    [file, exportedCallbackKeys(parseProgram(file, source))]
  ));
  return sources.flatMap(({ file, source }) =>
    localizeCalls(source, file, shared, modules).map((call) => ({ ...call, file })),
  );
}

function missingDefaultStrings(calls, defaults) {
  return calls
    .flatMap(({ file, keys, line }) => (keys ?? [])
      .filter((key) => !defaults.has(key))
      .map((key) => ({ file, key, line })))
    .sort((a, b) => a.key.localeCompare(b.key) || a.file.localeCompare(b.file) || a.line - b.line);
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(path)));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.stories.ts')
    ) {
      files.push(path);
    }
  }
  return files;
}

async function main() {
  const files = [
    ...(await sourceFiles(componentsRoot)),
    ...(await sourceFiles(internalRoot)),
  ].sort();
  const [localizationSource, ...sources] = await Promise.all([
    readFile(localizationFile, 'utf8'),
    ...files.map((file) => readFile(file, 'utf8')),
  ]);
  const productionSources = files.map((file, index) => ({
    file: relative(packageRoot, file),
    source: sources[index],
  }));
  const all = scanLocalizeCalls(productionSources);
  const resolved = all.filter(({ keys }) => keys !== undefined);
  const unresolved = all.filter(({ keys }) => keys === undefined);
  const keys = new Set(resolved.flatMap(({ keys: resolvedKeys }) => resolvedKeys));
  const missing = missingDefaultStrings(resolved, defaultStringKeys(localizationSource));
  if (missing.length > 0) {
    console.error('Component localize() keys missing from DEFAULT_STRINGS:');
    for (const finding of missing) {
      console.error(`- ${finding.key}: ${finding.file}:${finding.line}`);
    }
    process.exitCode = 1;
    return;
  }
  if (unresolved.length > UNRESOLVED_CEILING) {
    console.error(
      `Default-string contract: ${unresolved.length} localize() call(s) cannot be resolved to a key ` +
        `set, above the recorded ceiling of ${UNRESOLVED_CEILING}:`,
    );
    for (const call of unresolved) console.error(`- ${call.file}:${call.line}: this.localize(${call.expression})`);
    console.error(
      '\nGive the key a decidable shape -- a literal, a ternary of literals, or a read from a ' +
        'module-level lookup table of literals -- so the English-default contract can see it. If the ' +
        'call genuinely cannot take one, lower/raise UNRESOLVED_CEILING in this script with the new ' +
        'measurement in the same change.',
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `Default-string contract passed: ${all.length} component/internal localize() call(s), ` +
      `${resolved.length} resolved to ${keys.size} distinct key(s), ` +
      `${unresolved.length} not statically decidable (ceiling ${UNRESOLVED_CEILING}).`,
  );
  if (unresolved.length > 0 && process.argv.includes('--list-unresolved')) {
    for (const call of unresolved) console.log(`  ? ${call.file}:${call.line}: this.localize(${call.expression})`);
  }
}

if (isMainModule(import.meta.url)) {
  await main();
}

#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

// A restore that reads persisted state must decide whether the consumer already set the property
// it is about to overwrite. `changedProperties.has(name)` cannot decide it, and the way it fails
// is silent: the guard reads as "skip when the consumer bound it", but it is `true` for every
// instance, so the restore never runs and the stored value is ignored forever.
//
// Lit puts a property with a declared default into the very first `changedProperties` batch on its
// own. With assignment-semantics class fields the initializer runs through the generated setter
// during construction; a `noAccessor` property with a hand-installed accessor is marked `wrapped`
// and seeded with its current value at the start of the first update. Neither path involves the
// consumer at all. A property with no declared default is different -- nothing enters it into the
// batch until something assigns it -- so guarding on that one is sound and is not flagged.
//
// The fix is `definePersistedProperty()`/`isPersistedPropertyExplicitlySet()` from
// `src/internal/persisted-restore.ts`, which records whether the setter ever ran. A value-based
// guard ("restore only while the property still equals its default") is not a fix either: it
// cannot see a controlled binding that sets the default value deliberately.
//
// Two rules are enforced:
//
//   1. A persisted restore may not be guarded on `changedProperties.has(<defaulted property>)`.
//   2. `isPersistedPropertyExplicitlySet(this, 'x')` may not name a property the same class
//      declares as an ordinary reactive property, because such a property owns no persisted slot
//      and the call is therefore a constant `false` -- the dead guard again, inverted.
//
// Scope for rule 1: any method that reads persisted state -- `willUpdate()`/`connectedCallback()`
// themselves and the private helpers they hand `changedProperties` to, which is where the guard
// usually lives. Two regions of that method are searched: the innermost block the read sits in
// (any polarity -- inside the restore's own block every mention of the changed map is guard logic)
// and the `test` of each enclosing `if`/`?:` on the path down to it (only where the effective
// polarity is "skip the restore when the entry is present", so that an outer
// `if (changed.has('persist')) { re-read }` reaction trigger stays unflagged). A `has()` call on
// anything but the changed-properties map (a persisted-field set, a row index) is untouched: the
// receiver must be a parameter annotated `PropertyValues` or named for that map.
//
// Shapes this check deliberately does not model, so a sweep that leans on it can say so exactly:
//   * A defaulted property inherited from a base class in ANOTHER file. Declarations are resolved
//     within one file only (including a within-file `extends` chain); resolving across files would
//     need an import graph no other contract check here builds.
//   * A guard reached through a local alias (`const seen = changed.has('open')` consumed later, or
//     the map passed on to a second helper under a different parameter name).
//   * A property whose default is installed by something other than a class-field initializer or
//     `definePersistedProperty` (a constructor assignment, `useDefault` with no initializer).

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseSync, visitorKeys } from 'oxc-parser';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(packageDir, 'src');

/** Calls that mark a method as restore logic. */
const PERSISTED_READ_CALLEES = new Set(['readPersistedState', 'restoreFromStorage']);
/** The flag reader whose argument must name a property installed by `definePersistedProperty`. */
const EXPLICITLY_SET_CALLEE = 'isPersistedPropertyExplicitlySet';
/** The installer that makes a property eligible for that flag reader. */
const PERSISTED_INSTALLER_CALLEE = 'definePersistedProperty';
/** The annotation Lit gives the changed-properties map. */
const CHANGED_MAP_TYPE = 'PropertyValues';
/** Accepted when a parameter carries no annotation to resolve. */
const CHANGED_MAP_NAMES = new Set(['changed', 'changedProperties', 'changedProps', 'changes']);
/** Decorators that declare a reactive property. */
const REACTIVE_DECORATORS = new Set(['property', 'state']);

/**
 * Call sites that still carry the dead guard and are tracked for conversion to
 * `definePersistedProperty()`. An entry that no longer matches is reported as stale, so the list
 * shrinks with the conversions instead of outliving them.
 */
const ACKNOWLEDGED = new Map([
  ['src/components/layout/app-rail/app-rail.class.ts', new Set(['open'])],
]);

function childNodes(node) {
  return (visitorKeys[node.type] ?? []).flatMap((key) => {
    const child = node[key];
    if (Array.isArray(child)) return child.filter(Boolean);
    return child ? [child] : [];
  });
}

function descendants(node) {
  const found = [];
  const visit = (current) => {
    found.push(current);
    for (const child of childNodes(current)) visit(child);
  };
  visit(node);
  return found;
}

function memberName(key) {
  if (!key) return undefined;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return undefined;
}

function decoratorName(decorator) {
  const expression = decorator.expression;
  if (expression.type === 'Identifier') return expression.name;
  if (expression.type === 'CallExpression' && expression.callee.type === 'Identifier') {
    return expression.callee.name;
  }
  return undefined;
}

function isFieldNode(node) {
  return node.type === 'PropertyDefinition' || node.type === 'AccessorProperty';
}

/** The string value of a call's `index`th argument, when it is a plain string literal. */
function stringArgument(call, index) {
  const argument = call.arguments?.[index];
  if (!argument || argument.type !== 'Literal' || typeof argument.value !== 'string') {
    return undefined;
  }
  return argument.value;
}

/** Property names declared by a `static properties = {...}` block. */
function staticPropertyNames(classBody) {
  const names = new Set();
  for (const member of classBody.body) {
    if (!isFieldNode(member) || !member.static) continue;
    if (memberName(member.key) !== 'properties') continue;
    if (member.value?.type !== 'ObjectExpression') continue;
    for (const entry of member.value.properties) {
      if (entry.type !== 'Property') continue;
      const name = memberName(entry.key);
      if (name !== undefined) names.add(name);
    }
  }
  return names;
}

/** Reactive properties declared as an ordinary class field, with or without a default. */
function declaredReactiveProperties(classBody) {
  const declaredInStatics = staticPropertyNames(classBody);
  const all = new Set();
  const defaulted = new Set();
  for (const member of classBody.body) {
    if (!isFieldNode(member) || member.static || member.declare) continue;
    const name = memberName(member.key);
    if (name === undefined) continue;
    const decorated = (member.decorators ?? []).some((decorator) =>
      REACTIVE_DECORATORS.has(decoratorName(decorator) ?? ''),
    );
    if (!decorated && !declaredInStatics.has(name)) continue;
    all.add(name);
    const initializer = member.value;
    if (!initializer) continue;
    if (initializer.type === 'Identifier' && initializer.name === 'undefined') continue;
    defaulted.add(name);
  }
  return { all, defaulted };
}

/** Property names this class body installs through `definePersistedProperty()`. */
function persistedInstalledProperties(classBody) {
  const names = new Set();
  for (const node of descendants(classBody)) {
    if (node.type !== 'CallExpression') continue;
    if (node.callee.type !== 'Identifier' || node.callee.name !== PERSISTED_INSTALLER_CALLEE) {
      continue;
    }
    const name = stringArgument(node, 1);
    if (name !== undefined) names.add(name);
  }
  return names;
}

/** Every class in one file, keyed by name where it has one, so `extends` resolves within the file. */
function classNodes(program) {
  return descendants(program).filter(
    (node) => node.type === 'ClassDeclaration' || node.type === 'ClassExpression',
  );
}

/**
 * Defaulted reactive properties visible to `classNode`, following its `extends` chain as far as
 * the file itself declares it. A base class in another file is out of reach -- see the header.
 */
function inheritedDefaultedProperties(classNode, classesByName) {
  const defaulted = new Set();
  const seen = new Set();
  let current = classNode;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    for (const name of declaredReactiveProperties(current.body).defaulted) defaulted.add(name);
    const superClass = current.superClass;
    current =
      superClass?.type === 'Identifier' ? classesByName.get(superClass.name) : undefined;
  }
  return defaulted;
}

/** The parameter names holding the changed-properties map for one function. */
function changedMapParameterNames(fn) {
  const names = new Set();
  for (const parameter of fn.params ?? []) {
    if (parameter.type !== 'Identifier') continue;
    const annotation = parameter.typeAnnotation?.typeAnnotation;
    const annotated =
      annotation?.type === 'TSTypeReference' &&
      annotation.typeName?.type === 'Identifier' &&
      annotation.typeName.name === CHANGED_MAP_TYPE;
    if (annotated || CHANGED_MAP_NAMES.has(parameter.name)) names.add(parameter.name);
  }
  return names;
}

/**
 * Every persisted read in one function, with the two regions that can guard it: the innermost
 * block the read sits in (the restore's own region -- scoping to it keeps the ordinary
 * `changed.has(...)` reactions that share a `willUpdate()` with a restore out of the check) and
 * each enclosing `if`/`?:` test on the path down to that block, carrying whether the read sits in
 * that branch's `alternate`.
 */
function restoreScopes(fnBody) {
  const scopes = [];
  const visit = (node, block, guards) => {
    const enclosing = node.type === 'BlockStatement' ? node : block;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      PERSISTED_READ_CALLEES.has(node.callee.name) &&
      enclosing !== undefined
    ) {
      scopes.push({ block: enclosing, guards });
    }
    if (node.type === 'IfStatement' || node.type === 'ConditionalExpression') {
      // A read inside the test itself is not guarded by that test, so `test` keeps `guards`.
      visit(node.test, enclosing, guards);
      if (node.consequent) {
        visit(node.consequent, enclosing, [...guards, { test: node.test, inAlternate: false }]);
      }
      if (node.alternate) {
        visit(node.alternate, enclosing, [...guards, { test: node.test, inAlternate: true }]);
      }
      return;
    }
    for (const child of childNodes(node)) visit(child, enclosing, guards);
  };
  visit(fnBody, undefined, []);
  return scopes;
}

/** `<changedMap>.has('<name>')`, whatever the surrounding polarity. */
function changedMapHasArgument(node, changedNames) {
  if (node.type !== 'CallExpression') return undefined;
  const callee = node.callee;
  if (callee.type !== 'MemberExpression' || callee.computed) return undefined;
  if (callee.object.type !== 'Identifier' || !changedNames.has(callee.object.name)) return undefined;
  if (callee.property.type !== 'Identifier' || callee.property.name !== 'has') return undefined;
  return stringArgument(node, 0);
}

/**
 * `<changedMap>.has(...)` calls inside one `if`/`?:` test, each with the `!` parity that reaches
 * it. `!` parity plus the branch the restore sits in decides the effective polarity.
 */
function changedMapHasInTest(test, changedNames) {
  const found = [];
  const visit = (node, negated) => {
    const property = changedMapHasArgument(node, changedNames);
    if (property !== undefined) found.push({ node, property, negated });
    const nextNegated =
      node.type === 'UnaryExpression' && node.operator === '!' ? !negated : negated;
    for (const child of childNodes(node)) visit(child, nextNegated);
  };
  visit(test, false);
  return found;
}

function lineOf(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

/** Returns every restore guarded on a changed-properties entry that a declared default fills in. */
export function findDeadRestoreGuards(source) {
  const parsed = parseFile(source);
  const classes = classNodes(parsed.program);
  const classesByName = new Map(
    classes.filter((node) => node.id?.name).map((node) => [node.id.name, node]),
  );
  const guards = [];
  for (const classNode of classes) {
    const defaulted = inheritedDefaultedProperties(classNode, classesByName);
    if (defaulted.size === 0) continue;
    for (const member of classNode.body.body) {
      const fn =
        member.type === 'MethodDefinition'
          ? member.value
          : isFieldNode(member) &&
              (member.value?.type === 'FunctionExpression' ||
                member.value?.type === 'ArrowFunctionExpression')
            ? member.value
            : undefined;
      if (!fn?.body) continue;
      const scopes = restoreScopes(fn.body);
      if (scopes.length === 0) continue;
      const changedNames = changedMapParameterNames(fn);
      if (changedNames.size === 0) continue;
      const method = memberName(member.key) ?? '<anonymous>';
      const seen = new Set();
      const record = (node, property) => {
        if (!defaulted.has(property)) return;
        const line = lineOf(source, node.start);
        const fingerprint = `${line}:${property}`;
        if (seen.has(fingerprint)) return;
        seen.add(fingerprint);
        guards.push({ method, property, line });
      };
      for (const { block, guards: enclosing } of scopes) {
        // An enclosing test can also sit inside the region block (an `if` with an unbraced body
        // keeps the region at the level above). Those occurrences belong to the polarity-aware
        // pass below, so skipping their ranges here keeps one shape from being judged by two
        // different rules depending only on whether the author wrote braces.
        const guardRanges = enclosing.map(({ test }) => [test.start, test.end]);
        const inGuardTest = (node) =>
          guardRanges.some(([start, end]) => node.start >= start && node.end <= end);
        for (const node of descendants(block)) {
          const property = changedMapHasArgument(node, changedNames);
          if (property !== undefined && !inGuardTest(node)) record(node, property);
        }
        for (const { test, inAlternate } of enclosing) {
          for (const hit of changedMapHasInTest(test, changedNames)) {
            // Dead only where the effective polarity is "skip the restore when the entry is
            // present": `if (!changed.has(x)) { restore }`, or the same thing written as an
            // `else`. The opposite polarity is a legitimate reaction trigger, not a guard.
            if (hit.negated !== inAlternate) record(hit.node, hit.property);
          }
        }
      }
    }
  }
  return guards.sort((a, b) => a.line - b.line || a.property.localeCompare(b.property));
}

/**
 * Returns every `isPersistedPropertyExplicitlySet(this, 'x')` whose `x` the same class declares as
 * an ordinary reactive property rather than installing through `definePersistedProperty()`. Such a
 * property owns no persisted slot, so the call is a constant `false` and the restore it gates runs
 * unconditionally -- clobbering a consumer's explicit binding with stale storage.
 */
export function findUninstalledExplicitSetProbes(source) {
  const parsed = parseFile(source);
  const probes = [];
  for (const classNode of classNodes(parsed.program)) {
    const declared = declaredReactiveProperties(classNode.body).all;
    if (declared.size === 0) continue;
    const installed = persistedInstalledProperties(classNode.body);
    for (const node of descendants(classNode.body)) {
      if (node.type !== 'CallExpression') continue;
      if (node.callee.type !== 'Identifier' || node.callee.name !== EXPLICITLY_SET_CALLEE) continue;
      const property = stringArgument(node, 1);
      if (property === undefined) continue;
      if (installed.has(property) || !declared.has(property)) continue;
      probes.push({ property, line: lineOf(source, node.start) });
    }
  }
  return probes.sort((a, b) => a.line - b.line || a.property.localeCompare(b.property));
}

function parseFile(source) {
  const parsed = parseSync('persisted-restore-source.ts', source);
  if (parsed.errors.length > 0) {
    throw new SyntaxError(
      `Unable to parse persisted-restore source: ${parsed.errors.map(({ message }) => message).join('; ')}`,
    );
  }
  return parsed;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function isCheckedSource(file) {
  return (
    file.endsWith('.ts') &&
    !file.endsWith('.d.ts') &&
    !file.endsWith('.test.ts') &&
    !file.endsWith('.stories.ts')
  );
}

/** Splits every finding into unacknowledged failures and the acknowledged entries it matched. */
export function checkPersistedRestore(root = sourceRoot) {
  const failures = [];
  const probes = [];
  const matched = new Map();
  for (const file of walk(root).filter(isCheckedSource)) {
    const relative = path.relative(packageDir, file).replaceAll('\\', '/');
    const source = fs.readFileSync(file, 'utf8');
    for (const guard of findDeadRestoreGuards(source)) {
      if (ACKNOWLEDGED.get(relative)?.has(guard.property)) {
        const seen = matched.get(relative) ?? new Set();
        seen.add(guard.property);
        matched.set(relative, seen);
        continue;
      }
      failures.push({ ...guard, file: relative });
    }
    for (const probe of findUninstalledExplicitSetProbes(source)) {
      probes.push({ ...probe, file: relative });
    }
  }
  const stale = [];
  for (const [file, properties] of ACKNOWLEDGED) {
    for (const property of properties) {
      if (!matched.get(file)?.has(property)) stale.push({ file, property });
    }
  }
  return { failures, probes, stale };
}

function main() {
  const { failures, probes, stale } = checkPersistedRestore();
  if (failures.length > 0) {
    console.error(
      'A persisted-state restore may not be guarded on a changed-properties entry that a declared default fills in:',
    );
    for (const failure of failures) {
      console.error(
        `  ${failure.file}:${failure.line} ${failure.method}() guards on '${failure.property}'`,
      );
    }
    console.error(
      "  Guard on isPersistedPropertyExplicitlySet(this, '<property>') from src/internal/persisted-restore.ts instead.",
    );
  }
  if (probes.length > 0) {
    console.error(
      'isPersistedPropertyExplicitlySet() may only name a property installed by definePersistedProperty():',
    );
    for (const probe of probes) {
      console.error(`  ${probe.file}:${probe.line} asks about '${probe.property}'`);
    }
    console.error(
      '  An ordinary reactive property owns no persisted slot, so the call is a constant false.',
    );
  }
  if (stale.length > 0) {
    console.error('These entries no longer match a dead guard and must be removed from this check:');
    for (const entry of stale) console.error(`  ${entry.file} '${entry.property}'`);
  }
  if (failures.length > 0 || probes.length > 0 || stale.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log('Persisted-state restore policy passed.');
}

if (isMainModule(import.meta.url)) main();

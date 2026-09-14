#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

// A component that has to tell "a synchronous listener wrote here during emit()" apart from
// "nothing wrote here" uses the shared guard in src/internal/veto-write-guard.ts, never its own
// boolean.
//
// Why a policy check rather than a code review note: the primitive exists precisely because the
// hand-rolled shape is subtly wrong in a way its author cannot see. `emit()` dispatches
// synchronously, so a listener that vetoes an operation and resolves it itself -- by writing the
// same property the dispatching code is about to write -- runs to completion before the dispatching
// code's own bookkeeping. Comparing a before/after snapshot of the property's *value* reads
// "unchanged" whenever the listener writes back the value the property already held, and the
// dispatching code then clobbers the listener's decision. The correct shape tracks the write, not
// the value. That shape was independently re-derived three times in this repo before it was
// extracted, and each copy carried its own near-identical paragraph of rationale; a fourth copy is
// a fourth chance to get one of its four moving parts (clear before dispatch, set from EVERY
// setter, set unconditionally, read immediately after) wrong.
//
// The signature, deliberately narrow so the check has no false positives to suppress:
//   * a non-public, undecorated boolean class field whose name matches /Touched|WriteGuard/i --
//     the vocabulary every hand-rolled copy reached for, and one no reactive `@property` uses;
//   * assigned unconditionally from MORE THAN ONE property setter -- one setter is an ordinary
//     dirty/interacted flag (`markTouched()`-style bookkeeping is a method, not a field, and never
//     matches), while several setters funnelling into one boolean is the shared-dispatch-guard
//     shape and nothing else;
//   * in a class that never constructs `new VetoWriteGuard()` -- a class that already holds the
//     shared guard is migrated by definition, whatever else it stores alongside it.
// "Unconditionally" is read the same way check-lifecycle-super.mjs reads a `super` call: a write
// buried in a branch, loop, callback or nested declaration is not the guard shape, because the
// guard's whole contract is that EVERY write marks itself.
//
// A genuine exception records itself the way the rest of this repo does -- a sentence, never a
// silence -- with a marker on the field's own line or in the comment block immediately above it:
//     /** veto-write-guard-allow: these setters run outside any emit(), so no listener write can
//      *  be confused with theirs. */
// An empty reason is still a failure: "allowed" with no stated why is the silence the marker
// exists to prevent.
// Run: node scripts/check-veto-write-guard.mjs

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseSync, visitorKeys } from 'oxc-parser';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Every component class module lives here; the guard shape is a component concern, and
// src/internal owns the primitive itself rather than consuming it.
const componentsRoot = path.join(packageDir, 'src', 'components');

const GUARD_FIELD_NAME = /Touched|WriteGuard/i;
const SHARED_GUARD = 'VetoWriteGuard';
const ALLOW_MARKER = 'veto-write-guard-allow:';
/** One setter writing a flag is ordinary bookkeeping; two or more funnelling into one boolean is
 *  the dispatch-guard shape. */
const HAND_ROLLED_SETTER_THRESHOLD = 2;

function childNodes(node) {
  return (visitorKeys[node.type] ?? []).flatMap((key) => {
    const child = node[key];
    if (Array.isArray(child)) return child.filter(Boolean);
    return child ? [child] : [];
  });
}

function memberName(key) {
  if (key.type === 'Identifier' || key.type === 'PrivateIdentifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return undefined;
}

function lineAt(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

/** Does this class, anywhere inside it, construct the shared guard? */
function constructsSharedGuard(node) {
  if (
    node.type === 'NewExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === SHARED_GUARD
  ) {
    return true;
  }
  return childNodes(node).some(constructsSharedGuard);
}

/** A non-public, undecorated boolean field -- the only shape a hand-rolled guard takes. */
function guardFieldCandidate(member) {
  if (member.type !== 'PropertyDefinition' || member.static) return undefined;
  if (member.decorators?.length) return undefined;
  const isHashPrivate = member.key.type === 'PrivateIdentifier';
  if (!isHashPrivate && member.accessibility !== 'private' && member.accessibility !== 'protected') {
    return undefined;
  }
  const name = memberName(member.key);
  if (!name || !GUARD_FIELD_NAME.test(name)) return undefined;
  const initialized = member.value?.type === 'Literal' && typeof member.value.value === 'boolean';
  const annotated = member.typeAnnotation?.typeAnnotation?.type === 'TSBooleanKeyword';
  if (!initialized && !annotated) return undefined;
  return { name, isHashPrivate, label: isHashPrivate ? `#${name}` : name, node: member };
}

function statementAlwaysStopsFollowingStatements(statement) {
  if (
    statement.type === 'ReturnStatement' ||
    statement.type === 'ThrowStatement' ||
    statement.type === 'BreakStatement' ||
    statement.type === 'ContinueStatement'
  ) {
    return true;
  }
  if (statement.type === 'BlockStatement') {
    return statement.body.some((child) => statementAlwaysStopsFollowingStatements(child));
  }
  if (statement.type === 'TryStatement') {
    // A completing finally controls whether execution can continue after the try statement. When
    // it falls through, an abrupt try still stays abrupt unless a catch can handle the throw. A
    // return cannot be caught; conservatively treat every abrupt try body with no catch as final.
    if (statement.finalizer && statementAlwaysStopsFollowingStatements(statement.finalizer)) {
      return true;
    }
    return !statement.handler && statementAlwaysStopsFollowingStatements(statement.block);
  }
  return false;
}

function isFieldAssignment(node, field) {
  if (node.type !== 'AssignmentExpression' || node.operator !== '=') return false;
  const target = node.left;
  if (target.type !== 'MemberExpression' || target.computed || target.optional) return false;
  if (target.object.type !== 'ThisExpression') return false;
  const expectedKey = field.isHashPrivate ? 'PrivateIdentifier' : 'Identifier';
  return target.property.type === expectedKey && target.property.name === field.name;
}

/** A write that every invocation of the setter performs -- never one behind a branch, a loop, a
 *  callback or a nested declaration, which is exactly the reachability rule
 *  check-lifecycle-super.mjs applies to a superclass call. */
function statementWritesField(statement, field) {
  const visit = (node) => {
    if (isFieldAssignment(node, field)) return true;
    if (node.type === 'BlockStatement') return statementsWriteField(node.body, field);
    if (node.type === 'TryStatement') {
      return visit(node.block) || (node.finalizer ? visit(node.finalizer) : false);
    }
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'ClassDeclaration' ||
      node.type === 'ClassExpression' ||
      node.type === 'IfStatement' ||
      node.type === 'DoWhileStatement' ||
      node.type === 'WhileStatement' ||
      node.type === 'ForStatement' ||
      node.type === 'ForInStatement' ||
      node.type === 'ForOfStatement' ||
      node.type === 'SwitchStatement' ||
      node.type === 'ConditionalExpression' ||
      node.type === 'LogicalExpression'
    ) {
      return false;
    }
    return childNodes(node).some(visit);
  };
  return visit(statement);
}

function statementsWriteField(statements, field) {
  for (const statement of statements) {
    if (statementWritesField(statement, field)) return true;
    if (statementAlwaysStopsFollowingStatements(statement)) return false;
  }
  return false;
}

/** Comments separated from `offset` by whitespace alone, nearest last. */
function precedingComments(source, comments, offset) {
  const collected = [];
  let boundary = offset;
  for (let index = comments.length - 1; index >= 0; index -= 1) {
    const comment = comments[index];
    if (comment.end > boundary) continue;
    if (source.slice(comment.end, boundary).trim() !== '') break;
    collected.unshift(comment);
    boundary = comment.start;
  }
  return collected;
}

/**
 * Comment text after the marker, with each line's JSDoc asterisk gutter removed. Always fed a
 * parsed comment's own `value` -- never a slice of raw source -- so the delimiters are already
 * gone and an empty reason stays empty instead of collapsing to a stray gutter character.
 */
function allowReason(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*+/, '').trim())
    .join(' ')
    .trim();
}

/** Comments that begin on one of the lines the field's own declaration spans. */
function ownLineComments(source, comments, member) {
  const firstLine = lineAt(source, member.start);
  const lastLine = lineAt(source, member.end);
  return comments.filter((comment) => {
    const line = lineAt(source, comment.start);
    return line >= firstLine && line <= lastLine;
  });
}

/**
 * The escape marker covering this field, or `undefined` when there is none. A marker on the
 * field's own declaration lines counts (a trailing `// veto-write-guard-allow: ...`), as does one
 * anywhere in the contiguous comment block immediately above it, so the reason can be the
 * multi-line paragraph these files favour.
 *
 * Both paths read the parser's comment list rather than the raw line, because the raw line also
 * contains code: `private note = 'veto-write-guard-allow: nothing';` would otherwise excuse the
 * field beside it, which is the impersonation the rest of this check is AST-based to prevent.
 */
function findAllowMarker(source, comments, member) {
  const candidates = [
    ...ownLineComments(source, comments, member),
    ...precedingComments(source, comments, member.start),
  ];
  for (const comment of candidates) {
    const index = comment.value.indexOf(ALLOW_MARKER);
    if (index < 0) continue;
    return { reason: allowReason(comment.value.slice(index + ALLOW_MARKER.length)) };
  }
  return undefined;
}

function classFindings(classNode, source, comments) {
  if (constructsSharedGuard(classNode)) return [];
  const members = classNode.body.body;
  const setters = members.filter(
    (member) => member.type === 'MethodDefinition' && member.kind === 'set' && member.value?.body,
  );
  const findings = [];
  for (const member of members) {
    const field = guardFieldCandidate(member);
    if (!field) continue;
    const writers = setters
      .filter((setter) => statementsWriteField(setter.value.body.body, field))
      .map((setter) => memberName(setter.key))
      .filter(Boolean);
    if (writers.length < HAND_ROLLED_SETTER_THRESHOLD) continue;
    const allow = findAllowMarker(source, comments, member);
    if (allow && allow.reason !== '') continue;
    findings.push({
      kind: allow ? 'empty-allow-reason' : 'hand-rolled',
      field: field.label,
      line: lineAt(source, member.start),
      setters: writers,
    });
  }
  return findings;
}

/** Every hand-rolled dispatch-write guard in one module, in source order. */
export function findHandRolledVetoGuards(source) {
  const parsed = parseSync('veto-write-guard-source.ts', source);
  if (parsed.errors.length > 0) {
    throw new SyntaxError(
      `Unable to parse veto-guard source: ${parsed.errors.map(({ message }) => message).join('; ')}`,
    );
  }
  const findings = [];
  const visit = (node) => {
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      findings.push(...classFindings(node, source, parsed.comments));
    }
    for (const child of childNodes(node)) visit(child);
  };
  visit(parsed.program);
  return findings.sort((first, second) => first.line - second.line);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const isComponentClass = (file) => file.endsWith('.class.ts');

export function checkVetoWriteGuard(root = componentsRoot) {
  const failures = [];
  const files = walk(root).filter(isComponentClass).sort();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const finding of findHandRolledVetoGuards(source)) {
      failures.push({ ...finding, file: path.relative(packageDir, file).replaceAll('\\', '/') });
    }
  }
  return { failures, scanned: files.length };
}

function main() {
  const { failures, scanned } = checkVetoWriteGuard();
  if (scanned === 0) {
    console.error(
      'Veto-write-guard contract scanned ZERO *.class.ts files -- the source layout changed.',
    );
    process.exitCode = 1;
    return;
  }
  if (failures.length > 0) {
    console.error(
      `Veto-write-guard contract failed with ${failures.length} finding(s) across ${scanned} component class file(s):`,
    );
    for (const failure of failures) {
      const why =
        failure.kind === 'empty-allow-reason'
          ? 'carries a veto-write-guard-allow comment with no reason'
          : 'is a hand-rolled dispatch-write guard';
      console.error(
        `- ${failure.file}:${failure.line} \`${failure.field}\` ${why} (written from ${failure.setters
          .map((setter) => `set ${setter}`)
          .join(', ')})`,
      );
    }
    console.error(
      '\nReplace the boolean with a `new VetoWriteGuard()` field plus `markVetoGuardWrite(...)` in ' +
        'each setter (src/internal/veto-write-guard.ts), or record the exception with a ' +
        '`veto-write-guard-allow: <reason>` comment on or immediately above the field.',
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `Veto-write-guard policy passed: ${scanned} component class file(s) carry no hand-rolled dispatch-write guard.`,
  );
}

if (isMainModule(import.meta.url)) main();

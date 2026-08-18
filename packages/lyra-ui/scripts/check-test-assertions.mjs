// Chai preserves actual/expected values for its failure report. When either value is a live DOM
// object, Web Test Runner's cross-process structured clone can fail or hang the whole test file.
// Resolve real TypeScript types when possible and conservatively recognize DOM-producing syntax
// when TypeScript 7 reports a selector expression as `any`/`unknown`/error. Tests must compare a
// boolean or stable primitive projection instead of handing Chai a live node.
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { API, SymbolFlags } from 'typescript/unstable/sync';
import {
  isAsExpression,
  isAwaitExpression,
  isCallExpression,
  isConditionalExpression,
  isElementAccessExpression,
  isIdentifier,
  isNonNullExpression,
  isNullLiteral,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isSatisfiesExpression,
  isTypeAssertion,
  isVariableDeclaration,
  isVoidExpression,
} from 'typescript/unstable/ast/is';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configFile = path.join(packageDir, 'tsconfig.test-policy.json');
const DOM_NODE_METHODS = new Set([
  'cloneNode',
  'closest',
  'createElement',
  'createElementNS',
  'elementFromPoint',
  'getElementById',
  'getRootNode',
  'querySelector',
]);
const DOM_COLLECTION_METHODS = new Set([
  'querySelectorAll',
  'assignedElements',
  'assignedNodes',
  'composedPath',
  'elementsFromPoint',
  'getElementsByClassName',
  'getElementsByName',
  'getElementsByTagName',
  'getElementsByTagNameNS',
]);
const DOM_NODE_PROPERTIES = new Set([
  'activeElement',
  'assignedSlot',
  'body',
  'documentElement',
  'firstChild',
  'firstElementChild',
  'head',
  'host',
  'lastChild',
  'lastElementChild',
  'nextElementSibling',
  'nextSibling',
  'offsetParent',
  'ownerDocument',
  'parentElement',
  'parentNode',
  'previousElementSibling',
  'previousSibling',
  'scrollingElement',
  'shadowRoot',
]);
const DOM_COLLECTION_PROPERTIES = new Set(['childNodes', 'children']);

function findExpectCall(node) {
  if (isCallExpression(node) && isIdentifier(node.expression) && node.expression.text === 'expect') return node;
  if (isCallExpression(node) || isPropertyAccessExpression(node)) return findExpectCall(node.expression);
  return undefined;
}

export function allRelatedTypes(type, seen = new Set()) {
  if (!type || seen.has(type)) return [];
  seen.add(type);
  const related = [type];
  // The unstable TypeScript sync API can expose a tuple reference whose composite/base accessors
  // throw even though the top-level type remains usable. Retain that type and degrade only the
  // broken relationship traversal; ordinary checker-operation failures still fail closed.
  try {
    if (type.isUnionType() || type.isIntersectionType()) {
      related.push(...type.getTypes().flatMap((part) => allRelatedTypes(part, seen)));
    }
  } catch {
    // The top-level type is already retained above.
  }
  try {
    related.push(...(type.getBaseTypes() ?? []).flatMap((base) => allRelatedTypes(base, seen)));
  } catch {
    // The top-level type is already retained above.
  }
  return related;
}

function isIndeterminateType(checker, type) {
  if (!type || type.isErrorType()) return true;
  return allRelatedTypes(type).some((candidate) => {
    const rendered = checker.typeToString(candidate);
    return rendered === 'any' || rendered === 'unknown' || candidate.isErrorType();
  });
}

function domNodeType(checker, location) {
  const symbol = checker.resolveName('Node', SymbolFlags.Type, location);
  if (!symbol) return undefined;
  const type = checker.getDeclaredTypeOfSymbol(symbol);
  return type.isErrorType() ? undefined : type;
}

function isDomType(checker, node, targetType) {
  try {
    const type = checker.getTypeAtLocation(node);
    // TypeScript 7 represents some otherwise valid custom-element and DOM projections with its
    // intrinsic error type. That is an indeterminate type result, not a failed checker operation;
    // the syntax/initializer classifier below is the required fallback for it.
    if (!type || type.isErrorType()) return { classification: 'indeterminate', isDom: false };
    if (isIndeterminateType(checker, type)) return { classification: 'indeterminate', isDom: false };

    const concreteTypes = allRelatedTypes(type).filter((candidate) => {
      const rendered = checker.typeToString(candidate);
      return !['any', 'unknown', 'null', 'undefined', 'never'].includes(rendered) && !candidate.isErrorType();
    });
    if (targetType && concreteTypes.some((candidate) => checker.isTypeAssignableTo(candidate, targetType))) {
      return { classification: 'assignable', isDom: true };
    }

    const rendered = checker.typeToString(type);
    const names = concreteTypes.map((candidate) => candidate.getSymbol()?.name).filter(Boolean);
    if (isDomTypeDescription(rendered, names)) return { classification: 'description', isDom: true };
    return { classification: 'primitive', isDom: false };
  } catch {
    return { classification: 'checker-error', isDom: false };
  }
}

export function isDomTypeDescription(rendered, names = []) {
  return (
    names.some((name) =>
      /^(?:Node|Element|HTMLElement|SVGElement|ShadowRoot|Document|DocumentFragment|NodeList|HTML.+Element|SVG.+Element)$/u.test(
        name
      )
    ) ||
    /\b(?:HTMLCollection|NodeList|ShadowRoot|DocumentFragment|HTML[A-Z]\w*Element|SVG[A-Z]\w*Element|HTMLElement|Element|Node)(?:<|\[|\b)/u.test(
      rendered
    )
  );
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (isAsExpression(current) ||
      isTypeAssertion(current) ||
      isNonNullExpression(current) ||
      isParenthesizedExpression(current) ||
      isSatisfiesExpression(current) ||
      isAwaitExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function callName(node) {
  const expression = unwrapExpression(node.expression);
  if (isIdentifier(expression)) return expression.text;
  if (isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function initializerOf(checker, node) {
  const unwrapped = unwrapExpression(node);
  if (!isIdentifier(unwrapped)) return undefined;
  const declarationHandle = checker.getSymbolAtLocation(unwrapped)?.valueDeclaration;
  if (!declarationHandle) return undefined;
  const declaration = declarationHandle.resolve();
  return isVariableDeclaration(declaration) ? declaration.initializer : undefined;
}

function syntaxDomKind(checker, node, targetType, seen = new Set()) {
  const current = unwrapExpression(node);
  if (!current || seen.has(current)) return undefined;
  seen.add(current);

  if (isCallExpression(current)) {
    const name = callName(current);
    if (name && DOM_NODE_METHODS.has(name)) return 'node';
    if (name && DOM_COLLECTION_METHODS.has(name)) return 'collection';
    // These testing helpers resolve to a rendered element. They are an important fallback for
    // custom-element types that TypeScript 7 currently reports as `any`/error.
    if (name && ['fixture', 'fixtureSync', 'litFixture', 'litFixtureSync'].includes(name)) return 'node';
    return undefined;
  }
  if (isPropertyAccessExpression(current)) {
    if (DOM_NODE_PROPERTIES.has(current.name.text) || DOM_COLLECTION_PROPERTIES.has(current.name.text)) {
      const receiverType = isDomType(checker, current.expression, targetType);
      if (receiverType.classification === 'checker-error') {
        throw new Error('TypeScript could not classify a DOM property receiver');
      }
      const receiverKind = receiverType.isDom
        ? 'node'
        : syntaxDomKind(checker, current.expression, targetType, seen);
      if (receiverKind === 'node') {
        return DOM_NODE_PROPERTIES.has(current.name.text) ? 'node' : 'collection';
      }
    }
    // Do not recurse through an arbitrary property. `querySelector(...).textContent` and
    // `assignedElements()[0].id` are stable primitive projections even though their receivers
    // are nodes.
    return undefined;
  }
  if (isElementAccessExpression(current)) {
    return syntaxDomKind(checker, current.expression, targetType, seen) === 'collection' ? 'node' : undefined;
  }
  if (isConditionalExpression(current)) {
    const whenTrue = syntaxDomKind(checker, current.whenTrue, targetType, seen);
    const whenFalse = syntaxDomKind(checker, current.whenFalse, targetType, seen);
    if (whenTrue === 'node' || whenFalse === 'node') return 'node';
    if (whenTrue === 'collection' || whenFalse === 'collection') return 'collection';
    return undefined;
  }

  const initializer = initializerOf(checker, current);
  return initializer ? syntaxDomKind(checker, initializer, targetType, seen) : undefined;
}

function isDefinitelyNullish(checker, node, counters) {
  const current = unwrapExpression(node);
  if (isNullLiteral(current) || isVoidExpression(current)) return true;
  if (isIdentifier(current) && current.text === 'undefined') return true;
  try {
    const type = checker.getTypeAtLocation(current);
    if (!type || type.isErrorType()) return false;
    const concrete = allRelatedTypes(type)
      .map((candidate) => checker.typeToString(candidate))
      .filter((rendered) => rendered !== 'never');
    return concrete.length > 0 && concrete.every((rendered) => rendered === 'null' || rendered === 'undefined');
  } catch {
    counters.errorCount += 1;
    return false;
  }
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function assertionPolarity(expectCall, assertionNode) {
  let current = assertionNode;
  while (current && current !== expectCall) {
    current = unwrapExpression(current);
    if (isPropertyAccessExpression(current)) {
      if (current.name.text === 'not') return 'negative';
      current = current.expression;
      continue;
    }
    if (isCallExpression(current)) {
      current = current.expression;
      continue;
    }
    break;
  }
  return 'positive';
}

function checkPayload(checker, node, targetType, counters) {
  const result = isDomType(checker, node, targetType);
  // A syntax classification can preserve useful diagnostics after a checker operation failed,
  // but it must never turn that operational failure into a green policy result.
  if (result.classification === 'checker-error') counters.errorCount += 1;
  if (result.isDom) {
    counters.classifiedCount += 1;
    return { isDom: true, via: result.classification };
  }
  try {
    if (syntaxDomKind(checker, node, targetType)) {
      counters.fallbackCount += 1;
      return { isDom: true, via: 'syntax-fallback' };
    }
  } catch {
    counters.errorCount += 1;
    return { isDom: false, via: 'checker-error' };
  }
  return { isDom: false, via: result.classification };
}

export function collectUnsafeAssertions(project, { includeFile = defaultTestFileFilter } = {}) {
  const findings = [];
  const counters = {
    candidateCount: 0,
    classifiedCount: 0,
    fallbackCount: 0,
    errorCount: 0,
    scannedFileCount: 0,
  };
  const checker = project.checker;
  let targetType;
  let targetTypeResolved = false;

  for (const fileName of project.program.getSourceFileNames()) {
    if (!includeFile(fileName)) continue;
    const sourceFile = project.program.getSourceFile(fileName);
    if (!sourceFile) continue;
    counters.scannedFileCount += 1;
    if (!targetTypeResolved) {
      targetTypeResolved = true;
      try {
        targetType = domNodeType(checker, sourceFile);
      } catch {
        targetType = undefined;
      }
      if (!targetType) counters.errorCount += 1;
    }

    const visit = (node) => {
      if (isPropertyAccessExpression(node) && ['exist', 'null'].includes(node.name.text)) {
        const expectCall = findExpectCall(node.expression);
        const actual = expectCall?.arguments[0];
        if (actual) {
          counters.candidateCount += 1;
          const classification = checkPayload(checker, actual, targetType, counters);
          if (classification.isDom) {
            const polarity = assertionPolarity(expectCall, node);
            const unsafe =
              (node.name.text === 'exist' && polarity === 'negative') ||
              (node.name.text === 'null' && polarity === 'positive');
            if (unsafe) {
              findings.push({
                fileName,
                line: lineOf(sourceFile, node),
                kind: `${polarity === 'negative' ? 'not.' : ''}${node.name.text}`,
                via: classification.via,
                actualStart: actual.getStart(sourceFile),
                actualEnd: actual.end,
                assertionStart: expectCall.end,
                assertionEnd: node.end,
              });
            }
          }
        }
      }

      if (
        isCallExpression(node) &&
        isPropertyAccessExpression(node.expression) &&
        ['equal', 'equals', 'eq', 'eql', 'eqls'].includes(node.expression.name.text)
      ) {
        const expectCall = findExpectCall(node.expression.expression);
        const actual = expectCall?.arguments[0];
        const expected = node.arguments[0];
        if (actual) {
          counters.candidateCount += 1;
          const actualClassification = checkPayload(checker, actual, targetType, counters);
          const expectedClassification = expected
            ? checkPayload(checker, expected, targetType, counters)
            : { isDom: false, via: 'missing' };
          const polarity = assertionPolarity(expectCall, node);
          const positiveDomComparison =
            polarity === 'positive' && (actualClassification.isDom || expectedClassification.isDom);
          const negativeDomIdentity =
            polarity === 'negative' && actualClassification.isDom && expectedClassification.isDom;
          const negativeNullishCheck =
            polarity === 'negative' && expected && isDefinitelyNullish(checker, expected, counters);
          if ((positiveDomComparison || negativeDomIdentity) && !negativeNullishCheck) {
            findings.push({
              fileName,
              line: lineOf(sourceFile, node),
              kind: `${polarity === 'negative' ? 'not.' : ''}${node.expression.name.text}`,
              via: actualClassification.isDom ? actualClassification.via : expectedClassification.via,
              actualStart: actual.getStart(sourceFile),
              actualEnd: actual.end,
              expectedStart: expected?.getStart(sourceFile),
              expectedEnd: expected?.end,
            });
          }
        }
      }
      node.forEachChild(visit);
    };
    sourceFile.forEachChild(visit);
  }
  return { findings, ...counters };
}

export function defaultTestFileFilter(fileName) {
  return fileName.includes('/src/components/') && fileName.endsWith('.test.ts');
}

export function policyAccountingFailures(result, expectedTestFileCount) {
  const failures = [];
  if (result.errorCount > 0) failures.push(`TypeScript classification produced ${result.errorCount} error payload(s)`);
  if (result.scannedFileCount > 0 && result.candidateCount === 0)
    failures.push(`zero Chai assertion candidates across ${result.scannedFileCount} component test file(s)`);
  else if (result.classifiedCount + result.fallbackCount === 0)
    failures.push(`zero DOM classifications for ${result.candidateCount} Chai assertion candidate(s)`);
  if (Number.isInteger(expectedTestFileCount) && result.scannedFileCount !== expectedTestFileCount)
    failures.push(`scanned ${result.scannedFileCount} component test file(s), expected ${expectedTestFileCount}`);
  return failures;
}

export function runTestAssertionPolicy({
  cwd = packageDir,
  projectFile = configFile,
  expectedTestFileCount = 376,
  includeFile = defaultTestFileFilter,
} = {}) {
  const api = new API({ cwd });
  const snapshot = api.updateSnapshot({ openProject: projectFile });
  try {
    const project = snapshot.getProject(projectFile) ?? snapshot.getProjects()[0];
    if (!project) throw new Error(`could not load ${projectFile}`);
    const result = collectUnsafeAssertions(project, { includeFile });
    const accountingFailures = policyAccountingFailures(result, expectedTestFileCount);
    const accounting =
      `${result.candidateCount} candidate(s), ${result.classifiedCount} typed classification(s), ` +
      `${result.fallbackCount} syntax fallback(s), ${result.errorCount} error(s), ` +
      `${result.scannedFileCount} test file(s)`;

    if (result.findings.length > 0 || accountingFailures.length > 0) {
      console.error(`Test assertion policy failed with ${result.findings.length} live-DOM payload(s) (${accounting}):`);
      for (const finding of result.findings) {
        console.error(
          `- ${path.relative(cwd, finding.fileName)}:${finding.line} [chai-node-payload] ` +
            `${finding.kind} assertion must compare a boolean or stable primitive projection (${finding.via})`
        );
      }
      for (const failure of accountingFailures) console.error(`- [test-assertion-accounting] ${failure}`);
      process.exitCode = 1;
    } else {
      console.log(`Test assertion policy passed: no Chai assertion carries a live DOM payload (${accounting})`);
    }
    return { ...result, accountingFailures };
  } finally {
    snapshot.dispose();
    api.close();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) runTestAssertionPolicy();

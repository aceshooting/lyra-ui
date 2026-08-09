// Chai preserves actual/expected values for its failure report. When either value is a live DOM
// object, Web Test Runner's cross-process structured clone can fail or hang the whole test file.
// Resolve the real TypeScript types so identifiers are covered as well as direct querySelector()
// expressions, and require tests to compare booleans or stable primitive projections instead.
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { API } from 'typescript/unstable/sync';
import { isCallExpression, isIdentifier, isPropertyAccessExpression } from 'typescript/unstable/ast/is';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configFile = path.join(packageDir, 'tsconfig.test-policy.json');

function findExpectCall(node) {
  if (isCallExpression(node) && isIdentifier(node.expression) && node.expression.text === 'expect') return node;
  if (isCallExpression(node) || isPropertyAccessExpression(node)) return findExpectCall(node.expression);
  return undefined;
}

function allRelatedTypes(type, seen = new Set()) {
  if (!type || seen.has(type)) return [];
  seen.add(type);
  const related = [type];
  if (type.isUnionType() || type.isIntersectionType())
    related.push(...type.getTypes().flatMap((part) => allRelatedTypes(part, seen)));
  related.push(...(type.getBaseTypes() ?? []).flatMap((base) => allRelatedTypes(base, seen)));
  return related;
}

function isDomType(checker, node) {
  const type = checker.getTypeAtLocation(node);
  if (!type || type.isErrorType()) return false;
  const rendered = checker.typeToString(type);
  const names = allRelatedTypes(type)
    .map((candidate) => candidate.getSymbol()?.name)
    .filter(Boolean);
  return isDomTypeDescription(rendered, names);
}

export function isDomTypeDescription(rendered, names = []) {
  return (
    names.some((name) =>
      /^(?:Node|Element|HTMLElement|SVGElement|ShadowRoot|Document|DocumentFragment|NodeList|HTML.+Element|SVG.+Element)$/u.test(
        name
      )
    ) ||
    /\b(?:NodeList|ShadowRoot|DocumentFragment|HTML[A-Z]\w*Element|SVG[A-Z]\w*Element|HTMLElement|Element|Node)(?:<|\[|\b)/u.test(
      rendered
    )
  );
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

export function collectUnsafeAssertions(project) {
  const findings = [];
  const checker = project.checker;
  for (const fileName of project.program.getSourceFileNames()) {
    if (!fileName.includes('/src/components/') || !fileName.endsWith('.test.ts')) continue;
    const sourceFile = project.program.getSourceFile(fileName);
    if (!sourceFile) continue;

    const visit = (node) => {
      if (isPropertyAccessExpression(node) && (node.name.text === 'exist' || node.name.text === 'null')) {
        const expectCall = findExpectCall(node.expression);
        const actual = expectCall?.arguments[0];
        if (actual && isDomType(checker, actual)) {
          findings.push({
            fileName,
            line: lineOf(sourceFile, node),
            kind: node.name.text,
          });
        }
      }

      if (
        isCallExpression(node) &&
        isPropertyAccessExpression(node.expression) &&
        ['equal', 'equals', 'eql'].includes(node.expression.name.text)
      ) {
        const expectCall = findExpectCall(node.expression.expression);
        const actual = expectCall?.arguments[0];
        const expected = node.arguments[0];
        if (actual && (isDomType(checker, actual) || (expected && isDomType(checker, expected)))) {
          findings.push({
            fileName,
            line: lineOf(sourceFile, node),
            kind: node.expression.name.text,
          });
        }
      }
      node.forEachChild(visit);
    };
    sourceFile.forEachChild(visit);
  }
  return findings;
}

export function runTestAssertionPolicy() {
  const api = new API({ cwd: packageDir });
  const snapshot = api.updateSnapshot({ openProject: configFile });
  try {
    const project = snapshot.getProject(configFile) ?? snapshot.getProjects()[0];
    if (!project) throw new Error(`could not load ${configFile}`);
    const findings = collectUnsafeAssertions(project);
    if (findings.length > 0) {
      console.error(`Test assertion policy failed with ${findings.length} live-DOM payload(s):`);
      for (const finding of findings) {
        console.error(
          `- ${path.relative(packageDir, finding.fileName)}:${finding.line} [chai-node-payload] ` +
            `${finding.kind} assertion must compare a boolean or stable primitive projection`
        );
      }
      process.exitCode = 1;
    } else {
      console.log('Test assertion policy passed: no Chai assertion carries a live DOM payload');
    }
  } finally {
    snapshot.dispose();
    api.close();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) runTestAssertionPolicy();

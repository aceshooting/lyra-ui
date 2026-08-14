// Public TypeScript interfaces and free functions do not appear in Custom Elements Manifest
// member tables. This module derives that missing public-contract census from the same explicit
// component/utility inventories that own package.json exports, then fingerprints declaration
// signatures so a new or changed contract cannot silently bypass the authored-reference gate.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import {
  CURATED_COMPONENT_HELPER_MODULES,
  CURATED_UTILITY_MODULES,
} from './generate-package-exports.mjs';

const POSITION_KEYS = new Set([
  'start',
  'end',
  'loc',
  'range',
  'scopeId',
  'symbolId',
  'referenceId',
]);

function identifierName(node) {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  return undefined;
}

function exportedName(specifier) {
  return identifierName(specifier?.exported);
}

function importedName(specifier) {
  if (specifier?.type === 'ImportSpecifier') return identifierName(specifier.imported);
  return specifier?.type === 'ImportDefaultSpecifier' ? 'default' : undefined;
}

function localName(specifier) {
  return identifierName(specifier?.local);
}

function declarationName(declaration) {
  return identifierName(declaration?.id);
}

function contractKind(declaration) {
  if (declaration?.type === 'TSInterfaceDeclaration') return 'interface';
  if (declaration?.type === 'FunctionDeclaration') return 'function';
  return undefined;
}

function publicPattern(node, isInternal = () => false) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'Identifier') return { type: 'Identifier', name: node.name };
  if (node.type === 'AssignmentPattern') {
    return {
      type: 'AssignmentPattern',
      left: publicPattern(node.left, isInternal),
      right: canonicalNode(node.right, isInternal),
    };
  }
  if (node.type === 'RestElement') {
    return { type: 'RestElement', argument: publicPattern(node.argument, isInternal) };
  }
  if (node.type === 'ObjectPattern') {
    return {
      type: 'ObjectPattern',
      optional: node.optional === true,
      properties: (node.properties ?? []).filter((property) => !isInternal(property)).map((property) => {
        if (property.type === 'RestElement') return publicPattern(property, isInternal);
        const key = identifierName(property.key) ?? canonicalNode(property.key, isInternal);
        const nested =
          property.value?.type === 'ObjectPattern' || property.value?.type === 'ArrayPattern'
            ? publicPattern(property.value, isInternal)
            : property.value?.type === 'AssignmentPattern'
              ? {
                  type: 'AssignmentPattern',
                  // An alias on the left is implementation-local; the property key above is the
                  // public option name. Retain only nested public patterns and the default value.
                  left:
                    property.value.left?.type === 'ObjectPattern' ||
                    property.value.left?.type === 'ArrayPattern'
                      ? publicPattern(property.value.left, isInternal)
                      : null,
                  right: canonicalNode(property.value.right, isInternal),
                }
              : null;
        return { type: 'Property', key, nested };
      }),
      typeAnnotation: canonicalNode(node.typeAnnotation, isInternal),
    };
  }
  if (node.type === 'ArrayPattern') {
    return {
      type: 'ArrayPattern',
      optional: node.optional === true,
      elements: (node.elements ?? []).map((element) => publicPattern(element, isInternal)),
      typeAnnotation: canonicalNode(node.typeAnnotation, isInternal),
    };
  }
  return canonicalNode(node, isInternal);
}

function canonicalNode(node, isInternal = () => false) {
  if (node === null || node === undefined) return null;
  if (typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    return node.filter((child) => !isInternal(child)).map((child) => canonicalNode(child, isInternal));
  }
  if (isInternal(node)) return null;
  if (node.type === 'ObjectPattern' || node.type === 'ArrayPattern') {
    return publicPattern(node, isInternal);
  }

  const result = {};
  for (const key of Object.keys(node).sort()) {
    if (POSITION_KEYS.has(key) || key === 'decorators' || key === 'comments') continue;
    // Function implementation statements are not part of the callable public signature.
    if (node.type === 'FunctionDeclaration' && key === 'body') continue;
    result[key] = canonicalNode(node[key], isInternal);
  }
  return result;
}

function signatureFingerprint(declarations, isInternal) {
  const signatures = declarations
    .slice()
    .sort((left, right) => left.start - right.start)
    .map((declaration) => canonicalNode(declaration, isInternal));
  return createHash('sha256').update(JSON.stringify(signatures)).digest('hex').slice(0, 20);
}

function patternNames(node, names) {
  if (!node) return;
  if (node.type === 'Identifier') {
    names.add(node.name);
    return;
  }
  if (node.type === 'AssignmentPattern') {
    patternNames(node.left, names);
    return;
  }
  if (node.type === 'RestElement') {
    patternNames(node.argument, names);
    return;
  }
  if (node.type === 'ObjectPattern') {
    for (const property of node.properties ?? []) {
      if (property.type === 'RestElement') {
        patternNames(property.argument, names);
        continue;
      }
      const key = identifierName(property.key);
      if (key) names.add(key);
      if (
        property.value?.type === 'ObjectPattern' ||
        property.value?.type === 'ArrayPattern'
      ) {
        patternNames(property.value, names);
      } else if (property.value?.type === 'AssignmentPattern') {
        const left = property.value.left;
        if (left?.type === 'ObjectPattern' || left?.type === 'ArrayPattern') {
          patternNames(left, names);
        }
      }
    }
    return;
  }
  if (node.type === 'ArrayPattern') {
    for (const element of node.elements ?? []) patternNames(element, names);
  }
}

function nestedContractNames(node, names, isInternal = () => false, visited = new Set()) {
  if (!node || typeof node !== 'object' || visited.has(node) || isInternal(node)) return;
  visited.add(node);
  if (node.type === 'TSPropertySignature' || node.type === 'TSMethodSignature') {
    const name = identifierName(node.key);
    if (name) names.add(name);
  }
  if (
    node.type === 'TSFunctionType' ||
    node.type === 'TSMethodSignature' ||
    node.type === 'TSCallSignatureDeclaration'
  ) {
    for (const parameter of node.params ?? []) patternNames(parameter, names);
  }
  for (const [key, value] of Object.entries(node)) {
    if (POSITION_KEYS.has(key) || key === 'decorators' || key === 'comments') continue;
    if (Array.isArray(value)) {
      for (const child of value) nestedContractNames(child, names, isInternal, visited);
    } else {
      nestedContractNames(value, names, isInternal, visited);
    }
  }
}

function namesForDeclarations(declarations, isInternal) {
  const names = new Set();
  for (const declaration of declarations) {
    if (declaration.type === 'TSInterfaceDeclaration') {
      nestedContractNames(declaration.body, names, isInternal);
      continue;
    }
    for (const parameter of declaration.params ?? []) {
      patternNames(parameter, names);
      nestedContractNames(parameter.typeAnnotation, names, isInternal);
    }
  }
  return [...names];
}

function resolveRelativeModule(packageDir, fromModule, specifier) {
  if (typeof specifier !== 'string' || !specifier.startsWith('.')) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromModule), specifier));
  const candidates = [];
  if (/\.(?:mjs|cjs|js|ts)$/u.test(base)) {
    candidates.push(base.replace(/\.(?:mjs|cjs|js)$/u, '.ts'));
  } else {
    candidates.push(`${base}.ts`, path.posix.join(base, 'index.ts'));
  }
  return candidates.find((candidate) => existsSync(path.join(packageDir, candidate)));
}

class SourceContractScanner {
  constructor(packageDir) {
    this.packageDir = packageDir;
    this.moduleCache = new Map();
    this.exportCache = new Map();
  }

  moduleInfo(modulePath) {
    const cached = this.moduleCache.get(modulePath);
    if (cached) return cached;
    const file = path.join(this.packageDir, modulePath);
    if (!existsSync(file)) throw new Error(`Public source-contract module is missing: ${modulePath}`);
    const source = readFileSync(file, 'utf8');
    const parsed = parseSync(modulePath, source, { lang: 'ts', sourceType: 'module' });
    if (parsed.errors.length > 0) {
      throw new Error(`Unable to parse public source-contract module ${modulePath}`);
    }
    const info = {
      modulePath,
      source,
      statements: parsed.program.body,
      locals: new Map(),
      imports: new Map(),
    };
    const comments = (parsed.comments ?? []).slice().sort((left, right) => left.end - right.end);
    info.isInternal = (node) => {
      if (!node || typeof node.start !== 'number') return false;
      for (let index = comments.length - 1; index >= 0; index -= 1) {
        const comment = comments[index];
        if (comment.end > node.start) continue;
        if (source.slice(comment.end, node.start).trim().length > 0) return false;
        return /(?:^|\s)@internal(?:\s|$)/u.test(comment.value);
      }
      return false;
    };
    this.moduleCache.set(modulePath, info);

    const addLocal = (declaration, exportedDeclaration = declaration) => {
      const name = declarationName(declaration);
      const kind = contractKind(declaration);
      if (!name || !kind || info.isInternal(exportedDeclaration)) return;
      const entry = info.locals.get(name);
      if (entry) entry.declarations.push(declaration);
      else {
        info.locals.set(name, {
          kind,
          origin: modulePath,
          declarationName: name,
          declarations: [declaration],
          isInternal: info.isInternal,
        });
      }
    };
    for (const statement of info.statements) {
      if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
        addLocal(statement.declaration, statement);
      } else {
        addLocal(statement);
      }
      if (statement.type !== 'ImportDeclaration') continue;
      const target = resolveRelativeModule(this.packageDir, modulePath, statement.source?.value);
      if (!target) continue;
      for (const specifier of statement.specifiers ?? []) {
        const local = localName(specifier);
        const imported = importedName(specifier);
        if (local && imported) info.imports.set(local, { target, imported });
      }
    }
    return info;
  }

  exportsFor(modulePath) {
    const cached = this.exportCache.get(modulePath);
    if (cached) return cached;
    const result = new Map();
    // Cache before following edges so barrel cycles terminate without recursion overflow.
    this.exportCache.set(modulePath, result);
    const info = this.moduleInfo(modulePath);

    const add = (name, contract) => {
      if (!name || !contract) return;
      const existing = result.get(name);
      if (!existing) {
        result.set(name, contract);
        return;
      }
      if (
        existing.origin !== contract.origin ||
        existing.declarationName !== contract.declarationName ||
        existing.kind !== contract.kind
      ) {
        throw new Error(`${modulePath}: duplicate public source contract export ${name}`);
      }
      for (const declaration of contract.declarations) {
        if (!existing.declarations.includes(declaration)) existing.declarations.push(declaration);
      }
    };

    const resolveLocal = (name) => {
      const direct = info.locals.get(name);
      if (direct) return direct;
      const imported = info.imports.get(name);
      return imported ? this.exportsFor(imported.target).get(imported.imported) : undefined;
    };

    for (const statement of info.statements) {
      if (statement.type === 'ExportNamedDeclaration') {
        if (statement.declaration) {
          const name = declarationName(statement.declaration);
          add(name, name ? info.locals.get(name) : undefined);
          continue;
        }
        const target = resolveRelativeModule(
          this.packageDir,
          modulePath,
          statement.source?.value,
        );
        const targetExports = target ? this.exportsFor(target) : undefined;
        for (const specifier of statement.specifiers ?? []) {
          const publicName = exportedName(specifier);
          const imported = localName(specifier);
          add(
            publicName,
            targetExports && imported
              ? targetExports.get(imported)
              : imported
                ? resolveLocal(imported)
                : undefined,
          );
        }
        continue;
      }
      if (statement.type === 'ExportAllDeclaration') {
        const target = resolveRelativeModule(
          this.packageDir,
          modulePath,
          statement.source?.value,
        );
        if (!target) continue;
        for (const [name, contract] of this.exportsFor(target)) add(name, contract);
      }
    }
    return result;
  }
}

export function publicSourceContractModules(packageDir, inventoryOverride) {
  const inventory =
    inventoryOverride ??
    JSON.parse(
      readFileSync(path.join(packageDir, 'scripts/fixtures/component-inventory.json'), 'utf8'),
    );
  if (!Array.isArray(inventory?.components)) {
    throw new Error('Public source-contract census requires component inventory entries');
  }
  return {
    componentModules: [
      ...new Set([
        ...inventory.components.map((component) => component.classModule),
        ...CURATED_COMPONENT_HELPER_MODULES,
      ]),
    ].sort(),
    utilityModules: [...CURATED_UTILITY_MODULES].sort(),
  };
}

export function sourceContractKey(contract) {
  return `${contract.module}\u0000${contract.exportName}\u0000${contract.kind}`;
}

/** Derives every exported non-EventMap interface/free function reachable from public owner routes. */
export function sourceContractCensus(
  packageDir,
  { componentModules, utilityModules } = publicSourceContractModules(packageDir),
) {
  const scanner = new SourceContractScanner(packageDir);
  const records = new Map();
  const utilitySet = new Set(utilityModules);
  for (const publicModule of [...componentModules, ...utilityModules]) {
    for (const [exportName, contract] of scanner.exportsFor(publicModule)) {
      if (contract.kind === 'interface' && exportName.endsWith('EventMap')) continue;
      const record = {
        module: contract.origin,
        exportName,
        kind: contract.kind,
        fingerprint: signatureFingerprint(contract.declarations, contract.isInternal),
        names: namesForDeclarations(contract.declarations, contract.isInternal),
        routes: [],
        utilityRoutes: [],
      };
      const key = sourceContractKey(record);
      const existing = records.get(key);
      if (existing && existing.fingerprint !== record.fingerprint) {
        throw new Error(`${key}: conflicting public source-contract signatures`);
      }
      const target = existing ?? record;
      if (!target.routes.includes(publicModule)) target.routes.push(publicModule);
      if (utilitySet.has(publicModule) && !target.utilityRoutes.includes(publicModule)) {
        target.utilityRoutes.push(publicModule);
      }
      records.set(key, target);
    }
  }
  return [...records.values()]
    .map((record) => ({
      ...record,
      routes: record.routes.sort(),
      utilityRoutes: record.utilityRoutes.sort(),
    }))
    .sort((left, right) => sourceContractKey(left).localeCompare(sourceContractKey(right)));
}

/** Exact census/baseline reconciliation. Legacy signature changes require promotion, never a
 * blanket baseline rewrite; every utility contract must have a documented mapping. */
export function validateSourceContractBaseline(census, baseline) {
  const findings = [];
  if (baseline?.schemaVersion !== 1) {
    return ['source-contract baseline schemaVersion must be 1'];
  }
  const expected = new Map();
  const documentedKeys = new Set();
  for (const [status, entries] of [
    ['documented', baseline.documented],
    ['legacy', baseline.legacy],
  ]) {
    if (!Array.isArray(entries)) {
      findings.push(`source-contract baseline ${status} entries must be an array`);
      continue;
    }
    for (const entry of entries) {
      const key = sourceContractKey(entry);
      if (expected.has(key)) {
        findings.push(`duplicate source-contract baseline owner ${key}`);
        continue;
      }
      expected.set(key, { ...entry, status });
      if (status === 'documented') documentedKeys.add(key);
    }
  }

  const actual = new Map(census.map((contract) => [sourceContractKey(contract), contract]));
  for (const [key, contract] of actual) {
    const entry = expected.get(key);
    if (!entry) {
      findings.push(`uncatalogued public source contract ${key}`);
    } else if (entry.fingerprint !== contract.fingerprint) {
      findings.push(
        entry.status === 'legacy'
          ? `legacy public source contract changed; promote it to documented enrollment: ${key}`
          : `documented public source contract signature changed: ${key}`,
      );
    }
    if (contract.utilityRoutes.length > 0 && !documentedKeys.has(key)) {
      findings.push(`public utility contract lacks documented enrollment: ${key}`);
    }
  }
  for (const key of expected.keys()) {
    if (!actual.has(key)) findings.push(`stale public source-contract baseline owner ${key}`);
  }
  return findings.sort();
}

export function readSourceContractBaseline(packageDir) {
  return JSON.parse(
    readFileSync(
      path.join(packageDir, 'scripts/fixtures/llms-source-contracts.json'),
      'utf8',
    ),
  );
}

#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, SymbolFlags } from 'typescript/unstable/sync';
import * as ts from 'typescript/unstable/ast';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const experimentalPaths = ['./adapters/a2ui-candidate.js'];
const sorted = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b, 'en')));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const declarationToolchain = json(fileURLToPath(import.meta.resolve('typescript/package.json'))).version;
const relative = (root, file) => path.relative(root, file).split(path.sep).join('/');
const isPrivate = node => !ts.isConstructorDeclaration(node) && (node.name?.kind === ts.SyntaxKind.PrivateIdentifier || node.modifiers?.some(item => item.kind === ts.SyntaxKind.PrivateKeyword));

function tokens(text) {
  const scanner = ts.createScanner(true, ts.LanguageVariant.Standard, text);
  const result = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFile; kind = scanner.scan()) {
    result.push([kind, scanner.getTokenText()]);
  }
  return result;
}

function canonical(node) {
  if (!ts.isClassDeclaration(node)) return tokens(node.getText());
  const source = node.getSourceFile().text;
  const omitted = (node.members ?? []).filter(isPrivate);
  let text = source.slice(node.getStart(), node.end);
  for (const member of [...omitted].reverse()) {
    const start = member.getStart() - node.getStart();
    text = text.slice(0, start) + text.slice(member.end - node.getStart());
  }
  // Private names are implementation details, but private nominal identity is part of assignability.
  const isStatic = member => member.modifiers?.some(item => item.kind === ts.SyntaxKind.StaticKeyword);
  return { tokens: tokens(text), privateInstance: omitted.some(member => !isStatic(member)), privateStatic: omitted.some(isStatic) };
}

/** Snapshot explicit exports and their local declaration closure without importing runtime code. */
export function collectApi({ packageDir = packageRoot, configPath = path.join(packageDir, 'scripts/fixtures/tsconfig.api.json'), experimental = experimentalPaths } = {}) {
  const manifest = json(path.join(packageDir, 'package.json'));
  const dist = path.join(packageDir, 'dist');
  assert.ok(manifest.exports && typeof manifest.exports === 'object', 'An explicit export map is required.');
  assert.ok(Array.isArray(manifest.sideEffects), 'sideEffects must explicitly list registration entries.');
  const entrypoints = {};
  for (const [name, target] of Object.entries(manifest.exports)) {
    assert.ok(!name.includes('*'), `Explicit entrypoints required; wildcard ${name} is not allowed.`);
    if (name === './package.json') {
      assert.equal(target, './package.json');
      continue;
    }
    assert.ok(target && Object.keys(target).sort().join(',') === 'default,types', `${name}: explicit types/default targets required.`);
    for (const [kind, value] of Object.entries(target)) {
      assert.ok(typeof value === 'string' && value.startsWith('./dist/') && !value.includes('*') && !value.includes('..'), `${name}: invalid ${kind} target.`);
      assert.ok(value.endsWith(kind === 'types' ? '.d.ts' : '.js'), `${name}: invalid ${kind} extension.`);
      assert.ok(existsSync(path.join(packageDir, value)), `${name}: missing ${value}; build Gen before checking its API.`);
    }
    entrypoints[name] = { ...target, profile: experimental.includes(name) ? 'experimental' : 'supported', exports: {}, globals: [] };
  }
  assert.ok(entrypoints['.'], 'The package root must remain exported.');
  assert.equal(manifest.exports['./package.json'], './package.json', 'The package metadata export is required.');
  for (const effect of manifest.sideEffects) assert.ok(Object.values(entrypoints).some(entry => entry.default === effect), `sideEffects target is not a public entry: ${effect}`);
  const candidateModules = new Set(Object.values(entrypoints).filter(entry => entry.profile === 'experimental').map(entry => relative(dist, path.join(packageDir, entry.types))));
  const api = new API({ cwd: packageDir });
  let snapshot;
  try {
    snapshot = api.updateSnapshot({ openProjects: [configPath] });
    const project = snapshot.getProject(configPath);
    assert.ok(project, 'Declaration project must load.');
    const { program, checker } = project;
    assert.equal(program.getSyntacticDiagnostics().length, 0, 'Declaration syntax must parse without errors.');
    assert.equal(program.getBindDiagnostics().length, 0, 'Declaration bindings must be unambiguous.');
    const records = new Map();
    const modules = new Map();
    const resolveAlias = symbol => symbol?.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const local = node => node && relative(dist, node.getSourceFile().fileName).endsWith('.d.ts') && !relative(dist, node.getSourceFile().fileName).startsWith('../');
    function moduleInfo(source) {
      if (modules.has(source.fileName)) return modules.get(source.fileName);
      const info = { imports: new Map(), globals: [], dependencies: [] };
      modules.set(source.fileName, info);
      for (const statement of source.statements) {
        const specifier = statement.moduleSpecifier?.text;
        if (specifier?.startsWith('.')) {
          const target = path.resolve(path.dirname(source.fileName), specifier.replace(/\.js$/, '.d.ts'));
          const dependency = program.getSourceFile(target);
          assert.ok(local(dependency), `Unresolved local declaration module: ${specifier}`);
          info.dependencies.push(dependency);
        }
        if (ts.isImportDeclaration(statement)) {
          const clause = statement.importClause;
          const add = (name, imported) => info.imports.set(name, { source: specifier, imported, typeOnly: !!clause?.isTypeOnly });
          if (clause?.name) add(clause.name.text, 'default');
          if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) add(clause.namedBindings.name.text, '*');
          else for (const item of clause?.namedBindings?.elements ?? []) add(item.name.text, item.propertyName?.text ?? item.name.text);
        }
        if (ts.isModuleDeclaration(statement) || ts.isExportDeclaration(statement) || ts.isImportDeclaration(statement) && !statement.importClause) info.globals.push(statement);
      }
      return info;
    }
    function topDeclaration(node) {
      if (ts.isVariableDeclaration(node)) return ts.isVariableDeclarationList(node.parent) && ts.isVariableStatement(node.parent.parent) ? node.parent.parent : undefined;
      return ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node) ? node : undefined;
    }
    function addSymbol(input) {
      const symbol = resolveAlias(input);
      assert.ok(symbol && !checker.isUnknownSymbol(symbol), `Unresolved exported declaration: ${input?.name ?? 'unknown'}`);
      const nodes = symbol.declarations.map(handle => handle.resolve(project)).filter(local);
      const namespace = nodes.find(ts.isSourceFile);
      if (namespace) {
        const name = `${relative(dist, namespace.fileName)}#namespace`;
        if (records.has(name)) return name;
        moduleInfo(namespace);
        const exports = checker.getExportsOfModule(symbol);
        const record = { signature: ['namespace', exports.map(item => item.name).sort()], references: new Set(), external: new Set() };
        records.set(name, record);
        for (const exported of exports) {
          const reference = addSymbol(exported);
          assert.ok(reference, `Unresolved namespace export: ${exported.name}`);
          record.references.add(reference);
        }
        return name;
      }
      const declarations = nodes.map(topDeclaration).filter(Boolean);
      if (declarations.length === 0) return null;
      const name = `${relative(dist, declarations[0].getSourceFile().fileName)}#${symbol.name}`;
      if (records.has(name)) return name;
      const record = { signature: declarations.map(canonical), references: new Set(), external: new Set() };
      records.set(name, record);
      declarations.forEach(node => visitDeclaration(node, record));
      return name;
    }
    function visitDeclaration(declaration, record) {
      const info = moduleInfo(declaration.getSourceFile());
      const identifiers = [];
      function visit(node) {
        if (isPrivate(node)) return;
        if (ts.isIdentifier(node)) identifiers.push(node);
        if (ts.isImportTypeNode(node)) {
          const specifier = node.argument.literal?.text;
          if (specifier?.startsWith('.')) {
            const target = path.resolve(path.dirname(node.getSourceFile().fileName), specifier.replace(/\.js$/, '.d.ts'));
            assert.ok(local(program.getSourceFile(target)), `Unresolved local import type: ${specifier}`);
            if (!node.qualifier) {
              const reference = addSymbol(checker.getTypeAtLocation(node)?.getSymbol());
              assert.ok(reference, `Unresolved local namespace type: ${specifier}`);
              record.references.add(reference);
            }
          }
        }
        node.forEachChild(visit);
      }
      visit(declaration);
      const symbols = checker.getSymbolAtLocation(identifiers);
      identifiers.forEach((node, index) => {
        const imported = info.imports.get(node.text);
        if (imported && !imported.source.startsWith('.')) record.external.add(JSON.stringify(imported));
        const symbol = resolveAlias(symbols[index]);
        if (!symbol || checker.isUnknownSymbol(symbol)) {
          assert.ok(!imported?.source.startsWith('.'), `Unresolved local type: ${node.text}`);
          return;
        }
        if (symbol.declarations.some(handle => local(handle.resolve(project)))) {
          const reference = addSymbol(symbol);
          if (reference) record.references.add(reference);
        }
      });
    }
    function addGlobals(source) {
      const { globals: declarations, dependencies } = moduleInfo(source);
      if (!declarations.length && !dependencies.length) return [];
      const key = `${relative(dist, source.fileName)}#global`;
      if (!records.has(key)) {
        const record = { signature: declarations.map(canonical), references: new Set(), external: new Set() };
        records.set(key, record);
        dependencies.forEach(dependency => addGlobals(dependency).forEach(reference => record.references.add(reference)));
        declarations.forEach(node => visitDeclaration(node, record));
      }
      return [key];
    }
    for (const [entry, contract] of Object.entries(entrypoints)) {
      const source = program.getSourceFile(path.join(packageDir, contract.types));
      assert.ok(source, `${entry}: declaration module must load.`);
      moduleInfo(source);
      const symbol = checker.getSymbolAtLocation(source);
      assert.ok(symbol, `${entry}: declaration module must have exports.`);
      for (const exported of checker.getExportsOfModule(symbol)) {
        const reference = addSymbol(exported);
        assert.ok(reference, `${entry}: exported declaration ${exported.name} must resolve locally.`);
        contract.exports[exported.name] = reference;
      }
      contract.exports = sorted(contract.exports);
      contract.globals = addGlobals(source);
    }
    // Module augmentation can accompany a type reached through a re-export or signature.
    for (const file of modules.keys()) addGlobals(program.getSourceFile(file));
    const declarations = sorted(Object.fromEntries([...records].map(([name, record]) => [name, {
      hash: hash(record.signature), references: [...record.references].sort(), external: [...record.external].sort(),
    }])));
    const used = new Map();
    for (const [name, entry] of Object.entries(entrypoints)) {
      const reachable = closure(entry, declarations);
      reachable.forEach(key => { if (used.get(key) !== 'supported') used.set(key, entry.profile); });
      if (entry.profile === 'supported') assert.ok(!reachable.some(key => candidateModules.has(key.split('#')[0])), `${name}: experimental declarations cannot enter a stable profile.`);
    }
    return {
      version: 1,
      declarationToolchain,
      package: manifest.name,
      engines: manifest.engines,
      sideEffects: [...manifest.sideEffects].sort(),
      entrypoints: sorted(entrypoints),
      declarations: sorted(Object.fromEntries([...used].map(([name, profile]) => [name, { hash: hash(declarations[name]), profile }]))),
    };
  } finally {
    snapshot?.dispose();
    api.close();
  }
}

function closure(entry, declarations) {
  const reached = new Set();
  const visit = name => {
    if (reached.has(name)) return;
    reached.add(name);
    const record = declarations[name];
    assert.ok(record, `Missing reachable declaration ${name}`);
    record.references.forEach(visit);
    const global = `${name.split('#')[0]}#global`;
    if (declarations[global]) visit(global);
  };
  [...Object.values(entry.exports), ...entry.globals].forEach(visit);
  return [...reached].sort();
}

/** Exact drift needs review; experimental signatures are reported separately from the supported contract. */
export function compareApi(baseline, current) {
  const contract = [];
  const experimental = [];
  for (const field of ['version', 'declarationToolchain', 'package', 'engines', 'sideEffects']) {
    if (JSON.stringify(baseline[field]) !== JSON.stringify(current[field])) contract.push(`Changed ${field}`);
  }
  for (const name of new Set([...Object.keys(baseline.entrypoints), ...Object.keys(current.entrypoints)])) {
    const before = baseline.entrypoints[name];
    const after = current.entrypoints[name];
    if (!before || !after || before.types !== after.types || before.default !== after.default || before.profile !== after.profile) {
      contract.push(`Changed entrypoint ${name}`);
      continue;
    }
    const changes = before.profile === 'experimental' ? experimental : contract;
    if (JSON.stringify(before) !== JSON.stringify(after)) changes.push(`Changed exports/reachability ${name}`);
  }
  for (const declaration of new Set([...Object.keys(baseline.declarations), ...Object.keys(current.declarations)])) {
    const before = baseline.declarations[declaration];
    const after = current.declarations[declaration];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const changes = (before?.profile ?? after?.profile) === 'experimental' && (after?.profile ?? before?.profile) === 'experimental' ? experimental : contract;
    changes.push(`Changed declaration ${declaration}`);
  }
  return { contract: [...new Set(contract)].sort(), experimental: [...new Set(experimental)].sort() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || args.length === 1 && args[0] === '--write-baseline', 'Usage: node scripts/check-api.mjs [--write-baseline]');
  const baselinePath = path.join(packageRoot, 'scripts/fixtures/api-baseline.json');
  const current = collectApi();
  if (args[0] === '--write-baseline') {
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`, { flag: 'wx' });
    console.log('Created the declaration baseline; review it before accepting this API profile.');
  } else {
    const changes = compareApi(json(baselinePath), current);
    for (const message of changes.experimental) console.log(`Experimental: ${message}`);
    assert.equal(changes.contract.length, 0, `Gen API contract drift:\n${changes.contract.join('\n')}`);
    console.log(`Gen API contract passed: ${Object.keys(current.entrypoints).length} entrypoints, ${Object.keys(current.declarations).length} reachable declarations.`);
  }
}

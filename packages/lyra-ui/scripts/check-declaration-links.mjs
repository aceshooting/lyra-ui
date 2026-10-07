import path from 'node:path';
import { API } from 'typescript/unstable/sync';
import { createVirtualFileSystem } from 'typescript/unstable/fs';
import * as ts from 'typescript/unstable/ast';

/** Check relative declaration imports against emitted exports, including re-export chains. */
export function findDeclarationLinkFindings(files, read) {
  const texts = new Map(files.filter((file) => file.endsWith('.d.ts')).map((file) => [
    path.resolve(file), read(file),
  ]));
  if (texts.size === 0) return [];
  function targetOf(file, specifier) {
    if (!specifier.startsWith('.')) return undefined;
    const target = path.resolve(path.dirname(file), specifier.replace(/\.js$/u, '.d.ts'));
    return texts.has(target) ? target : undefined;
  }
  const config = path.resolve('.lyra-declaration-links.tsconfig.json');
  const virtualFiles = Object.fromEntries(texts);
  virtualFiles[config] = JSON.stringify({
    compilerOptions: { noLib: true, types: [], module: 'ESNext', moduleResolution: 'Bundler' },
    files: [...texts.keys()],
  });
  const fs = createVirtualFileSystem(virtualFiles);
  fs.readFile = (file) => virtualFiles[file] ?? null;
  // Only emitted modules participate: optional peers and platform libraries are checked by the
  // installed consumer contracts, while this gate verifies the package's own declaration links.
  const api = new API({ cwd: process.cwd(), fs });
  let snapshot;
  try {
    snapshot = api.updateSnapshot({ openProjects: [config] });
    const project = snapshot.getProject(config);
    if (!project) throw new Error('Could not load emitted declaration graph');
    const checker = project.checker;
    const sources = new Map([...texts.keys()].map((file) => {
      const source = project.program.getSourceFile(file);
      if (!source) throw new Error(`Could not inspect declaration ${file}`);
      return [file, source];
    }));
    const exportsByFile = new Map();
    const findings = [];
    function check(source, specifier, names) {
      if (!ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) return;
      const target = targetOf(source.fileName, specifier.text);
      if (!target) return; // File reachability is checked by pruneUnreachableBuildDeclarations.
      let exports = exportsByFile.get(target);
      if (!exports) {
        const symbol = checker.getSymbolAtLocation(sources.get(target));
        exports = new Set(symbol ? checker.getExportsOfModule(symbol).map((entry) => entry.name) : []);
        exportsByFile.set(target, exports);
      }
      for (const name of names) {
        if (!exports.has(name)) findings.push(
          `${source.fileName}: declaration ${specifier.text} does not export ${name}`,
        );
      }
    }
    for (const source of sources.values()) {
      function visit(node) {
        if (ts.isImportDeclaration(node) && node.importClause) {
          const names = node.importClause.name ? ['default'] : [];
          const bindings = node.importClause.namedBindings;
          if (bindings && ts.isNamedImports(bindings)) {
            names.push(...bindings.elements.map((entry) => (entry.propertyName ?? entry.name).text));
          }
          check(source, node.moduleSpecifier, names);
        } else if (ts.isExportDeclaration(node) && node.moduleSpecifier &&
          node.exportClause && ts.isNamedExports(node.exportClause)) {
          check(source, node.moduleSpecifier,
            node.exportClause.elements.map((entry) => (entry.propertyName ?? entry.name).text));
        } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && node.qualifier) {
          let qualifier = node.qualifier;
          while (ts.isQualifiedName(qualifier)) qualifier = qualifier.left;
          check(source, node.argument.literal, [qualifier.text]);
        }
        node.forEachChild(visit);
      }
      visit(source);
    }
    return findings;
  } finally {
    snapshot?.dispose();
    api.close();
  }
}

import path from 'node:path';

import { API, SymbolFlags } from 'typescript/unstable/sync';
import * as ts from 'typescript/unstable/ast';

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function isInternal(node) {
  return ts.getJSDocTags(node).some((tag) => tag.tagName.text === 'internal');
}

function isExported(node) {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

function isPrivateMember(node) {
  return hasModifier(node, ts.SyntaxKind.PrivateKeyword) ||
    (node.name && ts.isPrivateIdentifier(node.name)) ||
    isInternal(node);
}

function declarationName(declaration) {
  return declaration.name && ts.isIdentifier(declaration.name)
    ? declaration.name.text
    : null;
}

function signatureNodes(declaration) {
  if (ts.isTypeAliasDeclaration(declaration)) {
    return [...(declaration.typeParameters ?? []), declaration.type];
  }
  if (ts.isInterfaceDeclaration(declaration)) {
    return [
      ...(declaration.typeParameters ?? []),
      ...(declaration.heritageClauses ?? []),
      ...declaration.members,
    ];
  }
  if (ts.isFunctionDeclaration(declaration)) {
    return [
      ...(declaration.typeParameters ?? []),
      ...declaration.parameters.map((parameter) => parameter.type).filter(Boolean),
      declaration.type,
    ].filter(Boolean);
  }
  if (ts.isClassDeclaration(declaration)) {
    return [
      ...(declaration.typeParameters ?? []),
      ...(declaration.heritageClauses ?? []),
      ...declaration.members
        .filter((member) => !isPrivateMember(member))
        .flatMap((member) => signatureNodes(member)),
    ];
  }
  if (
    ts.isPropertyDeclaration(declaration) ||
    ts.isPropertySignatureDeclaration(declaration) ||
    ts.isGetAccessorDeclaration(declaration) ||
    ts.isSetAccessorDeclaration(declaration) ||
    ts.isMethodDeclaration(declaration) ||
    ts.isMethodSignatureDeclaration(declaration) ||
    ts.isConstructorDeclaration(declaration) ||
    ts.isIndexSignatureDeclaration(declaration) ||
    ts.isCallSignatureDeclaration(declaration) ||
    ts.isConstructSignatureDeclaration(declaration)
  ) {
    return [
      ...(declaration.typeParameters ?? []),
      ...((declaration.parameters ?? []).map((parameter) => parameter.type).filter(Boolean)),
      declaration.type,
    ].filter(Boolean);
  }
  if (ts.isTypeParameterDeclaration(declaration)) {
    return [declaration.constraint, declaration.default].filter(Boolean);
  }
  return [];
}

/**
 * Derives the named support types that form part of component class APIs. It starts at every
 * exported component class/type, follows public signature references into support modules, and
 * follows type-only re-exports made by class modules. Implementation bodies and private/@internal
 * members are deliberately excluded.
 *
 * @param {{ packageDir: string }} options
 * @returns {{ name: string, file: string, referencedBy: string }[]}
 */
export function collectPublicSupportTypes({ packageDir }) {
  const tsconfigPath = path.join(packageDir, 'tsconfig.json');
  const api = new API({ cwd: packageDir });
  try {
    const snapshot = api.updateSnapshot({ openProjects: [tsconfigPath] });
    const project = snapshot.getProject(tsconfigPath) ?? snapshot.getProjects()[0];
    if (!project) throw new Error(`TypeScript did not load ${tsconfigPath}`);
    const program = project.program;
    const checker = project.checker;
    const componentsDir = path.join(packageDir, 'src', 'components') + path.sep;
    const sourceDir = path.join(packageDir, 'src') + path.sep;
    const classFiles = program.getSourceFileNames()
      .filter((file) => file.startsWith(componentsDir) && file.endsWith('.class.ts'))
      .map((file) => program.getSourceFile(file))
      .filter(Boolean);

    if (classFiles.length < 80) {
      throw new Error(`expected pure class modules for the component families, found ${classFiles.length}`);
    }

  /** @type {Map<string, { name: string, file: string, referencedBy: string }>} */
    const required = new Map();
    const visitedDeclarations = new Set();

    const addRequired = (declaration, referencedBy) => {
      const name = declarationName(declaration);
      if (!name || !isExported(declaration)) return;
      const file = declaration.getSourceFile().fileName;
      if (!file.startsWith(sourceDir)) return;
      const key = `${file}\0${name}`;
      if (!required.has(key)) required.set(key, { name, file, referencedBy });
    };

    const visitDeclaration = (declaration, referencedBy) => {
      if (visitedDeclarations.has(declaration)) return;
      visitedDeclarations.add(declaration);
      if (ts.isTypeAliasDeclaration(declaration) || ts.isInterfaceDeclaration(declaration)) {
        addRequired(declaration, referencedBy);
      }
      for (const node of signatureNodes(declaration)) visitSignature(node, referencedBy);
    };

    const visitSymbol = (symbol, referencedBy, followFunctions) => {
      if (symbol.flags & SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      for (const handle of symbol.declarations ?? []) {
        const declaration = handle.resolve(project);
        if (!declaration) continue;
        const file = declaration.getSourceFile().fileName;
        if (!file.startsWith(sourceDir)) continue;
        if (
          ts.isTypeAliasDeclaration(declaration) ||
          ts.isInterfaceDeclaration(declaration)
        ) {
          visitDeclaration(declaration, referencedBy);
        } else if (followFunctions && ts.isFunctionDeclaration(declaration)) {
          visitDeclaration(declaration, referencedBy);
        }
      }
    };

    const visitSignature = (node, referencedBy, followFunctions = false) => {
      const visit = (child) => {
        if (ts.isIdentifier(child)) {
          const symbol = checker.getSymbolAtLocation(child);
          if (symbol) visitSymbol(symbol, referencedBy, followFunctions);
        }
        child.forEachChild(visit);
      };
      visit(node);
    };

    for (const sourceFile of classFiles) {
      const root = path.relative(packageDir, sourceFile.fileName);
      for (const statement of sourceFile.statements) {
        if (
          (ts.isClassDeclaration(statement) ||
            ts.isInterfaceDeclaration(statement) ||
            ts.isTypeAliasDeclaration(statement)) &&
          isExported(statement) &&
          !isInternal(statement)
        ) {
          visitDeclaration(statement, root);
          if (ts.isClassDeclaration(statement)) {
            for (const heritage of statement.heritageClauses ?? []) {
              visitSignature(heritage, root, true);
            }
          }
        }
        if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          for (const specifier of statement.exportClause.elements) {
            if (!(statement.isTypeOnly || specifier.isTypeOnly)) continue;
            const symbol = checker.getSymbolAtLocation(specifier.name);
            if (symbol) visitSymbol(symbol, root, false);
          }
        }
      }
    }

    return [...required.values()].sort((a, b) =>
      a.name.localeCompare(b.name) || a.file.localeCompare(b.file));
  } finally {
    api.close();
  }
}

/** @param {{ name: string, file: string, referencedBy: string }[]} requiredTypes @param {Set<string>} rootExports */
export function missingPublicSupportTypes(requiredTypes, rootExports) {
  return requiredTypes.filter(({ name }) => !rootExports.has(name));
}

import path from "node:path";
import { parseSync } from "oxc-parser";

function identifiersIn(node, names = new Set()) {
  if (!node || typeof node !== "object") return names;
  if (node.type === "Identifier") names.add(node.name);
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "type" || key === "start" || key === "end")
      continue;
    if (Array.isArray(value)) {
      for (const child of value) identifiersIn(child, names);
    } else if (value && typeof value === "object") {
      identifiersIn(value, names);
    }
  }
  return names;
}

function calledIdentifiers(node, names = new Set()) {
  if (!node || typeof node !== "object") return names;
  if (node.type === "CallExpression" && node.callee?.type === "Identifier") {
    names.add(node.callee.name);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "type" || key === "start" || key === "end")
      continue;
    if (Array.isArray(value)) {
      for (const child of value) calledIdentifiers(child, names);
    } else if (value && typeof value === "object") {
      calledIdentifiers(value, names);
    }
  }
  return names;
}

function dynamicImportSpecifiers(node, specifiers = new Set()) {
  if (!node || typeof node !== "object") return specifiers;
  if (node.type === "ImportExpression" && typeof node.source?.value === "string") {
    specifiers.add(node.source.value);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "type" || key === "start" || key === "end")
      continue;
    if (Array.isArray(value)) {
      for (const child of value) dynamicImportSpecifiers(child, specifiers);
    } else if (value && typeof value === "object") {
      dynamicImportSpecifiers(value, specifiers);
    }
  }
  return specifiers;
}

function hostControllerIdentifiers(node, names = new Set()) {
  if (!node || typeof node !== "object") return names;
  if (
    node.type === "NewExpression" &&
    node.callee?.type === "Identifier" &&
    node.arguments?.[0]?.type === "ThisExpression"
  ) {
    names.add(node.callee.name);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "type" || key === "start" || key === "end")
      continue;
    if (Array.isArray(value)) {
      for (const child of value) hostControllerIdentifiers(child, names);
    } else if (value && typeof value === "object") {
      hostControllerIdentifiers(value, names);
    }
  }
  return names;
}

function superclassIdentifiersIn(node, names = new Set()) {
  if (!node || typeof node !== "object") return names;
  if (
    (node.type === "ClassDeclaration" || node.type === "ClassExpression") &&
    node.superClass
  ) {
    identifiersIn(node.superClass, names);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "type" || key === "start" || key === "end")
      continue;
    if (Array.isArray(value)) {
      for (const child of value) superclassIdentifiersIn(child, names);
    } else if (value && typeof value === "object") {
      superclassIdentifiersIn(value, names);
    }
  }
  return names;
}

function resolveSibling(currentPath, specifier, sources) {
  if (!specifier.startsWith(".")) return undefined;
  const directory = path.posix.dirname(currentPath);
  const candidate = path.posix.normalize(
    path.posix.join(directory, specifier.replace(/\.js$/, ".ts"))
  );
  if (sources.has(candidate)) return candidate;
  const indexCandidate = path.posix.join(
    candidate.replace(/\.ts$/, ""),
    "index.ts"
  );
  return sources.has(indexCandidate) ? indexCandidate : undefined;
}

function moduleEdges(modulePath, source, sources, allowDynamicImports) {
  const parsed = parseSync(modulePath, source, {
    lang: "ts",
    sourceType: "module",
  });
  if (parsed.errors.length > 0) {
    throw new Error(
      `${modulePath}: unable to parse render reachability: ${parsed.errors[0].message}`
    );
  }

  const superclassIdentifiers = superclassIdentifiersIn(parsed.program);
  const calls = calledIdentifiers(parsed.program);
  // Only actual comments establish an explicit controller render surface; string/template text
  // and annotations without a value import constructed for this host provide no evidence.
  const renderControllers = new Set(parsed.comments.flatMap((comment) =>
    [...comment.value.matchAll(/^\s*\*?\s*@renderController\s+([A-Za-z_$][\w$]*)\s*$/gm)]
      .map((match) => match[1])));
  const hostControllers = renderControllers.size > 0
    ? hostControllerIdentifiers(parsed.program)
    : new Set();
  const targets = new Map();

  for (const statement of parsed.program.body) {
    if (
      statement.type !== "ImportDeclaration" ||
      statement.importKind === "type"
    )
      continue;
    const target = resolveSibling(modulePath, statement.source.value, sources);
    if (!target || /(?:^|\.)styles\.ts$/.test(target)) continue;

    for (const specifier of statement.specifiers) {
      if (specifier.importKind === "type") continue;
      const localName = specifier.local?.name;
      if (!localName) continue;
      const importedName =
        specifier.type === "ImportSpecifier"
          ? specifier.imported?.name ?? specifier.imported?.value ?? localName
          : localName;
      const isSuperclass = superclassIdentifiers.has(localName);
      const isRenderHelper =
        calls.has(localName) &&
        /^(?:render|create[A-Za-z0-9_$]*Template)/i.test(importedName);
      const isRenderController =
        renderControllers.has(localName) && hostControllers.has(localName);
      if (isSuperclass || isRenderHelper || isRenderController) {
        targets.set(target, targets.get(target) || isRenderController);
      }
    }
  }
  // Only an annotated host-bound controller may contribute a lazy painting module. A component
  // can also lazy-load unrelated children, whose parts must not satisfy its own manifest contract.
  if (allowDynamicImports) {
    for (const specifier of dynamicImportSpecifiers(parsed.program)) {
      const target = resolveSibling(modulePath, specifier, sources);
      if (target && !/(?:^|\.)styles\.ts$/.test(target)) {
        targets.set(target, targets.get(target) || false);
      }
    }
  }
  return targets;
}

/**
 * Returns only source that can contribute to a component's own rendered surface: its class module,
 * relative superclasses, explicitly invoked render helpers, annotated host-bound controllers,
 * and literal dynamic imports from annotated host-bound controllers.
 * A controller's @renderController comment names its local value import and requires an actual
 * new Controller(this, ...) expression. Stylesheets, registered child
 * classes, and unrelated siblings are deliberately excluded so selector text cannot satisfy a
 * documented `@csspart` contract.
 */
export function renderSurfaceFor(modulePath, sources) {
  const seen = new Set();
  const addedSources = new Set();
  const reachableSources = [];

  const visit = (currentPath, allowDynamicImports = false) => {
    const modeKey = `${currentPath}\0${allowDynamicImports}`;
    if (seen.has(modeKey)) return;
    seen.add(modeKey);
    const source = sources.get(currentPath);
    if (source === undefined) return;
    if (!addedSources.has(currentPath)) {
      addedSources.add(currentPath);
      reachableSources.push(source);
    }
    for (const [target, isRenderController] of moduleEdges(currentPath, source, sources, allowDynamicImports))
      visit(target, isRenderController);
  };

  visit(modulePath);
  return reachableSources.join("\n");
}

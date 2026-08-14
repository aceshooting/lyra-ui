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

function moduleEdges(modulePath, source, sources) {
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
  const targets = new Set();

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
      if (isSuperclass || isRenderHelper) targets.add(target);
    }
  }
  return targets;
}

/**
 * Returns only source that can contribute to a component's own rendered surface: its class module,
 * relative superclasses, and explicitly invoked render helpers. Stylesheets, registered child
 * classes, and unrelated siblings are deliberately excluded so selector text cannot satisfy a
 * documented `@csspart` contract.
 */
export function renderSurfaceFor(modulePath, sources) {
  const seen = new Set();
  const reachableSources = [];

  const visit = (currentPath) => {
    if (seen.has(currentPath)) return;
    seen.add(currentPath);
    const source = sources.get(currentPath);
    if (source === undefined) return;
    reachableSources.push(source);
    for (const target of moduleEdges(currentPath, source, sources))
      visit(target);
  };

  visit(modulePath);
  return reachableSources.join("\n");
}

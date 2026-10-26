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

function nodesMatching(node, predicate, matches = []) {
  if (!node || typeof node !== "object") return matches;
  if (predicate(node)) matches.push(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) for (const child of value) nodesMatching(child, predicate, matches);
    else if (value && typeof value === "object") nodesMatching(value, predicate, matches);
  }
  return matches;
}

function patternBinds(pattern, name) {
  if (!pattern) return false;
  if (pattern.type === "Identifier") return pattern.name === name;
  if (pattern.type === "RestElement") return patternBinds(pattern.argument, name);
  if (pattern.type === "AssignmentPattern") return patternBinds(pattern.left, name);
  if (pattern.type === "ArrayPattern") return pattern.elements.some(item => patternBinds(item, name));
  if (pattern.type === "ObjectPattern") return pattern.properties.some(item =>
    patternBinds(item.type === "RestElement" ? item.argument : item.value, name));
  return false;
}

function lexicalNodes(node, predicate, matches = []) {
  if (!node || typeof node !== "object") return matches;
  if (predicate(node)) matches.push(node);
  if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression", "ClassDeclaration", "ClassExpression"].includes(node.type)) return matches;
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) for (const child of value) lexicalNodes(child, predicate, matches);
    else if (value && typeof value === "object") lexicalNodes(value, predicate, matches);
  }
  return matches;
}

function bodyShadows(body, name) {
  return lexicalNodes(body, node =>
    node.type === "VariableDeclarator" && patternBinds(node.id, name) ||
    ["FunctionDeclaration", "ClassDeclaration"].includes(node.type) && node.id?.name === name ||
    node.type === "CatchClause" && patternBinds(node.param, name) ||
    node.type === "AssignmentExpression" && patternBinds(node.left, name) ||
    node.type === "UpdateExpression" && patternBinds(node.argument, name)).length > 0;
}

function callsImportedIdentifier(program, name) {
  let found = false;
  const visit = (node, shadowed = false) => {
    if (!node || typeof node !== "object" || found) return;
    if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type)) {
      shadowed ||= node.id?.name === name || node.params.some(parameter => patternBinds(parameter, name)) || bodyShadows(node.body, name);
    }
    if (["BlockStatement", "SwitchStatement"].includes(node.type)) {
      shadowed ||= bodyShadows(node, name);
    }
    if (node.type === "CatchClause") shadowed ||= patternBinds(node.param, name);
    if (["ForStatement", "ForInStatement", "ForOfStatement"].includes(node.type)) {
      shadowed ||= bodyShadows(node.init ?? node.left, name);
    }
    if (!shadowed && node.type === "CallExpression" && node.callee?.type === "Identifier" && node.callee.name === name) found = true;
    for (const [key, value] of Object.entries(node)) {
      if (key === "parent") continue;
      if (Array.isArray(value)) for (const child of value) visit(child, shadowed);
      else if (value && typeof value === "object") visit(value, shadowed);
    }
  };
  visit(program);
  return found;
}

function hasTemplateExport(modulePath, source, importedName) {
  if (!/\b(?:html|staticHtml|svg|mathml)\s*`/.test(source)) return false;
  const parsed = parseSync(modulePath, source, { lang: "ts", sourceType: "module" });
  if (parsed.errors.length) return false;
  for (const statement of parsed.program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    const declaration = statement.declaration;
    const functions = declaration?.type === "FunctionDeclaration" && declaration.id?.name === importedName
      ? [declaration]
      : declaration?.type === "VariableDeclaration"
        ? declaration.declarations.filter(item => item.id?.name === importedName &&
          ["ArrowFunctionExpression", "FunctionExpression"].includes(item.init?.type)).map(item => item.init)
        : [];
    if (functions.some(fn => lexicalNodes(fn.body, node => node.type === "TaggedTemplateExpression" &&
      node.tag?.type === "Identifier" && /^(?:html|staticHtml|svg|mathml)$/.test(node.tag.name)).length)) return true;
  }
  return false;
}

// Recognize the literal loader -> destructured export -> typed factory -> new Parameter(this)
// chain. An annotation or type-only import alone does not establish a render surface.
function lazyHostController(program, specifier, importedName, localType) {
  return nodesMatching(program, node => node.type === "ClassDeclaration" || node.type === "ClassExpression")
    .some(node => classLazyHostController(node, specifier, importedName, localType));
}

function classLazyHostController(program, specifier, importedName, localType) {
  const methods = program.body.body.filter(node => node.type === "MethodDefinition" && node.key?.type === "Identifier");
  const loaders = new Set(methods.filter(method => method.value?.body?.body.some(statement =>
    statement.type === "ReturnStatement" && statement.argument?.type === "ImportExpression" &&
    statement.argument.source?.value === specifier)).map(method => method.key.name));
  if (!loaders.size) return false;
  const ownCall = node => node?.type === "CallExpression" && node.callee?.type === "MemberExpression" &&
    node.callee.object?.type === "ThisExpression" && !node.callee.computed;
  const factories = new Map();
  for (const method of methods) {
    for (const [index, parameter] of (method.value?.params ?? []).entries()) {
      if (parameter.type !== "Identifier" || parameter.typeAnnotation?.typeAnnotation?.type !== "TSTypeQuery" ||
        parameter.typeAnnotation.typeAnnotation.exprName?.name !== localType) continue;
      if (!bodyShadows(method.value.body, parameter.name) && lexicalNodes(method.value.body, node => node.type === "NewExpression" &&
        node.callee?.type === "Identifier" && node.callee.name === parameter.name &&
        node.arguments?.[0]?.type === "ThisExpression").length) factories.set(method.key.name, index);
    }
  }
  for (const then of methods.flatMap(method => lexicalNodes(method.value.body, node => node.type === "CallExpression" &&
    node.callee?.type === "MemberExpression" && !node.callee.computed && node.callee.property?.name === "then"))) {
    const load = then.callee.object;
    if (!ownCall(load) || !loaders.has(load.callee.property?.name)) continue;
    const callback = then.arguments?.[0];
    if (callback?.type !== "ArrowFunctionExpression" || callback.params?.[0]?.type !== "ObjectPattern") continue;
    const binding = callback.params[0].properties.find(property => property.type === "Property" &&
      !property.computed && property.key?.name === importedName && property.value?.type === "Identifier");
    if (!binding || bodyShadows(callback.body, binding.value.name)) continue;
    if (lexicalNodes(callback.body, node => ownCall(node) && factories.has(node.callee.property?.name) &&
      node.arguments[factories.get(node.callee.property.name)]?.type === "Identifier" &&
      node.arguments[factories.get(node.callee.property.name)].name === binding.value.name).length) return true;
  }
  return false;
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
    if (statement.type !== "ImportDeclaration") continue;
    const target = resolveSibling(modulePath, statement.source.value, sources);
    if (!target || /(?:^|\.)styles\.ts$/.test(target)) continue;

    for (const specifier of statement.specifiers) {
      const typeOnly = statement.importKind === "type" || specifier.importKind === "type";
      const localName = specifier.local?.name;
      if (!localName) continue;
      const importedName =
        specifier.type === "ImportSpecifier"
          ? specifier.imported?.name ?? specifier.imported?.value ?? localName
          : localName;
      const isLazyController = renderControllers.has(localName) &&
        lazyHostController(parsed.program, statement.source.value, importedName, localName);
      if (typeOnly && !isLazyController) continue;
      const isSuperclass = !typeOnly && superclassIdentifiers.has(localName);
      const isRenderHelper =
        !typeOnly && calls.has(localName) &&
        (/^(?:render|create[A-Za-z0-9_$]*Template)/i.test(importedName) ||
          callsImportedIdentifier(parsed.program, localName) && hasTemplateExport(target, sources.get(target), importedName));
      const isRenderController =
        isLazyController || (!typeOnly && renderControllers.has(localName) && hostControllers.has(localName));
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
 * new Controller(this, ...) expression, directly or through a literal lazy loader and typed factory.
 * Invoked exports with an actual markup template body also contribute helper surfaces.
 * Stylesheets, registered child
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

/** Literal DOMTokenList part sinks; dynamic names and non-part token lists supply no evidence. */
export function literalDOMPartNames(source) {
  const parsed = parseSync('render-surface.ts', source, { lang: "ts", sourceType: "module" });
  const names = new Set();
  if (parsed.errors.length) return names;
  for (const call of nodesMatching(parsed.program, node => node.type === "CallExpression")) {
    const method = call.callee;
    const part = method?.object;
    if (method?.type !== "MemberExpression" || method.computed ||
      !["add", "toggle"].includes(method.property?.name) ||
      part?.type !== "MemberExpression" || part.computed || part.property?.name !== "part") continue;
    if (method.property.name === "toggle" && call.arguments[1]?.type === "Literal" &&
      call.arguments[1].value === false) continue;
    const args = method.property.name === "toggle" ? call.arguments.slice(0, 1) : call.arguments;
    for (const argument of args) {
      if (argument.type === "Literal" && typeof argument.value === "string" &&
        /^[A-Za-z0-9_-]+$/.test(argument.value)) names.add(argument.value);
    }
  }
  return names;
}

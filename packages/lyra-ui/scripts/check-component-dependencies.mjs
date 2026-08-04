#!/usr/bin/env node
// Component-dependency checker: every `<lr-*>` element a component renders into its own shadow
// root must be *registered* by that component's registration entry, reachable through the entry's
// own transitive imports.
// The bug this catches, in the exact shape it shipped in (`tool-result-view`, 8.0.0):
//   tool-result-view.class.ts   import '../../utility/copy-button/copy-button.class.js';  // pure
//                               ... html`<lr-copy-button part="fallback-copy">`
//   tool-result-view.ts         import '../../utility/json-viewer/json-viewer.js';
//                               import '../../overlays/skeleton/skeleton.js';
//                               // <- no copy-button.js
// The class module deliberately imports the side-effect-FREE `*.class.js` (that split is what
// makes the package tree-shakeable), so nothing in the graph ever calls `defineElement('copy-
// button', ...)`. A consumer taking the granular import path the package actively recommends --
// `import '@aceshooting/lyra-ui/dist/components/agent-tools/tool-result-view/tool-result-view.js'`
// -- then gets an un-upgraded `<lr-copy-button>`: no error, no warning, an inert element that
// renders as an empty inline box. The root barrel (`lyra.js`) imports every registration entry, so
// it hides the defect completely -- including from a colocated `*.test.ts` that imports only its
// own `./<name>.js` and asserts on `[part]` attributes rather than on upgrade.
// Why not Shoelace's `static dependencies = []`: that pattern requires every class module to
// reference its dependencies' *registration* side effects, which is precisely what this package's
// side-effect-free class/registration split exists to avoid. The explicit
// `import '<dep>/<dep>.js'` line in the registration entry is the intended model; this gate makes
// its absence loud instead of silent.
// What counts as "rendered": an `<lr-*>` start tag inside an `html` / `staticHtml` / `svg` tagged
// template literal, plus the `unsafeStatic(tag('name'))` indirection used for the generated
// submenu panel (`menu-item`, `dropdown`). Comments and plain string literals are excluded, so a
// tag named in JSDoc or in a `localName === '<lr-x>'` comparison never counts. Names assembled at
// runtime and elements created through `document.createElement()` are not known to this check.
// What counts as "registered": the registration entry's transitive import closure -- static
// imports, `export ... from` re-exports, AND lazy `import()` calls (`phone-input` registers
// `<lr-flag>` that way on purpose; the rendered element upgrades in place when it resolves).
// Which renders are attributed to an entry: the class module of every tag the entry registers,
// plus that class module's non-component helper modules, plus any superclass class module it
// `extends` (`dropdown-item` inherits `menu-item`'s generated `<lr-menu>` submenu).
// Suppression, for the rare pair that cannot import each other:
//   policy-allow(component-dependency: lr-menu): specific reason
// in the registration entry. A reason is mandatory, and a suppression that no longer silences a
// finding is itself reported, so the list cannot rot.
// Run directly: `node scripts/check-component-dependencies.mjs`. Wired into
// `pnpm run contract-policy`.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(packageDir, 'src');
const inventoryPath = path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');

// ---------------------------------------------------------------------------
// Template scanning
// ---------------------------------------------------------------------------

/** Template tags whose literal body is markup. */
const MARKUP_TAG = /(?:^|\.)(?:html|staticHtml|svg|mathml)$/;

/**
 * The literal (non-interpolated) text of every markup-tagged template literal in `source`.
 *
 * A hand-rolled scanner rather than a regex because the interesting shapes are all nested: an
 * `html` template inside a `${}` hole inside another `html` template, a backtick inside a string
 * literal, an escaped backtick inside markup. Holes are replaced by a space, so a tag name that
 * only ever appears inside one (`${kind === '<lr-badge>' ? ... }`) is not markup -- a nested
 * `html` template inside that hole is still collected as its own chunk.
 */
export function htmlTemplateChunks(source) {
  const chunks = [];
  const stack = [];
  let buffer = null;
  let state = 'code';
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const pair = source.slice(i, i + 2);
    if (state === 'code') {
      if (pair === '//') {
        state = 'line';
        i++;
      } else if (pair === '/*') {
        state = 'block';
        i++;
      } else if (char === "'") state = 'single';
      else if (char === '"') state = 'double';
      else if (char === '`') {
        let start = i - 1;
        while (start >= 0 && /\s/.test(source[start])) start--;
        const end = start + 1;
        while (start >= 0 && /[A-Za-z0-9_$.]/.test(source[start])) start--;
        stack.push({ kind: 'template' });
        if (buffer === null && MARKUP_TAG.test(source.slice(start + 1, end))) {
          buffer = { depth: stack.length, text: '' };
        }
        state = 'template';
      } else if (char === '{' && stack.length > 0 && stack[stack.length - 1].kind === 'hole') {
        stack[stack.length - 1].braces++;
      } else if (char === '}' && stack.length > 0 && stack[stack.length - 1].kind === 'hole') {
        if (--stack[stack.length - 1].braces === 0) {
          stack.pop();
          state = 'template';
        }
      }
    } else if (state === 'line') {
      if (char === '\n') state = 'code';
    } else if (state === 'block') {
      if (pair === '*/') {
        state = 'code';
        i++;
      }
    } else if (state === 'single' || state === 'double') {
      if (char === '\\') i++;
      else if ((state === 'single' && char === "'") || (state === 'double' && char === '"')) state = 'code';
    } else if (state === 'template') {
      if (char === '\\') {
        if (buffer) buffer.text += ' ';
        i++;
      } else if (pair === '${') {
        stack.push({ kind: 'hole', braces: 1 });
        if (buffer) buffer.text += ' ';
        state = 'code';
        i++;
      } else if (char === '`') {
        stack.pop();
        if (buffer !== null && stack.length < buffer.depth) {
          chunks.push(buffer.text);
          buffer = null;
        }
        state = stack.length > 0 && stack[stack.length - 1].kind === 'template' ? 'template' : 'code';
      } else if (buffer) buffer.text += char;
    }
  }
  return chunks;
}

/** Every `lr-*` tag `source` renders, from markup templates and `unsafeStatic(tag('x'))` bindings. */
export function renderedTags(source) {
  const tags = new Set();
  for (const chunk of htmlTemplateChunks(source)) {
    for (const match of chunk.matchAll(/<(lr-[a-z0-9]+(?:-[a-z0-9]+)*)[\s/>]/g)) tags.add(match[1]);
  }
  // `const menuTag = unsafeStatic(tag('menu'))` -- the prefix-aware indirection a static template
  // interpolates as its tag name. Only counted when the module also renders a static template.
  if (/\bstaticHtml`|\bhtml`/.test(source)) {
    for (const match of source.matchAll(/unsafeStatic\(\s*tag\(\s*['"]([a-z0-9-]+)['"]\s*\)\s*\)/g)) {
      tags.add(`lr-${match[1]}`);
    }
  }
  return tags;
}

// ---------------------------------------------------------------------------
// Module graph
// ---------------------------------------------------------------------------

function parseSource(source, file = 'component.ts') {
  const result = parseSync(file, source);
  if (result.errors.length > 0) {
    const detail = result.errors
      .slice(0, 3)
      .map((error) => error.message)
      .join('; ');
    throw new Error(`${file}: component-dependency parser failed: ${detail}`);
  }
  return result.program;
}

/** Visit every ESTree-compatible node below `node`, including TypeScript-specific nodes. */
function visitNodes(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'type' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) visitNodes(child, visitor);
    } else if (value && typeof value === 'object') visitNodes(value, visitor);
  }
}

/** `[{ specifier, bindings }]` for every runtime module `source` pulls in, lazily or eagerly. */
function moduleImports(source, file) {
  const imports = [];
  const program = parseSource(source, file);
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration' && typeof statement.source?.value === 'string') {
      if (statement.importKind === 'type') continue;
      const values = statement.specifiers.filter(
        (specifier) => specifier.type !== 'ImportSpecifier' || specifier.importKind !== 'type',
      );
      // An empty import (`import './x.js'` or `import {} from './x.js'`) still evaluates the
      // target. A declaration containing only `type` specifiers is erased by TypeScript.
      if (statement.specifiers.length > 0 && values.length === 0) continue;
      imports.push({
        specifier: statement.source.value,
        bindings: values.map((specifier) => specifier.local?.name).filter(Boolean),
      });
    } else if (
      (statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportAllDeclaration') &&
      typeof statement.source?.value === 'string'
    ) {
      if (statement.exportKind === 'type') continue;
      if (
        statement.type === 'ExportNamedDeclaration' &&
        statement.specifiers.length > 0 &&
        statement.specifiers.every((specifier) => specifier.exportKind === 'type')
      ) continue;
      imports.push({ specifier: statement.source.value, bindings: [] });
    }
  }

  visitNodes(program, (node) => {
    if (node.type !== 'ImportExpression') return;
    if (node.source?.type === 'Literal' && typeof node.source.value === 'string') {
      imports.push({ specifier: node.source.value, bindings: [] });
    } else if (
      node.source?.type === 'TemplateLiteral' &&
      node.source.expressions.length === 0 &&
      node.source.quasis.length === 1
    ) {
      imports.push({ specifier: node.source.quasis[0].value.cooked, bindings: [] });
    }
  });
  return imports;
}

/** Identifiers this module extends, so a superclass's renders reach the subclass's entry. */
function extendedNames(source, file) {
  const names = new Set();
  visitNodes(parseSource(source, file), (node) => {
    if (
      (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') &&
      node.superClass?.type === 'Identifier'
    ) names.add(node.superClass.name);
  });
  return names;
}

/** Resolve a relative specifier against the virtual file map (`.js` -> `.ts`, plus `/index.ts`). */
function resolveSpecifier(files, fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = base.endsWith('.js')
    ? [base.replace(/\.js$/, '.ts')]
    : [base, `${base}.ts`, path.posix.join(base, 'index.ts')];
  for (const candidate of candidates) if (files.has(candidate)) return candidate;
  return null;
}

/** The `import '...'` specifier an entry would write to reach `target`, always explicitly relative. */
function relativeSpecifier(fromFile, target) {
  const specifier = path.posix.relative(path.posix.dirname(fromFile), target).replace(/\.ts$/, '.js');
  return specifier.startsWith('.') ? specifier : `./${specifier}`;
}

const SUPPRESSION = /policy-allow\(component-dependency:\s*([a-z0-9-]+)\s*\)\s*:([^\n]*)/g;

/** `Map<tag, reason>` of the suppressions declared in a registration entry. */
function suppressionsIn(source) {
  const declared = new Map();
  for (const match of source.matchAll(SUPPRESSION)) declared.set(match[1], match[2].trim());
  return declared;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Findings plus deterministic direct/transitive registration edges for every public tag.
 *
 * @param {{ components: Array<{tag: string, classModule: string, registrationModule: string}>,
 *           files: Map<string, string> }} input
 * @returns {{findings: string[], graph: Array<{tag: string, classModule: string,
 *   registrationModule: string, directComponents: string[], transitiveComponents: string[]}>}}
 */
export function analyzeComponentDependencies({ components, files }) {
  const byTag = new Map(components.map((component) => [component.tag, component]));
  const classModules = new Set(components.map((component) => component.classModule));
  const registrationByModule = new Map(components.map((component) => [component.registrationModule, component.tag]));
  const source = (file) => files.get(file) ?? '';

  // Every entry walks a large slice of the same graph, so the per-file scans are memoized.
  const importCache = new Map();
  const importsOf = (file) => {
    if (!importCache.has(file)) importCache.set(file, moduleImports(source(file), file));
    return importCache.get(file);
  };
  const tagCache = new Map();
  const tagsIn = (file) => {
    if (!tagCache.has(file)) tagCache.set(file, renderedTags(source(file)));
    return tagCache.get(file);
  };
  const extendsCache = new Map();
  const extendsIn = (file) => {
    if (!extendsCache.has(file)) extendsCache.set(file, extendedNames(source(file), file));
    return extendsCache.get(file);
  };
  const targetCache = new Map();
  const targetOf = (file, specifier) => {
    const key = `${file}\0${specifier}`;
    if (!targetCache.has(key)) targetCache.set(key, resolveSpecifier(files, file, specifier));
    return targetCache.get(key);
  };

  /** Every module reachable from `entry`, following eager and lazy relative imports alike. */
  function importClosure(entry) {
    const seen = new Set([entry]);
    const queue = [entry];
    while (queue.length > 0) {
      const file = queue.pop();
      for (const { specifier } of importsOf(file)) {
        const resolved = targetOf(file, specifier);
        if (!resolved || seen.has(resolved)) continue;
        seen.add(resolved);
        queue.push(resolved);
      }
    }
    return seen;
  }

  const renderCache = new Map();
  /**
   * The tags a component's own rendering produces: its class module, that module's non-component
   * helpers, and any superclass class module it extends. Another component's class module is not
   * traversed -- that component registers its own dependencies through its own entry.
   */
  function renderedTagsFor(classModule) {
    if (renderCache.has(classModule)) return renderCache.get(classModule);
    const tags = new Set();
    renderCache.set(classModule, tags);
    const seen = new Set([classModule]);
    const queue = [classModule];
    while (queue.length > 0) {
      const file = queue.pop();
      for (const tag of tagsIn(file)) tags.add(tag);
      const extended = extendsIn(file);
      for (const { specifier, bindings } of importsOf(file)) {
        const resolved = targetOf(file, specifier);
        if (!resolved || seen.has(resolved)) continue;
        const isComponentModule = classModules.has(resolved) || registrationByModule.has(resolved);
        if (isComponentModule && !bindings.some((binding) => extended.has(binding))) continue;
        seen.add(resolved);
        queue.push(resolved);
      }
    }
    return tags;
  }

  const findings = [];
  const graph = [];
  for (const component of components) {
    const entry = component.registrationModule;
    if (!files.has(entry)) {
      findings.push(`${component.tag}: [component-dependency] registration entry ${entry} does not exist`);
      continue;
    }
    const closure = importClosure(entry);
    const registered = new Set();
    for (const file of closure) {
      const tag = registrationByModule.get(file);
      if (tag) registered.add(tag);
    }

    // tag -> the registered component whose rendering needs it (the entry's own tag wins, so the
    // message names the direct culprit rather than an arbitrary transitive one).
    const required = new Map();
    // The entry itself, plus any non-component helper it pulls in directly (`*-register.ts` and
    // the shared `*-shared.ts` modules both render markup of their own).
    for (const rendered of renderedTagsFor(entry)) required.set(rendered, component.tag);
    for (const tag of [component.tag, ...[...registered].sort()]) {
      const dependency = byTag.get(tag);
      if (!dependency || !registered.has(tag)) continue;
      for (const rendered of renderedTagsFor(dependency.classModule)) {
        if (!required.has(rendered)) required.set(rendered, tag);
      }
    }

    const suppressions = suppressionsIn(source(entry));
    const silenced = new Set();
    for (const tag of [...required.keys()].sort()) {
      if (registered.has(tag)) continue;
      const target = byTag.get(tag);
      const renderer = required.get(tag);
      const via = renderer === component.tag ? '' : ` (through <${renderer}>, which it registers)`;
      if (suppressions.has(tag)) {
        silenced.add(tag);
        if (suppressions.get(tag).length === 0) {
          findings.push(
            `${entry}: [component-dependency] policy-allow(component-dependency: ${tag}) needs a reason`,
          );
        }
        continue;
      }
      findings.push(
        target
          ? `${entry}: [component-dependency] ${component.tag} renders <${tag}>${via} but its registration entry ` +
            `never registers it -- a consumer importing only this module gets an inert, never-upgrading element. ` +
            `Add import '${relativeSpecifier(entry, target.registrationModule)}'; (the side-effect-free ` +
            `${path.posix.basename(target.classModule).replace(/\.ts$/, '.js')} does not register anything)`
          : `${entry}: [component-dependency] ${component.tag} renders <${tag}>${via}, an unknown component tag -- ` +
            `fix the tag name or add the component to the inventory`,
      );
    }
    for (const [tag, reason] of suppressions) {
      if (silenced.has(tag)) continue;
      findings.push(
        `${entry}: [component-dependency] unused suppression policy-allow(component-dependency: ${tag})` +
          `${reason ? ` ("${reason}")` : ''} -- <${tag}> is either registered or never rendered; delete the comment`,
      );
    }
    const directRegistered = importsOf(entry)
      .map(({ specifier }) => targetOf(entry, specifier))
      .map((file) => registrationByModule.get(file))
      .filter(Boolean);
    const directlyRendered = [...required]
      .filter(([, renderer]) => renderer === component.tag)
      .map(([tag]) => tag);
    const directComponents = [...new Set([...directlyRendered, ...directRegistered])]
      .filter((tag) => tag !== component.tag && byTag.has(tag))
      .sort();
    const directSet = new Set(directComponents);
    const transitiveComponents = [...registered]
      .filter((tag) => tag !== component.tag && !directSet.has(tag))
      .sort();
    graph.push({
      tag: component.tag,
      classModule: component.classModule,
      registrationModule: component.registrationModule,
      directComponents,
      transitiveComponents,
    });
  }
  return {
    findings: findings.sort(),
    graph: graph.sort((a, b) => a.tag.localeCompare(b.tag)),
  };
}

export function findMissingDependencies(input) {
  return analyzeComponentDependencies(input).findings;
}

// ---------------------------------------------------------------------------

/** Shipped source only: tests, stories and ambient declarations register nothing for consumers. */
export function collectSources(dir, files, sourcePackageDir = path.dirname(dir)) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSources(full, files, sourcePackageDir);
    else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.stories.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.set(path.relative(sourcePackageDir, full).replaceAll('\\', '/'), fs.readFileSync(full, 'utf8'));
    }
  }
  return files;
}

function run() {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const components = inventory.components.map(({ tag, classModule, registrationModule }) => ({
    tag,
    classModule,
    registrationModule,
  }));
  const files = collectSources(srcRoot, new Map());
  const findings = findMissingDependencies({ components, files });

  if (findings.length > 0) {
    console.error(`Component dependencies failed with ${findings.length} finding(s):`);
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
  } else {
    console.log(`Component dependencies passed: ${components.length} registration entries checked.`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) run();

export { run };


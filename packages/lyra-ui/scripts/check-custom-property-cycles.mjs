import { isMainModule } from './is-main-module.mjs';

// Flags a `var()` custom-property cycle in a component's OWN composed stylesheet, the shape a
// scope-flattening CSS custom-property resolver (happy-dom, at least through 20.14.5) trips on.
// The consumer-facing background is in llms/shared.md's happy-dom section.
//
// A real, per-shadow-scoped browser never sees this as a cycle: `:host` and a `[part]`/class-scoped
// descendant resolve on different elements, so `:host`'s declaration is a concrete value BY THE TIME
// the descendant's declaration reads it, in top-down document order. happy-dom instead merges every
// element's declarations for the whole document into one flat name -> value map with no notion of
// which element declared what, so a component that (a) derives a private token FROM a public one on
// `:host`, and ALSO (b) re-declares that SAME public token FROM the private one on a descendant,
// creates a genuine two-node cycle in that flattened map: resolving the public name requires
// resolving the private one, which requires resolving the public one again, forever.
//
// This checker models exactly that flattening, PER STYLESHEET FILE (the granularity the real defect
// lives at: the capture and the re-declaration are always two rules in the same `*.styles.ts` file).
// It parses every `--custom-property: <value>;` declaration in the file regardless of which selector
// it sits under -- exactly the "no notion of which element declared what" merge happy-dom performs
// -- builds a directed graph from each declaration's name to every `--other-property` referenced
// inside its value (via `var(--other-property, ...)`), and reports any name reachable from itself.
//
// A regular CSS property's own `var()` usage (e.g. `background: var(--lr-icon-button-background)`)
// is never a graph NODE -- only `--`-prefixed custom-property DECLARATIONS are, matching what a
// flattened resolver actually recurses through. A name referenced but never declared in the same
// file (an ordinary design token, or a public token nothing in this file re-declares) is a graph
// leaf: a reference to it can never be part of a cycle here.
//
// Run: node scripts/check-custom-property-cycles.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const componentsRoot = join(packageDir, 'src', 'components');
const internalRoot = join(packageDir, 'src', 'internal');

export function styleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return styleFiles(file);
    return entry.name.endsWith('.styles.ts') ? [file] : [];
  });
}

/**
 * The concatenated contents of every `` css`...` `` tagged template literal in a `.styles.ts`
 * FILE's raw source text, skipping everything outside them -- the `import`, the surrounding TS/JS
 * `//` comments (which routinely quote a `--token: value` example, like
 * `internal/tokens.styles.ts`'s own `MASK_OPAQUE` note above), and the `export const styles =`
 * wrapper. Scanning the whole file instead of just its template contents mistook a commented-out
 * example for a real declaration on first run: `--lr-theme-color-shadow` is never actually declared
 * anywhere, but a `// (--lr-theme-color-shadow: rgb(0 0 0 / 0.25))` prose aside, followed much later
 * by an unrelated `;`, glued into a fake self-referential "declaration" wide enough to swallow real
 * code between them. Only `/* *\/`-style comments are legal INSIDE a real `css` template (a `//`
 * inside one is a syntax error the moment it reaches a real stylesheet), so this scan need only
 * worry about them once template extraction has already dropped the TS-comment surroundings.
 * Handles more than one `css` template per file and a `\`` escape inside one, though neither occurs
 * in this codebase today.
 *
 * @param {string} fileText
 * @returns {string}
 */
export function cssTemplateContents(fileText) {
  const contents = [];
  const templateStart = /\bcss`/g;
  let match;
  while ((match = templateStart.exec(fileText))) {
    let index = templateStart.lastIndex;
    while (index < fileText.length) {
      if (fileText[index] === '\\') {
        index += 2;
        continue;
      }
      if (fileText[index] === '`') break;
      index += 1;
    }
    contents.push(fileText.slice(templateStart.lastIndex, index));
    templateStart.lastIndex = index + 1;
  }
  return contents.join('\n');
}

/**
 * Every `--custom-property: value;` declaration in `cssText`, wherever it sits (any selector, any
 * nesting depth) -- the flattening a scope-unaware resolver performs ignores selectors entirely.
 * Comments are blanked first so a documented example inside a `/* ... *\/` block is not mistaken for
 * a real declaration. Paren depth is tracked so a `color-mix(in oklab, ...)` argument's own `;`-free
 * commas never terminate the declaration early, and the declaration's own value is scanned character
 * by character rather than with a single greedy regex, so nested `var(--a, var(--b, --c))` chains are
 * captured whole.
 *
 * @param {string} cssText
 * @returns {{name: string, value: string}[]}
 */
export function customPropertyDeclarations(cssText) {
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const declarations = [];
  const nameRe = /(--[a-zA-Z0-9-_]+)\s*:/g;
  let match;
  while ((match = nameRe.exec(stripped))) {
    const name = match[1];
    let index = nameRe.lastIndex;
    let depth = 0;
    const start = index;
    for (; index < stripped.length; index += 1) {
      const char = stripped[index];
      if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      else if (depth === 0 && (char === ';' || char === '}')) break;
    }
    declarations.push({ name, value: stripped.slice(start, index).trim() });
    nameRe.lastIndex = index;
  }
  return declarations;
}

/** Every `--other-property` name referenced anywhere inside a declaration's value text. */
export function referencedProperties(value) {
  const names = new Set();
  for (const match of value.matchAll(/var\(\s*(--[a-zA-Z0-9-_]+)/g)) names.add(match[1]);
  return names;
}

/**
 * `Map<propertyName, Set<referencedPropertyName>>` for one stylesheet's flattened declarations. A
 * name declared more than once (a size-ladder tier, a state override) unions the edges from every
 * declaration -- any one of them existing is enough for a flattened resolver to wire up the cycle.
 *
 * @param {{name: string, value: string}[]} declarations
 */
export function dependencyGraph(declarations) {
  const graph = new Map();
  for (const { name, value } of declarations) {
    if (!graph.has(name)) graph.set(name, new Set());
    const edges = graph.get(name);
    for (const referenced of referencedProperties(value)) edges.add(referenced);
  }
  return graph;
}

/**
 * The first cycle found in `graph`, as an array of property names from the cycle's start back to
 * itself, or `null` if the graph is acyclic. Plain DFS with a three-colour visited set; the graph is
 * small (a handful of nodes per stylesheet) so no need for anything fancier.
 *
 * @param {Map<string, Set<string>>} graph
 * @returns {string[] | null}
 */
export function findCycle(graph) {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map();
  const path = [];

  function visit(node) {
    color.set(node, GRAY);
    path.push(node);
    for (const next of graph.get(node) ?? []) {
      const state = color.get(next) ?? WHITE;
      if (state === GRAY) {
        const cycleStart = path.indexOf(next);
        return [...path.slice(cycleStart), next];
      }
      if (state === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }
    path.pop();
    color.set(node, BLACK);
    return null;
  }

  for (const node of graph.keys()) {
    if ((color.get(node) ?? WHITE) !== WHITE) continue;
    const found = visit(node);
    if (found) return found;
  }
  return null;
}

/** The first custom-property `var()` cycle a flattened resolver would hit in `cssText`, or `null`. */
export function findTokenCycle(cssText) {
  return findCycle(dependencyGraph(customPropertyDeclarations(cssText)));
}

if (isMainModule(import.meta.url)) {
  const files = [...styleFiles(componentsRoot), ...styleFiles(internalRoot)].sort();
  const findings = [];
  for (const file of files) {
    const source = cssTemplateContents(readFileSync(file, 'utf8'));
    const cycle = findTokenCycle(source);
    if (cycle) {
      findings.push(`${relative(packageDir, file)}: ${cycle.join(' -> ')}`);
    }
  }
  if (files.length === 0) {
    console.error('Custom-property cycle contract matched ZERO stylesheets -- the file shape changed.');
    process.exitCode = 1;
  } else if (findings.length) {
    console.error(
      `Custom-property cycle contract failed with ${findings.length} cyclic stylesheet(s) out of ${files.length}:`,
    );
    for (const finding of findings) console.error(`- ${finding}`);
    console.error(
      '\nA rule must never re-declare a custom property from a private token that was itself derived ' +
        'from that same property, even on a different element: a scope-flattening resolver sees the ' +
        'pair as a cycle. To hand a composed child a contextual default, set a private default-tier ' +
        'token the child reads behind its public one -- the --_lr-icon-button-<token>-default tier in ' +
        'icon-button.styles.ts is the reference.',
    );
    process.exitCode = 1;
  } else {
    console.log(`Custom-property cycle contract passed: 0 cyclic stylesheet(s) out of ${files.length}.`);
  }
}

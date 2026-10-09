// RFC 0001/0002 invariant over the generated theme.css: a custom property declared ONLY on the
// document root may not reference, directly or through other root-only declarations, a name that
// some boundary or scope rule re-declares. var() is substituted where a property is declared, so
// such a value is frozen at :root and inherited into every boundary below it, where it disagrees
// with the name the boundary re-resolved (the default-look follower leak that shipped in 27).
// RFC 0001's single allowance is the mode-independent shadow colour inside shadow slots.
import { readDeclarations, splitTopLevel } from './css-declarations.mjs';

const ALLOWED = new Set(['--lr-theme-shadow-color']);
const ROOT_ONLY = /^(?::root|:where\(:root\))(?::where\([^)]*(?:\([^)]*\))*[^)]*\)|:not\([^)]*\))*$/;
const references = (value) => [...value.matchAll(/var\(\s*(--[_a-zA-Z0-9-]+)/g)].map((match) => match[1]);

/** Violations as `selector: --name -> --referenced` strings. */
export function rootResolvedReferenceViolations(css) {
  const rootOnly = new Map();
  const reDeclared = new Set();
  for (const declaration of readDeclarations(css)) {
    if (!declaration.property.startsWith('--') || !declaration.selector) continue;
    const selectors = splitTopLevel(declaration.selector, ',').map((selector) => selector.trim().replace(/\s+/g, ' '));
    if (selectors.every((selector) => ROOT_ONLY.test(selector))) {
      if (!rootOnly.has(declaration.property)) rootOnly.set(declaration.property, { selector: declaration.selector.trim(), refs: new Set() });
      for (const name of references(declaration.value)) rootOnly.get(declaration.property).refs.add(name);
    } else {
      reDeclared.add(declaration.property);
    }
  }
  const violations = [];
  for (const [name, { selector, refs }] of rootOnly) {
    const seen = new Set();
    const stack = [...refs];
    while (stack.length) {
      const ref = stack.pop();
      if (seen.has(ref) || ALLOWED.has(ref)) continue;
      seen.add(ref);
      if (reDeclared.has(ref)) violations.push(`${selector}: ${name} -> ${ref}`);
      else if (rootOnly.has(ref)) stack.push(...rootOnly.get(ref).refs);
    }
  }
  return violations;
}

/**
 * Custom properties theme.css declares on the document root (every element inherits them) and at a
 * bare `data-lr-theme-scope` marker (what one neutral scope re-evaluates), outside media and
 * feature conditions. These drive per-engine style cost; the budgets live in
 * document-token-layer.test.mjs.
 */
export function customPropertyCardinality(css) {
  const root = new Set();
  const marker = new Set();
  for (const declaration of readDeclarations(css)) {
    if (!declaration.property.startsWith('--') || !declaration.selector) continue;
    if (declaration.atRules.some((prelude) => /^@(?:media|supports)/.test(prelude))) continue;
    const selectors = splitTopLevel(declaration.selector, ',').map((selector) => selector.trim());
    if (selectors.some((selector) => /^(?::root|:where\(:root\))/.test(selector))) root.add(declaration.property);
    if (selectors.includes('[data-lr-theme-scope]')) marker.add(declaration.property);
  }
  return { root: root.size, marker: marker.size };
}

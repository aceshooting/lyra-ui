// Disposable spike: build three variants from a pristine copy of the built package. Never writes to
// the checkout it reads from.
//
//   A = dist-a/ exactly as built (every host declares the shared token layer on :host).
//   B = dist-b/ = copy of dist-a/ where
//       - the shared palette/tokens sheets keep only their non-custom-property declarations
//         (font-family/color/box-sizing on :host, the reduced-motion safety net, [hidden], box-sizing);
//       - every custom-property declaration from those two sheets moves into ONE document-level
//         constructed stylesheet (in the lr-theme cascade layer), with :host selectors mapped to
//         document scopes (:root, .lr-light/.lr-dark, [data-lr-theme], [dir=rtl]);
//       - LyraElement.connectedCallback adopts that sheet into its ownerDocument once (WeakSet).
//   C = dist-c/ = like B, but only properties whose every declaration is a literal in a plain :host
//       rule move (the colour ramp and the mask constant); everything else stays per host.
//   D = dist-d/ = like B, but the three host-local properties stay on :host (first proposal draft).
//   E = dist-e/ = the revised proposal (see buildE below): D, plus mode carried to every scope by two
//       inherited private switches instead of per-route dark rules; the user-preference arms
//       (forced colours, reduced motion) kept on every host as well; a closed scope list that also
//       covers design-tokens.css and the new [data-lr-theme-scope] marker; and adoption into the
//       shadow root of any host that is not a registered library component.
import { cpSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync, symlinkSync, lstatSync, renameSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// LYRA_CHECKOUT = root of a Lyra UI checkout whose package has been built (`pnpm build`).
// Nothing inside it is written: dist/ is copied, and node_modules is only symlinked for resolution.
const here = path.dirname(fileURLToPath(import.meta.url));
const checkout = path.resolve(process.env.LYRA_CHECKOUT ?? path.join(here, '..', 'lyra-ui'));
const pkgDir = path.join(checkout, 'packages/lyra-ui');
const hoisted = path.join(checkout, 'node_modules/.pnpm/node_modules');
const postcss = (await import(path.join(hoisted, 'postcss/lib/postcss.js'))).default;
const esbuild = await import(path.join(hoisted, 'esbuild/lib/main.js'));

const distA = path.join(here, 'dist-a');
const out = path.join(here, 'out');
// Release gate (28.0.0): A may come from a published tarball instead of the checkout
// (LYRA_BASELINE_DIST=<unpacked package>/dist), and `--candidate <dist>` adds variant I, the
// implementation exactly as built, with no rewriting.
const baselineDist = process.env.LYRA_BASELINE_DIST ? path.resolve(process.env.LYRA_BASELINE_DIST) : null;
/** A copied dist resolves the package's `#lyra-dev-*` imports through its own package.json. */
function writeImportsMap(dir) {
  const entry = (name) => ({ development: `./internal/${name}.development.js`, default: `./internal/${name}.production.js` });
  writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify({
    private: true,
    type: 'module',
    imports: { '#lyra-dev-warning': entry('dev-warning'), '#lyra-dev-attributes': entry('dev-mode-attribute-warning') },
  }, null, 2)}\n`);
}
const candidateArg = process.argv.indexOf('--candidate');
const candidateDist = candidateArg > 0 ? path.resolve(process.argv[candidateArg + 1]) : null;

if (process.argv.includes('--refresh') || !existsSync(distA)) {
  rmSync(distA, { recursive: true, force: true });
  cpSync(baselineDist ?? path.join(pkgDir, 'dist'), distA, { recursive: true });
  writeImportsMap(distA);
  const commit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const baselineVersion = baselineDist
    ? JSON.parse(readFileSync(path.join(baselineDist, '..', 'package.json'), 'utf8')).version
    : null;
  writeFileSync(path.join(here, 'SOURCE_COMMIT'), baselineVersion ? `A=npm:${baselineVersion} I=${commit}\n` : `${commit}\n`);
}
if (candidateDist) {
  rmSync(path.join(here, 'dist-i'), { recursive: true, force: true });
  cpSync(candidateDist, path.join(here, 'dist-i'), { recursive: true });
  writeImportsMap(path.join(here, 'dist-i'));
}
// Derived variants for the 28.0.0 gate (`--derived a2,i2,p,j`), built from dist-a / dist-i:
//   a2, i2  byte-identical copies of A and I under another name, for A/A calibration of the rule;
//   p       same-commit per-host delivery: I's code, with the whole layer back on every :host and
//           only the mode switches in the document (and no layer in theme.css), so the only
//           difference from I is where the layer is declared;
//   j       I plus automatic scopes for inline inputs (`[style*='--lr-theme-']` in every scope
//           list), the design review's recommendation 4, as an experiment only.
const derivedArg = process.argv.indexOf('--derived');
const DERIVED = derivedArg > 0 ? process.argv[derivedArg + 1].split(',').filter(Boolean) : [];
const GENERATED = 'internal/document-tokens.generated.js';
async function overrideGenerated(dist, overrides) {
  const file = path.join(dist, GENERATED);
  const original = path.join(dist, 'internal/document-tokens.generated.orig.js');
  renameSync(file, original);
  const values = await import(pathToFileURL(original).href);
  const body = Object.entries(overrides(values)).map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};`).join('\n');
  // A local export shadows the same name from `export *`.
  writeFileSync(file, `export * from './document-tokens.generated.orig.js';\n${body}\n`);
}
/** The layer's base block: every output, on the full scope list (outside the media arms). */
function layerBase(css) {
  const start = css.indexOf('\n:root,.lr-light,');
  if (start < 0) throw new Error('document layer base block not found');
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}
/** Removes the document layer from a built theme.css (compacted: no marker comment survives). */
function stripLayer(css) {
  const sentinel = css.indexOf('--_lr-document-tokens:');
  const start = css.lastIndexOf('@layer lr-base{', sentinel);
  if (sentinel < 0 || start < 0) throw new Error('theme.css carries no document layer');
  return css.slice(0, start);
}
const AUTO_SCOPE = (css) => css.replace(/(:where\(\[data-lr-look\]\)\s*\.dark)\s*\{/g, "$1,[style*='--lr-theme-']{");
for (const variant of DERIVED) {
  const source = path.join(here, variant === 'a2' ? 'dist-a' : 'dist-i');
  const dist = path.join(here, `dist-${variant}`);
  if (!existsSync(source)) throw new Error(`--derived ${variant} needs ${source}`);
  rmSync(dist, { recursive: true, force: true });
  cpSync(source, dist, { recursive: true });
  if (variant === 'p') {
    writeFileSync(path.join(dist, 'theme.css'), stripLayer(readFileSync(path.join(dist, 'theme.css'), 'utf8')));
    await overrideGenerated(dist, (v) => {
      const modes = v.DOCUMENT_TOKEN_CSS.match(/@layer lr-base\{[\s\S]*?\}\}\n/)?.[0];
      if (!modes) throw new Error('document layer mode rules not found');
      return {
        DOCUMENT_TOKEN_CSS: `@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;\n${modes}@layer lr-theme{\n:root{--_lr-document-tokens:lrperhost0000}\n}\n`,
        DOCUMENT_TOKEN_LAYER_ID: 'lrperhost0000',
        HOST_TOKEN_CSS: `:host{${layerBase(v.DOCUMENT_TOKEN_CSS)}}\n${v.HOST_TOKEN_CSS}`,
      };
    });
  } else if (variant === 'j') {
    for (const file of ['theme.css', 'styles/tokens-root.css']) writeFileSync(path.join(dist, file), AUTO_SCOPE(readFileSync(path.join(dist, file), 'utf8')));
    await overrideGenerated(dist, (v) => ({
      DOCUMENT_TOKEN_CSS: AUTO_SCOPE(v.DOCUMENT_TOKEN_CSS),
      DOCUMENT_TOKEN_SCOPE_SELECTOR: `${v.DOCUMENT_TOKEN_SCOPE_SELECTOR},[style*='--lr-theme-']`,
    }));
  }
}

try { lstatSync(path.join(here, 'node_modules')); } catch { symlinkSync(path.join(pkgDir, 'node_modules'), path.join(here, 'node_modules')); }

const { palette } = await import('./dist-a/internal/tokens/palette.styles.js');
const { tokens } = await import('./dist-a/internal/tokens.styles.js');

/** Split a selector list on top-level commas only. */
function splitSelectors(list) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { parts.push(list.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(list.slice(start).trim());
  return parts;
}

// Every scope that re-derives the whole resolved layer. A theme input set on one of these
// elements (or a mode switch on it) re-resolves every --lr-* token for its subtree.
const SCOPES = [':root', '.lr-light', '.lr-dark', '[data-lr-theme]'];

function mapHostSelector(selector) {
  const s = selector.replace(/["']/g, '').replace(/\s+/g, ' ').trim();
  switch (s) {
    case ':host': return SCOPES;
    case ':host([data-lr-theme=dark])': return ['[data-lr-theme=dark]'];
    case ':host(:not([data-lr-theme=light])):host-context(.lr-dark)': return ['.lr-dark:not([data-lr-theme=light])'];
    case ':host(:not([data-lr-theme=light])):host-context([data-lr-theme=dark])': return ['[data-lr-theme=dark]'];
    case ':host(:not([data-lr-theme=light]))': return [':root:not([data-lr-theme=light]):not(.lr-light)'];
    case ':host(:dir(rtl))': return [':root:dir(rtl)', '[dir=rtl]'];
    default: throw new Error(`unmapped selector carrying custom properties: ${selector}`);
  }
}

/** Returns { documentCss, shadowCss } for one shared sheet; `hoist(prop)` picks what moves. */
function split(cssText, hoist) {
  const docRoot = postcss.parse(cssText);
  const shadowRoot = postcss.parse(cssText);
  // Document copy: keep only the hoisted custom-property declarations, mapped to document scopes.
  docRoot.walkRules((rule) => {
    rule.walkDecls((decl) => { if (!(decl.prop.startsWith('--') && hoist(decl.prop))) decl.remove(); });
    if (!rule.nodes.length) { rule.remove(); return; }
    const mapped = [...new Set(splitSelectors(rule.selector).flatMap(mapHostSelector))];
    rule.selector = mapped.join(',');
  });
  // Shadow copy: drop the hoisted custom-property declarations; keep everything else untouched.
  shadowRoot.walkRules((rule) => {
    rule.walkDecls((decl) => { if (decl.prop.startsWith('--') && hoist(decl.prop)) decl.remove(); });
    if (!rule.nodes.length) rule.remove();
  });
  const prune = (root) => root.walkAtRules((at) => { if (at.nodes && !at.nodes.length) at.remove(); });
  prune(docRoot); prune(docRoot); prune(shadowRoot); prune(shadowRoot);
  return { documentCss: docRoot.toString(), shadowCss: shadowRoot.toString() };
}

// Variant C hoists only what cannot change meaning when moved: a property every one of whose
// declarations is a literal (no var()) inside a plain :host rule. That is the OKLCH ramp and the
// fixed mask constant -- nothing a theme input, a mode scope or a direction can retune.
const hoistableLiterals = new Set();
{
  const verdict = new Map();
  for (const css of [palette.cssText, tokens.cssText]) {
    postcss.parse(css).walkDecls((decl) => {
      if (!decl.prop.startsWith('--')) return;
      const plainHost = splitSelectors(decl.parent.selector ?? '').every((sel) => sel.trim() === ':host');
      const ok = plainHost && !decl.value.includes('var(') && !decl.value.includes('env(');
      verdict.set(decl.prop, (verdict.get(decl.prop) ?? true) && ok);
    });
  }
  for (const [prop, ok] of verdict) if (ok) hoistableLiterals.add(prop);
}

const layerOrder = '@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;';
// D matches the proposal exactly: everything moves except the three properties the RFC keeps on the
// host (they must resolve per element: a subtree scope input, and direction-dependent aliases).
const HOST_LOCAL = new Set(['--lr-icon-button-size', '--lr-safe-area-inline-start', '--lr-safe-area-inline-end']);
const ALL_VARIANTS = {
  b: () => true,
  c: (prop) => hoistableLiterals.has(prop),
  d: (prop) => !HOST_LOCAL.has(prop),
};
// --only d builds just that variant (and leaves the others' files untouched).
const onlyArg = process.argv.indexOf('--only');
const ONLY = onlyArg > 0 ? process.argv[onlyArg + 1].split(',') : null;
const VARIANTS = Object.fromEntries(Object.entries(ALL_VARIANTS).filter(([v]) => !ONLY || ONLY.includes(v)));
const built = {};
for (const [variant, hoist] of Object.entries(VARIANTS)) {
  const p = split(palette.cssText, hoist);
  const t = split(tokens.cssText, hoist);
  const documentCss = `${layerOrder}\n@layer lr-theme {\n${p.documentCss}\n${t.documentCss}\n}\n`;
  const dist = path.join(here, `dist-${variant}`);
  rmSync(dist, { recursive: true, force: true });
  cpSync(distA, dist, { recursive: true });
  writeFileSync(path.join(dist, 'internal/tokens/palette.styles.js'),
    `import{unsafeCSS}from"lit";const palette=unsafeCSS(${JSON.stringify(p.shadowCss)});export{palette};\n`);
  writeFileSync(path.join(dist, 'internal/tokens.styles.js'),
    `import{unsafeCSS}from"lit";const tokens=unsafeCSS(${JSON.stringify(t.shadowCss)});export{tokens};\n`);
  writeFileSync(path.join(dist, 'internal/document-tokens.js'), `
const documentTokenCss = ${JSON.stringify(documentCss)};
const adopted = new WeakSet();
/** Adopt the resolved token layer into a document once. Idempotent per document. */
export function ensureDocumentTokens(doc) {
  if (!doc || adopted.has(doc) || !('adoptedStyleSheets' in doc)) return;
  adopted.add(doc);
  const view = doc.defaultView;
  if (!view) return;
  const sheet = new view.CSSStyleSheet();
  sheet.replaceSync(documentTokenCss);
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
}
`);
  const lePath = path.join(dist, 'internal/lyra-element.js');
  let le = readFileSync(lePath, 'utf8');
  const hook = 'connectedCallback(){this.hydratingServerShadow';
  if (le.split(hook).length !== 2) throw new Error('LyraElement connectedCallback hook not found exactly once');
  le = le.replace(hook, 'connectedCallback(){ensureDocumentTokens(this.ownerDocument),this.hydratingServerShadow');
  le = `import{ensureDocumentTokens}from"./document-tokens.js";${le}`;
  writeFileSync(lePath, le);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, `document-tokens-${variant}.css`), documentCss);
  writeFileSync(path.join(out, `shadow-remainder-${variant}.css`), `${p.shadowCss}\n/* --- */\n${t.shadowCss}\n`);
  built[variant] = { p, t, documentCss };
}


// ---------------------------------------------------------------------------------------------
// Variant E: the revised proposal.
const E_SCOPES = [':root', '.lr-light', '.lr-dark', '[data-lr-theme]', '[data-lr-theme-scope]',
  '.lr-token-light', '.lr-token-dark', '[data-lr-design-token-mode]',
  // Nested regions of the deprecated fixed themes/shadcn.css (mode-neutral; removed with it in v23).
  '.light', '.dark'];
const DARK_ON = '--_lr-dark-on', LIGHT_ON = '--_lr-light-on';
function buildE() {
  const base = new Map(), dark = new Map(), forced = new Map(), reduced = new Map();
  const hostRules = []; // CSS text that stays in the per-host sheet
  const norm = (sel) => sel.replace(/["']/g, '').replace(/\s+/g, ' ').trim();
  for (const css of [palette.cssText, tokens.cssText]) {
    postcss.parse(css).walkRules((rule) => {
      const at = rule.parent.type === 'atrule' ? `@${rule.parent.name} ${rule.parent.params}`.replace(/\s+/g, '') : '';
      const sel = norm(rule.selector);
      const customs = [], others = [];
      rule.each((d) => { if (d.type === 'decl') (d.prop.startsWith('--') ? customs : others).push(d); });
      const put = (map) => customs.forEach((d) => {
        if (map.has(d.prop) && map.get(d.prop) !== d.value) throw new Error(`conflicting ${d.prop}`);
        map.set(d.prop, d.value);
      });
      if (!at && sel === ':host') {
        customs.forEach((d) => (HOST_LOCAL.has(d.prop) ? hostRules.push(`:host{${d.prop}:${d.value}}`) : base.set(d.prop, d.value)));
        if (others.length) hostRules.push(`:host{${others.map((d) => `${d.prop}:${d.value}${d.important ? '!important' : ''}`).join(';')}}`);
      } else if (at === '@media(forced-colors:active)') put(forced);
      else if (!at && sel === ':host([data-lr-theme=dark])') put(dark);
      else if (sel.includes(':host-context(') || (at.startsWith('@media(prefers-color-scheme:dark)'))) {
        // The other two dark routes carry the same fragment; the switches replace all three.
        customs.forEach((d) => { if (dark.has(d.prop) && dark.get(d.prop) !== d.value) throw new Error(`dark route mismatch ${d.prop}`); });
      }
      else if (at === '@media(prefers-reduced-motion:reduce)' && sel === ':host') put(reduced);
      else hostRules.push(rule.parent.type === 'atrule' ? `${rule.parent.toString().replace(/\{[\s\S]*$/, '')}{${rule.toString()}}` : rule.toString());
    });
  }
  // A mode-dependent output becomes one declaration that picks its branch from the inherited switches.
  const paired = (name) => {
    const l = base.get(name), d = dark.get(name);
    return d === undefined || d === l ? l : `var(${DARK_ON},${l})var(${LIGHT_ON},${d})`;
  };
  // Outputs that derive (transitively) from a preference arm's tokens: the host arm restates them so
  // they re-derive against the arm's values on the host itself.
  const closure = (armNames) => {
    const out = new Set();
    let grew = true;
    while (grew) {
      grew = false;
      for (const name of base.keys()) {
        if (armNames.has(name) || out.has(name)) continue;
        const refs = [...paired(name).matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
        if (refs.some((r) => armNames.has(r) || out.has(r))) { out.add(name); grew = true; }
      }
    }
    return [...out];
  };
  const forcedClosure = closure(new Set(forced.keys()));
  const reducedClosure = closure(new Set(reduced.keys()));
  const decls = (entries) => entries.map(([k, v]) => `${k}:${v}`).join(';');
  const scopes = E_SCOPES.join(',');
  const documentCss = [
    layerOrder,
    '@layer lr-theme{',
    // Mode switches. Only mode scopes (and the root under the OS preference) set them; every other
    // scope inherits them, so a mode-neutral scope keeps its ancestor's mode.
    `:root,.lr-light,[data-lr-theme=light]{${DARK_ON}:initial;${LIGHT_ON}: }`,
    `@media (prefers-color-scheme:dark){:root:not(.lr-light):not([data-lr-theme=light]){${DARK_ON}: ;${LIGHT_ON}:initial}}`,
    `.lr-dark:not([data-lr-theme=light]),[data-lr-theme=dark]{${DARK_ON}: ;${LIGHT_ON}:initial}`,
    `${scopes}{${decls([...base.keys()].map((k) => [k, paired(k)]))}}`,
    `@media (forced-colors:active){${scopes}{${decls([...forced])}}}`,
    `@media (prefers-reduced-motion:reduce){${scopes}{${decls([...reduced])}}}`,
    '}',
  ].join('\n');
  const shadowTokens = [
    ...hostRules,
    `@media (forced-colors:active){:host{${decls([...forced, ...forcedClosure.map((k) => [k, paired(k)])])}}}`,
    `@media (prefers-reduced-motion:reduce){:host{${decls([...reduced, ...reducedClosure.map((k) => [k, paired(k)])])}}}`,
  ].join('\n');
  return { documentCss, shadowTokens, shadowPalette: '', forcedClosure, reducedClosure, counts: {
    base: base.size, modeDependent: [...dark.keys()].filter((k) => dark.get(k) !== base.get(k)).length,
    forced: forced.size, reduced: reduced.size, hostLocal: HOST_LOCAL.size } };
}

const WANT_E = !ONLY || ONLY.includes('e');
if (WANT_E) {
  const e = buildE();
  const dist = path.join(here, 'dist-e');
  rmSync(dist, { recursive: true, force: true });
  cpSync(distA, dist, { recursive: true });
  writeFileSync(path.join(dist, 'internal/tokens/palette.styles.js'),
    `import{unsafeCSS}from"lit";const palette=unsafeCSS(${JSON.stringify(e.shadowPalette)});export{palette};\n`);
  writeFileSync(path.join(dist, 'internal/tokens.styles.js'),
    `import{unsafeCSS}from"lit";const tokens=unsafeCSS(${JSON.stringify(e.shadowTokens)});export{tokens};\n`);
  writeFileSync(path.join(dist, 'internal/document-tokens.js'), `
const documentTokenCss = ${JSON.stringify(e.documentCss)};
// Spike-only switch: also make a foreign shadow root's :host a scope (the first draft's rule).
const hostScopeCss = documentTokenCss.replace(${JSON.stringify(E_SCOPES.join(','))}, ${JSON.stringify([':host', ...E_SCOPES].join(','))});
const sheets = new WeakMap();
const REGISTRY = Symbol.for('@aceshooting/lyra-ui.registration-diagnostics.v1');
/** A library component: its constructor was registered through defineElement() by any Lyra copy. */
function isLibraryHost(host) {
  const known = globalThis[REGISTRY]?.registries?.get(customElements)?.registrations?.get(host.localName);
  return !!known && known.ctor === host.constructor;
}
function sheetFor(doc, foreign) {
  const key = foreign && globalThis.__spikeHostScope ? 'host' : 'doc';
  let entry = sheets.get(doc);
  if (!entry) { entry = {}; sheets.set(doc, entry); }
  if (!entry[key]) {
    const view = doc.defaultView;
    if (!view) return null;
    entry[key] = new view.CSSStyleSheet();
    entry[key].replaceSync(key === 'host' ? hostScopeCss : documentTokenCss);
  }
  return entry[key];
}
function adopt(root, sheet) {
  if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}
// Every scope selector that can match inside a shadow tree (:root cannot).
const IN_TREE_SCOPES = ${JSON.stringify(E_SCOPES.filter((sel) => sel !== ':root').join(','))};
/** Adopt the layer into the element's document, and into its containing shadow root when that
 *  root's host is not a library component and the element is, or sits inside, a scope of that tree
 *  (on demand). Spike switches: __spikeForeignAdopt = 'always' adopts into every foreign root;
 *  __spikeHostScope also makes the foreign host a scope (implies 'always'). The includes() check on
 *  every connect re-adopts after an application replaces adoptedStyleSheets wholesale. */
export function ensureDocumentTokens(el) {
  const doc = el.ownerDocument;
  if (!doc || !('adoptedStyleSheets' in doc) || !doc.defaultView) return;
  adopt(doc, sheetFor(doc, false));
  const root = el.getRootNode();
  if (root === doc || !(root instanceof doc.defaultView.ShadowRoot) || isLibraryHost(root.host)) return;
  const always = globalThis.__spikeForeignAdopt === 'always' || globalThis.__spikeHostScope;
  if (always || el.closest(IN_TREE_SCOPES)) adopt(root, sheetFor(doc, true));
}
`);
  // The specialist palettes stay per host (13 component types adopt them), but read the mode from
  // the same inherited switches instead of their own three dark routes.
  {
    const { specialistTokens } = await import('./dist-a/internal/specialist-tokens.styles.js');
    const light = new Map(), darkS = new Map(), forcedS = new Map();
    postcss.parse(specialistTokens.cssText).walkRules((rule) => {
      const at = rule.parent.type === 'atrule' ? rule.parent.params.replace(/\s+/g, '') : '';
      const sel = rule.selector.replace(/["']/g, '').replace(/\s+/g, ' ').trim();
      const target = at === '(forced-colors:active)' ? forcedS : !at && sel === ':host' ? light : !at && sel === ':host([data-lr-theme=dark])' ? darkS : null;
      if (target) rule.walkDecls((d) => target.set(d.prop, d.value));
    });
    const pair = (k) => (darkS.has(k) && darkS.get(k) !== light.get(k) ? `var(${DARK_ON},${light.get(k)})var(${LIGHT_ON},${darkS.get(k)})` : light.get(k));
    const text = `:host{${[...light.keys()].map((k) => `${k}:${pair(k)}`).join(';')}}\n@media (forced-colors:active){:host{${[...forcedS].map(([k, v]) => `${k}:${v}`).join(';')}}}`;
    writeFileSync(path.join(dist, 'internal/specialist-tokens.styles.js'),
      `import{unsafeCSS}from"lit";const specialistTokens=unsafeCSS(${JSON.stringify(text)});export{specialistTokens};\n`);
    writeFileSync(path.join(out, 'specialist-e.css'), text);
  }
  const lePath = path.join(dist, 'internal/lyra-element.js');
  let le = readFileSync(lePath, 'utf8');
  const hook = 'connectedCallback(){this.hydratingServerShadow';
  if (le.split(hook).length !== 2) throw new Error('LyraElement connectedCallback hook not found exactly once');
  le = le.replace(hook, 'connectedCallback(){ensureDocumentTokens(this),this.hydratingServerShadow');
  le = `import{ensureDocumentTokens}from"./document-tokens.js";${le}`;
  writeFileSync(lePath, le);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'document-tokens-e.css'), e.documentCss);
  writeFileSync(path.join(out, 'shadow-remainder-e.css'), e.shadowTokens);
  built.e = { p: { shadowCss: e.shadowPalette }, t: { shadowCss: e.shadowTokens }, documentCss: e.documentCss };
  console.log(JSON.stringify({ e: e.counts, forcedClosure: e.forcedClosure, reducedClosure: e.reducedClosure }));
}

const components = [
  'forms/button/button.js', 'forms/input/input.js', 'layout/card/card.js',
  'overlays/badge/badge.js', 'utility/icon/icon.js', 'forms/switch/switch.js',
];
// The parity page also covers one component that adopts the specialist palettes.
const PARITY_EXTRA = ['retrieval/graph-legend/graph-legend.js'];
const WANT_I = !!candidateDist;
for (const variant of [...(ONLY && !ONLY.includes('a') ? [] : ['a']), ...Object.keys(VARIANTS), ...(WANT_E ? ['e'] : []), ...(WANT_I ? ['i'] : []), ...DERIVED]) {
  // The benchmark also drives the real style API (setLyraStyle, applyLyraStyleScope re-theme kinds).
  const entry = [...components.map((c) => `import '../dist-${variant}/components/${c}';`),
    `export { setLyraStyle, resetLyraStyle, applyLyraStyleScope } from '../dist-${variant}/theme/theme.js';`].join('\n');
  const entryPath = path.join(out, `entry-${variant}.js`);
  writeFileSync(entryPath, entry);
  await esbuild.build({
    entryPoints: [entryPath], bundle: true, format: 'esm', target: 'es2022', minify: true,
    outfile: path.join(out, `bundle-${variant}.js`), nodePaths: [path.join(here, 'node_modules')],
    logLevel: 'warning', legalComments: 'none',
  });
}
// Realistic application page (bench.html?page=app): a broader, typical component set, bundled
// separately so the six-type benchmark bundle and its numbers stay comparable with earlier runs.
const APP_COMPONENTS = [
  ...components,
  'forms/select/select.js', 'forms/combobox/option.js', 'forms/checkbox/checkbox.js', 'forms/textarea/textarea.js',
  'forms/slider/slider.js', 'data/table/table.js', 'overlays/dialog/dialog.js', 'layout/tab-group/tab-group.js',
  'layout/tab-group/tab.js', 'layout/tab-group/tab-panel.js', 'layout/details/details.js', 'charts/chart/lite-chart.js',
];
for (const variant of [...(ONLY && !ONLY.includes('a') ? [] : ['a']), ...(WANT_I ? ['i'] : []), ...DERIVED]) {
  const entryPath = path.join(out, `app-entry-${variant}.js`);
  writeFileSync(entryPath, [...APP_COMPONENTS.map((c) => `import '../dist-${variant}/components/${c}';`),
    `export { setLyraStyle, resetLyraStyle, applyLyraStyleScope } from '../dist-${variant}/theme/theme.js';`].join('\n'));
  await esbuild.build({
    entryPoints: [entryPath], bundle: true, format: 'esm', target: 'es2022', minify: true,
    outfile: path.join(out, `app-bundle-${variant}.js`), nodePaths: [path.join(here, 'node_modules')],
    logLevel: 'warning', legalComments: 'none',
  });
}
// Parity bundles (A and E): the benchmark components plus one specialist-palette consumer.
for (const variant of ['a', ...(WANT_E ? ['e'] : []), ...(WANT_I ? ['i'] : []), ...DERIVED]) {
  const entryPath = path.join(out, `parity-entry-${variant}.js`);
  writeFileSync(entryPath, [...components, ...PARITY_EXTRA].map((c) => `import '../dist-${variant}/components/${c}';`).join('\n'));
  await esbuild.build({
    entryPoints: [entryPath], bundle: true, format: 'esm', target: 'es2022', minify: true,
    outfile: path.join(out, `parity-bundle-${variant}.js`), nodePaths: [path.join(here, 'node_modules')],
    logLevel: 'warning', legalComments: 'none',
  });
}

const count = (css) => (css.match(/(^|[;{\s])--[a-z0-9-]+\s*:/g) ?? []).length;
const hash = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 12);
const { gzipSync } = await import('node:zlib');
const bundleStats = (v) => { const b = readFileSync(path.join(out, `bundle-${v}.js`)); return { bytes: b.length, gzip: gzipSync(b, { level: 9 }).length, sha: hash(path.join(out, `bundle-${v}.js`)) }; };
const summary = {
  sourceCommit: readFileSync(path.join(here, 'SOURCE_COMMIT'), 'utf8').trim(),
  customPropertyDeclarationsInSharedSheets: {
    a: { palette: count(palette.cssText), tokens: count(tokens.cssText) },
    ...Object.fromEntries(Object.entries(built).map(([v, x]) => [v, {
      shadowRemainder: count(x.p.shadowCss) + count(x.t.shadowCss), documentSheet: count(x.documentCss),
    }])),
  },
  hoistableLiteralProperties: hoistableLiterals.size,
  sharedSheetBytes: {
    a: palette.cssText.length + tokens.cssText.length,
    ...Object.fromEntries(Object.entries(built).map(([v, x]) => [v, {
      shadowRemainder: x.p.shadowCss.length + x.t.shadowCss.length, documentSheet: x.documentCss.length,
    }])),
  },
  bundles: Object.fromEntries(['a', ...Object.keys(ALL_VARIANTS), 'e', 'i', ...DERIVED].filter((v) => existsSync(path.join(out, `bundle-${v}.js`))).map((v) => [v, bundleStats(v)])),
};
writeFileSync(path.join(out, ONLY ? `build-summary-${ONLY.join('')}.json` : 'build-summary.json'), JSON.stringify(summary, null, 2));

// Provenance that run.mjs copies into every results file: the baseline tarball's integrity (set
// LYRA_BASELINE_TARBALL to the packed .tgz) and the candidate's source identity, including its
// uncommitted changes, so an uncommitted build is identifiable beyond `git rev-parse HEAD`.
const git = (...args) => { try { return execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }); } catch { return ''; } };
const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);
const newestMtime = (dir) => {
  let newest = 0;
  const walk = (d) => { for (const entry of readdirSync(d, { withFileTypes: true })) { const f = path.join(d, entry.name); if (entry.isDirectory()) walk(f); else newest = Math.max(newest, statSync(f).mtimeMs); } };
  try { walk(dir); } catch { /* absent */ }
  return newest ? new Date(newest).toISOString() : null;
};
const tarball = process.env.LYRA_BASELINE_TARBALL ? path.resolve(process.env.LYRA_BASELINE_TARBALL) : null;
writeFileSync(path.join(out, 'provenance.json'), JSON.stringify({
  baseline: {
    dist: baselineDist,
    version: baselineDist ? JSON.parse(readFileSync(path.join(baselineDist, '..', 'package.json'), 'utf8')).version : null,
    tarball,
    integrity: tarball ? `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}` : null,
  },
  candidate: {
    dist: candidateDist,
    head: git('rev-parse', 'HEAD').trim() || null,
    statusSha256: sha(git('status', '--porcelain', '--untracked-files=all')),
    diffSha256: sha(git('diff', 'HEAD', '--binary')),
    newestDistFile: candidateDist ? newestMtime(candidateDist) : null,
    newestSourceFile: newestMtime(path.join(pkgDir, 'src')),
  },
  derived: DERIVED,
  node: process.version,
  builtAt: new Date().toISOString(),
}, null, 2));
console.log(JSON.stringify(summary, null, 2));


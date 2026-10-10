// The document token layer (RFC 0002): one stylesheet, generated from the projected canonical token
// source, that declares the shared --lr-* output layer on :root and re-derives it at every theme
// scope. Components no longer declare it on their own :host; they keep only the host-local
// remainder and the media-conditioned preference arms emitted below.
//
import { createHash } from 'node:crypto';

// Everything here is pure: callers pass the projected source (generate-design-tokens.mjs's
// `projectDefaultTokenSource()`), and get CSS text back. `generate-design-tokens.mjs` writes the
// results to `src/internal/document-tokens.generated.ts` and `src/styles/tokens-root.css`.

/**
 * Every theme scope. An element matching one of these re-derives every layer output from the
 * inputs and mode switches it sees. The list is closed and generated into the runtime, the static
 * file and the documentation; `check-host-token-declarations.mjs` fails a shipped rule that sets a
 * layer-consumed input on a selector outside it.
 */
export const DOCUMENT_LAYER_SCOPES = Object.freeze([
  ':root',
  '.lr-light',
  '.lr-dark',
  '[data-lr-theme]',
  '[data-lr-theme-scope]',
  '[data-lr-mode]',
  '[data-lr-look]',
  '[data-lr-accent]',
  '[data-lr-density]',
  '[data-lr-contrast]',
  '[data-lr-motion]',
  '.lr-token-light',
  '.lr-token-dark',
  '[data-lr-design-token-mode]',
  // A look's scoped mode aliases (generated for shadcn, and for runtime looks by look-css.ts). Two
  // selectors rather than :is(.light, .dark), so engines can bucket each by its class.
  ':where([data-lr-look]) .light',
  ':where([data-lr-look]) .dark',
]);

/** Attributes whose presence makes an element a theme scope (the class scopes are listed apart). */
export const DOCUMENT_LAYER_SCOPE_ATTRIBUTES = Object.freeze([
  'data-lr-theme',
  'data-lr-theme-scope',
  'data-lr-mode',
  'data-lr-look',
  'data-lr-accent',
  'data-lr-density',
  'data-lr-contrast',
  'data-lr-motion',
  'data-lr-design-token-mode',
]);

/**
 * Layer names that stay on every host. `--lr-icon-button-size` reads the subtree input
 * `--lr-icon-button-size-scope` and takes the coarse-pointer floor per element; the safe-area
 * aliases mirror under each element's own direction; `--lr-radius-button` reads the
 * component-local `--lr-form-control-radius` that form controls declare on their own host.
 */
export const HOST_LOCAL_TOKENS = Object.freeze([
  '--lr-icon-button-size',
  '--lr-radius-button',
  '--lr-safe-area-inline-end',
  '--lr-safe-area-inline-start',
]);

/** Shared canonical families that are not part of the layer, with the sheet that owns them. */
const SPECIALIST = /^--lr-(?:color-chart-|graph-|terminal-)/;
const FORM_CONTROL = /^--lr-form-control-/;
const TOOLING = /^--lr-ramp-/;

/**
 * Inherited private inputs the layer may read without declaring. Mode switches come from the
 * layer's own mode rules or theme.css; preference and motion switches from preferences.css and the
 * preference arms; `--_lr-subtle-mix` from the look resolver; the two glass weights are set only on
 * glass surfaces, which re-derive the qualified outputs locally (the layer's qualified values are
 * guaranteed-invalid everywhere else, so the outputs take their unqualified fallback). The focus
 * ring's qualified colour is the exception: the layer does not declare it, a glass host derives it.
 */
const LAYER_PRIVATE_INPUTS = Object.freeze([
  '--_lr-dark-on',
  '--_lr-glass-border-weight',
  '--_lr-glass-foreground-weight',
  '--_lr-glass-qualified-focus-ring-color',
  '--_lr-light-on',
  '--_lr-motion-duration',
  '--_lr-motion-easing',
  '--_lr-motion-transition',
  '--_lr-preference-control-color',
  '--_lr-preference-focus-min',
  '--_lr-preference-quiet-color',
  '--_lr-subtle-mix',
]);

/** Increased contrast sets three private switches; the outputs that read them re-derive. */
export const CONTRAST_SWITCHES = Object.freeze([
  ['--_lr-preference-quiet-color', 'currentColor'],
  ['--_lr-preference-control-color', 'currentColor'],
  ['--_lr-preference-focus-min', '3px'],
]);

/**
 * Private sentinel declared by the layer on :root. `adoptLyraTokens()` skips the constructed copy
 * in a document whose root already resolves it, which is how a linked tokens-root.css avoids the
 * first-adoption style invalidation.
 */
export const DOCUMENT_LAYER_SENTINEL = '--_lr-document-tokens';

const DARK_ON = '--_lr-dark-on';
const LIGHT_ON = '--_lr-light-on';
const references = (value) => [...value.matchAll(/var\(\s*(--[_a-zA-Z0-9-]+)/g)].map((match) => match[1]);
const rampReference = (source, value) =>
  value.replaceAll(/var\((--lr-ramp-[a-z0-9-]+)\)/g, (match, name) => source.tokens?.[name]?.values?.light ?? match);

/** Classifies every shared canonical token. Unknown families fail closed. */
export function classifySharedTokens(source) {
  const layer = [];
  const hostLocal = [];
  const specialist = [];
  const formControl = [];
  for (const [name, token] of Object.entries(source.tokens)) {
    if (token.scope !== 'shared' || TOOLING.test(name)) continue;
    if (HOST_LOCAL_TOKENS.includes(name)) hostLocal.push(name);
    else if (SPECIALIST.test(name)) specialist.push(name);
    else if (FORM_CONTROL.test(name)) formControl.push(name);
    else layer.push(name);
  }
  return { layer, hostLocal, specialist, formControl };
}

/** Splits a value of the form `var(<qualified>, <original>)` (the glass qualification). */
function glassQualification(value) {
  const match = /^var\((--_lr-glass-qualified-[a-z0-9-]+),\s*([\s\S]*)\)$/.exec(value);
  return match ? { qualified: match[1], original: match[2] } : null;
}

const glassWeight = (qualified) => (qualified.includes('-border') ? '--_lr-glass-border-weight' : '--_lr-glass-foreground-weight');

/**
 * The layer's declarations per mode, in canonical order, including the private glass companions
 * that every qualified output reads. Returns Map<name, { light, dark }>.
 */
export function layerDeclarations(source) {
  const { layer } = classifySharedTokens(source);
  const value = (name, mode) => {
    const token = source.tokens[name];
    return rampReference(source, token.values[mode] ?? token.values.light);
  };
  const declarations = new Map();
  for (const name of layer) {
    const light = value(name, 'light');
    const dark = value(name, 'dark');
    const lightGlass = glassQualification(light);
    if (lightGlass) {
      const darkGlass = glassQualification(dark);
      if (!darkGlass || darkGlass.qualified !== lightGlass.qualified) {
        throw new Error(`${name}: light and dark values disagree on their glass qualification`);
      }
      const weight = glassWeight(lightGlass.qualified);
      declarations.set(lightGlass.qualified.replace('-qualified-', '-original-'), {
        light: lightGlass.original,
        dark: darkGlass.original,
      });
      // The focus ring's qualified colour is derived on the surface host itself (`:host`), where the
      // ring outputs are composed. A layer declaration would also match a host that is itself a
      // scope and, as an outer-tree rule, beat that host rule with a guaranteed-invalid value.
      if (lightGlass.qualified !== '--_lr-glass-qualified-focus-ring-color') {
        declarations.set(lightGlass.qualified, {
          light: `color-mix(in srgb, ${lightGlass.original}, var(--lr-color-text) var(${weight}))`,
          dark: `color-mix(in srgb, ${darkGlass.original}, var(--lr-color-text) var(${weight}))`,
        });
      }
    }
    declarations.set(name, { light, dark });
  }
  // Foreground companions that glass surfaces re-derive; resting surfaces leave them invalid.
  for (const variant of ['brand', 'danger']) {
    const mix = `color-mix(in srgb, var(--lr-color-${variant}), var(--lr-color-text) var(--_lr-glass-foreground-weight))`;
    declarations.set(`--_lr-glass-${variant}-text`, { light: mix, dark: mix });
  }
  return declarations;
}

/** CSS value tokens: whitespace, `(`, `)`, `,`, `/`, strings, and runs (an identifier, number,
 * hash or function name, with its opening parenthesis). Joined back, they are the input. */
const VALUE_TOKENS = /\s+|[(),/]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s(),/"']+\(?/g;
/** Functions whose first argument is a name, never a substitution: a mode switch cannot go there. */
const NAME_ARGUMENT = /^(?:var|env|attr)\($/i;

function valueTokens(value) {
  const tokens = value.match(VALUE_TOKENS) ?? [];
  return tokens.join('') === value ? tokens : null;
}

const opens = (token) => token.endsWith('(') && !/^["']/.test(token);

/** True when a token run is a balanced sequence: never closes what it did not open. */
function balanced(tokens) {
  let depth = 0;
  for (const token of tokens) {
    if (opens(token)) depth++;
    else if (token === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * The value for both modes: the light and dark values joined by the two inherited mode switches
 * (`var(--_lr-dark-on,<light>)var(--_lr-light-on,<dark>)`, one of which substitutes nothing). The
 * switch pair is placed around the smallest balanced run of tokens where the two values differ,
 * so the wrappers they share (the `--lr-theme-*` input, a preference switch, a `color-mix()`) are
 * written once. A `var()` substitutes the same tokens wherever it sits in a value, so the result is
 * identical; the pair never replaces the name argument of `var()`, `env()` or `attr()`.
 */
export function pairModes({ light, dark }) {
  if (light === dark) return light;
  const whole = `var(${DARK_ON},${light})var(${LIGHT_ON},${dark})`;
  const a = valueTokens(light);
  const b = valueTokens(dark);
  if (!a || !b) return whole;
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  const namePosition = (index) => {
    const before = a.slice(0, index).findLast((token) => !/^\s+$/.test(token));
    return before !== undefined && NAME_ARGUMENT.test(before);
  };
  // The widest shared head and tail (smallest paired run) whose runs are balanced on both sides.
  let best = null;
  for (let head = prefix; head >= 0; head--) {
    if (best && head + suffix <= best.head + best.tail) break;
    if (namePosition(head)) continue;
    for (let tail = suffix; tail >= 0; tail--) {
      if (best && head + tail <= best.head + best.tail) break;
      const runA = a.slice(head, a.length - tail);
      const runB = b.slice(head, b.length - tail);
      if (runA.length && runB.length && balanced(runA) && balanced(runB)) {
        best = { head, tail, runA, runB };
        break;
      }
    }
  }
  if (!best) return whole;
  const { head, tail, runA, runB } = best;
  return `${a.slice(0, head).join('')}var(${DARK_ON},${runA.join('')})var(${LIGHT_ON},${runB.join('')})${a.slice(a.length - tail).join('')}`;
}

const paired = pairModes;

/** Arm values (forcedColors or reducedMotion) for every layer token that declares one. */
function armDeclarations(source, mode, names) {
  return names
    .filter((name) => source.tokens[name].values[mode] !== undefined)
    .map((name) => [name, rampReference(source, source.tokens[name].values[mode])]);
}

/** Layer names whose values reach one of `armNames`, transitively: they re-derive on the host. */
export function derivedClosure(declarations, armNames) {
  const arm = new Set(armNames);
  const closure = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, values] of declarations) {
      if (arm.has(name) || closure.has(name)) continue;
      const refs = [...references(values.light), ...references(values.dark)];
      if (refs.some((reference) => arm.has(reference) || closure.has(reference))) {
        closure.add(name);
        grew = true;
      }
    }
  }
  // Keep declaration order stable (canonical order), not discovery order.
  return [...declarations.keys()].filter((name) => closure.has(name));
}

/**
 * Fail-closed guards: every name the layer reads is declared by the layer, is a --lr-theme-* input,
 * or is an allowed inherited private input. A reference to a host-declared family (a form-control
 * token) would resolve against :root instead of the host, so such a token must be host-local.
 */
export function validateDocumentLayer(source) {
  const errors = [];
  const declarations = layerDeclarations(source);
  const { specialist, formControl } = classifySharedTokens(source);
  const hostOwned = new Set([...specialist, ...formControl, ...HOST_LOCAL_TOKENS]);
  const allowed = new Set(LAYER_PRIVATE_INPUTS);
  for (const [name, values] of declarations) {
    for (const reference of new Set([...references(values.light), ...references(values.dark)])) {
      if (declarations.has(reference) || reference.startsWith('--lr-theme-') || allowed.has(reference)) continue;
      errors.push(hostOwned.has(reference)
        ? `${name}: reads host-declared ${reference}; add ${name} to HOST_LOCAL_TOKENS`
        : `${name}: reads ${reference}, which the document layer neither declares nor allows`);
    }
  }
  for (const name of HOST_LOCAL_TOKENS) {
    if (source.tokens[name]?.scope !== 'shared') errors.push(`${name}: host-local token missing from canonical-tokens.json`);
  }
  return errors;
}

/** --lr-theme-* inputs the layer consumes; only these need a theme scope to re-derive. */
export function layerConsumedInputs(source) {
  const inputs = new Set();
  for (const values of layerDeclarations(source).values()) {
    for (const reference of [...references(values.light), ...references(values.dark)]) {
      if (reference.startsWith('--lr-theme-')) inputs.add(reference);
    }
  }
  return [...inputs].sort();
}

/** --lr-theme-* inputs read directly by host, specialist and form-control declarations. */
export function hostReadInputs(source) {
  const { hostLocal, specialist, formControl } = classifySharedTokens(source);
  const inputs = new Set();
  for (const name of [...hostLocal, ...specialist, ...formControl]) {
    for (const value of Object.values(source.tokens[name].values)) {
      for (const reference of references(value)) if (reference.startsWith('--lr-theme-')) inputs.add(reference);
    }
  }
  return [...inputs].sort();
}

const block = (selector, entries) => `${selector}{${entries.map(([name, value]) => `${name}:${value}`).join(';')}}`;

/** The mode switches. lr-base: theme.css's lr-theme-preset.mode rules outrank them when loaded. */
function modeRules() {
  const light = [[DARK_ON, 'initial'], [LIGHT_ON, ' ']];
  const dark = [[DARK_ON, ' '], [LIGHT_ON, 'initial']];
  return [
    block(":where(:root),[data-lr-mode='light'],[data-lr-mode='system'],.lr-light,[data-lr-theme='light']", light),
    // Zero specificity: an explicit mode on the root (any rule above or below) still wins.
    `@media (prefers-color-scheme:dark){${block(":where(:root),[data-lr-mode='system']", dark)}}`,
    block("[data-lr-mode='dark'],.lr-dark:not([data-lr-theme='light']),[data-lr-theme='dark']", dark),
  ];
}

/**
 * The whole document layer as compact CSS. The same text is adopted as a constructed stylesheet
 * and published as the body of tokens-root.css.
 */
export function buildDocumentLayerCss(source, layerOrder) {
  const errors = validateDocumentLayer(source);
  if (errors.length) throw new Error(`Document token layer validation failed:\n- ${errors.join('\n- ')}`);
  const declarations = layerDeclarations(source);
  const { layer } = classifySharedTokens(source);
  const scopes = DOCUMENT_LAYER_SCOPES.join(',');
  const base = [...declarations].map(([name, values]) => [name, paired(values)]);
  const rules = [
    block(scopes, base),
    `@media (prefers-contrast:more){${block(scopes, CONTRAST_SWITCHES)}}`,
    `@media (forced-colors:active){${block(scopes, armDeclarations(source, 'forcedColors', layer))}}`,
    `@media (prefers-reduced-motion:reduce){${block(scopes, armDeclarations(source, 'reducedMotion', layer))}}`,
  ];
  const modes = `@layer lr-base{${modeRules().join('')}}`;
  return [
    layerOrder,
    modes,
    '@layer lr-theme{',
    block(':root', [[DOCUMENT_LAYER_SENTINEL, documentLayerId(modes, rules)]]),
    ...rules,
    '}',
    '',
  ].join('\n');
}

/**
 * A content hash of the layer, declared as the sentinel's value. A document whose root already
 * resolves this exact value has an identical layer (a linked tokens-root.css, or another copy of
 * the same release) and needs no second copy; a different value means a different layer is present,
 * so the adopting copy appends its own (the later-adopted layer wins) and the development build
 * reports the mismatch.
 */
function documentLayerId(modes, rules) {
  // An identifier (not a string), so every engine serializes the computed value verbatim.
  return `lr${createHash('sha256').update(modes).update(rules.join('\n')).digest('hex').slice(0, 12)}`;
}

/** The sentinel value the layer `css` declares. */
export function documentLayerIdOf(css) {
  return new RegExp(`${DOCUMENT_LAYER_SENTINEL}:(lr[0-9a-f]{12})`).exec(css)?.[1] ?? null;
}

/**
 * The preference arms every host keeps: the arm's own declarations plus every layer output derived
 * from them, so an unlayered application override on :root or a wrapper cannot defeat forced
 * colours, increased contrast or reduced motion inside a component. Forced colours comes last so
 * system colours win where increased contrast is also reported.
 */
export function buildHostPreferenceCss(source) {
  const declarations = layerDeclarations(source);
  const { layer } = classifySharedTokens(source);
  const withClosure = (armEntries) => {
    const names = armEntries.map(([name]) => name);
    return [...armEntries, ...derivedClosure(declarations, names).map((name) => [name, paired(declarations.get(name))])];
  };
  return [
    `@media (prefers-contrast:more){${block(':host', withClosure(CONTRAST_SWITCHES))}}`,
    `@media (prefers-reduced-motion:reduce){${block(':host', withClosure(armDeclarations(source, 'reducedMotion', layer)))}}`,
    `@media (forced-colors:active){${block(':host', withClosure(armDeclarations(source, 'forcedColors', layer)))}}`,
  ].join('\n');
}

/** Per-host declarations for the host-local layer names, in canonical order. */
export function buildHostLocalDeclarations(source) {
  const { hostLocal } = classifySharedTokens(source);
  return hostLocal.map((name) => [name, rampReference(source, source.tokens[name].values.light)]);
}

/**
 * The specialist chart, graph and terminal palettes stay per host (13 component types adopt them)
 * but read the mode from the inherited switches instead of three dark routes.
 */
export function buildSpecialistHostCss(source) {
  const { specialist } = classifySharedTokens(source);
  const value = (name, mode) => rampReference(source, source.tokens[name].values[mode] ?? source.tokens[name].values.light);
  return [
    block(':host', specialist.map((name) => [name, paired({ light: value(name, 'light'), dark: value(name, 'dark') })])),
    `@media (forced-colors:active){${block(':host', armDeclarations(source, 'forcedColors', specialist))}}`,
  ].join('\n');
}

/**
 * Glass surfaces qualify the focus ring against their own translucency on the component host. The
 * layer resolves the ring at the scope, so a glass host restates the two outputs that read the
 * qualified colour; outside forced colours only, where the host arm owns them.
 */
export function buildGlassFocusRingDeclarations(source) {
  const declarations = layerDeclarations(source);
  return ['--lr-focus-ring-color', '--lr-focus-ring'].map((name) => [name, paired(declarations.get(name))]);
}

/** Every in-tree scope selector (all but :root), for `Element.closest()` in a shadow root. */
export const IN_TREE_SCOPE_SELECTOR = DOCUMENT_LAYER_SCOPES.filter((selector) => selector !== ':root').join(',');

/** Class names that make an element a theme scope. */
const DOCUMENT_LAYER_SCOPE_CLASSES = Object.freeze(['lr-light', 'lr-dark', 'lr-token-light', 'lr-token-dark']);

/**
 * The vocabulary the `theme-scopes` migration rule embeds: consumed inputs, public outputs, and the
 * outputs other outputs derive from (setting one of those outside a scope leaves its dependants
 * behind).
 */
export function themeScopeVocabulary(source) {
  const declarations = layerDeclarations(source);
  const outputs = [...declarations.keys()].filter((name) => name.startsWith('--lr-'));
  const feeding = new Set();
  for (const values of declarations.values()) {
    for (const reference of [...references(values.light), ...references(values.dark)]) {
      if (reference.startsWith('--lr-') && !reference.startsWith('--lr-theme-') && declarations.has(reference)) feeding.add(reference);
    }
  }
  return {
    consumedInputs: layerConsumedInputs(source),
    outputs: outputs.sort(),
    feedingOutputs: [...feeding].sort(),
    scopeAttributes: [...DOCUMENT_LAYER_SCOPE_ATTRIBUTES],
    scopeClasses: [...DOCUMENT_LAYER_SCOPE_CLASSES],
  };
}

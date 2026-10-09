#!/usr/bin/env node
import { concreteThemeCss, validateLook, readStyleModel, defaultStyleInputs, replaceStyleFallbacks } from './style-axes-model.mjs';
import { isMainModule } from './is-main-module.mjs';
import { buildOptionPresetInterchange, readOptionPresetSources } from './generate-option-presets.mjs';
import {
  DOCUMENT_LAYER_SCOPES,
  DOCUMENT_LAYER_SCOPE_ATTRIBUTES,
  DOCUMENT_LAYER_SENTINEL,
  IN_TREE_SCOPE_SELECTOR,
  buildDocumentLayerCss,
  buildGlassFocusRingDeclarations,
  buildHostLocalDeclarations,
  buildHostPreferenceCss,
  buildSpecialistHostCss,
  classifySharedTokens,
  documentLayerIdOf,
  layerConsumedInputs,
  themeScopeVocabulary,
  validateDocumentLayer,
} from './document-token-layer.mjs';

// Generates every design-tool view from tokens/canonical-tokens.json. The JSON source is authored
// and authoritative; this script never discovers token metadata by scraping TypeScript. Runtime
// styles are read only by `verifyRuntimeTokenParity()` as a fail-closed drift check.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultPackageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODES = Object.freeze(['light', 'dark', 'forcedColors', 'reducedMotion']);
const TOKEN_TYPES = new Set([
  'color', 'dimension', 'duration', 'fontFamily', 'fontWeight', 'number', 'shadow', 'string',
]);
const VALUE_CLASSIFICATIONS = new Set([
  'semantic-global', 'component-role', 'audited-fixed-geometry',
]);
const RAMP_VARIANTS = Object.freeze(['brand', 'danger', 'neutral', 'success', 'warning']);
const RAMP_STEPS = Object.freeze(['05', '10', '20', '30', '40', '50', '60', '70', '80', '90', '95']);
const TOOLING_RAMP_TOKENS = new Set(RAMP_VARIANTS.flatMap(variant =>
  RAMP_STEPS.map(step => `--lr-ramp-${variant}-${step}`)));

const normalizePath = (value) => value.replaceAll('\\', '/');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const publishedJson = (value) => `${JSON.stringify(value)}\n`;

export function readCanonicalTokens(packageDir = defaultPackageDir) {
  return JSON.parse(readFileSync(path.join(packageDir, 'tokens', 'canonical-tokens.json'), 'utf8'));
}

export function validateCanonicalTokens(source) {
  const errors = [];
  if (source?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (source?.source?.authority !== 'tokens/canonical-tokens.json') {
    errors.push('source.authority must name tokens/canonical-tokens.json');
  }
  if (source?.source?.cleanRoom !== true) errors.push('source.cleanRoom must be true');
  if (JSON.stringify(source?.modes) !== JSON.stringify(MODES)) {
    errors.push(`modes must be exactly ${MODES.join(', ')}`);
  }
  if (source?.valueNamedTokenPolicy?.growthProhibited !== true) {
    errors.push('valueNamedTokenPolicy.growthProhibited must be true');
  }
  const entries = Object.entries(source?.tokens ?? {});
  if (entries.length === 0) errors.push('tokens must not be empty');
  const sorted = [...entries].map(([name]) => name).sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(entries.map(([name]) => name)) !== JSON.stringify(sorted)) {
    errors.push('tokens must be sorted by CSS custom-property name');
  }

  for (const [name, token] of entries) {
    if (!/^--lr-(?:theme-)?[a-z0-9-]+$/.test(name)) errors.push(`${name}: invalid token name`);
    if (!TOKEN_TYPES.has(token?.type)) errors.push(`${name}: invalid or missing type`);
    if (!/^[a-z][a-z0-9-]*$/.test(token?.group ?? '')) errors.push(`${name}: invalid or missing group`);
    if (!['theme-input', 'shared'].includes(token?.scope)) errors.push(`${name}: invalid or missing scope`);
    if (typeof token?.description !== 'string' || token.description.length < 12) {
      errors.push(`${name}: description must be at least 12 characters`);
    }
    const values = Object.entries(token?.values ?? {});
    if (values.length === 0) errors.push(`${name}: values must not be empty`);
    for (const [mode, value] of values) {
      if (!MODES.includes(mode)) errors.push(`${name}: unsupported mode ${mode}`);
      if (typeof value !== 'string' || value.length === 0) errors.push(`${name}: ${mode} value is empty`);
    }
    if (token?.scope === 'theme-input' && !name.startsWith('--lr-theme-')) {
      errors.push(`${name}: theme-input scope requires a --lr-theme-* name`);
    }
    if (token?.themeInput !== undefined && !/^--lr-theme-[a-z0-9-]+$/.test(token.themeInput)) {
      errors.push(`${name}: invalid themeInput`);
    }

    if (/^--lr-size-/.test(name)) {
      if (!VALUE_CLASSIFICATIONS.has(token?.valueNameClassification)) {
        errors.push(`${name}: missing value-name classification`);
      }
      if (token?.compatibility?.name !== name || token?.compatibility?.status !== 'retained') {
        errors.push(`${name}: compatibility name must be retained`);
      }
      if (!Array.isArray(token?.evidence) || token.evidence.length === 0) {
        errors.push(`${name}: checked-in evidence is required`);
      }
      if (token?.valueNameClassification === 'component-role' && !token?.canonicalRole) {
        errors.push(`${name}: component-role classification requires canonicalRole`);
      }
      if (token?.compatibility?.aliasOf && token.compatibility.aliasOf !== token.canonicalRole) {
        errors.push(`${name}: compatibility.aliasOf must equal canonicalRole`);
      }
    } else if (token?.valueNameClassification || token?.compatibility || token?.canonicalRole) {
      errors.push(`${name}: value-name policy metadata is only valid on --lr-size-* tokens`);
    }
  }

  const valueNamedCount = entries.filter(([name]) => /^--lr-size-/.test(name)).length;
  for (const name of TOOLING_RAMP_TOKENS) {
    if (!source?.tokens?.[name]) errors.push(`${name}: canonical palette input is missing`);
  }
  for (const [name] of entries) {
    if (name.startsWith('--lr-ramp-') && !TOOLING_RAMP_TOKENS.has(name)) {
      errors.push(`${name}: unknown palette input`);
    }
  }
  if (valueNamedCount !== source?.valueNamedTokenPolicy?.frozenCount) {
    errors.push(
      `value-named token count ${valueNamedCount} does not equal frozenCount ` +
        `${source?.valueNamedTokenPolicy?.frozenCount}`,
    );
  }
  if (source?.valueNamedTokenPolicy?.frozenCount > 89) {
    errors.push('value-named token frozenCount may never exceed the v8 ceiling of 89');
  }
  return errors;
}

function declarations(text, start = 0, end = text.length) {
  const result = [];
  for (const match of text.slice(start, end).matchAll(
    /^\s*(--lr-(?:theme-)?[a-z0-9-]+):\s*(.+);\s*$/gm,
  )) {
    result.push([match[1], match[2].trim()]);
  }
  return result;
}

/**
 * Reads the current CSS implementation for parity only. It deliberately knows nothing about
 * descriptions, classifications, groups, or design-tool names; those exist solely in the
 * canonical JSON source.
 */
export function readRuntimeTokenValues(packageDir = defaultPackageDir) {
  const records = new Map();
  const add = (name, mode, value, scope) => {
    let record = records.get(name);
    if (!record) {
      record = { scope, values: {} };
      records.set(name, record);
    }
    // Palette mode selectors repeat for the supported host/ancestor/OS routes. The base token
    // sheet also has a direction-specific safe-area override. Canonical mode metadata records the
    // first declaration; route/direction equivalence stays covered by the rendered token tests.
    if (record.values[mode] === undefined) record.values[mode] = value;
  };

  const tokensPath = path.join(packageDir, 'src', 'internal', 'tokens.styles.ts');
  const tokens = readFileSync(tokensPath, 'utf8');
  const darkMarker = tokens.indexOf('/* @media (prefers-color-scheme: dark) */');
  const auxiliaryMarker = tokens.indexOf('const auxTokens');
  const forcedMarker = tokens.indexOf('@media (forced-colors: active)', auxiliaryMarker);
  if ([darkMarker, auxiliaryMarker, forcedMarker].some((index) => index < 0)) {
    throw new Error('tokens.styles.ts mode markers changed; update the parity reader explicitly');
  }
  for (const [name, value] of declarations(tokens, 0, darkMarker)) add(name, 'light', value, 'shared');
  for (const [name, value] of declarations(tokens, darkMarker, auxiliaryMarker)) add(name, 'dark', value, 'shared');
  for (const [name, value] of declarations(tokens, auxiliaryMarker, forcedMarker)) {
    add(name, 'reducedMotion', value, 'shared');
  }
  for (const [name, value] of declarations(tokens, forcedMarker)) add(name, 'forcedColors', value, 'shared');

  const specialistPath = path.join(packageDir, 'src', 'internal', 'specialist-tokens.styles.ts');
  if (existsSync(specialistPath)) {
    const specialist = readFileSync(specialistPath, 'utf8');
    const specialistDark = specialist.indexOf('const darkSpecialistTokens');
    const specialistForced = specialist.indexOf('const forcedColorSpecialistTokens');
    const specialistExport = specialist.indexOf('export const specialistTokens');
    if ([specialistDark, specialistForced, specialistExport].some((index) => index < 0)) {
      throw new Error('specialist-tokens.styles.ts mode markers changed');
    }
    for (const [name, value] of declarations(specialist, 0, specialistDark)) {
      add(name, 'light', value, 'shared');
    }
    for (const [name, value] of declarations(specialist, specialistDark, specialistForced)) {
      add(name, 'dark', value, 'shared');
    }
    for (const [name, value] of declarations(specialist, specialistForced, specialistExport)) {
      add(name, 'forcedColors', value, 'shared');
    }
  }

  const palettePath = path.join(packageDir, 'src', 'internal', 'tokens', 'palette.styles.ts');
  const palette = readFileSync(palettePath, 'utf8');
  const paletteDark = palette.indexOf(":host([data-lr-theme='dark'])");
  if (paletteDark < 0) throw new Error('palette.styles.ts dark-mode marker changed');
  for (const [name, value] of declarations(palette, 0, paletteDark)) add(name, 'light', value, 'shared');
  // All later dark selectors must repeat the same values, which `add()` checks.
  for (const [name, value] of declarations(palette, paletteDark)) add(name, 'dark', value, 'shared');

  const themePath = path.join(packageDir, 'src', 'theme.css');
  const theme = concreteThemeCss(readFileSync(themePath, 'utf8'));
  const themeDark = theme.indexOf('  .lr-dark,');
  if (themeDark < 0) throw new Error('theme.css dark-mode marker changed');
  for (const [name, value] of declarations(theme, 0, themeDark)) {
    if (name.startsWith('--lr-theme-')) add(name, 'light', value, 'theme-input');
  }
  for (const [name, value] of declarations(theme, themeDark)) {
    if (name.startsWith('--lr-theme-')) add(name, 'dark', value, 'theme-input');
  }

  // The form-control size ladder lives in its own shared stylesheet, not tokens.styles.ts, because
  // it is adopted only by form controls rather than by every LyraElement. Read just the base tier
  // (before the first `:host([size=...])` override block) and keep only the knobs that chain to a
  // `--lr-theme-*` input -- height and radius -- matching llms/shared.md's "only height and radius
  // chain to a theme input" contract; the rest of that block (unthemed height/font-size/padding/gap)
  // stays internal and is deliberately not added to canonical-tokens.json.
  const sizesPath = path.join(packageDir, 'src', 'internal', 'sizes.styles.ts');
  const sizes = readFileSync(sizesPath, 'utf8');
  const sizesTierMarker = sizes.indexOf("[size='2xs']");
  if (sizesTierMarker < 0) {
    throw new Error('sizes.styles.ts base-tier marker changed; update the parity reader explicitly');
  }
  for (const [name, value] of declarations(sizes, 0, sizesTierMarker)) {
    if (/^var\(--lr-theme-/.test(value)) add(name, 'light', value, 'shared');
  }

  return records;
}

export function verifyRuntimeTokenParity(source, packageDir = defaultPackageDir) {
  const errors = [];
  const runtime = readRuntimeTokenValues(packageDir);
  const canonical = new Map(Object.entries(source.tokens ?? {}));
  const profileInputs = defaultStyleInputs(readStyleModel(packageDir));
  for (const [name, actual] of runtime) {
    if (TOOLING_RAMP_TOKENS.has(name)) {
      errors.push(`${name}: tooling-only palette input must not be declared at runtime`);
      continue;
    }
    const expected = canonical.get(name);
    if (!expected) {
      errors.push(`${name}: runtime declaration is missing from canonical-tokens.json`);
      continue;
    }
    if (expected.scope !== actual.scope) errors.push(`${name}: scope differs from runtime`);
    for (const mode of MODES) {
      const authoredValue = expected.values?.[mode];
      const expectedValue = ['light', 'dark'].includes(mode) && authoredValue !== undefined
        ? expected.scope === 'theme-input' ? profileInputs[name]?.[mode] ?? profileInputs[name]?.light ?? authoredValue : replaceStyleFallbacks(authoredValue, profileInputs, mode, source.tokens)
        : authoredValue;
      const actualValue = actual.values?.[mode];
      if (expectedValue !== actualValue) {
        errors.push(`${name}: ${mode} is ${JSON.stringify(actualValue)}, expected ${JSON.stringify(expectedValue)}`);
      }
    }
  }
  for (const name of canonical.keys()) {
    if (!runtime.has(name) && !TOOLING_RAMP_TOKENS.has(name)) {
      errors.push(`${name}: canonical token has no runtime declaration`);
    }
  }
  return errors;
}

function cssInputTokens(source) {
  const inputs = new Map();
  for (const [name, token] of Object.entries(source.tokens)) {
    if (token.scope === 'theme-input') inputs.set(name, { ...token, declared: true });
    if (token.themeInput && !inputs.has(token.themeInput)) {
      const fallback = /^var\(--lr-theme-[a-z0-9-]+,\s*(.*)\)$/.exec(token.values.light ?? '')?.[1];
      inputs.set(token.themeInput, {
        type: token.type,
        group: token.group,
        description: `Application input for ${name}; falls back to the shared token default.`,
        values: fallback ? { light: fallback } : {},
        declared: false,
      });
    }
  }
  return [...inputs.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const modeValue = (token, mode) => token.values[mode] ?? token.values.light;

const MODE_SUBLAYER_ORDER = '@layer lr-theme-preset.look, lr-theme-preset.density, lr-theme-preset.surface, lr-theme-preset.accent, lr-theme-preset.mode;';
const EXPLICIT_LYRA_MODE = `:not([data-lr-mode]):not([data-lr-theme='light']):not([data-lr-theme='dark']):not(.lr-light):not(.lr-dark)`;
const fixtureModeSelector = (mode) =>
  `.lr-token-${mode}${EXPLICIT_LYRA_MODE}, [data-lr-design-token-mode='${mode}']${EXPLICIT_LYRA_MODE}`;

function buildCss(source, layerOrder) {
  const inputs = cssInputTokens(source).filter(([, token]) => token.declared);
  const block = (mode) => inputs
    .map(([name, token]) => `    ${name}: ${modeValue(token, mode)};`)
    .join('\n');
  return `/* GENERATED by scripts/generate-design-tokens.mjs from tokens/canonical-tokens.json. */
/* Explicit design-tool/theme-fixture modes. This does not replace theme.css and intentionally has
   no :root default, so importing it cannot change Lyra's OS-following production semantics. */
/* The same cascade-layer order statement theme.css declares. Layer order is fixed by the first
   statement the browser sees and a name missing from it is appended at the end, so were this file
   to load first naming only lr-theme, every other Lyra layer would be ordered after it. */
${layerOrder}

${MODE_SUBLAYER_ORDER}

@layer lr-theme {
  :where(.lr-token-light, [data-lr-design-token-mode='light']) {
${block('light')}
  }

  :where(.lr-token-dark, [data-lr-design-token-mode='dark']) {
    color-scheme: dark;
${block('dark')}
  }
}

/* Each fixture scope is also a mode scope: it sets the two inherited mode switches, so mode-neutral
   scopes, specialist palettes and boundaries that re-resolve inputs below it keep the fixture's
   mode. The switches sit in theme.css's mode sublayer and outrank its zero-specificity root and
   operating-system defaults in either stylesheet order; an explicit Lyra mode on the same element
   (data-lr-mode, data-lr-theme="light|dark", .lr-light, .lr-dark) wins over the fixture. */
@layer lr-theme-preset.mode {
  ${fixtureModeSelector('light')} {
    --_lr-dark-on: initial;
    --_lr-light-on: ;
  }

  ${fixtureModeSelector('dark')} {
    --_lr-dark-on: ;
    --_lr-light-on: initial;
  }
}
`;
}

// The curated resolved layer published at document scope by src/styles/tokens-root.css. Adding a
// name here is a permanent public-API decision; the rationale a consumer reads ships as the
// generated file's own header comment below.
const ROOT_TOKEN_SUBSET = Object.freeze([
  // Ambient surfaces, text, borders and the scrim.
  '--lr-color-surface',
  '--lr-color-surface-raised',
  '--lr-color-surface-overlay',
  '--lr-color-overlay',
  '--lr-color-text',
  '--lr-color-text-quiet',
  '--lr-color-border',
  '--lr-color-border-strong',
  // Decorative edges only -- never a control's boundary (WCAG 2.2 SC 1.4.11). Unset, it resolves to
  // --lr-color-border, which is why that name has to sit in this subset too.
  '--lr-color-border-subtle',
  // The semantic grid, whole: its contrast guarantee is per-tier, so a tier is not usable without
  // the matching foreground.
  ...['brand', 'success', 'warning', 'danger', 'neutral'].flatMap((variant) =>
    ['fill', 'border', 'on'].flatMap((role) =>
      ['quiet', 'normal', 'loud'].map((emphasis) => `--lr-color-${variant}-${role}-${emphasis}`),
    ),
  ),
  // The flat aliases into the grid, which read better at a call site.
  '--lr-color-brand',
  '--lr-color-brand-quiet',
  '--lr-color-on-brand',
  '--lr-color-success',
  '--lr-color-success-quiet',
  '--lr-color-on-success',
  '--lr-color-warning',
  '--lr-color-warning-quiet',
  '--lr-color-on-warning',
  '--lr-color-danger',
  '--lr-color-danger-quiet',
  '--lr-color-on-danger',
  '--lr-color-neutral',
  '--lr-color-on-neutral',
  // Geometry.
  '--lr-space-2xs',
  '--lr-space-xs',
  '--lr-space-s',
  '--lr-space-m',
  '--lr-space-l',
  '--lr-space-2xl',
  '--lr-radius-xs',
  '--lr-radius',
  '--lr-radius-pill',
  '--lr-border-width-thin',
  '--lr-border-width-medium',
  '--lr-border-width-thick',
  // Elevation, including the colour every step applies its own alpha to.
  '--lr-shadow-color',
  '--lr-shadow-xs',
  '--lr-shadow-s',
  '--lr-shadow-m',
  '--lr-shadow-l',
  '--lr-shadow-xl',
  '--lr-shadow',
  // Typography.
  '--lr-font',
  '--lr-font-mono',
  '--lr-font-size-3xs',
  '--lr-font-size-2xs',
  '--lr-font-size-xs',
  '--lr-font-size-sm',
  '--lr-font-size-md-sm',
  '--lr-font-size-m',
  '--lr-font-size-lg',
  '--lr-font-size-xl',
  '--lr-font-size-2xl',
  '--lr-font-size-3xl',
  '--lr-font-weight-normal',
  '--lr-font-weight-medium',
  '--lr-font-weight-semibold',
  '--lr-font-weight-bold',
  // The focus ring, and the two states an application's own control has to render.
  '--lr-focus-ring',
  '--lr-focus-ring-color',
  '--lr-focus-ring-width',
  '--lr-focus-ring-offset',
  '--lr-opacity-disabled',
  '--lr-opacity-muted',
  // The discrete-transition motion pair, so an application's own transitions share the rhythm.
  '--lr-duration-fast',
  '--lr-duration-base',
  '--lr-easing-standard',
  '--lr-easing-emphasized',
  '--lr-transition-fast',
  '--lr-transition-base',
  // Documented as stable since its introduction; listed so the header and the guide agree.
  '--lr-transition-interactive',
]);

const ROOT_TOKENS_HEADER = `/* GENERATED by scripts/generate-design-tokens.mjs from tokens/canonical-tokens.json. */

/* @aceshooting/lyra-ui/tokens-root.css -- the document token layer as a static stylesheet.

   WHAT IT IS. Since 28.0.0 the resolved --lr-* output layer (--lr-color-*, --lr-space-*,
   --lr-radius*, --lr-shadow-*, --lr-font*, motion, focus) is declared once per document instead of
   on every component's shadow :host. theme.css ends with this exact layer, so a page that imports
   theme.css needs nothing else; without a static copy, registering the first Lyra element adopts
   the same text as a constructed stylesheet. Link this file instead of theme.css (never both) when
   a page does not use theme.css and the layer must apply before any Lyra element is registered:
     - server-rendered pages (declarative shadow roots no longer carry the layer), for a correct
       first paint before hydration;
     - application elements that read --lr-* outputs before Lyra loads;
     - an application's own declarative shadow roots that contain theme scopes (document styles,
       theme.css included, do not reach into a shadow root).
   A document whose root already resolves the private sentinel declared below skips the
   constructed copy; the copies are identical either way.

   THEME SCOPES. The layer is declared on :root and re-derived only at these elements:
     ${DOCUMENT_LAYER_SCOPES.join('\n     ')}
   A --lr-theme-* input that the layer consumes, set on an element that is not a scope, no longer
   re-derives the components below it: mark the element with data-lr-theme-scope (any value; it
   follows HTML presence semantics). Mode reaches every scope through two inherited private
   switches, so a scope that sets no mode keeps its ancestor's mode, with or without theme.css.

   STABILITY PROMISE. Every --lr-* output is now visible on :root, but only the names below are
   public API: they will not be renamed or removed outside a major version, and their meaning will
   not change. Their values may change in a minor exactly as they may inside a component. Every other
   name stays internal and may change in any release; ask for one to be added to this list rather
   than reading it from the document.
     ${wrapNames(ROOT_TOKEN_SUBSET, 92).join('\n     ')}

   HOW IT LAYERS. Outputs sit in the lr-theme cascade layer and the fallback mode switches in
   lr-base, so theme.css's mode layer and any unlayered application rule beat them whatever their
   specificity and load order. Pin Lyra's layer order first (import theme.css, or repeat the layer
   statement below) before your own layers. The file declares custom properties and nothing else,
   so importing it paints nothing by itself.

   PREFERENCES. Forced colours, increased contrast and reduced motion apply at every scope and,
   again, on every component host, so an application override cannot defeat them inside a
   component. */`;

function wrapNames(names, width) {
  const lines = [];
  let line = '';
  for (const name of names) {
    if (line && line.length + 1 + name.length > width) {
      lines.push(line);
      line = name;
    } else line = line ? `${line} ${name}` : name;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Fail-closed guard for the documented stable subset: every name must be a shared output that the
 * document layer declares (not a host-local, specialist or form-control token), so the promise can
 * be read off :root.
 */
export function validateRootTokenSubset(source) {
  const errors = [];
  const subset = new Set(ROOT_TOKEN_SUBSET);
  if (subset.size !== ROOT_TOKEN_SUBSET.length) errors.push('the tokens-root subset repeats a name');
  const layer = new Set(classifySharedTokens(source).layer);
  for (const name of ROOT_TOKEN_SUBSET) {
    const token = source.tokens?.[name];
    if (!token) {
      errors.push(`${name}: the tokens-root subset names a token that does not exist`);
      continue;
    }
    if (token.scope !== 'shared') {
      errors.push(`${name}: only resolved (shared) tokens may be published at document scope`);
    }
    if (!layer.has(name)) errors.push(`${name}: the stable subset names a token outside the document layer`);
  }
  return errors;
}

/**
 * theme.css's cascade-layer order statement, which tokens-root.css and design-tokens.css must both
 * repeat verbatim. Layer order is fixed by FIRST appearance: were either to load first naming fewer
 * layers than theme.css, every layer only theme.css names would be appended after the ones it does
 * name rather than in its declared slot. Reading the statement from theme.css keeps the three from
 * drifting, and a change there leaves both generated files stale for `check:design-tokens` to catch.
 */
export function readLayerOrderStatement(packageDir = defaultPackageDir) {
  const theme = readFileSync(path.join(packageDir, 'src', 'theme.css'), 'utf8');
  const code = theme.replace(/\/\*[\s\S]*?\*\//g, '');
  const statement = /@layer\s+lr-base\b[^;{]*;/.exec(code)?.[0];
  if (!statement) {
    throw new Error('theme.css no longer declares the Lyra cascade-layer order statement (@layer lr-base, ...;)');
  }
  return statement.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ');
}


function buildRootTokensCss(source, layerOrder) {
  return `${ROOT_TOKENS_HEADER}\n\n${buildDocumentLayerCss(source, layerOrder)}`;
}

/** A single-quoted TypeScript string literal (the source policy rejects double quotes). */
const tsString = (value) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n')}'`;
const declarationText = (entries) => entries.map(([name, value]) => `${name}:${value}`).join(';');

/**
 * The runtime half of the document layer: the adopted text (byte-identical to tokens-root.css's
 * body), the host remainder every component keeps, the specialist palettes on the mode switches,
 * and the scope vocabulary that adoption and the development diagnostic read.
 */
function buildDocumentTokenModule(source, layerOrder, packageDir) {
  const glass = JSON.parse(readFileSync(path.join(packageDir, 'tokens', 'surfaces', 'glass.json'), 'utf8'));
  const hostLocal = buildHostLocalDeclarations(source);
  const valueOf = (name) => hostLocal.find(([entry]) => entry === name)?.[1];
  const iconButton = valueOf('--lr-icon-button-size');
  const safeStart = valueOf('--lr-safe-area-inline-start');
  const safeEnd = valueOf('--lr-safe-area-inline-end');
  if (!iconButton || !safeStart || !safeEnd) throw new Error('host-local token values are missing');
  const hostCss = [
    // Private literals read by glass surfaces and touch-target floors inside component roots.
    `:host{${declarationText([
      ['--_lr-surface-default-blur', glass.blur],
      ['--_lr-surface-default-maximum-blur', glass.maximumBlur],
      ['--_lr-surface-default-highlight', glass.highlight],
      ['--_lr-glass-dark-anchor', glass.darkFillAnchor],
      ...hostLocal,
      ['--_lr-touch-target-min', '2.75rem'],
    ])}}`,
    // Safe-area environment variables are physical; mirror the logical aliases per element.
    `:host(:dir(rtl)){${declarationText([
      ['--lr-safe-area-inline-start', safeEnd],
      ['--lr-safe-area-inline-end', safeStart],
    ])}}`,
    // Icon-only controls stay at least 44px on coarse pointers (TOUCH_TARGET_FLOOR).
    `@media (hover:none),(pointer:coarse){:host{--lr-icon-button-size:max(${iconButton}, 2.75rem)}}`,
    buildHostPreferenceCss(source),
  ].join('\n');
  const exports = [
    ['DOCUMENT_TOKEN_CSS', 'The document token layer, adopted once per document and published as tokens-root.css.', buildDocumentLayerCss(source, layerOrder)],
    ['HOST_TOKEN_CSS', 'Token declarations every component host keeps: host-local names and the preference arms.', hostCss],
    ['SPECIALIST_TOKEN_CSS', 'The chart, graph and terminal palettes, per host, on the inherited mode switches.', buildSpecialistHostCss(source)],
    ['GLASS_FOCUS_RING_DECLARATIONS', 'Focus-ring outputs a glass surface host restates against its qualified colour.', declarationText(buildGlassFocusRingDeclarations(source))],
    ['DOCUMENT_TOKEN_SCOPE_SELECTOR', 'Every theme scope that can match inside a shadow tree, for Element.closest().', IN_TREE_SCOPE_SELECTOR],
    ['DOCUMENT_TOKEN_SENTINEL', 'Private custom property the layer declares on :root.', DOCUMENT_LAYER_SENTINEL],
    ['DOCUMENT_TOKEN_LAYER_ID', 'Content hash the layer declares as the sentinel value.', documentLayerIdOf(buildDocumentLayerCss(source, layerOrder))],
  ];
  const lines = [
    '// GENERATED by scripts/generate-design-tokens.mjs from tokens/canonical-tokens.json. Do not edit.',
    ...exports.flatMap(([name, doc, value]) => [`/** @internal ${doc} */`, `export const ${name} = ${tsString(value)};`]),
    '/** @internal Attributes whose presence makes an element a theme scope. */',
    `export const DOCUMENT_TOKEN_SCOPE_ATTRIBUTES: readonly string[] = [${DOCUMENT_LAYER_SCOPE_ATTRIBUTES.map(tsString).join(', ')}];`,
    '/** @internal --lr-theme-* inputs the layer consumes; only these need a theme scope. */',
    `export const LAYER_CONSUMED_INPUTS: readonly string[] = [${layerConsumedInputs(source).map(tsString).join(', ')}];`,
    '',
  ];
  return lines.join('\n');
}

/** The data the dependency-free `theme-scopes` migration rule embeds (copied into dist/cli). */
function buildThemeScopeVocabularyModule(source) {
  return `// GENERATED by scripts/generate-design-tokens.mjs from tokens/canonical-tokens.json. Do not edit.
// The document token layer's vocabulary for the theme-scopes migration rule (RFC 0002).
export const THEME_SCOPE_VOCABULARY = Object.freeze(${JSON.stringify(themeScopeVocabulary(source), null, 2).replaceAll('"', "'")});
`;
}

/**
 * The per-mode records (tokens.styles.ts, palette.styles.ts, specialist-tokens.styles.ts) are no
 * longer adopted by components, but they remain the human-readable mirror that the palette, chart,
 * terminal and contrast tooling edit and read. Their public names must partition exactly into the
 * document layer plus the host-local set, and the specialist palettes.
 */
export function verifyRecordPartition(source, packageDir = defaultPackageDir) {
  const errors = [];
  const names = (relative) => new Set([...readFileSync(path.join(packageDir, relative), 'utf8')
    .matchAll(/^\s*(--lr-[a-z0-9-]+):/gm)].map((match) => match[1]).filter((name) => source.tokens[name]));
  const shared = new Set([...names('src/internal/tokens.styles.ts'), ...names('src/internal/tokens/palette.styles.ts')]);
  const specialistRecord = names('src/internal/specialist-tokens.styles.ts');
  const { layer, hostLocal, specialist } = classifySharedTokens(source);
  const expectShared = new Set([...layer, ...hostLocal]);
  for (const name of shared) if (!expectShared.has(name)) errors.push(`${name}: declared in the shared record but outside the document layer`);
  for (const name of expectShared) if (!shared.has(name)) errors.push(`${name}: layer token missing from the shared record`);
  for (const name of specialist) if (!specialistRecord.has(name)) errors.push(`${name}: specialist token missing from the specialist record`);
  for (const name of specialistRecord) if (!specialist.includes(name)) errors.push(`${name}: specialist record declares a non-specialist token`);
  return errors;
}

function tokenPath(name) {
  const theme = name.startsWith('--lr-theme-');
  const stem = name.replace(/^--lr-(?:theme-)?/, '');
  return [theme ? 'theme' : null, ...stem.split('-')].filter(Boolean);
}

function dtcgValue(type, raw) {
  if (/\b(?:var|env)\(/.test(raw)) return { type: 'string', value: raw };
  const numericUnit = /^(-?(?:\d+\.?\d*|\.\d+))(px|rem|em|ch|vw|vh|ms|s)$/.exec(raw);
  // The DTCG 2025.10 dimension type intentionally admits only px/rem. CSS-relative units remain
  // interoperable string tokens instead of being mislabeled as valid DTCG dimensions.
  if (type === 'dimension' && numericUnit && ['px', 'rem'].includes(numericUnit[2])) {
    return { type, value: { value: Number(numericUnit[1]), unit: numericUnit[2] } };
  }
  if (type === 'duration' && numericUnit && ['ms', 's'].includes(numericUnit[2])) {
    return { type, value: { value: Number(numericUnit[1]), unit: numericUnit[2] } };
  }
  if (type === 'fontWeight' && /^\d+$/.test(raw)) return { type, value: Number(raw) };
  if (type === 'number' && /^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return { type, value: Number(raw) };
  const hex = /^#([0-9a-f]{3,8})$/i.exec(raw)?.[1];
  if (type === 'color' && hex) {
    const expanded = hex.length === 3 || hex.length === 4
      ? Array.from(hex, (character) => character + character).join('')
      : hex;
    if (expanded.length === 6 || expanded.length === 8) {
      const channels = [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16));
      const alpha = expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1;
      return {
        type,
        value: {
          colorSpace: 'srgb',
          components: channels.map((channel) => Number((channel / 255).toFixed(6))),
          alpha: Number(alpha.toFixed(6)),
          hex: `#${expanded.slice(0, 6).toLowerCase()}`,
        },
      };
    }
  }
  const rgb = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)$/i.exec(raw);
  if (type === 'color' && rgb) {
    const alphaNumber = rgb[4] === undefined ? 1 : Number(rgb[4]) / (rgb[5] === '%' ? 100 : 1);
    const channels = [rgb[1], rgb[2], rgb[3]].map(Number);
    return {
      type,
      value: {
        colorSpace: 'srgb',
        components: channels.map((channel) => Number((channel / 255).toFixed(6))),
        alpha: Number(alphaNumber.toFixed(6)),
        hex: `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`,
      },
    };
  }
  if (type === 'fontFamily') return { type, value: raw.split(',').map((part) => part.trim()) };
  return { type: 'string', value: raw };
}

function assignDtcg(root, segments, token) {
  let cursor = root;
  for (const segment of segments) {
    const existing = cursor[segment];
    if (existing?.$value !== undefined) cursor[segment] = { $root: existing };
    cursor = (cursor[segment] ??= {});
  }
  if (Object.keys(cursor).length) cursor.$root = token;
  else Object.assign(cursor, token);
}

/** Portable look definitions remain sparse; omitted inputs resolve from the document's base tokens. */
export function buildLookInterchange(looks) {
  const definitions = new Map([['lyra', { id: 'lyra', tokens: {} }]]);
  for (const look of [...looks].sort((left, right) => String(left?.id).localeCompare(String(right?.id)))) {
    validateLook(look);
    if (definitions.has(look.id)) throw new Error(`Duplicate or reserved look id: ${look.id}`);
    const tokens = Object.fromEntries(Object.entries(look.tokens)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => [name, typeof value === 'string' ? value : Object.fromEntries(
        ['light', 'dark'].filter(mode => Object.hasOwn(value, mode)).map(mode => [mode, value[mode]]),
      )]));
    definitions.set(look.id, { id: look.id, tokens });
  }
  return { schemaVersion: 1, base: 'lyra', definitions: Object.fromEntries(definitions) };
}

function readLookInterchange(packageDir) {
  const directory = path.join(packageDir, 'tokens', 'looks');
  const looks = readdirSync(directory).filter(file => file.endsWith('.json')).sort().map(file => {
    const look = JSON.parse(readFileSync(path.join(directory, file), 'utf8'));
    if (look?.id !== file.slice(0, -'.json'.length)) throw new Error(`Look id must match its source filename: tokens/looks/${file}`);
    return look;
  });
  return buildLookInterchange(looks);
}

function buildDtcg(source, looks, options) {
  const root = {
    $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
    $extensions: {
      'com.aceshooting.lyra': {
        schemaVersion: source.schemaVersion,
        authority: source.source.authority,
        cleanRoom: source.source.cleanRoom,
      },
      'com.aceshooting.lyra.looks': looks,
      'com.aceshooting.lyra.options': options,
    },
  };
  for (const [name, token] of Object.entries(source.tokens)) {
    const converted = dtcgValue(token.type, token.values.light);
    const modes = Object.fromEntries(
      Object.entries(token.values)
        .filter(([mode]) => mode !== 'light')
        .map(([mode, value]) => [mode, dtcgValue(token.type, value).value]),
    );
    assignDtcg(root, tokenPath(name), {
      $type: converted.type,
      $value: converted.value,
      $description: token.description,
      $extensions: {
        'com.aceshooting.lyra': {
          cssCustomProperty: name,
          cssType: token.type,
          scope: token.scope,
          group: token.group,
          ...(token.themeInput ? { themeInput: token.themeInput } : {}),
          ...(token.valueNameClassification
            ? {
                valueNameClassification: token.valueNameClassification,
                compatibility: token.compatibility,
                evidence: token.evidence,
              }
            : {}),
        },
        ...(Object.keys(modes).length ? { 'com.aceshooting.lyra.modes': modes } : {}),
      },
    });
  }
  return root;
}

function buildPreview(source) {
  const groups = new Map();
  for (const [name, token] of Object.entries(source.tokens)) {
    if (!groups.has(token.group)) groups.set(token.group, []);
    groups.get(token.group).push({ name, type: token.type, scope: token.scope, values: token.values });
  }
  const output = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, tokens]) => ({ group, tokens }));
  return `// GENERATED by packages/lyra-ui/scripts/generate-design-tokens.mjs. Do not edit.\n` +
    `export const LYRA_TOKEN_PREVIEW_GROUPS = Object.freeze(${JSON.stringify(output, null, 2)});\n`;
}

/**
 * llms/tokens.md (scripts/build-llms.mjs's buildTokens()) reads only name/scope/themeInput/values,
 * never `description` -- most of it is boilerplate ("Canonical shared component token for <name>.")
 * restating the name anyway, so it is dropped here rather than duplicated into an unread fixture.
 */
function buildDocsInput(source) {
  return {
    schemaVersion: 1,
    authority: source.source.authority,
    tokens: Object.entries(source.tokens).map(([name, { description: _description, ...rest }]) => ({
      name,
      ...rest,
    })),
  };
}

function buildEditorInput(source) {
  const properties = new Map();
  for (const [name, token] of Object.entries(source.tokens)) {
    properties.set(name, {
      name,
      description: token.description,
      references: token.themeInput ? [token.themeInput] : [],
    });
  }
  for (const [name, token] of cssInputTokens(source)) {
    if (!properties.has(name)) {
      properties.set(name, { name, description: token.description, references: [] });
    }
  }
  properties.set('--lr-surface-background', { name: '--lr-surface-background', description: 'Base fill for the opt-in lr-surface-chrome native utility; falls back to the local semantic overlay surface.', references: [] });
  return { schemaVersion: 1, properties: [...properties.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

/** CSS, editor and preview exports carry the effective default profile; design-tokens.json keeps the authored Lyra tree and names the default in `defaultStyle`. */
export function projectDefaultTokenSource(source, packageDir = defaultPackageDir) {
  const projected = structuredClone(source);
  const inputs = defaultStyleInputs(readStyleModel(packageDir));
  for (const [name, token] of Object.entries(projected.tokens)) {
    for (const mode of ['light', 'dark']) {
      const value = token.values[mode];
      if (value === undefined) continue;
      token.values[mode] = token.scope === 'theme-input' ? inputs[name]?.[mode] ?? inputs[name]?.light ?? value : replaceStyleFallbacks(value, inputs, mode, source.tokens);
    }
  }
  return projected;
}

export function buildDesignTokenArtifacts(source, packageDir = defaultPackageDir) {
  const canonicalSource = source;
  source = projectDefaultTokenSource(source, packageDir);
  const repoDir = path.resolve(packageDir, '..', '..');
  const layerOrder = readLayerOrderStatement(packageDir);
  const looks = readLookInterchange(packageDir);
  const profile = readStyleModel(packageDir).defaults;
  looks.defaultStyle = profile;
  const options = buildOptionPresetInterchange(readOptionPresetSources(packageDir));
  return [
    [path.join(packageDir, 'design-tokens.json'), publishedJson(buildDtcg(canonicalSource, looks, options))],
    [path.join(packageDir, 'src', 'styles', 'design-tokens.css'), buildCss(source, layerOrder)],
    [path.join(packageDir, 'src', 'styles', 'tokens-root.css'), buildRootTokensCss(source, layerOrder)],
    [path.join(packageDir, 'src', 'internal', 'document-tokens.generated.ts'), buildDocumentTokenModule(source, layerOrder, packageDir)],
    [path.join(packageDir, 'scripts', 'theme-scope-vocabulary.generated.mjs'), buildThemeScopeVocabularyModule(source)],
    [path.join(repoDir, '.storybook', 'token-preview.generated.js'), buildPreview(source)],
    [path.join(packageDir, 'scripts', 'fixtures', 'token-docs.generated.json'), json(buildDocsInput(source))],
    [path.join(packageDir, 'scripts', 'fixtures', 'token-editor.generated.json'), json(buildEditorInput(source))],
  ];
}

export function generateDesignTokenArtifacts({ packageDir = defaultPackageDir, check = false } = {}) {
  const source = readCanonicalTokens(packageDir);
  const errors = [
    ...validateCanonicalTokens(source),
    ...validateRootTokenSubset(source),
    ...verifyRuntimeTokenParity(source, packageDir),
    ...verifyRecordPartition(source, packageDir),
    ...validateDocumentLayer(projectDefaultTokenSource(source, packageDir)),
  ];
  if (errors.length) throw new Error(`Design-token validation failed:\n- ${errors.join('\n- ')}`);
  const stale = [];
  for (const [file, content] of buildDesignTokenArtifacts(source, packageDir)) {
    if (check) {
      if (!existsSync(file) || readFileSync(file, 'utf8') !== content) {
        stale.push(normalizePath(path.relative(packageDir, file)));
      }
    } else {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
  }
  if (stale.length) throw new Error(`Generated design-token artifacts are stale:\n- ${stale.join('\n- ')}`);
  return stale;
}

if (isMainModule(import.meta.url)) {
  const check = process.argv.includes('--check');
  try {
    generateDesignTokenArtifacts({ check });
    console.log(check ? 'Canonical design-token artifacts are fresh.' : 'Canonical design-token artifacts generated.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

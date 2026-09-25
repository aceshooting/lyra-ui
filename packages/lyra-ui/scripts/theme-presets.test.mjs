// Structural contract for the opt-in look presets under src/themes/*.css.
//
// A preset is layered ABOVE theme.css (`lr-theme-preset` sorts after `lr-theme`), and it declares
// its light values on `:root` as well as on the explicit light selectors. That combination has one
// sharp edge, and it is the reason this file exists: any token the light block sets but the dark
// block does NOT re-set keeps its light value inside a dark scope, because the preset's `:root`
// declaration outranks theme.css's own dark declaration for that token. Nothing renders wrongly in
// light mode, so a missing dark twin is invisible until someone looks at the dark page. The key-set
// equality below turns that into a failing test instead.
//
// The other invariants are cascade-order ones. Layer order is fixed by the FIRST statement that
// names a layer: if any Lyra stylesheet that can load first still carried the pre-preset order,
// `lr-theme-preset` would be appended after `lr-overrides` and silently outrank an application's
// own override layer. So every shipped statement must be byte-identical.
//
// Run: node --test scripts/theme-presets.test.mjs

import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compactBuildCss } from './compact-build-css.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceDir = join(packageDir, 'src');
const themesDir = join(sourceDir, 'themes');

const LAYER_ORDER = '@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;';
const LIGHT_SELECTORS = [':root', '.lr-light', "[data-lr-theme='light']", '.light'];
const DARK_SELECTORS = ['.lr-dark', "[data-lr-theme='dark']", '.dark'];
// The marker comments that fence, inside each mode block, the inputs a preset repeats from theme.css
// without restyling them. Everything a preset declares OUTSIDE the fence is what it restyles on
// purpose; src/themes/shadcn.test.ts derives its own restyled list from the same two comments.
const REPEATED_START = 'BEGIN REPEATED BASE THEME VALUES';
const REPEATED_END = 'END REPEATED BASE THEME VALUES';

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every `@layer a, b, c;` ordering statement in a stylesheet, comments removed. */
function layerStatements(text) {
  return [...stripComments(text).matchAll(/@layer\s+[a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)+\s*;/g)].map((match) =>
    match[0].replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\s*;$/, ';'),
  );
}

/**
 * Splits a preset into its top-level structure: the ordering statement(s), and the rules inside
 * each `@layer <name> { ... }` block. The preset is authored CSS with a deliberately flat shape
 * (one layer block, plain rules, no nesting), so a brace-depth walk is exact here.
 */
function parsePreset(text) {
  const source = stripComments(text);
  const layers = [];
  let index = 0;
  let outside = '';
  while (index < source.length) {
    const open = source.slice(index).match(/@layer\s+([a-z0-9-]+)\s*\{/);
    if (!open) {
      outside += source.slice(index);
      break;
    }
    const start = index + open.index;
    outside += source.slice(index, start);
    let depth = 0;
    let cursor = start + open[0].length - 1;
    for (; cursor < source.length; cursor += 1) {
      if (source[cursor] === '{') depth += 1;
      else if (source[cursor] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    assert.equal(depth, 0, `unbalanced braces in @layer ${open[1]}`);
    const body = source.slice(start + open[0].length, cursor);
    const rules = [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
      selectors: match[1].split(',').map((selector) => selector.trim()).filter(Boolean),
      declarations: [...match[2].matchAll(/((?:--)?[a-z][a-z0-9-]*)\s*:\s*([^;]+);/gi)].map((declaration) => ({
        name: declaration[1],
        raw: declaration[2].trim(),
        value: declaration[2].trim().replace(/\s+/g, ' '),
      })),
    }));
    layers.push({ name: open[1], body, rules });
    index = cursor + 1;
  }
  return { outside: outside.trim(), layers };
}

const customProperties = (rule) =>
  new Map(rule.declarations.filter(({ name }) => name.startsWith('--')).map(({ name, value }) => [name, value]));

/** Every `var(--x)` reference in a value, with whether it carries its own fallback. */
function varReferences(value) {
  const references = [];
  for (const match of value.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,)?/gi)) {
    references.push({ name: match[1], hasFallback: Boolean(match[2]) });
  }
  return references;
}

function presetFiles() {
  return readdirSync(themesDir)
    .filter((name) => name.endsWith('.css'))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(themesDir, name), 'utf8') }));
}

function modeBlocks(name, parsed) {
  const layer = parsed.layers[0];
  const light = layer.rules.findIndex((rule) => rule.selectors.includes(':root'));
  const dark = layer.rules.findIndex((rule) => rule.selectors.includes('.lr-dark'));
  assert.ok(light >= 0, `${name}: no light block (the rule whose selector list includes :root)`);
  assert.ok(dark >= 0, `${name}: no dark block (the rule whose selector list includes .lr-dark)`);
  return { light: layer.rules[light], dark: layer.rules[dark], lightIndex: light, darkIndex: dark };
}

test('at least one preset ships, so every assertion below is non-vacuous', () => {
  assert.ok(presetFiles().length > 0, 'src/themes/ contains no .css preset');
  assert.ok(presetFiles().some(({ name }) => name === 'shadcn.css'), 'src/themes/shadcn.css is missing');
});

test('every shipped Lyra stylesheet declares the identical layer order, including lr-theme-preset', () => {
  const assets = [
    join(sourceDir, 'theme.css'),
    join(sourceDir, 'styles', 'native.css'),
    join(sourceDir, 'styles', 'utilities.css'),
    join(sourceDir, 'styles', 'tokens-root.css'),
    join(sourceDir, 'styles', 'design-tokens.css'),
    ...presetFiles().map(({ name }) => join(themesDir, name)),
  ];
  const mismatches = [];
  for (const file of assets) {
    const statements = layerStatements(readFileSync(file, 'utf8'));
    if (statements.length !== 1 || statements[0] !== LAYER_ORDER) {
      mismatches.push(`${file.slice(packageDir.length + 1)}: ${statements.join(' | ') || '(none)'}`);
    }
  }
  assert.deepEqual(mismatches, []);
});

// The published copies are minified, and the minifier does not keep an ordering statement intact:
// it splits `@layer a, b, c, d, e;` around the block that follows (theme.css ships as
// `@layer lr-base;@layer lr-theme{...}@layer lr-theme-preset,lr-utilities,lr-overrides;`). That is
// only safe while each file still NAMES the five layers in the same first-appearance order, which
// is what actually fixes the cascade when that file happens to load first. Run the real build step
// over copies and check exactly that, so a minifier change cannot silently reorder a shipped file.
test('the published (minified) copies still name the five layers in the same first-appearance order', async () => {
  const assets = [
    join(sourceDir, 'theme.css'),
    join(sourceDir, 'styles', 'native.css'),
    join(sourceDir, 'styles', 'utilities.css'),
    join(sourceDir, 'styles', 'tokens-root.css'),
    join(sourceDir, 'styles', 'design-tokens.css'),
    ...presetFiles().map(({ name }) => join(themesDir, name)),
  ];
  const expected = LAYER_ORDER.replace(/^@layer\s+|;$/g, '').split(', ');
  const scratch = mkdtempSync(join(tmpdir(), 'lyra-layer-order-'));
  try {
    const copies = assets.map((file, index) => {
      const copy = join(scratch, `${index}-${basename(file)}`);
      copyFileSync(file, copy);
      return { file, copy };
    });
    await compactBuildCss(scratch);
    const mismatches = [];
    for (const { file, copy } of copies) {
      const seen = [];
      for (const match of readFileSync(copy, 'utf8').matchAll(/@layer\s+([^{;]+)[{;]/g)) {
        for (const layer of match[1].split(',').map((name) => name.trim())) {
          if (!seen.includes(layer)) seen.push(layer);
        }
      }
      if (seen.join(',') !== expected.join(',')) {
        mismatches.push(`${file.slice(packageDir.length + 1)}: ${seen.join(', ')}`);
      }
    }
    assert.deepEqual(mismatches, []);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('the layer-order statement leads each preset, and every rule sits inside @layer lr-theme-preset', () => {
  for (const { name, text } of presetFiles()) {
    const firstStatement = stripComments(text).trim().split('\n')[0].trim();
    assert.equal(firstStatement, LAYER_ORDER, `${name}: the layer statement must come first`);
    const parsed = parsePreset(text);
    assert.equal(parsed.outside, LAYER_ORDER, `${name}: nothing but the layer statement may sit outside the layer block`);
    assert.deepEqual(
      parsed.layers.map((layer) => layer.name),
      ['lr-theme-preset'],
      `${name}: expected exactly one @layer lr-theme-preset block`,
    );
  }
});

// Tooling reads a preset as data (a theme-token generator consumes these files), so the shape is a
// contract rather than a style preference: one layer block holding exactly the light rule and then
// the dark rule, only --lr-theme-* declarations plus an optional color-scheme, one line per value,
// nothing a data reader would have to evaluate, and every role's fill tier paired with its on tier.
test('each preset keeps the machine-readable file shape', () => {
  for (const { name, text } of presetFiles()) {
    const [layer] = parsePreset(text).layers;
    assert.ok(!layer.body.includes('@'), `${name}: no at-rule (@media, @supports, ...) may sit inside the preset layer`);
    assert.equal(layer.rules.length, 2, `${name}: the preset layer must hold exactly two rules, light then dark`);
    assert.ok(layer.rules[0].selectors.includes("[data-lr-theme='light']"), `${name}: the first rule must be the light rule`);
    assert.ok(layer.rules[1].selectors.includes("[data-lr-theme='dark']"), `${name}: the second rule must be the dark rule`);
    for (const [index, rule] of layer.rules.entries()) {
      const mode = index === 0 ? 'light' : 'dark';
      for (const { name: property, raw } of rule.declarations) {
        assert.ok(
          property.startsWith('--lr-theme-') || property === 'color-scheme',
          `${name} ${mode}: ${property} is neither a --lr-theme-* input nor color-scheme`,
        );
        assert.ok(!raw.includes('\n'), `${name} ${mode}: ${property} spans more than one line`);
        assert.ok(!/url\(|!important/i.test(raw), `${name} ${mode}: ${property} uses url() or !important`);
        let depth = 0;
        for (const character of raw) {
          if (character === '(') depth += 1;
          if (character === ')') depth -= 1;
          assert.ok(depth >= 0, `${name} ${mode}: ${property} closes a bracket it never opened`);
        }
        assert.equal(depth, 0, `${name} ${mode}: ${property} leaves a bracket open`);
      }
      const declared = new Set(rule.declarations.map((declaration) => declaration.name));
      for (const property of declared) {
        const pair = property.match(/^--lr-theme-color-([a-z]+)-(fill|on)-(quiet|normal|loud)$/);
        if (!pair) continue;
        const twin = `--lr-theme-color-${pair[1]}-${pair[2] === 'fill' ? 'on' : 'fill'}-${pair[3]}`;
        assert.ok(declared.has(twin), `${name} ${mode}: ${property} is set without ${twin}`);
      }
    }
  }
});

test('the light and dark blocks use the documented selectors, dark declared after light', () => {
  for (const { name, text } of presetFiles()) {
    const { light, dark, lightIndex, darkIndex } = modeBlocks(name, parsePreset(text));
    assert.deepEqual(light.selectors, LIGHT_SELECTORS, `${name}: light block selectors`);
    assert.deepEqual(dark.selectors, DARK_SELECTORS, `${name}: dark block selectors`);
    // Equal specificity, so source order is what lets the dark block win on an element that
    // matches both (`:root` is always also the element that carries `.dark`/`data-lr-theme`).
    assert.ok(darkIndex > lightIndex, `${name}: the dark block must be declared after the light block`);
  }
});

test('light and dark blocks declare exactly the same custom properties', () => {
  for (const { name, text } of presetFiles()) {
    const { light, dark } = modeBlocks(name, parsePreset(text));
    const lightKeys = [...customProperties(light).keys()].sort();
    const darkKeys = [...customProperties(dark).keys()].sort();
    assert.ok(lightKeys.length > 0, `${name}: the light block declares no custom properties`);
    const onlyLight = lightKeys.filter((key) => !darkKeys.includes(key));
    const onlyDark = darkKeys.filter((key) => !lightKeys.includes(key));
    assert.deepEqual({ onlyLight, onlyDark }, { onlyLight: [], onlyDark: [] }, `${name}: mode blocks disagree`);
    // `color-scheme` is not a custom property but it is mode state all the same: a `.dark` region
    // that kept `light` would render native scrollbars and form widgets light-on-dark.
    const scheme = (rule) => rule.declarations.find((declaration) => declaration.name === 'color-scheme')?.value;
    assert.deepEqual([scheme(light), scheme(dark)], ['light', 'dark'], `${name}: color-scheme per mode`);
  }
});

test('mode blocks only set --lr-theme-* inputs, and every alias resolves on the same element', () => {
  for (const { name, text } of presetFiles()) {
    const { light, dark } = modeBlocks(name, parsePreset(text));
    for (const [mode, rule] of [['light', light], ['dark', dark]]) {
      const declared = customProperties(rule);
      for (const [property, value] of declared) {
        assert.match(property, /^--lr-theme-/, `${name} ${mode}: ${property} is not a --lr-theme-* input`);
        for (const reference of varReferences(value)) {
          // A reference to a token this block does not declare would resolve against whatever the
          // element inherits -- a light value inside a nested dark region, or nothing at all when
          // theme.css is absent. Either the block declares it or the reference carries a fallback.
          assert.ok(
            declared.has(reference.name) || reference.hasFallback,
            `${name} ${mode}: ${property} reads ${reference.name}, which this block neither declares nor falls back from`,
          );
        }
      }
      // No alias chain may loop back on itself.
      const visit = (property, trail) => {
        assert.ok(!trail.includes(property), `${name} ${mode}: custom-property cycle ${[...trail, property].join(' -> ')}`);
        for (const reference of varReferences(declared.get(property) ?? '')) {
          if (declared.has(reference.name)) visit(reference.name, [...trail, property]);
        }
      };
      for (const property of declared.keys()) visit(property, []);
    }
  }
});

test('shadcn: neutral loud slots alias the brand loud slots in both modes, so an accent repaints primary', () => {
  const text = readFileSync(join(themesDir, 'shadcn.css'), 'utf8');
  const { light, dark } = modeBlocks('shadcn.css', parsePreset(text));
  for (const [mode, rule] of [['light', light], ['dark', dark]]) {
    const declared = customProperties(rule);
    for (const channel of ['fill', 'on', 'border']) {
      assert.equal(
        declared.get(`--lr-theme-color-neutral-${channel}-loud`),
        `var(--lr-theme-color-brand-${channel}-loud)`,
        `${mode}: neutral ${channel}-loud must alias brand ${channel}-loud`,
      );
      // The alias target is a literal in the same block, so with no accent the rendering is the
      // literal and nothing depends on an inherited value.
      assert.match(declared.get(`--lr-theme-color-brand-${channel}-loud`) ?? '', /^#[0-9a-f]{6}$/i);
    }
    // Quiet and normal neutral tiers never follow an accent: they are literal greys.
    for (const tier of ['quiet', 'normal']) {
      for (const channel of ['fill', 'on', 'border']) {
        assert.match(
          declared.get(`--lr-theme-color-neutral-${channel}-${tier}`) ?? '',
          /^#[0-9a-f]{6}$/i,
          `${mode}: neutral ${channel}-${tier} must be a literal`,
        );
      }
    }
  }
});

const DECLARATION = /((?:--)?[a-z][a-z0-9-]*)\s*:\s*([^;]+);/gi;
const declarationMap = (text) =>
  new Map(
    [...text.matchAll(DECLARATION)]
      .filter((match) => match[1].startsWith('--'))
      .map((match) => [match[1], match[2].trim().replace(/\s+/g, ' ')]),
  );

/**
 * theme.css's light rule and dark rule inside `@layer lr-theme`, as name -> value maps. The dark rule
 * is the one naming `[data-lr-theme='dark']` WITHOUT `:root`: theme.css's consumer-scope focus-ring
 * rule names every mode selector at once and sets no --lr-theme-* input.
 */
function themeModeRules(text = readFileSync(join(sourceDir, 'theme.css'), 'utf8')) {
  const layer = parsePreset(text).layers.find(({ name }) => name === 'lr-theme');
  assert.ok(layer, 'theme.css: no @layer lr-theme block');
  const light = layer.rules.find(
    ({ selectors }) => selectors.includes("[data-lr-theme='light']") && !selectors.includes('.lr-dark'),
  );
  const dark = layer.rules.find(({ selectors }) => selectors.includes("[data-lr-theme='dark']") && !selectors.includes(':root'));
  assert.ok(light && dark, 'theme.css: the light or the dark mode rule was not found');
  return { light: customProperties(light), dark: customProperties(dark) };
}

/**
 * Splits each mode block of a preset at its marker comments. Every other comment is dropped and the
 * two markers become sentinel characters, so the innermost-rule walk still sees plain rule bodies.
 * Returns, per mode, the inputs declared between the markers (`repeated`) and outside them
 * (`restyled`), plus any structural problem with the markers themselves.
 */
function markedSections(text) {
  const problems = [];
  const source = text.replace(/\/\*([\s\S]*?)\*\//g, (_comment, body) => {
    const label = body.trim();
    if (label === REPEATED_START) return '\u0001';
    if (label === REPEATED_END) return '\u0002';
    return '';
  });
  const sections = {};
  let fenced = 0;
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((selector) => selector.trim());
    const mode = selectors.includes("[data-lr-theme='light']") ? 'light' : selectors.includes("[data-lr-theme='dark']") ? 'dark' : null;
    if (!mode) continue;
    const body = match[2];
    const starts = body.split('\u0001').length - 1;
    const ends = body.split('\u0002').length - 1;
    fenced += starts + ends;
    if (starts !== 1 || ends !== 1 || body.indexOf('\u0001') > body.indexOf('\u0002')) {
      problems.push(`${mode}: needs exactly one ${REPEATED_START} marker followed by one ${REPEATED_END} marker`);
      continue;
    }
    const [before, rest] = body.split('\u0001');
    const [inside, after] = rest.split('\u0002');
    sections[mode] = { repeated: declarationMap(inside), restyled: declarationMap(`${before}\n${after}`) };
  }
  const markers = (source.match(/[\u0001\u0002]/g) ?? []).length;
  if (markers !== fenced) problems.push('a marker comment sits outside the light or the dark rule');
  for (const mode of ['light', 'dark']) {
    if (!sections[mode] && !problems.some((problem) => problem.startsWith(`${mode}:`))) {
      problems.push(`${mode}: no mode rule was found`);
    }
  }
  return { sections, problems };
}

/**
 * Every way a preset's repeated section can drift from theme.css: a value that no longer matches
 * theme.css's value for the same mode, an input theme.css's dark rule sets that the preset neither
 * restyles nor repeats, and an input repeated although the preset restyles it or theme.css's dark
 * rule no longer sets it.
 */
function repeatedSectionFindings(presetText, themeText) {
  const theme = themeModeRules(themeText);
  const { sections, problems } = markedSections(presetText);
  const findings = [...problems];
  for (const mode of ['light', 'dark']) {
    const section = sections[mode];
    if (!section) continue;
    for (const [name, value] of section.repeated) {
      if (!theme[mode].has(name)) findings.push(`${mode}: ${name} is repeated but theme.css's ${mode} rule does not declare it`);
      else if (theme[mode].get(name) !== value) {
        findings.push(`${mode}: ${name} is ${value} but theme.css's ${mode} rule says ${theme[mode].get(name)}`);
      }
    }
    const expected = [...theme.dark.keys()].filter((name) => !section.restyled.has(name)).sort();
    const actual = [...section.repeated.keys()].sort();
    for (const name of expected.filter((key) => !actual.includes(key))) {
      findings.push(`${mode}: ${name} is set per mode by theme.css but neither restyled nor repeated`);
    }
    for (const name of actual.filter((key) => !expected.includes(key))) {
      findings.push(
        section.restyled.has(name)
          ? `${mode}: ${name} is both restyled and repeated`
          : `${mode}: ${name} is repeated but theme.css's dark rule does not set it`,
      );
    }
  }
  return findings;
}

// theme.css never answers to .dark/.light, so a preset repeats theme.css's own per-mode value for
// every input it does not restyle (see the comment above the markers in each preset). Those copies
// are the one part of a preset that can go stale without anyone editing it: regenerating a palette
// in theme.css leaves the preset overriding it with the old value, in every mode, silently. The
// rendered twin of this check lives in src/themes/shadcn.test.ts; this one runs at lint level.
test('each preset repeats theme.css verbatim between its markers, and repeats exactly what it does not restyle', () => {
  const themeText = readFileSync(join(sourceDir, 'theme.css'), 'utf8');
  const theme = themeModeRules(themeText);
  assert.ok(theme.dark.size > 50, 'theme.css dark rule parsed too few inputs for this check to mean anything');
  for (const { name, text } of presetFiles()) {
    assert.deepEqual(repeatedSectionFindings(text, themeText), [], `${name}: repeated section drifted from theme.css`);
    const { sections } = markedSections(text);
    assert.deepEqual(
      [...sections.light.restyled.keys()].sort(),
      [...sections.dark.restyled.keys()].sort(),
      `${name}: the two mode blocks restyle different inputs`,
    );
  }
  // Non-vacuous for the preset the docs ship: the fence holds the status, chart and terminal ramps,
  // and the table's own inputs sit outside it.
  const { sections } = markedSections(readFileSync(join(themesDir, 'shadcn.css'), 'utf8'));
  for (const name of ['--lr-theme-color-danger-fill-quiet', '--lr-theme-color-chart-1', '--lr-theme-terminal-color-black']) {
    assert.ok(sections.light.repeated.has(name), `shadcn.css: ${name} should sit inside the repeated section`);
  }
  for (const name of ['--lr-theme-color-surface-default', '--lr-theme-color-brand-fill-loud', '--lr-theme-color-focus']) {
    assert.ok(sections.light.restyled.has(name), `shadcn.css: ${name} should be restyled, outside the markers`);
  }
});

test('the repeated-section check reports a stale value, a missing input, a double declaration and a lost marker', () => {
  const themeText = readFileSync(join(sourceDir, 'theme.css'), 'utf8');
  const text = readFileSync(join(themesDir, 'shadcn.css'), 'utf8');
  const theme = themeModeRules(themeText);
  const darkValue = theme.dark.get('--lr-theme-color-chart-1');
  const stale = text.replace(`--lr-theme-color-chart-1: ${darkValue};`, '--lr-theme-color-chart-1: #123456;');
  assert.notEqual(stale, text, 'fixture setup: the dark chart-1 copy was not found');
  assert.deepEqual(repeatedSectionFindings(stale, themeText), [
    `dark: --lr-theme-color-chart-1 is #123456 but theme.css's dark rule says ${darkValue}`,
  ]);
  const missing = text.replace(/\n\s*--lr-theme-graph-cat-8: [^;]+;/g, '');
  assert.deepEqual(repeatedSectionFindings(missing, themeText), [
    'light: --lr-theme-graph-cat-8 is set per mode by theme.css but neither restyled nor repeated',
    'dark: --lr-theme-graph-cat-8 is set per mode by theme.css but neither restyled nor repeated',
  ]);
  const doubled = text.replace(
    `/* ${REPEATED_END} */\n  }\n\n  .lr-dark`,
    `  --lr-theme-color-focus: ${theme.light.get('--lr-theme-color-focus')};\n    /* ${REPEATED_END} */\n  }\n\n  .lr-dark`,
  );
  assert.notEqual(doubled, text, 'fixture setup: the light end marker was not found');
  assert.deepEqual(repeatedSectionFindings(doubled, themeText), ['light: --lr-theme-color-focus is both restyled and repeated']);
  const unfenced = text.replace(`/* ${REPEATED_START} */`, '/* repeated values */');
  assert.deepEqual(repeatedSectionFindings(unfenced, themeText), [
    `light: needs exactly one ${REPEATED_START} marker followed by one ${REPEATED_END} marker`,
  ]);
});

test('the parser rejects the failure shapes it exists to catch', () => {
  // A dark block missing a key the light block sets.
  const lopsided = `${LAYER_ORDER}\n@layer lr-theme-preset {\n  ${LIGHT_SELECTORS.join(', ')} { color-scheme: light; --lr-theme-a: #000000; --lr-theme-b: #111111; }\n  ${DARK_SELECTORS.join(', ')} { color-scheme: dark; --lr-theme-a: #ffffff; }\n}\n`;
  const { light, dark } = modeBlocks('fixture', parsePreset(lopsided));
  assert.deepEqual([...customProperties(light).keys()], ['--lr-theme-a', '--lr-theme-b']);
  assert.deepEqual([...customProperties(dark).keys()], ['--lr-theme-a']);
  // A stale ordering statement is recognised as one, not skipped.
  assert.deepEqual(layerStatements('@layer lr-base, lr-theme, lr-utilities, lr-overrides;\n@layer lr-theme { }'), [
    '@layer lr-base, lr-theme, lr-utilities, lr-overrides;',
  ]);
  // Comments never count as structure.
  assert.deepEqual(layerStatements('/* @layer a, b; */'), []);
});

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isLyraThemeTokenName, unsafeValueReason } from './theme-token-grammar.mjs';

const LAYERS = '@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;\n@layer lr-theme-preset.look, lr-theme-preset.density, lr-theme-preset.surface, lr-theme-preset.accent, lr-theme-preset.mode;\n';
export const STYLE_VERSION = '1';
const short = name => name.slice('--lr-theme-'.length);
const slot = (name, mode, kind = 'l') => `--_lr-${kind}${mode === 'light' ? 'l' : 'd'}-${short(name)}`;
const accentOwned = name => /^--lr-theme-color-(?:brand|success|warning|danger|neutral)-(?:fill|border|on)-(?:quiet|normal|loud)$/.test(name) || name === '--lr-theme-color-focus';
const followTarget = (name, value) => {
  const channel = name.match(/^--lr-theme-color-(?:success|warning|danger|neutral)-((?:fill|border|on)-(?:quiet|normal|loud))$/)?.[1];
  return channel && value === `var(--lr-theme-color-brand-${channel})` ? `--lr-theme-color-brand-${channel}` : null;
};
const branchValue = (value, mode) => typeof value === 'string' ? value : value?.[mode] ?? null;
export const quote = value => value === null ? 'null' : `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n').replaceAll('\r', '\\r')}'`;
const densityNames = [
  ...['2xs', 'xs', 's', 'm', 'l', '2xl'].map(size => `--lr-theme-space-${size}`),
  ...['2xs', 'xs', 's', 'm', 'l', 'xl'].map(size => `--lr-theme-form-control-height-${size}`),
  '--lr-theme-icon-button-size',
];

export function validateLook(look) {
  if (!look || typeof look.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(look.id) || look.id.length > 64 || look.id === 'custom') throw new Error('Invalid look id');
  if (!look.tokens || typeof look.tokens !== 'object' || Array.isArray(look.tokens)) throw new Error(`${look.id}: invalid look tokens`);
  const entries = Object.entries(look.tokens);
  if (entries.length > 512) throw new Error(`${look.id}: too many inputs`);
  for (const [name, value] of entries) {
    if (!isLyraThemeTokenName(name) || name.startsWith('--lr-theme-surface-')) throw new Error(`${look.id}: invalid look input ${name}`);
    if (typeof value !== 'string' && (!value || Array.isArray(value) || typeof value !== 'object' || !Object.keys(value).length || Object.keys(value).some(key => !['light', 'dark'].includes(key)))) throw new Error(`${name}: invalid mode pair`);
    if (branchValue(value, 'light') === null && branchValue(value, 'dark') === null) throw new Error(`${name}: empty mode pair`);
    if (name === '--lr-theme-shadow-color' && branchValue(value, 'light') !== branchValue(value, 'dark')) throw new Error(`${look.id}: shadow color must be mode-independent`);
    for (const mode of ['light', 'dark']) {
      const input = branchValue(value, mode);
      if (input === null) continue;
      if (unsafeValueReason(input)) throw new Error(`${look.id}: invalid ${mode} value for ${name}`);
      for (const reference of input.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (reference[1] !== '--lr-theme-shadow-color' && !followTarget(name, input)) throw new Error(`${look.id}: unresolved cross-axis reference ${reference[1]}`);
      }
    }
  }
}

export function readStyleModel(packageDir) {
  const defaults = JSON.parse(readFileSync(join(packageDir, 'tokens/default-style.json'), 'utf8'));
  if (Object.keys(defaults).sort().join(',') !== 'accent,density,look,mode,surface' || !['solid', 'glass'].includes(defaults.surface) || !['comfortable', 'compact', 'touch'].includes(defaults.density) || !['light', 'dark', 'system'].includes(defaults.mode)) throw new Error('Invalid built-in style profile');
  const canonical = JSON.parse(readFileSync(join(packageDir, 'tokens/canonical-tokens.json'), 'utf8'));
  const base = Object.fromEntries(Object.entries(canonical.tokens).filter(([, value]) => value.scope === 'theme-input').map(([name, value]) => [name, value.values]));
  const looks = readdirSync(join(packageDir, 'tokens/looks')).filter(file => file.endsWith('.json')).sort().map(file => JSON.parse(readFileSync(join(packageDir, 'tokens/looks', file), 'utf8')));
  looks.forEach(validateLook);
  const gemstones = [...readFileSync(join(packageDir, 'src/theme/gemstones-data.ts'), 'utf8').matchAll(/(\w+): \{ key: '\w+', fill: '([^']+)'/g)].map(match => match[1]);
  if (!looks.some(look => look.id === defaults.look) || !gemstones.includes(defaults.accent)) throw new Error('Unknown built-in profile look or accent');
  const names = [...new Set([...Object.keys(base), ...looks.flatMap(look => Object.keys(look.tokens))])].sort();
  const paired = names.filter(name => base[name]?.dark !== undefined || looks.some(look => typeof look.tokens[name] === 'object'));
  const density = densityNames.filter(name => names.includes(name));
  const slotted = [...new Set([...paired, ...density])].sort();
  const follow = names.filter(name => /^--lr-theme-color-(?:success|warning|danger|neutral)-(?:fill|border|on)-(?:quiet|normal|loud)$/.test(name));
  return { base, looks, names, paired, density, slotted, follow, defaults, canonical, packageDir, version: STYLE_VERSION };
}

/** The built-in profile is projected into fallback values without changing the selectable Lyra palette. */
export function defaultStyleInputs(model) {
  const look = model.looks.find(entry => entry.id === model.defaults.look);
  const result = Object.fromEntries(Object.entries(model.base).map(([name, values]) => [name, { ...values }]));
  for (const [name, value] of Object.entries(look.tokens)) {
    result[name] = typeof value === 'string' ? { light: value, ...(model.paired.includes(name) ? { dark: value } : {}) } : { ...result[name], ...value };
  }
  const gemstones = Object.fromEntries([...readFileSync(join(model.packageDir, 'src/theme/gemstones-data.ts'), 'utf8').matchAll(/(\w+): \{ key: '\w+', fill: '([^']+)'/g)].map(match => [match[1], match[2]]));
  const accent = renderAccents(model, { [model.defaults.accent]: gemstones[model.defaults.accent] });
  for (const match of accent.matchAll(/--_lr-a([ld])-([a-z0-9-]+): ([^;]+);/g)) {
    const [, mode, suffix, value] = match;
    (result[`--lr-theme-${suffix}`] ??= {})[mode === 'l' ? 'light' : 'dark'] = value;
  }
  const authored = structuredClone(result);
  for (const mode of ['light', 'dark']) {
    const resolve = (name, seen = new Set()) => {
      const value = authored[name]?.[mode] ?? authored[name]?.light;
      const reference = typeof value === 'string' && value.match(/^var\((--lr-theme-[a-z0-9-]+)\)$/)?.[1];
      if (!reference) return value;
      if (seen.has(name)) throw new Error(`Cyclic built-in fallback ${name}`);
      return resolve(reference, new Set([...seen, name]));
    };
    for (const name of Object.keys(result)) if (result[name][mode] !== undefined) result[name][mode] = resolve(name);
  }
  return result;
}

/** Replace only theme-input fallbacks; nested aliases remain balanced. */
export function replaceStyleFallbacks(source, inputs, mode) {
  const expression = /var\((--lr-theme-[a-z0-9-]+),\s*/g;
  let output = '', previous = 0, match;
  while ((match = expression.exec(source))) {
    const value = inputs[match[1]]?.[mode] ?? inputs[match[1]]?.light;
    if (!value || value === 'initial') continue;
    let end = expression.lastIndex, depth = 1;
    while (end < source.length && depth) {
      if (source[end] === '(') depth++;
      else if (source[end] === ')') depth--;
      end++;
    }
    if (depth) throw new Error(`Unclosed theme fallback ${match[1]}`);
    output += source.slice(previous, expression.lastIndex) + value + ')';
    previous = end;
    expression.lastIndex = end;
  }
  return output + source.slice(previous);
}

function branch(model, name, mode) {
  let result = `var(${slot(name, mode)})`;
  if (model.follow.includes(name)) {
    const suffix = short(name);
    const key = mode === 'light' ? 'l' : 'd';
    const target = name.replace(/color-(?:success|warning|danger|neutral)-/, 'color-brand-');
    result = `var(--_lr-f${key}-${suffix},${result})var(--_lr-o${key}-${suffix},var(${slot(target, mode, 'a')},var(${slot(target, mode)})))`;
  }
  return accentOwned(name) ? `var(${slot(name, mode, 'a')},${result})` : result;
}

function resolvedInput(model, name) {
  const value = `var(--_lr-dark-on,${branch(model, name, 'light')})var(--_lr-light-on,${branch(model, name, 'dark')})`;
  if (!model.density.includes(name)) return value;
  const spacing = name.startsWith('--lr-theme-space-');
  return `var(--_lr-dense-on,${value})var(--_lr-dense-off,max(calc((${value}) * var(--_lr-density-${spacing ? 'space' : 'control'},1)),${spacing ? '0px' : 'var(--_lr-density-target-min,0px)'}))`;
}

const declarations = entries => entries.map(([name, value, annotation]) => `    ${name}: ${value};${annotation ? ` /* ${annotation} */` : ''}`).join('\n');
const rule = (selector, entries) => `  ${selector} {\n${declarations(entries)}\n  }\n`;
function lookDeclarations(model, tokens) {
  const result = [];
  for (const [name, value] of Object.entries(tokens)) {
    if (!model.slotted.includes(name)) {
      result.push([name, branchValue(value, 'light') ?? 'initial']);
      continue;
    }
    for (const mode of ['light', 'dark']) {
      const input = branchValue(value, mode);
      if (input === null) continue;
      if (followTarget(name, input)) {
        const key = mode === 'light' ? 'l' : 'd';
        result.push([`--_lr-f${key}-${short(name)}`, ''], [`--_lr-o${key}-${short(name)}`, 'initial']);
      } else {
        result.push([slot(name, mode), input]);
        if (model.follow.includes(name)) {
          const key = mode === 'light' ? 'l' : 'd';
          result.push([`--_lr-f${key}-${short(name)}`, 'initial'], [`--_lr-o${key}-${short(name)}`, '']);
        }
      }
    }
  }
  return result;
}

const modeRule = dark => [['color-scheme', dark ? 'dark' : 'light'], ['--_lr-dark-on', dark ? '' : 'initial'], ['--_lr-light-on', dark ? 'initial' : '']];
function modeAliasSelector(id, mode) {
  const explicit = ':not(:where([data-lr-mode], [data-lr-theme], .lr-light, .lr-dark))';
  return `:where([data-lr-look='${id}']).${mode}${explicit}, :where([data-lr-look='${id}']) .${mode}${explicit}`;
}
function focusResolverDeclarations() {
  return [
    ['--lr-focus-ring-width', 'max(var(--lr-theme-focus-ring-width, 2px), var(--_lr-preference-focus-min, 0px))'], ['--lr-focus-ring-color', 'var(--_lr-glass-qualified-focus-ring-color,var(--lr-theme-color-focus,Highlight))'], ['--lr-focus-ring-offset', 'var(--lr-theme-focus-ring-offset,2px)'], ['--lr-focus-ring', 'var(--lr-focus-ring-width) solid var(--lr-focus-ring-color)'],
  ];
}
export function modeResolverDeclarations(model) {
  return model.paired.map(name => [name, resolvedInput(model, name)]).concat(focusResolverDeclarations());
}
export function renderLook(model, look, { modeAliases = false } = {}) {
  const selector = `[data-lr-look='${look.id}']`;
  let css = LAYERS + '@layer lr-theme-preset.look {\n' + rule(selector, [['--_lr-look-installed', `${look.id}-${STYLE_VERSION}`], ...lookDeclarations(model, look.tokens)]) + '}\n';
  if (modeAliases) {
    const light = modeAliasSelector(look.id, 'light');
    const dark = modeAliasSelector(look.id, 'dark');
    css += '@layer lr-theme {\n' + rule(`${light}, ${dark}`, modeResolverDeclarations(model)) + '}\n';
    css += '@layer lr-theme-preset.mode {\n' + rule(light, modeRule(false)) + rule(dark, modeRule(true)) + '}\n';
  }
  return css;
}

export function renderRuntimeLook(look) {
  const lines = Object.entries(look.tokens).map(([name, value]) => {
    const source = typeof value === 'string' ? quote(value) : `{ ${Object.entries(value).map(([mode, branch]) => `${mode}: ${quote(branch)}`).join(', ')} }`;
    return `    ${quote(name)}: ${source},`;
  });
  return `// GENERATED by scripts/generate-style-axes.mjs; edit tokens/looks/${look.id}.json.\nimport { defineLyraLook } from '../theme.js';\n\n/** The ${look.id} look as a portable, immutable runtime definition. */\nexport const LYRA_${look.id.toUpperCase().replaceAll('-', '_')}_LOOK = defineLyraLook({\n  id: '${look.id}',\n  tokens: {\n${lines.join('\n')}\n  },\n});\n`;
}

export function referenceSurfaces(model) {
  const base = model.base['--lr-theme-color-surface-default'];
  return Object.fromEntries([{ id: 'lyra', tokens: {} }, ...model.looks].map(look => [look.id,
    Object.fromEntries(['light', 'dark'].map(mode => [mode, branchValue(look.tokens['--lr-theme-color-surface-default'], mode) ?? base[mode] ?? base.light])),
  ]));
}

export function contrastSurfaces(model) {
  return Object.fromEntries(['light', 'dark'].map(mode => [mode, [...new Set(
    [{ tokens: {} }, ...model.looks].flatMap(look => ['default', 'raised', 'overlay'].map(surface => {
      const name = `--lr-theme-color-surface-${surface}`;
      return branchValue(look.tokens[name], mode) ?? model.base[name]?.[mode] ?? model.base[name]?.light;
    }).concat(Object.entries(look.tokens).filter(([name]) => /^--lr-theme-color-surface-container(?:-lowest|-low|-high|-highest)?$/.test(name)).map(([, value]) => branchValue(value, mode)).filter(Boolean))),
  )]]));
}

export function renderTheme(model) {
  const base = [];
  const defaultLook = model.looks.find(look => look.id === model.defaults.look);
  const lookBase = { ...model.base, ...Object.fromEntries(Object.entries(defaultLook.tokens).map(([name, value]) => [name, typeof value === 'string' ? { light: value, ...(model.paired.includes(name) ? { dark: value } : {}) } : { ...model.base[name], ...value }])) };
  const rootDefaults = [];
  for (const name of model.names) {
    const value = model.base[name];
    const projected = lookBase[name];
    if (model.slotted.includes(name)) {
      base.push(
        [slot(name, 'light'), value?.light ?? 'initial', value?.light === 'initial' ? 'declared optional input' : undefined],
        [slot(name, 'dark'), value?.dark ?? value?.light ?? 'initial', value?.dark === 'initial' ? 'declared optional input' : value?.dark === undefined && value?.light !== undefined ? 'mode-independent fallback' : undefined],
      );
      for (const mode of ['light', 'dark']) {
        const input = projected?.[mode] ?? projected?.light ?? 'initial';
        const original = value?.[mode] ?? value?.light ?? 'initial';
        const annotation = projected?.[mode] === 'initial' ? 'declared optional input' : mode === 'dark' && projected?.dark === undefined && projected?.light !== undefined ? 'mode-independent fallback' : undefined;
        const originalAnnotation = value?.[mode] === 'initial' ? 'declared optional input' : mode === 'dark' && value?.dark === undefined && value?.light !== undefined ? 'mode-independent fallback' : undefined;
        if (input !== original || annotation !== originalAnnotation) rootDefaults.push([slot(name, mode), input, annotation]);
      }
    } else {
      base.push([name, value?.light ?? 'initial', value?.light === 'initial' ? 'declared optional input' : undefined]);
      if (projected?.light !== value?.light) rootDefaults.push([name, projected?.light ?? 'initial', projected?.light === 'initial' ? 'declared optional input' : undefined]);
    }
  }
  for (const name of model.follow) for (const key of ['l', 'd']) base.push([`--_lr-f${key}-${short(name)}`, 'initial'], [`--_lr-o${key}-${short(name)}`, '']);
  base.push(['--_lr-look-installed', `lyra-${STYLE_VERSION}`]);
  rootDefaults.push(['--_lr-look-installed', `${model.defaults.look}-${STYLE_VERSION}`]);
  const boundaries = ':root, .lr-light, .lr-dark, [data-lr-theme], [data-lr-mode], [data-lr-look], [data-lr-accent], [data-lr-theme-scope]';
  let css = `/* GENERATED by scripts/generate-style-axes.mjs; edit tokens/canonical-tokens.json and tokens/looks/. */\n${LAYERS}@layer lr-theme {\n`;
  css += rule(':root, [data-lr-look]', base);
  // The default delta keeps the base rule's specificity and layer; explicit looks start at Lyra.
  css += rule(':root:where(:not([data-lr-look]))', rootDefaults);
  css += rule(':root', [['--_lr-dense-on', 'initial'], ['--_lr-dense-off', ''], ['--_lr-style-resolver', STYLE_VERSION]]);
  css += rule("[data-lr-accent]", model.names.filter(accentOwned).flatMap(name => [[slot(name, 'light', 'a'), 'initial'], [slot(name, 'dark', 'a'), 'initial']]).concat([['--lr-theme-accent', 'initial']]));
  css += rule(boundaries, modeResolverDeclarations(model));
  css += rule('[data-lr-contrast], [data-lr-motion]', focusResolverDeclarations());
  css += rule(':root, [data-lr-look], [data-lr-density], [data-lr-theme-scope]', model.density.map(name => [name, resolvedInput(model, name)]));
  css += '}\n@layer lr-theme-preset.mode {\n';
  css += rule(":where(:root), [data-lr-mode='light'], [data-lr-mode='system']", modeRule(false));
  css += "  @media (prefers-color-scheme: dark) {\n" + rule(":where(:root:not([data-lr-mode]):not([data-lr-theme]):not(.lr-light):not(.lr-dark)), [data-lr-mode='system']", modeRule(true)) + '  }\n';
  css += rule("[data-lr-mode='dark']", modeRule(true));
  css += rule(".lr-light, [data-lr-theme='light']", modeRule(false));
  css += rule(".lr-dark, [data-lr-theme='dark']", modeRule(true));
  css += '}\n';
  css += renderLook(model, defaultLook);
  css += renderLook(model, { id: 'lyra', tokens: {} });
  const gemstoneFill = readFileSync(join(model.packageDir, 'src/theme/gemstones-data.ts'), 'utf8').match(new RegExp(`${model.defaults.accent}: \\{ key: '[^']+', fill: '([^']+)'`))?.[1];
  const defaultAccentCss = renderAccents(model, { [model.defaults.accent]: gemstoneFill });
  const defaultAccent = [...defaultAccentCss.matchAll(/(--[_a-z0-9-]+): ([^;]+);/g)].map(match => [match[1], match[2]]);
  css += '@layer lr-theme {\n' + rule(':root:not([data-lr-accent])', defaultAccent) + '}\n';
  css += defaultAccentCss;
  const glass = JSON.parse(readFileSync(join(model.packageDir, 'tokens/surfaces/glass.json'), 'utf8'));
  return css + renderGlass(glass, { defaults: true });
}

export function renderDensity(data) {
  let css = LAYERS + '@layer lr-theme-preset.density {\n';
  for (const [id, value] of Object.entries(data)) {
    if (!['compact', 'comfortable', 'touch'].includes(id) || !Number.isFinite(value.spacing) || value.spacing <= 0 || !Number.isFinite(value.control) || value.control <= 0 || unsafeValueReason(value.target)) throw new Error(`Invalid density: ${id}`);
    css += rule(`[data-lr-density='${id}']`, [['--_lr-density-installed', STYLE_VERSION], ['--_lr-dense-on', id === 'comfortable' ? 'initial' : ''], ['--_lr-dense-off', id === 'comfortable' ? '' : 'initial'], ['--_lr-density-space', value.spacing], ['--_lr-density-control', value.control], ['--_lr-density-target-min', value.target]]);
  }
  return css + '}\n';
}

/** The native utility consumes the same protected material template as shadow chrome. */
export function renderNativeChrome(data = JSON.parse(readFileSync(new URL('../tokens/surfaces/glass.json', import.meta.url), 'utf8'))) {
  const helper = readFileSync(new URL('../src/internal/glass-surface.styles.ts', import.meta.url), 'utf8');
  const template = helper.split('return css`')[1]?.split('\n  `;\n}')[0];
  if (!template) throw new Error('Shared glass template boundary changed');
  const selector = ':where(.lr-surface-chrome)';
  const fill = 'var(--lr-surface-background, var(--lr-theme-color-surface-container-high, var(--lr-theme-color-surface-overlay, Canvas)))';
  const placeholders = new Map([
    ['surface', selector], ['children', ':where(.lr-surface-chrome > *)'], ['layer', `${selector}::before`],
    ['captureSurface', selector], ['captureScope', ":where(.lr-surface-chrome[data-lr-surface='glass'])"],
    ['captureChildren', ":where(.lr-surface-chrome[data-lr-surface='glass'] > *)"],
    ['fill', fill], ['restingFill', fill],
    ["scrolling ? css`var(--_lr-glass-viewport-width, 100%)` : css`auto`", 'auto'],
    ["scrolling ? css`var(--_lr-glass-viewport-height, 100%)` : css`auto`", 'auto'],
  ]);
  const recipe = template.replace(/\$\{([^}]+)\}/g, (_, expression) => {
    if (!placeholders.has(expression)) throw new Error(`Unrecognized shared glass placeholder ${expression}`);
    return placeholders.get(expression);
  }).replaceAll(":host([data-lr-surface='solid'])", `${selector}[data-lr-surface='solid']`)
    .replaceAll(":host([data-lr-surface='glass'])", `${selector}[data-lr-surface='glass']`).replaceAll(':host', selector)
    .replaceAll('calc(var(--lr-layer-base) - var(--lr-layer-content))', '-1')
    .replaceAll('var(--lr-border-width-thin)', 'var(--lr-border-width-thin, 1px)');
  return `\n@layer lr-theme-preset.surface {\n${rule(selector, [
    ['position', 'relative'], ['color', 'var(--lr-color-text)'],
    ['--_lr-surface-default-blur', data.blur],
    ['--_lr-surface-default-maximum-blur', data.maximumBlur],
    ['--_lr-surface-default-highlight', data.highlight],
    ['--lr-color-text', 'var(--lr-theme-color-text-normal, CanvasText)'],
    ['--_lr-glass-original-text-quiet', 'var(--_lr-preference-quiet-color, var(--lr-theme-color-text-quiet, CanvasText))'],
    ['--_lr-glass-original-border', 'var(--_lr-preference-control-color, var(--lr-theme-color-surface-border, CanvasText))'],
    ['--_lr-glass-original-focus-ring-color', 'var(--lr-theme-color-focus, Highlight)'],
    ['--lr-focus-ring-width', 'max(var(--lr-theme-focus-ring-width, 2px), var(--_lr-preference-focus-min, 0px))'],
    ['--lr-focus-ring-color', 'var(--_lr-glass-qualified-focus-ring-color, var(--_lr-glass-original-focus-ring-color))'],
    ['--lr-focus-ring-offset', 'var(--lr-theme-focus-ring-offset, 2px)'],
    ['--lr-focus-ring', 'var(--lr-focus-ring-width) solid var(--lr-focus-ring-color)'],
  ])}${recipe}\n${rule(`${selector}:popover-open, ${selector}:modal`, [['--_lr-glass-parent-opacity', 'initial !important'], ['--_lr-glass-blocker', 'var(--_lr-surface-root-filter, initial) !important']])}}\n`;
}

export function renderGlass(data, { defaults = false } = {}) {
  if (!(data.foregroundWeight >= 0.8 && data.foregroundWeight <= 1) || !(data.minimumOpacity >= 0.8 && data.minimumOpacity <= 1) || !(data.opacity >= data.minimumOpacity && data.opacity <= 1) || !(data.saturation >= 0 && data.saturation <= 2)) throw new Error('Invalid glass bounds');
  for (const name of ['blur', 'maximumBlur', 'highlight']) if (unsafeValueReason(data[name])) throw new Error(`Invalid glass ${name}`);
  const radius = value => typeof value === 'string' && /^(?:\d+|\d+\.\d+)px$/.test(value) ? Number.parseFloat(value) : NaN;
  if (!(radius(data.blur) >= 0 && radius(data.blur) <= radius(data.maximumBlur) && radius(data.maximumBlur) <= 16)) throw new Error('Invalid glass blur radius bound');
  const highlightAlpha = Number(data.highlight.match(/^rgb\(255 255 255 \/ (0(?:\.\d+)?)\)$/)?.[1]);
  if (!(highlightAlpha >= 0 && highlightAlpha <= 0.12)) throw new Error('Invalid glass highlight bound');
  const clear = data.clearMedia;
  if (!clear || !(clear.scrimStart >= 0.78 && clear.scrimStart <= 1) || !(clear.scrimEnd >= clear.scrimStart && clear.scrimEnd <= 1) || !(clear.fillOpacity >= 0 && clear.fillOpacity <= 0.08)) throw new Error('Invalid clear media bounds');
  const helper = readFileSync(new URL('../src/internal/glass-surface.styles.ts', import.meta.url), 'utf8');
  for (const [name, value] of [['--_lr-surface-min-opacity', data.minimumOpacity], ['--lr-theme-surface-opacity', data.opacity], ['--_lr-surface-foreground-weight', `${data.foregroundWeight * 100}%`], ['--lr-theme-surface-saturation', data.saturation]]) {
    if (!helper.includes(`var(${name}, ${value})`)) throw new Error(`Intrinsic glass fallback differs from canonical ${name}`);
  }

  let css = LAYERS + '@layer lr-theme-preset.surface {\n';
  css += rule(':root, :host', [['--_lr-media-clear-scrim-start', clear.scrimStart], ['--_lr-media-clear-scrim-end', clear.scrimEnd], ['--_lr-media-clear-fill', `rgb(255 255 255 / ${clear.fillOpacity})`], ['--_lr-media-clear-text', '#ffffff']]);
  css += rule(defaults ? ":root:not([data-lr-surface]), [data-lr-surface='glass']" : "[data-lr-surface='glass']", [['--_lr-surface-installed', STYLE_VERSION], ['--_lr-surface-enabled', '1'], ['--_lr-surface-root-filter', 'initial'], ['--_lr-glass-blocker', 'initial'], ['--_lr-surface-content', "''"], ['--_lr-surface-isolation', 'isolate'], ['--_lr-surface-min-opacity', data.minimumOpacity], ['--_lr-surface-maximum-blur', data.maximumBlur], ['--_lr-surface-foreground-weight', `${data.foregroundWeight * 100}%`], ['--_lr-surface-child-filter', 'none'], ['--_lr-surface-child-opacity', '1'], ['--lr-theme-surface-opacity', data.opacity], ['--lr-theme-surface-blur', data.blur], ['--lr-theme-surface-saturation', data.saturation], ['--lr-theme-surface-highlight', data.highlight]]);
  css += rule("[data-lr-surface='solid']", [['--_lr-surface-installed', STYLE_VERSION], ['--_lr-surface-enabled', '0'], ['--_lr-surface-root-filter', 'none'], ['--_lr-glass-blocker', 'none'], ['--_lr-surface-maximum-blur', 'initial'], ['--_lr-surface-content', 'none'], ['--_lr-surface-isolation', 'auto'], ['--_lr-surface-child-filter', 'initial'], ['--_lr-surface-child-opacity', '0'], ['--_lr-glass-parent-opacity', '0'], ['--_lr-next-glass-opacity', '0']]);
  return css + '}\n' + renderNativeChrome(data);
}

/** Read concrete base values from the generated asset so static color gates measure shipped data. */
export function concreteThemeCss(css) {
  if (!css.startsWith('/* GENERATED by scripts/generate-style-axes.mjs;')) return css;
  const body = css.match(/:root, \[data-lr-look\] \{([^}]+)\}/)?.[1];
  if (!body) throw new Error('Generated theme has no base input rule');
  const light = new Map();
  const dark = new Map();
  const fallbacks = new Set();
  const rootDefaults = css.match(/:root:where\(:not\(\[data-lr-look\]\)\) \{([^}]+)\}/)?.[1] ?? '';
  for (const match of `${body}\n${rootDefaults}`.matchAll(/(--(?:lr-theme-|_lr-l[ld]-)[a-z0-9-]+):\s*([^;]*);(?:[ \t]*\/\* (mode-independent fallback|declared optional input) \*\/)?/g)) {
    const [, name, rawValue, annotation] = match;
    const value = rawValue.trim();
    const declaredOptional = annotation === 'declared optional input';
    if (declaredOptional && value !== 'initial') {
      throw new Error(`Invalid declared optional input ${name}`);
    }
    if (value === 'initial' && !declaredOptional) continue;
    if (name.startsWith('--lr-theme-')) light.set(name, value);
    else if (name.startsWith('--_lr-ll-')) light.set(`--lr-theme-${name.slice(9)}`, value);
    else if (name.startsWith('--_lr-ld-')) {
      dark.set(`--lr-theme-${name.slice(9)}`, value);
      fallbacks.delete(`--lr-theme-${name.slice(9)}`);
    }
    if (annotation === 'mode-independent fallback') {
      if (!name.startsWith('--_lr-ld-')) throw new Error(`Invalid generated fallback slot ${name}`);
      fallbacks.add(`--lr-theme-${name.slice(9)}`);
    }
  }
  if (!dark.size) throw new Error('Generated theme has no dark input slots');
  for (const name of fallbacks) {
    if (dark.get(name) !== light.get(name)) throw new Error(`Generated fallback differs from light input ${name}`);
    dark.delete(name);
  }
  const authoredLight = new Map(light);
  const authoredDark = new Map(dark);
  const accentBody = css.match(/:root:not\(\[data-lr-accent\]\) \{([^}]+)\}/)?.[1];
  for (const match of (accentBody ?? '').matchAll(/--_lr-a([ld])-([a-z0-9-]+):\s*([^;]+);/g)) {
    (match[1] === 'l' ? light : dark).set(`--lr-theme-${match[2]}`, match[3].trim());
  }
  const resolve = (name, mode, seen = new Set()) => {
    const own = mode === 'light' ? light : dark;
    const value = own.get(name) ?? authoredLight.get(name);
    const reference = value?.match(/^var\((--lr-theme-[a-z0-9-]+)\)$/)?.[1];
    if (!reference) return value;
    if (seen.has(name)) throw new Error(`Cyclic concrete theme ${name}`);
    return resolve(reference, mode, new Set([...seen, name]));
  };
  for (const name of authoredLight.keys()) {
    const lightValue = resolve(name, 'light');
    const darkValue = resolve(name, 'dark');
    light.set(name, lightValue);
    if (authoredDark.has(name) || dark.has(name) || darkValue !== lightValue) dark.set(name, darkValue);
  }
  return rule(':root', [...light]) + rule(".lr-dark,\n  [data-lr-theme='dark']", [...dark]);
}

// Static named accents use one ramp per mode, qualified against every built-in reference surface.
export function renderAccents(model, gemstones) {
  const rgb = hex => {
    if (typeof hex !== 'string' || !/^#[a-f0-9]{6}$/i.test(hex)) throw new Error(`Built-in accent reference must be opaque six-digit hex: ${hex}`);
    return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  };
  const mix = (a, b, weight) => a.map((value, index) => Math.round(value * (1 - weight) + b[index] * weight));
  const luminance = color => color.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  const foreground = color => contrast(color, [0, 0, 0]) >= contrast(color, [255, 255, 255]) ? [0, 0, 0] : [255, 255, 255];
  const surfaces = contrastSurfaces(model);
  let css = LAYERS + '@layer lr-theme-preset.accent {\n';
  for (const [id, hex] of Object.entries(gemstones)) {
    const entries = [['--_lr-accent-installed', `${id}-${STYLE_VERSION}`], ['--lr-theme-accent', hex]];
    for (const mode of ['light', 'dark']) {
      const background = rgb(model.base['--lr-theme-color-surface-default'][mode]);
      const references = surfaces[mode].map(rgb);
      const floor = (color, minimum = 3, extra = []) => {
        const target = foreground(background);
        for (let step = 0; step <= 10; step++) {
          const candidate = mix(color, target, step / 10);
          if ([...references, ...extra].every(reference => contrast(candidate, reference) >= minimum)) return candidate;
        }
        throw new Error(`No shared ${mode} accent contrast of ${minimum}:1 for ${id}`);
      };
      const color = rgb(hex);
      const quiet = mix(background, color, mode === 'dark' ? 0.24 : 0.14);
      const normal = mix(background, color, mode === 'dark' ? 0.62 : 0.55);
      const loud = floor(color, 4.5, [quiet]);
      const values = {
        'fill-quiet': quiet, 'fill-normal': normal, 'fill-loud': loud,
        'border-quiet': mix(background, color, mode === 'dark' ? 0.46 : 0.38),
        'border-normal': floor(mix(background, color, mode === 'dark' ? 0.78 : 0.72)),
        'border-loud': floor(mix(loud, mode === 'dark' ? [255, 255, 255] : [0, 0, 0], 0.2)),
        'on-quiet': foreground(quiet), 'on-normal': foreground(normal), 'on-loud': foreground(loud),
      };
      for (const [channel, value] of Object.entries(values)) entries.push([slot(`--lr-theme-color-brand-${channel}`, mode, 'a'), `rgb(${value.join(' ')})`]);
      entries.push([slot('--lr-theme-color-focus', mode, 'a'), `rgb(${floor(color).join(' ')})`]);
    }
    css += rule(`[data-lr-accent='${id}']`, entries);
  }
  return css + '}\n';
}

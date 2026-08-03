#!/usr/bin/env node

// Generates every design-tool view from tokens/canonical-tokens.json. The JSON source is authored
// and authoritative; this script never discovers token metadata by scraping TypeScript. Runtime
// styles are read only by `verifyRuntimeTokenParity()` as a fail-closed drift check.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const normalizePath = (value) => value.replaceAll('\\', '/');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

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
  const theme = readFileSync(themePath, 'utf8');
  const themeDark = theme.indexOf('  .lr-dark,');
  if (themeDark < 0) throw new Error('theme.css dark-mode marker changed');
  for (const [name, value] of declarations(theme, 0, themeDark)) {
    if (name.startsWith('--lr-theme-')) add(name, 'light', value, 'theme-input');
  }
  for (const [name, value] of declarations(theme, themeDark)) {
    if (name.startsWith('--lr-theme-')) add(name, 'dark', value, 'theme-input');
  }
  return records;
}

export function verifyRuntimeTokenParity(source, packageDir = defaultPackageDir) {
  const errors = [];
  const runtime = readRuntimeTokenValues(packageDir);
  const canonical = new Map(Object.entries(source.tokens ?? {}));
  for (const [name, actual] of runtime) {
    const expected = canonical.get(name);
    if (!expected) {
      errors.push(`${name}: runtime declaration is missing from canonical-tokens.json`);
      continue;
    }
    if (expected.scope !== actual.scope) errors.push(`${name}: scope differs from runtime`);
    for (const mode of MODES) {
      const expectedValue = expected.values?.[mode];
      const actualValue = actual.values?.[mode];
      if (expectedValue !== actualValue) {
        errors.push(`${name}: ${mode} is ${JSON.stringify(actualValue)}, expected ${JSON.stringify(expectedValue)}`);
      }
    }
  }
  for (const name of canonical.keys()) {
    if (!runtime.has(name)) errors.push(`${name}: canonical token has no runtime declaration`);
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

function buildCss(source) {
  const inputs = cssInputTokens(source).filter(([, token]) => token.declared);
  const block = (mode) => inputs
    .map(([name, token]) => `    ${name}: ${modeValue(token, mode)};`)
    .join('\n');
  return `/* GENERATED by scripts/generate-design-tokens.mjs from tokens/canonical-tokens.json. */
/* Explicit design-tool/theme-fixture modes. This does not replace theme.css and intentionally has
   no :root default, so importing it cannot change Lyra's OS-following production semantics. */
@layer lr-theme {
  :where(.lr-token-light, [data-lr-design-token-mode='light']) {
${block('light')}
  }

  :where(.lr-token-dark, [data-lr-design-token-mode='dark']) {
    color-scheme: dark;
${block('dark')}
  }
}
`;
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

function buildDtcg(source) {
  const root = {
    $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
    $extensions: {
      'com.aceshooting.lyra': {
        schemaVersion: source.schemaVersion,
        authority: source.source.authority,
        cleanRoom: source.source.cleanRoom,
      },
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

function buildDocsInput(source) {
  return {
    schemaVersion: 1,
    authority: source.source.authority,
    tokens: Object.entries(source.tokens).map(([name, token]) => ({ name, ...token })),
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
  return { schemaVersion: 1, properties: [...properties.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

export function buildDesignTokenArtifacts(source, packageDir = defaultPackageDir) {
  const repoDir = path.resolve(packageDir, '..', '..');
  return [
    [path.join(packageDir, 'design-tokens.json'), json(buildDtcg(source))],
    [path.join(packageDir, 'src', 'styles', 'design-tokens.css'), buildCss(source)],
    [path.join(repoDir, '.storybook', 'token-preview.generated.js'), buildPreview(source)],
    [path.join(packageDir, 'scripts', 'fixtures', 'token-docs.generated.json'), json(buildDocsInput(source))],
    [path.join(packageDir, 'scripts', 'fixtures', 'token-editor.generated.json'), json(buildEditorInput(source))],
  ];
}

export function generateDesignTokenArtifacts({ packageDir = defaultPackageDir, check = false } = {}) {
  const source = readCanonicalTokens(packageDir);
  const errors = [...validateCanonicalTokens(source), ...verifyRuntimeTokenParity(source, packageDir)];
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  try {
    generateDesignTokenArtifacts({ check });
    console.log(check ? 'Canonical design-token artifacts are fresh.' : 'Canonical design-token artifacts generated.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

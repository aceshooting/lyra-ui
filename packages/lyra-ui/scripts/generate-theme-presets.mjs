import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isMainModule } from './is-main-module.mjs';
import { grammar, isLyraThemeTokenName, unsafeValueReason } from './theme-token-grammar.mjs';

// Generates the runtime token presets under src/theme/presets/<name>.ts from the stylesheet looks
// under src/themes/<name>.css, so the CSS file stays the single source of a look and the runtime
// preset (persisted, applied before first paint by the bootstrap) can never drift from it.
//
// The stylesheet's shape is a contract, stated in the file itself: after comments, exactly the
// layer ordering statement plus one `@layer lr-theme-preset { ... }` block holding a light rule
// (its selector list includes [data-lr-theme='light']) and then a dark rule (with
// [data-lr-theme='dark']); only --lr-theme-* declarations, plus color-scheme, which is ignored; each
// value valid under the token grammar (scripts/fixtures/theme-token-grammar.json), so the
// committed module can never throw on import; each fill-<tier> paired with its on-<tier>, and
// overlay-strong with on-strong-overlay, so the runtime floor never has to synthesize a partner
// and the CSS and runtime carriers stay string-identical; and identical key sets in both modes.
//
// Without arguments it writes; `--check` compares without writing (contract-policy); any other
// argument exits 1.

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));

const LAYER_ORDER = '@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;';
const LIGHT_SELECTOR = "[data-lr-theme='light']";
const DARK_SELECTOR = "[data-lr-theme='dark']";
const ROLES = ['brand', 'success', 'warning', 'danger', 'neutral'];
const TIERS = ['quiet', 'normal', 'loud'];
const REMEDY = 'Run `pnpm run theme-presets` and commit the generated file.';

/** Replaces every comment with spaces (newlines kept), so offsets and line numbers still line up. */
function blankComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

function lineAt(text, offset) {
  let line = 1;
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text[index] === '\n') line += 1;
  }
  return line;
}

/** Index of the first `stop` character at depth 0 outside quotes, or -1. */
function scanTo(text, start, stops) {
  let quote = '';
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '\'' || character === '"') quote = character;
    else if (stops.includes(character)) return index;
  }
  return -1;
}

function snippet(text) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 60 ? `${flat.slice(0, 57)}...` : flat;
}

/** Parses one rule body into declarations, recording line numbers and grammar errors. */
function parseDeclarations(source, bodyStart, bodyEnd, context) {
  const { file, errors } = context;
  const declarations = new Map();
  let cursor = bodyStart;
  let count = 0;
  while (cursor < bodyEnd) {
    let end = scanTo(source, cursor, [';']);
    if (end < 0 || end > bodyEnd) end = bodyEnd;
    const raw = source.slice(cursor, end);
    const leading = raw.length - raw.trimStart().length;
    const line = lineAt(source, cursor + leading);
    cursor = end + 1;
    const text = raw.trim();
    if (!text) continue;
    const colon = text.indexOf(':');
    if (colon < 0) {
      errors.push(`${file}:${line}: ${snippet(text)}: not a declaration`);
      continue;
    }
    const name = text.slice(0, colon).trim();
    const value = text.slice(colon + 1).trim();
    const declaration = snippet(text);
    if (name === 'color-scheme') continue;
    count += 1;
    if (!name.startsWith('--lr-theme-')) {
      errors.push(`${file}:${line}: ${declaration}: only --lr-theme-* inputs (and color-scheme) may be declared`);
      continue;
    }
    if (grammar.reservedNames.includes(name)) {
      errors.push(`${file}:${line}: ${declaration}: ${name} is reserved for the accent runtime`);
      continue;
    }
    if (!isLyraThemeTokenName(name)) {
      errors.push(`${file}:${line}: ${declaration}: the name is not a valid --lr-theme-* token name`);
      continue;
    }
    const reason = unsafeValueReason(value);
    if (reason) {
      errors.push(`${file}:${line}: ${declaration}: the value ${reason}`);
      continue;
    }
    if (declarations.has(name)) {
      errors.push(`${file}:${line}: ${declaration}: duplicate declaration of ${name} in this block`);
      continue;
    }
    declarations.set(name, { value, line });
  }
  if (count > grammar.entryMax) {
    errors.push(`${file}:${lineAt(source, bodyStart)}: the block declares ${count} inputs, more than the ${grammar.entryMax} a token map may carry`);
  }
  return declarations;
}

/**
 * Parses a preset stylesheet into its light and dark declaration maps. Returns `{ light, dark,
 * errors }`; every error names the file, the line, the offending text and the reason.
 */
export function parsePresetStylesheet(text, file) {
  const source = blankComments(text);
  const errors = [];
  const context = { file, errors };
  const rules = [];
  let layerStatements = 0;
  let presetBlocks = 0;
  let cursor = 0;
  while (cursor < source.length) {
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    if (cursor >= source.length) break;
    const line = lineAt(source, cursor);
    const stop = scanTo(source, cursor, [';', '{', '}']);
    if (stop < 0) {
      errors.push(`${file}:${line}: ${snippet(source.slice(cursor))}: unterminated statement`);
      break;
    }
    const prelude = source.slice(cursor, stop).trim();
    if (source[stop] === ';') {
      const statement = `${prelude};`.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ');
      if (statement === LAYER_ORDER && layerStatements === 0) layerStatements += 1;
      else errors.push(`${file}:${line}: ${snippet(statement)}: unexpected statement; only the layer order statement is allowed`);
      cursor = stop + 1;
      continue;
    }
    if (source[stop] === '}') {
      errors.push(`${file}:${line}: }: unmatched closing brace`);
      cursor = stop + 1;
      continue;
    }
    // A block. Find its matching closing brace.
    let depth = 0;
    let end = -1;
    for (let index = stop; index < source.length; index += 1) {
      const next = scanTo(source, index, ['{', '}']);
      if (next < 0) break;
      depth += source[next] === '{' ? 1 : -1;
      index = next;
      if (depth === 0) {
        end = next;
        break;
      }
    }
    if (end < 0) {
      errors.push(`${file}:${line}: ${snippet(prelude)}: unclosed block`);
      break;
    }
    if (prelude !== '@layer lr-theme-preset' || presetBlocks > 0) {
      const kind = prelude.startsWith('@') ? 'at-rule' : 'rule';
      errors.push(`${file}:${line}: ${snippet(prelude)}: unexpected ${kind}; only one @layer lr-theme-preset block is allowed`);
      cursor = end + 1;
      continue;
    }
    presetBlocks += 1;
    // The rules inside the preset layer: plain rules only, no nesting.
    let inner = stop + 1;
    while (inner < end) {
      while (inner < end && /\s/.test(source[inner])) inner += 1;
      if (inner >= end) break;
      const ruleLine = lineAt(source, inner);
      const open = scanTo(source, inner, ['{', '}', ';']);
      if (open < 0 || open >= end || source[open] !== '{') {
        errors.push(`${file}:${ruleLine}: ${snippet(source.slice(inner, Math.min(end, inner + 60)))}: expected a rule`);
        break;
      }
      const selector = source.slice(inner, open).trim();
      const close = scanTo(source, open + 1, ['{', '}']);
      if (close < 0 || close > end || source[close] === '{') {
        errors.push(`${file}:${ruleLine}: ${snippet(selector)}: nested blocks are not allowed in a preset rule`);
        break;
      }
      if (selector.startsWith('@')) {
        errors.push(`${file}:${ruleLine}: ${snippet(selector)}: unexpected at-rule inside the preset layer`);
      } else {
        rules.push({
          selectors: selector.split(',').map((part) => part.trim()),
          line: ruleLine,
          declarations: parseDeclarations(source, open + 1, close, context),
        });
      }
      inner = close + 1;
    }
    cursor = end + 1;
  }

  if (layerStatements === 0) errors.push(`${file}:1: missing the layer order statement ${LAYER_ORDER}`);
  if (presetBlocks === 0) errors.push(`${file}:1: missing the @layer lr-theme-preset block`);
  const light = rules[0]?.selectors.includes(LIGHT_SELECTOR) ? rules[0] : undefined;
  const dark = rules[1]?.selectors.includes(DARK_SELECTOR) ? rules[1] : undefined;
  if (presetBlocks > 0 && !light) errors.push(`${file}:1: missing the light rule (its selector list must include ${LIGHT_SELECTOR}) as the first rule`);
  if (presetBlocks > 0 && !dark) errors.push(`${file}:1: missing the dark rule (its selector list must include ${DARK_SELECTOR}) as the second rule`);
  for (const extra of rules.slice(2)) {
    errors.push(`${file}:${extra.line}: ${snippet(extra.selectors.join(', '))}: unexpected rule; a preset holds exactly a light rule and a dark rule`);
  }

  if (light && dark) {
    for (const [mode, rule] of [['light', light], ['dark', dark]]) {
      const has = (name) => rule.declarations.has(name);
      const pairs = [
        ...ROLES.flatMap((role) => TIERS.map((tier) => [`--lr-theme-color-${role}-fill-${tier}`, `--lr-theme-color-${role}-on-${tier}`])),
        ['--lr-theme-color-overlay-strong', '--lr-theme-color-on-strong-overlay'],
      ];
      for (const [fill, on] of pairs) {
        if (has(fill) === has(on)) continue;
        const [present, missing] = has(fill) ? [fill, on] : [on, fill];
        const entry = rule.declarations.get(present);
        errors.push(`${file}:${entry.line}: ${present}: declared in the ${mode} block without its partner ${missing}; declare both or neither`);
      }
    }
    for (const [name, entry] of light.declarations) {
      if (!dark.declarations.has(name)) errors.push(`${file}:${entry.line}: ${name}: declared in the light block but not in the dark block`);
    }
    for (const [name, entry] of dark.declarations) {
      if (!light.declarations.has(name)) errors.push(`${file}:${entry.line}: ${name}: declared in the dark block but not in the light block`);
    }
  }
  return { light: light?.declarations ?? new Map(), dark: dark?.declarations ?? new Map(), errors };
}

const quote = (value) => `'${value.replace(/'/g, '\\\'')}'`;
const constantName = (name) => `LYRA_${name.toUpperCase().replace(/-/g, '_')}_THEME_PRESET`;

/** Renders the generated module for one preset stylesheet. */
export function renderPresetModule(name, light, dark) {
  const constant = constantName(name);
  const lines = [];
  for (const [token, { value }] of light) {
    const darkValue = dark.get(token)?.value;
    lines.push(darkValue === undefined || darkValue === value
      ? `      ${quote(token)}: ${quote(value)},`
      : `      ${quote(token)}: { light: ${quote(value)}, dark: ${quote(darkValue)} },`);
  }
  return `// GENERATED by scripts/generate-theme-presets.mjs from src/themes/${name}.css -- do not edit
import { defineLyraThemePreset, type LyraThemePreset } from '../presets.js';

/**
 * The \`themes/${name}.css\` look as a runtime token preset: the same \`--lr-theme-*\` values, as a
 * validated per-mode token map that \`applyLyraThemePreset()\` persists, the no-flash bootstrap
 * restores before first paint, and the runtime writes inline on \`<html>\`.
 *
 * The look is its own axis. The preset carries only \`tokens\`: applying it keeps the current mode,
 * accent and surface, and applying a built-in preset (\`'sapphire'\`, \`'dark'\`, ...) afterwards keeps
 * the look, so either order reaches the same state.
 *
 * For the exact stylesheet rendering (no accent ramp, default surface reference), apply one
 * composed preset:
 * \`applyLyraThemePreset(defineLyraThemePreset({ id: '${name}-exact', theme: { ...${constant}.theme, accent: null, surface: null } }))\`.
 *
 * @example
 * import { applyLyraThemePreset } from '@aceshooting/lyra-ui/theme/presets.js';
 * import { ${constant} } from '@aceshooting/lyra-ui/theme/presets/${name}.js';
 *
 * applyLyraThemePreset(${constant});
 */
export const ${constant}: Readonly<LyraThemePreset> = defineLyraThemePreset({
  id: '${name}',
  theme: {
    tokens: {
${lines.join('\n')}
    },
  },
});
`;
}

function presetPaths(packageDir) {
  return {
    themesDir: join(packageDir, 'src', 'themes'),
    outputDir: join(packageDir, 'src', 'theme', 'presets'),
  };
}

/**
 * Builds every preset module from `src/themes/*.css`. Returns `{ outputs, errors }`, where each
 * output is `{ name, source, target, content }`; nothing is written.
 */
export function buildThemePresets(packageDir = defaultPackageDir) {
  const { themesDir, outputDir } = presetPaths(packageDir);
  const errors = [];
  const outputs = [];
  const files = existsSync(themesDir)
    ? readdirSync(themesDir).filter((file) => file.endsWith('.css')).sort()
    : [];
  for (const file of files) {
    const name = file.slice(0, -'.css'.length);
    const relative = `src/themes/${file}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      errors.push(`${relative}:1: the file name must be kebab-case`);
      continue;
    }
    const parsed = parsePresetStylesheet(readFileSync(join(themesDir, file), 'utf8'), relative);
    if (parsed.errors.length > 0) {
      errors.push(...parsed.errors);
      continue;
    }
    outputs.push({
      name,
      source: relative,
      target: join(outputDir, `${name}.ts`),
      content: renderPresetModule(name, parsed.light, parsed.dark),
    });
  }
  return { outputs, errors };
}

/** Compares the committed modules against a fresh build; never writes. */
export function checkThemePresets(packageDir = defaultPackageDir) {
  const { outputDir } = presetPaths(packageDir);
  const { outputs, errors } = buildThemePresets(packageDir);
  const findings = [...errors];
  for (const output of outputs) {
    const current = existsSync(output.target) ? readFileSync(output.target, 'utf8') : undefined;
    if (current !== output.content) {
      findings.push(`src/theme/presets/${output.name}.ts is ${current === undefined ? 'missing' : 'stale'} relative to ${output.source}`);
    }
  }
  const expected = new Set(outputs.map((output) => `${output.name}.ts`));
  const sources = new Set(
    existsSync(presetPaths(packageDir).themesDir)
      ? readdirSync(presetPaths(packageDir).themesDir).filter((file) => file.endsWith('.css')).map((file) => `${file.slice(0, -4)}.ts`)
      : [],
  );
  if (existsSync(outputDir)) {
    for (const file of readdirSync(outputDir).sort()) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts') || expected.has(file) || sources.has(file)) continue;
      findings.push(`src/theme/presets/${file} has no source stylesheet src/themes/${file.slice(0, -3)}.css`);
    }
  }
  return { findings, outputs };
}

/** Writes every preset module; returns `{ errors, written }`. Nothing is written on any error. */
export function writeThemePresets(packageDir = defaultPackageDir) {
  const { outputs, errors } = buildThemePresets(packageDir);
  if (errors.length > 0) return { errors, written: [] };
  const written = [];
  for (const output of outputs) {
    const current = existsSync(output.target) ? readFileSync(output.target, 'utf8') : undefined;
    if (current === output.content) continue;
    writeFileSync(output.target, output.content);
    written.push(output.target);
  }
  return { errors, written };
}

export function run(argv, packageDir = defaultPackageDir) {
  const unknown = argv.filter((argument) => argument !== '--check');
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}`);
    return 1;
  }
  if (argv.includes('--check')) {
    const { findings, outputs } = checkThemePresets(packageDir);
    if (findings.length > 0) {
      console.error(`Theme preset check failed:\n${findings.map((finding) => `- ${finding}`).join('\n')}\n${REMEDY}`);
      return 1;
    }
    console.log(`Theme presets are current: ${outputs.length} generated module(s).`);
    return 0;
  }
  const { errors, written } = writeThemePresets(packageDir);
  if (errors.length > 0) {
    console.error(`Theme preset generation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    return 1;
  }
  console.log(`Theme presets generated: ${written.length} module(s) updated.`);
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}

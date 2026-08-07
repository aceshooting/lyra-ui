import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const componentsRoot = join(process.cwd(), 'src', 'components');

// Web Awesome's public data-grid variables intentionally retain their unprefixed spelling so a
// consumer migration remains a mechanical tag rename. This is a closed, path-scoped compatibility
// set: the same names anywhere else, or a newly invented nineteenth alias, still fail below. Their
// declarations must continue to reference Lyra tokens, so the exception cannot smuggle raw design
// values into a component stylesheet.
const dataGridCompatibilityProperties = new Set([
  '--accent-color',
  '--background-color',
  '--border-color',
  '--border-radius',
  '--border-width',
  '--cell-padding',
  '--focus-ring',
  '--header-background',
  '--header-row-height',
  '--header-text-color',
  '--indent-size',
  '--max-height',
  '--row-height',
  '--row-hover-background',
  '--selected-background',
  '--stripe-background',
  '--text-color',
  '--transition-duration',
]);
const dataGridStyleFile = join(componentsRoot, 'data', 'data-grid', 'data-grid.styles.ts');

function styleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return styleFiles(file);
    return entry.name.endsWith('.styles.ts') ? [file] : [];
  });
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

const findings = [];
const rawColor = /#[0-9a-fA-F]{3,8}\b|\brgb(?:a)?\(/;
const rawDimension = /(?<![\w-])[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ch)\b/;
const semanticProperty = /^\s*(?:font-size|--[\w-]*font-size|font-weight|line-height|z-index|border(?:-[\w]+)*-radius)\s*:\s*([^;]+)/;
const customProperty = /^\s*(--[A-Za-z][A-Za-z0-9-]*)\s*:/;

for (const file of styleFiles(componentsRoot)) {
  const source = stripComments(readFileSync(file, 'utf8'));

  // `container-type: inline-size` applies inline-size containment to the declaration's own box,
  // which removes content-based intrinsic sizing. In a shrink-to-fit flex/grid placement that
  // otherwise resolves the component to zero. Keep the fallback on the exact query-container rule
  // (host or internal part), so every new responsive surface is safe without relying on a distant
  // consumer allocation.
  for (const match of source.matchAll(/container-type\s*:\s*inline-size\s*;/g)) {
    const ruleStart = source.lastIndexOf('{', match.index);
    const ruleEnd = source.indexOf('}', match.index);
    const ruleBody = source.slice(ruleStart + 1, ruleEnd);
    if (!/contain-intrinsic-inline-size\s*:/.test(ruleBody)) {
      const line = source.slice(0, match.index).split('\n').length;
      findings.push(
        `${file}:${line}: inline-size query container must declare contain-intrinsic-inline-size in the same rule`,
      );
    }
  }

  source.split('\n').forEach((line, index) => {
    if (line.includes('@media') || line.includes('@container')) return;

    if (rawColor.test(line) || /\bblack\b/.test(line)) {
      findings.push(`${file}:${index + 1}: raw color literal`);
    }
    if (rawDimension.test(line)) {
      findings.push(`${file}:${index + 1}: raw dimension literal`);
    }

    const custom = customProperty.exec(line)?.[1];
    const isDataGridCompatibilityProperty =
      file === dataGridStyleFile && custom !== undefined && dataGridCompatibilityProperties.has(custom);
    if (custom && !/^(?:--lr-|--shiki-)/.test(custom) && !isDataGridCompatibilityProperty) {
      findings.push(`${file}:${index + 1}: custom property must use a library or integration prefix (${custom})`);
    }
    if (isDataGridCompatibilityProperty && !line.includes('var(--lr-')) {
      findings.push(`${file}:${index + 1}: data-grid compatibility property must resolve through a --lr-* token (${custom})`);
    }

    const property = semanticProperty.exec(line);
    if (property) {
      const value = property[1].trim();
      const isGeometricRadius = /border(?:-[\w]+)*-radius/.test(property[0]) && /^(?:0|50%)(?:\s|$)/.test(value);
      const isUnitlessZeroLineHeight = /line-height/.test(property[0]) && /^0(?:\s|$)/.test(value);
      if (!isGeometricRadius && !isUnitlessZeroLineHeight && /^(?:[-+]?\d|\.\d|bold\b)/.test(value)) {
        findings.push(`${file}:${index + 1}: semantic property has a numeric literal`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error(`Style policy failed with ${findings.length} finding(s):`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Style policy passed for ${styleFiles(componentsRoot).length} style files.`);
}

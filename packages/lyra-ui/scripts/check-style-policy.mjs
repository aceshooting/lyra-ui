import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const componentsRoot = join(process.cwd(), 'src', 'components');

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
  source.split('\n').forEach((line, index) => {
    if (line.includes('@media') || line.includes('@container')) return;

    if (rawColor.test(line) || /\bblack\b/.test(line)) {
      findings.push(`${file}:${index + 1}: raw color literal`);
    }
    if (rawDimension.test(line)) {
      findings.push(`${file}:${index + 1}: raw dimension literal`);
    }

    const custom = customProperty.exec(line)?.[1];
    if (custom && !/^(?:--lr-|--shiki-)/.test(custom)) {
      findings.push(`${file}:${index + 1}: custom property must use a library or integration prefix (${custom})`);
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

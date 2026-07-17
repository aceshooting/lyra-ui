import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cli as analyzeManifest } from '@custom-elements-manifest/analyzer/cli.js';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(packageDir, 'src', 'components');
const manifestPath = path.join(packageDir, 'custom-elements.json');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function namesFromJSDoc(source) {
  return [...source.matchAll(/@csspart\s+([A-Za-z0-9_-]+)/g)].map((match) => match[1]);
}

function namesFromTemplates(source) {
  const names = new Set();
  for (const match of source.matchAll(/\bpart\s*=\s*["']([^"']+)["']/g)) {
    for (const name of match[1].trim().split(/\s+/)) {
      if (name) names.add(name);
    }
  }
  // A part built up dynamically (e.g. `const parts = ['day']; if (x) parts.push('day-today'); ...
  // part=${parts.join(' ')}`) never appears as a static part="..." literal above -- pick up both
  // its initial array-literal names and its pushed string-literal names, so this check doesn't
  // false-positive on that pattern (see <lyra-date-picker>'s calendar-day parts).
  for (const match of source.matchAll(/\bparts\s*=\s*\[([^\]]*)\]/g)) {
    for (const literal of match[1].matchAll(/["']([^"']+)["']/g)) names.add(literal[1]);
  }
  for (const match of source.matchAll(/\bparts\.push\(\s*["']([^"']+)["']\s*\)/g)) {
    names.add(match[1]);
  }
  // `exportparts="inner:outer, inner2:outer2"` re-exposes a shadow-nested child's own part under
  // this component's own part namespace (e.g. <lyra-svg-viewer>'s internal <lyra-zoomable-frame>
  // forwarding `viewport` as `frame-viewport`) -- the exposed (right-hand, or bare when there's no
  // `:`) name is what a consumer's `::part(frame-viewport)` selector actually targets, so it counts
  // as rendered even though no literal `part="frame-viewport"` attribute exists on this component's
  // own template.
  for (const match of source.matchAll(/\bexportparts\s*=\s*["']([^"']+)["']/g)) {
    for (const mapping of match[1].split(',')) {
      const [inner, outer] = mapping.split(':').map((part) => part.trim());
      if (outer || inner) names.add(outer || inner);
    }
  }
  // A single dynamic part name resolved by a ternary chain into a local `part` variable (e.g.
  // `const part = interactive ? (isHighlighted ? 'line-button line-highlight' : 'line-button') :
  // ...;` in <lyra-code-block-core>, or a `part: 'header-row' | 'data-row'` function parameter in
  // <lyra-csv-viewer>) then gets applied via `part=${part}` in a template or, for the imperative
  // <mark>-highlight path in <lyra-docx-viewer>/<lyra-markdown>, `mark.setAttribute('part', part)`
  // -- neither shape is a literal `part="..."` attribute nor the `parts`/`parts.push` array pattern
  // above, so pick up every quoted string literal (space-separated multi-part values included)
  // from any declaration or parameter type named exactly `part`, matching this codebase's own
  // naming convention for that variable.
  for (const match of source.matchAll(/\b(?:const|let)\s+part\s*=([^;]+);/g)) {
    for (const literal of match[1].matchAll(/["']([^"']+)["']/g)) {
      for (const name of literal[1].trim().split(/\s+/)) {
        if (name) names.add(name);
      }
    }
  }
  for (const match of source.matchAll(/\bpart\s*:\s*((?:'[^']+'|"[^"]+")(?:\s*\|\s*(?:'[^']+'|"[^"]+"))*)/g)) {
    for (const literal of match[1].matchAll(/["']([^"']+)["']/g)) names.add(literal[1]);
  }
  // `element.setAttribute('part', 'literal')` -- the imperative-DOM equivalent of a literal
  // `part="literal"` template attribute, used by the shared <mark>-wrap highlight-painting
  // fallback (see internal/text-highlights.js's adopting viewers) since that shared module can't
  // emit a lit template attribute for a part name it doesn't itself own.
  for (const match of source.matchAll(/\.setAttribute\(\s*["']part["']\s*,\s*["']([^"']+)["']\s*\)/g)) {
    names.add(match[1]);
  }
  return names;
}

const sourceByModule = new Map();
for (const file of walk(sourceDir).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.stories.ts'))) {
  // Relative to packageDir (not sourceDir) so this matches the manifest's own module.path
  // convention exactly (e.g. "src/components/chart/chart.class.ts") -- a prior sourceDir-relative
  // computation silently produced "src/chart/chart.class.ts" here, which never matched any real
  // module.path, making every lookup below a permanent miss.
  const modulePath = path.relative(packageDir, file).replaceAll(path.sep, '/');
  sourceByModule.set(modulePath, fs.readFileSync(file, 'utf8'));
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];
const tags = new Set();
for (const module of manifest.modules ?? []) {
  const source = sourceByModule.get(module.path);
  if (!source) continue;
  const documented = namesFromJSDoc(source);
  const rendered = namesFromTemplates(source);
  for (const name of documented) {
    if (!rendered.has(name)) errors.push(`${module.path}: documented CSS part "${name}" is not rendered statically`);
  }
  for (const declaration of module.declarations ?? []) {
    if (declaration.tagName) {
      if (!/^lyra-[a-z][a-z0-9-]*$/.test(declaration.tagName)) {
        errors.push(`${module.path}: invalid custom-element tag ${JSON.stringify(declaration.tagName)}`);
      }
      if (tags.has(declaration.tagName)) {
        errors.push(`duplicate custom-element tag ${JSON.stringify(declaration.tagName)}`);
      }
      tags.add(declaration.tagName);
      if (declaration.customElement !== true) {
        errors.push(`${module.path}: ${declaration.tagName} is not marked customElement`);
      }
    }
    for (const part of declaration.cssParts ?? []) {
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(part.name)) {
        errors.push(`${module.path}: invalid manifest CSS-part name ${JSON.stringify(part.name)}`);
      }
    }
    for (const event of declaration.events ?? []) {
      if (!/^[a-z][a-z0-9-]*$/.test(event.name) || event.name.startsWith('wa-')) {
        errors.push(`${module.path}: invalid or forbidden event name ${JSON.stringify(event.name)}`);
      }
    }
    for (const attribute of declaration.attributes ?? []) {
      if (!/^[a-z][a-z0-9-]*$/.test(attribute.name) || attribute.name.startsWith('wa-')) {
        errors.push(`${module.path}: invalid or forbidden attribute name ${JSON.stringify(attribute.name)}`);
      }
    }
  }
}

const generatedManifest = await analyzeManifest({
  argv: ['analyze', '--litelement', '--quiet'],
  cwd: packageDir,
  noWrite: true,
});
const expectedText = `${JSON.stringify(generatedManifest, null, 2)}\n`;
const actualText = fs.readFileSync(manifestPath, 'utf8');
if (actualText !== expectedText) {
  errors.push(
    'custom-elements.json is stale or nondeterministic; run `pnpm --filter @aceshooting/lyra-ui manifest` and commit the result',
  );
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Lyra CEM CSS-part contract passed.');
}

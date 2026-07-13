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
  return names;
}

const sourceByModule = new Map();
for (const file of walk(sourceDir).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.stories.ts'))) {
  const modulePath = `src/${path.relative(sourceDir, file).replaceAll(path.sep, '/')}`;
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

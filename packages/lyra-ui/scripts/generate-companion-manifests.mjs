#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli as analyzeManifest } from '@custom-elements-manifest/analyzer/cli.js';
import { compactManifest } from './manifest-compact.mjs';

const packagesDir = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

/** Companion packages that register their own `lr-*` custom elements. */
export const COMPANION_MANIFESTS = Object.freeze([
  { directory: 'lyra-docs', tags: ['lr-docx-editor'] },
  { directory: 'lyra-gen', tags: ['lr-gen-view'] },
]);

export async function generateCompanionManifest(directory) {
  const cwd = path.join(packagesDir, directory);
  const analyzed = await analyzeManifest({ argv: ['analyze', '--litelement', '--quiet'], cwd, noWrite: true });
  const manifest = compactManifest(analyzed);
  return { path: path.join(cwd, 'custom-elements.json'), manifest, text: `${JSON.stringify(manifest)}\n` };
}

export function declaredTags(manifest) {
  return (manifest.modules ?? []).flatMap((module) => module.declarations ?? [])
    .filter((declaration) => declaration.customElement && declaration.tagName)
    .map((declaration) => declaration.tagName)
    .sort();
}

if (isMainModule(import.meta.url)) {
  const check = process.argv.includes('--check');
  let failed = false;
  for (const { directory, tags } of COMPANION_MANIFESTS) {
    const { path: file, manifest, text } = await generateCompanionManifest(directory);
    const found = declaredTags(manifest);
    if (JSON.stringify(found) !== JSON.stringify([...tags].sort())) {
      console.error(`${directory}: expected tags ${tags.join(', ')} but the manifest declares ${found.join(', ') || 'none'}.`);
      failed = true;
    }
    if (check) {
      if (!existsSync(file) || readFileSync(file, 'utf8') !== text) {
        console.error(`${directory}/custom-elements.json is stale; run pnpm manifest:companions.`);
        failed = true;
      }
    } else {
      writeFileSync(file, text);
      console.log(`Generated ${directory}/custom-elements.json for ${found.join(', ')} (${text.length} bytes).`);
    }
  }
  if (failed) process.exitCode = 1;
}

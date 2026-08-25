#!/usr/bin/env node

import { realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli as analyzeManifest } from '@custom-elements-manifest/analyzer/cli.js';
import { compactManifest } from './manifest-compact.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(packageDir, 'custom-elements.json');

export async function generateManifest({ write = true } = {}) {
  const analyzed = await analyzeManifest({
    argv: ['analyze', '--litelement', '--quiet'],
    cwd: packageDir,
    noWrite: true,
  });
  const compact = compactManifest(analyzed);
  const text = `${JSON.stringify(compact)}\n`;
  if (write) writeFileSync(manifestPath, text);
  return { manifest: compact, text };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const { manifest, text } = await generateManifest();
  const tags = (manifest.modules ?? []).flatMap((module) => module.declarations ?? [])
    .filter((declaration) => declaration.customElement && declaration.tagName).length;
  console.log(`Generated compact Custom Elements Manifest for ${tags} tags (${text.length} bytes).`);
}

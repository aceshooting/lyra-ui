#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const packageRoot = join(root, 'packages/lyra-ui');
const read = (file) => readFileSync(join(root, file), 'utf8');
const errors = [];

const manifest = JSON.parse(read('packages/lyra-ui/custom-elements.json'));
const tags = [...new Set(
  (manifest.modules ?? [])
    .flatMap((module) => module.declarations ?? [])
    .filter((declaration) => declaration.customElement && declaration.tagName)
    .map((declaration) => declaration.tagName),
)].sort();
const familyCount = readdirSync(join(packageRoot, 'src/components'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .length;

const docsIndex = read('docs/index.md');
if (!docsIndex.includes(`${tags.length} custom elements across ${familyCount} component families`)) {
  errors.push(`docs/index.md must state ${tags.length} custom elements across ${familyCount} component families`);
}

const introduction = read('.storybook/Introduction.mdx');
if (!introduction.includes(`<strong>${tags.length}</strong><span>custom elements</span>`)) {
  errors.push(`.storybook/Introduction.mdx must display ${tags.length} custom elements`);
}
if (!introduction.includes('href="./llms-full.txt"')) {
  errors.push('.storybook/Introduction.mdx API reference must use a deployment-relative ./llms-full.txt link');
}

const shortLlms = read('packages/lyra-ui/llms.txt');
const missingFromShortLlms = tags.filter((tag) => !shortLlms.includes(`\`${tag}\``));
if (missingFromShortLlms.length) {
  errors.push(`packages/lyra-ui/llms.txt is missing ${missingFromShortLlms.length} manifest tag(s): ${missingFromShortLlms.join(', ')}`);
}

const indexPath = join(root, 'storybook-static/index.json');
if (!existsSync(indexPath)) {
  errors.push('storybook-static/index.json is missing; run `pnpm docs:build` before the docs freshness check');
} else {
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  const docsIds = Object.keys(index.entries ?? {})
    .filter((id) => index.entries[id]?.type === 'docs')
    .sort();
  const sitemap = read('.storybook/sitemap.xml');
  const sitemapIds = [...sitemap.matchAll(/<loc>https:\/\/aceshooting\.github\.io\/lyra-ui\/\?path=\/docs\/([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .sort();
  if (JSON.stringify(sitemapIds) !== JSON.stringify(docsIds)) {
    errors.push(`.storybook/sitemap.xml does not match Storybook's ${docsIds.length} docs entries; run pnpm docs:build`);
  }
  const builtSitemapPath = join(root, 'storybook-static/sitemap.xml');
  if (!existsSync(builtSitemapPath) || readFileSync(builtSitemapPath, 'utf8') !== sitemap) {
    errors.push('storybook-static/sitemap.xml is not synchronized with .storybook/sitemap.xml; run `pnpm docs:build`');
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Documentation freshness check passed (${tags.length} tags, ${familyCount} component families).`);
}

#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const staticRoot = join(root, 'storybook-static');
const indexPath = join(staticRoot, 'index.json');

if (!existsSync(indexPath)) {
  throw new Error('storybook-static/index.json is missing; run `pnpm docs:build` first');
}

const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const docsIds = Object.keys(index.entries ?? {})
  .filter((id) => index.entries[id]?.type === 'docs')
  .sort();

const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!--',
  '  Best-effort sitemap: the docs home page plus every component/Introduction "docs" entry\'s',
  '  ?path= URL. Storybook is a client-routed SPA (one index.html for every entry — no separate',
  '  static HTML per story), so these query-string URLs all resolve to the same document; they\'re',
  '  still valid, bookmarkable, distinct crawl targets and are the convention other deployed',
  '  Storybook sites use in their own sitemaps.',
  '',
  '  Generated from storybook-static/index.json (entries with type="docs"), not hand-derived from',
  '  Storybook\'s title-to-id sanitization. `pnpm docs:build` refreshes this file automatically.',
  '-->',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  '  <url><loc>https://aceshooting.github.io/lyra-ui/</loc></url>',
  ...docsIds.map((id) => `  <url><loc>https://aceshooting.github.io/lyra-ui/?path=/docs/${id}</loc></url>`),
  '</urlset>',
  '',
];
const sitemap = lines.join('\n');

writeFileSync(join(root, '.storybook/sitemap.xml'), sitemap);
writeFileSync(join(staticRoot, 'sitemap.xml'), sitemap);
console.log(`Generated sitemap with ${docsIds.length} Storybook docs entries.`);

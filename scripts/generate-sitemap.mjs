#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDocsRobots, renderDocsSitemap, resolveDocsPublicBase } from './docs-public-base.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const staticRoot = join(root, 'storybook-static');
const indexPath = join(staticRoot, 'index.json');
const publicBase = resolveDocsPublicBase(process.env.LYRA_DOCS_BASE_URL);

if (!existsSync(indexPath)) {
  throw new Error('storybook-static/index.json is missing; run `pnpm docs:build` first');
}

const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const docsIds = Object.keys(index.entries ?? {})
  .filter((id) => index.entries[id]?.type === 'docs')
  .sort();

// Committed crawler files always describe the standalone default. A custom build profile changes
// only the output artifact; a downstream freshness check reads its recorded profile, not its env.
writeFileSync(join(root, '.storybook/sitemap.xml'), renderDocsSitemap(docsIds));
writeFileSync(join(root, '.storybook/robots.txt'), renderDocsRobots());
writeFileSync(join(staticRoot, 'sitemap.xml'), renderDocsSitemap(docsIds, publicBase));
writeFileSync(join(staticRoot, 'robots.txt'), renderDocsRobots(publicBase));
writeFileSync(join(staticRoot, 'docs-public-base.json'), `${JSON.stringify({ schemaVersion: 1, publicBase }, null, 2)}\n`);
console.log(`Generated sitemap with ${docsIds.length} Storybook docs entries (${publicBase}).`);

#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

// Lane groups a change can affect; deny by default (unknown paths or an unreadable diff run everything).
const isRootMarkdown = (path) => !path.includes('/') && path.endsWith('.md');
// Nothing in lyra-ui's lanes reads lyra-docs; its manifest still runs everything.
const isDocsPackageSource = (path) =>
  path.startsWith('packages/lyra-docs/') && path !== 'packages/lyra-docs/package.json';
// Read only by lint, static checks and the docs-site freshness check.
const isContributorText = (path) =>
  path.startsWith('docs/') ||
  path.startsWith('.changeset/') ||
  path.startsWith('plugins/') ||
  path.startsWith('skills/') ||
  isRootMarkdown(path);

export const FULL_SCOPE = Object.freeze({ runtime: true, packages: true, docsSite: true });

export function changeScope(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return FULL_SCOPE;
  return {
    runtime: paths.some((path) => !isDocsPackageSource(path) && !isContributorText(path)),
    packages: paths.some((path) => !isContributorText(path)),
    docsSite: paths.some((path) => !isDocsPackageSource(path) && !path.startsWith('.changeset/')),
  };
}

/** Changed paths between two commits, or null when they cannot be compared. */
export function changedPaths(base, head, { git = (args) => execFileSync('git', args, { encoding: 'utf8' }) } = {}) {
  if (!/^[0-9a-f]{40}$/u.test(base ?? '') || /^0+$/u.test(base) || !/^[0-9a-f]{40}$/u.test(head ?? '')) return null;
  try {
    git(['fetch', '--no-tags', '--depth=1', 'origin', base]);
    return git(['diff', '--no-renames', '--name-only', base, head]).split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

if (isMainModule(import.meta.url)) {
  const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
  };
  const paths = changedPaths(argument('--base'), argument('--head'));
  const scope = paths === null ? FULL_SCOPE : changeScope(paths);
  console.error(paths === null
    ? 'Change set unavailable: every lane runs.'
    : `${paths.length} changed path(s): runtime=${scope.runtime} packages=${scope.packages} docs_site=${scope.docsSite}`);
  process.stdout.write(`runtime=${scope.runtime}\npackages=${scope.packages}\ndocs_site=${scope.docsSite}\n`);
}

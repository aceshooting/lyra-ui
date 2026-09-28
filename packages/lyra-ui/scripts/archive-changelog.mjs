import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';

export const changelogArchiveUrl = 'https://github.com/aceshooting/lyra-ui/tree/main/docs/changelog';
const pointer = `Older major versions: [release history archive](${changelogArchiveUrl}).`;

/** Keep the current major locally while preserving complete version blocks in major archives. */
export function partitionChangelog(text, currentMajor) {
  if (!Number.isSafeInteger(currentMajor) || currentMajor < 0) throw new Error('Invalid current changelog major');
  const headings = [...text.matchAll(/^## (\d+)\.\d+\.\d+[^\n]*$/gm)];
  if (!headings.length) throw new Error('Changelog contains no release headings');
  const preamble = text.slice(0, headings[0].index).replace(pointer, '').trim();
  const current = [];
  const archives = new Map();
  for (const [index, heading] of headings.entries()) {
    const major = Number(heading[1]);
    if (major > currentMajor) throw new Error(`Changelog major ${major} exceeds package major ${currentMajor}`);
    const block = text.slice(heading.index, headings[index + 1]?.index ?? text.length)
      .replace(pointer, '').trim();
    if (major === currentMajor) current.push(block);
    else {
      if (!archives.has(major)) archives.set(major, []);
      archives.get(major).push(block);
    }
  }
  if (!current.length) throw new Error(`Changelog has no release in current major ${currentMajor}`);
  return {
    current: `${preamble}\n\n${current.join('\n\n')}\n\n${pointer}\n`,
    archives: new Map([...archives].map(([major, blocks]) => [major, `# Version ${major} release history\n\n${blocks.join('\n\n')}\n`])),
  };
}

export function archiveChangelog(packageDir, { write = false } = {}) {
  const pkg = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const changelogPath = path.join(packageDir, 'CHANGELOG.md');
  const archiveDir = path.resolve(packageDir, '../../docs/changelog');
  const result = partitionChangelog(readFileSync(changelogPath, 'utf8'), Number(pkg.version.split('.')[0]));
  const outputs = new Map([[changelogPath, result.current]]);
  for (const [major, text] of result.archives) {
    const archivePath = path.join(archiveDir, `v${major}.md`);
    if (existsSync(archivePath) && readFileSync(archivePath, 'utf8') !== text)
      throw new Error(`Refusing to replace differing release history: ${archivePath}`);
    outputs.set(archivePath, text);
  }
  const stale = [...outputs].filter(([file, text]) => !existsSync(file) || readFileSync(file, 'utf8') !== text);
  if (!write && stale.length) throw new Error('Changelog archive is stale; run archive-changelog.mjs --write');
  for (const [file, text] of write ? stale : []) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return stale.length;
}

if (isMainModule(import.meta.url)) {
  const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  console.log(`Changelog archive: ${archiveChangelog(packageDir, { write: process.argv.includes('--write') })} changed files.`);
}

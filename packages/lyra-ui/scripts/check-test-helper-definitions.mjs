import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_HELPER = /\bfunction\s+(resolvedInShadow|resolveInShadow|nextFrame|twoFrames|glyphRect|sinkTexts)\s*\(/g;
const specialized = new Set([
  'src/components/retrieval/knowledge-graph-explorer/knowledge-graph-explorer.test.ts:sinkTexts',
  'src/components/layout/app-rail/app-rail-sidebar.test.ts:resolvedInShadow',
  'src/components/layout/app-rail/app-rail-mobile-shadow.test.ts:resolvedInShadow',
  'src/components/layout/app-rail/app-rail.test.ts:resolvedInShadow',
  'src/components/forms/locale-picker/locale-picker.test.ts:resolvedInShadow',
  'src/components/conversation/chat-composer/chat-composer.test.ts:resolveInShadow',
  'src/components/conversation/message-feedback/message-feedback.test.ts:resolveInShadow',
]);

export function localHelperDefinitions(source, file) {
  return Array.from(source.matchAll(LOCAL_HELPER), match => `${file}:${match[1]}`);
}

function testFiles(dir, prefix = '') {
  const files = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, item.name);
    if (item.isDirectory()) files.push(...testFiles(path.join(dir, item.name), relative));
    else if (item.name.endsWith('.test.ts')) files.push(relative);
  }
  return files;
}

export function checkTestHelperDefinitions() {
  return testFiles(path.join(packageDir, 'src'), 'src')
    .flatMap(file => localHelperDefinitions(readFileSync(path.join(packageDir, file), 'utf8'), file))
    .filter(definition => !specialized.has(definition));
}

if (isMainModule(import.meta.url)) {
  const unexpected = checkTestHelperDefinitions();
  if (unexpected.length) {
    process.stderr.write(`Use shared test helpers for these new definitions:\n${unexpected.join('\n')}\n`);
    process.exitCode = 1;
  }
}

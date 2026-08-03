import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// TypeScript requires the implementation-side constructor of a class-expression mixin to use
// `any[]`. Even when the exported overload is exact and `stripInternal` removes that implementation
// overload, declaration inference expands the source-only overload into every adopting class's
// private `*_base` declaration. Rebuild that compiler-generated base type with one exact construct
// signature: the mapped static side keeps public statics, while ConstructorParameters/InstanceType
// preserve the caller's constructor and instance surface without publishing `any`.
const TARGET_BASE = /declare const ([A-Za-z_$][\w$]*): typeof ([A-Za-z_$][\w$]*) & \(new \(\.\.\.args: any\[\]\) => (import\("[^"]+\/(?:anchor-target|text-viewer-target)\.js"\)\.(?:LyraAnchorTarget|LyraTextViewerTarget) & \{\s*renderAnchorLiveRegion\(\): unknown;\s*\})\);/gu;
const LEAKED_TARGET_BASE = /new \(\.\.\.args: any\[\]\)[\s\S]{0,400}?(?:anchor-target|text-viewer-target)\.js/u;

export function normalizeMixinDeclarationText(source) {
  let replacements = 0;
  const text = source.replace(TARGET_BASE, (_match, generatedBase, sourceBase, added) => {
    replacements++;
    return (
      `declare const ${generatedBase}: Omit<typeof ${sourceBase}, 'prototype'> & ` +
      `(new (...args: ConstructorParameters<typeof ${sourceBase}>) => ` +
      `InstanceType<typeof ${sourceBase}> & ${added});`
    );
  });
  if (LEAKED_TARGET_BASE.test(text)) {
    throw new Error('an anchor/text-viewer mixin constructor still exposes any[]');
  }
  return { text, replacements };
}

async function declarationFiles(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await declarationFiles(path, files);
    else if (entry.isFile() && entry.name.endsWith('.d.ts')) files.push(path);
  }
  return files;
}

export async function normalizeMixinDeclarations(distDirectory) {
  let filesChanged = 0;
  let replacements = 0;
  for (const file of await declarationFiles(distDirectory)) {
    const source = await readFile(file, 'utf8');
    const normalized = normalizeMixinDeclarationText(source);
    if (normalized.replacements === 0) continue;
    await writeFile(file, normalized.text, 'utf8');
    filesChanged++;
    replacements += normalized.replacements;
  }
  return { filesChanged, replacements };
}

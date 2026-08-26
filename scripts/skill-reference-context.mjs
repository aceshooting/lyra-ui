#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

export const FAMILY_SUMMARY_LINK_SUFFIX =
  '; family-wide breaking-change summaries: [llms-full.txt](../../llms-full.txt)';

const SHARED_PACKAGE_RELEASE_PARAGRAPH = [
  '`since` records when a tag first appeared; it is not a history of later additions, fixes, or',
  'breaking changes. For every release after 9.0.0 — including minor and patch releases — read the',
  'package\'s shipped [CHANGELOG.md](../CHANGELOG.md) before upgrading. Family-wide breaking-change',
  'summaries sit at the start of the applicable authored `llms/<family>.md` file; each generated',
  '`llms/components/<tag>.md` header links that family summary when one exists. Component-specific',
  'version notes remain in the component\'s own section. `llms/migration.md` is narrower: it covers',
  '`wa-*`/`sl-*` renames and compatibility decisions, not Lyra release history.',
].join('\n');

const SHARED_STANDALONE_RELEASE_PARAGRAPH = [
  '`since` records when a tag first appeared; it is not a history of later additions, fixes, or',
  'breaking changes. For every release after 9.0.0 — including minor and patch releases — read the',
  'bundled [CHANGELOG.md](../CHANGELOG.md) before upgrading. These bundled references link that',
  'self-contained changelog beside this standalone skill. Family-wide breaking-change summaries',
  'remain in the installed package\'s `llms-full.txt`; this compact skill intentionally does not',
  'bundle that multi-megabyte concatenation. Component-specific version notes remain in the',
  'component\'s own section.',
  '`llms/migration.md` is narrower: it covers `wa-*`/`sl-*` renames and compatibility decisions,',
  'not Lyra release history.',
].join('\n');

const FENCED_CODE_BLOCK =
  /^[ \t]{0,3}(?<fence>`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]{0,3}\k<fence>[ \t]*$/gmu;
const INLINE_CODE_SPAN = /(?<ticks>`+)(?!`)[\s\S]*?\k<ticks>(?!`)/gu;
const INLINE_MARKDOWN_LINK =
  /!?\[[^\]\n]*\]\(\s*(?:<(?<angle>[^>\n]+)>|(?<bare>[^)\s]+))(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^\n)]*\)))?\s*\)/gu;

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

export function markdownLinkTargets(text) {
  const markdown = text.replace(FENCED_CODE_BLOCK, '').replace(INLINE_CODE_SPAN, '');
  return [...markdown.matchAll(INLINE_MARKDOWN_LINK)].map(
    (match) => match.groups.angle ?? match.groups.bare,
  );
}

export function isLlmsFullMarkdownTarget(target) {
  let decoded = target.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // A malformed escape cannot disguise the literal filename check below.
  }
  const pathOnly = decoded.split(/[?#]/u, 1)[0].replaceAll('\\', '/');
  return path.posix.basename(path.posix.normalize(pathOnly)).toLowerCase() === 'llms-full.txt';
}

function llmsFullMarkdownTargets(text) {
  return markdownLinkTargets(text).filter(isLlmsFullMarkdownTarget);
}

function filesUnder(directory, predicate, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) filesUnder(absolute, predicate, files);
    else if (entry.isFile() && predicate(entry.name)) files.push(absolute);
  }
  return files;
}

export function rewriteStandaloneSharedReference(text) {
  const occurrences = countOccurrences(text, SHARED_PACKAGE_RELEASE_PARAGRAPH);
  if (occurrences !== 1) {
    throw new Error(
      `Expected exactly one authored release-history paragraph in llms/shared.md, found ${occurrences}.`,
    );
  }
  const rewritten = text.replace(
    SHARED_PACKAGE_RELEASE_PARAGRAPH,
    SHARED_STANDALONE_RELEASE_PARAGRAPH,
  );
  const unexpectedLinks = llmsFullMarkdownTargets(rewritten);
  if (unexpectedLinks.length > 0) {
    throw new Error(
      `Standalone shared.md retains ${unexpectedLinks.length} llms-full.txt Markdown link(s).`,
    );
  }
  return rewritten;
}

export function rewriteStandaloneComponentReference(text, label = 'component reference') {
  const linked = llmsFullMarkdownTargets(text);
  const exactSuffixes = countOccurrences(text, FAMILY_SUMMARY_LINK_SUFFIX);
  if (linked.length !== exactSuffixes || exactSuffixes > 1) {
    throw new Error(
      `${label} has ${linked.length} llms-full.txt Markdown link target(s), but ${exactSuffixes} exact family-summary suffix(es).`,
    );
  }
  return text.replaceAll(FAMILY_SUMMARY_LINK_SUFFIX, '');
}

function rewriteStandaloneReferenceTree(referencesDir) {
  const sharedPath = path.join(referencesDir, 'shared.md');
  const componentsDir = path.join(referencesDir, 'components');
  if (!existsSync(sharedPath) || !existsSync(componentsDir)) {
    throw new Error(`${referencesDir} must contain shared.md and components/.`);
  }

  writeFileSync(
    sharedPath,
    rewriteStandaloneSharedReference(readFileSync(sharedPath, 'utf8')),
  );

  const componentFiles = readdirSync(componentsDir)
    .filter((file) => file.endsWith('.md'))
    .sort();
  if (componentFiles.length === 0) {
    throw new Error(`${componentsDir} contains zero component references.`);
  }

  let strippedFamilyLinks = 0;
  for (const file of componentFiles) {
    const componentPath = path.join(componentsDir, file);
    const source = readFileSync(componentPath, 'utf8');
    const rewritten = rewriteStandaloneComponentReference(source, file);
    strippedFamilyLinks += countOccurrences(source, FAMILY_SUMMARY_LINK_SUFFIX);
    writeFileSync(componentPath, rewritten);
  }
  if (strippedFamilyLinks === 0) {
    throw new Error('Standalone component references contained zero family-summary link suffixes.');
  }

  const skillRoot = path.dirname(referencesDir);
  const markdownFiles = filesUnder(skillRoot, (file) => file.endsWith('.md'));
  const linkedFiles = markdownFiles.filter(
    (file) => llmsFullMarkdownTargets(readFileSync(file, 'utf8')).length > 0,
  );
  if (linkedFiles.length > 0) {
    throw new Error(
      `Standalone references retain llms-full.txt Markdown links: ${linkedFiles.join(', ')}`,
    );
  }
  if (filesUnder(skillRoot, (file) => file === 'llms-full.txt').length > 0) {
    throw new Error('Standalone skill must not bundle llms-full.txt.');
  }

  return { componentFiles: componentFiles.length, strippedFamilyLinks };
}

if (isMainModule(import.meta.url)) {
  const referencesDir = process.argv[2];
  if (!referencesDir || process.argv.length !== 3) {
    console.error('Usage: node scripts/skill-reference-context.mjs <references-directory>');
    process.exitCode = 1;
  } else {
    try {
      const result = rewriteStandaloneReferenceTree(path.resolve(referencesDir));
      console.log(
        `Prepared ${result.componentFiles} standalone component references; stripped ${result.strippedFamilyLinks} family-summary links.`,
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}

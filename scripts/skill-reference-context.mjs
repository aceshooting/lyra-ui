#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { changelogArchiveUrl } from '../packages/lyra-ui/scripts/archive-changelog.mjs';
import { SHARED_TOPICS } from '../packages/lyra-ui/scripts/shared-topics.mjs';
import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

export const FAMILY_SUMMARY_LINK_SUFFIX =
  '; family-wide breaking-change summaries: [llms-full.txt](../../llms-full.txt)';

const SHARED_PACKAGE_RELEASE_PARAGRAPH = [
  '`since` records when a tag first appeared, not later changes. Before upgrading, read the',
  'package\'s [CHANGELOG.md](../CHANGELOG.md) (current major, including minor and patch).',
  'Family-wide breaking-change summaries open each authored `llms/<family>.md`, and each generated',
  '`llms/components/<tag>.md` header links its family summary. `llms/migration.md` covers only',
  '`wa-*`/`sl-*` renames, not Lyra release history.',
].join('\n');

const SHARED_STANDALONE_RELEASE_PARAGRAPH = [
  '`since` records when a tag first appeared, not later changes. Before upgrading, read the bundled',
  '[CHANGELOG.md](../CHANGELOG.md): it holds the current major; older history is linked from the',
  'package\'s own CHANGELOG.md and at https://github.com/aceshooting/lyra-ui/releases. Family-wide',
  'breaking-change summaries are linked from each component reference to the authored family guide.',
  '`llms/migration.md` covers only `wa-*`/`sl-*` renames, not Lyra release',
  'history.',
].join('\n');

/** Appended to the standalone skill's trimmed CHANGELOG.md so older history stays reachable. */
export const STANDALONE_CHANGELOG_POINTER =
  `Older major versions: [release history archive](${changelogArchiveUrl}).`;

/**
 * Pure trim of a full, newest-first CHANGELOG.md down to its preamble plus the newest `majors`
 * distinct `## X.Y.Z` major-version groups (a major is the leading `X`; every `X.Y.Z` heading with
 * the same `X` stays together). A heading that doesn't match `## <digits>.<digits>.<digits>` (e.g.
 * a stray `## Unreleased`) is not itself a major boundary and rides along with whichever major
 * precedes it. Appends STANDALONE_CHANGELOG_POINTER once, after the kept content.
 */
export function trimStandaloneChangelog(text, majors = 1) {
  const headings = [...text.matchAll(/^## (\d+)\.\d+\.\d+.*$/gm)];
  if (headings.length === 0) return text;

  const seenMajors = [];
  let cutIndex = text.length;
  for (const heading of headings) {
    const major = heading[1];
    if (!seenMajors.includes(major)) seenMajors.push(major);
    if (seenMajors.length > majors) {
      cutIndex = heading.index;
      break;
    }
  }

  const kept = text.slice(0, cutIndex).replace(STANDALONE_CHANGELOG_POINTER, '').replace(/\n+$/u, '\n');
  return `${kept}\n${STANDALONE_CHANGELOG_POINTER}\n`;
}

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

function headingAnchors(text) {
  const anchors = new Set();
  const used = new Map();
  for (const match of text.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gmu)) {
    // Heading identifiers omit tags and retain only identifier characters in the same pass.
    const base = match[1]
      .toLowerCase()
      .replace(/<[^>]*>|[^\p{L}\p{N}_ -]/gu, '')
      .trim()
      .replace(/\s/gu, '-');
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    anchors.add(`${base}${count ? `-${count}` : ''}`);
  }
  return anchors;
}

/** Fail closed if a focused shared guide's relative route or heading anchor is not packaged. */
export function validateSharedTopicLinks(sharedTopicsDir) {
  const problems = [];
  for (const [topic] of SHARED_TOPICS) {
    const file = path.join(sharedTopicsDir, `${topic}.md`);
    if (!existsSync(file)) {
      problems.push(`${topic}.md is missing from the shared topic reference tree.`);
      continue;
    }
    const source = readFileSync(file, 'utf8');
    const anchors = headingAnchors(source);
    for (const target of markdownLinkTargets(source)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(target)) continue;
      let decoded = target;
      try {
        decoded = decodeURIComponent(target);
      } catch {
        problems.push(`${topic}.md has a malformed link target: ${target}`);
        continue;
      }
      const hashIndex = decoded.indexOf('#');
      const linkPath = decoded.slice(0, hashIndex < 0 ? undefined : hashIndex).split('?')[0];
      const anchor = hashIndex < 0 ? '' : decoded.slice(hashIndex + 1).split('?')[0];
      const destination = path.resolve(path.dirname(file), linkPath || path.basename(file));
      if (!existsSync(destination)) {
        problems.push(`${topic}.md links to missing ${path.relative(sharedTopicsDir, destination)}.`);
        continue;
      }
      if (anchor && destination.endsWith('.md')) {
        const destinationAnchors = headingAnchors(readFileSync(destination, 'utf8'));
        if (!destinationAnchors.has(anchor)) {
          problems.push(`${topic}.md links to missing #${anchor} in ${path.relative(sharedTopicsDir, destination)}.`);
        }
      } else if (anchor && linkPath.length === 0 && !anchors.has(anchor)) {
        problems.push(`${topic}.md links to missing local #${anchor}.`);
      }
    }
  }
  if (problems.length) {
    throw new Error(`Invalid shared topic reference routes:\n  - ${problems.join('\n  - ')}`);
  }
  return true;
}

function rewriteStandaloneReferenceTree(referencesDir, changelogSource) {
  const sharedPath = path.join(referencesDir, 'shared.md');
  const sharedTopicsDir = path.join(referencesDir, 'shared');
  const componentsDir = path.join(referencesDir, 'components');
  if (!existsSync(sharedPath) || !existsSync(sharedTopicsDir) || !existsSync(componentsDir)) {
    throw new Error(`${referencesDir} must contain shared.md, shared/, and components/.`);
  }
  for (const [topic] of SHARED_TOPICS) {
    const topicPath = path.join(sharedTopicsDir, `${topic}.md`);
    if (!existsSync(topicPath)) {
      throw new Error(`${topicPath} is missing; package all authored shared topic routes.`);
    }
  }

  writeFileSync(
    sharedPath,
    rewriteStandaloneSharedReference(readFileSync(sharedPath, 'utf8')),
  );

  const skillRoot = path.dirname(referencesDir);
  if (changelogSource) {
    writeFileSync(
      path.join(skillRoot, 'CHANGELOG.md'),
      trimStandaloneChangelog(readFileSync(changelogSource, 'utf8')),
    );
  }

  validateSharedTopicLinks(sharedTopicsDir);

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
  const changelogSource = process.argv[3];
  if (!referencesDir || process.argv.length < 3 || process.argv.length > 4) {
    console.error(
      'Usage: node scripts/skill-reference-context.mjs <references-directory> [changelog-source]',
    );
    process.exitCode = 1;
  } else {
    try {
      const result = rewriteStandaloneReferenceTree(
        path.resolve(referencesDir),
        changelogSource ? path.resolve(changelogSource) : undefined,
      );
      console.log(
        `Prepared ${result.componentFiles} standalone component references; stripped ${result.strippedFamilyLinks} family-summary links.`,
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}

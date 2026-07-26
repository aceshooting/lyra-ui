#!/usr/bin/env node
// Root-barrel import gate: fails when a ```ts/```js code fence in llms/*.md shows a consumer
// importing from the bare `@aceshooting/lyra-ui` package-root barrel. The root barrel side-effect
// registers every component (~253 of them) it re-exports, so a copy-pasted example that imports
// from it silently drags a consumer's whole eager bundle in, even when the example only wants one
// component. The correct copy-pasteable form is a granular subpath, e.g.
// `@aceshooting/lyra-ui/components/forms/select/select.js` -- see the "Tree-shakeable exports" rule
// in docs/agents/coding-conventions.md. `check-llms-freshness.mjs` (via scripts/llms-gaps.mjs) only
// asserts that a member *name* is mentioned somewhere in a component's section; it does not (and
// structurally cannot, without duplicating this scan) know whether the import path shown alongside
// that name is the root barrel or a subpath. This gate would have caught all 5 root-barrel-import
// instances found and fixed across llms/*.md in the review that preceded it.
//
// Deliberately narrow, mirroring check-part-reachability.mjs's stance: a false positive costs a
// contributor a confusing failure, so this only fires on an exact, unambiguous match.
//   * Only the exact `@aceshooting/lyra-ui` specifier is flagged -- never a subpath like
//     `@aceshooting/lyra-ui/components/...` (those are exactly the correct form) and never an
//     unrelated package that merely shares the scope, such as `@aceshooting/lyra-flags`.
//   * Only inside a fenced ```ts or ```js code block (case-insensitive language tag). Prose or an
//     inline `` `code span` `` that merely *mentions* the root package name (e.g. "install
//     `@aceshooting/lyra-ui`") is not a copy-pasteable import example and is left alone.
//   * Both `import ... from '@aceshooting/lyra-ui'` / `export ... from '@aceshooting/lyra-ui'` and
//     a dynamic `import('@aceshooting/lyra-ui')` are covered -- either form eagerly pulls in the
//     same side-effectful module graph.
//
// Fixtures for both the positive (flagged) and negative (subpath / different package / non-code-
// fence, correctly not flagged) shapes live in check-llms-root-barrel-imports.test.mjs, run by the
// same chain.
//
// Run directly: `node scripts/check-llms-root-barrel-imports.mjs`. Wired into `pnpm run contract-policy`.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const llmsRoot = path.join(packageDir, 'llms');

/** The bare package-root specifier this gate exists to forbid inside code examples. */
const PACKAGE_NAME = '@aceshooting/lyra-ui';

const rel = (file) => path.relative(packageDir, file).replaceAll('\\', '/');

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

/**
 * `{ start, end }` character-offset pairs (into `text`) for the *content* of every fenced code
 * block whose opening fence's language tag is exactly `ts` or `js` (case-insensitive, no other
 * info-string tokens present in this corpus -- see the fence inventory this gate was written
 * against). A block with no closing fence extends to end of file, matching how an unterminated
 * fence renders in practice.
 */
export function tsJsCodeBlocks(text) {
  const blocks = [];
  const lines = text.split('\n');
  let offset = 0;
  let open = null;
  for (const line of lines) {
    const fence = /^```([a-zA-Z]*)\s*$/.exec(line);
    if (fence) {
      if (open) {
        blocks.push({ start: open.contentStart, end: offset });
        open = null;
      } else {
        const lang = fence[1].toLowerCase();
        if (lang === 'ts' || lang === 'js') open = { contentStart: offset + line.length + 1 };
      }
    }
    offset += line.length + 1;
  }
  if (open) blocks.push({ start: open.contentStart, end: text.length });
  return blocks;
}

// `from '@aceshooting/lyra-ui'` / `from "@aceshooting/lyra-ui"` / `import('@aceshooting/lyra-ui')`
// -- the closing quote must sit directly against the package name (backreference to the opening
// quote), which is exactly what excludes every subpath: a subpath's string continues with `/...`
// before its closing quote, so it never matches this pattern.
const ESCAPED_PACKAGE_NAME = PACKAGE_NAME.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const IMPORT_PATTERN = new RegExp(String.raw`(?:from|import\()\s*(['"])${ESCAPED_PACKAGE_NAME}\1`, 'g');

/**
 * Findings for one `llms/<family>.md` file's text: every bare-root-barrel import found inside a
 * ```ts/```js code fence.
 */
export function checkRootBarrelImports(file, text) {
  const findings = [];
  for (const block of tsJsCodeBlocks(text)) {
    const blockText = text.slice(block.start, block.end);
    for (const match of blockText.matchAll(IMPORT_PATTERN)) {
      const line = lineOf(text, block.start + match.index);
      // Cosmetic only: the pattern itself stops at the closing quote (it never needs to see the
      // matching `)` to know a dynamic import is offending), but showing the closing paren too
      // makes the finding read as a complete expression.
      const shown = match[0].startsWith('import(') ? `${match[0]})` : match[0];
      findings.push(
        `${rel(file)}:${line} imports the bare root barrel (\`${shown}\`) -- this side-effect ` +
          `registers every component into a consumer's eager bundle. Use a granular subpath instead, ` +
          `e.g. \`${PACKAGE_NAME}/components/<family>/<name>/<name>.js\`.`,
      );
    }
  }
  return findings;
}

function run() {
  const files = fs
    .readdirSync(llmsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(llmsRoot, entry.name))
    .sort();

  const findings = [];
  for (const file of files) findings.push(...checkRootBarrelImports(file, fs.readFileSync(file, 'utf8')));

  if (findings.length > 0) {
    console.error(`Root-barrel import check failed with ${findings.length} finding(s):`);
    for (const finding of findings.sort()) console.error(`- ${finding}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Root-barrel import check passed: ${files.length} llms/*.md file(s) checked, no bare ` +
        `'${PACKAGE_NAME}' imports found inside a code example.`,
    );
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) run();

export { run };

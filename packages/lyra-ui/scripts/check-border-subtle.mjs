#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

// `--lr-color-border-subtle` (src/internal/tokens.styles.ts, see its BORDER_SUBTLE note) is the
// decorative edge tier: a divider or rule, a card, panel, table or section edge, a separator
// between items. It resolves to `--lr-color-border` until an application sets
// `--lr-theme-color-surface-border-subtle`, and the whole point of that input is that a theme may
// set it well below 3:1 against the page -- a hairline that reads as quiet structure, not as a
// boundary anyone has to find.
//
// A form control's border is the opposite case. It is the visible boundary a user locates and
// identifies the control by, which WCAG 2.2 SC 1.4.11 (Non-text Contrast) requires to reach 3:1
// against adjacent colours. Every form control therefore stays on `--lr-color-border` (or
// `--lr-color-border-strong`), and this gate fails the build if the subtle tier -- or its theme
// input, which paints the same colour when read directly -- appears anywhere in
// `src/components/forms/**` or in the shared `src/internal/form-control.styles.ts` that every
// labelled control adopts. Nothing else would notice: with the input unset the two tokens resolve
// to the same colour, so a control re-pointed by mistake renders identically in every test until
// a theme sets the input, and then fails contrast only in that theme.
//
// The match is on the literal name, comments included and not a parsed stylesheet: a control
// boundary most often drifts onto a decorative token through a copied line, and a commented-out
// copy is one edit away from shipping. Test files are exempt, because a test legitimately names the
// token to assert that a control does NOT resolve to it. A guarded path that no longer exists fails
// the gate rather than letting it shrink silently after a move or rename.
//
// Run: node scripts/check-border-subtle.mjs

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultPackageDir = dirname(dirname(fileURLToPath(import.meta.url)));

/** The decorative-tier names a form control may never read. */
export const SUBTLE_BORDER_TOKENS = Object.freeze([
  '--lr-color-border-subtle',
  '--lr-theme-color-surface-border-subtle',
]);

/** Package-relative paths the rule covers: a directory is walked recursively, a file stands alone. */
export const GUARDED_PATHS = Object.freeze([
  'src/components/forms',
  'src/internal/form-control.styles.ts',
]);

const TOKEN_PATTERN = new RegExp(
  SUBTLE_BORDER_TOKENS.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g',
);

const toPosix = (path) => path.split(sep).join('/');

/** Whether `file` is a test module (`*.test.ts`, `*.docs.test.mjs`, ...), which never ships. */
export function isTestFile(file) {
  return /\.test\.[cm]?[jt]s$/.test(file);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

/**
 * Every non-test file under the guarded paths, package-relative and sorted, plus any guarded path
 * that no longer exists.
 *
 * @param {string} packageDir
 * @param {readonly string[]} guardedPaths
 * @returns {{ files: string[]; missing: string[] }}
 */
export function listGuardedFiles(packageDir = defaultPackageDir, guardedPaths = GUARDED_PATHS) {
  const files = [];
  const missing = [];
  for (const guarded of guardedPaths) {
    const absolute = join(packageDir, ...guarded.split('/'));
    if (!existsSync(absolute)) {
      missing.push(guarded);
      continue;
    }
    const found = statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
    for (const file of found) {
      if (!isTestFile(file)) files.push(toPosix(relative(packageDir, file)));
    }
  }
  return { files: [...new Set(files)].sort(), missing };
}

/**
 * Every occurrence of a decorative-tier name in `source`, with 1-based line and column.
 *
 * @param {string} source
 * @returns {{ line: number; column: number; token: string }[]}
 */
export function findSubtleBorderReferences(source) {
  const references = [];
  source.split('\n').forEach((text, index) => {
    for (const match of text.matchAll(TOKEN_PATTERN)) {
      references.push({ line: index + 1, column: match.index + 1, token: match[0] });
    }
  });
  return references;
}

/**
 * Scans the guarded form-control sources of `packageDir`.
 *
 * @param {string} packageDir
 * @param {readonly string[]} guardedPaths
 */
export function checkBorderSubtle(packageDir = defaultPackageDir, guardedPaths = GUARDED_PATHS) {
  const { files, missing } = listGuardedFiles(packageDir, guardedPaths);
  const findings = files.flatMap((file) =>
    findSubtleBorderReferences(readFileSync(join(packageDir, ...file.split('/')), 'utf8')).map(
      (reference) => ({ file, ...reference }),
    ),
  );
  return { files, missing, findings };
}

/**
 * The gate's verdict and the text to print for it.
 *
 * @param {{ files: string[]; missing: string[]; findings: { file: string; line: number; column: number; token: string }[] }} result
 * @returns {{ ok: boolean; message: string }}
 */
export function formatReport({ files, missing, findings }) {
  if (missing.length) {
    return {
      ok: false,
      message: [
        'Border-subtle contract cannot run: guarded path(s) no longer exist:',
        ...missing.map((path) => `- ${path}`),
        '',
        'Update GUARDED_PATHS in scripts/check-border-subtle.mjs to the new location rather than ' +
          'letting the gate silently stop covering those form controls.',
      ].join('\n'),
    };
  }
  if (files.length === 0) {
    return {
      ok: false,
      message: 'Border-subtle contract matched ZERO form-control files -- the source layout changed.',
    };
  }
  if (findings.length) {
    return {
      ok: false,
      message: [
        `Border-subtle contract failed: ${findings.length} reference(s) to the decorative border tier ` +
          `in ${files.length} guarded form-control file(s):`,
        ...findings.map(({ file, line, column, token }) => `- ${file}:${line}:${column} ${token}`),
        '',
        '--lr-color-border-subtle (and its input --lr-theme-color-surface-border-subtle) is the ' +
          'decorative edge tier: dividers, rules, card/panel/table/section edges, separators between ' +
          'items. A theme may set it well below 3:1 against the page. A form control\'s border is the ' +
          'visible boundary a user finds and identifies the control by, and WCAG 2.2 SC 1.4.11 ' +
          '(Non-text Contrast) requires that boundary to reach 3:1 against adjacent colours -- so ' +
          'src/components/forms/** and src/internal/form-control.styles.ts draw it with ' +
          '--lr-color-border (or --lr-color-border-strong). The rule is on the literal name, comments ' +
          'included; only *.test.* files are exempt.',
      ].join('\n'),
    };
  }
  return {
    ok: true,
    message:
      `Border-subtle contract passed: 0 references to the decorative border tier in ${files.length} ` +
      'guarded form-control file(s).',
  };
}

if (isMainModule(import.meta.url)) {
  const report = formatReport(checkBorderSubtle());
  if (report.ok) {
    console.log(report.message);
  } else {
    console.error(report.message);
    process.exitCode = 1;
  }
}

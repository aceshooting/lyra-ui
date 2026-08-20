// Every `@aceshooting/lyra-ui/...` specifier that a SHIPPED file tells a reader to import must
// actually resolve through `package.json#exports`. An exports map blocks everything it does not
// list, so a documented-but-unlisted specifier is not a soft docs bug -- it is a hard build error
// in the consumer, with the library's own docs as the thing that caused it.
//
// This exists because that happened twice, silently:
//   * `flag-peer-bulk.js` -- 11.2.0's headline <lr-flag> entry point, named by the changelog, by
//     `llms/components/lr-flag.md` and by `flag.class.d.ts`, shipped with no export route at all.
//     `findUnclassifiedHelperModules()` is supposed to make that impossible, and missed it because
//     a qualified suffix (`-peer-bulk`) is not the bare suffix (`-peer`).
//   * `flow-canvas/flow-types.js` -- named as an import in `llms/data.md` and the generated
//     `llms/components/lr-flow-canvas.md`, likewise unlisted. Nothing in the naming convention
//     would ever have caught this one.
//
// The lesson both share is that a naming convention over the SOURCE tree cannot see a promise made
// in prose. This check reads the promises instead: it starts from what is written down, not from
// what the file tree happens to look like, so it catches the next one whatever it is called.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));

const PACKAGE_NAME = '@aceshooting/lyra-ui';

/**
 * Specifiers that appear inside a real import statement in a shipped file and are nonetheless
 * expected NOT to resolve. Each needs a reason; "it's fine" is not one. Keep this list tiny -- an
 * entry here is a promise this check has agreed not to keep.
 */
export const DOC_SPECIFIER_EXCEPTIONS = Object.freeze([
  {
    specifier: '@aceshooting/lyra-ui/internal/positioner.js',
    reason:
      'Deliberately-dead path shown as the "before" half of the 8.0.0 internal/ -> utilities/ '
      + 'migration example in README.md and llms/shared.md. The example exists precisely to say '
      + 'this specifier no longer resolves, so resolving it would falsify the documentation.',
  },
]);

const SCANNED_ROOTS = Object.freeze(['llms', 'src']);
const SCANNED_FILES = Object.freeze(['README.md', 'llms.txt', 'llms-full.txt']);

// Only real module specifiers count. Bare prose mentions of a directory (`@aceshooting/lyra-ui/
// components/`), and namespaced identifier strings that merely borrow the package name
// (`Symbol.for('@aceshooting/lyra-ui/markdown-katex-override')`, the toast-region protocol ids),
// are not instructions to import anything.
//
// Two shapes count, and BOTH are needed. A code-fence `import ... from '<specifier>'` is the
// obvious one, and it is how `flow-types.js` was promised. It is NOT how `flag-peer-bulk.js` was
// promised: `llms/components/lr-flag.md` says "Alternatively, import `<specifier>` instead of ..."
// in running prose. A reader acts on that sentence exactly as readily as on a fenced example, so a
// check that only understood fenced imports would have re-shipped the very bug that motivated it.
const IMPORT_PATTERNS = Object.freeze([
  /\bfrom\s*(['"])([^'"]+)\1/g,
  /\bimport\s*(['"])([^'"]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  /\bexport\s*\*\s*from\s*(['"])([^'"]+)\1/g,
]);

// A concrete module path anywhere -- prose, backticks, a JSDoc line. Requiring a real file
// extension is what keeps directory prose and `Symbol.for()` namespaces out. The trailing
// `(?![A-Za-z0-9])` is load-bearing: without it the `js` alternative matches the first three
// characters of `.json` and reports a `custom-elements.js` nobody ever wrote.
const CONCRETE_MODULE_PATTERN = /(?<!node_modules\/)@aceshooting\/lyra-ui\/[A-Za-z0-9._/-]+\.(?:js|css|json)(?![A-Za-z0-9])/g;

function walkFiles(directory, out = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(entryPath, out);
    else out.push(entryPath);
  }
  return out;
}

function scannedFiles(packageDir) {
  const files = [];
  for (const name of SCANNED_FILES) {
    const path = join(packageDir, name);
    try {
      if (statSync(path).isFile()) files.push(path);
    } catch {
      // Optional: llms-full.txt is generated and may legitimately be absent mid-build.
    }
  }
  for (const root of SCANNED_ROOTS) {
    const path = join(packageDir, root);
    try {
      if (!statSync(path).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of walkFiles(path)) {
      if (file.endsWith('.test.ts') || file.endsWith('.stories.ts')) continue;
      if (file.endsWith('.md') || file.endsWith('.ts') || file.endsWith('.txt')) files.push(file);
    }
  }
  return files;
}

/** Every distinct `@aceshooting/lyra-ui/...` specifier a shipped file tells a reader to import. */
export function collectDocumentedSpecifiers(packageDir = defaultPackageDir) {
  const found = new Map();
  for (const file of scannedFiles(packageDir)) {
    const contents = readFileSync(file, 'utf8');
    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(contents)) !== null) {
        const specifier = match[2];
        if (specifier !== PACKAGE_NAME && !specifier.startsWith(`${PACKAGE_NAME}/`)) continue;
        if (!found.has(specifier)) found.set(specifier, new Set());
        found.get(specifier).add(relative(packageDir, file).replaceAll('\\', '/'));
      }
    }
    CONCRETE_MODULE_PATTERN.lastIndex = 0;
    let concrete;
    while ((concrete = CONCRETE_MODULE_PATTERN.exec(contents)) !== null) {
      const specifier = concrete[0];
      if (!found.has(specifier)) found.set(specifier, new Set());
      found.get(specifier).add(relative(packageDir, file).replaceAll('\\', '/'));
    }
  }
  return found;
}

function resolvesThroughExports(specifier, exportsMap) {
  const subpath = specifier === PACKAGE_NAME ? '.' : `./${specifier.slice(PACKAGE_NAME.length + 1)}`;
  if (Object.hasOwn(exportsMap, subpath)) return true;
  for (const key of Object.keys(exportsMap)) {
    const star = key.indexOf('*');
    if (star === -1) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (subpath.length >= prefix.length + suffix.length
      && subpath.startsWith(prefix)
      && subpath.endsWith(suffix)) return true;
  }
  return false;
}

export function checkDocumentedSpecifiers(packageDir = defaultPackageDir) {
  const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  const exportsMap = pkg.exports ?? {};
  const excused = new Set(DOC_SPECIFIER_EXCEPTIONS.map((entry) => entry.specifier));
  const findings = [];

  for (const entry of DOC_SPECIFIER_EXCEPTIONS) {
    if (!resolvesThroughExports(entry.specifier, exportsMap)) continue;
    // A stale exception is as much a silent gap as a missing one: it excuses a specifier that no
    // longer needs excusing, and would go on excusing a genuinely-broken future namesake.
    findings.push(
      `${entry.specifier} is listed in DOC_SPECIFIER_EXCEPTIONS but now resolves through `
      + 'package.json#exports -- drop the exception',
    );
  }

  for (const [specifier, files] of [...collectDocumentedSpecifiers(packageDir)].sort()) {
    if (excused.has(specifier)) continue;
    if (resolvesThroughExports(specifier, exportsMap)) continue;
    findings.push(
      `${specifier} is documented as an import in ${[...files].sort().join(', ')} but does not `
      + 'resolve through package.json#exports',
    );
  }
  return { findings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { findings } = checkDocumentedSpecifiers();
  if (findings.length > 0) {
    console.error('Documented package specifiers that do not resolve:');
    for (const finding of findings) console.error(`  - ${finding}`);
    console.error(
      '\nAn exports map blocks every subpath it does not list, so each of these is a hard build '
      + 'error for a consumer following the docs. Add the route (scripts/generate-package-exports.mjs) '
      + 'or correct the documentation.',
    );
    process.exit(1);
  }
  console.log('documented package specifiers all resolve through package.json#exports.');
}

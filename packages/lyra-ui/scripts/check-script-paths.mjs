// Guards against a silent, fully-green CI lie: a package.json script that names test files by
// literal path drifts out of date after a directory restructure, and `wtr` does NOT error on a
// path argument that matches no file -- it silently drops the non-matching patterns and runs
// whatever is left, exiting 0.
//
// This is not hypothetical. After the 11-family restructure moved every component from
// `src/components/<name>/` to `src/components/<family>/<name>/`, `test:platform` kept its 21
// pre-restructure literal paths. Exactly one of them (`src/internal/form-associated.test.ts`)
// still resolved, so the `platform-contracts` job -- 4 matrix legs of Firefox/WebKit x Node 20/22,
// the entire reason cross-browser contract coverage exists -- ran 1 test file instead of 21 and
// reported green for checkbox/select/combobox/dialog/drawer/menu/tabs/tree/table/virtual-list/
// carousel/tool-approval-dialog, none of which had executed on those browsers since the move.
//
// (`wtr` only hard-fails when *none* of the patterns match anything. A partially-stale list is the
// dangerous case, because it stays invisible.)
//
// So: every literal source path appearing in any package.json script must exist on disk.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const packageJsonPath = join(packageDir, 'package.json');

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const scripts = pkg.scripts ?? {};

// A literal, non-glob path into the package's own sources. Globs are excluded deliberately: a glob
// that matches nothing is a separate (and much more visible) failure mode, and several scripts
// legitimately pass globs that resolve at runtime.
const LITERAL_PATH = /(?<![\w*?[\]{}])(?:src|scripts|test)\/[\w./-]+\.(?:ts|mjs|js|json|css)\b/g;

const errors = [];
let checked = 0;

for (const [name, body] of Object.entries(scripts)) {
  if (typeof body !== 'string') continue;
  for (const match of body.match(LITERAL_PATH) ?? []) {
    if (match.includes('*')) continue;
    checked += 1;
    if (!existsSync(join(packageDir, match))) {
      errors.push(`- scripts.${name}: "${match}" does not exist`);
    }
  }
}

if (errors.length > 0) {
  console.error(`package.json script path check failed with ${errors.length} missing path(s):\n`);
  console.error(errors.join('\n'));
  console.error(
    '\nA test runner that is handed a non-existent literal path does not necessarily fail -- it can\n' +
      'silently skip it and still exit 0, so a stale path here means those tests stopped running\n' +
      'while CI kept reporting green. Update the path, or delete it if the file is genuinely gone.',
  );
  process.exit(1);
}

console.log(`package.json script path check passed: ${checked} literal path(s) all exist.`);

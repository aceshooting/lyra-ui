// Every attribute-backed `type: Number` reactive property must parse a blank attribute (empty or
// whitespace-only) to its declared default. Lit's built-in Number converter yields `Number('')`,
// i.e. `0`, so a framework binding that serializes an unset value as `attr=""` would silently
// replace the default with zero. The shared fix is `blankNumberConverter(<default>)` from
// `src/internal/converters.ts`; `declaredDefaultConverter(<number>)` is blank-safe too.
//
// `blankNumberConverter` replaces `type: Number` (it fully defines parsing and serialization), so a
// remaining `type: Number` property passes only when it opts out of attribute handling
// (`attribute: false`), routes through one of the blank-safe converters above, or uses a converter
// identifier the same file defines as `const <name> = blankNumberConverter(...)` or that is listed
// in BLANK_SAFE_CONVERTERS below.
// Anything else needs an inline justification directly above the declaration:
//   // blank-number-exempt: <short reason>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walk } from './lib/fs-walk.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roots = [path.join(packageDir, 'src', 'components'), path.join(packageDir, 'src', 'internal')];

// Named converters that already map a blank attribute to their unset/default value.
const BLANK_SAFE_CONVERTERS = new Set([
  'lengthLimitConverter', // internal/length-constraints.ts: blank -> undefined (no limit)
  'optionalCellSizeConverter', // heatmap-config.ts: blank -> undefined (auto size)
  'bucketCountConverter', // heatmap-config.ts: blank -> DEFAULT_BUCKET_COUNT
]);
const BLANK_SAFE_FACTORIES = /^(?:blankNumberConverter|declaredDefaultConverter)\s*\(/;
const EXEMPT_RE = /^\s*\/\/\s*blank-number-exempt:\s*(.+?)\s*$/;

function matchBalanced(source, openIndex, openChar, closeChar) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === openChar) depth++;
    else if (source[i] === closeChar && --depth === 0) return i;
  }
  return -1;
}

/** Yields `{ options, index }` for every decorator and `static properties` entry declaring `type: Number`. */
function* numericDeclarations(source) {
  const decoratorRe = /@property\s*\(/g;
  let match;
  while ((match = decoratorRe.exec(source))) {
    const open = match.index + match[0].length - 1;
    const close = matchBalanced(source, open, '(', ')');
    if (close === -1) continue;
    const options = source.slice(open + 1, close);
    if (/\btype\s*:\s*Number\b/.test(options)) yield { options, index: match.index };
  }
  const staticRe = /static\s+(?:override\s+)?(?:readonly\s+)?properties\s*(?::[^=]+)?=\s*\{/g;
  while ((match = staticRe.exec(source))) {
    const open = match.index + match[0].length - 1;
    const close = matchBalanced(source, open, '{', '}');
    if (close === -1) continue;
    const block = source.slice(open + 1, close);
    const entryRe = /\w+\s*:\s*\{/g;
    let entry;
    while ((entry = entryRe.exec(block))) {
      const entryOpen = entry.index + entry[0].length - 1;
      const entryClose = matchBalanced(block, entryOpen, '{', '}');
      if (entryClose === -1) continue;
      const options = block.slice(entryOpen + 1, entryClose);
      if (/\btype\s*:\s*Number\b/.test(options)) yield { options, index: open + 1 + entry.index };
    }
  }
}

function isBlankSafe(options, source) {
  if (/\battribute\s*:\s*false\b/.test(options)) return true;
  const converter = /\bconverter\s*:\s*([^,}]+)/.exec(options)?.[1].trim();
  if (!converter) return false;
  if (BLANK_SAFE_FACTORIES.test(converter)) return true;
  if (!/^\w+$/.test(converter)) return false;
  if (BLANK_SAFE_CONVERTERS.has(converter)) return true;
  return new RegExp(`\\bconst\\s+${converter}\\s*=\\s*blankNumberConverter\\s*\\(`).test(source);
}

function exemption(lines, line) {
  for (let i = line - 1; i >= 0 && line - i <= 15; i--) {
    const text = lines[i];
    if (text.trim() === '') continue;
    const found = EXEMPT_RE.exec(text);
    if (found) return found[1];
    if (!/^\s*(?:\/\/|\/\*\*?|\*)/.test(text)) break;
  }
  return null;
}

const files = roots
  .flatMap((root) => (fs.existsSync(root) ? walk(root) : []))
  .filter((file) => file.endsWith('.ts') && !/\.(?:test|stories|d)\.ts$/.test(file))
  .sort();

let total = 0;
const exempted = [];
const flagged = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split('\n');
  for (const { options, index } of numericDeclarations(source)) {
    total += 1;
    if (isBlankSafe(options, source)) continue;
    const line = source.slice(0, index).split('\n').length - 1;
    const where = `${path.relative(packageDir, file)}:${line + 1}`;
    const reason = exemption(lines, line);
    if (reason) exempted.push(`${where} -- ${reason}`);
    else flagged.push(where);
  }
}

console.log(`Blank numeric attribute check: ${total} \`type: Number\` properties across ${files.length} component and internal source files.`);
for (const item of exempted) console.log(`  exempt: ${item}`);
if (flagged.length > 0) {
  console.error(`\nBlank numeric attribute check failed with ${flagged.length} finding(s):`);
  for (const item of flagged) console.error(`- ${item}`);
  console.error(
    '\nAn attribute-backed `type: Number` property must parse a blank attribute to its default.\n' +
      'Replace `type: Number` with\n' +
      '  converter: blankNumberConverter(<declared default>)\n' +
      'from src/internal/converters.ts, or justify the exception with an inline comment above it:\n' +
      '  // blank-number-exempt: <short reason>\n',
  );
  process.exitCode = 1;
} else {
  console.log('Blank numeric attribute check passed.');
}

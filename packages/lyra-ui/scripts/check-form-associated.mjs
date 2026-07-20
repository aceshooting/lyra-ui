// Guards against a bug class that has already recurred once in this package: a form-associated
// custom element (`static formAssociated = true`, or the shared `FormAssociated` mixin from
// `internal/form-associated.ts`) that doesn't follow the hardened pattern established for this
// package (see checkbox.class.ts/switch.class.ts/model-select.class.ts/tool-param-form.class.ts
// for the reference shape):
//
//   (a) a component that builds its OWN fieldset-inheritance state (a private
//       `_fieldsetDisabled` field and/or a public `effectiveDisabled` getter, declared outside the
//       shared mixin) must also implement `formDisabledCallback()` to populate that state --
//       otherwise an ancestor `<fieldset disabled>` toggling never reaches this component at all.
//       (checkbox-group's `formDisabledCallback` once mutated children's own `disabled` directly
//       instead of populating this kind of state; radio once had `_fieldsetDisabled`/
//       `effectiveDisabled` with no `formDisabledCallback` at all -- this rule catches both shapes.)
//
//   (b) `name`/`required`/`disabled` specifically must not be plain `@property(...)`-reflected
//       fields on a form-associated component -- they need a `noAccessor: true` reactive-property
//       declaration paired with a hand-written `get`/`set` pair, so the host attribute and
//       `ElementInternals` validity/value are recomputed synchronously on assignment, not only on
//       Lit's async update cycle. (token-input once declared all three as plain
//       `@property({reflect: true})` fields.)
//
// A component that extends the shared `FormAssociated` mixin directly and never redeclares
// name/required/disabled gets both of the above for free and is not flagged.
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const componentsRoot = join(packageDir, 'src', 'components');

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(entryPath));
    else files.push(entryPath);
  }
  return files;
}

/** Returns the substring from `source[openBraceIndex]` (which must be `'{'`) through its matching
 *  closing brace, inclusive -- a small hand-rolled balanced-brace scan, since `static properties =
 *  { ... }` blocks nest per-property option objects and a naive `[^}]*` regex would stop at the
 *  first inner `}`. */
function extractBalanced(source, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openBraceIndex, i + 1);
    }
  }
  return null;
}

function findStaticPropertiesBlock(source) {
  const markerIndex = source.indexOf('static properties');
  if (markerIndex === -1) return null;
  const braceIndex = source.indexOf('{', markerIndex);
  if (braceIndex === -1) return null;
  return extractBalanced(source, braceIndex);
}

function hasHandWrittenAccessorPair(source, field) {
  const getRe = new RegExp(`\\bget\\s+${field}\\s*\\(`);
  const setRe = new RegExp(`\\bset\\s+${field}\\s*\\(`);
  return getRe.test(source) && setRe.test(source);
}

/**
 * Determines how (if at all) `field` (one of `name`/`required`/`disabled`) is redeclared in this
 * class's own source, returning:
 *   - `{ declared: false }` -- never redeclared here (fully inherited from the mixin -- fine).
 *   - `{ declared: true, safe: true }` -- redeclared via the `noAccessor: true` + hand-written
 *     `get`/`set` pattern (or an `@property({ noAccessor: true })`-decorated accessor pair).
 *   - `{ declared: true, safe: false, reason }` -- redeclared as a plain reactive property with no
 *     synchronous accessor, or `noAccessor: true` was set but no hand-written pair was found.
 */
function checkFieldDeclaration(source, field) {
  let declared = false;

  // Shape 1: an `@property(...)` decorator directly on a plain class-field declaration, e.g.
  // `@property({ type: Boolean, reflect: true }) disabled = false;`. A decorator immediately
  // followed by `field(` (not `=`/`:`/`;`) is instead decorating a getter directly -- a distinct,
  // and in this codebase currently unused for these three fields, valid shape -- so that case is
  // deliberately excluded from this match.
  const decoratorRe = new RegExp(`@property\\(([^)]*)\\)\\s*(?:override\\s+)?(?:declare\\s+)?${field}\\s*[:=;]`);
  const decoratorMatch = source.match(decoratorRe);
  if (decoratorMatch) {
    declared = true;
    const noAccessor = /noAccessor\s*:\s*true/.test(decoratorMatch[1]);
    if (noAccessor && hasHandWrittenAccessorPair(source, field)) {
      return { declared, safe: true };
    }
    if (!noAccessor) {
      return {
        declared,
        safe: false,
        reason: `declared as a plain \`@property(...)\` field (no \`noAccessor: true\` + hand-written get/set pair)`,
      };
    }
  }

  // Shape 2: a `static properties = { field: { ... } }` reactive-metadata entry -- the paired
  // hand-written `get`/`set` (if any) live elsewhere in the class body, not attached to this entry.
  const staticBlock = findStaticPropertiesBlock(source);
  if (staticBlock) {
    const entryRe = new RegExp(`\\b${field}\\s*:\\s*\\{([^}]*)\\}`);
    const entryMatch = staticBlock.match(entryRe);
    if (entryMatch) {
      declared = true;
      const noAccessor = /noAccessor\s*:\s*true/.test(entryMatch[1]);
      const hasPair = hasHandWrittenAccessorPair(source, field);
      if (noAccessor && hasPair) return { declared, safe: true };
      if (!noAccessor) {
        return {
          declared,
          safe: false,
          reason: `declared in \`static properties\` without \`noAccessor: true\` (Lit auto-generates an async accessor for it)`,
        };
      }
      if (noAccessor && !hasPair) {
        return {
          declared,
          safe: false,
          reason: '`noAccessor: true` is set but no hand-written `get`/`set` pair was found for it',
        };
      }
    }
  }

  if (declared) {
    // Reached only if shape 1 matched with `noAccessor: true` but no accessor pair -- fall through
    // to the same "missing pair" reason as shape 2's equivalent branch.
    return {
      declared,
      safe: false,
      reason: '`noAccessor: true` is set but no hand-written `get`/`set` pair was found for it',
    };
  }

  return { declared: false };
}

const FORM_CRITICAL_FIELDS = ['name', 'required', 'disabled'];

const classFiles = walk(componentsRoot)
  .filter((file) => file.endsWith('.class.ts'))
  .sort();

const violations = [];
let scannedFormAssociated = 0;

for (const file of classFiles) {
  const source = readFileSync(file, 'utf8');
  const relPath = relative(packageDir, file).replaceAll('\\', '/');

  const isDirectFormAssociated = /static\s+formAssociated\s*=\s*true\b/.test(source);
  const isMixinConsumer = /extends\s+FormAssociated\s*\(/.test(source);
  if (!isDirectFormAssociated && !isMixinConsumer) continue;
  scannedFormAssociated += 1;

  const classNameMatch = source.match(/export class (\w+)/);
  const componentName = classNameMatch ? classNameMatch[1] : basename(dirname(file));

  // Rule (a): only components implementing their own parallel fieldset-inheritance state, outside
  // the shared mixin, are in scope -- a mixin consumer gets `formDisabledCallback` for free, and
  // merely *using* the inherited `effectiveDisabled` getter (e.g. in a `?disabled=...` binding)
  // must not be confused with *declaring* it.
  if (isDirectFormAssociated && !isMixinConsumer) {
    const declaresFieldsetState = /\b_fieldsetDisabled\b/.test(source) || /\beffectiveDisabled\b/.test(source);
    const implementsCallback = /formDisabledCallback\s*\([^)]*\)\s*(?::\s*[\w<>[\], ]+\s*)?\{/.test(source);
    if (declaresFieldsetState && !implementsCallback) {
      violations.push({
        component: componentName,
        file: relPath,
        rule: 'a',
        message:
          'declares its own fieldset-inheritance state (`_fieldsetDisabled`/`effectiveDisabled`) but ' +
          'does not implement `formDisabledCallback(disabled: boolean)` -- an ancestor `<fieldset disabled>` ' +
          'will never reach this component.',
      });
    }
  }

  // Rule (b): name/required/disabled must not be plain reflected properties on ANY form-associated
  // component (mixin consumer or direct implementer) if they're redeclared at all.
  for (const field of FORM_CRITICAL_FIELDS) {
    const result = checkFieldDeclaration(source, field);
    if (result.declared && !result.safe) {
      violations.push({
        component: componentName,
        file: relPath,
        rule: 'b',
        message: `\`${field}\` is ${result.reason} -- assignment won't synchronously reflect the host attribute ` +
          `or recompute ElementInternals validity/value before a same-tick native form API ` +
          `(submit/requestSubmit/checkValidity/fieldset toggling) runs.`,
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`Form-associated hardening check found ${violations.length} violation(s):\n`);
  for (const violation of violations) {
    console.error(`  [rule ${violation.rule}] ${violation.component} (${violation.file})`);
    console.error(`    ${violation.message}\n`);
  }
  console.error(
    'See checkbox.class.ts/switch.class.ts/model-select.class.ts/tool-param-form.class.ts for the reference shape.',
  );
  process.exitCode = 1;
} else {
  console.log(
    `Form-associated hardening check passed: ${scannedFormAssociated} form-associated component(s) scanned, no violations.`,
  );
}

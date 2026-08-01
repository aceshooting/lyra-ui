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
//   (c) a component that carries a form VALUE (a `value` property, or any `setFormValue()` call)
//       must expose `setCustomValidity(message)` -- the standard channel for an error no
//       client-side constraint can express (a server-side rejection). Without it a consumer can
//       never put the control into `customError`, and `checkValidity()`/`:invalid`/`user-invalid`
//       have no way to reflect a rejection the form already knows about. Declaring it directly
//       satisfies the rule, and so does inheriting it -- `extends FormAssociated(...)` (the shared
//       mixin implements it), a local alias of that application, or a base class that declares it.
//       A form-associated element that carries no value at all (`<lr-icon-button>`, which is
//       form-associated only so a submit/reset `type` is discoverable) is out of scope.
//       (This rule is itself an incident: for two majors this file reported "no violations" while
//       17 value-carrying controls had no `setCustomValidity` at all -- it simply did not check the
//       thing. Note also that a raw-source scan would have reported the opposite of the truth, since
//       every hardened control's `@cssstate valid` JSDoc names the method in prose; see
//       `stripComments` below.)
//
// A component that extends the shared `FormAssociated` mixin directly and never redeclares
// name/required/disabled gets all of the above for free and is not flagged.
//
// Self-test: `node scripts/check-form-associated.test.mjs`.
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const srcRoot = join(packageDir, 'src');
const componentsRoot = join(srcRoot, 'components');

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

/**
 * Returns `source` with every line and block comment replaced by whitespace, leaving string and
 * template-literal bodies intact.
 *
 * Rule (c) cannot run on raw source: every hardened control documents the method in its
 * `@cssstate valid` JSDoc ("...including any `setCustomValidity()` error"), so a raw substring scan
 * answers the exact opposite of the truth for checkbox/select/switch/radio/model-select/
 * voice-picker -- all of which name the method in prose while never declaring it. Rules (a) and (b)
 * deliberately keep matching the raw source, which is what they were written and validated against.
 */
export function stripComments(source) {
  let out = '';
  let index = 0;
  // Last non-whitespace character emitted, used only to tell a regex literal from a division.
  let previous = '';
  const length = source.length;

  const isRegexPosition = () => previous === '' || '(,=:[!&|?{};+-*%~^<>'.includes(previous);

  while (index < length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '/' && next === '/') {
      while (index < length && source[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 2;
      out += ' ';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      out += char;
      index += 1;
      while (index < length) {
        if (source[index] === '\\') {
          out += source.slice(index, index + 2);
          index += 2;
          continue;
        }
        out += source[index];
        index += 1;
        if (source[index - 1] === quote) break;
      }
      previous = quote;
      continue;
    }
    if (char === '/' && isRegexPosition()) {
      // A regex literal: consume it whole so an embedded `//` (e.g. `/\/\//`) is not mistaken for a
      // line comment, which would swallow the rest of that line of real code.
      out += char;
      index += 1;
      let inClass = false;
      while (index < length) {
        const current = source[index];
        if (current === '\\') {
          out += source.slice(index, index + 2);
          index += 2;
          continue;
        }
        if (current === '[') inClass = true;
        else if (current === ']') inClass = false;
        out += current;
        index += 1;
        if (current === '/' && !inClass) break;
        if (current === '\n') break; // Unterminated: not a regex after all, stop guessing.
      }
      previous = '/';
      continue;
    }

    out += char;
    if (!/\s/.test(char)) previous = char;
    index += 1;
  }

  return out;
}

/**
 * True when this source carries a submission value: a `value` reactive property (decorated field,
 * `static properties` entry, or hand-written accessor) or any `setFormValue()` call -- including
 * `this.internals.setFormValue(...)`, which is the whole point, so dotted calls must NOT be
 * excluded here (unlike `declaresSetCustomValidity` below, where a dotted call is a delegation, not
 * a declaration). Reading some *other* object's `.value` never qualifies.
 */
export function carriesFormValue(code) {
  if (/\bsetFormValue\s*\(/.test(code)) return true;
  if (/@property\(([^)]*)\)\s*(?:override\s+)?(?:declare\s+)?(?:accessor\s+)?value\s*[:=;]/.test(code)) return true;
  if (/(?:^|[^.\w$])(?:get|set)\s+value\s*\(/.test(code)) return true;
  if (/(?:^|[^.\w$])(?:override|declare|accessor)\s+value\s*[:=]/.test(code)) return true;
  const staticBlock = findStaticPropertiesBlock(code);
  if (staticBlock && /\bvalue\s*:\s*\{/.test(staticBlock)) return true;
  return false;
}

/**
 * True when this source *declares* `setCustomValidity` -- a method with a body, or a class field
 * holding a function. A call through a receiver (`this.validityController.setCustomValidity(msg)`,
 * `this.input?.setCustomValidity('')`) is a delegation, not a declaration, and must not count:
 * those are exactly the lines a component has while still leaving consumers with no entry point.
 */
export function declaresSetCustomValidity(code) {
  const declarationRe =
    /(?:^|[^.\w$])(?:override\s+|public\s+|protected\s+|private\s+|async\s+|static\s+)*setCustomValidity\s*\([^)]*\)\s*(?::[^{;=]*)?\{/;
  if (declarationRe.test(code)) return true;
  return /(?:^|[^.\w$])setCustomValidity\s*(?::[^=;]*)?=\s*(?:async\s+)?(?:\(|function\b)/.test(code);
}

/** Every identifier this source extends, whether directly (`extends Base`) or through a mixin
 *  application (`extends FormAssociated(Base)` yields `FormAssociated`). */
export function extendsBaseNames(code) {
  return new Set([...code.matchAll(/\bextends\s+([A-Za-z_$][\w$]*)/g)].map((match) => match[1]));
}

/** Top-level exported binding names, used to publish a file's declarations as validity providers. */
export function exportedTopLevelNames(code) {
  return new Set(
    [...code.matchAll(/\bexport\s+(?:default\s+)?(?:abstract\s+)?(?:class|function|const|let|var)\s+([A-Za-z_$][\w$]*)/g)]
      .map((match) => match[1]),
  );
}

/** Bases known to supply `setCustomValidity` to whatever extends them. The runner grows this from
 *  the tree (see `collectValidityProviders`); the mixin is the seed so the analyzer is usable
 *  standalone, e.g. from the self-test. */
export const DEFAULT_VALIDITY_PROVIDERS = new Set(['FormAssociated']);

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

/**
 * Applies every rule to one class file's source.
 *
 * @param {string} source raw file text (comments included -- rule (c) strips them itself).
 * @param {{ file?: string, component?: string, validityProviders?: Set<string> }} [options]
 * @returns {{ formAssociated: boolean, violations: Array<{ component: string, file: string, rule: string, message: string }> }}
 */
export function findFormAssociatedViolations(source, options = {}) {
  const {
    file = 'fixture.class.ts',
    component,
    validityProviders = DEFAULT_VALIDITY_PROVIDERS,
  } = options;

  const code = stripComments(source);
  const isDirectFormAssociated = /static\s+formAssociated\s*=\s*true\b/.test(code);
  const isMixinConsumer = /extends\s+FormAssociated\s*\(/.test(code);
  if (!isDirectFormAssociated && !isMixinConsumer) return { formAssociated: false, violations: [] };

  const classNameMatch = source.match(/export class (\w+)/);
  const componentName = component ?? (classNameMatch ? classNameMatch[1] : basename(dirname(file)));
  const violations = [];
  const add = (rule, message) => violations.push({ component: componentName, file, rule, message });

  // Rule (a): only components implementing their own parallel fieldset-inheritance state, outside
  // the shared mixin, are in scope -- a mixin consumer gets `formDisabledCallback` for free, and
  // merely *using* the inherited `effectiveDisabled` getter (e.g. in a `?disabled=...` binding)
  // must not be confused with *declaring* it.
  if (isDirectFormAssociated && !isMixinConsumer) {
    const declaresFieldsetState = /\b_fieldsetDisabled\b/.test(source) || /\beffectiveDisabled\b/.test(source);
    const implementsCallback = /formDisabledCallback\s*\([^)]*\)\s*(?::\s*[\w<>[\], ]+\s*)?\{/.test(source);
    if (declaresFieldsetState && !implementsCallback) {
      add(
        'a',
        'declares its own fieldset-inheritance state (`_fieldsetDisabled`/`effectiveDisabled`) but ' +
          'does not implement `formDisabledCallback(disabled: boolean)` -- an ancestor `<fieldset disabled>` ' +
          'will never reach this component.',
      );
    }
  }

  // Rule (b): name/required/disabled must not be plain reflected properties on ANY form-associated
  // component (mixin consumer or direct implementer) if they're redeclared at all.
  for (const field of FORM_CRITICAL_FIELDS) {
    const result = checkFieldDeclaration(source, field);
    if (result.declared && !result.safe) {
      add(
        'b',
        `\`${field}\` is ${result.reason} -- assignment won't synchronously reflect the host attribute ` +
          `or recompute ElementInternals validity/value before a same-tick native form API ` +
          `(submit/requestSubmit/checkValidity/fieldset toggling) runs.`,
      );
    }
  }

  // Rule (c): a value-carrying form-associated control must expose `setCustomValidity`, directly or
  // by inheritance. Everything here reads the comment-stripped `code`, never `source` -- the JSDoc
  // of every hardened control names the method in prose.
  // A SUBMITTER is exempt. `lr-button` carries a `value` and calls `setFormValue()`, but only so the
  // form serialises `name=value` for the button that was pressed -- it is not a field the user
  // edits. The platform draws the same line: `HTMLButtonElement` is barred from constraint
  // validation (`willValidate` is false), so a custom error on one could never block a submit,
  // never set `customError`, and never match `:invalid`. Shipping the method anyway would be a
  // public API that provably does nothing, which is worse than its absence.
  const isSubmitter = /\btype\s*[:=][^;\n]*['"]submit['"]/.test(code) && /\bformAction\b|\bformNoValidate\b|\bformnovalidate\b/.test(code);
  if (carriesFormValue(code) && !isSubmitter && !declaresSetCustomValidity(code)) {
    // A local alias of a provider application, e.g. `const Base = FormAssociated(LyraElement);`.
    const localProviders = new Set(
      [...code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*\(/g)]
        .filter((match) => validityProviders.has(match[2]))
        .map((match) => match[1]),
    );
    const inherits = [...extendsBaseNames(code)].some(
      (base) => validityProviders.has(base) || localProviders.has(base),
    );
    if (!inherits) {
      add(
        'c',
        'carries a form value (a `value` property and/or `setFormValue()`) but neither declares ' +
          '`setCustomValidity(message: string)` nor inherits one -- a consumer has no way to surface an ' +
          'error no client-side constraint can express (a server-side rejection), so the control can ' +
          'never enter `customError`, fail `checkValidity()`, or match `:invalid`/`:state(user-invalid)` ' +
          'for it. Either extend `FormAssociated(...)` (`src/internal/form-associated.ts` implements it) ' +
          'or declare it and delegate to the same `AnchoredValidityController` the mixin uses.',
      );
    }
  }

  return { formAssociated: true, violations };
}

/**
 * Names that supply `setCustomValidity` to whatever extends them: the shared mixin, plus every
 * top-level export of any source file that declares the method. Attributing a declaration to the
 * exact enclosing export would need a real parser; publishing the file's exports is deliberately
 * over-generous, and only ever in the direction of a base that *does* have the method nearby.
 */
export function collectValidityProviders(files) {
  const providers = new Set(DEFAULT_VALIDITY_PROVIDERS);
  for (const file of files) {
    const code = stripComments(readFileSync(file, 'utf8'));
    if (!declaresSetCustomValidity(code)) continue;
    for (const name of exportedTopLevelNames(code)) providers.add(name);
  }
  return providers;
}

/** Scans the whole package and reports. Kept behind a main guard so the self-test can import the
 *  rules above without the scan running (and setting an exit code) as an import side effect. */
export function main() {
  const sourceFiles = walk(srcRoot)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.d.ts'))
    .sort();
  const classFiles = sourceFiles.filter(
    (file) => file.endsWith('.class.ts') && file.startsWith(componentsRoot),
  );
  const validityProviders = collectValidityProviders(sourceFiles);

  const violations = [];
  let scannedFormAssociated = 0;

  for (const file of classFiles) {
    const source = readFileSync(file, 'utf8');
    const relPath = relative(packageDir, file).replaceAll('\\', '/');
    const result = findFormAssociatedViolations(source, { file: relPath, validityProviders });
    if (!result.formAssociated) continue;
    scannedFormAssociated += 1;
    violations.push(...result.violations);
  }

  if (violations.length > 0) {
    console.error(`Form-associated hardening check found ${violations.length} violation(s):\n`);
    for (const violation of violations) {
      console.error(`  [rule ${violation.rule}] ${violation.component} (${violation.file})`);
      console.error(`    ${violation.message}\n`);
    }
    console.error(
      'See checkbox.class.ts/switch.class.ts/model-select.class.ts/tool-param-form.class.ts for the reference ' +
        'shape of rules (a) and (b), and `src/internal/form-associated.ts` for rule (c)`s `setCustomValidity`.',
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Form-associated hardening check passed: ${scannedFormAssociated} form-associated component(s) scanned, no violations.`,
    );
  }
}

if (process.argv[1] && process.argv[1].endsWith('check-form-associated.mjs')) main();

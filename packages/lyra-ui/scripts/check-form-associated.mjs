// Guards against a bug class that has already recurred once in this package: a form-associated
// custom element (`static formAssociated = true`, or the shared `FormAssociated` mixin from
// `internal/form-associated.ts`) that doesn't follow the hardened pattern established for this
// package (see checkbox.class.ts/switch.class.ts/model-select.class.ts/tool-param-form.class.ts
// for the reference shape):
//   (a) a component that builds its OWN fieldset-inheritance state (a private
//       `_fieldsetDisabled` field and/or a public `effectiveDisabled` getter, declared outside the
//       shared mixin) must also implement `formDisabledCallback()` to populate that state --
//       otherwise an ancestor `<fieldset disabled>` toggling never reaches this component at all.
//       (checkbox-group's `formDisabledCallback` once mutated children's own `disabled` directly
//       instead of populating this kind of state; radio once had `_fieldsetDisabled`/
//       `effectiveDisabled` with no `formDisabledCallback` at all -- this rule catches both shapes.)
//   (b) `name`/`required`/`disabled` specifically must not be plain `@property(...)`-reflected
//       fields on a form-associated component -- they need a `noAccessor: true` reactive-property
//       declaration paired with a hand-written `get`/`set` pair, so the host attribute and
//       `ElementInternals` validity/value are recomputed synchronously on assignment, not only on
//       Lit's async update cycle. (token-input once declared all three as plain
//       `@property({reflect: true})` fields.)
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
//   (d) a component that accepts `required` AND renders a `form-control-label` part must actually
//       render a required marker, so the same field reads the same way in every form. The marker
//       lives in `src/internal/form-control.styles.ts` (`formControlRequiredMarker`); a
//       hand-rolled `::after` glyph in the component's own stylesheet, or a literal glyph in its
//       template, satisfies the rule too but is what let this drift in the first place -- the same
//       three declarations were copy-pasted into fourteen stylesheets, spelled a second way as a
//       template `<span>` in three more, and simply missing from several controls that accept
//       `required` and render the part.
//   (e) a component that carries state a form reset has to undo -- a form VALUE, or an interaction
//       flag gating the `user-valid`/`user-invalid` custom states -- must implement
//       `formResetCallback()`. Without it, `form.reset()` restores every native control around it
//       while this one keeps the user's value, keeps reading as "the user has interacted", and can
//       therefore stay in `:state(user-invalid)` and keep blocking submission of a form the user
//       just reset. Inheriting it counts, exactly as in rule (c): `extends FormAssociated(...)`
//       (the shared mixin implements it), a local alias of that application, or a base class that
//       declares it. A form-associated element with no such state (`<lr-button>`/
//       `<lr-icon-button>`, form-associated only so a submit/reset `type` is discoverable) is out
//       of scope. The rule deliberately stops at `formResetCallback`: `formStateRestoreCallback`
//       restores a value the browser previously serialised, so it has no meaning for a control
//       that never calls `setFormValue()`.
//   (f) a component that drives `ElementInternals` by hand instead of extending the shared
//       `FormAssociated` mixin must be listed in `HAND_ROLLED_FORM_VALUE`. The list is the
//       migration backlog, it is shrink-only, and the runner fails on a stale entry -- so no NEW
//       hand-rolled copy of the dance can be added, and migrating one forces deleting its entry.
//       This rule could not exist before `src/internal/form-associated.ts` became generic over its
//       value type. Until then "my value isn't a string" was a true and unanswerable objection: the
//       mixin declared `private _value = ''` and asked `this._value === ''` for `valueMissing`, so a
//       control with an array/object/number/`Date`/`File` value had no option but to reimplement
//       setFormValue, validity, dirty/default tracking, reset and state restoration itself. Gating
//       on it then would have demanded a fix that did not exist. It does now
//       (`FormAssociated(Base, adapter)`), which is what turns a census into a rule.
//       The duplication is not cosmetic: dirty-default tracking was copy-pasted four different
//       ways, the user-interaction signal was re-invented eighteen times, and `formResetCallback`
//       was simply missing from `<lr-time-range>` -- each fixed one file at a time, none of which
//       could have happened in the shared implementation.
//       The rule is off unless the caller passes a `handRolledAllowlist`, because the allowlist is
//       a repo-wide census and is meaningless for an isolated source fixture; `main()` passes it.
// A component that extends the shared `FormAssociated` mixin directly and never redeclares
// name/required/disabled gets all of the above for free and is not flagged.
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

/** The `static properties` block, whichever way it is spelled. `override` is NOT optional cosmetics
 *  here: every component whose base class already declares reactive properties writes
 *  `static override properties`, and a plain `indexOf('static properties')` silently missed all of
 *  them -- which made rule (b) vacuous for exactly the components most likely to redeclare
 *  name/required/disabled. */
function findStaticPropertiesBlock(source) {
  const markerIndex = source.search(/static\s+(?:override\s+)?properties/);
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

/**
 * True when this source *declares* `formResetCallback` -- a method with a body, or a class field
 * holding a function. Same declaration-vs-call distinction as `declaresSetCustomValidity`: a
 * component calling `this.someController.formResetCallback()` has delegated, not implemented.
 */
export function declaresFormResetCallback(code) {
  const declarationRe =
    /(?:^|[^.\w$])(?:override\s+|public\s+|protected\s+|private\s+|async\s+|static\s+)*formResetCallback\s*\([^)]*\)\s*(?::[^{;=]*)?\{/;
  if (declarationRe.test(code)) return true;
  return /(?:^|[^.\w$])formResetCallback\s*(?::[^=;]*)?=\s*(?:async\s+)?(?:\(|function\b)/.test(code);
}

/**
 * True when this source keeps state a `form.reset()` has to undo beyond a submitted value: the
 * interaction flag that gates the `user-valid`/`user-invalid` custom states. Native controls clear
 * it on reset (that is why `:user-invalid` stops matching), so a control tracking its own copy must
 * too. Matches the two spellings this package uses (`hasInteracted`, `_hasInteracted`) plus the
 * `touched` flag some controls use for the same purpose.
 */
export function tracksInteractionState(code) {
  return /\b_?hasInteracted\b/.test(code) || /\btouched\b/.test(code);
}

/** True when this source renders a `form-control-label` CSS part -- the visible label chrome the
 *  required marker attaches to. A `part` attribute holds a space-separated token list, so the value
 *  is split rather than substring-matched: `part="label form-control-label"` counts, a
 *  `part="form-control-label-icon"` does not. Only literal `part="..."` attributes are seen; a
 *  component computing its part list at runtime is invisible here, as it is to every other
 *  part-scanning gate in this directory. */
export function rendersFormControlLabelPart(code) {
  for (const match of code.matchAll(/part\s*=\s*["']([^"']*)["']/g)) {
    if (match[1].trim().split(/\s+/).includes('form-control-label')) return true;
  }
  return false;
}

/**
 * True when a required marker is rendered at all, in any of the three shapes this package has
 * shipped:
 *   - the shared sheet (`formControlRequiredMarker`, or a direct read of the custom property it
 *     publishes) -- the only one of the three that is themeable, translatable and suppressible;
 *   - a hand-rolled `content: ' *'`-style glyph in the component's own stylesheet;
 *   - a literal glyph in the template, conditioned on `required`.
 *
 * @param {string} classCode the component class source (comments stripped).
 * @param {string[]} styleSources the sources of the stylesheets that class imports.
 */
export function hasRequiredMarker(classCode, styleSources = []) {
  const sources = [classCode, ...styleSources];
  if (sources.some((source) => /formControlRequiredMarker|--lr-form-control-required-content/.test(source))) {
    return true;
  }
  if (styleSources.some((source) => /content\s*:\s*(['"])[^'"]*\*\1/.test(source))) return true;
  // `${this.required ? html`<span aria-hidden="true">*</span>` : nothing}` and friends: a glyph
  // close enough after a `required` test to be that test's own output.
  return /\brequired\s*\?[^?]{0,200}?\*/.test(classCode);
}

/** Every identifier this source extends, whether directly (`extends Base`) or through a mixin
 *  application (`extends FormAssociated(Base)` yields `FormAssociated`). */
export function extendsBaseNames(code) {
  return new Set([...code.matchAll(/\bextends\s+([A-Za-z_$][\w$]*)/g)].map((match) => match[1]));
}

/**
 * True when this class extends one of `providers`, directly or through a locally aliased mixin
 * application (`const Base = FormAssociated(LyraElement); export class X extends Base`).
 */
export function inheritsFrom(code, providers) {
  const localProviders = new Set(
    [...code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*\(/g)]
      .filter((match) => providers.has(match[2]))
      .map((match) => match[1]),
  );
  return [...extendsBaseNames(code)].some((base) => providers.has(base) || localProviders.has(base));
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

/** Bases known to supply `formResetCallback` to whatever extends them -- same seeding and same
 *  growth from the tree as `DEFAULT_VALIDITY_PROVIDERS` (see `collectFormResetProviders`). */
export const DEFAULT_FORM_RESET_PROVIDERS = new Set(['FormAssociated']);

/**
 * Components that accept `required`, render a `form-control-label` part, and still ship no required
 * marker of any kind. Rule (d) exempts them so the gate can go live on the components that were
 * fixed with it; the list is shrink-only and the runner fails on a stale entry, so removing the
 * last one removes the exemption with it. Keyed by the class file's package-relative path.
 */
export const PENDING_REQUIRED_MARKER = new Set([]);

/**
 * The migration backlog for rule (f): every value-carrying form-associated control that still
 * drives `ElementInternals` by hand instead of extending `FormAssociated(Base, adapter)`.
 *
 * Shrink-only. Adding an entry means shipping a nineteenth copy of the same dance and is never the
 * right change; deleting one means a control was migrated, and the runner fails on an entry that no
 * longer qualifies so the list cannot quietly become permanent.
 *
 * Keyed by the class file's package-relative path.
 */
export const HAND_ROLLED_FORM_VALUE = new Set([
  'src/components/agent-tools/tool-param-form/tool-param-form.class.ts',
  'src/components/conversation/model-select/model-select.class.ts',
  'src/components/conversation/voice-picker/voice-picker.class.ts',
  'src/components/data/graph-query-builder/graph-query-builder.class.ts',
  'src/components/forms/checkbox-group/checkbox-group.class.ts',
  'src/components/forms/checkbox/checkbox.class.ts',
  'src/components/forms/combobox/combobox.class.ts',
  'src/components/forms/locale-picker/locale-picker.class.ts',
  'src/components/forms/radio/radio-group.class.ts',
  'src/components/forms/radio/radio.class.ts',
  'src/components/forms/rubric-form/rubric-form.class.ts',
  'src/components/forms/select/select.class.ts',
  'src/components/forms/slider/slider.class.ts',
  'src/components/forms/switch/switch.class.ts',
  'src/components/forms/time-range/time-range.class.ts',
  'src/components/forms/token-input/token-input.class.ts',
  'src/components/media/file-input/file-input.class.ts',
  'src/components/overlays/rating/rating.class.ts',
]);

/**
 * True when this class gets its form plumbing from the shared mixin -- `extends FormAssociated(...)`
 * or a locally aliased application of it (`const Base = FormAssociated(LyraElement)`). Anything else
 * that is form-associated is driving `ElementInternals` itself.
 */
export function usesSharedFormAssociatedMixin(code) {
  return inheritsFrom(code, new Set(['FormAssociated']));
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

/**
 * Applies every rule to one class file's source.
 *
 * @param {string} source raw file text (comments included -- rule (c) strips them itself).
 * @param {{ file?: string, component?: string, validityProviders?: Set<string>,
 *          handRolledAllowlist?: Set<string> | null }} [options]
 * @returns {{ formAssociated: boolean, handRolledFormValue: boolean, violations: Array<{ component: string, file: string, rule: string, message: string }> }}
 */
export function findFormAssociatedViolations(source, options = {}) {
  const {
    file = 'fixture.class.ts',
    component,
    validityProviders = DEFAULT_VALIDITY_PROVIDERS,
    formResetProviders = DEFAULT_FORM_RESET_PROVIDERS,
    styleSources = [],
    // `null` (the default) turns rule (f) off: the allowlist is a repo-wide census and says nothing
    // about an isolated source fixture. `main()` passes `HAND_ROLLED_FORM_VALUE`.
    handRolledAllowlist = null,
  } = options;

  const code = stripComments(source);
  const isDirectFormAssociated = /static\s+formAssociated\s*=\s*true\b/.test(code);
  const isMixinConsumer = /extends\s+FormAssociated\s*\(/.test(code);
  if (!isDirectFormAssociated && !isMixinConsumer) {
    return { formAssociated: false, handRolledFormValue: false, violations: [] };
  }

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
    if (!inheritsFrom(code, validityProviders)) {
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

  // Rule (d): a labelled control that accepts `required` must render a required marker. The part
  // attributes and the marker glyph both live inside `html` template literals, which survive
  // `stripComments` -- so this reads `code`, keeping a JSDoc block's own `*` line prefixes from
  // reading as a rendered glyph.
  if (
    checkFieldDeclaration(source, 'required').declared &&
    rendersFormControlLabelPart(code) &&
    !PENDING_REQUIRED_MARKER.has(file) &&
    !hasRequiredMarker(code, styleSources)
  ) {
    add(
      'd',
      'accepts `required` and renders a `form-control-label` part but renders no required marker, ' +
        'so the same field reads as optional here and as required in every sibling control. ' +
        'Interpolate `formControlRequiredMarker` (`src/internal/form-control.styles.ts`) into this ' +
        "component's stylesheet -- it publishes `--lr-form-control-required-content`/`-color`/" +
        '`-offset`, so the glyph stays translatable, retunable and suppressible.',
    );
  }

  // Rule (e): a control carrying state a reset has to undo must implement `formResetCallback()`.
  if (
    (carriesFormValue(code) || tracksInteractionState(code)) &&
    !isSubmitter &&
    !declaresFormResetCallback(code) &&
    !inheritsFrom(code, formResetProviders)
  ) {
    add(
      'e',
      'carries state a form reset has to undo (a form value and/or an interaction flag gating the ' +
        '`user-*` custom states) but neither declares `formResetCallback()` nor inherits one -- ' +
        '`form.reset()` restores every native control around it while this one keeps the value the ' +
        'user picked, keeps counting as interacted, and can therefore stay in ' +
        '`:state(user-invalid)` and keep blocking submission of a form the user just reset. Either ' +
        'extend `FormAssociated(...)` (`src/internal/form-associated.ts` implements it) or declare ' +
        'it: restore the declared defaults, clear the interaction flag, and republish the validity ' +
        'states.',
    );
  }

  // Rule (f): a value-carrying control that drives `ElementInternals` by hand is backlog, and the
  // backlog is frozen. A submitter carries a `value` only so the pressed button serialises, and is
  // exempt for the same reason it is exempt from rules (c) and (e).
  const handRolledFormValue =
    carriesFormValue(code) && !isSubmitter && !usesSharedFormAssociatedMixin(code);
  if (handRolledFormValue && handRolledAllowlist && !handRolledAllowlist.has(file)) {
    add(
      'f',
      'carries a form value but drives `ElementInternals` by hand instead of extending the shared ' +
        '`FormAssociated` mixin, and is not in the (shrink-only) `HAND_ROLLED_FORM_VALUE` backlog. ' +
        'The mixin is generic over its value type -- `FormAssociated(Base, adapter)` takes a ' +
        '`FormValueAdapter` supplying the empty value, the `setFormValue()` serialization, the ' +
        '`valueMissing` emptiness test and the `value`-attribute round-trip, and then owns the ' +
        'synchronous accessors, dirty/default tracking, the interaction signal, barred-validation ' +
        'short-circuiting, validity layering, reset and state restoration. Re-deriving those here ' +
        'is how dirty-default tracking ended up copy-pasted four ways and `formResetCallback` ' +
        'ended up missing from one control. Extend the mixin; do not add an entry to the backlog.',
    );
  }

  return { formAssociated: true, handRolledFormValue, violations };
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

/** The same over-generous attribution as `collectValidityProviders`, for `formResetCallback`. */
export function collectFormResetProviders(files) {
  const providers = new Set(DEFAULT_FORM_RESET_PROVIDERS);
  for (const file of files) {
    const code = stripComments(readFileSync(file, 'utf8'));
    if (!declaresFormResetCallback(code)) continue;
    for (const name of exportedTopLevelNames(code)) providers.add(name);
  }
  return providers;
}

/** The sources of the `*.styles.ts` sheets a class file imports, so rule (d) can see where a
 *  component's rendered CSS actually comes from. Only sibling relative imports are followed --
 *  a shared sheet is found through the identifier it is imported under, not by reading it. */
function importedStyleSources(classFile) {
  const source = readFileSync(classFile, 'utf8');
  const directory = dirname(classFile);
  const sources = [];
  for (const match of source.matchAll(/from\s+['"](\.\/[^'"]+)\.styles\.js['"]/g)) {
    const stylePath = join(directory, `${match[1]}.styles.ts`);
    try {
      sources.push(readFileSync(stylePath, 'utf8'));
    } catch {
      // A stylesheet that does not resolve is the module graph's problem, not this gate's.
    }
  }
  return sources;
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
  const formResetProviders = collectFormResetProviders(sourceFiles);

  const violations = [];
  let scannedFormAssociated = 0;
  let scannedHandRolled = 0;
  const stalePending = new Set(PENDING_REQUIRED_MARKER);
  const staleHandRolled = new Set(HAND_ROLLED_FORM_VALUE);

  for (const file of classFiles) {
    const source = readFileSync(file, 'utf8');
    const relPath = relative(packageDir, file).replaceAll('\\', '/');
    const styleSources = importedStyleSources(file);
    const result = findFormAssociatedViolations(source, {
      file: relPath,
      validityProviders,
      formResetProviders,
      styleSources,
      handRolledAllowlist: HAND_ROLLED_FORM_VALUE,
    });
    if (!result.formAssociated) continue;
    scannedFormAssociated += 1;
    violations.push(...result.violations);
    // An allowlisted file that no longer hand-rolls the dance has been migrated: its exemption now
    // exempts nothing, and the same reasoning as `stalePending` applies.
    if (result.handRolledFormValue) {
      scannedHandRolled += 1;
      staleHandRolled.delete(relPath);
    }
    // A pending entry that no longer violates rule (d) has been fixed: the exemption is now
    // hiding nothing, and leaving it behind is how an allowlist quietly becomes permanent.
    if (
      stalePending.has(relPath) &&
      findFormAssociatedViolations(source, {
        file: `${relPath}#pending-recheck`,
        validityProviders,
        formResetProviders,
        styleSources,
      }).violations.some((violation) => violation.rule === 'd')
    ) {
      stalePending.delete(relPath);
    }
  }

  for (const relPath of stalePending) {
    violations.push({
      component: relPath,
      file: 'scripts/check-form-associated.mjs',
      rule: 'd',
      message:
        `is listed in PENDING_REQUIRED_MARKER but now renders a required marker (or no longer ` +
        `qualifies for the rule) -- delete the entry. The list is shrink-only; an exemption that ` +
        `exempts nothing is how it would become permanent.`,
    });
  }

  for (const relPath of staleHandRolled) {
    violations.push({
      component: relPath,
      file: 'scripts/check-form-associated.mjs',
      rule: 'f',
      message:
        `is listed in HAND_ROLLED_FORM_VALUE but no longer drives \`ElementInternals\` by hand ` +
        `(migrated to the shared mixin, renamed, or removed) -- delete the entry. The list is ` +
        `shrink-only; an exemption that exempts nothing is how it would become permanent.`,
    });
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
      `Form-associated hardening check passed: ${scannedFormAssociated} form-associated component(s) scanned, ` +
        `${scannedHandRolled} still hand-rolling ElementInternals (rule (f) backlog), no violations.`,
    );
  }
}

if (process.argv[1] && process.argv[1].endsWith('check-form-associated.mjs')) main();


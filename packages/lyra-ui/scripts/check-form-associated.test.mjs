#!/usr/bin/env node

// Self-test for check-form-associated.mjs. A source-scanning gate can quietly stop matching
// anything and then pass vacuously, which is worse than failing outright -- rule (c) shipped
// exactly that way once: 17 form-associated controls had no `setCustomValidity` at all while the
// gate reported "no violations", because the rule did not exist and every hardened control mentions
// `setCustomValidity()` in its `@cssstate valid` JSDoc prose anyway. So each rule is exercised here
// against both a shape it must flag and a shape it must leave alone.
// Run: node scripts/check-form-associated.test.mjs

import assert from 'node:assert/strict';
import {
  carriesFormValue,
  declaresFormResetCallback,
  declaresSetCustomValidity,
  findFormAssociatedViolations,
  HAND_ROLLED_FORM_VALUE,
  hasRequiredMarker,
  rendersFormControlLabelPart,
  stripComments,
  tracksInteractionState,
  usesSharedFormAssociatedMixin,
} from './check-form-associated.mjs';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

/** Rules reported for `source`, sorted, so a case can assert the exact rule set it expects. */
const rulesFor = (source, options) =>
  findFormAssociatedViolations(source, options).violations.map((violation) => violation.rule).sort();

// --- comment stripping ------------------------------------------------------------------------

check('strips line and block comments but keeps string contents', () => {
  const code = stripComments(
    [
      '/** Doc prose naming `setCustomValidity()`. */',
      "const href = 'https://example.com/#not-a-comment';",
      'const shown = true; // trailing prose naming setCustomValidity()',
      'const kept = shown;',
    ].join('\n'),
  );
  assert.equal(/setCustomValidity/.test(code), false, 'no comment text survives');
  assert.equal(code.includes('https://example.com/#not-a-comment'), true, 'string bodies survive');
  assert.equal(code.includes('const kept = shown;'), true, 'code after a comment survives');
});

check('a regex literal containing slashes does not swallow the rest of its line', () => {
  const code = stripComments(String.raw`const re = /\/\//; const kept = 1;`);
  assert.equal(code.includes('const kept = 1;'), true);
});

// --- carriesFormValue / declaresSetCustomValidity ----------------------------------------------

check('a decorated `value` property, an accessor pair, and a setFormValue call all carry a value', () => {
  assert.equal(carriesFormValue(`@property({ reflect: true }) value = '';`), true);
  assert.equal(carriesFormValue(`get value(): string { return this._value; }`), true);
  assert.equal(carriesFormValue(`this.internals.setFormValue(next);`), true);
  assert.equal(carriesFormValue(`static properties = { value: { noAccessor: true } };`), true);
});

check('reading someone else`s value does not make a component value-carrying', () => {
  assert.equal(carriesFormValue(`const label = this.selectedOption?.value ?? '';`), false);
  assert.equal(carriesFormValue(`this.emit('lr-change', { detail: { value: next } });`), false);
});

check('only a declaration counts as declaring setCustomValidity, never a call', () => {
  assert.equal(declaresSetCustomValidity(`setCustomValidity(message: string): void { this.x(); }`), true);
  assert.equal(declaresSetCustomValidity(`override setCustomValidity(message: string): void {}`), true);
  assert.equal(declaresSetCustomValidity(`setCustomValidity = (message: string): void => {};`), true);
  assert.equal(declaresSetCustomValidity(`this.validityController.setCustomValidity(message);`), false);
  assert.equal(declaresSetCustomValidity(`this.input?.setCustomValidity('');`), false);
});

// --- rule (g): production-retained form-label installation -----------------------------------

check('a direct form-associated control must explicitly install form-label support', () => {
  const source = `
import './form-control-labels.js';
export class LyraFixture extends LyraElement {
  static formAssociated = true;
}
`;
  assert.deepEqual(rulesFor(source, { requireLabelSupport: true }), ['g']);
});

check('a direct form-associated control satisfies label support with a value import and call', () => {
  const source = `
import { installFormControlLabelSupport } from './form-control-labels.js';
installFormControlLabelSupport();
export class LyraFixture extends LyraElement {
  static formAssociated = true;
}
`;
  assert.deepEqual(rulesFor(source, { requireLabelSupport: true }), []);
});

check('a direct control with a local label factory may install only internals capture', () => {
  const source = `
import { FORM_CONTROL_LABEL_FACTORY } from './lyra-element.js';
import { installFormControlInternalsCapture } from './form-control-labels.js';
installFormControlInternalsCapture();
export class LyraFixture extends LyraElement {
  static formAssociated = true;
  static [FORM_CONTROL_LABEL_FACTORY] = createFixtureLabelController;
}
`;
  assert.deepEqual(rulesFor(source, { requireLabelSupport: true }), []);
});

check('capture-only installation without a local label factory remains incomplete', () => {
  const source = `
import { installFormControlInternalsCapture } from './form-control-labels.js';
installFormControlInternalsCapture();
export class LyraFixture extends LyraElement {
  static formAssociated = true;
}
`;
  assert.deepEqual(rulesFor(source, { requireLabelSupport: true }), ['g']);
});

check('a shared-mixin control inherits the mixin module label-support installation', () => {
  const source = `
export class LyraFixture extends FormAssociated(LyraElement) {}
`;
  assert.deepEqual(rulesFor(source, { requireLabelSupport: true }), []);
});

// --- rule (c): a value-carrying form-associated control must expose setCustomValidity -----------

const HARDENED_JSDOC = [
  '/**',
  ' * @cssstate valid - Matches while the control satisfies its constraints, including any',
  ' * `setCustomValidity()` error.',
  ' */',
].join('\n');

// Carries a value AND satisfies rule (e), so the rule-(c) cases below assert exactly one rule.
const valueCarryingBody = `
  static formAssociated = true;

  internals = attachInternalsSafely(this);

  @property({ reflect: true }) value = '';

  private commit(next: string): void {
    this.internals.setFormValue(next);
  }

  formResetCallback(): void {
    this.value = this.getAttribute('value') ?? '';
  }
`;

check('a value-carrying form-associated control with no setCustomValidity is flagged', () => {
  const source = `${HARDENED_JSDOC}
export class LyraFixture extends LyraElement {
${valueCarryingBody}}
`;
  const result = findFormAssociatedViolations(source, { file: 'src/components/x/fixture.class.ts' });
  assert.equal(result.formAssociated, true);
  assert.deepEqual(result.violations.map((violation) => violation.rule), ['c']);
  assert.match(result.violations[0].message, /setCustomValidity/);
});

check('documenting setCustomValidity() in JSDoc prose does not satisfy the rule', () => {
  // The regression that let the rule pass vacuously: every hardened control's `@cssstate valid`
  // block names the method, so a raw-source scan answers the exact opposite of the truth.
  const source = `${HARDENED_JSDOC}
export class LyraFixture extends LyraElement {
${valueCarryingBody}
  // A later note about setCustomValidity(message) that was never implemented.
}
`;
  assert.deepEqual(rulesFor(source), ['c']);
});

check('delegating to a validity controller without declaring the method is still a gap', () => {
  const source = `
export class LyraFixture extends LyraElement {
${valueCarryingBody}
  private reject(message: string): void {
    this.validityController.setCustomValidity(message);
  }
}
`;
  assert.deepEqual(rulesFor(source), ['c']);
});

check('declaring setCustomValidity satisfies the rule', () => {
  const source = `${HARDENED_JSDOC}
export class LyraFixture extends LyraElement {
${valueCarryingBody}
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.syncValidityStates();
  }
}
`;
  assert.deepEqual(rulesFor(source), []);
});

check('an arrow-function class field satisfies the rule too', () => {
  const source = `
export class LyraFixture extends LyraElement {
${valueCarryingBody}
  setCustomValidity = (message: string): void => {
    this.internals.setValidity(message ? { customError: true } : {}, message);
  };
}
`;
  assert.deepEqual(rulesFor(source), []);
});

check('extending the FormAssociated mixin inherits setCustomValidity', () => {
  const source = `
export class LyraFixture extends FormAssociated(LyraFixtureBase) {
  @property({ reflect: true }) override value = '';
}
`;
  const result = findFormAssociatedViolations(source);
  assert.equal(result.formAssociated, true, 'a mixin consumer is still scanned');
  assert.deepEqual(result.violations, []);
});

check('a locally aliased mixin application inherits it as well', () => {
  const source = `
const LyraFixtureBase = FormAssociated(LyraElement);

export class LyraFixture extends LyraFixtureBase {
  @property() value = '';
  private commit(next: string): void { this.internals.setFormValue(next); }
}
`;
  assert.deepEqual(rulesFor(source), []);
});

check('extending a component that declares the method inherits it', () => {
  const source = `
export class LyraFixture extends LyraCheckbox {
  static formAssociated = true;
  @property() value = '';
}
`;
  const providers = new Set(['FormAssociated', 'LyraCheckbox']);
  assert.deepEqual(
    rulesFor(source, { validityProviders: providers, formResetProviders: providers }),
    [],
  );
  assert.deepEqual(
    rulesFor(source).filter((rule) => rule === 'c'),
    ['c'],
    'an unknown base cannot vouch for the method',
  );
});

check('a form-associated control that carries no value is exempt', () => {
  // `<lr-icon-button>`'s shape: form-associated purely for submit/reset discoverability.
  const source = `
export class LyraIconButtonFixture extends LyraElement {
  static formAssociated = true;

  private submit(): void {
    this.closest('form')?.requestSubmit();
  }
}
`;
  const result = findFormAssociatedViolations(source);
  assert.equal(result.formAssociated, true);
  assert.deepEqual(result.violations, []);
});

check('a component that is not form-associated at all is never in scope', () => {
  const source = `
export class LyraPlain extends LyraElement {
  @property() value = '';
  private commit(next: string): void { this.internals.setFormValue(next); }
}
`;
  const result = findFormAssociatedViolations(source);
  assert.equal(result.formAssociated, false);
  assert.deepEqual(result.violations, []);
});

// --- rule (a): own fieldset state requires formDisabledCallback --------------------------------

check('own fieldset state without formDisabledCallback is flagged', () => {
  const source = `
export class LyraFixture extends LyraElement {
  static formAssociated = true;
  private _fieldsetDisabled = false;
  get effectiveDisabled(): boolean { return this.disabled || this._fieldsetDisabled; }
  setCustomValidity(message: string): void { this.internals.setValidity({}, message); }
}
`;
  assert.deepEqual(rulesFor(source), ['a']);
});

check('own fieldset state with formDisabledCallback passes', () => {
  const source = `
export class LyraFixture extends LyraElement {
  static formAssociated = true;
  private _fieldsetDisabled = false;
  get effectiveDisabled(): boolean { return this.disabled || this._fieldsetDisabled; }
  formDisabledCallback(fieldsetDisabled: boolean): void {
    this._fieldsetDisabled = fieldsetDisabled;
    this.requestUpdate();
  }
  setCustomValidity(message: string): void { this.internals.setValidity({}, message); }
}
`;
  assert.deepEqual(rulesFor(source), []);
});

// --- rule (b): name/required/disabled need synchronous accessors -------------------------------

check('a plain reflected `name` on a form-associated control is flagged', () => {
  const source = `
export class LyraFixture extends FormAssociated(LyraFixtureBase) {
  @property({ reflect: true }) override name = '';
}
`;
  assert.deepEqual(rulesFor(source), ['b']);
});

check('a noAccessor declaration paired with a hand-written accessor passes', () => {
  const source = `
export class LyraFixture extends FormAssociated(LyraFixtureBase) {
  static properties = { name: { reflect: true, noAccessor: true } };
  private _name = '';
  get name(): string { return this._name; }
  set name(next: string) {
    this._name = next ?? '';
    this.toggleAttribute('name', Boolean(this._name));
  }
}
`;
  assert.deepEqual(rulesFor(source), []);
});

// --- rule (d): required + a form-control-label part means a rendered required marker ------------

check('a part token list is split, never substring-matched', () => {
  assert.equal(rendersFormControlLabelPart(`<label part="form-control-label">`), true);
  assert.equal(rendersFormControlLabelPart(`<div part="label form-control-label">`), true);
  assert.equal(rendersFormControlLabelPart(`<div part="form-control-label-icon">`), false);
  assert.equal(rendersFormControlLabelPart(`<div part="form-control-input">`), false);
});

check('every shipped marker shape counts as a marker, and prose does not', () => {
  assert.equal(
    hasRequiredMarker('', [`:host([required]) [part~='form-control-label']::after { content: ' *'; }`]),
    true,
    'a hand-rolled stylesheet glyph',
  );
  assert.equal(hasRequiredMarker('', ['${formControlRequiredMarker}']), true, 'the shared sheet');
  assert.equal(
    hasRequiredMarker('${this.required ? html`<span aria-hidden="true">*</span>` : nothing}'),
    true,
    'a literal template glyph',
  );
  assert.equal(hasRequiredMarker('', [`[part='form-control-label'] { display: block; }`]), false);
});

const REQUIRED_LABEL_BODY = `
  static formAssociated = true;
  static properties = { required: { type: Boolean, reflect: true, noAccessor: true } };
  private _required = false;
  get required(): boolean { return this._required; }
  set required(next: boolean) { this._required = Boolean(next); }
  formResetCallback(): void { this._required = this.hasAttribute('required'); }
  override render() {
    return html\`<label part="form-control-label">\${this.label}</label>\`;
  }
`;

check('a required-capable labelled control with no marker anywhere is flagged', () => {
  const source = `export class LyraFixture extends LyraElement {${REQUIRED_LABEL_BODY}}`;
  const result = findFormAssociatedViolations(source, {
    file: 'src/components/x/fixture.class.ts',
    styleSources: [`[part='form-control-label'] { font-weight: 600; }`],
  });
  assert.deepEqual(result.violations.map((violation) => violation.rule), ['d']);
  assert.match(result.violations[0].message, /formControlRequiredMarker/);
});

check('adopting the shared marker sheet satisfies the rule', () => {
  const source = `export class LyraFixture extends LyraElement {${REQUIRED_LABEL_BODY}}`;
  assert.deepEqual(
    rulesFor(source, {
      styleSources: [`export const styles = css\`\${formControlRequiredMarker}\`;`],
    }),
    [],
  );
});

check('a control with no `required` at all, or no label part, is out of scope', () => {
  const noRequired = `
export class LyraFixture extends LyraElement {
  static formAssociated = true;
  override render() { return html\`<label part="form-control-label">x</label>\`; }
}
`;
  assert.deepEqual(rulesFor(noRequired), []);

  const noLabelPart = `export class LyraFixture extends LyraElement {${REQUIRED_LABEL_BODY.replace(
    'part="form-control-label"',
    'part="fieldset"',
  )}}`;
  assert.deepEqual(rulesFor(noLabelPart), []);
});

check('`static override properties` is read like `static properties`', () => {
  // The spelling every component with a property-declaring base class uses. A plain
  // `indexOf('static properties')` missed all of them, which made rules (b) and (d) vacuous there.
  const source = `
export class LyraFixture extends LyraFixtureBase {
  static formAssociated = true;
  static override properties = { required: { type: Boolean, reflect: true } };
  formResetCallback(): void {}
  override render() { return html\`<label part="form-control-label">x</label>\`; }
}
`;
  assert.deepEqual(rulesFor(source), ['b', 'd']);
});

// --- rule (e): state a reset has to undo needs formResetCallback -------------------------------

check('only a declaration counts as declaring formResetCallback, never a call', () => {
  assert.equal(declaresFormResetCallback(`formResetCallback(): void { this.reset(); }`), true);
  assert.equal(declaresFormResetCallback(`override formResetCallback(): void {}`), true);
  assert.equal(declaresFormResetCallback(`formResetCallback = (): void => {};`), true);
  assert.equal(declaresFormResetCallback(`this.controller.formResetCallback();`), false);
});

check('an interaction flag is state a reset has to undo, on its own', () => {
  assert.equal(tracksInteractionState(`private hasInteracted = false;`), true);
  assert.equal(tracksInteractionState(`private _hasInteracted = false;`), true);
  assert.equal(tracksInteractionState(`private touched = false;`), true);
  assert.equal(tracksInteractionState(`private dragging = false;`), false);
});

check('a value-carrying control with no formResetCallback is flagged', () => {
  const source = `
export class LyraFixture extends LyraElement {
  static formAssociated = true;
  @property({ reflect: true }) value = '';
  setCustomValidity(message: string): void { this.internals.setValidity({}, message); }
  private commit(next: string): void { this.internals.setFormValue(next); }
}
`;
  assert.deepEqual(rulesFor(source), ['e']);
});

check('a control with no submitted value is still flagged when it tracks interaction', () => {
  // `<lr-time-range>`'s shape: form-associated for the fieldset cascade and setCustomValidity only,
  // never calling setFormValue -- but its `hasInteracted` flag gates `:state(user-invalid)`, which
  // must stop matching once the form is reset.
  const source = `
export class LyraFixture extends LyraElement {
  static formAssociated = true;
  private hasInteracted = false;
  setCustomValidity(message: string): void { this.internals.setValidity({}, message); }
}
`;
  assert.deepEqual(rulesFor(source), ['e']);

  const withCallback = source.replace(
    'private hasInteracted = false;',
    'private hasInteracted = false;\n  formResetCallback(): void { this.hasInteracted = false; }',
  );
  assert.deepEqual(rulesFor(withCallback), []);
});

check('a form-associated control with no value and no interaction flag is exempt', () => {
  const source = `
export class LyraIconButtonFixture extends LyraElement {
  static formAssociated = true;
  private submit(): void { this.closest('form')?.requestSubmit(); }
}
`;
  assert.deepEqual(rulesFor(source), []);
});

check('extending a base that declares formResetCallback inherits it', () => {
  const source = `
export class LyraFixture extends LyraCheckbox {
  static formAssociated = true;
  @property() value = '';
  setCustomValidity(message: string): void { this.internals.setValidity({}, message); }
}
`;
  const providers = new Set(['FormAssociated', 'LyraCheckbox']);
  assert.deepEqual(rulesFor(source, { formResetProviders: providers }), []);
  assert.deepEqual(rulesFor(source), ['e'], 'an unknown base cannot vouch for the callback');
});

// --- rule (f): the hand-rolled ElementInternals backlog is frozen shrink-only -------------------

// Fully hardened apart from being hand-rolled, so the rule-(f) cases below assert exactly one rule.
const HAND_ROLLED_BODY = `
  static formAssociated = true;

  internals = attachInternalsSafely(this);

  static properties = { value: { attribute: false, noAccessor: true } };
  private _value: string[] = [];
  get value(): string[] { return this._value; }
  set value(next: string[]) {
    this._value = next ?? [];
    this.internals.setFormValue(this._value.join(','));
  }

  setCustomValidity(message: string): void { this.internals.setValidity({}, message); }
  formResetCallback(): void { this.value = []; }
`;

check('the mixin is recognised through a direct application and a local alias, and nothing else', () => {
  assert.equal(usesSharedFormAssociatedMixin('class X extends FormAssociated(LyraElement) {}'), true);
  assert.equal(
    usesSharedFormAssociatedMixin('const Base = FormAssociated(LyraElement);\nclass X extends Base {}'),
    true,
  );
  assert.equal(usesSharedFormAssociatedMixin('class X extends LyraElement {}'), false);
  // Merely importing or naming the mixin is not extending it.
  assert.equal(usesSharedFormAssociatedMixin("import { FormAssociated } from './form-associated.js';"), false);
});

check('a hand-rolled value-carrying control that is not on the backlog is flagged', () => {
  const source = `export class LyraFixture extends LyraElement {${HAND_ROLLED_BODY}}`;
  const result = findFormAssociatedViolations(source, {
    file: 'src/components/x/fixture.class.ts',
    handRolledAllowlist: new Set(['src/components/other/other.class.ts']),
  });
  assert.equal(result.handRolledFormValue, true);
  assert.deepEqual(result.violations.map((violation) => violation.rule), ['f']);
  assert.match(result.violations[0].message, /FormValueAdapter/);
});

check('the same control passes while it is still on the backlog', () => {
  const source = `export class LyraFixture extends LyraElement {${HAND_ROLLED_BODY}}`;
  assert.deepEqual(
    rulesFor(source, {
      file: 'src/components/x/fixture.class.ts',
      handRolledAllowlist: new Set(['src/components/x/fixture.class.ts']),
    }),
    [],
  );
});

check('extending the shared mixin is never hand-rolled, backlog or no backlog', () => {
  const source = `
export class LyraFixture extends FormAssociated(LyraElement, tagListAdapter) {
  @property({ attribute: false }) override value: string[] = [];
}
`;
  const result = findFormAssociatedViolations(source, {
    file: 'src/components/x/fixture.class.ts',
    handRolledAllowlist: new Set(),
  });
  assert.equal(result.handRolledFormValue, false, 'a migrated control drops off the backlog');
  assert.deepEqual(result.violations, []);
});

check('rule (f) stays off unless a caller supplies the census, so a bare fixture is never judged by it', () => {
  // The allowlist is repo-wide; an isolated source fixture is not in it and must not be flagged for
  // that. Every other case in this file relies on this, which is why it is asserted explicitly.
  const source = `export class LyraFixture extends LyraElement {${HAND_ROLLED_BODY}}`;
  assert.deepEqual(rulesFor(source, { file: 'src/components/x/fixture.class.ts' }), []);
});

check('a submitter carries a value only so the pressed button serialises, and is exempt', () => {
  const source = `
export class LyraButtonFixture extends LyraElement {
  static formAssociated = true;
  internals = attachInternalsSafely(this);
  @property({ reflect: true }) type: 'button' | 'submit' | 'reset' = 'submit';
  @property({ attribute: 'formaction' }) formAction = '';
  @property({ reflect: true }) value = '';
  private commit(): void { this.internals.setFormValue(this.value); }
}
`;
  const result = findFormAssociatedViolations(source, {
    file: 'src/components/x/fixture.class.ts',
    handRolledAllowlist: new Set(),
  });
  assert.equal(result.handRolledFormValue, false);
  assert.deepEqual(result.violations, []);
});

check('the backlog is a real, non-empty census of shipped paths', () => {
  // A gate whose allowlist silently emptied would pass vacuously in the other direction: every
  // hand-rolled control would be flagged, someone would "fix" it by turning the rule off. Assert
  // the shape instead -- entries are package-relative class-file paths under src/components/.
  assert.ok(HAND_ROLLED_FORM_VALUE.size > 0, 'the backlog is not empty');
  for (const entry of HAND_ROLLED_FORM_VALUE) {
    assert.match(entry, /^src\/components\/[\w-]+\/[\w-]+\/[\w-]+\.class\.ts$/, entry);
  }
});

console.log(`Form-associated checker self-tests passed (${passed} checks).`);

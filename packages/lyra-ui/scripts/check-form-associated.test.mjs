#!/usr/bin/env node

// Self-test for check-form-associated.mjs. A source-scanning gate can quietly stop matching
// anything and then pass vacuously, which is worse than failing outright -- rule (c) shipped
// exactly that way once: 17 form-associated controls had no `setCustomValidity` at all while the
// gate reported "no violations", because the rule did not exist and every hardened control mentions
// `setCustomValidity()` in its `@cssstate valid` JSDoc prose anyway. So each rule is exercised here
// against both a shape it must flag and a shape it must leave alone.
//
// Run: node scripts/check-form-associated.test.mjs

import assert from 'node:assert/strict';
import {
  carriesFormValue,
  declaresSetCustomValidity,
  findFormAssociatedViolations,
  stripComments,
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

// --- rule (c): a value-carrying form-associated control must expose setCustomValidity -----------

const HARDENED_JSDOC = [
  '/**',
  ' * @cssstate valid - Matches while the control satisfies its constraints, including any',
  ' * `setCustomValidity()` error.',
  ' */',
].join('\n');

const valueCarryingBody = `
  static formAssociated = true;

  internals = attachInternalsSafely(this);

  @property({ reflect: true }) value = '';

  private commit(next: string): void {
    this.internals.setFormValue(next);
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
  assert.deepEqual(
    rulesFor(source, { validityProviders: new Set(['FormAssociated', 'LyraCheckbox']) }),
    [],
  );
  assert.deepEqual(rulesFor(source), ['c'], 'an unknown base cannot vouch for the method');
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

console.log(`Form-associated checker self-tests passed (${passed} checks).`);

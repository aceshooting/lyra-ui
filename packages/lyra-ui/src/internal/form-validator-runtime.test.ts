import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LitElement } from 'lit';
import { FormControlController } from './form-control-controller.js';
import {
  observeValidatorAttributes,
  runFormValidators,
  StructuredFormValidityController,
} from './form-validator-runtime.js';

describe('runFormValidators', () => {
  const host = {};

  it('runs validators in order and returns the first failure', () => {
    const calls: string[] = [];
    const outcome = runFormValidators([
      () => { calls.push('a'); return undefined; },
      () => { calls.push('b'); return 'second'; },
      () => { calls.push('c'); return 'third'; },
    ], 'v', host, 'generic');
    expect(calls).to.deep.equal(['a', 'b']);
    expect(outcome).to.deep.equal({ flags: { customError: true }, message: 'second' });
  });

  it('passes the value and host to function and validate() validators', () => {
    const seen: unknown[] = [];
    runFormValidators([(v: unknown, h: unknown) => { seen.push(v, h); }, { validate: (v: unknown, h: unknown) => { seen.push(v, h); } }], 7, host, 'g');
    expect(seen).to.deep.equal([7, host, 7, host]);
  });

  it('fails closed with the generic message for false, a throw and a hostile list', () => {
    expect(runFormValidators([() => false], '', host, 'generic')).to.deep.equal({ flags: { customError: true }, message: 'generic' });
    expect(runFormValidators([() => { throw new Error('boom'); }], '', host, () => 'lazy')).to.deep.equal({ flags: { customError: true }, message: 'lazy' });
    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    expect(runFormValidators(revoked.proxy, '', host, 'generic').flags).to.deep.equal({ customError: true });
  });

  it('maps a flags object to its known flags only', () => {
    const outcome = runFormValidators([() => ({ valueMissing: true, bogus: true, tooShort: false })], '', host, 'generic');
    expect(outcome).to.deep.equal({ flags: { valueMissing: true }, message: 'generic' });
    expect(runFormValidators([() => ({ bogus: true })], '', host, 'generic')).to.deep.equal({});
  });

  it('reads object validators: invalidKeys, then result message, validator message string or function', () => {
    const bad = (extra: object) => ({ checkValidity: () => ({ isValid: false, invalidKeys: ['rangeOverflow', 'nope'], message: '' }), ...extra });
    expect(runFormValidators([bad({ message: 'from-string' })], '', host, 'g')).to.deep.equal({ flags: { rangeOverflow: true }, message: 'from-string' });
    expect(runFormValidators([bad({ message: () => 'from-fn' })], '', host, 'g').message).to.equal('from-fn');
    expect(runFormValidators([bad({})], '', host, 'g').message).to.equal('g');
    expect(runFormValidators([{ checkValidity: () => ({ isValid: false, invalidKeys: [], message: 'm' }) }], '', host, 'g'))
      .to.deep.equal({ flags: { customError: true }, message: 'm' });
    expect(runFormValidators([{ checkValidity: () => ({ isValid: true }) }], '', host, 'g')).to.deep.equal({});
  });
});

describe('observeValidatorAttributes', () => {
  const validators = [{ observedAttributes: ['data-limit'], checkValidity: () => ({ isValid: true }) }];

  it('revalidates when a listed attribute changes and stops after the disposer', async () => {
    const el = await fixture<HTMLElement>(html`<div></div>`);
    let calls = 0;
    const dispose = observeValidatorAttributes(el, validators, () => { calls++; });
    el.setAttribute('data-limit', '1');
    await waitUntil(() => calls === 1, 'attribute change observed');
    el.setAttribute('data-other', '1');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).to.equal(1);
    dispose();
    el.setAttribute('data-limit', '2');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).to.equal(1);
  });

  it('observes nothing for no listed attributes, a hostile validator, or a disconnected host', async () => {
    const el = await fixture<HTMLElement>(html`<div></div>`);
    let calls = 0;
    const hostile = Proxy.revocable({}, {});
    hostile.revoke();
    observeValidatorAttributes(el, [() => undefined, hostile.proxy], () => { calls++; })();
    const detached = document.createElement('div');
    observeValidatorAttributes(detached, validators, () => { calls++; })();
    detached.setAttribute('data-limit', '1');
    el.setAttribute('data-limit', '1');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).to.equal(0);
  });

  it('keeps observing siblings of a hostile validator', async () => {
    const el = await fixture<HTMLElement>(html`<div></div>`);
    const hostile = Proxy.revocable({ checkValidity() { return undefined; } }, {});
    hostile.revoke();
    let calls = 0;
    const dispose = observeValidatorAttributes(el, [hostile.proxy, ...validators], () => { calls++; });
    el.setAttribute('data-limit', '1');
    await waitUntil(() => calls === 1, 'sibling validator observed');
    dispose();
  });
});

class StructuredHost extends LitElement {
  static formAssociated = true;
  errors: Record<string, string> = {};
  base = '';
  revealed = 0;
  validityController = new FormControlController(this as never);
  structured = new StructuredFormValidityController(this as never, {
    baseErrorMessage: () => this.base,
    fieldErrors: () => this.errors,
    validityController: () => this.validityController,
    reveal: () => { this.revealed++; },
    emit: (snapshot) => { this.snapshots.push(snapshot); },
  });
  snapshots: unknown[] = [];
  get willValidate(): boolean { return this.validityController.formInternals.willValidate; }
  get validationMessage(): string { return this.validityController.formInternals.validationMessage; }
  get validity(): ValidityState { return this.validityController.formInternals.validity; }
  setCustomValidity(message: string): void { this.validityController.setCustomValidity(message); }
}
customElements.define('h3-structured-host', StructuredHost);

describe('StructuredFormValidityController', () => {
  it('keys a whole-control error as base, publishes changes once, and reports through internals', async () => {
    const el = await fixture<StructuredHost>(html`<h3-structured-host></h3-structured-host>`);
    expect(el.structured.errors).to.deep.equal({});
    el.errors = { name: 'Required' };
    el.validityController.setValidity({ valueMissing: true }, 'Required');
    el.structured.publish();
    el.structured.publish();
    expect(el.snapshots.length).to.equal(1);
    expect(el.structured.errors).to.deep.equal({ name: 'Required' });
    el.base = 'x';
    el.setCustomValidity('Server said no');
    expect(el.structured.errors['base']).to.equal('Server said no');
    expect(el.structured.reportValidity()).to.equal(false);
    expect(el.revealed).to.equal(1);
    el.setCustomValidity('');
    el.base = '';
    el.errors = {};
    el.validityController.setValidity({});
    expect(el.structured.reportValidity()).to.equal(true);
    expect(el.structured.validity.valid).to.equal(true);
  });
});

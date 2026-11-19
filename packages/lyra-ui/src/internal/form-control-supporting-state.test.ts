import { expect } from '@open-wc/testing';
import { formControlSupportingState } from './form-control-template.js';

const presence = (...names: string[]) => ({ has: (name: string) => names.includes(name) });

describe('formControlSupportingState', () => {
  it('toggles describedBy with slotted and property hint and error, error first', () => {
    const base = { idPrefix: 'input' };
    expect(formControlSupportingState({ ...base, presence: presence() }).describedBy).to.equal(undefined);
    expect(formControlSupportingState({ ...base, presence: presence('hint') }).describedBy).to.equal('input-hint');
    expect(formControlSupportingState({ ...base, presence: presence('help-text') }).hasHint).to.equal(true);
    expect(formControlSupportingState({ ...base, presence: presence(), errorText: 'Bad' }).describedBy).to.equal('input-error');
    expect(formControlSupportingState({ ...base, presence: presence('error'), hint: 'Tip' }).describedBy).to.equal('input-error input-hint');
  });

  it('honors helpText, withHint and extra ids; empty strings are absent', () => {
    const state = formControlSupportingState({
      idPrefix: 'p', presence: presence(), hint: '', helpText: 'Help', errorText: '', extraDescribedBy: ['x', false, undefined],
    });
    expect(state).to.deep.include({ hasHint: true, hasError: false, hintId: 'p-hint', errorId: 'p-error', describedBy: 'p-hint x' });
    expect(formControlSupportingState({ idPrefix: 'p', presence: presence(), withHint: true }).hasHint).to.equal(true);
  });
});

describe('FormControlController.reportValidity', () => {
  it('runs prepare after the constraint sync and reports the internals result', async () => {
    const { fixture, html } = await import('@open-wc/testing');
    await import('../components/forms/slider/slider.js');
    const slider = await fixture<HTMLElement & { setCustomValidity(m: string): void; reportValidity(): boolean }>(html`<lr-slider></lr-slider>`);
    expect(slider.reportValidity()).to.equal(true);
    slider.setCustomValidity('No');
    expect(slider.reportValidity()).to.equal(false);
  });
});

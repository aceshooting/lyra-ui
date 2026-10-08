import { expect, fixture, waitUntil } from '@open-wc/testing';
import type { LyraCheckbox } from './checkbox.js';
import './checkbox.js';

for (const attribute of ['error-text']) {
  it(`lr-checkbox safely removes ${attribute} with null readback and later recovery`, async () => {
    const el = await fixture<LyraCheckbox>('<lr-checkbox></lr-checkbox>');
    const property = attribute === 'help-text' ? 'helpText' : attribute === 'error-text' ? 'errorText' : attribute;
    el.setAttribute(attribute, 'Guidance');
    await el.updateComplete;
    el.removeAttribute(attribute);
    await el.updateComplete;
    expect(Reflect.get(el, property)).to.equal(null);
    expect(el.shadowRoot!.textContent?.includes('Guidance')).to.equal(false);
    el.setAttribute(attribute, '');
    await el.updateComplete;
    expect(Reflect.get(el, property)).to.equal('');
    el.setAttribute(attribute, 'Recovered');
    await el.updateComplete;
    expect(el.shadowRoot!.textContent?.includes('Recovered')).to.equal(true);
  });
}

it('exposes invalidity as soon as a toggle leaves a required checkbox unchecked', async () => {
  const el = await fixture<LyraCheckbox>('<lr-checkbox required>Agree</lr-checkbox>');
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  base.click();
  base.click();
  await el.updateComplete;
  expect(base.getAttribute('aria-invalid')).to.equal('true');
  expect(el.hasAttribute('data-invalid')).to.equal(true);
});

it('ignores click() from the blur the platform forces when a fieldset disables it', async () => {
  const fieldset = await fixture<HTMLFieldSetElement>('<fieldset><lr-checkbox>Agree</lr-checkbox></fieldset>');
  const el = fieldset.querySelector<LyraCheckbox>('lr-checkbox')!;
  await el.updateComplete;
  el.focus();
  el.addEventListener('blur', () => el.click());
  fieldset.disabled = true;
  expect(el.checked).to.equal(false);
});

it('accepts with-hint as the presence hint before slot assignment is observable', async () => {
  const el = await fixture<LyraCheckbox>('<lr-checkbox with-hint aria-label="Choice"></lr-checkbox>');
  expect(el.withHint).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part~="hint"]')!.hasAttribute('hidden')).to.equal(false);
});

it('follows a host description element that is replaced under the same id', async () => {
  const wrapper = await fixture<HTMLElement>('<div><span id="d">Old</span><lr-checkbox aria-describedby="d">A</lr-checkbox></div>');
  const el = wrapper.querySelector<LyraCheckbox>('lr-checkbox')!;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector<HTMLElement & { ariaDescribedByElements: Element[] | null }>('[part~="base"]')!;
  const fresh = document.createElement('span');
  fresh.id = 'd';
  wrapper.querySelector('#d')!.replaceWith(fresh);
  await waitUntil(() => base.ariaDescribedByElements?.[0] === fresh, 'the replacement is described');
});

it('reveals the hint region for with-hint before any hint content exists', async () => {
  const el = await fixture<LyraCheckbox>('<lr-checkbox with-hint>Choice</lr-checkbox>');
  expect(el.shadowRoot!.querySelector<HTMLElement>('[part~="hint"]')!.hidden).to.equal(false);
  const plain = await fixture<LyraCheckbox>('<lr-checkbox>Choice</lr-checkbox>');
  expect(plain.shadowRoot!.querySelector<HTMLElement>('[part~="hint"]')!.hidden).to.equal(true);
});

it('ignores click() the moment an ancestor fieldset disables it', async () => {
  const fieldset = await fixture<HTMLFieldSetElement>('<fieldset><lr-checkbox>Choice</lr-checkbox></fieldset>');
  const el = fieldset.querySelector<LyraCheckbox>('lr-checkbox')!;
  await el.updateComplete;
  fieldset.disabled = true;
  el.click();
  expect(el.checked).to.equal(false);
  fieldset.disabled = false;
  el.click();
  expect(el.checked).to.equal(true);
});

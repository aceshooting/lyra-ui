import { expect, fixture } from '@open-wc/testing';
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

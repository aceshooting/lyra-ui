import { expect, fixture } from '@open-wc/testing';
import type { LyraSwitch } from './switch.js';
import './switch.js';

for (const attribute of ['hint', 'help-text', 'error-text']) {
  it(`lr-switch safely removes ${attribute} with null readback and later recovery`, async () => {
    const el = await fixture<LyraSwitch>('<lr-switch></lr-switch>');
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

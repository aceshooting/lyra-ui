import { fixture, expect, html } from '@open-wc/testing';
import './empty.js';
import type { LyraEmpty } from './empty.js';

for (const property of ['heading', 'description'] as const) {
  it(`safely removes ${property} and recovers later text`, async () => {
    const el = await fixture<LyraEmpty>(html`<lr-empty></lr-empty>`);
    el.setAttribute(property, 'Original');
    await el.updateComplete;
    const part = () => el.shadowRoot!.querySelector<HTMLElement>(`[part="${property}"]`)!;
    expect(part().hidden).to.be.false;
    el.removeAttribute(property);
    await el.updateComplete;
    expect(el[property] === null).to.be.true;
    expect(part().hidden).to.be.true;
    el.setAttribute(property, '');
    await el.updateComplete;
    expect(el[property]).to.equal('');
    expect(part().hidden).to.be.true;
    el.setAttribute(property, 'Restored');
    await el.updateComplete;
    expect(part().hidden).to.be.false;
    expect(part().textContent?.trim()).to.equal('Restored');
  });
}

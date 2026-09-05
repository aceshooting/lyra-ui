import { expect, fixture, html } from '@open-wc/testing';
import './entity-chip.js';
import type { LyraEntityChip } from './entity-chip.js';

for (const attribute of ['text', 'type'] as const) {
  it(`treats removed ${attribute} as absent while retaining null and allowing recovery`, async () => {
    const el = await fixture<LyraEntityChip>(html`<lr-entity-chip text="Alpha" type="person"></lr-entity-chip>`);
    el.removeAttribute(attribute);
    await el.updateComplete;
    expect(el[attribute]).to.equal(null);
    const name = () => el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label');
    expect(name()).to.equal(attribute === 'text' ? 'Untitled entity, person' : 'Alpha');
    el.setAttribute(attribute, '');
    await el.updateComplete;
    expect(el[attribute]).to.equal('');
    expect(name()).to.equal(attribute === 'text' ? 'Untitled entity, person' : 'Alpha');
    el.setAttribute(attribute, 'Beta');
    await el.updateComplete;
    expect(name()).to.equal(attribute === 'text' ? 'Beta, person' : 'Alpha, Beta');
  });
}

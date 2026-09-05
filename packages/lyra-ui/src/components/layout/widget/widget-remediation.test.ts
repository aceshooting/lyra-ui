import { expect, fixture, html } from '@open-wc/testing';
import './widget.js';
import type { LyraWidget } from './widget.class.js';

for (const attribute of ['label', 'sublabel'] as const) {
  it(`treats removed ${attribute} as absent while preserving null, empty and recovery`, async () => {
    const element = await fixture<LyraWidget>(html`<lr-widget label="Title" sublabel="Detail">Content</lr-widget>`);
    element.removeAttribute(attribute);
    await element.updateComplete;
    expect(element[attribute]).to.equal(null);
    expect(element.shadowRoot!.querySelector(`[part="${attribute}"]`)?.textContent?.trim() ?? '').to.equal('');
    element.setAttribute(attribute, '');
    await element.updateComplete;
    expect(element[attribute]).to.equal('');
    element.setAttribute(attribute, 'Recovered');
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector(`[part="${attribute}"]`)?.textContent).to.equal('Recovered');
  });
}

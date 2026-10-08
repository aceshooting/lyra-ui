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

it('keeps the views snapshot and schedules no update when the same array is rebound', async () => {
  const views = [{ viewId: 'chart', label: 'Chart' }, { viewId: 'table', label: 'Table' }];
  const element = await fixture<LyraWidget>(html`<lr-widget .views=${views}>Content</lr-widget>`);
  await element.updateComplete;
  const snapshot = element.views;
  element.views = views;
  expect(element.isUpdatePending).to.equal(false);
  expect(element.views === snapshot).to.equal(true);
  element.views = snapshot;
  expect(element.isUpdatePending).to.equal(false);
});

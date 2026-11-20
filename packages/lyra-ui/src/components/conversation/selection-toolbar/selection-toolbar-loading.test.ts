import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-selection-toolbar.js';
import { fetchedModule } from '../../../../test/resource-entries.js';

it('positions a standalone selection on first open without fetching the floating engine', async () => {
  const el = await fixture(html`<lr-selection-toolbar open text="Select"
    .rect=${new DOMRect(100, 100, 30, 18)}></lr-selection-toolbar>`);
  const toolbar = el.shadowRoot!.querySelector<HTMLElement>('[part="toolbar"]')!;
  expect(toolbar.getBoundingClientRect().width).to.be.greaterThan(0);
  expect(toolbar.hasAttribute('data-positioned')).to.equal(true);
  expect(fetchedModule(/\/internal\/positioner\.(?:ts|js)$/, { control: '/lr-selection-toolbar.ts' })).to.equal(false);
});

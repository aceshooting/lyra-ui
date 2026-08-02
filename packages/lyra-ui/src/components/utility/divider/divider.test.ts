import { fixture, expect, html } from '@open-wc/testing';
import './divider.js';
import type { LyraDivider } from './divider.js';

it('supports the vertical boolean alias and reflects it', async () => {
  const el = (await fixture(html`<lr-divider vertical></lr-divider>`)) as LyraDivider;
  expect(el.vertical).to.be.true;
  expect(el.hasAttribute('vertical')).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-orientation')).to.equal('vertical');
});

it('accepts the mapped width, color, and spacing CSS hooks', async () => {
  const el = (await fixture(html`
    <lr-divider style="--width: 7px; --color: rgb(1, 2, 3); --spacing: 11px"></lr-divider>
  `)) as LyraDivider;
  const divider = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const computed = getComputedStyle(divider);
  expect(computed.borderTopWidth).to.equal('7px');
  expect(computed.borderTopColor).to.equal('rgb(1, 2, 3)');
  expect(computed.marginTop).to.equal('11px');
  expect(computed.marginBottom).to.equal('11px');
});

it('renders a semantic horizontal divider and supports vertical orientation', async () => {
  const el = await fixture(html`<lr-divider orientation="vertical"></lr-divider>`);
  const divider = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(divider.getAttribute('role')).to.equal('separator');
  expect(divider.getAttribute('aria-orientation')).to.equal('vertical');
  await expect(el).to.be.accessible();
});

it('forwards a host aria-label to the inner separator owner', async () => {
  const el = await fixture(html`<lr-divider aria-label="Section break"></lr-divider>`);
  const divider = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(divider.getAttribute('aria-label')).to.equal('Section break');
});

import { expect, fixture, html } from '@open-wc/testing';
import { captureDeprecationWarnings } from '../../../../test/expected-deprecations.js';
import type { LyraDropdown } from './dropdown.class.js';
import type { LyraPopover } from './popover.class.js';
import '../dialog/dialog.js';
import '../drawer/drawer.js';
import '../callout/callout.js';
import '../../layout/carousel/carousel.js';
import '../../layout/reorder-list/reorder-item.js';
import '../progress/progress-bar.js';
import '../progress/progress-ring.js';
import './popover.js';
import './tooltip.js';
import './dropdown.js';

for (const [name, selector, empty] of [
  ['progress-bar', '[role="progressbar"]', ''],
  ['progress-ring', '[role="progressbar"]', ''],
  ['dialog', '[part~="panel"]', ''],
  ['drawer', '[part~="panel"]', ''],
  ['callout', '[part~="base"]', null],
  ['carousel', '[part~="base"]', ''],
] as const) {
  it(`${name} ignores the retired naming attribute while retaining property and host precedence`, async () => {
    const el = document.createElement(`lr-${name}`) as HTMLElement & { accessibleLabel: string; updateComplete: Promise<unknown> };
    const warnings = await captureDeprecationWarnings([], async () => {
      el.setAttribute('accessible-label', 'Old attribute');
      await fixture(el);
      await el.updateComplete;
      const role = el.shadowRoot!.querySelector(selector)!;
      expect(role.getAttribute('aria-label')).not.to.equal('Old attribute');
      el.accessibleLabel = 'Property name';
      await el.updateComplete;
      expect(role.getAttribute('aria-label')).to.equal('Property name');
      el.setAttribute('aria-label', '');
      await el.updateComplete;
      expect(role.getAttribute('aria-label')).to.equal(empty);
      el.setAttribute('aria-label', 'Host name');
      await el.updateComplete;
      expect(role.getAttribute('aria-label')).to.equal('Host name');
    });
    expect(warnings.map(({ key }) => key)).to.deep.equal([`lyra-deprecated:lr-${name}:property:accessibleLabel`]);
  });
}

it('retires popover arrow while preserving canonical rendering', async () => {
  await captureDeprecationWarnings([], async () => {
    const el = await fixture<LyraPopover>(html`<lr-popover arrow="false"><button slot="trigger">Open</button>Details</lr-popover>`);
    expect(el.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(1);
    el.withoutArrow = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(0);
  });
});

it('retains dropdown arrow default, explicit false and last-write precedence', async () => {
  await captureDeprecationWarnings([{ tag: 'lr-dropdown', kind: 'property', name: 'arrow' }], async () => {
    const el = await fixture<LyraDropdown>(html`<lr-dropdown><button slot="trigger">Open</button><button>Action</button></lr-dropdown>`);
    const count = () => el.shadowRoot!.querySelectorAll('[part~="arrow"]').length;
    expect(el.arrow).to.equal(true);
    expect(count()).to.equal(1);
    el.setAttribute('arrow', 'false');
    await el.updateComplete;
    expect(el.withoutArrow).to.equal(true);
    expect(count()).to.equal(0);
    el.arrow = true;
    await el.updateComplete;
    expect(count()).to.equal(1);
    el.withoutArrow = true;
    await el.updateComplete;
    expect(el.arrow).to.equal(false);
    expect(count()).to.equal(0);
  });
});

it('reorder-item keeps its programmatic row identity without binding accessible-label', async () => {
  const el = document.createElement('lr-reorder-item') as HTMLElement & { accessibleLabel: string; updateComplete: Promise<unknown> };
  el.textContent = 'Row';
  el.setAttribute('accessible-label', 'Old attribute');
  const label = () => {
    const action = el.shadowRoot!.querySelector('[part="move-up-button"]')!;
    return (action.getAttribute('aria-labelledby') ?? '').split(/\s+/)
      .map(id => el.shadowRoot!.getElementById(id)?.textContent ?? '').join(' ').trim();
  };
  const warnings = await captureDeprecationWarnings([], async () => {
    await fixture(el);
    expect(label()).to.equal('Move up Row');
    el.accessibleLabel = 'Invoices';
    await el.updateComplete;
    expect(label()).to.equal('Move up Invoices');
    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(label()).to.equal('Move up');
    el.setAttribute('aria-label', 'Orders');
    await el.updateComplete;
    expect(label()).to.equal('Move up Orders');
  });
  expect(warnings.map(({ key }) => key)).to.deep.equal(['lyra-deprecated:lr-reorder-item:property:accessibleLabel']);
});

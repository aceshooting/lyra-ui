import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { expect, fixture, html } from '@open-wc/testing';
import { captureDeprecationWarnings } from '../../../../test/expected-deprecations.js';
import type { LyraElement } from '../../../internal/lyra-element.js';
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

// These fixtures deliberately verify that retired attributes remain inert.
expectStaleAttribute('lr-callout', 'accessible-label');
expectStaleAttribute('lr-carousel', 'accessible-label');
expectStaleAttribute('lr-dialog', 'accessible-label');
expectStaleAttribute('lr-drawer', 'accessible-label');
expectStaleAttribute('lr-popover', 'arrow');
expectStaleAttribute('lr-dropdown', 'arrow');
expectStaleAttribute('lr-progress-bar', 'accessible-label');
expectStaleAttribute('lr-progress-ring', 'accessible-label');
expectStaleAttribute('lr-reorder-item', 'accessible-label');

for (const [name, selector, empty] of [
  ['progress-bar', '[role="progressbar"]', ''],
  ['progress-ring', '[role="progressbar"]', ''],
  ['dialog', '[part~="panel"]', ''],
  ['drawer', '[part~="panel"]', ''],
  ['callout', '[part~="base"]', null],
  ['carousel', '[part~="base"]', ''],
] as const) {
  it(`${name} ignores removed naming aliases while retaining host aria-label`, async () => {
    const el = document.createElement(`lr-${name}`) as LyraElement;
    el.setAttribute('accessible-label', 'Old attribute');
    await fixture(el);
    await el.updateComplete;
    const role = el.shadowRoot!.querySelector(selector)!;
    expect(role.getAttribute('aria-label')).not.to.equal('Old attribute');
    Reflect.set(el, 'accessibleLabel', 'Property name');
    await el.updateComplete;
    expect(role.getAttribute('aria-label')).not.to.equal('Property name');
    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(role.getAttribute('aria-label')).to.equal(empty);
    el.setAttribute('aria-label', 'Host name');
    await el.updateComplete;
    expect(role.getAttribute('aria-label')).to.equal('Host name');
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

it('ignores the removed dropdown arrow alias and retains without-arrow control', async () => {
  const el = await fixture<LyraDropdown>(html`<lr-dropdown><button slot="trigger">Open</button><button>Action</button></lr-dropdown>`);
  const count = () => el.shadowRoot!.querySelectorAll('[part~="arrow"]').length;
  expect(el.withoutArrow).to.equal(false);
  expect(count()).to.equal(1);
  el.setAttribute('arrow', 'false');
  await el.updateComplete;
  expect(el.withoutArrow).to.equal(false);
  expect(count()).to.equal(1);
  el.withoutArrow = true;
  await el.updateComplete;
  expect(count()).to.equal(0);
});

it('reorder-item ignores retired row naming and follows host aria-label', async () => {
  const el = document.createElement('lr-reorder-item');
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
    Reflect.set(el, 'accessibleLabel', 'Invoices');
    await el.updateComplete;
    expect(label()).to.equal('Move up Row');
    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(label()).to.equal('Move up');
    el.setAttribute('aria-label', 'Orders');
    await el.updateComplete;
    expect(label()).to.equal('Move up Orders');
  });
  expect(warnings).to.have.length(0);
});

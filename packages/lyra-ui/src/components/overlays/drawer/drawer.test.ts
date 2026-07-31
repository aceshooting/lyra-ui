import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './drawer.js';
import type { LyraDrawer } from './drawer.js';

it('renders an open drawer with the requested placement and accessible panel', async () => {
  const el = (await fixture(html`
    <lr-drawer open placement="end" heading="Filters">
      <p>Filter controls</p>
    </lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;

  const panel = el.shadowRoot!.querySelector('[part="panel"]')!;
  expect(el.getAttribute('placement')).to.equal('end');
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
  expect(panel.getAttribute('aria-labelledby')).to.match(/^lr-dialog-heading-/);
});

it('closes through the inherited cancelable close contract', async () => {
  const el = (await fixture(html`
    <lr-drawer open heading="Details" closable></lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;

  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lr-dialog-close');
  button.click();
  const event = await eventPromise;

  expect(event.detail).to.equal('close-button');
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('does not activate inherited modal infrastructure when opened while detached', async () => {
  const el = (await fixture(html`<lr-drawer heading="Details"></lr-drawer>`)) as LyraDrawer;
  const parent = el.parentElement!;
  el.remove();
  el.open = true;
  await el.updateComplete;

  expect(document.documentElement.style.overflow).to.equal('');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;

  parent.append(el);
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');
  el.close();
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('');
});

it('is accessible while open', async () => {
  const el = (await fixture(html`
    <lr-drawer open aria-label="Navigation drawer"><p>Navigation</p></lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('defaults placement to end, matching wa-drawer', async () => {
  // It used to default to `start`, so a mechanical `wa-drawer` -> `lr-drawer` rename silently
  // moved every migrated drawer to the other edge.
  const el = (await fixture(html`<lr-drawer open heading="Filters"><p>Body</p></lr-drawer>`)) as LyraDrawer;
  await el.updateComplete;
  expect(el.placement).to.equal('end');
  expect(el.getAttribute('placement')).to.equal('end');
});

it('flips the enter-animation offset under RTL to match the mirrored resting edge', async () => {
  const rtlStartWrapper = (await fixture(html`
    <div dir="rtl"><lr-drawer open placement="start" heading="Filters"><p>Filter controls</p></lr-drawer></div>
  `)) as HTMLElement;
  const startDrawer = rtlStartWrapper.querySelector('lr-drawer') as LyraDrawer;
  await startDrawer.updateComplete;
  const startPanel = startDrawer.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  // A 'start' drawer rests at the physical right edge under RTL, so it must enter
  // from further right -- the same positive offset an LTR 'end' drawer uses.
  expect(getComputedStyle(startPanel).getPropertyValue('--lr-drawer-enter-x').trim()).to.equal('1rem');

  const rtlEndWrapper = (await fixture(html`
    <div dir="rtl"><lr-drawer open placement="end" heading="Filters"><p>Filter controls</p></lr-drawer></div>
  `)) as HTMLElement;
  const endDrawer = rtlEndWrapper.querySelector('lr-drawer') as LyraDrawer;
  await endDrawer.updateComplete;
  const endPanel = endDrawer.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  // An 'end' drawer rests at the physical left edge under RTL -- the mirror image,
  // so it must enter from further left, same as an LTR 'start' (default) drawer.
  expect(getComputedStyle(endPanel).getPropertyValue('--lr-drawer-enter-x').trim()).to.equal('calc(-1 * 1rem)');
});

describe('inherited show/hide lifecycle', () => {
  it('runs the same four-event lifecycle as lr-dialog', async () => {
    const el = (await fixture(html`<lr-drawer heading="Filters"><p>Body</p></lr-drawer>`)) as LyraDrawer;
    const order: string[] = [];
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
      el.addEventListener(name, () => order.push(name));
    }

    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    expect(el.open).to.be.true;
    await afterShow;

    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    expect(el.open).to.be.false;
    await afterHide;

    expect(order).to.deep.equal(['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
  });

  it('vetoing lr-show keeps the drawer closed', async () => {
    const el = (await fixture(html`<lr-drawer heading="Filters"><p>Body</p></lr-drawer>`)) as LyraDrawer;
    el.addEventListener('lr-show', (event) => (event as Event).preventDefault());
    el.show();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it('promotes an open drawer into the top layer', async () => {
    const el = (await fixture(html`<lr-drawer heading="Filters"><p>Body</p></lr-drawer>`)) as LyraDrawer;
    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    await el.updateComplete;
    expect(el.matches(':popover-open')).to.be.true;
    await afterShow;
    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    await afterHide;
    expect(el.matches(':popover-open')).to.be.false;
  });
});

describe('slide animation', () => {
  it('slides out with the drawer exit keyframes, not the dialog panel ones', async () => {
    const el = (await fixture(html`<lr-drawer heading="Filters" open><p>Body</p></lr-drawer>`)) as LyraDrawer;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).animationName).to.equal('lr-drawer-in');

    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    await el.updateComplete;
    expect(getComputedStyle(panel).animationName).to.equal('lr-drawer-out');
    await afterHide;
  });

  it('slides out along the block axis for top/bottom placements', async () => {
    const el = (await fixture(
      html`<lr-drawer heading="Filters" placement="bottom" open><p>Body</p></lr-drawer>`,
    )) as LyraDrawer;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).animationName).to.equal('lr-drawer-in-block');

    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    await el.updateComplete;
    expect(getComputedStyle(panel).animationName).to.equal('lr-drawer-out-block');
    await afterHide;
  });

  it('reads its duration from the shared panel-duration knob, so reduced motion still settles', async () => {
    const el = (await fixture(html`<lr-drawer heading="Filters"><p>Body</p></lr-drawer>`)) as LyraDrawer;
    el.style.setProperty('--lr-duration-base', '0.001ms');
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    await el.updateComplete;
    expect(getComputedStyle(panel).animationDuration).to.equal('1e-06s');
    await afterShow;
    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    await afterHide;
    expect(el.open).to.be.false;
  });
});

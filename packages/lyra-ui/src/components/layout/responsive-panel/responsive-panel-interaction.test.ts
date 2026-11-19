import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './responsive-panel.js';
import type { LyraResponsivePanel } from './responsive-panel.js';

describe('lr-responsive-panel interactions', () => {
  it('retints the docked panel through a public background token', async () => {
    const el = await fixture<LyraResponsivePanel>(html`<lr-responsive-panel
      mode="inline"
      open
      style="--lr-responsive-panel-bg: rgb(1, 2, 3)"
      >Body</lr-responsive-panel
    >`);
    const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;
    expect(getComputedStyle(panel).backgroundColor).to.equal('rgb(1, 2, 3)');
  });

  it('reflects the host aria-describedby onto the open overlay dialog', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div
      ><p id="note">Explains the panel</p
      ><lr-responsive-panel mode="overlay" open label="P" aria-describedby="note">Body</lr-responsive-panel></div
    >`);
    const el = wrapper.querySelector<LyraResponsivePanel>('lr-responsive-panel')!;
    await el.updateComplete;
    const owner = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"][role="dialog"], [data-native-modal-carrier]')!;
    const described = owner.ariaDescribedByElements ?? [];
    expect(described.length === 1 && described[0] === wrapper.querySelector('#note')).to.equal(true);
  });

  it('keeps the dialog name following a slotted heading after the heading text changes', async () => {
    const el = await fixture<LyraResponsivePanel>(html`<lr-responsive-panel mode="overlay" open
      ><h2 slot="header">First</h2>Body</lr-responsive-panel
    >`);
    await el.updateComplete;
    const owner = (): HTMLElement =>
      el.shadowRoot!.querySelector<HTMLElement>('[part="panel"][role="dialog"], [data-native-modal-carrier]')!;
    await waitUntil(() => owner().getAttribute('aria-label') === 'First', 'initial heading name');
    el.querySelector('h2')!.textContent = 'Second';
    await waitUntil(() => owner().getAttribute('aria-label') === 'Second', 'the name follows the heading text');
    expect(owner().getAttribute('aria-label')).to.equal('Second');
  });
});

it('preserves an explicit open write by a request listener', async () => {
  const el = await fixture<LyraResponsivePanel>(html`<lr-responsive-panel mode="inline" open>Body</lr-responsive-panel>`);
  let commits = 0;
  el.addEventListener('lr-close-request', () => { el.open = true; });
  el.addEventListener('lr-close', () => commits++);
  el.close();
  await el.updateComplete;
  expect(el.open).to.equal(true);
  expect(commits).to.equal(0);
});

it('inherits responsive-panel surface and spacing overrides', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div style="--lr-responsive-panel-docked-radius: 13px; --lr-responsive-panel-docked-border-color: rgb(4, 5, 6); --lr-responsive-panel-padding: 19px; --lr-responsive-panel-gap: 15px">
    <lr-responsive-panel open mode="inline"></lr-responsive-panel>
  </div>`);
  const el = wrapper.querySelector('lr-responsive-panel')!;
  await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="panel"]')!).borderTopLeftRadius).to.equal('13px');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="panel"]')!).borderTopColor).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="body"]')!).paddingTop).to.equal('19px');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="footer"]')!).columnGap).to.equal('15px');
});

it('classifies a scaled container by its layout width before observer delivery', async () => {
  const saved = window.ResizeObserver;
  Reflect.set(window, 'ResizeObserver', undefined);
  try {
    const wrapper = await fixture<HTMLElement>(html`<div style="transform: scale(0.5)">
      <lr-responsive-panel style="inline-size: 900px" open>Content</lr-responsive-panel>
    </div>`);
    const el = wrapper.querySelector('lr-responsive-panel')!;
    await el.updateComplete;
    expect(el.effectiveMode).to.equal('inline');
  } finally {
    Reflect.set(window, 'ResizeObserver', saved);
  }
});

it('accepts a programmatic accessibleLabel on the panel', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-responsive-panel']>(html`<lr-responsive-panel mode="overlay" open>Body</lr-responsive-panel>`);
  el.accessibleLabel = 'Quarterly results';
  await el.updateComplete;
  const owner = el.shadowRoot!.querySelector('[part~="panel"]')!;
  expect(owner.getAttribute('aria-label')).to.equal('Quarterly results');
});

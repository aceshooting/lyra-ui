import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-activity-feed.js';
import type { LyraActivityFeed } from '../../lr-activity-feed.js';

it('does not expand when a toggle-request listener removes the feed', async () => {
  const el = await fixture<LyraActivityFeed>(html`<lr-activity-feed></lr-activity-feed>`);
  el.addEventListener('lr-toggle-request', () => el.remove());
  const toggles: unknown[] = [];
  el.addEventListener('lr-toggle', (event) => toggles.push(event));
  el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.click();
  expect(el.expanded).to.equal(false);
  expect(toggles.length).to.equal(0);
});

it('does not overwrite a listener that already expanded the feed', async () => {
  const el = await fixture<LyraActivityFeed>(html`<lr-activity-feed></lr-activity-feed>`);
  el.addEventListener('lr-toggle-request', () => { el.expanded = true; });
  const toggles: unknown[] = [];
  el.addEventListener('lr-toggle', (event) => toggles.push(event));
  el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.click();
  expect(el.expanded).to.equal(true);
  expect(toggles.length).to.equal(0);
});

it('paints header hover with a system-colour edge under forced colors', async () => {
  try {
    await setForcedColors('active');
    const el = await fixture<LyraActivityFeed>(html`<lr-activity-feed></lr-activity-feed>`);
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    await hoverUntilMatched(header, 'header hover');
    expect(getComputedStyle(header).outlineStyle).to.equal('solid');
  } finally {
    await resetMouse();
    await setForcedColors('none');
  }
});

it('distinguishes entry states and the live indicator in forced colors across both list renderers', async () => {
  try {
    await setForcedColors('active');
    const entries = ['warning', 'danger', 'success'].map(variant => ({ id: variant, text: variant, variant }));
    for (const limit of [1, 10]) {
      const el = await fixture<LyraActivityFeed>(html`<lr-activity-feed expanded .virtualizeAt=${limit} .entries=${entries}></lr-activity-feed>`);
      const list = el.shadowRoot!.querySelector('lr-virtual-list');
      if (list) await list.updateComplete;
      const root = list?.shadowRoot ?? el.shadowRoot!;
      const styles = entries.map(({ id }) => getComputedStyle(root.querySelector(`[part~="variant-dot-${id}"]`)!));
      expect(styles.map(style => style.borderTopStyle)).to.deep.equal(['dashed', 'double', 'solid']);
      expect(getComputedStyle(el.shadowRoot!.querySelector('[part="status-dot"]')!).borderTopStyle).to.equal('solid');
    }
  } finally {
    await setForcedColors('none');
  }
});

it('discards a toggle request after a listener reconnects the host', async () => {
  const root = await fixture<HTMLDivElement>(html`<div><lr-activity-feed></lr-activity-feed></div>`);
  const el = root.querySelector('lr-activity-feed')!;
  await el.updateComplete;
  let toggles = 0;
  el.addEventListener('lr-toggle-request', () => { el.remove(); root.append(el); });
  el.addEventListener('lr-toggle', () => toggles++);
  el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.click();
  expect(el.expanded).to.equal(false);
  expect(toggles).to.equal(0);
});

it('ignores a detached header without dispatching a toggle request', async () => {
  const el = await fixture<LyraActivityFeed>(html`<lr-activity-feed></lr-activity-feed>`);
  let requests = 0;
  el.addEventListener('lr-toggle-request', () => requests++);
  const header = el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
  el.remove();
  header.click();
  expect(requests).to.equal(0);
  expect(el.expanded).to.equal(false);
});

it('keeps the summary on the hovered header colour instead of the quiet resting tone', async () => {
  try {
    const el = await fixture<LyraActivityFeed>(html`<lr-activity-feed .entries=${[{ id: 'a', text: 'Read file' }]}></lr-activity-feed>`);
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
    const resting = getComputedStyle(summary).color;
    await hoverUntilMatched(header, 'header hover');
    expect(getComputedStyle(summary).color).to.equal(getComputedStyle(header).color);
    expect(getComputedStyle(summary).color).not.to.equal(resting);
  } finally {
    await resetMouse();
  }
});

it('uses the themed header hover color', async () => {
  const el = await fixture(html`<lr-activity-feed  style="--lr-activity-feed-header-hover-bg: rgb(5, 10, 15)"></lr-activity-feed>`);
  const target = el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
  try {
    await hoverUntilMatched(target, 'header hover');
    expect(getComputedStyle(target).backgroundColor).to.equal('rgb(5, 10, 15)');
  } finally { await resetMouse(); }
});

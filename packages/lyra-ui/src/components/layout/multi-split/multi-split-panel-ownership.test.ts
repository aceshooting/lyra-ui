import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraMultiSplit } from './multi-split.class.js';
import './multi-split.js';

async function splitFixture(floating = false): Promise<LyraMultiSplit> {
  return fixture<LyraMultiSplit>(html`<lr-multi-split collapse=${floating ? 'start' : 'none'}
    style="inline-size:300px;block-size:180px" .sizes=${[40, 60]}>
    <div panel-id="first"><button>First action</button></div>
    <div panel-id="second">Second panel</div>
  </lr-multi-split>`);
}

async function releasePanel(split: LyraMultiSplit, panel: HTMLElement): Promise<void> {
  const changed = oneEvent(split.shadowRoot!.querySelector('slot')!, 'slotchange');
  panel.remove();
  await changed;
  await split.updateComplete;
}

for (const authored of [false, 'until-found'] as const) {
  it(`keeps a closed floating pane hidden after an isolated ${String(authored)} author write and restores it on release`, async () => {
    const split = await splitFixture(true);
    const panel = split.children[0] as HTMLElement;
    await waitUntil(() => split.collapseState === 'floating' && panel.hidden === true);
    panel.hidden = authored;
    await waitUntil(() => panel.hidden === true, 'the observer reasserts the closed drawer visibility');
    expect(getComputedStyle(panel).display).to.equal('none');
    expect(split.open).to.equal(false);
    expect(split.sizes).to.deep.equal([40, 60]);
    split.remove();
    expect(panel.hidden).to.equal(authored);
  });
}

for (const attribute of ['data-collapse-state', 'data-panel-collapsed'] as const) {
  it(`reconciles an isolated authored ${attribute} marker and retains it when the panel leaves`, async () => {
    const split = await splitFixture();
    const panel = split.children[0] as HTMLElement;
    expect(panel.hasAttribute(attribute)).to.equal(false);
    panel.setAttribute(attribute, 'author-value');
    await waitUntil(() => !panel.hasAttribute(attribute), 'live split state replaces the isolated marker write');
    expect(split.collapsedPanels).to.deep.equal([]);
    expect(split.sizes).to.deep.equal([40, 60]);
    expect(panel.getBoundingClientRect().width).to.be.greaterThan(50);
    await releasePanel(split, panel);
    expect(panel.getAttribute(attribute)).to.equal('author-value');
    expect([...split.children].map(child => child.getAttribute('panel-id'))).to.deep.equal(['second']);
  });
}

it('restores a removed fold marker while owned and preserves its removal after release', async () => {
  const split = await splitFixture();
  const panel = split.children[0] as HTMLElement;
  expect(split.collapsePanel(panel)).to.equal(true);
  await split.updateComplete;
  expect(panel.hasAttribute('data-panel-collapsed')).to.equal(true);
  panel.removeAttribute('data-panel-collapsed');
  await waitUntil(() => panel.hasAttribute('data-panel-collapsed'), 'the still-collapsed model restores its marker');
  expect(split.collapsedPanels).to.deep.equal(['first']);
  expect(split.sizes).to.deep.equal([0, 100]);
  await releasePanel(split, panel);
  expect(panel.hasAttribute('data-panel-collapsed')).to.equal(false);
  expect(split.collapsedPanels).to.deep.equal(['first']);
  expect(split.sizes).to.deep.equal([100]);
  expect(split.querySelectorAll('[data-panel-collapsed]').length).to.equal(0);
  const changed = oneEvent(split.shadowRoot!.querySelector('slot')!, 'slotchange');
  split.append(panel);
  await changed;
  await split.updateComplete;
  expect(panel.hasAttribute('data-panel-collapsed')).to.equal(true);
  expect(split.sizes).to.deep.equal([100, 0]);
  await releasePanel(split, panel);
  expect(panel.hasAttribute('data-panel-collapsed')).to.equal(false);
});

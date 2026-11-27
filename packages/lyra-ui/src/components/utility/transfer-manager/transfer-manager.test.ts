import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import type { LyraTransferManager } from '../../lr-transfer-manager.js';
import '../../lr-transfer-manager.js';
import '../../../translations/fr/shared.js';
import '../../../translations/fr/utility.js';

const queue = [
  { id: 'second', name: 'Mountain.tif', status: 'active', bytesDone: 30, bytesTotal: 100 },
  { id: 'first', name: 'River.tif', status: 'queued', bytesDone: 0, bytesTotal: 100 },
  { id: 'hold', name: 'Forest.tif', status: 'paused', bytesDone: 20, bytesTotal: 100 },
  { id: 'bad', name: 'Cliff.tif', status: 'error', bytesDone: 0, bytesTotal: 100 },
  { id: 'stop', name: 'Sea.tif', status: 'cancelled', bytesDone: 0, bytesTotal: 300 },
  { id: 'ok', name: 'Cloud.tif', status: 'done', bytesDone: 100, bytesTotal: 100 },
] as const;

const byPart = <T extends HTMLElement>(el: ParentNode, part: string): T =>
  el.querySelector<T>(`[part~="${part}"]`)!;
const row = (el: LyraTransferManager, id: string): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="item"][data-id="${id}"]`)!;
const mount = (): Promise<LyraTransferManager> =>
  fixture<LyraTransferManager>(html`<lr-transfer-manager .transfers=${queue}></lr-transfer-manager>`);

describe('lr-transfer-manager', () => {
  it('exposes a named, accessible expanded queue with individual and byte-weighted overall progress', async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    const overall = byPart<HTMLProgressElement>(root, 'overall-progress');
    const progress = byPart<HTMLProgressElement>(row(el, 'second'), 'progress');
    expect(overall.position).to.equal(150 / 800);
    expect(progress.position).to.equal(0.3);
    expect(progress.getAttribute('aria-label')).to.equal('Mountain.tif');
    expect(root.querySelectorAll('[part~="item"]').length).to.equal(6);
    expect(byPart(root, 'base').getAttribute('aria-label')).to.equal('Transfers');
    expect(byPart(root, 'disclosure').getAttribute('aria-expanded')).to.equal('true');
    await expect(el).to.be.accessible();
  });

  it('collapses and expands from the keyboard while keeping overall progress visible', async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    const toggle = byPart<HTMLButtonElement>(root, 'disclosure');
    const panel = root.getElementById(toggle.getAttribute('aria-controls')!)!;
    await focusByKeyboard(toggle);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(el.collapsed && el.hasAttribute('collapsed')).to.equal(true);
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(panel.getClientRects().length).to.equal(0);
    expect(byPart(root, 'overall-progress').getClientRects().length).to.be.greaterThan(0);
    expect(root.activeElement === toggle).to.equal(true);
    await expect(el).to.be.accessible();
    await sendKeys({ press: 'Space' });
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect(panel.getClientRects().length).to.be.greaterThan(0);
  });

  it('shows the localized overall percent in the compact disclosure and drops it for unknown totals', async () => {
    const el = await fixture<LyraTransferManager>(html`<lr-transfer-manager collapsed locale="fr"
      .transfers=${[{ ...queue[0], bytesDone: 37, bytesTotal: 100 }]}>
    </lr-transfer-manager>`);
    const root = el.shadowRoot!;
    const toggle = byPart<HTMLButtonElement>(root, 'disclosure');
    const percent = new Intl.NumberFormat('fr', { style: 'percent' }).format(0.37);
    expect(toggle.innerText).to.contain(percent);
    el.transfers = [{ id: 'photo', name: 'Photo', status: 'active', bytesDone: 37 }];
    await el.updateComplete;
    expect(toggle.innerText).to.not.contain('%');
    expect(toggle.innerText).to.contain('1');
    expect(byPart<HTMLProgressElement>(root, 'overall-progress').position).to.equal(-1);
  });

  it('repairs focus when host updates retire actions and preserves focus outside the queue', async () => {
    const container = await fixture<HTMLElement>(html`<div>
      <button type="button">Outside</button><lr-transfer-manager .transfers=${queue}></lr-transfer-manager>
    </div>`);
    const el = container.querySelector('lr-transfer-manager')!;
    const root = el.shadowRoot!;
    const transfer = row(el, 'second');
    await focusByKeyboard(transfer.querySelector<HTMLButtonElement>('[data-action="pause"]')!);
    el.transfers = [{ ...queue[0], status: 'paused' }, ...queue.slice(1)];
    await el.updateComplete;
    expect(transfer.contains(root.activeElement)).to.equal(true);
    expect(root.activeElement?.getAttribute('data-action')).to.be.oneOf(['resume', 'cancel']);
    el.collapsed = true;
    await el.updateComplete;
    expect(root.activeElement === byPart(root, 'disclosure')).to.equal(true);
    const outside = container.querySelector('button')!;
    await focusByKeyboard(outside);
    el.collapsed = false;
    el.transfers = [];
    await el.updateComplete;
    expect(document.activeElement === outside).to.equal(true);
  });

  it('emits composed requests for eligible item and bulk IDs in input order without changing transfers', async () => {
    const el = await mount();
    const snapshot = JSON.stringify(el.transfers);
    const bulk = byPart(el.shadowRoot!, 'bulk-actions');
    const eligible = {
      pause: ['second', 'first'],
      resume: ['hold'],
      cancel: ['second', 'first', 'hold'],
      retry: ['bad', 'stop'],
    };
    for (const [action, ids] of Object.entries(eligible)) {
      for (const [scope, expected] of [[bulk, ids], [row(el, ids[0]!), [ids[0]!]]] as const) {
        const button = scope.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)!;
        const received = oneEvent(el.parentElement!, `lr-transfer-${action}`);
        await focusByKeyboard(button);
        await sendKeys({ press: 'Enter' });
        const event = await received;
        expect(event.detail.ids).to.deep.equal(expected);
        expect(event.composed && event.bubbles).to.equal(true);
        expect(JSON.stringify(el.transfers)).to.equal(snapshot);
      }
    }
    expect(row(el, 'ok').querySelectorAll('button:not(:disabled)').length).to.equal(0);
    expect(el.transfers).to.deep.equal(queue);
  });

  it('checks current eligibility when an old control is activated before the next render', async () => {
    const el = await mount();
    const oldPause = row(el, 'second').querySelector<HTMLButtonElement>('[data-action="pause"]')!;
    const oldBulkPause = byPart(el.shadowRoot!, 'bulk-actions').querySelector<HTMLButtonElement>('[data-action="pause"]')!;
    const requests: (readonly string[])[] = [];
    el.addEventListener('lr-transfer-pause', event => requests.push(event.detail.ids));
    el.transfers = [{ ...queue[0], status: 'done' }, queue[1]];
    oldPause.click();
    oldBulkPause.click();
    expect(requests).to.deep.equal([['first']]);
    await el.updateComplete;
    expect(row(el, 'second').querySelectorAll('[data-action="pause"]').length).to.equal(0);
  });

  it('bounds the expanded window while summary and bulk actions include the entire queue', async () => {
    const transfers = Array.from({ length: 101 }, (_, i) => ({
      ...queue[0], id: String(i), bytesDone: i === 100 ? 100 : 0,
    }));
    const el = await fixture<LyraTransferManager>(html`<lr-transfer-manager .transfers=${transfers}></lr-transfer-manager>`);
    const root = el.shadowRoot!;
    expect(root.querySelectorAll('[part~="item"]').length).to.equal(100);
    expect(byPart<HTMLProgressElement>(root, 'overall-progress').position).to.be.closeTo(1 / 101, 0.000001);
    const action = oneEvent(el, 'lr-transfer-pause');
    byPart(root, 'bulk-actions').querySelector<HTMLButtonElement>('[data-action="pause"]')!.click();
    expect((await action).detail.ids).to.deep.equal(transfers.map(item => item.id));
    root.querySelector<HTMLButtonElement>('[data-more]')!.click();
    await el.updateComplete;
    expect(root.querySelectorAll('[part~="item"]').length).to.equal(101);
    el.collapsed = true;
    await el.updateComplete;
    expect(root.querySelectorAll('[part~="item"]').length).to.equal(0);
  });

  it('shows unknown progress and ETA without announcing each counter update', async () => {
    const strings = { transferManagerUnknownEta: 'Remaining time unavailable' };
    const el = await fixture<LyraTransferManager>(html`<lr-transfer-manager .strings=${strings}
      .transfers=${[{ ...queue[0], bytesTotal: undefined }]}></lr-transfer-manager>`);
    const root = el.shadowRoot!;
    expect(byPart<HTMLProgressElement>(root, 'overall-progress').position).to.equal(-1);
    expect(byPart<HTMLProgressElement>(row(el, 'second'), 'progress').position).to.equal(-1);
    expect(byPart(row(el, 'second'), 'eta').textContent).to.contain(strings.transferManagerUnknownEta);
    const sampleTime = performance.now();
    await waitUntil(() => performance.now() > sampleTime, 'a distinct clock sample is available for the byte rate');
    el.transfers = [{ ...queue[0], bytesDone: 80 }];
    await el.updateComplete;
    const item = row(el, 'second');
    expect(byPart<HTMLProgressElement>(item, 'progress').position).to.equal(0.8);
    expect(byPart(item, 'rate').textContent?.trim()).to.not.equal('');
    expect(byPart(item, 'eta').textContent).to.not.contain(strings.transferManagerUnknownEta);
    expect(root.textContent).to.not.match(/NaN|Infinity/);
    expect(byPart(item, 'metrics').closest('[aria-live="polite"], [aria-live="assertive"], [role="status"]') === null).to.equal(true);
    el.transfers = [{ ...queue[0], bytesDone: Number.NaN, bytesTotal: Infinity }];
    await el.updateComplete;
    expect(root.textContent).to.not.match(/NaN|Infinity/);
  });

  it('localizes the section and the empty state and honors the host accessible name', async () => {
    const el = await fixture<LyraTransferManager>(html`<lr-transfer-manager
      .strings=${{ transferManagerLabel: 'My transfers', transferManagerEmpty: 'Nothing to transfer' }}>
    </lr-transfer-manager>`);
    expect(byPart(el.shadowRoot!, 'base').getAttribute('aria-label')).to.equal('My transfers');
    expect(byPart(el.shadowRoot!, 'empty').textContent?.trim()).to.equal('Nothing to transfer');
    el.setAttribute('aria-label', 'Photo transfers');
    await el.updateComplete;
    expect(byPart(el.shadowRoot!, 'base').getAttribute('aria-label')).to.equal('Photo transfers');
  });

  it('wraps long names at a narrow allocation and anchors floating placement at inline end in RTL', async () => {
    const el = await fixture<LyraTransferManager>(html`<lr-transfer-manager dir="rtl" style="inline-size:320px"
      .transfers=${[{ ...queue[0], name: 'x'.repeat(400) }]}></lr-transfer-manager>`);
    const base = byPart(el.shadowRoot!, 'base');
    expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
    expect(getComputedStyle(el).position).to.not.equal('fixed');
    el.placement = 'floating';
    await el.updateComplete;
    expect(getComputedStyle(el).position).to.equal('fixed');
    expect(getComputedStyle(el).left).to.not.equal('auto');
    expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
  });

  it('disables button transitions under reduced motion', async () => {
    try {
      await setReducedMotion('no-preference');
      const el = await mount();
      const toggle = byPart(el.shadowRoot!, 'disclosure');
      expect(getComputedStyle(toggle).transitionDuration).to.not.equal('0s');
      await setReducedMotion('reduce');
      expect(getComputedStyle(toggle).transitionDuration).to.equal('0s');
    } finally {
      await setReducedMotion('no-preference');
    }
  });
});

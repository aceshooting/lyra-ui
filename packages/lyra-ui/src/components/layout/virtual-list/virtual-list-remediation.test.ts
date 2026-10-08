import { twoFrames as nextFrame } from '../../../../test/frames.js';
import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './virtual-list.js';
import type { LyraVirtualList } from './virtual-list.js';

const numberKey = (item: unknown): number => item as number;

describe('virtual-list row identities', () => {
  const items = Array.from({ length: 2000 }, (_, index) => index);
  const tallRow = (item: unknown) => html`<div style="height: 30px">${item}</div>`;

  async function mount(key: (item: unknown) => number): Promise<LyraVirtualList> {
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height: 200px"
      .items=${items} .keyFunction=${key} .renderItem=${tallRow}></lr-virtual-list>`);
    await nextFrame();
    return el;
  }

  it('does not re-derive every key when an equivalent items array is re-committed', async () => {
    let keyCalls = 0;
    const el = await mount((item) => { keyCalls += 1; return item as number; });
    keyCalls = 0;
    for (let round = 0; round < 5; round += 1) {
      el.items = [...items];
      await el.updateComplete;
    }
    expect(keyCalls, `keyFunction ran ${keyCalls} times for five equivalent re-commits`).to.be.lessThan(1000);
  });

  it('does not re-derive every key for each batch of newly measured rows', async () => {
    let keyCalls = 0;
    const el = await mount((item) => { keyCalls += 1; return item as number; });
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    keyCalls = 0;
    for (let frame = 1; frame <= 5; frame += 1) {
      base.scrollTop = frame * 600;
      base.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await el.updateComplete;
    }
    expect(keyCalls, `keyFunction ran ${keyCalls} times across five measured scroll frames`).to.be.lessThan(1000);
  });

  it('keeps a pending scroll correction across an equivalent items re-commit', async () => {
    const el = await mount(numberKey);
    el.scrollToIndex(1500, { align: 'start', behavior: 'auto' });
    el.items = [...items];
    await el.updateComplete;
    expect((el as unknown as { pendingScrollCorrection?: unknown }).pendingScrollCorrection !== undefined).to.equal(true);
  });
});

describe('virtual-list focused row', () => {
  for (const projection of ['shadow', 'light'] as const) {
    it(`keeps the focused ${projection} row mounted outside the window until focus leaves it`, async () => {
      const items = Array.from({ length: 200 }, (_, index) => index);
      const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height: 200px"
        row-height="40" overscan="2" row-projection=${projection} .items=${items} .keyFunction=${numberKey}
        .renderItem=${(item: unknown) => html`<button type="button">row ${item}</button>`}></lr-virtual-list>`);
      await nextFrame();
      const root: ParentNode = projection === 'light' ? el : el.shadowRoot!;
      const button = root.querySelector<HTMLButtonElement>('[data-row-index="1"] button')!;
      await focusByKeyboard(button);
      const rows = (): number[] => [...el.shadowRoot!.querySelectorAll('[part="row"]')].map((row) => Number(row.getAttribute('data-row-index')));
      for (let press = 0; press < 12 && !(rows()[0] === 1 && rows()[1]! > 3); press += 1) {
        await sendKeys({ press: 'PageDown' });
        await nextFrame();
        await el.updateComplete;
      }
      expect(rows()[0] === 1 && rows()[1]! > 3, `row 1 stays mounted beside the moved window: ${rows()}`).to.equal(true);
      expect(button.isConnected).to.equal(true);
      expect(document.activeElement === (projection === 'light' ? button : el), 'focus stays in the list').to.equal(true);
      const other = document.createElement('button');
      document.body.append(other);
      try {
        other.focus();
        await nextFrame();
        await el.updateComplete;
        expect(button.isConnected, 'the row unmounts once focus leaves it').to.equal(false);
      } finally {
        other.remove();
      }
    });
  }
});

describe('virtual-list part lookups', () => {
  it('queries the base and spacer once while they stay attached', async () => {
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height: 200px"
      .items=${Array.from({ length: 50 }, (_, index) => index)} .renderItem=${(item: unknown) => html`<div>${item}</div>`}></lr-virtual-list>`);
    await nextFrame();
    const first = el.scrollContainer;
    const root = el.shadowRoot!;
    const original = root.querySelector;
    let lookups = 0;
    root.querySelector = ((selector: string) => {
      lookups += 1;
      return original.call(root, selector);
    }) as typeof root.querySelector;
    try {
      for (let read = 0; read < 10; read += 1) el.scrollContainer;
    } finally {
      root.querySelector = original;
    }
    expect(el.scrollContainer === first).to.equal(true);
    expect(lookups).to.equal(0);
  });
});

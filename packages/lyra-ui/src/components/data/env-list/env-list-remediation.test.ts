import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import '../../lr-env-list.js';
import type { LyraEnvList } from '../../lr-env-list.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const entries = [
  { name: 'API_KEY', value: 'abc', secret: true },
  { name: 'MODE', value: '-1.5 (שלום)', secret: false },
];

describe('lr-env-list row actions', () => {
  it('uses the configured hover and pressed backgrounds on row actions', async () => {
    const el = await fixture<LyraEnvList>(html`<lr-env-list .entries=${entries}
      style="--lr-env-list-button-hover-bg: rgb(9, 18, 27); --lr-env-list-button-active-bg: rgb(27, 18, 9)"></lr-env-list>`);
    for (const part of ['reveal-button', 'copy-button']) {
      const button = el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${part}"]`)!;
      try {
        await hoverUntilMatched(button, `${part} never entered :hover`);
        await waitUntil(() => getComputedStyle(button).backgroundColor === 'rgb(9, 18, 27)');
        await sendMouse({ type: 'down' });
        await waitUntil(() => getComputedStyle(button).backgroundColor === 'rgb(27, 18, 9)');
        await sendMouse({ type: 'move', position: [0, 0] });
      } finally {
        await resetMouse();
      }
    }
  });

  it('isolates names and values from the surrounding direction', async () => {
    const el = await fixture<LyraEnvList>(html`<lr-env-list dir="rtl" .entries=${entries}></lr-env-list>`);
    const names = [...el.shadowRoot!.querySelectorAll('[part="name"] bdi')];
    const values = [...el.shadowRoot!.querySelectorAll('[part="value"] bdi')];
    expect(names.map((n) => n.getAttribute('dir'))).to.deep.equal(['auto', 'auto']);
    expect(values.map((n) => n.textContent)).to.deep.equal(['-1.5 (שלום)']);
  });

  it('keeps action buttons at the 24px target floor', async () => {
    const el = await fixture<LyraEnvList>(html`<lr-env-list .entries=${entries}></lr-env-list>`);
    for (const button of el.shadowRoot!.querySelectorAll<HTMLElement>('button')) {
      expect(button.getBoundingClientRect().height >= 24, button.getAttribute('part') ?? '').to.equal(true);
    }
  });

  it('reports every reveal it drops after entries or without-reveal change', async () => {
    const el = await fixture<LyraEnvList>(html`<lr-env-list .entries=${entries}></lr-env-list>`);
    const seen: string[] = [];
    el.addEventListener('lr-reveal-change', (event) => {
      const detail = (event as CustomEvent<{ envName: string; revealed: boolean }>).detail;
      seen.push(`${detail.envName}:${detail.revealed}`);
    });
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="reveal-button"]')!.click();
    await el.updateComplete;
    el.entries = [entries[1]!, entries[0]!];
    await el.updateComplete;
    expect(seen).to.deep.equal(['API_KEY:true', 'API_KEY:false']);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="reveal-button"]')!.click();
    await el.updateComplete;
    el.withoutReveal = true;
    await el.updateComplete;
    expect(seen).to.deep.equal(['API_KEY:true', 'API_KEY:false', 'API_KEY:true', 'API_KEY:false']);
  });

  it('shows visible copy feedback that clears itself', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } });
    try {
      const el = await fixture<LyraEnvList>(html`<lr-env-list .entries=${entries}></lr-env-list>`);
      const button = () => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="copy-button"]')!;
      button().click();
      await waitUntil(() => button().dataset['copyState'] === 'copied', 'no visible copy confirmation');
      expect(button().textContent!.trim()).to.equal('Copied!');
      await waitUntil(() => button().dataset['copyState'] === undefined, 'feedback never cleared', { timeout: 4000 });
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});

describe('lr-env-list entry ceiling', () => {
  it('tells the reader when entries beyond the ceiling are not shown', async () => {
    const many = Array.from({ length: 10_003 }, (_, i) => ({ name: `K${i}`, value: 'v' }));
    const el = await fixture<LyraEnvList>(html`<lr-env-list .entries=${many}></lr-env-list>`);
    const note = el.shadowRoot!.querySelector('[part="limit"]');
    expect(el.entries.length).to.equal(10_000);
    expect(el.shadowRoot!.querySelectorAll('[part="name"]').length).to.equal(500);
    expect(note?.textContent?.trim()).to.equal('Showing the first 500 entries; 9,503 more are not shown.');
  });

  it('caps rendered rows below the retention ceiling and clears the notice on a small assignment', async () => {
    const el = await fixture<LyraEnvList>(html`<lr-env-list .entries=${Array.from({ length: 501 }, (_, i) => ({ name: `K${i}`, value: 'v' }))}></lr-env-list>`);
    expect(el.shadowRoot!.querySelectorAll('[part="name"]').length).to.equal(500);
    expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Showing the first 500 entries; 1 more are not shown.');
    el.entries = entries;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
  });

  it('shows no notice within the ceiling', async () => {
    const el = await fixture<LyraEnvList>(html`<lr-env-list .entries=${entries}></lr-env-list>`);
    expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
  });

  it('treats a non-array assignment as empty without a notice', async () => {
    const el = await fixture<LyraEnvList>(html`<lr-env-list .entries=${null as unknown as []}></lr-env-list>`);
    expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
    expect(el.entries.length).to.equal(0);
  });
});

describe('lr-env-list keyed rows', () => {
  it('keeps a focused row action bound to its variable when the host prepends an entry', async () => {
    const el = await fixture<LyraEnvList>(html`<lr-env-list .entries=${entries}></lr-env-list>`);
    const copy = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="copy-button"]')[1]!;
    await focusByKeyboard(copy);
    el.entries = [{ name: 'FIRST', value: '1', secret: false }, ...entries];
    await el.updateComplete;
    const active = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(active?.getAttribute('aria-label')).to.contain('MODE');
  });
});

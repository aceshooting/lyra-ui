import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import { sendKeys } from '@web/test-runner-commands';
import './source-picker.js';
import type { LyraSourcePicker } from './source-picker.js';
import type { LyraInput } from '../../forms/input/input.js';

for (const focused of [false, true]) {
  it(`restores a visible tree entry when search is re-enabled (${focused ? 'focused' : 'outside focus'})`, async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><button>Outside</button><lr-source-picker
      .sources=${[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]}
    ></lr-source-picker></div>`);
    const el = wrapper.querySelector<LyraSourcePicker>('lr-source-picker')!;
    await el.updateComplete;
    const search = el.shadowRoot!.querySelector<LyraInput>('[part="search"]')!;
    search.focus();
    await sendKeys({ type: 'Alpha' });
    await el.updateComplete;
    el.withoutSearch = true;
    await el.updateComplete;
    const beta = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]')].find(row => row.textContent!.includes('Beta'))!;
    beta.click();
    beta.focus();
    await el.updateComplete;
    if (!focused) wrapper.querySelector('button')!.focus();
    el.withoutSearch = false;
    await el.updateComplete;
    const rows = el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.tabIndex).to.equal(0);
    expect(el.selectedSourceIds).to.deep.equal(['b']);
    const restoredSearch = el.shadowRoot!.querySelector<LyraInput>('[part="search"]')!;
    expect(restoredSearch.value).to.equal('Alpha');
    if (focused) expect(el.shadowRoot!.activeElement === rows[0]).to.equal(true);
    else {
      expect(document.activeElement === wrapper.querySelector('button')).to.equal(true);
      restoredSearch.focus();
      await sendKeys({ press: 'Tab' });
      // Select-all remains in the tab order before the tree when enabled.
      if (el.shadowRoot!.activeElement !== rows[0]) await sendKeys({ press: 'Tab' });
      expect(el.shadowRoot!.activeElement === rows[0]).to.equal(true);
    }
  });
}

const filterable = [
  { id: 'a', label: 'Alpha report' },
  { id: 'b', label: 'Beta notes' },
  { id: 'c', label: 'Alpha slides' },
  { id: 'd', label: 'Delta' },
];

async function typeFilter(el: LyraSourcePicker, text: string): Promise<void> {
  el.shadowRoot!.querySelector<LyraInput>('[part="search"]')!.focus();
  await sendKeys({ type: text });
  await el.updateComplete;
}

it('select-all while filtering selects and clears only the visible leaves', async () => {
  const el = await fixture<LyraSourcePicker>(
    html`<lr-source-picker .sources=${filterable} .selectedSourceIds=${['d']}></lr-source-picker>`
  );
  await typeFilter(el, 'alpha');
  const changes: string[][] = [];
  el.addEventListener('lr-sources-change', (event) =>
    changes.push([...(event as CustomEvent<{ selectedSourceIds: string[] }>).detail.selectedSourceIds].sort())
  );
  const selectAll = el.shadowRoot!.querySelector<HTMLElement & { checked: boolean }>('[part="select-all-control"]')!;
  expect(selectAll.checked).to.equal(false);
  selectAll.click();
  await el.updateComplete;
  expect(changes).to.deep.equal([['a', 'c', 'd']]);
  expect(selectAll.checked).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.contain('3 of 4');
  selectAll.click();
  await el.updateComplete;
  expect(changes[1]).to.deep.equal(['d']);
});

it('select-all with no visible match changes nothing', async () => {
  const el = await fixture<LyraSourcePicker>(
    html`<lr-source-picker .sources=${filterable} .selectedSourceIds=${['d']}></lr-source-picker>`
  );
  await typeFilter(el, 'zzz');
  let fired = 0;
  el.addEventListener('lr-sources-change', () => (fired += 1));
  el.shadowRoot!.querySelector<HTMLElement>('[part="select-all-control"]')!.click();
  await el.updateComplete;
  expect(fired).to.equal(0);
  expect(el.selectedSourceIds).to.deep.equal(['d']);
});

it('keeps every composed search-field event inside while typing and committing', async () => {
  const el = await fixture<LyraSourcePicker>(html`<lr-source-picker .sources=${filterable}></lr-source-picker>`);
  const leaked: string[] = [];
  for (const name of ['input', 'change', 'lr-input', 'lr-change', 'lr-clear', 'lr-input-settled'])
    el.addEventListener(name, () => leaked.push(name));
  await typeFilter(el, 'al');
  await sendKeys({ press: 'Tab' });
  expect(leaked).to.deep.equal([]);
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]')).to.have.length(2);
});

it('reports a selection change as lr-selection-change, then the deprecated lr-sources-change', async () => {
  const el = await fixture<LyraSourcePicker>(
    html`<lr-source-picker .sources=${filterable} .selectedSourceIds=${['d']}></lr-source-picker>`
  );
  const seen: string[] = [];
  for (const name of ['lr-selection-change', 'lr-sources-change'])
    el.addEventListener(name, (event) =>
      seen.push(`${name}:${[...(event as CustomEvent<{ selectedSourceIds: string[] }>).detail.selectedSourceIds]}`)
    );
  el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]')[0]!.click();
  expect(seen).to.deep.equal(['lr-selection-change:d,a', 'lr-sources-change:d,a']);
  seen.length = 0;
  el.sources = [{ id: 'd', label: 'Delta' }];
  await el.updateComplete;
  expect(seen).to.deep.equal(['lr-selection-change:d', 'lr-sources-change:d']);
});

it('draws a check for a checked row and a dash for a mixed row, also under forced colors', async () => {
  const el = await fixture<LyraSourcePicker>(html`<lr-source-picker
    .sources=${[{ id: 'f', label: 'Folder', children: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }] }, { id: 'z', label: 'Z' }, { id: 'w', label: 'W' }]}
    .selectedSourceIds=${['x', 'z']}
  ></lr-source-picker>`);
  const glyph = (state: string): { content: string; transform: string } => {
    const box = el.shadowRoot!.querySelector(`[part="checkbox"][data-state="${state}"]`)!;
    const style = getComputedStyle(box, '::after');
    return { content: style.content, transform: style.transform };
  };
  try {
    for (const forced of ['none', 'active'] as const) {
      await setForcedColors(forced);
      expect(glyph('false').content, `${forced}: unchecked`).to.equal('none');
      expect(glyph('true').content, `${forced}: checked`).to.not.equal('none');
      expect(glyph('mixed').content, `${forced}: mixed`).to.not.equal('none');
      expect(glyph('mixed').transform, `${forced}: dash is not the rotated check`).to.not.equal(glyph('true').transform);
    }
  } finally {
    await setForcedColors('none');
  }
});

it('renders the no-match state as the same lr-empty host as the no-data state', async () => {
  const el = await fixture<LyraSourcePicker>(html`<lr-source-picker .sources=${filterable}></lr-source-picker>`);
  await typeFilter(el, 'zzz');
  const empty = el.shadowRoot!.querySelector('[part="empty"]')!;
  expect(empty.localName).to.equal('lr-empty');
  expect(empty.getAttribute('heading')).to.equal('No matches');
});

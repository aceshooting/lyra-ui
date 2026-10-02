import { expect, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.class.js';

async function viewportField(fontSize: string, top: number, topLayer = false): Promise<{ frame: HTMLIFrameElement; select: LyraSelect }> {
  const frame = document.createElement('iframe');
  frame.title = 'Short currency field viewport';
  frame.style.cssText = 'inline-size:390px;block-size:600px;border:0;';
  const loaded = oneEvent(frame, 'load');
  const selectUrl = new URL('./select.ts', import.meta.url).href;
  const optionUrl = new URL('../combobox/option.ts', import.meta.url).href;
  frame.srcdoc = `<!doctype html><html><body style="margin:0"><script type="module">import '${selectUrl}'; import '${optionUrl}';</script></body></html>`;
  document.body.append(frame);
  await loaded;
  const doc = frame.contentDocument!;
  await frame.contentWindow!.customElements.whenDefined('lr-select');
  doc.documentElement.style.fontSize = fontSize;
  const select = doc.createElement('lr-select') as LyraSelect;
  select.label = 'Settlement currency';
  select.topLayer = topLayer;
  select.innerHTML = Array.from({ length: 30 }, (_, index) => `<lr-option value="${index}" sub="Long descriptive currency name">${index === 29 ? 'ZAR' : `AAA${index}`}</lr-option>`).join('');
  select.style.cssText = `position:absolute;inset-block-start:${top}px;inset-inline-start:20px;inline-size:350px;`;
  doc.body.append(select);
  await select.updateComplete;
  select.click();
  await waitUntil(() => select.open);
  await select.updateComplete;
  await waitUntil(() => Boolean(select.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!.style.getPropertyValue('--lr-positioner-available-block-size')));
  return { frame, select };
}

// Native focus can finish scrolling an iframe's embedding page on the next paint. Establish
// the pre-keyboard baseline after that focus work, without changing any scroll position.
async function settleFocusScroll(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

for (const scenario of [
  { name: 'the ordinary list limit below a top trigger', font: '100%', top: 20, topLayer: false },
  { name: 'doubled text below a top trigger', font: '200%', top: 20, topLayer: false },
  { name: 'doubled text above a bottom trigger', font: '200%', top: 480, topLayer: false },
  { name: 'a doubled-text top-layer list', font: '200%', top: 20, topLayer: true },
]) {
  it(`lr-select keeps ${scenario.name} within its short owning viewport`, async () => {
    const { frame, select } = await viewportField(scenario.font, scenario.top, scenario.topLayer);
    try {
      const list = select.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
      await waitUntil(() => list.getBoundingClientRect().height > 0);
      const bounds = list.getBoundingClientRect();
      expect(bounds.left).to.be.at.least(-1);
      expect(bounds.right).to.be.at.most(frame.contentWindow!.innerWidth + 1);
      expect(bounds.top).to.be.at.least(-1);
      expect(bounds.bottom).to.be.at.most(frame.contentWindow!.innerHeight + 1);
      expect(list.scrollHeight).to.be.greaterThan(list.clientHeight);
      expect(list.scrollWidth).to.be.at.most(list.clientWidth + 1);
      if (scenario.font === '100%') expect(bounds.height).to.be.at.most(289);
      if (scenario.topLayer) expect(list.matches(':popover-open')).to.equal(true);
      await focusByKeyboard(select);
      if (!select.open) {
        await sendKeys({ press: 'ArrowDown' });
        await waitUntil(() => select.open);
      }
      await settleFocusScroll();
      const outerScroll = window.scrollY;
      const owningScroll = frame.contentDocument!.scrollingElement!.scrollTop;
      await sendKeys({ press: 'End' });
      await select.updateComplete;
      const last = select.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-value="29"]')!;
      expect(last.getBoundingClientRect().bottom).to.be.at.most(list.getBoundingClientRect().bottom + 1);
      expect(window.scrollY).to.equal(outerScroll);
      expect(frame.contentDocument!.scrollingElement!.scrollTop).to.equal(owningScroll);
      expect(select.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');
      expect(last.getBoundingClientRect().top).to.be.at.least(list.getBoundingClientRect().top - 1);
      await sendKeys({ press: 'Enter' });
      expect(select.value).to.equal('29');
      if (scenario.font === '100%') {
        await sendKeys({ press: 'ArrowDown' });
        await waitUntil(() => select.open);
        await sendKeys({ press: 'Home' });
        await sendKeys({ press: 'z' });
        await select.updateComplete;
        expect(last.getBoundingClientRect().bottom).to.be.at.most(list.getBoundingClientRect().bottom + 1);
        expect(last.getBoundingClientRect().top).to.be.at.least(list.getBoundingClientRect().top - 1);
        expect(window.scrollY).to.equal(outerScroll);
        expect(frame.contentDocument!.scrollingElement!.scrollTop).to.equal(owningScroll);
      }
    } finally { select.remove(); frame.remove(); }
  });
}

it('lr-select scrolls open code typeahead into view without moving page scroll or focus', async () => {
  const { frame, select } = await viewportField('100%', 20);
  try {
    await focusByKeyboard(select);
    if (!select.open) { await sendKeys({ press: 'ArrowDown' }); await waitUntil(() => select.open); }
    const list = select.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    await settleFocusScroll();
    const outerScroll = window.scrollY;
    const owningScroll = frame.contentDocument!.scrollingElement!.scrollTop;
    await sendKeys({ press: 'z' });
    await select.updateComplete;
    const active = select.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-value="29"]')!;
    expect(active.getBoundingClientRect().bottom).to.be.at.most(list.getBoundingClientRect().bottom + 1);
    expect(active.getBoundingClientRect().top).to.be.at.least(list.getBoundingClientRect().top - 1);
    expect(window.scrollY).to.equal(outerScroll);
    expect(frame.contentDocument!.scrollingElement!.scrollTop).to.equal(owningScroll);
    expect(select.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');
    await sendKeys({ press: 'Enter' });
    expect(select.value).to.equal('29');
  } finally { select.remove(); frame.remove(); }
});


it('lr-select reveals grouped RTL rows under CSS zoom using only the listbox scroll', async () => {
  const { frame, select } = await viewportField('100%', 20);
  try {
    const doc = frame.contentDocument!;
    doc.documentElement.dir = 'rtl';
    doc.body.style.zoom = '1.25';
    const scroller = doc.createElement('div');
    scroller.style.cssText = 'position:relative;height:300px;overflow:auto';
    const spacer = doc.createElement('div');
    spacer.style.height = '800px';
    doc.body.append(scroller);
    scroller.append(spacer, select);
    scroller.scrollTop = 10;
    select.topLayer = true;
    select.style.inlineSize = '270px';
    Array.from(select.children).forEach((option, index) => option.setAttribute('group', `Group ${Math.floor(index / 10)}`));
    await waitUntil(() => select.shadowRoot!.querySelectorAll('[role="group"]').length === 3);
    await focusByKeyboard(select);
    if (!select.open) { await sendKeys({ press: 'ArrowDown' }); await waitUntil(() => select.open); }
    const list = select.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    await settleFocusScroll();
    const outerScroll = window.scrollY;
    const owningScroll = frame.contentDocument!.scrollingElement!.scrollTop;
    const ancestorScroll = scroller.scrollTop;
    for (const [key, value] of [['End', '29'], ['Home', '0']] as const) {
      await sendKeys({ press: key });
      await select.updateComplete;
      const row = select.shadowRoot!.querySelector<HTMLElement>(`[part="option"][data-value="${value}"]`)!;
      expect(row.getBoundingClientRect().top).to.be.at.least(list.getBoundingClientRect().top - 1);
      expect(row.getBoundingClientRect().bottom).to.be.at.most(list.getBoundingClientRect().bottom + 1);
      expect(select.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');
      expect(window.scrollY).to.equal(outerScroll);
      expect(frame.contentDocument!.scrollingElement!.scrollTop).to.equal(owningScroll);
      expect(scroller.scrollTop).to.equal(ancestorScroll);
    }
  } finally { select.remove(); frame.remove(); }
});

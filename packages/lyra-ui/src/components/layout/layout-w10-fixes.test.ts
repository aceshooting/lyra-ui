import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../lr-card.js';
import '../lr-carousel.js';
import '../lr-carousel-item.js';
import '../lr-dashboard-grid.js';
import '../lr-tab-group.js';
import '../lr-tab.js';
import '../lr-tab-panel.js';
import '../lr-virtual-list.js';
import type { LyraCard } from '../lr-card.js';
import type { LyraCarousel } from '../lr-carousel.js';
import type { LyraDashboardGrid } from '../lr-dashboard-grid.js';
import type { LyraVirtualList } from '../lr-virtual-list.js';

it('paints the active-item-id row with a visible background that a token overrides', async () => {
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="30" style="--lr-virtual-list-height:120px"
    .items=${['a', 'b', 'c']} .activeItemId=${'1'} .keyFunction=${(_: unknown, index: number) => String(index)}
    .renderItem=${(item: unknown) => html`${item}`}></lr-virtual-list>`);
  const row = (): HTMLElement => list.shadowRoot!.querySelector<HTMLElement>('[part="row"][aria-current="true"]')!;
  await waitUntil(() => row() !== null);
  const other = list.shadowRoot!.querySelector<HTMLElement>('[part="row"][aria-current="false"]')!;
  expect(getComputedStyle(row()).backgroundColor).not.to.equal(getComputedStyle(other).backgroundColor);
  list.style.setProperty('--lr-virtual-list-active-row-bg', 'transparent');
  expect(getComputedStyle(row()).backgroundColor).to.equal(getComputedStyle(other).backgroundColor);
});

it('does not write state from updated() when the active slide is removed', async () => {
  const el = await fixture<LyraCarousel>(html`<lr-carousel>
    <lr-carousel-item>A</lr-carousel-item><lr-carousel-item>B</lr-carousel-item><lr-carousel-item>C</lr-carousel-item>
  </lr-carousel>`);
  el.currentSlide = 2;
  await el.updateComplete;
  const events: number[] = [];
  el.addEventListener('lr-slide-change', (e) => events.push((e as CustomEvent).detail.index));
  el.querySelectorAll('lr-carousel-item')[2]!.remove();
  await waitUntil(() => el.currentSlide === 1);
  await el.updateComplete;
  expect(el.isUpdatePending).to.equal(false);
  expect(events).to.deep.equal([1]);
});

describe('lr-card text selection', () => {
  for (const [name, markup] of [
    ['actionable', html`<lr-card actionable><p id="t">Selectable copy</p></lr-card>`],
    ['linked', html`<lr-card href="#x"><p id="t">Selectable copy</p></lr-card>`],
  ] as const) {
    it(`ignores a click that ends a text selection (${name})`, async () => {
      const card = await fixture<LyraCard>(markup);
      let activations = 0;
      card.addEventListener('lr-card-activate', () => activations++);
      const text = card.querySelector('#t')!;
      getSelection()!.selectAllChildren(text);
      text.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
      getSelection()!.removeAllRanges();
      expect(activations).to.equal(0);
      if (name === 'actionable') {
        text.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
        expect(activations).to.equal(1);
      }
    });
  }
});

it('resizes with the visual arrow direction under RTL', async () => {
  const el = await fixture<LyraDashboardGrid>(html`<div dir="rtl"><lr-dashboard-grid cells-resizable></lr-dashboard-grid></div>`)
    .then((host) => host.querySelector<LyraDashboardGrid>('lr-dashboard-grid')!);
  el.layout = [{ cellId: 'a', x: 0, y: 0, w: 2, h: 1 }];
  await el.updateComplete;
  const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
  const widths: number[] = [];
  el.addEventListener('lr-layout-change', (event) => widths.push(event.detail.layout[0]!.w));
  const press = (key: string): void => {
    cell.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
  };
  press('ArrowLeft');
  press('ArrowRight');
  expect(widths).to.deep.equal([3, 1]);
});

it('keeps the selected tab overlap in step with a themed track width', async () => {
  const group = await fixture<HTMLElement>(html`<lr-tab-group style="--track-width: 3px">
    <lr-tab panel="a">A</lr-tab><lr-tab-panel name="a">A</lr-tab-panel></lr-tab-group>`);
  const tab = group.shadowRoot!.querySelector<HTMLElement>('[part="tab"]')!;
  expect(getComputedStyle(tab).marginBlockEnd).to.equal('-3px');
});

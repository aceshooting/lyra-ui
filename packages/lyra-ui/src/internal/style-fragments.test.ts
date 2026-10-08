import { expect, fixture, html } from '@open-wc/testing';
import { scrollOverflowFade } from './scroll-overflow.styles.js';
import '../components/agent-tools/eval-dataset/eval-dataset.js';
import '../components/retrieval/research-progress/research-progress.js';
import type { LyraInput } from '../components/forms/input/input.class.js';
import type { LyraEvalDataset } from '../components/agent-tools/eval-dataset/eval-dataset.class.js';
import type { LyraResearchProgress } from '../components/retrieval/research-progress/research-progress.class.js';

it('keeps the composed dataset search field surface and shared target floor themeable', async () => {
  const dataset = await fixture<LyraEvalDataset>(html`<lr-eval-dataset searchable style="--lr-theme-icon-button-size: 30px; --lr-input-fill: rgb(12, 23, 34); --lr-input-border-color: rgb(34, 45, 56)"></lr-eval-dataset>`);
  const host = dataset.shadowRoot!.querySelector<LyraInput>('[part="search-input"]')!;
  await host.updateComplete;
  const field = host.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
  expect(getComputedStyle(field).backgroundColor).to.equal('rgb(12, 23, 34)');
  expect(getComputedStyle(field).borderTopColor).to.equal('rgb(34, 45, 56)');
  host.value = 'query';
  await host.updateComplete;
  const clear = host.shadowRoot!.querySelector<HTMLElement>('[part="clear-button"]')!;
  expect(getComputedStyle(clear).minInlineSize).to.equal('30px');
  expect(getComputedStyle(clear).minBlockSize).to.equal('30px');
});

it('keeps research rows native and shares their bounded layout without changing public parts', async () => {
  const progress = await fixture<LyraResearchProgress>(html`<lr-research-progress .steps=${[
    { id: 'a', label: 'Find sources', status: 'running' },
  ]} style="--lr-space-s: 13px"></lr-research-progress>`);
  const row = progress.shadowRoot!.querySelector<HTMLElement>('[part="step"]')!;
  expect(row.localName).to.equal('li');
  expect(getComputedStyle(row).display).to.equal('grid');
  expect(getComputedStyle(row).gap).to.equal('13px');
  expect(getComputedStyle(row).paddingBlockStart).to.equal('13px');
});

it('preserves both logical fade edges for custom track selectors', async () => {
  const sheet = scrollOverflowFade('.track[data-scroll-overflow]', '.rtl .track[data-scroll-overflow]');
  const container = await fixture<HTMLDivElement>(html`<div style="--lr-mask-opaque: black; --lr-scroll-fade-size: 10px">
    <style>${sheet.cssText}</style>
    <div class="track" data-scroll-overflow data-scroll-end></div>
  </div>`);
  const track = container.querySelector<HTMLElement>('.track')!;
  const ltrEnd = getComputedStyle(track).maskImage;
  expect(ltrEnd).not.to.equal('none');
  container.classList.add('rtl');
  const rtlEnd = getComputedStyle(track).maskImage;
  expect(rtlEnd).not.to.equal(ltrEnd);
  track.removeAttribute('data-scroll-end');
  track.setAttribute('data-scroll-start', '');
  expect(getComputedStyle(track).maskImage).to.equal(ltrEnd);
});

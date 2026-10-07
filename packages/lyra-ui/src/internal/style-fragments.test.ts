import { expect, fixture, html } from '@open-wc/testing';
import { scrollOverflowFade } from './scroll-overflow.styles.js';
import '../components/agent-tools/eval-dataset/eval-dataset.js';
import '../components/retrieval/research-progress/research-progress.js';
import type { LyraEvalDataset } from '../components/agent-tools/eval-dataset/eval-dataset.class.js';
import type { LyraResearchProgress } from '../components/retrieval/research-progress/research-progress.class.js';

it('keeps a native dataset field surface and shared target floor themeable', async () => {
  const dataset = await fixture<LyraEvalDataset>(html`<lr-eval-dataset searchable style="--lr-icon-button-size: 47px; --lr-color-surface: rgb(12, 23, 34); --lr-color-border: rgb(34, 45, 56)"></lr-eval-dataset>`);
  const input = dataset.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
  expect(getComputedStyle(input).backgroundColor).to.equal('rgb(12, 23, 34)');
  expect(getComputedStyle(input).borderTopColor).to.equal('rgb(34, 45, 56)');
  input.value = 'query';
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  await dataset.updateComplete;
  const clear = dataset.shadowRoot!.querySelector<HTMLElement>('[part="search-clear"]')!;
  expect(getComputedStyle(clear).minInlineSize).to.equal('47px');
  expect(getComputedStyle(clear).minBlockSize).to.equal('47px');
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

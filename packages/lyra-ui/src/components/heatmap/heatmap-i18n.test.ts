import { fixture, expect, html } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';

it('localizes the built-in value label in the legend and generated accessible name', async () => {
  const el = (await fixture(html`
    <lyra-heatmap
      .values=${[[1, 2]]}
      .rowLabels=${['A']}
      .colLabels=${['B', 'C']}
      .strings=${{ heatmapValueLabel: 'valeur' }}
    ></lyra-heatmap>
  `)) as LyraHeatmap;
  const legendLabel = el.shadowRoot!.querySelector('[part="legend"] > span:last-of-type')!;

  expect(legendLabel.textContent).to.equal('valeur');
  expect(el.getAttribute('aria-label')).to.contain('valeur range 1–2');
});

it('keeps an explicitly customized value-label verbatim', async () => {
  const el = (await fixture(html`
    <lyra-heatmap
      value-label="requests"
      .values=${[[1, 2]]}
      .rowLabels=${['A']}
      .colLabels=${['B', 'C']}
    ></lyra-heatmap>
  `)) as LyraHeatmap;
  const legendLabel = el.shadowRoot!.querySelector('[part="legend"] > span:last-of-type')!;

  expect(legendLabel.textContent).to.equal('requests');
  expect(el.getAttribute('aria-label')).to.contain('requests range 1–2');
});

it('formats legend ranges with the effective locale', async () => {
  const el = (await fixture(html`
    <lyra-heatmap
      locale="de-DE"
      .values=${[[1234.5, 2345.6]]}
      .rowLabels=${['A']}
      .colLabels=${['B', 'C']}
    ></lyra-heatmap>
  `)) as LyraHeatmap;

  expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('1.234,5');
  expect(el.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent).to.equal('2.345,6');
  expect(el.getAttribute('aria-label')).to.contain('value range 1.234,5–2.345,6');
});

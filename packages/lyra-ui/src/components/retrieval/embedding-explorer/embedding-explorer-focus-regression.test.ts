import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraEmbeddingExplorer } from './embedding-explorer.class.js';
import './embedding-explorer.js';

for (const initiallySelected of ['', 'p1']) {
  it(`preserves focused identity when an off-sample selection is ${initiallySelected ? 'removed' : 'inserted'}`, async () => {
    const points = Array.from({ length: 12 }, (_, index) => ({ id: `p${index}`, x: index, y: index }));
    const el = await fixture<LyraEmbeddingExplorer>(html`
      <lr-embedding-explorer
        .points=${points}
        max-rendered-points="4"
        .selectedPointId=${initiallySelected}
      ></lr-embedding-explorer>
    `);
    const target = el.shadowRoot!.querySelector('[data-id="p11"]')!;
    await focusByKeyboard(target as unknown as HTMLElement);
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('p11');
    el.selectedPointId = initiallySelected ? '' : 'p1';
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('p11');
    expect(el.shadowRoot!.querySelector('[part="point"][tabindex="0"]')?.getAttribute('data-id')).to.equal('p11');
  });
}

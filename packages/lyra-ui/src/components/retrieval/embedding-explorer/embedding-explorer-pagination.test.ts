import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './embedding-explorer.js';
import type { LyraEmbeddingExplorer } from './embedding-explorer.class.js';
import type { LyraPointColumns } from '../../../internal/typed-columns.js';

function columns(count: number): LyraPointColumns {
  return { ids: Array.from({ length: count }, (_, index) => `point-${index}`),
    x: Float32Array.from({ length: count }, (_, index) => index), y: new Float32Array(count) };
}

it('pages typed columns through native controls, preserves row identity, and clamps after shrinking data', async () => {
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .pointColumns=${columns(405)}></lr-embedding-explorer>`);
  const buttons = () => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="page-button"]')];
  const ids = () => [...el.shadowRoot!.querySelectorAll('[part="point"]')].map(point => point.getAttribute('data-id'));
  expect(buttons().map(button => button.disabled)).to.deep.equal([true, false]);
  expect(ids()).to.deep.equal(Array.from({ length: 200 }, (_, index) => `point-${index}`));
  buttons()[1]!.click(); await el.updateComplete;
  expect(ids()).to.deep.equal(Array.from({ length: 200 }, (_, index) => `point-${index + 200}`));
  expect(buttons().map(button => button.disabled)).to.deep.equal([false, false]);
  buttons()[1]!.click(); await el.updateComplete;
  expect(ids()).to.deep.equal(['point-400', 'point-401', 'point-402', 'point-403', 'point-404']);
  expect(buttons().map(button => button.disabled)).to.deep.equal([false, true]);
  const selected = oneEvent(el, 'lr-point-select');
  el.shadowRoot!.querySelector('[data-id="point-404"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect((await selected).detail).to.include({ id: 'point-404', index: 404 });
  buttons()[0]!.click(); await el.updateComplete;
  expect(ids()[0]).to.equal('point-200');
  buttons()[1]!.click(); await el.updateComplete;
  el.pointColumns = columns(3); await el.updateComplete;
  expect(ids()).to.deep.equal(['point-0', 'point-1', 'point-2']);
  expect(buttons().map(button => button.disabled)).to.deep.equal([true, true]);
  expect(el.shadowRoot!.querySelectorAll('[part="point"][tabindex="0"]').length).to.equal(1);
});

it('ignores retained pagination controls from replaced data and after disconnect', async () => {
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .pointColumns=${columns(405)}></lr-embedding-explorer>`);
  const obsolete = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="page-button"]')[1]!;
  el.pointColumns = undefined; await el.updateComplete;
  el.pointColumns = columns(205); await el.updateComplete;
  obsolete.click(); await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="point"]')!.getAttribute('data-id')).to.equal('point-0');
  const current = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="page-button"]')[1]!;
  const parent = el.parentElement!;
  el.remove(); current.click(); await el.updateComplete;
  parent.append(el); await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="point"]')!.getAttribute('data-id')).to.equal('point-0');
  current.click(); await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="point"]')!.getAttribute('data-id')).to.equal('point-200');
});

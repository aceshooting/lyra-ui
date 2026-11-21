import { expect, fixture, html } from '@open-wc/testing';
import { layoutScale } from './layout-scale.js';

describe('layout scale edges', () => {
  it('reports identity for a disconnected element', () => {
    const el = document.createElement('div');
    expect(layoutScale(el)).to.deep.equal({ x: 1, y: 1 });
  });

  it('reports identity when reading geometry throws', async () => {
    const el = await fixture<HTMLDivElement>(html`<div style="width: 10px; height: 10px"></div>`);
    el.getBoundingClientRect = () => { throw new Error('detached'); };
    expect(layoutScale(el)).to.deep.equal({ x: 1, y: 1 });
  });

  it('falls back to 1 for a collapsed visual scale', async () => {
    const el = await fixture<HTMLDivElement>(html`<div style="width: 10px; height: 10px; transform: scale(0)"></div>`);
    expect(layoutScale(el)).to.deep.equal({ x: 1, y: 1 });
  });
});

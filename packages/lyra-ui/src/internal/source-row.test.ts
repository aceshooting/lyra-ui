import { expect, fixture, html } from '@open-wc/testing';
import { findSourceRow } from './source-row.js';

describe('findSourceRow', () => {
  it('matches a key literally, including selector punctuation', async () => {
    const root = await fixture<HTMLDivElement>(html`<div>
      <button data-source-key="a"></button>
      <button data-source-key='x"] , [id="y'></button>
      <button data-source-key="a b"></button>
    </div>`);
    const buttons = root.querySelectorAll('button');
    expect(findSourceRow(root, 'a') === buttons[0]).to.equal(true);
    expect(findSourceRow(root, 'x"] , [id="y') === buttons[1]).to.equal(true);
    expect(findSourceRow(root, 'a b') === buttons[2]).to.equal(true);
    expect(findSourceRow(root, 'missing')).to.equal(undefined);
  });
});

import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-button-group.js';
import '../../lr-button.js';

describe('lr-button-group --lr-button-group-justify', () => {
  it('spreads the buttons across a widened host and keeps them packed at the start unset', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 400px">
      <lr-button-group style="display: flex"><lr-button>A</lr-button><lr-button>B</lr-button></lr-button-group>
      <lr-button-group style="display: flex; --lr-button-group-justify: space-between"><lr-button>A</lr-button><lr-button>B</lr-button></lr-button-group>
    </div>`);
    const [plain, spread] = Array.from(wrap.querySelectorAll('lr-button-group'));
    const edges = (group: Element) => {
      const host = group.getBoundingClientRect();
      const buttons = Array.from(group.querySelectorAll('lr-button')).map((b) => b.getBoundingClientRect());
      return { start: Math.round(buttons[0]!.left - host.left), end: Math.round(host.right - buttons[1]!.right) };
    };
    expect(edges(spread!)).to.deep.equal({ start: 0, end: 0 });
    expect(edges(plain!).start).to.equal(0);
    expect(edges(plain!).end).to.be.greaterThan(100);
  });
});

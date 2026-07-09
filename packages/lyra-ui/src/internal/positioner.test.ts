import { fixture, expect, html } from '@open-wc/testing';
import { place } from './positioner.js';

it('positions the popup relative to the anchor', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:100px; left:100px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const a = wrap.querySelector('#a') as HTMLElement;
  const p = wrap.querySelector('#p') as HTMLElement;

  const stop = place(a, p);
  // autoUpdate schedules an async computePosition; wait a frame for it to land.
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(p.style.position).to.equal('fixed');
  expect(p.style.left).to.not.be.empty;
  expect(p.style.top).to.not.be.empty;
  stop();
});

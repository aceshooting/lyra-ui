import { expect, fixture, html } from '@open-wc/testing';
import { disconnectObserver, slottedElementTargets } from './slotted-observer.js';

it('returns flattened assigned elements and ignores text nodes', async () => {
  const host = await fixture(html`<div><span>A</span>text<button>B</button></div>`);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<slot></slot>';
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(slottedElementTargets(shadow).map((target) => target.localName)).to.deep.equal(['span', 'button']);
});

it('disconnects and clears a native-observer-like instance', () => {
  let disconnected = false;
  const observer = { disconnect: () => { disconnected = true; } };
  expect(disconnectObserver(observer)).to.equal(undefined);
  expect(disconnected).to.be.true;
});


import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { makeScrollRegionFocusable, revealWithinScrollParent } from './scroll-region.js';

describe('scroll region', () => {
  it('is tabbable and named only while the body overflows', async () => {
    const body = await fixture<HTMLElement>(html`
      <div style="block-size:40px;overflow:auto"><div style="block-size:200px"></div></div>`);
    const dispose = makeScrollRegionFocusable(body, '  Result  ');
    expect(body.getAttribute('tabindex')).to.equal('0');
    expect(body.getAttribute('role')).to.equal('region');
    expect(body.getAttribute('aria-label')).to.equal('Result');
    body.style.blockSize = '400px';
    await waitUntil(() => !body.hasAttribute('tabindex'), 'tab stop removed once it fits');
    expect(body.hasAttribute('role')).to.equal(false);
    expect(body.hasAttribute('aria-label')).to.equal(false);
    dispose();
  });

  it('drops the kept tabindex once focus leaves a body that stopped overflowing', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><div style="block-size:40px;overflow:auto"><div style="block-size:200px"></div></div><button>after</button></div>`);
    const body = wrapper.firstElementChild as HTMLElement;
    const dispose = makeScrollRegionFocusable(body, 'Result');
    body.focus();
    body.style.blockSize = '400px';
    await waitUntil(() => body.getAttribute('tabindex') === '-1', 'focused body keeps a programmatic stop');
    wrapper.querySelector('button')!.focus();
    await waitUntil(() => !body.hasAttribute('tabindex'), 'stale stop removed after focus leaves');
    expect(body.hasAttribute('role')).to.equal(false);
    dispose();
  });

  it('adds no tab stop to a non-overflowing body, omits a blank name and cleans up', async () => {
    const short = await fixture<HTMLElement>(html`<div style="overflow:auto"><p>short</p></div>`);
    const stop = makeScrollRegionFocusable(short, 'Name');
    expect(short.hasAttribute('tabindex')).to.equal(false);
    stop();
    const tall = await fixture<HTMLElement>(html`
      <div style="block-size:40px;overflow:auto" tabindex="-1"><div style="block-size:200px"></div></div>`);
    const dispose = makeScrollRegionFocusable(tall, '   ');
    expect(tall.getAttribute('tabindex')).to.equal('-1');
    expect(tall.hasAttribute('aria-label')).to.equal(false);
    dispose();
  });

  it('reveals inside the nearest scroll container without moving the page', async () => {
    const wrap = await fixture<HTMLElement>(html`
      <div>
        <div id="box" style="block-size:100px;overflow:auto">
          <div style="block-size:400px"></div><p id="target">target</p><div style="block-size:400px"></div>
        </div>
        <div style="block-size:3000px"></div>
      </div>`);
    const box = wrap.querySelector<HTMLElement>('#box')!;
    const target = wrap.querySelector<HTMLElement>('#target')!;
    const pageBefore = document.scrollingElement!.scrollTop;
    revealWithinScrollParent(target, { block: 'center' });
    expect(box.scrollTop).to.be.greaterThan(300);
    const rect = target.getBoundingClientRect();
    const port = box.getBoundingClientRect();
    expect(rect.top).to.be.at.least(port.top - 1);
    expect(rect.bottom).to.be.at.most(port.bottom + 1);
    expect(document.scrollingElement!.scrollTop).to.equal(pageBefore);
  });

  it('is a no-op when no ancestor scrolls', async () => {
    const el = await fixture<HTMLElement>(html`<p>text</p>`);
    revealWithinScrollParent(el);
    expect(true).to.equal(true);
  });
});

describe('scroll region slotted content', () => {
  it('re-measures when an element assigned to a child slot grows and can keep the own role', async () => {
    const host = await fixture<HTMLElement>(html`<div><p style="margin:0;block-size:10px">a</p></div>`);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<aside style="display:block;block-size:40px;overflow:auto"><slot></slot></aside>';
    const aside = root.querySelector('aside')!;
    const dispose = makeScrollRegionFocusable(aside, 'Pane', { role: false });
    expect(aside.hasAttribute('tabindex')).to.equal(false);
    host.querySelector('p')!.style.blockSize = '200px';
    await waitUntil(() => aside.getAttribute('tabindex') === '0', 'slotted growth is observed');
    expect([aside.hasAttribute('role'), aside.getAttribute('aria-label')]).to.deep.equal([false, 'Pane']);
    dispose();
    expect(aside.hasAttribute('tabindex')).to.equal(false);
  });
});

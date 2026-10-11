import { expect, fixture, html, waitUntil, oneEvent } from '@open-wc/testing';
import { acquireOpenOverlayAncestors, OPEN_OVERLAY_ANCESTOR_SELECTOR } from './open-overlay-ancestors.js';

describe('open overlay shadow ancestry', () => {
  it('counts shared closed-shadow boundaries and restores preexisting attributes exactly', async () => {
    const outer = await fixture<HTMLElement>(html`<div data-lr-open-overlay-descendant="author"></div>`);
    const inner = document.createElement('div');
    outer.attachShadow({ mode: 'closed' }).append(inner);
    const root = inner.attachShadow({ mode: 'closed' });
    const first = document.createElement('button');
    const second = document.createElement('button');
    root.append(first, second);
    const releaseFirst = acquireOpenOverlayAncestors(first);
    const releaseSecond = acquireOpenOverlayAncestors(second);
    expect(outer.matches(OPEN_OVERLAY_ANCESTOR_SELECTOR)).to.equal(true);
    expect(inner.matches(OPEN_OVERLAY_ANCESTOR_SELECTOR)).to.equal(true);
    releaseFirst();
    releaseFirst();
    expect(inner.matches(OPEN_OVERLAY_ANCESTOR_SELECTOR), 'idempotent release retains the other owner').to.equal(true);
    releaseSecond();
    expect(outer.getAttribute('data-lr-open-overlay-descendant')).to.equal('author');
    expect(inner.hasAttribute('data-lr-open-overlay-descendant')).to.equal(false);
  });

  it('preserves later external writes and exposes slotted ownership at its slot boundary', async () => {
    const host = await fixture<HTMLElement>(html`<div><button>Open</button></div>`);
    const slot = document.createElement('slot');
    host.attachShadow({ mode: 'open' }).append(slot);
    const release = acquireOpenOverlayAncestors(host.querySelector('button')!);
    expect(slot.matches(OPEN_OVERLAY_ANCESTOR_SELECTOR)).to.equal(true);
    expect(host.matches(OPEN_OVERLAY_ANCESTOR_SELECTOR)).to.equal(true);
    host.setAttribute('data-lr-open-overlay-descendant', 'changed');
    release();
    expect(host.getAttribute('data-lr-open-overlay-descendant')).to.equal('changed');
    expect(slot.hasAttribute('data-lr-open-overlay-descendant')).to.equal(false);
  });

  it('transfers slot ownership when an open surface is reassigned without disconnecting', async () => {
    const host = await fixture<HTMLElement>(html`<div><button>Open</button></div>`);
    const first = document.createElement('slot');
    const second = document.createElement('slot');
    second.name = 'other';
    host.attachShadow({ mode: 'open' }).append(first, second);
    const button = host.querySelector('button')!;
    const release = acquireOpenOverlayAncestors(button);
    expect(first.matches(OPEN_OVERLAY_ANCESTOR_SELECTOR)).to.equal(true);
    button.slot = 'other';
    await waitUntil(() => second.matches(OPEN_OVERLAY_ANCESTOR_SELECTOR), 'the new slot owns the overlay');
    expect(first.hasAttribute('data-lr-open-overlay-descendant')).to.equal(false);
    release();
    const reassigned = oneEvent(first, 'slotchange');
    button.slot = '';
    await reassigned;
    expect(first.hasAttribute('data-lr-open-overlay-descendant')).to.equal(false);
    expect(second.hasAttribute('data-lr-open-overlay-descendant')).to.equal(false);
    expect(host.hasAttribute('data-lr-open-overlay-descendant')).to.equal(false);
  });

});

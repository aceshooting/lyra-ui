import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './toast.js';
import type { LyraToast } from './toast.js';

describe('lr-toast in a document without a browsing context', () => {
  it('releases its items once it leaves a viewless document', async () => {
    const region = await fixture<LyraToast>(html`<lr-toast></lr-toast>`);
    const first = await region.create({ message: 'First', duration: 0 });
    const second = await region.create({ message: 'Second', duration: 0 });
    await waitUntil(() => first.hasAttribute('data-visible') && second.hasAttribute('data-visible'), 'both visible');

    const inert = document.implementation.createHTMLDocument('inert');
    inert.body.append(region);
    expect(region.ownerDocument === inert).to.equal(true);
    expect(first.parentElement === region).to.equal(true);

    region.remove();
    await Promise.resolve();
    await Promise.resolve();

    expect(first.parentElement === null).to.equal(true);
    expect(second.parentElement === null).to.equal(true);
    expect(region.children.length).to.equal(0);
  });
});

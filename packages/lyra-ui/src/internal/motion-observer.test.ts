import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { observeReducedMotion } from './motion-observer.js';

describe('shared scoped motion observation', () => {
  for (const legacy of [false, true]) {
    it(`tracks ancestor/OS changes and releases the last ${legacy ? 'legacy' : 'modern'} listener`, async () => {
      const original = window.matchMedia;
      const listeners = new Set<() => void>();
      let matches = false;
      const query = {
        get matches() { return matches; },
        media: '(prefers-reduced-motion: reduce)',
        ...(legacy ? {
          addListener: (callback: () => void) => listeners.add(callback),
          removeListener: (callback: () => void) => listeners.delete(callback),
        } : {
          addEventListener: (_name: string, callback: () => void) => listeners.add(callback),
          removeEventListener: (_name: string, callback: () => void) => listeners.delete(callback),
        }),
      // Deliberately omit the other listener API to exercise the compatibility branch.
      } as unknown as MediaQueryList;
      window.matchMedia = value => value === query.media ? query : original.call(window, value);
      const scope = await fixture<HTMLElement>(html`<section><div></div><div></div></section>`);
      const values: boolean[][] = [[], []];
      const stop = [...scope.children].map((element, index) => observeReducedMotion(element, value => values[index]!.push(value)));
      try {
        expect(listeners.size).to.equal(1);
        expect(values).to.deep.equal([[], []]);
        scope.setAttribute('data-lr-motion', 'reduce');
        await waitUntil(() => values.every(value => value.at(-1) === true));
        scope.firstElementChild!.setAttribute('data-lr-motion', 'system');
        await waitUntil(() => values[0]!.at(-1) === false);
        expect(values[1]).to.deep.equal([true]);
        matches = true;
        for (const changed of listeners) changed();
        expect(values[0]!.at(-1)).to.equal(true);
        stop[0]!();
        expect(listeners.size).to.equal(1);
        stop[1]!();
        expect(listeners.size).to.equal(0);
        const counts = values.map(value => value.length);
        scope.removeAttribute('data-lr-motion');
        await Promise.resolve();
        expect(values.map(value => value.length)).to.deep.equal(counts);
      } finally {
        stop.forEach(release => release());
        window.matchMedia = original;
      }
    });
  }

  it('re-evaluates assigned-slot changes and ignores mutations in unrelated branches', async () => {
    const original = window.matchMedia;
    window.matchMedia = query => ({ media: query, matches: false } as MediaQueryList);
    const host = await fixture<HTMLElement>(html`<div><span slot="a"></span></div>`);
    const root = host.attachShadow({ mode: 'open' });
    const first = document.createElement('section');
    first.setAttribute('data-lr-motion', 'reduce');
    const firstSlot = document.createElement('slot');
    firstSlot.name = 'a';
    first.append(firstSlot);
    const secondSlot = document.createElement('slot');
    secondSlot.name = 'b';
    root.append(first, secondSlot);
    const child = host.firstElementChild!;
    const values: boolean[] = [];
    const stop = observeReducedMotion(child, value => values.push(value));
    try {
      child.setAttribute('slot', 'b');
      await waitUntil(() => values.at(-1) === false);
      first.setAttribute('data-lr-motion', 'system');
      await Promise.resolve();
      expect(values).to.deep.equal([false]);
      secondSlot.setAttribute('data-lr-motion', 'reduce');
      await waitUntil(() => values.at(-1) === true);
      child.setAttribute('slot', 'a');
      await waitUntil(() => values.at(-1) === false);
    } finally {
      stop();
      window.matchMedia = original;
    }
  });

  it('discovers a slot rendered after subscription in an existing parent shadow root', async () => {
    const original = window.matchMedia;
    window.matchMedia = query => ({ media: query, matches: false } as MediaQueryList);
    const host = await fixture<HTMLElement>(html`<div data-lr-motion="reduce"><span></span></div>`);
    const root = host.attachShadow({ mode: 'open' });
    const values: boolean[] = [];
    const stop = observeReducedMotion(host.firstElementChild!, value => values.push(value));
    try {
      const slot = document.createElement('slot');
      slot.setAttribute('data-lr-motion', 'system');
      root.append(slot);
      await waitUntil(() => values.at(-1) === false);
      slot.remove();
      await waitUntil(() => values.at(-1) === true);
      root.append(slot);
      await waitUntil(() => values.at(-1) === false);
    } finally {
      stop();
      window.matchMedia = original;
    }
  });
  it('tests each changed node against one ancestor per subscription, not the whole ancestry', async () => {
    const original = window.matchMedia;
    const contains = Node.prototype.contains;
    window.matchMedia = query => ({ media: query, matches: false } as MediaQueryList);
    const scope = await fixture<HTMLElement>(html`<div><div><div><div><div><span></span><span></span><span></span><span></span><span></span></div></div></div></div><aside></aside></div>`);
    const stops = [...scope.querySelectorAll('span')].map(span => observeReducedMotion(span, () => {}));
    let calls = 0;
    Node.prototype.contains = function (this: Node, other: Node | null) { calls++; return contains.call(this, other); };
    try {
      for (let index = 0; index < 10; index++) scope.lastElementChild!.append(document.createElement('p'));
      await aTimeout(0);
      expect(calls).to.be.at.most(stops.length * 10 + 10);
    } finally {
      Node.prototype.contains = contains;
      stops.forEach(stop => stop());
      window.matchMedia = original;
    }
  });

  it('re-evaluates when a wrapper is inserted around the producer or an ancestor is removed', async () => {
    const original = window.matchMedia;
    window.matchMedia = query => ({ media: query, matches: false } as MediaQueryList);
    const scope = await fixture<HTMLElement>(html`<div><section><span></span></section></div>`);
    const section = scope.firstElementChild!;
    const child = section.firstElementChild!;
    const values: boolean[] = [];
    const stop = observeReducedMotion(child, value => values.push(value));
    try {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-lr-motion', 'reduce');
      scope.append(wrapper);
      wrapper.append(section);
      await waitUntil(() => values.at(-1) === true);
      section.remove();
      await waitUntil(() => values.at(-1) === false);
    } finally {
      stop();
      window.matchMedia = original;
    }
  });
});

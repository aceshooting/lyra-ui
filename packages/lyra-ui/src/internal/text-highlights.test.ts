import { expect } from '@open-wc/testing';
import { supportsCustomHighlights, acquireHighlightHandle } from './text-highlights.js';
import type { LyraHighlightTone } from '../components/viewers/document-viewer/anchors.js';

function makeContent(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

function rangeOverText(root: Element, text: string): Range {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const index = (node as Text).data.indexOf(text);
    if (index !== -1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);
      return range;
    }
  }
  throw new Error(`Text "${text}" not found`);
}

/** Returns the first text node under `root` whose data contains `text` (unlike `rangeOverText`,
 *  this hands back the node itself so callers can build a `Range` with explicit offsets). */
function findTextNode(root: Element, text: string): Text {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if ((node as Text).data.includes(text)) return node as Text;
  }
  throw new Error(`Text node containing "${text}" not found`);
}

describe('supportsCustomHighlights', () => {
  it('returns a boolean without throwing', () => {
    expect(typeof supportsCustomHighlights()).to.equal('boolean');
  });
});

describe('acquireHighlightHandle', () => {
  it('isolates ranges between two owners; releasing one leaves the other painted', () => {
    const root = makeContent('<p>Revenue grew 12% year over year, driven by strong demand.</p>');
    try {
      const ownerA = {};
      const ownerB = {};
      const handleA = acquireHighlightHandle(ownerA, document);
      const handleB = acquireHighlightHandle(ownerB, document);
      const rangeA = rangeOverText(root, '12%');
      const rangeB = rangeOverText(root, 'strong demand');

      handleA.setRanges('accent', [rangeA]);
      handleB.setRanges('warning', [rangeB]);

      if (supportsCustomHighlights()) {
        const registry = (globalThis as unknown as { CSS: { highlights: Map<string, { has(r: Range): boolean }> } }).CSS.highlights;
        expect(registry.get('lr-highlight-accent')!.has(rangeA)).to.be.true;
        expect(registry.get('lr-highlight-warning')!.has(rangeB)).to.be.true;
        handleA.release();
        expect(registry.get('lr-highlight-accent')!.has(rangeA)).to.be.false;
        expect(registry.get('lr-highlight-warning')!.has(rangeB)).to.be.true;
      } else {
        expect(root.querySelectorAll('mark[data-lr-highlight-tone="accent"]')).to.have.length(1);
        expect(root.querySelectorAll('mark[data-lr-highlight-tone="warning"]')).to.have.length(1);
        handleA.release();
        expect(root.querySelectorAll('mark[data-lr-highlight-tone="accent"]')).to.have.length(0);
        expect(root.querySelectorAll('mark[data-lr-highlight-tone="warning"]')).to.have.length(1);
      }
      handleB.release();
    } finally {
      root.remove();
    }
  });

  it('replaces a prior setRanges call for the same owner/tone rather than accumulating', () => {
    const root = makeContent('<p>Alpha beta gamma delta.</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const rangeAlpha = rangeOverText(root, 'Alpha');
      const rangeGamma = rangeOverText(root, 'gamma');

      handle.setRanges('accent', [rangeAlpha]);
      handle.setRanges('accent', [rangeGamma]);

      if (supportsCustomHighlights()) {
        const registry = (globalThis as unknown as { CSS: { highlights: Map<string, { has(r: Range): boolean }> } }).CSS.highlights;
        expect(registry.get('lr-highlight-accent')!.has(rangeAlpha)).to.be.false;
        expect(registry.get('lr-highlight-accent')!.has(rangeGamma)).to.be.true;
      } else {
        const marks = root.querySelectorAll('mark[data-lr-highlight-tone="accent"]');
        expect(marks).to.have.length(1);
        expect(marks[0].textContent).to.equal('gamma');
      }
      handle.release();
    } finally {
      root.remove();
    }
  });

  it('fallback mark-wrapping wraps and unwraps without leaving empty split text nodes', () => {
    if (supportsCustomHighlights()) return; // this test targets the fallback path specifically
    const root = makeContent('<p>Revenue grew twelve percent year over year.</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const range = rangeOverText(root, 'twelve percent');
      handle.setRanges('accent', [range]);
      expect(root.querySelector('mark')).to.exist;
      handle.release();
      expect(root.querySelector('mark')).to.not.exist;
      expect(root.textContent).to.equal('Revenue grew twelve percent year over year.');
      // normalize() during unwrap must leave no empty text nodes behind.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) expect((node as Text).data.length).to.be.greaterThan(0);
    } finally {
      root.remove();
    }
  });

  it('flash() paints then clears itself after durationMs', async () => {
    const root = makeContent('<p>Flash target text here.</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const range = rangeOverText(root, 'target');
      handle.flash(range, 20);

      if (supportsCustomHighlights()) {
        const registry = (globalThis as unknown as { CSS: { highlights: Map<string, { has(r: Range): boolean }> } }).CSS.highlights;
        expect(registry.get('lr-highlight-flash')!.has(range)).to.be.true;
        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(registry.get('lr-highlight-flash')!.has(range)).to.be.false;
      } else {
        expect(root.querySelector('mark')).to.exist;
        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(root.querySelector('mark')).to.not.exist;
      }
      handle.release();
    } finally {
      root.remove();
    }
  });

  it('setActive(null) clears the active range', () => {
    const root = makeContent('<p>Active state text sample.</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const range = rangeOverText(root, 'Active state');
      handle.setActive(range);
      handle.setActive(null);
      if (supportsCustomHighlights()) {
        const registry = (globalThis as unknown as { CSS: { highlights: Map<string, { has(r: Range): boolean }> } }).CSS.highlights;
        expect(registry.get('lr-highlight-active')!.has(range)).to.be.false;
      } else {
        expect(root.querySelector('mark')).to.not.exist;
      }
      handle.release();
    } finally {
      root.remove();
    }
  });

  it('fallback: setActive, flash, and setRanges(accent) each produce a distinguishably-named mark', () => {
    if (supportsCustomHighlights()) return; // this test targets the fallback path specifically
    const root = makeContent('<p>One active two flash three accent four.</p>');
    try {
      const activeOwner = {};
      const flashOwner = {};
      const accentOwner = {};
      const activeHandle = acquireHighlightHandle(activeOwner, document);
      const flashHandle = acquireHighlightHandle(flashOwner, document);
      const accentHandle = acquireHighlightHandle(accentOwner, document);

      activeHandle.setActive(rangeOverText(root, 'active'));
      flashHandle.flash(rangeOverText(root, 'flash'), 20_000); // long duration so it's still painted below
      accentHandle.setRanges('accent', [rangeOverText(root, 'accent')]);

      // All three marks share tone="accent" (setActive/flash always paint with tone 'accent'
      // internally) but must now carry three distinct data-lr-highlight-name values.
      expect(root.querySelectorAll('mark[data-lr-highlight-tone="accent"]')).to.have.length(3);
      expect(root.querySelectorAll('mark[data-lr-highlight-name="lr-highlight-active"]')).to.have.length(1);
      expect(root.querySelectorAll('mark[data-lr-highlight-name="lr-highlight-flash"]')).to.have.length(1);
      expect(root.querySelectorAll('mark[data-lr-highlight-name="lr-highlight-accent"]')).to.have.length(1);

      const activeMark = root.querySelector('mark[data-lr-highlight-name="lr-highlight-active"]')!;
      const flashMark = root.querySelector('mark[data-lr-highlight-name="lr-highlight-flash"]')!;
      const accentMark = root.querySelector('mark[data-lr-highlight-name="lr-highlight-accent"]')!;
      expect(activeMark.textContent).to.equal('active');
      expect(flashMark.textContent).to.equal('flash');
      expect(accentMark.textContent).to.equal('accent');

      activeHandle.release();
      flashHandle.release();
      accentHandle.release();
    } finally {
      root.remove();
    }
  });
});

// The tests above guard fallback-only assertions with `if (supportsCustomHighlights()) return;`,
// which is a no-op in a browser that implements the CSS Custom Highlight API (e.g. this project's
// Chromium test target) -- so the <mark>-wrapping fallback (splitTextNodeAtRange/wrapRangeInMarks/
// unwrapMark/acquireFallbackHandle) never actually runs there. This block forces that branch by
// temporarily hiding the `Highlight` global, regardless of what the host browser really supports,
// so the fallback implementation gets real coverage everywhere these tests run.
describe('acquireHighlightHandle (fallback path, forced via a hidden Highlight global)', () => {
  let originalHighlight: unknown;

  beforeEach(() => {
    originalHighlight = (globalThis as unknown as { Highlight?: unknown }).Highlight;
    (globalThis as unknown as { Highlight?: unknown }).Highlight = undefined;
  });

  afterEach(() => {
    (globalThis as unknown as { Highlight?: unknown }).Highlight = originalHighlight;
  });

  it('forces supportsCustomHighlights() to false and routes acquireHighlightHandle to the <mark> fallback', () => {
    expect(supportsCustomHighlights()).to.be.false;
    const root = makeContent('<p>Hello world</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const range = rangeOverText(root, 'world');
      handle.setRanges('accent', [range]);
      expect(root.querySelector('mark[data-lr-highlight-tone="accent"]')).to.exist;
      handle.release();
      expect(root.querySelector('mark')).to.not.exist;
    } finally {
      root.remove();
    }
  });

  it('splits and wraps a range spanning multiple text nodes across an element boundary', () => {
    const root = makeContent('<p>Hello <b>brave new</b> world today</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const helloNode = findTextNode(root, 'Hello');
      const worldNode = findTextNode(root, 'world today');
      const range = document.createRange();
      range.setStart(helloNode, 3); // start offset > 0 -> leading remainder ("Hel") stays unwrapped
      range.setEnd(worldNode, 6); // end offset < length -> trailing remainder (" today") stays unwrapped
      handle.setRanges('accent', [range]);

      const marks = root.querySelectorAll('mark[data-lr-highlight-tone="accent"]');
      expect(marks).to.have.length(3);
      expect(marks[0].textContent).to.equal('lo ');
      expect(marks[1].textContent).to.equal('brave new');
      expect(marks[2].textContent).to.equal(' world');
      expect(root.textContent).to.equal('Hello brave new world today');

      handle.release();
      expect(root.querySelector('mark')).to.not.exist;
      expect(root.textContent).to.equal('Hello brave new world today');
    } finally {
      root.remove();
    }
  });

  it('skips a collapsed (zero-width) sub-range at the exact end of a text node without creating a mark', () => {
    const root = makeContent('<p>Solo text</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const soloNode = findTextNode(root, 'Solo text');
      const collapsedRange = document.createRange();
      collapsedRange.setStart(soloNode, soloNode.data.length);
      collapsedRange.setEnd(soloNode, soloNode.data.length);

      handle.setRanges('accent', [collapsedRange]);
      expect(root.querySelector('mark')).to.not.exist;

      handle.release();
    } finally {
      root.remove();
    }
  });

  it('unwrapMark no-ops safely when a painted mark was externally removed from the DOM before release', () => {
    const root = makeContent('<p>Detached mark scenario text.</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const range = rangeOverText(root, 'mark scenario');
      handle.setRanges('accent', [range]);
      const mark = root.querySelector('mark[data-lr-highlight-tone="accent"]');
      expect(mark).to.exist;
      mark!.remove(); // detach it out from under the handle's internal bookkeeping

      expect(() => handle.release()).to.not.throw();
    } finally {
      root.remove();
    }
  });

  it('flash() paints a <mark> then clears it after durationMs, and release() clears an in-progress flash', async () => {
    const root = makeContent('<p>Flash cancel scenario.</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const range = rangeOverText(root, 'cancel');
      handle.flash(range, 20);
      expect(root.querySelector('mark[data-lr-highlight-name="lr-highlight-flash"]')).to.exist;
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(root.querySelector('mark')).to.not.exist;

      // second flash, released before its timer would naturally fire.
      handle.flash(range, 20_000);
      expect(root.querySelector('mark[data-lr-highlight-name="lr-highlight-flash"]')).to.exist;
      handle.release();
      expect(root.querySelector('mark')).to.not.exist;
    } finally {
      root.remove();
    }
  });

  it('setActive/setRanges/release exercise the full fallback handle surface', () => {
    const root = makeContent('<p>Active accent sample text.</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const activeRange = rangeOverText(root, 'Active');
      const accentRange = rangeOverText(root, 'sample');

      handle.setActive(activeRange);
      handle.setRanges('accent', [accentRange]);
      expect(root.querySelectorAll('mark')).to.have.length(2);

      handle.setActive(null);
      expect(root.querySelectorAll('mark[data-lr-highlight-name="lr-highlight-active"]')).to.have.length(0);
      expect(root.querySelectorAll('mark[data-lr-highlight-name="lr-highlight-accent"]')).to.have.length(1);

      handle.release();
      expect(root.querySelector('mark')).to.not.exist;
    } finally {
      root.remove();
    }
  });
});

describe('acquireHighlightHandle (CSS path, unregistered highlight name)', () => {
  it('replaceCssOwned no-ops setRanges for a tone name that was never registered, instead of throwing', () => {
    if (!supportsCustomHighlights()) return; // this test targets the CSS Custom Highlight API path specifically
    const root = makeContent('<p>Unregistered tone scenario.</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const range = rangeOverText(root, 'scenario');
      expect(() => handle.setRanges('totally-bogus-tone' as unknown as LyraHighlightTone, [range])).to.not.throw();

      const registry = (globalThis as unknown as { CSS: { highlights: Map<string, unknown> } }).CSS.highlights;
      expect(registry.get('lr-highlight-totally-bogus-tone')).to.be.undefined;

      handle.release();
    } finally {
      root.remove();
    }
  });
});

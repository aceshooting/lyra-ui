import { expect } from '@open-wc/testing';
import { supportsCustomHighlights, acquireHighlightHandle } from './text-highlights.js';

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
        expect(registry.get('lyra-highlight-accent')!.has(rangeA)).to.be.true;
        expect(registry.get('lyra-highlight-warning')!.has(rangeB)).to.be.true;
        handleA.release();
        expect(registry.get('lyra-highlight-accent')!.has(rangeA)).to.be.false;
        expect(registry.get('lyra-highlight-warning')!.has(rangeB)).to.be.true;
      } else {
        expect(root.querySelectorAll('mark[data-lyra-highlight-tone="accent"]')).to.have.length(1);
        expect(root.querySelectorAll('mark[data-lyra-highlight-tone="warning"]')).to.have.length(1);
        handleA.release();
        expect(root.querySelectorAll('mark[data-lyra-highlight-tone="accent"]')).to.have.length(0);
        expect(root.querySelectorAll('mark[data-lyra-highlight-tone="warning"]')).to.have.length(1);
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
        expect(registry.get('lyra-highlight-accent')!.has(rangeAlpha)).to.be.false;
        expect(registry.get('lyra-highlight-accent')!.has(rangeGamma)).to.be.true;
      } else {
        const marks = root.querySelectorAll('mark[data-lyra-highlight-tone="accent"]');
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
        expect(registry.get('lyra-highlight-flash')!.has(range)).to.be.true;
        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(registry.get('lyra-highlight-flash')!.has(range)).to.be.false;
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
        expect(registry.get('lyra-highlight-active')!.has(range)).to.be.false;
      } else {
        expect(root.querySelector('mark')).to.not.exist;
      }
      handle.release();
    } finally {
      root.remove();
    }
  });
});

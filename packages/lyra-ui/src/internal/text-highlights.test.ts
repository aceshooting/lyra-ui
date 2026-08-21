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

function ownerRangeOverText(doc: Document, root: Element, text: string): Range {
  const walker = doc.createTreeWalker(root, 4);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const index = (node as Text).data.indexOf(text);
    if (index === -1) continue;
    const range = doc.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + text.length);
    return range;
  }
  throw new Error(`Owner text "${text}" not found`);
}

class FakeHighlight extends Set<Range> {
  priority = 0;
}

describe('supportsCustomHighlights', () => {
  it('returns a boolean without throwing', () => {
    expect(typeof supportsCustomHighlights()).to.equal('boolean');
  });
});

describe('acquireHighlightHandle', () => {
  it('returns a safe inert handle when no owner document exists', () => {
    const range = document.createRange();
    const handle = acquireHighlightHandle({}, null);
    expect(() => {
      handle.setRanges('accent', [range]);
      handle.setActive(range);
      handle.flash(range, 1);
      handle.release();
    }).to.not.throw();
  });

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

  function isPainted(root: HTMLElement, range: Range): boolean {
    if (supportsCustomHighlights()) {
      const registry = (globalThis as unknown as { CSS: { highlights: Map<string, { has(r: Range): boolean }> } }).CSS.highlights;
      return registry.get('lr-highlight-flash')?.has(range) ?? false;
    }
    return root.querySelector('mark') != null;
  }

  it('flash() with a non-finite durationMs (NaN) falls back to the documented 1800ms default instead of throwing or firing immediately', async () => {
    const root = makeContent('<p>Flash target text here.</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const range = rangeOverText(root, 'target');
      expect(() => handle.flash(range, NaN)).to.not.throw();
      expect(isPainted(root, range)).to.be.true;
      // Well short of the 1800ms default -- proves NaN didn't collapse to an immediate/zero timeout.
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(isPainted(root, range)).to.be.true;
      handle.release();
      expect(isPainted(root, range)).to.be.false;
    } finally {
      root.remove();
    }
  });

  it('flash() with a negative durationMs clamps to 0 and still resolves asynchronously, not synchronously', async () => {
    const root = makeContent('<p>Flash target text here.</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const range = rangeOverText(root, 'target');
      handle.flash(range, -50);
      // Still painted immediately after the call -- a clamped-to-0 duration must still schedule
      // an async timer, never an inline/synchronous clear (mirrors internal/announcer.ts).
      expect(isPainted(root, range)).to.be.true;
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(isPainted(root, range)).to.be.false;
    } finally {
      root.remove();
    }
  });

  it('flash() with an Infinity durationMs clamps to the browser timer ceiling instead of throwing or firing immediately', async () => {
    const root = makeContent('<p>Flash target text here.</p>');
    try {
      const owner = {};
      const handle = acquireHighlightHandle(owner, document);
      const range = rangeOverText(root, 'target');
      expect(() => handle.flash(range, Infinity)).to.not.throw();
      expect(isPainted(root, range)).to.be.true;
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(isPainted(root, range)).to.be.true;
      handle.release();
      expect(isPainted(root, range)).to.be.false;
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

  it('unwraps with bounded adjacent-text cleanup without recursively normalizing the parent', () => {
    const root = makeContent('<p>bounded cleanup path</p>');
    try {
      const parent = root.firstElementChild as HTMLElement;
      let normalizeCalls = 0;
      Object.defineProperty(parent, 'normalize', {
        configurable: true,
        value: () => { normalizeCalls++; },
      });
      const handle = acquireHighlightHandle({}, document);
      handle.setRanges('accent', [rangeOverText(root, 'cleanup')]);
      expect(root.querySelector('mark')).to.exist;
      handle.release();
      expect(normalizeCalls).to.equal(0);
      expect(parent.childNodes).to.have.length(1);
      expect(parent.textContent).to.equal('bounded cleanup path');
    } finally {
      root.remove();
    }
  });

  it('fails closed before mutating a range that would exceed the aggregate mark ceiling', () => {
    const root = makeContent('');
    try {
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 201; index++) fragment.append(document.createTextNode('x'));
      root.append(fragment);
      const range = document.createRange();
      range.selectNodeContents(root);
      const handle = acquireHighlightHandle({}, document);
      handle.setRanges('accent', [range]);
      expect(root.querySelector('mark')).to.not.exist;
      expect(root.textContent).to.equal('x'.repeat(201));
      handle.release();
    } finally {
      root.remove();
    }
  });

  it('bounds the common-ancestor walk for a fallback range', () => {
    const root = makeContent('');
    try {
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 25_000; index++) fragment.append(document.createTextNode('x'));
      root.append(fragment);
      const firstRange = document.createRange();
      firstRange.selectNodeContents(root);
      const secondRange = firstRange.cloneRange();
      const originalFirstIntersectsNode = firstRange.intersectsNode.bind(firstRange);
      const originalSecondIntersectsNode = secondRange.intersectsNode.bind(secondRange);
      let intersectionChecks = 0;
      firstRange.intersectsNode = (node) => {
        intersectionChecks++;
        return originalFirstIntersectsNode(node);
      };
      secondRange.intersectsNode = (node) => {
        intersectionChecks++;
        return originalSecondIntersectsNode(node);
      };

      const handle = acquireHighlightHandle({}, document);
      handle.setRanges('accent', [firstRange, secondRange]);
      expect(intersectionChecks).to.be.at.most(20_000);
      handle.release();
    } finally {
      root.remove();
    }
  });

  it('retains at most 200 fallback ranges for one tone', () => {
    const root = makeContent('');
    try {
      const ranges: Range[] = [];
      for (let index = 0; index < 300; index++) {
        const textNode = document.createTextNode('x');
        root.append(textNode);
        const range = document.createRange();
        range.selectNodeContents(textNode);
        ranges.push(range);
      }
      const handle = acquireHighlightHandle({}, document);
      handle.setRanges('accent', ranges);
      expect(root.querySelectorAll('mark[data-lr-highlight-name="lr-highlight-accent"]')).to.have.length(200);
      handle.release();
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

describe('acquireHighlightHandle owner realms', () => {
  it('keeps CSS registries, ranges, and flash timers isolated per owner document', () => {
    const firstFrame = document.createElement('iframe');
    const secondFrame = document.createElement('iframe');
    document.body.append(firstFrame, secondFrame);
    const firstView = firstFrame.contentWindow!;
    const secondView = secondFrame.contentWindow!;
    const firstDocument = firstFrame.contentDocument!;
    const secondDocument = secondFrame.contentDocument!;
    const ambientHighlight = Object.getOwnPropertyDescriptor(window, 'Highlight');
    const ambientCss = Object.getOwnPropertyDescriptor(window, 'CSS');
    const ambientCssValue = window.CSS;
    const firstHighlight = Object.getOwnPropertyDescriptor(firstView, 'Highlight');
    const secondHighlight = Object.getOwnPropertyDescriptor(secondView, 'Highlight');
    const firstCss = Object.getOwnPropertyDescriptor(firstView, 'CSS');
    const secondCss = Object.getOwnPropertyDescriptor(secondView, 'CSS');
    const ambientSetTimeout = window.setTimeout;
    const firstSetTimeout = firstView.setTimeout;
    const firstClearTimeout = firstView.clearTimeout;
    const firstRegistry = new Map<string, FakeHighlight>();
    const secondRegistry = new Map<string, FakeHighlight>();
    let ambientHighlightConstructions = 0;
    let ambientCssReads = 0;
    let ambientTimers = 0;
    let firstTimer: (() => void) | undefined;
    const firstClears: number[] = [];
    let firstHandle: ReturnType<typeof acquireHighlightHandle> | undefined;
    let secondHandle: ReturnType<typeof acquireHighlightHandle> | undefined;

    try {
      Object.defineProperty(window, 'Highlight', {
        configurable: true,
        value: class AmbientHighlightTrap extends FakeHighlight {
          constructor() {
            super();
            ambientHighlightConstructions += 1;
          }
        },
      });
      Object.defineProperty(window, 'CSS', {
        configurable: true,
        get() {
          ambientCssReads += 1;
          return ambientCssValue;
        },
      });
      Object.defineProperty(firstView, 'Highlight', {
        configurable: true,
        value: FakeHighlight,
      });
      Object.defineProperty(secondView, 'Highlight', {
        configurable: true,
        value: FakeHighlight,
      });
      Object.defineProperty(firstView, 'CSS', {
        configurable: true,
        value: { highlights: firstRegistry },
      });
      Object.defineProperty(secondView, 'CSS', {
        configurable: true,
        value: { highlights: secondRegistry },
      });
      window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        ambientTimers += 1;
        return ambientSetTimeout(handler, timeout, ...args);
      }) as typeof window.setTimeout;
      firstView.setTimeout = ((handler: TimerHandler) => {
        if (typeof handler === 'function') firstTimer = handler as () => void;
        return 701;
      }) as typeof firstView.setTimeout;
      firstView.clearTimeout = ((handle?: number) => {
        if (handle !== undefined) firstClears.push(handle);
      }) as typeof firstView.clearTimeout;

      const firstRoot = firstDocument.createElement('p');
      firstRoot.textContent = 'first owner range';
      firstDocument.body.append(firstRoot);
      const secondRoot = secondDocument.createElement('p');
      secondRoot.textContent = 'second owner range';
      secondDocument.body.append(secondRoot);
      const firstRange = ownerRangeOverText(firstDocument, firstRoot, 'owner');
      const secondRange = ownerRangeOverText(secondDocument, secondRoot, 'owner');
      const sharedOwner = {};

      expect(supportsCustomHighlights(firstDocument)).to.be.true;
      expect(supportsCustomHighlights(secondDocument)).to.be.true;
      firstHandle = acquireHighlightHandle(sharedOwner, firstDocument);
      secondHandle = acquireHighlightHandle(sharedOwner, secondDocument);
      firstHandle.setRanges('accent', [firstRange]);
      secondHandle.setRanges('accent', [secondRange]);

      expect(ambientHighlightConstructions).to.equal(0);
      expect(ambientCssReads).to.equal(0);
      expect(firstRegistry.get('lr-highlight-accent')?.has(firstRange) ?? false).to.be.true;
      expect(firstRegistry.get('lr-highlight-accent')?.has(secondRange) ?? false).to.be.false;
      expect(secondRegistry.get('lr-highlight-accent')?.has(secondRange) ?? false).to.be.true;
      expect(secondRegistry.get('lr-highlight-accent')?.has(firstRange) ?? false).to.be.false;

      firstHandle.flash(firstRange, 500);
      expect(ambientTimers).to.equal(0);
      expect(typeof firstTimer).to.equal('function');
      expect(firstRegistry.get('lr-highlight-flash')?.has(firstRange) ?? false).to.be.true;
      firstHandle.release();
      expect(firstClears).to.deep.equal([701]);
      firstTimer?.();
      expect(firstRegistry.get('lr-highlight-flash')?.has(firstRange) ?? false).to.be.false;
      expect(secondRegistry.get('lr-highlight-accent')?.has(secondRange) ?? false).to.be.true;
    } finally {
      firstHandle?.release();
      secondHandle?.release();
      window.setTimeout = ambientSetTimeout;
      firstView.setTimeout = firstSetTimeout;
      firstView.clearTimeout = firstClearTimeout;
      if (ambientHighlight) Object.defineProperty(window, 'Highlight', ambientHighlight);
      else Reflect.deleteProperty(window, 'Highlight');
      if (ambientCss) Object.defineProperty(window, 'CSS', ambientCss);
      else Reflect.deleteProperty(window, 'CSS');
      if (firstHighlight) Object.defineProperty(firstView, 'Highlight', firstHighlight);
      else Reflect.deleteProperty(firstView, 'Highlight');
      if (secondHighlight) Object.defineProperty(secondView, 'Highlight', secondHighlight);
      else Reflect.deleteProperty(secondView, 'Highlight');
      if (firstCss) Object.defineProperty(firstView, 'CSS', firstCss);
      else Reflect.deleteProperty(firstView, 'CSS');
      if (secondCss) Object.defineProperty(secondView, 'CSS', secondCss);
      else Reflect.deleteProperty(secondView, 'CSS');
      firstFrame.remove();
      secondFrame.remove();
    }
  });

  it('uses owner node constants and timers for the mark fallback', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const ownerView = frame.contentWindow!;
    const ownerDocument = frame.contentDocument!;
    const ownerHighlight = Object.getOwnPropertyDescriptor(ownerView, 'Highlight');
    const ambientNode = Object.getOwnPropertyDescriptor(window, 'Node');
    const ambientNodeFilter = Object.getOwnPropertyDescriptor(window, 'NodeFilter');
    const ambientSetTimeout = window.setTimeout;
    const ownerSetTimeout = ownerView.setTimeout;
    const ownerClearTimeout = ownerView.clearTimeout;
    let ambientNodeReads = 0;
    let ambientTimers = 0;
    let ownerTimer: (() => void) | undefined;
    const ownerClears: number[] = [];
    let handle: ReturnType<typeof acquireHighlightHandle> | undefined;

    try {
      Object.defineProperty(ownerView, 'Highlight', { configurable: true, value: undefined });
      class AmbientNodeTrap {}
      Object.defineProperty(AmbientNodeTrap, 'TEXT_NODE', {
        configurable: true,
        get() {
          ambientNodeReads += 1;
          return 3;
        },
      });
      class AmbientNodeFilterTrap {}
      Object.defineProperty(AmbientNodeFilterTrap, 'SHOW_TEXT', {
        configurable: true,
        get() {
          ambientNodeReads += 1;
          return 4;
        },
      });
      Object.defineProperty(window, 'Node', { configurable: true, value: AmbientNodeTrap });
      Object.defineProperty(window, 'NodeFilter', {
        configurable: true,
        value: AmbientNodeFilterTrap,
      });
      window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        ambientTimers += 1;
        return ambientSetTimeout(handler, timeout, ...args);
      }) as typeof window.setTimeout;
      ownerView.setTimeout = ((handler: TimerHandler) => {
        if (typeof handler === 'function') ownerTimer = handler as () => void;
        return 702;
      }) as typeof ownerView.setTimeout;
      ownerView.clearTimeout = ((timer?: number) => {
        if (timer !== undefined) ownerClears.push(timer);
      }) as typeof ownerView.clearTimeout;

      const root = ownerDocument.createElement('div');
      root.innerHTML = '<p>owner fallback range</p><p>flash fallback range</p>';
      ownerDocument.body.append(root);
      const persistent = ownerRangeOverText(ownerDocument, root, 'owner');
      const flash = ownerRangeOverText(ownerDocument, root, 'flash');
      handle = acquireHighlightHandle({}, ownerDocument);
      handle.setRanges('accent', [persistent]);
      handle.flash(flash, 500);

      expect(ambientNodeReads).to.equal(0);
      expect(ambientTimers).to.equal(0);
      expect(typeof ownerTimer).to.equal('function');
      expect(root.querySelectorAll('mark').length).to.equal(2);
      handle.release();
      expect(ownerClears).to.deep.equal([702]);
      expect(root.querySelectorAll('mark').length).to.equal(0);
      ownerTimer?.();
      expect(root.querySelectorAll('mark').length).to.equal(0);
    } finally {
      handle?.release();
      window.setTimeout = ambientSetTimeout;
      ownerView.setTimeout = ownerSetTimeout;
      ownerView.clearTimeout = ownerClearTimeout;
      if (ownerHighlight) Object.defineProperty(ownerView, 'Highlight', ownerHighlight);
      else Reflect.deleteProperty(ownerView, 'Highlight');
      if (ambientNode) Object.defineProperty(window, 'Node', ambientNode);
      else Reflect.deleteProperty(window, 'Node');
      if (ambientNodeFilter) Object.defineProperty(window, 'NodeFilter', ambientNodeFilter);
      else Reflect.deleteProperty(window, 'NodeFilter');
      frame.remove();
    }
  });
});

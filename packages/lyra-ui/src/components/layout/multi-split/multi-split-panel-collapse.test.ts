import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './multi-split.js';
import type {
  LyraMultiSplit,
  LyraMultiSplitPanelCollapseChangeDetail,
} from './multi-split.class.js';

const SPLIT_STYLE = 'inline-size:720px;block-size:160px';

const fourPanels = async (
  attributes: { storageKey?: string; dir?: string } = {}
): Promise<LyraMultiSplit> => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    storage-key=${attributes.storageKey ?? ''}
    dir=${attributes.dir ?? 'ltr'}
    style=${SPLIT_STYLE}
  >
    <div panel-id="a">A</div>
    <div panel-id="b">B</div>
    <div panel-id="c">C</div>
    <div panel-id="d">D</div>
  </lr-multi-split>`);
  await split.updateComplete;
  return split;
};

const dividersOf = (split: LyraMultiSplit): HTMLElement[] => [
  ...split.shadowRoot!.querySelectorAll<HTMLElement>('[part="divider"]'),
];

const panel = (split: LyraMultiSplit, id: string): HTMLElement =>
  split.querySelector<HTMLElement>(`[panel-id="${id}"]`)!;

const rounded = (values: readonly number[]): number[] =>
  values.map((value) => Math.round(value * 100) / 100);

const press = (divider: HTMLElement, key: string): void => {
  divider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
};

const rootFontSize = (): number =>
  parseFloat(getComputedStyle(document.documentElement).fontSize);

const fullKey = (storageKey: string): string => `lr-multi-split:${storageKey}:panels`;

describe('lr-multi-split per-panel collapse', () => {
  it('leaves the split unchanged while collapsedPanels is unset', async () => {
    const storageKey = `panel-collapse-unset-${Math.random()}`;
    localStorage.removeItem(fullKey(storageKey));
    try {
      const split = await fourPanels({ storageKey });
      expect([...split.collapsedPanels]).to.eql([]);
      expect(split.querySelectorAll('[data-panel-collapsed]').length).to.equal(0);
      expect(rounded(split.sizes)).to.eql([25, 25, 25, 25]);
      expect(dividersOf(split).map((divider) => divider.getAttribute('aria-disabled'))).to.eql([
        'false',
        'false',
        'false',
      ]);
      expect(panel(split, 'a').style.flex).to.equal('0 1 25%');
      let fired = 0;
      split.addEventListener('lr-multi-split-panel-collapse-change', () => (fired += 1));
      press(dividersOf(split)[0]!, 'ArrowRight');
      await split.updateComplete;
      expect(fired).to.equal(0);
      // The stored layout keeps the original version-1 shape byte for byte.
      expect(JSON.parse(localStorage.getItem(fullKey(storageKey))!)).to.eql({
        version: 1,
        panels: [
          { panelId: 'a', size: 27 },
          { panelId: 'b', size: 23 },
          { panelId: 'c', size: 25 },
          { panelId: 'd', size: 25 },
        ],
      });
    } finally {
      localStorage.removeItem(fullKey(storageKey));
    }
  });

  it('folds a middle panel to the rail and gives its share to the open panels', async () => {
    const split = await fourPanels();
    const changed = oneEvent(split, 'lr-multi-split-panel-collapse-change');
    expect(split.collapsePanel('b')).to.equal(true);
    const event = (await changed) as CustomEvent<LyraMultiSplitPanelCollapseChangeDetail>;
    expect(event.detail.panelId).to.equal('b');
    expect(event.detail.collapsed).to.equal(true);
    expect([...event.detail.collapsedPanels]).to.eql(['b']);
    expect(rounded(event.detail.sizes)).to.eql([33.33, 0, 33.33, 33.33]);
    expect(Object.isFrozen(event.detail.collapsedPanels)).to.equal(true);
    expect(event.bubbles && event.composed).to.equal(true);

    await split.updateComplete;
    expect([...split.collapsedPanels]).to.eql(['b']);
    expect(rounded(split.sizes)).to.eql([33.33, 0, 33.33, 33.33]);
    const b = panel(split, 'b');
    expect(b.hasAttribute('data-panel-collapsed')).to.equal(true);
    expect(b.hidden).to.equal(false);
    expect(Math.round(b.getBoundingClientRect().width)).to.equal(Math.round(2.5 * rootFontSize()));
    expect(getComputedStyle(b).overflow).to.equal('hidden');
    // The open panels split the rest of the track evenly.
    const widths = ['a', 'c', 'd'].map((id) => Math.round(panel(split, id).getBoundingClientRect().width));
    expect(Math.max(...widths) - Math.min(...widths)).to.be.at.most(1);
  });

  it('decorates the panel before announcing the change', async () => {
    const split = await fourPanels();
    let markerDuringEvent: boolean | undefined;
    split.addEventListener('lr-multi-split-panel-collapse-change', () => {
      markerDuringEvent = panel(split, 'c').hasAttribute('data-panel-collapsed');
    });
    split.collapsePanel(panel(split, 'c'));
    expect(markerDuringEvent).to.equal(true);
  });

  it('redistributes the freed share by panelConstraints', async () => {
    const split = await fourPanels();
    split.panelConstraints = [{ maxPx: 200 }, null, null, null];
    await split.updateComplete;
    const containerWidth = split.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.clientWidth;
    const cap = (200 / containerWidth) * 100;
    split.collapsePanel('d');
    await split.updateComplete;
    const [a, b, c, d] = split.sizes as [number, number, number, number];
    expect(cap).to.be.below(100 / 3);
    expect(d).to.equal(0);
    expect(a).to.be.closeTo(cap, 0.01);
    expect(b).to.be.closeTo((100 - cap) / 2, 0.01);
    expect(c).to.be.closeTo((100 - cap) / 2, 0.01);
  });

  it('keeps the dividers beside a collapsed middle panel resizing its open neighbours', async () => {
    const split = await fourPanels();
    split.collapsePanel('b');
    await split.updateComplete;
    const [first, second] = dividersOf(split) as [HTMLElement, HTMLElement];
    expect(first.getAttribute('aria-disabled')).to.equal('false');
    expect(second.getAttribute('aria-disabled')).to.equal('false');
    expect(second.getAttribute('tabindex')).to.equal('0');
    expect(second.getAttribute('aria-valuenow')).to.equal('33');

    press(second, 'ArrowRight');
    await split.updateComplete;
    expect(rounded(split.sizes)).to.eql([35.33, 0, 31.33, 33.33]);
    press(first, 'ArrowLeft');
    await split.updateComplete;
    expect(rounded(split.sizes)).to.eql([33.33, 0, 33.33, 33.33]);
    press(first, 'End');
    await split.updateComplete;
    expect(split.sizes[1]).to.equal(0);
    expect(split.sizes[0]! + split.sizes[2]!).to.be.closeTo(66.67, 0.01);
  });

  it('disables a divider with no open panel on one side', async () => {
    const split = await fourPanels();
    split.collapsePanel('d');
    await split.updateComplete;
    expect(dividersOf(split).map((divider) => divider.getAttribute('aria-disabled'))).to.eql([
      'false',
      'false',
      'true',
    ]);
    const before = [...split.sizes];
    press(dividersOf(split)[2]!, 'ArrowLeft');
    await split.updateComplete;
    expect([...split.sizes]).to.eql(before);
  });

  it('mirrors keyboard resizing across a collapsed panel under dir="rtl"', async () => {
    const split = await fourPanels({ dir: 'rtl' });
    split.collapsePanel('b');
    await split.updateComplete;
    press(dividersOf(split)[1]!, 'ArrowLeft');
    await split.updateComplete;
    expect(rounded(split.sizes)).to.eql([35.33, 0, 31.33, 33.33]);
  });

  it('restores the remembered share when expanded', async () => {
    const split = await fourPanels();
    split.sizes = [40, 20, 20, 20];
    await split.updateComplete;
    split.collapsePanel('a');
    await split.updateComplete;
    expect(rounded(split.sizes)).to.eql([0, 33.33, 33.33, 33.33]);
    const changed = oneEvent(split, 'lr-multi-split-panel-collapse-change');
    expect(split.togglePanel('a')).to.equal(true);
    const event = (await changed) as CustomEvent<LyraMultiSplitPanelCollapseChangeDetail>;
    expect(event.detail.collapsed).to.equal(false);
    expect([...event.detail.collapsedPanels]).to.eql([]);
    await split.updateComplete;
    expect(rounded(split.sizes)).to.eql([40, 20, 20, 20]);
    expect(panel(split, 'a').hasAttribute('data-panel-collapsed')).to.equal(false);
  });

  it('never collapses the last open panel and ignores unknown panels', async () => {
    const split = await fourPanels();
    let fired = 0;
    split.addEventListener('lr-multi-split-panel-collapse-change', () => (fired += 1));
    expect(split.collapsePanel('a')).to.equal(true);
    expect(split.collapsePanel('b')).to.equal(true);
    expect(split.collapsePanel('c')).to.equal(true);
    expect(split.collapsePanel('d')).to.equal(false);
    expect(split.collapsePanel('missing')).to.equal(false);
    expect(split.expandPanel('d')).to.equal(false);
    expect(split.collapsePanel('a')).to.equal(false);
    expect(fired).to.equal(3);
    await split.updateComplete;
    expect(rounded(split.sizes)).to.eql([0, 0, 0, 100]);
  });

  it('applies a collapsedPanels assignment silently and keeps one panel open', async () => {
    const split = await fourPanels();
    let fired = 0;
    split.addEventListener('lr-multi-split-panel-collapse-change', () => (fired += 1));
    split.collapsedPanels = ['c', 'missing'];
    await split.updateComplete;
    expect(rounded(split.sizes)).to.eql([33.33, 33.33, 0, 33.33]);
    expect(panel(split, 'c').hasAttribute('data-panel-collapsed')).to.equal(true);
    split.collapsedPanels = ['a', 'b', 'c', 'd'];
    await split.updateComplete;
    expect(split.sizes[3]).to.equal(100);
    expect(panel(split, 'd').hasAttribute('data-panel-collapsed')).to.equal(false);
    split.collapsedPanels = [];
    await split.updateComplete;
    expect(split.sizes.every((size) => size >= 10)).to.equal(true);
    expect(split.sizes.reduce((sum, size) => sum + size, 0)).to.be.closeTo(100, 0.01);
    expect(split.querySelectorAll('[data-panel-collapsed]').length).to.equal(0);
    expect(fired).to.equal(0);
  });

  it('persists the collapsed set with sizes and restores it', async () => {
    const storageKey = `panel-collapse-roundtrip-${Math.random()}`;
    localStorage.removeItem(fullKey(storageKey));
    try {
      const first = await fourPanels({ storageKey });
      first.collapsePanel('b');
      const stored = JSON.parse(localStorage.getItem(fullKey(storageKey))!) as {
        version: number;
        panels: Array<{ panelId: string; size: number; collapsed?: boolean; expandedSize?: number }>;
      };
      expect(stored.version).to.equal(2);
      expect(stored.panels[1]).to.eql({ panelId: 'b', size: 0, collapsed: true, expandedSize: 25 });
      first.remove();

      const second = await fourPanels({ storageKey });
      expect([...second.collapsedPanels]).to.eql(['b']);
      expect(rounded(second.sizes)).to.eql([33.33, 0, 33.33, 33.33]);
      expect(panel(second, 'b').hasAttribute('data-panel-collapsed')).to.equal(true);
      second.expandPanel('b');
      await second.updateComplete;
      expect(rounded(second.sizes)).to.eql([25, 25, 25, 25]);
      const restored = JSON.parse(localStorage.getItem(fullKey(storageKey))!) as { version: number };
      expect(restored.version).to.equal(1);
    } finally {
      localStorage.removeItem(fullKey(storageKey));
    }
  });

  it('still restores a version-1 stored layout', async () => {
    const storageKey = `panel-collapse-v1-${Math.random()}`;
    localStorage.setItem(
      fullKey(storageKey),
      JSON.stringify({
        version: 1,
        panels: [
          { panelId: 'a', size: 40 },
          { panelId: 'b', size: 20 },
          { panelId: 'c', size: 20 },
          { panelId: 'd', size: 20 },
        ],
      })
    );
    try {
      const split = await fourPanels({ storageKey });
      expect(rounded(split.sizes)).to.eql([40, 20, 20, 20]);
      expect([...split.collapsedPanels]).to.eql([]);
    } finally {
      localStorage.removeItem(fullKey(storageKey));
    }
  });

  it('rejects a malformed version-2 record', async () => {
    const storageKey = `panel-collapse-bad-${Math.random()}`;
    localStorage.setItem(
      fullKey(storageKey),
      JSON.stringify({
        version: 2,
        panels: [
          { panelId: 'a', size: 50, collapsed: 'yes' },
          { panelId: 'b', size: 50 },
        ],
      })
    );
    try {
      const split = await fourPanels({ storageKey });
      expect(rounded(split.sizes)).to.eql([25, 25, 25, 25]);
      expect([...split.collapsedPanels]).to.eql([]);
    } finally {
      localStorage.removeItem(fullKey(storageKey));
    }
  });

  it('keeps the collapsed panel across a reconnect and releases its marker while detached', async () => {
    const split = await fourPanels();
    split.collapsePanel('c');
    await split.updateComplete;
    const parent = split.parentNode!;
    split.remove();
    expect(panel(split, 'c').hasAttribute('data-panel-collapsed')).to.equal(false);
    parent.appendChild(split);
    await split.updateComplete;
    await waitUntil(() => panel(split, 'c').hasAttribute('data-panel-collapsed'));
    expect(rounded(split.sizes)).to.eql([33.33, 33.33, 0, 33.33]);
    expect(Math.round(panel(split, 'c').getBoundingClientRect().width)).to.equal(Math.round(2.5 * rootFontSize()));
  });

  it('reads the rail size from --lr-multi-split-collapsed-panel-size', async () => {
    const split = await fourPanels();
    split.style.setProperty('--lr-multi-split-collapsed-panel-size', '64px');
    split.collapsePanel('a');
    await split.updateComplete;
    expect(Math.round(panel(split, 'a').getBoundingClientRect().width)).to.equal(64);
  });

  it('folds along the block axis in a vertical split', async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      orientation="vertical"
      style="inline-size:300px;block-size:800px"
    >
      <div panel-id="a">A</div>
      <div panel-id="b">B</div>
      <div panel-id="c">C</div>
    </lr-multi-split>`);
    split.collapsePanel('b');
    await split.updateComplete;
    expect(Math.round(panel(split, 'b').getBoundingClientRect().height)).to.equal(Math.round(2.5 * rootFontSize()));
  });

  it('keeps the responsive collapse pane independent of per-panel folds', async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      collapse="start"
      rail-breakpoint="5000"
      style=${SPLIT_STYLE}
    >
      <div panel-id="a">A</div>
      <div panel-id="b">B</div>
      <div panel-id="c">C</div>
      <div panel-id="d">D</div>
    </lr-multi-split>`);
    await waitUntil(() => split.collapseState === 'rail');
    let responsiveEvents = 0;
    split.addEventListener('lr-multi-split-collapse-change', () => (responsiveEvents += 1));
    split.collapsePanel('c');
    await split.updateComplete;
    expect(split.collapseState).to.equal('rail');
    expect(responsiveEvents).to.equal(0);
    expect(panel(split, 'a').getAttribute('data-collapse-state')).to.equal('rail');
    expect(panel(split, 'c').hasAttribute('data-panel-collapsed')).to.equal(true);
    expect(dividersOf(split).map((divider) => divider.getAttribute('aria-disabled'))).to.eql([
      'true',
      'false',
      'false',
    ]);
    // Both dividers around c resize b against d; the railed responsive pane is never a partner.
    press(dividersOf(split)[2]!, 'ArrowRight');
    await split.updateComplete;
    expect(rounded(split.sizes)).to.eql([33.33, 35.33, 0, 31.33]);
    split.collapseState = 'wide';
    await split.updateComplete;
    expect(dividersOf(split)[0]!.getAttribute('aria-disabled')).to.equal('false');
    expect(panel(split, 'c').hasAttribute('data-panel-collapsed')).to.equal(true);
  });

  it('honors an authored collapsedPanels binding at initialization over the stored set', async () => {
    const storageKey = `panel-collapse-authored-${Math.random()}`;
    localStorage.setItem(
      fullKey(storageKey),
      JSON.stringify({
        version: 2,
        panels: [
          { panelId: 'a', size: 50 },
          { panelId: 'b', size: 0, collapsed: true, expandedSize: 20 },
          { panelId: 'c', size: 25 },
          { panelId: 'd', size: 25 },
        ],
      })
    );
    try {
      const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
        storage-key=${storageKey}
        .collapsedPanels=${['d']}
        style=${SPLIT_STYLE}
      >
        <div panel-id="a">A</div>
        <div panel-id="b">B</div>
        <div panel-id="c">C</div>
        <div panel-id="d">D</div>
      </lr-multi-split>`);
      await split.updateComplete;
      expect([...split.collapsedPanels]).to.eql(['d']);
      expect(split.sizes[3]).to.equal(0);
      expect(split.sizes[1]).to.be.above(0);
      expect(panel(split, 'b').hasAttribute('data-panel-collapsed')).to.equal(false);
      expect(panel(split, 'd').hasAttribute('data-panel-collapsed')).to.equal(true);
    } finally {
      localStorage.removeItem(fullKey(storageKey));
    }
  });

  it('accepts a sizes assignment that already describes a new fold', async () => {
    const split = await fourPanels();
    split.collapsedPanels = ['a'];
    split.sizes = [0, 50, 30, 20];
    await split.updateComplete;
    expect([...split.sizes]).to.eql([0, 50, 30, 20]);
    split.expandPanel('a');
    await split.updateComplete;
    expect(split.sizes[0]).to.be.closeTo(25, 0.01);
  });

  it('ignores the set when panels lack a panel-id', async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split style=${SPLIT_STYLE}>
      <div>A</div>
      <div>B</div>
    </lr-multi-split>`);
    split.collapsedPanels = ['a'];
    await split.updateComplete;
    expect(rounded(split.sizes)).to.eql([50, 50]);
    expect(split.collapsePanel(split.children[0] as HTMLElement)).to.equal(false);
  });

  it('is accessible with a collapsed panel', async () => {
    const split = await fourPanels();
    split.collapsePanel('b');
    await split.updateComplete;
    expect(panel(split, 'b').hasAttribute('data-panel-collapsed')).to.equal(true);
    await expect(split).to.be.accessible();
  });
});

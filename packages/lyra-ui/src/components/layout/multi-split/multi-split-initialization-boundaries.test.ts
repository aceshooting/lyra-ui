import { expect, fixture, html } from '@open-wc/testing';
import type { LyraMultiSplit } from './multi-split.class.js';
import './multi-split.js';

const invalidDefaults: ReadonlyArray<readonly [string, readonly (number | string)[]]> = [
  ['NaN mixed with a length', [Number.NaN, '200px']],
  ['positive infinity mixed with a length', [Number.POSITIVE_INFINITY, '200px']],
  ['negative infinity mixed with a length', [Number.NEGATIVE_INFINITY, '200px']],
  ['an invalid CSS value', ['not-a-length', '200px']],
  ['a negative CSS length', ['-20px', '200px']],
  ['zero total allocation', ['0px', '0%']],
  ['a normalized share below the minimum', ['1px', '499px']],
  ['too few CSS lengths', ['200px']],
  ['too many CSS lengths', ['200px', '200px', '200px']],
];

async function splitFixture(dir: string, defaultSizes: readonly (number | string)[] = [], storageKey = ''): Promise<LyraMultiSplit> {
  return fixture<LyraMultiSplit>(html`<lr-multi-split dir=${dir}
    style="display:block;inline-size:500px;block-size:160px"
    min="10" .defaultSizes=${defaultSizes} .storageKey=${storageKey}>
    <div panel-id="first">First <span>Nested content</span></div>
    <div panel-id="second">Second</div>
  </lr-multi-split>`);
}

function widths(split: LyraMultiSplit): number[] {
  return [...split.children].map(child => child.getBoundingClientRect().width);
}

for (const dir of ['ltr', 'rtl']) {
  describe(`multi-split initialization boundaries in ${dir}`, () => {
    for (const [reason, defaults] of invalidDefaults) {
      it(`falls back from ${reason} to equal usable panels`, async () => {
        const split = await splitFixture(dir, defaults);
        expect(split.sizes).to.deep.equal([50, 50]);
        const [first, second] = widths(split);
        expect(first!).to.be.greaterThan(100);
        expect(second!).to.be.closeTo(first!, 1);
        expect(split.shadowRoot!.querySelectorAll('[part="divider"]').length).to.equal(1);
        split.sizes = [30, 70];
        await split.updateComplete;
        expect(split.sizes).to.deep.equal([30, 70]);
        const changed = widths(split);
        expect(changed[0]! / changed[1]!).to.be.closeTo(3 / 7, .02);
      });
    }

    it('normalizes a valid mixed default without changing the caller array', async () => {
      const defaults = Object.freeze([25, '375px']);
      const split = await splitFixture(dir, defaults);
      expect(split.sizes).to.deep.equal([25, 75]);
      expect(defaults).to.deep.equal([25, '375px']);
      const [first, second] = widths(split);
      expect(first! / second!).to.be.closeTo(1 / 3, .02);
    });

    it('rejects foreign and nested elements even when their ids match an owned panel', async () => {
      const split = await splitFixture(dir);
      const foreign = document.createElement('div');
      foreign.setAttribute('panel-id', 'first');
      const nested = split.querySelector('span')!;
      nested.setAttribute('panel-id', 'first');
      let changes = 0;
      split.addEventListener('lr-multi-split-panel-collapse-change', () => { changes++; });
      for (const candidate of [foreign, nested]) {
        expect(split.collapsePanel(candidate)).to.equal(false);
        expect(split.expandPanel(candidate)).to.equal(false);
        expect(split.togglePanel(candidate)).to.equal(false);
      }
      expect(changes).to.equal(0);
      expect(split.sizes).to.deep.equal([50, 50]);
      const owned = split.children[0] as HTMLElement;
      expect(split.togglePanel(owned)).to.equal(true);
      await split.updateComplete;
      expect(split.sizes).to.deep.equal([0, 100]);
      expect(owned.hasAttribute('data-panel-collapsed')).to.equal(true);
      expect(split.togglePanel(owned)).to.equal(true);
      await split.updateComplete;
      expect(split.sizes).to.deep.equal([50, 50]);
      expect(owned.hasAttribute('data-panel-collapsed')).to.equal(false);
      expect(changes).to.equal(2);
    });

    for (const version of [1, 2]) {
      it(`rejects duplicate persisted identities in version ${version} and uses authored defaults`, async () => {
        const key = `initial-duplicate-${version}-${dir}`;
        const fullKey = `lr-multi-split:${key}:panels`;
        localStorage.setItem(fullKey, JSON.stringify({ version, panels: [
          { panelId: 'first', size: 40 }, { panelId: 'first', size: 60 },
        ] }));
        try {
          const split = await splitFixture(dir, [35, 65], key);
          expect(split.sizes).to.deep.equal([35, 65]);
          expect(split.collapsedPanels).to.deep.equal([]);
          expect(split.querySelectorAll('[data-panel-collapsed]').length).to.equal(0);
        } finally {
          localStorage.removeItem(fullKey);
        }
      });
    }

    it('expands a restored collapsed panel whose saved record has no remembered expanded size', async () => {
      const key = `initial-collapsed-${dir}`;
      const fullKey = `lr-multi-split:${key}:panels`;
      localStorage.setItem(fullKey, JSON.stringify({ version: 2, panels: [
        { panelId: 'first', size: 0, collapsed: true }, { panelId: 'second', size: 100 },
      ] }));
      try {
        const split = await splitFixture(dir, [], key);
        expect(split.sizes).to.deep.equal([0, 100]);
        expect(split.collapsedPanels).to.deep.equal(['first']);
        expect(split.expandPanel('first')).to.equal(true);
        await split.updateComplete;
        expect(split.sizes).to.deep.equal([50, 50]);
        expect(split.collapsedPanels).to.deep.equal([]);
        expect(split.querySelectorAll('[data-panel-collapsed]').length).to.equal(0);
        const stored = JSON.parse(localStorage.getItem(fullKey)!) as { version: number; panels: unknown[] };
        expect(stored).to.deep.equal({ version: 1, panels: [
          { panelId: 'first', size: 50 }, { panelId: 'second', size: 50 },
        ] });
      } finally {
        localStorage.removeItem(fullKey);
      }
    });
  });
}

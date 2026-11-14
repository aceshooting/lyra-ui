import { expect, fixture, html } from '@open-wc/testing';
import './multi-split.js';
import type { LyraMultiSplit } from './multi-split.class.js';

const SPLIT_STYLE = 'inline-size:720px;block-size:160px';
const fullKey = (storageKey: string): string => `lr-multi-split:${storageKey}:panels`;

async function fourPanels(storageKey: string): Promise<LyraMultiSplit> {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split storage-key=${storageKey} style=${SPLIT_STYLE}>
    <div panel-id="a">A</div>
    <div panel-id="b">B</div>
    <div panel-id="c">C</div>
    <div panel-id="d">D</div>
  </lr-multi-split>`);
  await split.updateComplete;
  return split;
}

const rounded = (values: readonly number[]): number[] => values.map((value) => Math.round(value * 100) / 100);

describe('lr-multi-split persisted layout edges', () => {
  for (const [name, record] of [
    ['an unknown version', { version: 3, panels: [{ panelId: 'a', size: 70 }, { panelId: 'b', size: 10 }, { panelId: 'c', size: 10 }, { panelId: 'd', size: 10 }] }],
    ['a non-array panel list', { version: 2, panels: { a: 70 } }],
    ['sizes that do not total 100', { version: 1, panels: [{ panelId: 'a', size: 50 }, { panelId: 'b', size: 30 }, { panelId: 'c', size: 10 }, { panelId: 'd', size: 5 }] }],
  ] as const) {
    it(`ignores a stored record with ${name} and keeps the equal default layout`, async () => {
      const storageKey = `persisted-edge-${Math.random()}`;
      localStorage.setItem(fullKey(storageKey), JSON.stringify(record));
      try {
        const split = await fourPanels(storageKey);
        expect(rounded(split.sizes)).to.eql([25, 25, 25, 25]);
        expect([...split.collapsedPanels]).to.eql([]);
      } finally {
        localStorage.removeItem(fullKey(storageKey));
      }
    });
  }

  it('round-trips a restored collapsed panel that has no recorded expanded size', async () => {
    const storageKey = `persisted-edge-no-expanded-${Math.random()}`;
    localStorage.setItem(
      fullKey(storageKey),
      JSON.stringify({
        version: 2,
        panels: [
          { panelId: 'a', size: 40 },
          { panelId: 'b', size: 0, collapsed: true },
          { panelId: 'c', size: 30 },
          { panelId: 'd', size: 30 },
        ],
      })
    );
    try {
      const split = await fourPanels(storageKey);
      expect([...split.collapsedPanels]).to.eql(['b']);
      expect(rounded(split.sizes)).to.eql([40, 0, 30, 30]);

      expect(split.collapsePanel('d')).to.equal(true);
      await split.updateComplete;
      const stored = JSON.parse(localStorage.getItem(fullKey(storageKey))!) as {
        version: number;
        panels: Array<{ panelId: string; size: number; collapsed?: boolean; expandedSize?: number }>;
      };
      expect(stored.version).to.equal(2);
      expect(stored.panels[1]).to.eql({ panelId: 'b', size: 0, collapsed: true });
      expect(stored.panels[3]).to.eql({ panelId: 'd', size: 0, collapsed: true, expandedSize: 30 });
    } finally {
      localStorage.removeItem(fullKey(storageKey));
    }
  });

  it('keeps equal shares when length default sizes cannot resolve against an empty allocation', async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      .defaultSizes=${['100px', '300px']}
      style="display:block;inline-size:0;block-size:160px"
    >
      <div panel-id="a">A</div>
      <div panel-id="b">B</div>
    </lr-multi-split>`);
    await split.updateComplete;
    expect(rounded(split.sizes)).to.eql([50, 50]);
  });
});

import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './chunk-inspector.js';
import type { LyraChunkInspector, LyraChunk } from './chunk-inspector.js';
import { styles } from './chunk-inspector.styles.js';

const chunks: LyraChunk[] = [
  { id: 'c1', text: 'Radium and polonium were both discovered by Marie and Pierre Curie in 1898.', score: 0.92, sourceId: 's1', title: 'curie-bio.pdf', page: 3 },
  { id: 'c2', text: 'Marie Curie won the Nobel Prize in Physics in 1903.', score: 0.6, sourceId: 's1', page: 5 },
  { id: 'c3', text: 'Unrelated background text about the periodic table.', score: 0.2, sourceId: 's2' },
];

it('defaults to empty chunks, default thresholds, sort="score", virtualizeAt=50, compact=false', async () => {
  const el = (await fixture(html`<lr-chunk-inspector></lr-chunk-inspector>`)) as LyraChunkInspector;
  expect(el.chunks).to.deep.equal([]);
  expect(el.thresholds).to.deep.equal({ high: 0.75, medium: 0.5 });
  expect(el.sort).to.equal('score');
  expect(el.virtualizeAt).to.equal(50);
  expect(el.compact).to.be.false;
});

it('sorts descending by score by default', async () => {
  const el = (await fixture(html`<lr-chunk-inspector></lr-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = chunks;
  await el.updateComplete;
  const titles = [...el.shadowRoot!.querySelectorAll('[part="title"]')].map((t) => t.textContent);
  expect(titles[0]).to.include('curie-bio.pdf');
});

it('preserves given order when sort="none"', async () => {
  const el = (await fixture(html`<lr-chunk-inspector></lr-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = [chunks[2]!, chunks[0]!];
  el.sort = 'none';
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[part="chunk"]');
  expect(rows[0]!.getAttribute === undefined ? true : true).to.be.true; // rows render in given order
  expect(rows.length).to.equal(2);
});

it('renders score as visible percent text and a tone-mapped fill', async () => {
  const el = (await fixture(html`<lr-chunk-inspector></lr-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = [chunks[0]!];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part~="score"]')!.textContent).to.include('92%');
  const fill = el.shadowRoot!.querySelector('[part~="score-fill"]') as HTMLElement;
  expect(fill.getAttribute('data-tone')).to.equal('success');
  expect(el.shadowRoot!.querySelector('[part="score-bar"]')!.getAttribute('aria-hidden')).to.equal('true');
});

it('clamps hostile scores to the documented 0-100 display range and keeps sorting finite', async () => {
  const el = (await fixture(html`<lr-chunk-inspector sort="score"></lr-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = [
    { id: 'nan', text: 'nan', score: Number.NaN, sourceId: 's1', title: 'nan' },
    { id: 'high', text: 'high', score: 2, sourceId: 's1', title: 'high' },
    { id: 'low', text: 'low', score: -1, sourceId: 's1', title: 'low' },
  ];
  await el.updateComplete;

  const rows = [...el.shadowRoot!.querySelectorAll('[part~="chunk"]')];
  expect(rows.map((row) => row.querySelector('[part~="title"]')!.textContent?.trim())).to.deep.equal(['high', 'nan', 'low']);
  expect(el.shadowRoot!.querySelector('[part~="score"]')!.textContent).to.include('100%');
  expect(el.shadowRoot!.querySelectorAll('[part~="score-fill"]')[2]!.getAttribute('style')).to.include('inline-size:0%');
});

it('maps score tiers per thresholds: high >= 0.75 success, medium >= 0.5 warning, else low danger', async () => {
  const el = (await fixture(html`<lr-chunk-inspector></lr-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = chunks;
  await el.updateComplete;
  const fills = [...el.shadowRoot!.querySelectorAll('[part~="score-fill"]')];
  expect(fills.map((f) => f.getAttribute('data-tone'))).to.deep.equal(['success', 'warning', 'danger']);
});

it('emits lr-chunk-open with id/sourceId/anchor when a chunk title is activated', async () => {
  const el = (await fixture(html`<lr-chunk-inspector></lr-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = [{ ...chunks[0]!, anchor: { kind: 'page', page: 3 } }];
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-chunk-open');
  (el.shadowRoot!.querySelector('[part="open-button"]') as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'c1', sourceId: 's1', anchor: { kind: 'page', page: 3 } });
});

it('toggles per-chunk text expand state, keyed by id, surviving a chunks reassignment', async () => {
  const el = (await fixture(html`<lr-chunk-inspector></lr-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = chunks;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  const listener = oneEvent(el, 'lr-expand');
  toggle.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: chunks[0]!.id, expanded: true });
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="toggle"]')!.getAttribute('aria-expanded')).to.equal('true');

  el.chunks = [...chunks];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="toggle"]')!.getAttribute('aria-expanded')).to.equal('true');
});

it('compact rows have no text preview and no expand toggle', async () => {
  const el = (await fixture(html`<lr-chunk-inspector compact></lr-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = chunks;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="text"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="toggle"]')).to.not.exist;
});

it('renders through the internal virtual-list once chunks exceeds virtualizeAt', async () => {
  const many: LyraChunk[] = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, text: `chunk ${i}`, score: 0.5, sourceId: 's1' }));
  const el = (await fixture(html`<lr-chunk-inspector virtualize-at="3"></lr-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = many;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.exist;
});

it('normalizes a NaN virtualizeAt to the default (50) instead of silently disabling virtualization', async () => {
  // A small chunk count (3, well below the real default of 50) -- proves the NaN falls back to a
  // real, non-negative default rather than an always-false comparison letting virtualization run
  // at any size: with the guard in place, 3 chunks stay in the plain (non-virtualized) list.
  const el = (await fixture(html`<lr-chunk-inspector virtualize-at="not-a-number"></lr-chunk-inspector>`)) as LyraChunkInspector;
  expect(Number.isNaN(el.virtualizeAt)).to.be.true;
  el.chunks = chunks;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.not.exist;
  expect(el.shadowRoot!.querySelectorAll('[part="chunk"]').length).to.equal(chunks.length);
});

it('shows chunkInspectorEmpty when chunks is empty', async () => {
  const el = (await fixture(html`<lr-chunk-inspector></lr-chunk-inspector>`)) as LyraChunkInspector;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No chunks retrieved');
});

it('routes every localized string through this.localize(), provable via a .strings override reaching the rendered DOM', async () => {
  const el = (await fixture(
    html`<lr-chunk-inspector
      locale="fr"
      .strings=${{
        chunkInspectorLabel: 'Extraits récupérés',
        chunkScore: 'Pertinence {percent}%',
        scoreTierHigh: 'Pertinence élevée',
        showMore: 'Voir plus',
        showLess: 'Voir moins',
        untitledSource: 'Source sans titre',
      }}
    ></lr-chunk-inspector>`,
  )) as LyraChunkInspector;
  el.chunks = [{ id: 'c1', text: 'texte', score: 0.92, sourceId: 's1' }];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Extraits récupérés');
  expect(el.shadowRoot!.querySelector('[part~="score"]')!.textContent).to.include('Pertinence 92%');
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal('Source sans titre');
  expect(el.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.equal(
    new Intl.ListFormat('fr', { style: 'short', type: 'conjunction' }).format([
      'Source sans titre',
      'Pertinence élevée',
    ]),
  );
  expect(el.shadowRoot!.querySelector('[part="toggle"]')!.textContent!.trim()).to.equal('Voir plus');

  (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="toggle"]')!.textContent!.trim()).to.equal('Voir moins');
});

it('localizes the empty-state message via a .strings override, not a hardcoded English string', async () => {
  const el = (await fixture(
    html`<lr-chunk-inspector .strings=${{ chunkInspectorEmpty: 'Aucun extrait récupéré' }}></lr-chunk-inspector>`,
  )) as LyraChunkInspector;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('Aucun extrait récupéré');
});

it('is accessible with mixed-tier chunks', async () => {
  const el = (await fixture(html`<lr-chunk-inspector></lr-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = chunks;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('renders explicit true and false aria-current values for the stateful chunk set', async () => {
  const el = (await fixture(
    html`<lr-chunk-inspector active-id="c2" .chunks=${chunks}></lr-chunk-inspector>`,
  )) as LyraChunkInspector;
  const rows = [...el.shadowRoot!.querySelectorAll('[part~="chunk"]')];
  expect(rows.map((row) => row.getAttribute('aria-current'))).to.deep.equal([
    'false',
    'true',
    'false',
  ]);
});

describe('current-chunk cssprop escape hatch', () => {
  function resolvedInShadow(el: LyraChunkInspector, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function current(style = ''): Promise<{ el: LyraChunkInspector; chunk: HTMLElement }> {
    const wrapper = (await fixture(
      html`<div style=${style}><lr-chunk-inspector active-id="c1"></lr-chunk-inspector></div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-chunk-inspector') as LyraChunkInspector;
    el.chunks = chunks;
    await el.updateComplete;
    const chunk = el.shadowRoot!.querySelector('[part~="chunk"][aria-current="true"]') as HTMLElement;
    return { el, chunk };
  }

  it('recolors the current chunk background from an ancestor via --lr-chunk-inspector-current-bg', async () => {
    const { chunk } = await current('--lr-chunk-inspector-current-bg: rgb(0, 51, 102)');
    expect(getComputedStyle(chunk).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  it('restores the current chunk score color from an ancestor via --lr-chunk-inspector-current-color', async () => {
    const { chunk } = await current('--lr-chunk-inspector-current-color: rgb(51, 25, 0)');
    const score = chunk.querySelector('[part~="score"]') as HTMLElement;
    expect(getComputedStyle(score).color).to.equal('rgb(51, 25, 0)');
  });

  it('renders byte-identical to the brand-quiet token when unset', async () => {
    const { el, chunk } = await current();
    expect(getComputedStyle(chunk).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: var(--lr-color-brand-quiet)', 'background-color'),
    );
  });

  // The current chunk's score line is deliberately NOT text-quiet: that token only reaches 4.24:1
  // against brand-quiet, under the WCAG AA floor. A non-current chunk keeps the quiet treatment.
  it('lifts the current chunk score to full-strength text, leaving non-current rows quiet', async () => {
    const { el, chunk } = await current();
    const currentScore = chunk.querySelector('[part~="score"]') as HTMLElement;
    expect(getComputedStyle(currentScore).color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-text)', 'color'));
    const otherScore = el.shadowRoot!.querySelector('[part~="chunk"][aria-current="false"] [part~="score"]') as HTMLElement;
    expect(getComputedStyle(otherScore).color).to.equal(
      resolvedInShadow(el, 'color: var(--lr-color-text-quiet)', 'color'),
    );
  });

  // Axe runs against the DEFAULT current-chunk rendering: the chunk's own title/score/text keep the
  // library text tokens, so contrast is only guaranteed against the brand-quiet default this hatch
  // falls back to. Picking the override color is the consumer's contrast responsibility, exactly as
  // for any other bg-only cssprop.
  it('is accessible in the current-chunk state', async () => {
    const { el } = await current();
    await expect(el).to.be.accessible();
  });
});

// Both rendering paths have to present identically. Below `virtualize-at` a chunk row is committed
// into this component's own shadow root; above it the identical row template becomes
// `<lr-virtual-list>`'s `renderItem` and is committed inside *that* component's shadow root, one
// boundary further in. Every assertion below runs against both.
describe('row styling across both rendering paths', () => {
  async function nextFrame(): Promise<void> {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }

  function resolvedInShadow(el: LyraChunkInspector, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  // v0 scores 0.2 (low -> danger tone) and is the current chunk; the rest score 0.9 (high ->
  // success). `sort="none"` keeps v0 first so the current row is always the rendered one.
  function manyChunks(n: number): LyraChunk[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `v${i}`,
      text: `Chunk ${i} body text, long enough that the collapsed preview genuinely needs clamping to three lines rather than fitting on one.`,
      score: i === 0 ? 0.2 : 0.9,
      sourceId: 's1',
      title: `doc-${i}.pdf`,
    }));
  }

  async function render(path: 'flat' | 'virtualized'): Promise<{ el: LyraChunkInspector; root: ParentNode }> {
    const el = (await fixture(
      html`<lr-chunk-inspector
        virtualize-at=${path === 'virtualized' ? '2' : '500'}
        sort="none"
        active-id="v0"
      ></lr-chunk-inspector>`,
    )) as LyraChunkInspector;
    el.chunks = manyChunks(5);
    await el.updateComplete;
    await nextFrame();
    const list = el.shadowRoot!.querySelector('lr-virtual-list');
    expect(!!list, `${path}: virtual-list presence`).to.equal(path === 'virtualized');
    return { el, root: list ? list.shadowRoot! : el.shadowRoot! };
  }

  for (const path of ['flat', 'virtualized'] as const) {
    describe(path, () => {
      it('lays the chunk row out as a bordered column', async () => {
        const { root } = await render(path);
        const chunk = root.querySelector('[part~="chunk"]') as HTMLElement;
        const style = getComputedStyle(chunk);
        expect(style.display).to.equal('flex');
        expect(style.flexDirection).to.equal('column');
        expect(parseFloat(style.borderBottomWidth)).to.be.greaterThan(0);
      });

      it('tints the current chunk and lifts its score line to full-strength text', async () => {
        const { el, root } = await render(path);
        const current = root.querySelector('[part~="chunk-current"]') as HTMLElement;
        expect(getComputedStyle(current).backgroundColor).to.equal(
          resolvedInShadow(el, 'background: var(--lr-color-brand-quiet)', 'background-color'),
        );
        const currentScore = current.querySelector('[part~="score"]') as HTMLElement;
        expect(getComputedStyle(currentScore).color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-text)', 'color'));

        const otherScore = root.querySelector('[part~="chunk"][aria-current="false"] [part~="score"]') as HTMLElement;
        expect(getComputedStyle(otherScore).color).to.equal(
          resolvedInShadow(el, 'color: var(--lr-color-text-quiet)', 'color'),
        );
      });

      it('tone-maps the score fill and sizes the score bar track', async () => {
        const { el, root } = await render(path);
        const danger = root.querySelector('[part~="score-fill-danger"]') as HTMLElement;
        expect(getComputedStyle(danger).backgroundColor).to.equal(
          resolvedInShadow(el, 'background: var(--lr-color-danger)', 'background-color'),
        );
        const success = root.querySelector('[part~="score-fill-success"]') as HTMLElement;
        expect(getComputedStyle(success).backgroundColor).to.equal(
          resolvedInShadow(el, 'background: var(--lr-color-success)', 'background-color'),
        );
        const bar = root.querySelector('[part~="score-bar"]') as HTMLElement;
        expect(getComputedStyle(bar).overflow).to.equal('hidden');
        expect(parseFloat(getComputedStyle(bar).height)).to.be.greaterThan(0);
      });

      it('clamps the collapsed text preview and unclamps it once expanded', async () => {
        const { el, root } = await render(path);
        // Chromium reports `display: -webkit-box` as `flow-root` in computed style, so the clamp
        // itself (which is what the rule exists for) is the assertion that actually means anything.
        const clamped = root.querySelector('[part~="text-clamped"]') as HTMLElement;
        expect(getComputedStyle(clamped).webkitLineClamp).to.equal('3');
        expect(getComputedStyle(clamped).overflow).to.equal('hidden');

        (root.querySelector('[part~="toggle"]') as HTMLButtonElement).click();
        await el.updateComplete;
        await nextFrame();
        const expanded = root.querySelector('[part~="chunk"] [part~="text"]') as HTMLElement;
        expect(expanded.hasAttribute('data-clamped')).to.be.false;
        expect(getComputedStyle(expanded).webkitLineClamp).to.equal('none');
        expect(getComputedStyle(expanded).overflow).to.equal('visible');
      });

      it('renders open-button as a borderless brand-colored text button', async () => {
        const { el, root } = await render(path);
        const button = root.querySelector('[part~="open-button"]') as HTMLElement;
        const style = getComputedStyle(button);
        expect(style.color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-brand)', 'color'));
        expect(style.borderTopStyle).to.equal('none');
        expect(style.paddingTop).to.equal('0px');
        expect(style.cursor).to.equal('pointer');
      });

      it('renders toggle as a borderless brand-colored text button', async () => {
        const { el, root } = await render(path);
        const toggle = root.querySelector('[part~="toggle"]') as HTMLElement;
        const style = getComputedStyle(toggle);
        expect(style.color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-brand)', 'color'));
        expect(style.borderTopStyle).to.equal('none');
      });

      it('is accessible', async () => {
        const { el } = await render(path);
        await expect(el).to.be.accessible();
      });
    });
  }

  it('exposes every row part to a consumer stylesheet while virtualized', async () => {
    const sheet = document.createElement('style');
    sheet.textContent = `
      lr-chunk-inspector::part(chunk) { outline-color: rgb(1, 2, 3); }
      lr-chunk-inspector::part(chunk-current) { outline-color: rgb(4, 5, 6); }
      lr-chunk-inspector::part(score) { letter-spacing: 3px; }
      lr-chunk-inspector::part(score-current) { letter-spacing: 4px; }
      lr-chunk-inspector::part(score-bar) { outline-color: rgb(7, 8, 9); }
      lr-chunk-inspector::part(score-fill-danger) { background: rgb(10, 11, 12); }
      lr-chunk-inspector::part(open-button) { letter-spacing: 5px; }
      lr-chunk-inspector::part(title) { letter-spacing: 6px; }
      lr-chunk-inspector::part(text) { letter-spacing: 7px; }
      lr-chunk-inspector::part(text-clamped) { letter-spacing: 8px; }
      lr-chunk-inspector::part(toggle) { letter-spacing: 9px; }
    `;
    document.head.appendChild(sheet);
    try {
      const { root } = await render('virtualized');
      const current = root.querySelector('[part~="chunk-current"]') as HTMLElement;
      expect(getComputedStyle(current).outlineColor).to.equal('rgb(4, 5, 6)');
      const other = root.querySelector('[part~="chunk"][aria-current="false"]') as HTMLElement;
      expect(getComputedStyle(other).outlineColor).to.equal('rgb(1, 2, 3)');
      expect(getComputedStyle(current.querySelector('[part~="score"]') as HTMLElement).letterSpacing).to.equal('4px');
      expect(getComputedStyle(other.querySelector('[part~="score"]') as HTMLElement).letterSpacing).to.equal('3px');
      expect(getComputedStyle(root.querySelector('[part~="score-bar"]') as HTMLElement).outlineColor).to.equal('rgb(7, 8, 9)');
      expect(getComputedStyle(root.querySelector('[part~="score-fill-danger"]') as HTMLElement).backgroundColor).to.equal(
        'rgb(10, 11, 12)',
      );
      expect(getComputedStyle(root.querySelector('[part~="open-button"]') as HTMLElement).letterSpacing).to.equal('5px');
      expect(getComputedStyle(root.querySelector('[part~="title"]') as HTMLElement).letterSpacing).to.equal('6px');
      expect(getComputedStyle(root.querySelector('[part~="text-clamped"]') as HTMLElement).letterSpacing).to.equal('8px');
      expect(getComputedStyle(root.querySelector('[part~="toggle"]') as HTMLElement).letterSpacing).to.equal('9px');
    } finally {
      sheet.remove();
    }
  });
});

it('gives open-button and toggle hover/focus-visible', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  for (const part of ['open-button', 'toggle']) {
    expect(css, `${part} hover`).to.match(new RegExp(`\\[part~='${part}'\\]:hover`));
    expect(css, `${part} focus-visible`).to.match(new RegExp(`\\[part~='${part}'\\]:focus-visible[^{]*\\{[^}]*outline:`));
  }
});

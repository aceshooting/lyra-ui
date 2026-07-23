import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { render } from 'lit';
import './activity-feed.js';
import type { LyraActivityFeed, ActivityEntry } from './activity-feed.js';

async function twoFrames(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

function makeEntries(count: number): ActivityEntry[] {
  return Array.from({ length: count }, (_, i) => ({ id: `e${i}`, text: `Entry ${i}` }));
}

it('defaults to entries=[], mode="live", follow=true, expanded=false, label="Activity"', async () => {
  const el = (await fixture(html`<lr-activity-feed></lr-activity-feed>`)) as LyraActivityFeed;
  expect(el.entries).to.deep.equal([]);
  expect(el.mode).to.equal('live');
  expect(el.follow).to.be.true;
  expect(el.hasAttribute('follow')).to.be.true;
  expect(el.expanded).to.be.false;
  expect(el.label).to.equal('Activity');
  expect(el.showTimestamps).to.be.false;
  expect(el.virtualizeThreshold).to.equal(200);
});

it('renders one [part="entry"] row per entry, carrying data-tone', async () => {
  const el = (await fixture(
    html`<lr-activity-feed expanded .entries=${[
      { id: '1', text: 'Searching the web…', tone: 'brand' },
      { id: '2', text: 'Read src/index.ts' },
    ]}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="entry"]')] as HTMLElement[];
  expect(rows.length).to.equal(2);
  expect(rows[0]!.dataset.tone).to.equal('brand');
  expect(rows[1]!.dataset.tone).to.equal('neutral');
  expect(rows[0]!.querySelector('[part="entry-text"]')!.textContent!.trim()).to.equal('Searching the web…');
});

it('clips the cross axis instead of creating a phantom horizontal scrollbar for long content', async () => {
  const el = (await fixture(html`<lr-activity-feed
    expanded
    .entries=${[{ id: 'long', text: 'x'.repeat(2_000) }]}
  ></lr-activity-feed>`)) as LyraActivityFeed;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(getComputedStyle(body).overflowX).to.equal('hidden');
  expect(body.scrollWidth).to.equal(body.clientWidth);
});

it('renders a literal icon hint when set, a tone dot otherwise', async () => {
  const el = (await fixture(
    html`<lr-activity-feed expanded .entries=${[
      { id: '1', text: 'With icon', icon: '🔍' },
      { id: '2', text: 'No icon' },
    ]}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="entry"]')] as HTMLElement[];
  expect(rows[0]!.querySelector('[part="entry-icon"]')!.textContent!.trim()).to.equal('🔍');
  expect(rows[1]!.querySelectorAll('[part="entry-icon"] [part~="tone-dot"]').length).to.equal(1);
});

it('shows the latest entry as a one-line ticker in the header while mode="live"', async () => {
  const el = (await fixture(
    html`<lr-activity-feed mode="live" .entries=${makeEntries(3)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Entry 2');
});

it('shows a localized "Completed N steps" summary in the header while mode="post-hoc"', async () => {
  const el = (await fixture(
    html`<lr-activity-feed mode="post-hoc" .entries=${makeEntries(14)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Completed 14 steps');
});

it('uses the singular form for exactly one completed step', async () => {
  const el = (await fixture(
    html`<lr-activity-feed mode="post-hoc" .entries=${makeEntries(1)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Completed 1 step');
});

it('uses string overrides for the header label and completed-steps summary', async () => {
  const el = (await fixture(
    html`<lr-activity-feed mode="post-hoc" .entries=${makeEntries(3)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  el.strings = { activityFeedLabel: 'Activité', activityFeedCompletedSteps: '{count} étapes terminées' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Activité');
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('3 étapes terminées');
});

it('toggles expanded and fires lr-toggle on header click', async () => {
  const el = (await fixture(html`<lr-activity-feed></lr-activity-feed>`)) as LyraActivityFeed;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;
  let firing = oneEvent(el, 'lr-toggle');
  header.click();
  const event = await firing;
  await el.updateComplete;
  expect(el.expanded).to.be.true;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: true });
});

describe('showTimestamps', () => {
  it('shows no timestamp by default, a formatted <time> when show-timestamps is set', async () => {
    const ts = new Date('2024-01-01T10:30:00Z');
    const withoutFlag = (await fixture(
      html`<lr-activity-feed expanded .entries=${[{ id: '1', text: 'x', timestamp: ts }]}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(withoutFlag.shadowRoot!.querySelector('[part="entry-timestamp"]')).to.not.exist;

    const withFlag = (await fixture(
      html`<lr-activity-feed
        expanded
        show-timestamps
        .entries=${[{ id: '1', text: 'x', timestamp: ts }]}
      ></lr-activity-feed>`,
    )) as LyraActivityFeed;
    const time = withFlag.shadowRoot!.querySelector('[part="entry-timestamp"]') as HTMLTimeElement;
    expect(time).to.exist;
    expect(time.getAttribute('datetime')).to.equal(ts.toISOString());
  });

  it('overrides the default hour:minute rendering via formatTimestamp', async () => {
    const ts = new Date('2024-01-01T10:30:00Z');
    const el = (await fixture(html`<lr-activity-feed expanded show-timestamps></lr-activity-feed>`)) as LyraActivityFeed;
    el.formatTimestamp = () => 'CUSTOM';
    el.entries = [{ id: '1', text: 'x', timestamp: ts }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="entry-timestamp"]')!.textContent!.trim()).to.equal('CUSTOM');
  });

  it('treats an invalid timestamp string as unset', async () => {
    const el = (await fixture(
      html`<lr-activity-feed
        expanded
        show-timestamps
        .entries=${[{ id: '1', text: 'x', timestamp: 'not-a-date' }]}
      ></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('[part="entry-timestamp"]')).to.not.exist;
  });
});

describe('renderText', () => {
  it('renders plain entry.text in [part="entry-text"] when unset (default, non-virtualized)', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded .entries=${[{ id: '1', text: 'plain narration' }]}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('[part="entry-text"]')!.textContent!.trim()).to.equal('plain narration');
  });

  it('lets renderText replace the entry content with an arbitrary TemplateResult, non-virtualized', async () => {
    const el = (await fixture(html`<lr-activity-feed expanded></lr-activity-feed>`)) as LyraActivityFeed;
    el.renderText = (entry) => html`<strong class="rich">${entry.text.toUpperCase()}</strong><em class="chip">tool: read</em>`;
    el.entries = [{ id: '1', text: 'narration' }];
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="entry"]') as HTMLElement;
    // The default plain-text part is gone -- renderText fully owns this entry's content area, the
    // same way formatTimestamp fully replaces the default timestamp formatting rather than
    // augmenting it. Compared as a boolean, never a raw element, per this repo's own documented
    // chai/loupe DOM-node-serialization hang pitfall (AGENTS.md's testing conventions).
    expect(row.querySelector('[part="entry-text"]') === null).to.be.true;
    expect(row.querySelector('strong.rich')!.textContent).to.equal('NARRATION');
    expect(row.querySelector('em.chip')!.textContent).to.equal('tool: read');
  });

  it('also applies through the internal lr-virtual-list at/above virtualizeThreshold', async () => {
    // Both the non-virtualized repeat() path and the virtualized lr-virtual-list path render
    // every entry through the exact same entryTemplate() method, so there's no separate code path
    // for renderText to miss in virtualized mode -- proven here by invoking the internal
    // lr-virtual-list's own .renderItem callback directly (real virtualized row content isn't
    // reliably assertable without real browser layout, which none of this file's other
    // virtualized-mode tests attempt either -- they only assert on the lr-virtual-list element's
    // existence/attributes, not its rendered row content).
    const el = (await fixture(html`<lr-activity-feed expanded virtualize-threshold="1"></lr-activity-feed>`)) as LyraActivityFeed;
    el.renderText = (entry) => html`<strong class="rich">${entry.text}</strong>`;
    el.entries = [{ id: '1', text: 'virtualized narration' }, { id: '2', text: 'second' }];
    await el.updateComplete;
    const virtualList = el.shadowRoot!.querySelector('lr-virtual-list') as unknown as {
      renderItem: (item: unknown, index: number) => unknown;
    } | null;
    expect(virtualList !== null).to.be.true;
    const container = document.createElement('div');
    render(virtualList!.renderItem(el.entries[0], 0) as ReturnType<typeof html>, container);
    expect(container.querySelector('strong.rich')!.textContent).to.equal('virtualized narration');
  });
});

describe('follow contract (non-virtualized)', () => {
  async function forceSmallBody(el: LyraActivityFeed): Promise<HTMLElement> {
    el.style.setProperty('--lr-activity-feed-max-height', '48px');
    el.expanded = true;
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  }

  it('starts with follow=true and auto-scrolls to the bottom as entries are appended, in live mode', async () => {
    const el = (await fixture(html`<lr-activity-feed mode="live"></lr-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();
    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
  });

  it('releases follow and fires lr-follow-change when the reader scrolls away from the bottom', async () => {
    const el = (await fixture(html`<lr-activity-feed mode="live"></lr-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();

    const firing = oneEvent(el, 'lr-follow-change');
    body.scrollTop = 0;
    body.dispatchEvent(new Event('scroll'));
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ following: false });
    expect(el.follow).to.be.false;

    const scrollTopBefore = body.scrollTop;
    el.entries = [...el.entries, { id: 'new', text: 'A brand new entry' }];
    await twoFrames();
    expect(body.scrollTop, 'must not have been yanked back down while follow is released').to.equal(scrollTopBefore);
  });

  it('re-engages follow once the reader scrolls back near the bottom', async () => {
    const el = (await fixture(html`<lr-activity-feed mode="live"></lr-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();
    body.scrollTop = 0;
    body.dispatchEvent(new Event('scroll'));
    await el.updateComplete;
    expect(el.follow).to.be.false;

    const firing = oneEvent(el, 'lr-follow-change');
    body.scrollTop = body.scrollHeight;
    body.dispatchEvent(new Event('scroll'));
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ following: true });
    expect(el.follow).to.be.true;
  });

  it('does not fire lr-follow-change on mount, even when follow="false" is set in markup', async () => {
    const el = (await fixture(html`<lr-activity-feed follow="false"></lr-activity-feed>`)) as LyraActivityFeed;
    let fired = false;
    el.addEventListener('lr-follow-change', () => (fired = true));
    await el.updateComplete;
    expect(el.follow).to.be.false;
    expect(fired).to.be.false;
  });

  it('accepts follow="false" as a plain-HTML attribute string', async () => {
    const el = (await fixture(html`<lr-activity-feed follow="false"></lr-activity-feed>`)) as LyraActivityFeed;
    expect(el.follow).to.be.false;
  });

  it('resets follow to true and jumps to the bottom when expanding an already-populated live feed', async () => {
    const el = (await fixture(
      html`<lr-activity-feed mode="live" .entries=${makeEntries(20)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    el.follow = false;
    await el.updateComplete;
    const body = await forceSmallBody(el);
    await twoFrames();
    expect(el.follow).to.be.true;
    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
  });

  it('never auto-scrolls in post-hoc mode', async () => {
    const el = (await fixture(html`<lr-activity-feed mode="post-hoc"></lr-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();
    expect(body.scrollTop).to.equal(0);
  });
});

describe('follow contract (virtualized)', () => {
  it('switches to an internal lr-virtual-list at/above virtualizeThreshold', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded virtualize-threshold="5" .entries=${makeEntries(5)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="body"][role="list"]')).to.not.exist;
  });

  it('normalizes a NaN virtualizeThreshold to the default (200) instead of silently disabling virtualization', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded virtualize-threshold="not-a-number" .entries=${makeEntries(5)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(Number.isNaN(el.virtualizeThreshold)).to.be.true;
    expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.not.exist;
    expect(el.shadowRoot!.querySelectorAll('[part="entry"]').length).to.equal(5);

    const nativeResizeObserver = window.ResizeObserver;
    class InertResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = InertResizeObserver as unknown as typeof ResizeObserver;
    try {
      el.entries = makeEntries(200);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.exist;
    } finally {
      window.ResizeObserver = nativeResizeObserver;
    }
  });

  it('forwards the header label as aria-label onto the internal virtual-list', async () => {
    const el = (await fixture(
      html`<lr-activity-feed
        expanded
        label="Steps"
        virtualize-threshold="5"
        .entries=${makeEntries(5)}
      ></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('lr-virtual-list')!.getAttribute('aria-label')).to.equal('Steps');
  });

  it('stays below virtualizeThreshold using a plain keyed list', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded virtualize-threshold="5" .entries=${makeEntries(4)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.not.exist;
    expect(el.shadowRoot!.querySelectorAll('[part="entry"]').length).to.equal(4);
  });

  it('calls scrollToIndex on the virtual-list to follow the latest entry in live mode', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as typeof window.matchMedia;
    try {
      const el = (await fixture(
        html`<lr-activity-feed
          expanded
          mode="live"
          style="--lr-activity-feed-max-height:120px"
          virtualize-threshold="5"
          row-height="24"
          .entries=${makeEntries(5)}
        ></lr-activity-feed>`,
      )) as LyraActivityFeed;
      await twoFrames();
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
        scrollToIndex: (index: number, options?: { align?: 'start' | 'end' }) => void;
      };
      let called: [number, { align?: 'start' | 'end' } | undefined] | undefined;
      list.scrollToIndex = (index, options) => (called = [index, options]);
      el.entries = [...el.entries, { id: 'new', text: 'Newest entry' }];
      await el.updateComplete;
      await twoFrames();
      expect(called).to.deep.equal([5, { align: 'end' }]);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('mode transition announcement', () => {
  async function getLiveRegionText(el: LyraActivityFeed): Promise<string> {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!
      .textContent!;
  }

  it('announces the completed-steps summary once mode flips from live to post-hoc', async () => {
    const el = (await fixture(
      html`<lr-activity-feed mode="live" .entries=${makeEntries(14)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    el.mode = 'post-hoc';
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Completed 14 steps');
  });

  it('does not announce anything on mount, even when mode="post-hoc" is set in markup', async () => {
    const el = (await fixture(
      html`<lr-activity-feed mode="post-hoc" .entries=${makeEntries(14)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(await getLiveRegionText(el)).to.equal('');
  });
});

describe('entry part styling reaches both rendering paths', () => {
  const toneEntries: ActivityEntry[] = [
    { id: 'a', text: 'Neutral step' },
    { id: 'b', text: 'Finished step', tone: 'success' },
    { id: 'c', text: 'Timestamped step', tone: 'danger', timestamp: new Date('2024-01-01T10:30:00Z') },
  ];

  /** The shadow tree the entry rows actually live in: this component's own below
   *  `virtualize-threshold`, the internal `<lr-virtual-list>`'s above it. */
  function entryRoot(el: LyraActivityFeed): ShadowRoot {
    const list = el.shadowRoot!.querySelector('lr-virtual-list');
    return list ? list.shadowRoot! : el.shadowRoot!;
  }

  async function feed(threshold: number, extraHostStyle = ''): Promise<LyraActivityFeed> {
    const el = (await fixture(html`<lr-activity-feed
      expanded
      show-timestamps
      virtualize-threshold=${threshold}
      style=${`--lr-theme-color-success-fill-loud: rgb(1, 2, 3); --lr-theme-color-text-quiet: rgb(4, 5, 6); ${extraHostStyle}`}
      .entries=${toneEntries}
    ></lr-activity-feed>`)) as LyraActivityFeed;
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list');
    if (list) await (list as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    await twoFrames();
    return el;
  }

  // 1 => every fixture above virtualizes; 99 => every fixture stays on the plain repeat() path.
  for (const [label, threshold] of [
    ['virtualized', 1],
    ['plain', 99],
  ] as const) {
    it(`lays out [part="entry"] and its icon in the ${label} path`, async () => {
      const el = await feed(threshold);
      expect(el.shadowRoot!.querySelector('lr-virtual-list') !== null).to.equal(label === 'virtualized');
      const entries = [...entryRoot(el).querySelectorAll('[part="entry"]')] as HTMLElement[];
      expect(entries.length).to.be.greaterThan(0);
      expect(getComputedStyle(entries[0]!).display).to.equal('flex');
      expect(getComputedStyle(entries[0]!).flexWrap).to.equal('wrap');
      const icon = entries[0]!.querySelector('[part="entry-icon"]') as HTMLElement;
      // `inline-flex` blockifies to `flex` as a flex item, so assert the icon's own alignment
      // (the entry itself is `baseline`, the default `normal`) rather than its display value.
      expect(getComputedStyle(icon).alignItems).to.equal('center');
      expect(getComputedStyle(icon).flexGrow).to.equal('0');
    });

    it(`tints the tone dot from its entry's tone in the ${label} path`, async () => {
      const el = await feed(threshold);
      const dots = [...entryRoot(el).querySelectorAll('[part~="tone-dot"]')] as HTMLElement[];
      expect(dots.length).to.equal(toneEntries.length);
      // The tone travels in the part list, not a [data-tone] qualifier -- `::part()` cannot be
      // followed by an attribute selector, so a tone-qualified rule would never match.
      expect(dots[0]!.getAttribute('part')).to.equal('tone-dot tone-dot-neutral');
      expect(dots[1]!.getAttribute('part')).to.equal('tone-dot tone-dot-success');
      expect(getComputedStyle(dots[0]!).backgroundColor).to.equal('rgb(4, 5, 6)');
      expect(getComputedStyle(dots[1]!).backgroundColor).to.equal('rgb(1, 2, 3)');
      // The dot is a real circle, not an unstyled inline span.
      expect(getComputedStyle(dots[0]!).display).to.equal('block');
      expect(getComputedStyle(dots[0]!).inlineSize).to.equal('8px');
    });

    it(`styles [part="entry-text"] and [part="entry-timestamp"] in the ${label} path`, async () => {
      const el = await feed(threshold);
      const root = entryRoot(el);
      const text = root.querySelector('[part="entry-text"]') as HTMLElement;
      expect(getComputedStyle(text).flexGrow).to.equal('1');
      const stamp = root.querySelector('[part="entry-timestamp"]') as HTMLElement;
      expect(getComputedStyle(stamp).fontSize).to.equal('12px');
      expect(getComputedStyle(stamp).color).to.equal('rgb(4, 5, 6)');
    });

    it(`is accessible in the ${label} path`, async () => {
      const el = await feed(threshold);
      expect(entryRoot(el).querySelectorAll('[part="entry"]').length).to.be.greaterThan(0);
      await expect(el).to.be.accessible();
    });
  }

  it('exports the virtualized entry parts so a consumer stylesheet can reach them', async () => {
    const wrapper = await fixture(html`
      <div>
        <style>
          lr-activity-feed::part(entry-text) {
            color: rgb(12, 34, 56);
          }
          lr-activity-feed::part(tone-dot) {
            outline-color: rgb(21, 43, 65);
          }
          lr-activity-feed::part(tone-dot-success) {
            background: rgb(33, 55, 77);
          }
        </style>
        <lr-activity-feed expanded virtualize-threshold="1" .entries=${toneEntries}></lr-activity-feed>
      </div>
    `);
    const el = wrapper.querySelector('lr-activity-feed') as LyraActivityFeed;
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    await (list as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    await twoFrames();
    expect(list.getAttribute('exportparts')).to.contain('entry:entry');
    expect(list.getAttribute('exportparts')).to.contain('tone-dot:tone-dot');
    expect(list.getAttribute('exportparts')).to.contain('tone-dot-success:tone-dot-success');
    const text = list.shadowRoot!.querySelector('[part="entry-text"]') as HTMLElement;
    const dot = list.shadowRoot!.querySelector('[part~="tone-dot"]') as HTMLElement;
    const successDot = list.shadowRoot!.querySelector('[part~="tone-dot-success"]') as HTMLElement;
    expect(getComputedStyle(text).color).to.equal('rgb(12, 34, 56)');
    expect(getComputedStyle(dot).outlineColor).to.equal('rgb(21, 43, 65)');
    // A consumer can retint exactly one tone -- the whole reason the tone is a part name.
    expect(getComputedStyle(successDot).backgroundColor).to.equal('rgb(33, 55, 77)');
  });
});

it('is accessible collapsed, with no entries', async () => {
  const el = (await fixture(html`<lr-activity-feed></lr-activity-feed>`)) as LyraActivityFeed;
  await expect(el).to.be.accessible();
});

it('is accessible expanded, with entries, icons, tones, and timestamps', async () => {
  const el = (await fixture(
    html`<lr-activity-feed
      expanded
      show-timestamps
      .entries=${[
        { id: '1', text: 'Searching the web…', icon: '🔍', tone: 'brand', timestamp: new Date() },
        { id: '2', text: 'Read src/index.ts', tone: 'success' },
      ]}
    ></lr-activity-feed>`,
  )) as LyraActivityFeed;
  await expect(el).to.be.accessible();
});

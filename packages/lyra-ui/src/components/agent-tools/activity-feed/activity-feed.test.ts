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

it('renders one [part="entry"] row per entry, carrying data-variant', async () => {
  const el = (await fixture(
    html`<lr-activity-feed expanded .entries=${[
      { id: '1', text: 'Searching the web…', variant: 'brand' },
      { id: '2', text: 'Read src/index.ts' },
    ]}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="entry"]')] as HTMLElement[];
  expect(rows.length).to.equal(2);
  expect(rows[0]!.dataset.variant).to.equal('brand');
  expect(rows[1]!.dataset.variant).to.equal('neutral');
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

it('keeps a long public label contained without collapsing the live summary at 320px', async () => {
  const wrapper = await fixture(html`
    <div style="inline-size:320px">
      <lr-activity-feed
        label=${`activity-${'unbroken'.repeat(40)}`}
        .entries=${[{ id: 'latest', text: 'Latest step remains visible' }]}
      ></lr-activity-feed>
    </div>
  `);
  const el = wrapper.querySelector('lr-activity-feed') as LyraActivityFeed;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  const headerRect = header.getBoundingClientRect();
  const labelRect = label.getBoundingClientRect();
  const summaryRect = summary.getBoundingClientRect();
  expect(labelRect.right).to.be.at.most(Math.ceil(headerRect.right));
  expect(summaryRect.width).to.be.greaterThan(24);
  expect(summary.textContent!.trim()).to.equal('Latest step remains visible');
});

it('renders a literal icon hint when set, a variant dot otherwise', async () => {
  const el = (await fixture(
    html`<lr-activity-feed expanded .entries=${[
      { id: '1', text: 'With icon', icon: '🔍' },
      { id: '2', text: 'No icon' },
    ]}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="entry"]')] as HTMLElement[];
  expect(rows[0]!.querySelector('[part="entry-icon"]')!.textContent!.trim()).to.equal('🔍');
  expect(rows[1]!.querySelectorAll('[part="entry-icon"] [part~="variant-dot"]').length).to.equal(1);
});

it('shows the latest entry as a one-line ticker in the header while mode="live"', async () => {
  const el = (await fixture(
    html`<lr-activity-feed mode="live" .entries=${makeEntries(3)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Entry 2');
});

it('lets a live feed retheme only its own status dot', async () => {
  const wrapper = await fixture(html`
    <div style="--lr-theme-color-brand-fill-loud: rgb(4, 5, 6);">
      <lr-activity-feed
        mode="live"
        style="--lr-activity-feed-live-status-color: rgb(1, 2, 3);"
      ></lr-activity-feed>
      <lr-activity-feed mode="live"></lr-activity-feed>
    </div>
  `);
  const [overridden, defaulted] = [...wrapper.querySelectorAll('lr-activity-feed')] as LyraActivityFeed[];
  const overriddenDot = overridden!.shadowRoot!.querySelector('[part="status-dot"]') as HTMLElement;
  const defaultedDot = defaulted!.shadowRoot!.querySelector('[part="status-dot"]') as HTMLElement;

  expect(getComputedStyle(overriddenDot).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(defaultedDot).backgroundColor).to.equal('rgb(4, 5, 6)');
});

it('shows a localized "Completed N steps" summary in the header while mode="post-hoc"', async () => {
  const el = (await fixture(
    html`<lr-activity-feed mode="post-hoc" .entries=${makeEntries(14)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Completed 14 steps');
});

it('formats the completed count for the effective locale while retaining the raw count for plural selection', async () => {
  const count = 12;
  const el = (await fixture(
    html`<lr-activity-feed lang="ar-EG" mode="post-hoc" .entries=${makeEntries(count)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  const formattedCount = new Intl.NumberFormat('ar-EG').format(count);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal(
    `Completed ${formattedCount} steps`,
  );
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
    expect((time) != null).to.equal(true);
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

  it('schedules and cancels tail-follow frames through the exact owner window across adoption', async () => {
    let el = (await fixture(html`<lr-activity-feed></lr-activity-feed>`)) as LyraActivityFeed;
    await el.updateComplete;
    el.remove();
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalMainRequest = window.requestAnimationFrame;
    const originalMainCancel = window.cancelAnimationFrame;
    const originalFrameRequest = frameWindow.requestAnimationFrame;
    const originalFrameCancel = frameWindow.cancelAnimationFrame;
    const mainFrames = new Map<number, FrameRequestCallback>();
    const frameFrames = new Map<number, FrameRequestCallback>();
    const frameCancellations: number[] = [];
    let mainHandle = 6100;
    let frameHandle = 7100;

    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const handle = ++mainHandle;
      mainFrames.set(handle, callback);
      return handle;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) => {
      mainFrames.delete(handle);
    }) as typeof window.cancelAnimationFrame;
    frameWindow.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const handle = ++frameHandle;
      frameFrames.set(handle, callback);
      return handle;
    }) as typeof frameWindow.requestAnimationFrame;
    frameWindow.cancelAnimationFrame = ((handle: number) => {
      frameCancellations.push(handle);
      frameFrames.delete(handle);
    }) as typeof frameWindow.cancelAnimationFrame;

    try {
      frameDocument.adoptNode(el);
      expect(frameFrames.size, 'detached adoption must not arm a frame').to.equal(0);

      frameDocument.body.append(el);
      el.expanded = true;
      el.entries = makeEntries(3);
      await el.updateComplete;
      expect(mainFrames.size, 'the parent window must not own an iframe feed frame').to.equal(0);
      expect(frameFrames.size, 'the iframe window owns the pending tail-follow frame').to.equal(1);

      const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
      let scrollTop = 0;
      Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 240 });
      Object.defineProperty(body, 'scrollTop', {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = value;
        },
      });
      const [oldHandle, staleFrame] = Array.from(frameFrames.entries())[0]!;

      document.adoptNode(el);
      expect(frameCancellations, 'adoption cancels through the retained iframe owner').to.include(oldHandle);
      expect(mainFrames.size, 'detached adoption must not re-arm in the destination').to.equal(0);
      staleFrame(0);
      expect(scrollTop, 'a stale source-realm frame cannot scroll the adopted feed').to.equal(0);

      document.body.append(el);
      expect(mainFrames.size, 'reconnect resumes tail following in the destination window').to.equal(1);
      const [currentHandle, currentFrame] = Array.from(mainFrames.entries())[0]!;
      mainFrames.delete(currentHandle);
      currentFrame(0);
      expect(scrollTop).to.equal(240);
    } finally {
      el.remove();
      window.requestAnimationFrame = originalMainRequest;
      window.cancelAnimationFrame = originalMainCancel;
      frameWindow.requestAnimationFrame = originalFrameRequest;
      frameWindow.cancelAnimationFrame = originalFrameCancel;
      iframe.remove();
    }
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

  it('does not leak the internal lr-virtual-list lr-visible-range-changed event past the host under its own name', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded virtualize-threshold="1" .entries=${makeEntries(5)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement;
    let count = 0;
    el.addEventListener('lr-visible-range-changed', () => count++);

    list.dispatchEvent(
      new CustomEvent('lr-visible-range-changed', {
        detail: { start: 0, end: 1 },
        bubbles: true,
        composed: true,
      }),
    );
    await el.updateComplete;

    expect(count).to.equal(0);
  });

  it('stays below virtualizeThreshold using a plain keyed list', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded virtualize-threshold="5" .entries=${makeEntries(4)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.not.exist;
    expect(el.shadowRoot!.querySelectorAll('[part="entry"]').length).to.equal(4);
  });

  it('keeps following the tail when virtualizeThreshold switches either rendering path', async () => {
    const VirtualList = customElements.get('lr-virtual-list') as
      | (CustomElementConstructor & {
          prototype: {
            scrollToIndex(index: number, options?: { align?: 'start' | 'end' }): void;
          };
        })
      | undefined;
    expect(VirtualList).to.exist;
    const originalScrollToIndex = VirtualList!.prototype.scrollToIndex;
    const calls: Array<
      [number, { align?: 'start' | 'end'; behavior?: 'auto' | 'smooth' } | undefined]
    > = [];
    VirtualList!.prototype.scrollToIndex = function (index, options): void {
      calls.push([index, options]);
      originalScrollToIndex.call(this, index, options);
    };
    try {
      const el = (await fixture(html`
        <lr-activity-feed
          expanded
          mode="live"
          style="--lr-activity-feed-max-height:48px"
          virtualize-threshold="99"
          .entries=${makeEntries(20)}
        ></lr-activity-feed>
      `)) as LyraActivityFeed;
      await twoFrames();

      el.virtualizeThreshold = 1;
      await el.updateComplete;
      await twoFrames();
      expect(calls.at(-1)).to.deep.equal([19, { align: 'end', behavior: 'auto' }]);
      expect(el.follow, 'programmatic path switch must not release follow').to.be.true;

      el.virtualizeThreshold = 99;
      await el.updateComplete;
      await twoFrames();
      const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
      expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
      expect(el.follow).to.be.true;
    } finally {
      VirtualList!.prototype.scrollToIndex = originalScrollToIndex;
    }
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
      let called:
        | [number, { align?: 'start' | 'end'; behavior?: 'auto' | 'smooth' } | undefined]
        | undefined;
      list.scrollToIndex = (index, options) => (called = [index, options]);
      el.entries = [...el.entries, { id: 'new', text: 'Newest entry' }];
      await el.updateComplete;
      await twoFrames();
      expect(called).to.deep.equal([5, { align: 'end', behavior: 'auto' }]);
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
  const variantEntries: ActivityEntry[] = [
    { id: 'a', text: 'Neutral step' },
    { id: 'b', text: 'Finished step', variant: 'success' },
    { id: 'c', text: 'Timestamped step', variant: 'danger', timestamp: new Date('2024-01-01T10:30:00Z') },
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
      .entries=${variantEntries}
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

    it(`tints the variant dot from its entry's variant in the ${label} path`, async () => {
      const el = await feed(threshold);
      const dots = [...entryRoot(el).querySelectorAll('[part~="variant-dot"]')] as HTMLElement[];
      expect(dots.length).to.equal(variantEntries.length);
      // The variant travels in the part list, not a [data-variant] qualifier -- `::part()` cannot be
      // followed by an attribute selector, so a variant-qualified rule would never match.
      expect(dots[0]!.getAttribute('part')).to.equal('variant-dot variant-dot-neutral');
      expect(dots[1]!.getAttribute('part')).to.equal('variant-dot variant-dot-success');
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
          lr-activity-feed::part(variant-dot) {
            outline-color: rgb(21, 43, 65);
          }
          lr-activity-feed::part(variant-dot-success) {
            background: rgb(33, 55, 77);
          }
        </style>
        <lr-activity-feed expanded virtualize-threshold="1" .entries=${variantEntries}></lr-activity-feed>
      </div>
    `);
    const el = wrapper.querySelector('lr-activity-feed') as LyraActivityFeed;
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    await (list as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    await twoFrames();
    expect(list.getAttribute('exportparts')).to.contain('entry:entry');
    expect(list.getAttribute('exportparts')).to.contain('variant-dot:variant-dot');
    expect(list.getAttribute('exportparts')).to.contain('variant-dot-success:variant-dot-success');
    const text = list.shadowRoot!.querySelector('[part="entry-text"]') as HTMLElement;
    const dot = list.shadowRoot!.querySelector('[part~="variant-dot"]') as HTMLElement;
    const successDot = list.shadowRoot!.querySelector('[part~="variant-dot-success"]') as HTMLElement;
    expect(getComputedStyle(text).color).to.equal('rgb(12, 34, 56)');
    expect(getComputedStyle(dot).outlineColor).to.equal('rgb(21, 43, 65)');
    // A consumer can retint exactly one variant -- the whole reason the variant is a part name.
    expect(getComputedStyle(successDot).backgroundColor).to.equal('rgb(33, 55, 77)');
  });
});

it('is accessible collapsed, with no entries', async () => {
  const el = (await fixture(html`<lr-activity-feed></lr-activity-feed>`)) as LyraActivityFeed;
  await expect(el).to.be.accessible();
});

it('is accessible expanded, with entries, icons, variants, and timestamps', async () => {
  const el = (await fixture(
    html`<lr-activity-feed
      expanded
      show-timestamps
      .entries=${[
        { id: '1', text: 'Searching the web…', icon: '🔍', variant: 'brand', timestamp: new Date() },
        { id: '2', text: 'Read src/index.ts', variant: 'success' },
      ]}
    ></lr-activity-feed>`,
  )) as LyraActivityFeed;
  await expect(el).to.be.accessible();
});

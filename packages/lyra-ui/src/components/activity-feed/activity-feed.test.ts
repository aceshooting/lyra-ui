import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './activity-feed.js';
import type { LyraActivityFeed, ActivityEntry } from './activity-feed.js';

async function twoFrames(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

function makeEntries(count: number): ActivityEntry[] {
  return Array.from({ length: count }, (_, i) => ({ id: `e${i}`, text: `Entry ${i}` }));
}

it('defaults to entries=[], mode="live", follow=true, expanded=false, label="Activity"', async () => {
  const el = (await fixture(html`<lyra-activity-feed></lyra-activity-feed>`)) as LyraActivityFeed;
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
    html`<lyra-activity-feed expanded .entries=${[
      { id: '1', text: 'Searching the web…', tone: 'brand' },
      { id: '2', text: 'Read src/index.ts' },
    ]}></lyra-activity-feed>`,
  )) as LyraActivityFeed;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="entry"]')] as HTMLElement[];
  expect(rows.length).to.equal(2);
  expect(rows[0]!.dataset.tone).to.equal('brand');
  expect(rows[1]!.dataset.tone).to.equal('neutral');
  expect(rows[0]!.querySelector('[part="entry-text"]')!.textContent!.trim()).to.equal('Searching the web…');
});

it('renders a literal icon hint when set, a tone dot otherwise', async () => {
  const el = (await fixture(
    html`<lyra-activity-feed expanded .entries=${[
      { id: '1', text: 'With icon', icon: '🔍' },
      { id: '2', text: 'No icon' },
    ]}></lyra-activity-feed>`,
  )) as LyraActivityFeed;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="entry"]')] as HTMLElement[];
  expect(rows[0]!.querySelector('[part="entry-icon"]')!.textContent!.trim()).to.equal('🔍');
  expect(rows[1]!.querySelector('[part="entry-icon"] .tone-dot')).to.exist;
});

it('shows the latest entry as a one-line ticker in the header while mode="live"', async () => {
  const el = (await fixture(
    html`<lyra-activity-feed mode="live" .entries=${makeEntries(3)}></lyra-activity-feed>`,
  )) as LyraActivityFeed;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Entry 2');
});

it('shows a localized "Completed N steps" summary in the header while mode="post-hoc"', async () => {
  const el = (await fixture(
    html`<lyra-activity-feed mode="post-hoc" .entries=${makeEntries(14)}></lyra-activity-feed>`,
  )) as LyraActivityFeed;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Completed 14 steps');
});

it('uses the singular form for exactly one completed step', async () => {
  const el = (await fixture(
    html`<lyra-activity-feed mode="post-hoc" .entries=${makeEntries(1)}></lyra-activity-feed>`,
  )) as LyraActivityFeed;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Completed 1 step');
});

it('uses string overrides for the header label and completed-steps summary', async () => {
  const el = (await fixture(
    html`<lyra-activity-feed mode="post-hoc" .entries=${makeEntries(3)}></lyra-activity-feed>`,
  )) as LyraActivityFeed;
  el.strings = { activityFeedLabel: 'Activité', activityFeedCompletedSteps: '{count} étapes terminées' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Activité');
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('3 étapes terminées');
});

it('toggles expanded and fires lyra-toggle on header click', async () => {
  const el = (await fixture(html`<lyra-activity-feed></lyra-activity-feed>`)) as LyraActivityFeed;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;
  let firing = oneEvent(el, 'lyra-toggle');
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
      html`<lyra-activity-feed expanded .entries=${[{ id: '1', text: 'x', timestamp: ts }]}></lyra-activity-feed>`,
    )) as LyraActivityFeed;
    expect(withoutFlag.shadowRoot!.querySelector('[part="entry-timestamp"]')).to.not.exist;

    const withFlag = (await fixture(
      html`<lyra-activity-feed
        expanded
        show-timestamps
        .entries=${[{ id: '1', text: 'x', timestamp: ts }]}
      ></lyra-activity-feed>`,
    )) as LyraActivityFeed;
    const time = withFlag.shadowRoot!.querySelector('[part="entry-timestamp"]') as HTMLTimeElement;
    expect(time).to.exist;
    expect(time.getAttribute('datetime')).to.equal(ts.toISOString());
  });

  it('overrides the default hour:minute rendering via formatTimestamp', async () => {
    const ts = new Date('2024-01-01T10:30:00Z');
    const el = (await fixture(html`<lyra-activity-feed expanded show-timestamps></lyra-activity-feed>`)) as LyraActivityFeed;
    el.formatTimestamp = () => 'CUSTOM';
    el.entries = [{ id: '1', text: 'x', timestamp: ts }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="entry-timestamp"]')!.textContent!.trim()).to.equal('CUSTOM');
  });

  it('treats an invalid timestamp string as unset', async () => {
    const el = (await fixture(
      html`<lyra-activity-feed
        expanded
        show-timestamps
        .entries=${[{ id: '1', text: 'x', timestamp: 'not-a-date' }]}
      ></lyra-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('[part="entry-timestamp"]')).to.not.exist;
  });
});

describe('follow contract (non-virtualized)', () => {
  async function forceSmallBody(el: LyraActivityFeed): Promise<HTMLElement> {
    el.style.setProperty('--lyra-activity-feed-max-height', '48px');
    el.expanded = true;
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  }

  it('starts with follow=true and auto-scrolls to the bottom as entries are appended, in live mode', async () => {
    const el = (await fixture(html`<lyra-activity-feed mode="live"></lyra-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();
    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
  });

  it('releases follow and fires lyra-follow-change when the reader scrolls away from the bottom', async () => {
    const el = (await fixture(html`<lyra-activity-feed mode="live"></lyra-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();

    const firing = oneEvent(el, 'lyra-follow-change');
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
    const el = (await fixture(html`<lyra-activity-feed mode="live"></lyra-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();
    body.scrollTop = 0;
    body.dispatchEvent(new Event('scroll'));
    await el.updateComplete;
    expect(el.follow).to.be.false;

    const firing = oneEvent(el, 'lyra-follow-change');
    body.scrollTop = body.scrollHeight;
    body.dispatchEvent(new Event('scroll'));
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ following: true });
    expect(el.follow).to.be.true;
  });

  it('does not fire lyra-follow-change on mount, even when follow="false" is set in markup', async () => {
    const el = (await fixture(html`<lyra-activity-feed follow="false"></lyra-activity-feed>`)) as LyraActivityFeed;
    let fired = false;
    el.addEventListener('lyra-follow-change', () => (fired = true));
    await el.updateComplete;
    expect(el.follow).to.be.false;
    expect(fired).to.be.false;
  });

  it('accepts follow="false" as a plain-HTML attribute string', async () => {
    const el = (await fixture(html`<lyra-activity-feed follow="false"></lyra-activity-feed>`)) as LyraActivityFeed;
    expect(el.follow).to.be.false;
  });

  it('resets follow to true and jumps to the bottom when expanding an already-populated live feed', async () => {
    const el = (await fixture(
      html`<lyra-activity-feed mode="live" .entries=${makeEntries(20)}></lyra-activity-feed>`,
    )) as LyraActivityFeed;
    el.follow = false;
    await el.updateComplete;
    const body = await forceSmallBody(el);
    await twoFrames();
    expect(el.follow).to.be.true;
    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
  });

  it('never auto-scrolls in post-hoc mode', async () => {
    const el = (await fixture(html`<lyra-activity-feed mode="post-hoc"></lyra-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();
    expect(body.scrollTop).to.equal(0);
  });
});

describe('follow contract (virtualized)', () => {
  it('switches to an internal lyra-virtual-list at/above virtualizeThreshold', async () => {
    const el = (await fixture(
      html`<lyra-activity-feed expanded virtualize-threshold="5" .entries=${makeEntries(5)}></lyra-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('lyra-virtual-list')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="body"][role="list"]')).to.not.exist;
  });

  it('normalizes a NaN virtualizeThreshold to the default (200) instead of silently disabling virtualization', async () => {
    const el = (await fixture(
      html`<lyra-activity-feed expanded virtualize-threshold="not-a-number" .entries=${makeEntries(200)}></lyra-activity-feed>`,
    )) as LyraActivityFeed;
    expect(Number.isNaN(el.virtualizeThreshold)).to.be.true;
    expect(el.shadowRoot!.querySelector('lyra-virtual-list')).to.exist;
  });

  it('forwards the header label as aria-label onto the internal virtual-list', async () => {
    const el = (await fixture(
      html`<lyra-activity-feed
        expanded
        label="Steps"
        virtualize-threshold="5"
        .entries=${makeEntries(5)}
      ></lyra-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('lyra-virtual-list')!.getAttribute('aria-label')).to.equal('Steps');
  });

  it('stays below virtualizeThreshold using a plain keyed list', async () => {
    const el = (await fixture(
      html`<lyra-activity-feed expanded virtualize-threshold="5" .entries=${makeEntries(4)}></lyra-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('lyra-virtual-list')).to.not.exist;
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
        html`<lyra-activity-feed
          expanded
          mode="live"
          style="--lyra-activity-feed-max-height:120px"
          virtualize-threshold="5"
          row-height="24"
          .entries=${makeEntries(5)}
        ></lyra-activity-feed>`,
      )) as LyraActivityFeed;
      await twoFrames();
      const list = el.shadowRoot!.querySelector('lyra-virtual-list') as HTMLElement & {
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
    return el.shadowRoot!.querySelector('lyra-live-region')!.shadowRoot!.querySelector('[part="region"]')!
      .textContent!;
  }

  it('announces the completed-steps summary once mode flips from live to post-hoc', async () => {
    const el = (await fixture(
      html`<lyra-activity-feed mode="live" .entries=${makeEntries(14)}></lyra-activity-feed>`,
    )) as LyraActivityFeed;
    el.mode = 'post-hoc';
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Completed 14 steps');
  });

  it('does not announce anything on mount, even when mode="post-hoc" is set in markup', async () => {
    const el = (await fixture(
      html`<lyra-activity-feed mode="post-hoc" .entries=${makeEntries(14)}></lyra-activity-feed>`,
    )) as LyraActivityFeed;
    expect(await getLiveRegionText(el)).to.equal('');
  });
});

it('is accessible collapsed, with no entries', async () => {
  const el = (await fixture(html`<lyra-activity-feed></lyra-activity-feed>`)) as LyraActivityFeed;
  await expect(el).to.be.accessible();
});

it('is accessible expanded, with entries, icons, tones, and timestamps', async () => {
  const el = (await fixture(
    html`<lyra-activity-feed
      expanded
      show-timestamps
      .entries=${[
        { id: '1', text: 'Searching the web…', icon: '🔍', tone: 'brand', timestamp: new Date() },
        { id: '2', text: 'Read src/index.ts', tone: 'success' },
      ]}
    ></lyra-activity-feed>`,
  )) as LyraActivityFeed;
  await expect(el).to.be.accessible();
});

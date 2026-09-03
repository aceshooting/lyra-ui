import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './transcript-feed.js';
import type { LyraTranscriptFeed, LyraTranscriptEntry } from './transcript-feed.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';

function entryEls(el: LyraTranscriptFeed): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll('[part~="entry"]')] as HTMLElement[];
}

function relativeLuminance(color: string): number {
  const channels = color.match(/[\d.]+/gu)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a computed RGB color, received ${color}`);
  }
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

it('defaults to entries=[], follow=true, show-timestamps=false, max-rendered-entries=500', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  expect(el.entries).to.deep.equal([]);
  expect(el.follow).to.be.true;
  expect(el.hasAttribute('follow')).to.be.true;
  expect(el.showTimestamps).to.be.false;
  expect(el.maxRenderedEntries).to.equal(500);
});

it('never scrolls horizontally -- overflow-y:auto alone lets the x axis compute to auto too, which can show a phantom scrollbar', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).overflowX).to.equal('hidden');
});

it('shows the localized empty state (or a slotted override) when entries is empty', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent!.trim()).to.equal('No transcript yet');

  const withSlot = (await fixture(html`
    <lr-transcript-feed><span slot="empty">Nothing said yet</span></lr-transcript-feed>
  `)) as LyraTranscriptFeed;
  expect(withSlot.shadowRoot!.querySelector<HTMLSlotElement>('[part="empty"] slot')!.assignedElements()[0]!.textContent).to.equal(
    'Nothing said yet',
  );
});

it('renders final entries inside a role="log" container labeled Transcript, grouping consecutive same-speaker rows', async () => {
  const entries: LyraTranscriptEntry[] = [
    { id: '1', speaker: 'You', text: 'Hello' },
    { id: '2', speaker: 'You', text: 'there' },
    { id: '3', speaker: 'Agent', text: 'Hi!' },
  ];
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = entries;
  await el.updateComplete;

  const log = el.shadowRoot!.querySelector('[part="log"]')!;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('region');
  expect(base.getAttribute('aria-label')).to.equal('Transcript');
  expect(log.getAttribute('role')).to.equal('log');
  expect(log.getAttribute('aria-label')).to.equal('Transcript');

  const speakers = [...log.querySelectorAll('[part="speaker"]')].map((s) => s.textContent);
  expect(speakers).to.deep.equal(['You', 'Agent']); // second "You" row omits a repeated label
  expect(entryEls(el).length).to.equal(3);
});

it('renders interim entries outside the log, marked data-interim with a visually-hidden Transcribing marker', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [
    { id: '1', speaker: 'You', text: 'final line' },
    { id: '2', speaker: 'You', text: 'partial...', interim: true },
  ];
  await el.updateComplete;

  const log = el.shadowRoot!.querySelector('[part="log"]')!;
  expect(log.querySelectorAll('[part~="entry"]').length).to.equal(1);
  const interimArea = el.shadowRoot!.querySelector('[part="interim-area"]')!;
  const interimEntry = interimArea.querySelector('[part~="entry"]') as HTMLElement;
  expect(interimEntry.hasAttribute('data-interim')).to.be.true;
  expect(interimEntry.querySelector('.sr-only')!.textContent).to.equal('Transcribing…');
});

it('styles direct and interim token-list entry parts, including reduced motion', async () => {
  await setReducedMotion('no-preference');
  try {
    const surface = (await fixture(html`
      <div style="background: rgb(255, 255, 255)">
        <lr-transcript-feed data-lr-theme="light"></lr-transcript-feed>
      </div>
    `)) as HTMLDivElement;
    const el = surface.querySelector('lr-transcript-feed') as LyraTranscriptFeed;
    el.showTimestamps = true;
    el.entries = [
      { id: 'final', speaker: 'You', text: 'Final caption', timestamp: Date.UTC(2026, 0, 1) },
      { id: 'interim', speaker: 'Agent', text: 'Interim caption', timestamp: Date.UTC(2026, 0, 1), interim: true },
    ];
    await el.updateComplete;

    const finalEntry = el.shadowRoot!.querySelector<HTMLElement>('[part="entry"]')!;
    const interimEntry = el.shadowRoot!.querySelector<HTMLElement>('[part~="entry"][data-interim]')!;
    const finalStyle = getComputedStyle(finalEntry);
    const interimStyle = getComputedStyle(interimEntry);
    expect(finalStyle.display).to.equal('flex');
    expect(finalStyle.flexWrap).to.equal('wrap');
    expect(finalStyle.gap).to.equal('2px');
    expect(finalStyle.animationName).to.equal('lr-transcript-fade-in');
    expect(interimStyle.display).to.equal('flex');
    expect(interimStyle.flexWrap).to.equal('wrap');
    expect(interimStyle.gap).to.equal('2px');
    expect(interimStyle.animationName).to.equal('lr-transcript-fade-in');
    expect(interimStyle.fontStyle).to.equal('italic');

    for (const entry of entryEls(el)) {
      entry.getAnimations().forEach((animation) => animation.finish());
    }
    const interimText = interimEntry.querySelector<HTMLElement>('[part="text"]')!;
    const interimSpeaker = interimEntry.querySelector<HTMLElement>('[part="speaker"]')!;
    const interimTimestamp = interimEntry.querySelector<HTMLElement>('[part="timestamp"]')!;
    const background = getComputedStyle(surface).backgroundColor;
    expect(getComputedStyle(interimEntry).opacity).to.equal('1');
    expect(contrastRatio(getComputedStyle(interimText).color, background)).to.be.at.least(4.5);
    expect(contrastRatio(getComputedStyle(interimSpeaker).color, background)).to.be.at.least(4.5);
    expect(contrastRatio(getComputedStyle(interimTimestamp).color, background)).to.be.at.least(4.5);

    await setReducedMotion('reduce');
    await waitUntil(
      () => getComputedStyle(finalEntry).animationName === 'none' && getComputedStyle(interimEntry).animationName === 'none',
      'the reduced-motion entry styles did not apply',
    );
    expect(getComputedStyle(finalEntry).animationName).to.equal('none');
    expect(getComputedStyle(interimEntry).animationName).to.equal('none');
  } finally {
    await setReducedMotion('no-preference');
  }
});

it('keeps fully visible interim text, speaker, and timestamp at WCAG contrast in dark theme', async () => {
  await setReducedMotion('no-preference');
  try {
    const surface = (await fixture(html`
      <div style="background: rgb(26, 26, 26)">
        <lr-transcript-feed data-lr-theme="dark"></lr-transcript-feed>
      </div>
    `)) as HTMLDivElement;
    const el = surface.querySelector('lr-transcript-feed') as LyraTranscriptFeed;
    el.showTimestamps = true;
    el.entries = [{ id: 'interim', speaker: 'Agent', text: 'Interim caption', timestamp: Date.UTC(2026, 0, 1), interim: true }];
    await el.updateComplete;

    const interimEntry = el.shadowRoot!.querySelector<HTMLElement>('[part~="entry"][data-interim]')!;
    await setReducedMotion('reduce');
    await waitUntil(
      () => getComputedStyle(interimEntry).animationName === 'none',
      'the reduced-motion entry state did not apply',
    );
    const background = getComputedStyle(surface).backgroundColor;
    expect(getComputedStyle(interimEntry).animationName).to.equal('none');
    expect(getComputedStyle(interimEntry).opacity).to.equal('1');
    for (const part of ['text', 'speaker', 'timestamp']) {
      const content = interimEntry.querySelector<HTMLElement>(`[part="${part}"]`)!;
      expect(contrastRatio(getComputedStyle(content).color, background), part).to.be.at.least(4.5);
    }
  } finally {
    await setReducedMotion('no-preference');
  }
});

it('finalizing an entry (same id, interim flips to unset) moves it from the interim area into the log', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [{ id: 'turn-1', speaker: 'You', text: 'partial', interim: true }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="log"]')!.querySelectorAll('[part~="entry"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="interim-area"]')).to.exist;

  el.entries = [{ id: 'turn-1', speaker: 'You', text: 'final text' }];
  await el.updateComplete;
  const log = el.shadowRoot!.querySelector('[part="log"]')!;
  expect(log.querySelectorAll('[part~="entry"]').length).to.equal(1);
  expect(log.querySelector('[part="text"]')!.textContent).to.equal('final text');
  expect((el.shadowRoot!.querySelector('[part="interim-area"]')) === null).to.be.true;
});

it('a same-id text update replaces the row in place rather than duplicating it', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [{ id: '1', speaker: 'You', text: 'a' }];
  await el.updateComplete;
  el.entries = [{ id: '1', speaker: 'You', text: 'ab' }];
  await el.updateComplete;
  expect(entryEls(el).length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="text"]')!.textContent).to.equal('ab');
});

it('names the log via label, with a host aria-label winning over both label and the localized default', async () => {
  const el = (await fixture(html`<lr-transcript-feed label="Call captions"></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [{ id: '1', text: 'hi' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="log"]')!.getAttribute('aria-label')).to.equal('Call captions');

  el.setAttribute('aria-label', 'Support call');
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal('Support call');
  expect(el.shadowRoot!.querySelector('[part="log"]')!.getAttribute('aria-label')).to.equal('Support call');
});

it('distinguishes an omitted label from an explicit empty override on the log region', async () => {
  const omitted = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  omitted.entries = [{ id: '1', text: 'hi' }];
  await omitted.updateComplete;
  expect(omitted.shadowRoot!.querySelector('[part="log"]')!.getAttribute('aria-label')).to.equal('Transcript');

  const explicitEmpty = (await fixture(html`<lr-transcript-feed label=""></lr-transcript-feed>`)) as LyraTranscriptFeed;
  explicitEmpty.entries = [{ id: '1', text: 'hi' }];
  await explicitEmpty.updateComplete;
  expect(explicitEmpty.shadowRoot!.querySelector('[part="log"]')!.getAttribute('aria-label')).to.equal('');
});

describe('timestamps', () => {
  it('renders the built-in short-time format when no formatTimestamp is supplied', async () => {
    const el = (await fixture(html`<lr-transcript-feed show-timestamps locale="en"></lr-transcript-feed>`)) as LyraTranscriptFeed;
    el.entries = [{ id: '1', text: 'hi', timestamp: Date.UTC(2026, 0, 1, 12, 34) }];
    await el.updateComplete;
    const rendered = el.shadowRoot!.querySelector('[part="timestamp"]')!.textContent!;
    expect(rendered).to.equal(
      new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(Date.UTC(2026, 0, 1, 12, 34))),
    );
  });

  it('hides timestamps by default and shows them (via formatTimestamp when supplied) when show-timestamps is set', async () => {
    const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
    el.entries = [{ id: '1', text: 'hi', timestamp: 1700000000000 }];
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="timestamp"]')) === null).to.be.true;

    el.showTimestamps = true;
    el.formatTimestamp = (date) => `t=${date.getTime()}`;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="timestamp"]')!.textContent).to.equal('t=1700000000000');
  });

  it('omits non-finite and out-of-TimeClip timestamps without dropping transcript entries', async () => {
    const el = (await fixture(
      html`<lr-transcript-feed show-timestamps></lr-transcript-feed>`,
    )) as LyraTranscriptFeed;
    el.entries = [
      { id: 'valid', text: 'valid timestamp', timestamp: Date.UTC(2026, 0, 1, 12, 34) },
      { id: 'nan', text: 'not a number', timestamp: Number.NaN },
      { id: 'infinity', text: 'infinite', timestamp: Number.POSITIVE_INFINITY },
      { id: 'too-large', text: 'outside TimeClip', timestamp: Number.MAX_VALUE },
    ];
    await el.updateComplete;

    expect(entryEls(el)).to.have.length(4);
    expect(el.shadowRoot!.querySelectorAll('[part="timestamp"]')).to.have.length(1);
  });
});

it('max-rendered-entries caps the DOM row count to the newest N without mutating host data', async () => {
  const el = (await fixture(html`<lr-transcript-feed max-rendered-entries="2"></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [
    { id: '1', text: 'one' },
    { id: '2', text: 'two' },
    { id: '3', text: 'three' },
  ];
  await el.updateComplete;
  expect(el.entries.length).to.equal(3); // host data untouched
  expect(entryEls(el).length).to.equal(2);
  expect(el.shadowRoot!.querySelector('[part="log"]')!.textContent).to.contain('three');
});

it('normalizes a NaN max-rendered-entries to the bounded default', async () => {
  const el = (await fixture(
    html`<lr-transcript-feed max-rendered-entries="not-a-number"></lr-transcript-feed>`,
  )) as LyraTranscriptFeed;
  expect(Number.isNaN(el.maxRenderedEntries)).to.be.true;
  el.entries = [
    { id: '1', text: 'one' },
    { id: '2', text: 'two' },
    { id: '3', text: 'three' },
  ];
  await el.updateComplete;
  expect(entryEls(el).length).to.equal(3);
});

it('retains zero as an explicit full-history rendering opt-in', async () => {
  const el = (await fixture(html`<lr-transcript-feed max-rendered-entries="0"></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = Array.from({ length: 501 }, (_, index) => ({ id: String(index), text: String(index) }));
  await el.updateComplete;
  expect(entryEls(el)).to.have.lengthOf(501);
});

it('uses first-wins identity and rejects malformed transcript ids or text from rendering and announcements', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [
    null,
    7,
    { id: 'same', text: 'first' },
    { id: 'same', text: 'second' },
    { id: 'missing-text' },
    { id: 'null-text', text: null },
    { id: '', text: 'missing identity' },
    { id: '   ', text: 'blank identity' },
  ] as unknown as LyraTranscriptEntry[];
  await el.updateComplete;
  expect(entryEls(el)).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelector('[part="text"]')!.textContent).to.equal('first');

  el.entries = [
    null,
    false,
    { id: '', text: 'missing identity' },
    { id: '   ', text: 'blank identity' },
  ] as unknown as LyraTranscriptEntry[];
  await el.updateComplete;
  expect(entryEls(el)).to.have.lengthOf(0);
  expect(el.shadowRoot!.querySelector('[part="empty"]') != null).to.equal(true);
});

describe('follow / stick-to-bottom contract', () => {
  it('releases follow on scroll-up past the near-bottom threshold, emits lr-follow-change, and shows the jump button', async () => {
    const el = (await fixture(
      html`<lr-transcript-feed style="block-size: 120px"></lr-transcript-feed>`,
    )) as LyraTranscriptFeed;
    el.entries = Array.from({ length: 30 }, (_, i) => ({ id: String(i), speaker: 'You', text: `line ${i}` }));
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollHeight).to.be.greaterThan(base.clientHeight);

    const followChanges: boolean[] = [];
    el.addEventListener('lr-follow-change', (e) => followChanges.push((e as CustomEvent<{ following: boolean }>).detail.following));

    base.scrollTop = 0;
    base.dispatchEvent(new Event('scroll'));
    await el.updateComplete;
    expect(el.follow).to.be.false;
    expect(followChanges).to.deep.equal([false]);
    expect(el.shadowRoot!.querySelector('[part="jump-button"]')).to.exist;

    (el.shadowRoot!.querySelector('[part="jump-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.follow).to.be.true;
    expect(followChanges).to.deep.equal([false, true]);
    expect((el.shadowRoot!.querySelector('[part="jump-button"]')) === null).to.be.true;
  });

  it('renders the jump-button hover state', async () => {
    const el = await fixture<LyraTranscriptFeed>(html`
      <lr-transcript-feed
        style="block-size: 120px; --lr-color-brand-quiet: rgb(1, 2, 3)"
      ></lr-transcript-feed>
    `);
    el.entries = Array.from({ length: 30 }, (_, i) => ({ id: String(i), text: `line ${i}` }));
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    base.scrollTop = 0;
    base.dispatchEvent(new Event('scroll'));
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector<HTMLElement>('[part="jump-button"]')!;
    button.scrollIntoView({ block: 'center' });
    const rect = button.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(
        () => getComputedStyle(button).backgroundColor === 'rgb(1, 2, 3)',
        'the jump-button hover background never appeared',
      );
    } finally {
      await resetMouse();
    }
  });

  it('auto-scrolls to the bottom on new entries while follow is true', async () => {
    const el = (await fixture(
      html`<lr-transcript-feed style="block-size: 80px"></lr-transcript-feed>`,
    )) as LyraTranscriptFeed;
    el.entries = Array.from({ length: 20 }, (_, i) => ({ id: String(i), text: `line ${i}` }));
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollHeight - base.scrollTop - base.clientHeight).to.be.lessThan(2);
  });

  it('scrollToBottom re-engages follow and performs a plain instant scroll, without echoing an event -- imperative navigation, not a user action', async () => {
    const el = (await fixture(
      html`<lr-transcript-feed follow="false" style="block-size: 80px"></lr-transcript-feed>`,
    )) as LyraTranscriptFeed;
    el.entries = Array.from({ length: 20 }, (_, i) => ({ id: String(i), text: `line ${i}` }));
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.scrollTop = 0;
    let followChanges = 0;
    el.addEventListener('lr-follow-change', () => { followChanges += 1; });

    el.scrollToBottom();
    await el.updateComplete;

    expect(base.scrollHeight - base.scrollTop - base.clientHeight).to.be.lessThan(2);
    expect(el.follow).to.be.true;
    expect(followChanges).to.equal(0);
  });

  it('never emits lr-follow-change for a direct programmatic follow assignment, in either direction', async () => {
    const el = document.createElement('lr-transcript-feed') as LyraTranscriptFeed;
    let fired = false;
    el.addEventListener('lr-follow-change', () => (fired = true));
    document.body.appendChild(el);
    await el.updateComplete;
    expect(fired).to.be.false; // first render, no transition yet

    el.follow = false;
    await el.updateComplete;
    expect(fired, 'a direct false assignment is controlled input, not a user action').to.be.false;

    el.follow = true;
    await el.updateComplete;
    expect(fired, 'a direct true assignment is controlled input, not a user action').to.be.false;

    document.body.removeChild(el);
  });

  it('emits lr-follow-change exactly once for a genuine user scroll away from the tail, and once for scrolling back to it -- even with a programmatic assignment interleaved between them', async () => {
    const el = (await fixture(
      html`<lr-transcript-feed style="block-size: 120px"></lr-transcript-feed>`,
    )) as LyraTranscriptFeed;
    el.entries = Array.from({ length: 30 }, (_, i) => ({ id: String(i), text: `line ${i}` }));
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    const followChanges: boolean[] = [];
    el.addEventListener('lr-follow-change', (e) =>
      followChanges.push((e as CustomEvent<{ following: boolean }>).detail.following),
    );

    // Genuine user-driven scroll away from the tail.
    base.scrollTop = 0;
    base.dispatchEvent(new Event('scroll'));
    await el.updateComplete;
    expect(el.follow).to.be.false;
    expect(followChanges).to.deep.equal([false]);

    // A host mirroring `following` straight back into the property in its own event handler --
    // the exact feedback-loop shape the original bug produced -- must not itself re-trigger
    // anything: the gate keys off *who* set `follow`, not merely that it changed.
    el.follow = false;
    await el.updateComplete;
    expect(followChanges, 'the redundant programmatic re-assignment echoes nothing').to.deep.equal([false]);

    // Genuine user-driven scroll back to the tail.
    base.scrollTop = base.scrollHeight - base.clientHeight;
    base.dispatchEvent(new Event('scroll'));
    await el.updateComplete;
    expect(el.follow).to.be.true;
    expect(followChanges).to.deep.equal([false, true]);
  });

  it('honors follow="false" as a plain HTML attribute, not just a property binding', async () => {
    const el = (await fixture(
      html`<lr-transcript-feed follow="false" .entries=${[{ id: '1', text: 'hi' }]}></lr-transcript-feed>`,
    )) as LyraTranscriptFeed;
    await el.updateComplete;
    expect(el.follow).to.be.false;
    // Confirms the real behavioral effect of follow=false, not just the property value: the
    // jump-to-latest button only renders while follow is false.
    expect(el.shadowRoot!.querySelectorAll('[part="jump-button"]').length).to.equal(1);
  });

  it('keeps the jump control at the shared minimum hit area while follow is false', async () => {
    const el = (await fixture(
      html`<lr-transcript-feed
        follow="false"
        .entries=${[{ id: '1', text: 'hi' }]}
      ></lr-transcript-feed>`,
    )) as LyraTranscriptFeed;
    const button = el.shadowRoot!.querySelector('[part="jump-button"]') as HTMLButtonElement;
    const style = getComputedStyle(button);
    expect(style.minInlineSize).to.equal('40px');
    expect(style.minBlockSize).to.equal('40px');
  });

  it('inherits a 20px consumer font into the jump control', async () => {
    const el = (await fixture(html`
      <lr-transcript-feed
        follow="false"
        style="font-size:20px"
        .entries=${[{ id: '1', text: 'Latest caption' }]}
      ></lr-transcript-feed>
    `)) as LyraTranscriptFeed;
    const button = el.shadowRoot!.querySelector<HTMLElement>('[part="jump-button"]')!;
    expect(getComputedStyle(button).fontSize).to.equal('20px');
  });
});

it('gives [part="text"] dir="auto" for mixed-language captions', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [{ id: '1', text: 'hello' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="text"]')!.getAttribute('dir')).to.equal('auto');
});

it('exposes its scroll surface as the keyboard focus target', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.tabIndex).to.equal(0);
  base.focus();
  expect((el.shadowRoot!.activeElement) === (base)).to.equal(true);
});

it('contains long final and interim captions in an exact 320px RTL allocation', async () => {
  const long = 'AnExtremelyLongTranscriptEntryWithoutNaturalBreaks'.repeat(8);
  const container = (await fixture(html`
    <div dir="rtl" style="inline-size:320px;block-size:120px">
      <lr-transcript-feed
        follow="false"
        style="inline-size:100%;block-size:100%"
        show-timestamps
        .entries=${[
          { id: 'final', speaker: long, text: long, timestamp: Date.now() - 20_000 },
          { id: 'interim', speaker: long, text: long, timestamp: Date.now() - 10_000, interim: true },
        ]}
      ></lr-transcript-feed>
    </div>
  `)) as HTMLDivElement;
  const el = container.querySelector('lr-transcript-feed') as LyraTranscriptFeed;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(Math.round(container.getBoundingClientRect().width)).to.equal(320);
  expect(container.scrollWidth).to.be.at.most(container.clientWidth + 1);
  expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
  for (const entry of entryEls(el)) {
    expect(entry.scrollWidth).to.be.at.most(entry.clientWidth + 1);
  }
  expect(el.shadowRoot!.querySelector('[part="interim-area"]') != null).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="jump-button"]') != null).to.equal(true);
});

it('is accessible with a mix of final and interim entries', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [
    { id: '1', speaker: 'You', text: 'final' },
    { id: '2', speaker: 'You', text: 'partial', interim: true },
  ];
  await el.updateComplete;
  // Every `[part='entry']` plays lr-transcript-fade-in as it's rendered. Left running, axe's
  // color-contrast check factors in each entry's current transitional opacity, so sampling
  // mid-fade blends its text and background toward each other and reports a false violation.
  // Finishing the reveal matches the stable, fully visible rendering that users receive.
  el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="entry"]').forEach((entry) => {
    entry.getAnimations().forEach((animation) => animation.finish());
  });
  await expect(el).to.be.accessible();
});

it('localizes the log label and empty state via this.localize()', async () => {
  const el = (await fixture(html`
    <lr-transcript-feed
      .strings=${{ transcriptFeedLabel: 'Transcription', transcriptFeedEmpty: 'Rien pour le moment' }}
    ></lr-transcript-feed>
  `)) as LyraTranscriptFeed;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent!.trim()).to.equal('Rien pour le moment');
  el.entries = [{ id: '1', text: 'hi' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="log"]')!.getAttribute('aria-label')).to.equal('Transcription');
});

it('renders the interim marker visually hidden, not as visible text', async () => {
  // The `.sr-only` class only hides anything if a stylesheet in THIS shadow root defines it.
  // `LyraElement.styles` is `[tokens]` and carries no such rule, so without adopting the shared
  // `srOnly` sheet the marker painted as ordinary visible text next to the entry. Asserting
  // textContent (as the sibling test above does) cannot catch that -- only rendered geometry can.
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [{ id: '2', speaker: 'You', text: 'partial...', interim: true }];
  await el.updateComplete;

  const marker = el.shadowRoot!.querySelector('.sr-only') as HTMLElement;
  const rect = marker.getBoundingClientRect();
  expect(rect.width, 'sr-only marker width').to.be.at.most(1);
  expect(rect.height, 'sr-only marker height').to.be.at.most(1);
});

/** The shared, light-DOM live region `acquireAnnouncementSink()` mounts in the host document.
 *  A region rendered inside a component's own shadow root is not reliably announced (JAWS with
 *  Firefox ignores one outright), so the announcement has to be observable *here*, not in the
 *  component's shadow tree. */
function politeSink(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-lr-live-region="polite"]');
}

function sinkMessages(): string[] {
  return [...(politeSink()?.children ?? [])].map((child) => child.textContent!.trim());
}

it('keeps its own shadow role="log" non-live -- a shadow-root live region is not reliably announced', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [{ id: 'turn-1', text: 'final' }];
  await el.updateComplete;
  const log = el.shadowRoot!.querySelector('[part="log"]') as HTMLElement;
  expect(log.getAttribute('role')).to.equal('log');
  expect(log.getAttribute('aria-live')).to.equal('off');
});

it('announces a caption finalizing through the shared light-DOM live region, exactly once', async () => {
  const el = (await fixture(html`<lr-transcript-feed></lr-transcript-feed>`)) as LyraTranscriptFeed;
  await el.updateComplete;
  expect(politeSink() !== null, 'the sink mounts on connect, ahead of any text').to.equal(true);

  el.entries = [{ id: 'turn-1', speaker: 'You', text: 'partial', interim: true }];
  await el.updateComplete;
  expect(sinkMessages(), 'an interim caption is never announced').to.deep.equal([]);

  el.entries = [{ id: 'turn-1', speaker: 'You', text: 'final text' }];
  await el.updateComplete;
  expect(sinkMessages()).to.deep.equal(['final text']);

  el.entries = [{ id: 'turn-1', speaker: 'You', text: 'revised', interim: true }];
  await el.updateComplete;
  el.entries = [{ id: 'turn-1', speaker: 'You', text: 're-finalized' }];
  await el.updateComplete;
  expect(sinkMessages(), 'final/interim/final keeps monotonic per-session history').to.deep.equal(['final text']);

  el.entries = [];
  await el.updateComplete;
  el.entries = [{ id: 'turn-1', text: 're-added' }];
  await el.updateComplete;
  expect(sinkMessages(), 'removing and re-adding the same id does not replay it').to.deep.equal(['final text']);

  // A later, unrelated update must not re-announce an entry already spoken.
  el.entries = [
    { id: 'turn-1', speaker: 'You', text: 'final text' },
    { id: 'turn-2', speaker: 'You', text: 'next', interim: true },
  ];
  await el.updateComplete;
  expect(sinkMessages()).to.deep.equal(['final text']);
});

it('resets announcement history only when sessionId changes and baselines the new session', async () => {
  const el = (await fixture(html`<lr-transcript-feed session-id="session-a"></lr-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [{ id: 'turn-1', text: 'session A' }];
  await el.updateComplete;
  expect(sinkMessages()).to.deep.equal(['session A']);

  el.sessionId = 'session-b';
  el.entries = [{ id: 'turn-1', text: 'existing session B' }];
  await el.updateComplete;
  expect(sinkMessages(), 'existing new-session transcript is a silent baseline').to.deep.equal(['session A']);

  el.entries = [
    { id: 'turn-1', text: 'existing session B' },
    { id: 'turn-2', text: 'new in session B' },
  ];
  await el.updateComplete;
  expect(sinkMessages()).to.deep.equal(['session A', 'new in session B']);
});

it('keeps the first entries after a standalone sessionId change as a silent baseline', async () => {
  const el = (await fixture(html`
    <lr-transcript-feed
      session-id="session-a"
      .entries=${[{ id: 'turn-a', text: 'existing session A' }] as LyraTranscriptEntry[]}
    ></lr-transcript-feed>
  `)) as LyraTranscriptFeed;
  await el.updateComplete;
  expect(sinkMessages(), 'the mounted session is silent').to.deep.equal([]);

  el.sessionId = 'session-b';
  await el.updateComplete;
  expect(sinkMessages(), 'changing identity alone announces nothing').to.deep.equal([]);

  el.entries = [{ id: 'turn-b-existing', text: 'existing session B' }];
  await el.updateComplete;
  expect(sinkMessages(), 'the later-arriving new-session backlog is a silent baseline').to.deep.equal(
    [],
  );

  el.entries = [
    ...el.entries,
    { id: 'turn-b-new', text: 'new in session B' },
  ];
  await el.updateComplete;
  expect(sinkMessages()).to.deep.equal(['new in session B']);
});

it('preserves an explicitly empty log label override by presence', async () => {
  const el = (await fixture(html`
    <lr-transcript-feed aria-label="" .entries=${[{ id: '1', text: 'hi' }]}></lr-transcript-feed>
  `)) as LyraTranscriptFeed;
  expect(el.shadowRoot!.querySelector('[part="log"]')!.getAttribute('aria-label')).to.equal('');
});

it('never announces the entries it was mounted with -- only captions that finalize afterwards', async () => {
  const el = (await fixture(html`
    <lr-transcript-feed
      .entries=${[
        { id: 'turn-1', text: 'already said' },
        { id: 'turn-2', text: 'also already said' },
      ] as LyraTranscriptEntry[]}
    ></lr-transcript-feed>
  `)) as LyraTranscriptFeed;
  await el.updateComplete;
  expect(sinkMessages()).to.deep.equal([]);

  el.entries = [...el.entries, { id: 'turn-3', text: 'brand new' }];
  await el.updateComplete;
  expect(sinkMessages()).to.deep.equal(['brand new']);
});

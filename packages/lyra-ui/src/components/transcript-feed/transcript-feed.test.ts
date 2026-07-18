import { fixture, expect, html } from '@open-wc/testing';
import './transcript-feed.js';
import type { LyraTranscriptFeed, LyraTranscriptEntry } from './transcript-feed.js';

function entryEls(el: LyraTranscriptFeed): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll('[part~="entry"]')] as HTMLElement[];
}

it('defaults to entries=[], follow=true, show-timestamps=false, max-rendered-entries=0', async () => {
  const el = (await fixture(html`<lyra-transcript-feed></lyra-transcript-feed>`)) as LyraTranscriptFeed;
  expect(el.entries).to.deep.equal([]);
  expect(el.follow).to.be.true;
  expect(el.hasAttribute('follow')).to.be.true;
  expect(el.showTimestamps).to.be.false;
  expect(el.maxRenderedEntries).to.equal(0);
});

it('shows the localized empty state (or a slotted override) when entries is empty', async () => {
  const el = (await fixture(html`<lyra-transcript-feed></lyra-transcript-feed>`)) as LyraTranscriptFeed;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent!.trim()).to.equal('No transcript yet');

  const withSlot = (await fixture(html`
    <lyra-transcript-feed><span slot="empty">Nothing said yet</span></lyra-transcript-feed>
  `)) as LyraTranscriptFeed;
  expect(withSlot.shadowRoot!.querySelector('[part="empty"] slot')!.assignedElements()[0].textContent).to.equal(
    'Nothing said yet',
  );
});

it('renders final entries inside a role="log" container labeled Transcript, grouping consecutive same-speaker rows', async () => {
  const entries: LyraTranscriptEntry[] = [
    { id: '1', speaker: 'You', text: 'Hello' },
    { id: '2', speaker: 'You', text: 'there' },
    { id: '3', speaker: 'Agent', text: 'Hi!' },
  ];
  const el = (await fixture(html`<lyra-transcript-feed></lyra-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = entries;
  await el.updateComplete;

  const log = el.shadowRoot!.querySelector('[part="log"]')!;
  expect(log.getAttribute('role')).to.equal('log');
  expect(log.getAttribute('aria-label')).to.equal('Transcript');

  const speakers = [...log.querySelectorAll('[part="speaker"]')].map((s) => s.textContent);
  expect(speakers).to.deep.equal(['You', 'Agent']); // second "You" row omits a repeated label
  expect(entryEls(el).length).to.equal(3);
});

it('renders interim entries outside the log, marked data-interim with a visually-hidden Transcribing marker', async () => {
  const el = (await fixture(html`<lyra-transcript-feed></lyra-transcript-feed>`)) as LyraTranscriptFeed;
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

it('finalizing an entry (same id, interim flips to unset) moves it from the interim area into the log', async () => {
  const el = (await fixture(html`<lyra-transcript-feed></lyra-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [{ id: 'turn-1', speaker: 'You', text: 'partial', interim: true }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="log"]')!.querySelectorAll('[part~="entry"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="interim-area"]')).to.exist;

  el.entries = [{ id: 'turn-1', speaker: 'You', text: 'final text' }];
  await el.updateComplete;
  const log = el.shadowRoot!.querySelector('[part="log"]')!;
  expect(log.querySelectorAll('[part~="entry"]').length).to.equal(1);
  expect(log.querySelector('[part="text"]')!.textContent).to.equal('final text');
  expect(el.shadowRoot!.querySelector('[part="interim-area"]')).to.be.null;
});

it('a same-id text update replaces the row in place rather than duplicating it', async () => {
  const el = (await fixture(html`<lyra-transcript-feed></lyra-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [{ id: '1', speaker: 'You', text: 'a' }];
  await el.updateComplete;
  el.entries = [{ id: '1', speaker: 'You', text: 'ab' }];
  await el.updateComplete;
  expect(entryEls(el).length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="text"]')!.textContent).to.equal('ab');
});

it('names the log via label, with a host aria-label winning over both label and the localized default', async () => {
  const el = (await fixture(html`<lyra-transcript-feed label="Call captions"></lyra-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [{ id: '1', text: 'hi' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="log"]')!.getAttribute('aria-label')).to.equal('Call captions');

  el.setAttribute('aria-label', 'Support call');
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal('Support call');
  expect(el.shadowRoot!.querySelector('[part="log"]')!.getAttribute('aria-label')).to.equal('Support call');
});

describe('timestamps', () => {
  it('renders the built-in short-time format when no formatTimestamp is supplied', async () => {
    const el = (await fixture(html`<lyra-transcript-feed show-timestamps locale="en"></lyra-transcript-feed>`)) as LyraTranscriptFeed;
    el.entries = [{ id: '1', text: 'hi', timestamp: Date.UTC(2026, 0, 1, 12, 34) }];
    await el.updateComplete;
    const rendered = el.shadowRoot!.querySelector('[part="timestamp"]')!.textContent!;
    expect(rendered).to.equal(
      new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(Date.UTC(2026, 0, 1, 12, 34))),
    );
  });

  it('hides timestamps by default and shows them (via formatTimestamp when supplied) when show-timestamps is set', async () => {
    const el = (await fixture(html`<lyra-transcript-feed></lyra-transcript-feed>`)) as LyraTranscriptFeed;
    el.entries = [{ id: '1', text: 'hi', timestamp: 1700000000000 }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="timestamp"]')).to.be.null;

    el.showTimestamps = true;
    el.formatTimestamp = (ms) => `t=${ms}`;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="timestamp"]')!.textContent).to.equal('t=1700000000000');
  });
});

it('max-rendered-entries caps the DOM row count to the newest N without mutating host data', async () => {
  const el = (await fixture(html`<lyra-transcript-feed max-rendered-entries="2"></lyra-transcript-feed>`)) as LyraTranscriptFeed;
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

it('normalizes a NaN max-rendered-entries to 0 ("render all") instead of leaving it unclamped', async () => {
  const el = (await fixture(
    html`<lyra-transcript-feed max-rendered-entries="not-a-number"></lyra-transcript-feed>`,
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

describe('follow / stick-to-bottom contract', () => {
  it('releases follow on scroll-up past the near-bottom threshold, emits lyra-follow-change, and shows the jump button', async () => {
    const el = (await fixture(
      html`<lyra-transcript-feed style="block-size: 120px"></lyra-transcript-feed>`,
    )) as LyraTranscriptFeed;
    el.entries = Array.from({ length: 30 }, (_, i) => ({ id: String(i), speaker: 'You', text: `line ${i}` }));
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollHeight).to.be.greaterThan(base.clientHeight);

    const followChanges: boolean[] = [];
    el.addEventListener('lyra-follow-change', (e) => followChanges.push((e as CustomEvent<{ following: boolean }>).detail.following));

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
    expect(el.shadowRoot!.querySelector('[part="jump-button"]')).to.be.null;
  });

  it('auto-scrolls to the bottom on new entries while follow is true', async () => {
    const el = (await fixture(
      html`<lyra-transcript-feed style="block-size: 80px"></lyra-transcript-feed>`,
    )) as LyraTranscriptFeed;
    el.entries = Array.from({ length: 20 }, (_, i) => ({ id: String(i), text: `line ${i}` }));
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollHeight - base.scrollTop - base.clientHeight).to.be.lessThan(2);
  });

  it('emits lyra-follow-change for a direct programmatic assignment too, but never for the value already in effect on first render', async () => {
    const el = document.createElement('lyra-transcript-feed') as LyraTranscriptFeed;
    let fired = false;
    el.addEventListener('lyra-follow-change', () => (fired = true));
    document.body.appendChild(el);
    await el.updateComplete;
    expect(fired).to.be.false; // first render, no transition yet

    let count = 0;
    el.addEventListener('lyra-follow-change', () => count++);
    el.follow = false;
    await el.updateComplete;
    expect(count).to.equal(1);
    el.follow = true;
    await el.updateComplete;
    expect(count).to.equal(2);
    document.body.removeChild(el);
  });
});

it('gives [part="text"] dir="auto" for mixed-language captions', async () => {
  const el = (await fixture(html`<lyra-transcript-feed></lyra-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [{ id: '1', text: 'hello' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="text"]')!.getAttribute('dir')).to.equal('auto');
});

it('is accessible with a mix of final and interim entries', async () => {
  const el = (await fixture(html`<lyra-transcript-feed></lyra-transcript-feed>`)) as LyraTranscriptFeed;
  el.entries = [
    { id: '1', speaker: 'You', text: 'final' },
    { id: '2', speaker: 'You', text: 'partial', interim: true },
  ];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('localizes the log label and empty state via this.localize()', async () => {
  const el = (await fixture(html`
    <lyra-transcript-feed
      .strings=${{ transcriptFeedLabel: 'Transcription', transcriptFeedEmpty: 'Rien pour le moment' }}
    ></lyra-transcript-feed>
  `)) as LyraTranscriptFeed;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent!.trim()).to.equal('Rien pour le moment');
  el.entries = [{ id: '1', text: 'hi' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="log"]')!.getAttribute('aria-label')).to.equal('Transcription');
});

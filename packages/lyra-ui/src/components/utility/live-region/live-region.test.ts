import { fixture, expect, html, waitUntil, nextFrame } from '@open-wc/testing';
import {
  ANNOUNCEMENT_SINK_ATTRIBUTE,
  type AnnouncementPoliteness,
} from '../../../internal/announcer.js';
import './live-region.js';
import type { LyraLiveRegion } from './live-region.js';

function regionEl(el: LyraLiveRegion): HTMLElement {
  return el.shadowRoot!.querySelector('[part="region"]') as HTMLElement;
}

/** The shared light-DOM element the announcement actually lands in. Live regions rendered inside
 *  a shadow root are not reliably announced (JAWS + Firefox ignore them outright), so the shadow
 *  `part="region"` is only a mirror -- these helpers read the real announced copy. */
function sinkElement(
  politeness: AnnouncementPoliteness = 'polite',
  doc: Document = document,
): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`);
}

function sinkTexts(
  politeness: AnnouncementPoliteness = 'polite',
  doc: Document = document,
): string[] {
  const element = sinkElement(politeness, doc);
  return element ? Array.from(element.children).map((child) => child.textContent ?? '') : [];
}

it('is accessible in its default, empty state', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  await expect(el).to.be.accessible();
});

it('is accessible once it has announced text', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  el.announce('Loaded 12 results', { force: true });
  await expect(el).to.be.accessible();
});

it('defaults to mode="polite", mounting a light-DOM role="status" sink', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  expect(el.mode).to.equal('polite');
  const sink = sinkElement('polite');
  expect(sink !== null, 'a connected region must mount its sink up front').to.be.true;
  expect(sink!.getRootNode() === document, 'the announced copy must live in the light DOM').to.be
    .true;
  expect(sink!.getAttribute('role')).to.equal('status');
  expect(sink!.getAttribute('aria-live')).to.equal('polite');
});

it('mode="assertive" mounts a light-DOM role="alert" sink', async () => {
  const el = (await fixture(
    html`<lr-live-region mode="assertive"></lr-live-region>`,
  )) as LyraLiveRegion;
  expect(el.mode).to.equal('assertive');
  const sink = sinkElement('assertive');
  expect(sink !== null).to.be.true;
  expect(sink!.getAttribute('role')).to.equal('alert');
  expect(sink!.getAttribute('aria-live')).to.equal('assertive');
});

it('leaves the shadow part="region" mirror out of the accessibility tree so nothing double-announces', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  const region = regionEl(el);
  expect(region.getAttribute('aria-hidden')).to.equal('true');
  expect(region.hasAttribute('aria-live'), 'the mirror must not be a second live region').to.be
    .false;
  expect(region.hasAttribute('role')).to.be.false;
});

it('sizes the shadow part="region" mirror from the shared --lr-size-1px token, not a hard-coded literal', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  const region = regionEl(el);

  // Default token value: the hairline box every visually-hidden-but-announced element uses.
  expect(getComputedStyle(region).inlineSize).to.equal('1px');
  expect(getComputedStyle(region).blockSize).to.equal('1px');

  // Retheming the size scale through the documented `--lr-theme-*` hook must reach the mirror.
  // A hard-coded `width: 1px` / `height: 1px` / `margin: -1px` ignores it entirely, which is the
  // regression this asserts against -- src/internal/a11y.ts's `srOnly` is shared by ~50
  // components, so an untokenized copy there silently exempts all of them from the token scale.
  el.style.setProperty('--lr-theme-size-1px', '3px');
  const themed = getComputedStyle(region);
  expect(themed.inlineSize).to.equal('3px');
  expect(themed.blockSize).to.equal('3px');
  expect(themed.marginTop).to.equal('-3px');
  expect(themed.marginInlineStart).to.equal('-3px');

  // Still visually hidden and still in the accessibility tree either way.
  expect(themed.position).to.equal('absolute');
  expect(themed.overflow).to.equal('hidden');
  expect(themed.whiteSpace).to.equal('nowrap');
});

it('reflects mode as a host attribute', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  el.mode = 'assertive';
  await el.updateComplete;
  expect(el.getAttribute('mode')).to.equal('assertive');
});

it('normalizes unsupported mode attributes and untyped property writes', async () => {
  const el = (await fixture(
    html`<lr-live-region mode="urgent"></lr-live-region>`,
  )) as LyraLiveRegion;
  expect(el.mode).to.equal('polite');
  expect(el.getAttribute('mode')).to.equal('polite');

  el.mode = 'assertive';
  await el.updateComplete;
  (el as unknown as Record<string, unknown>).mode = 'urgent';
  await el.updateComplete;
  expect(el.mode).to.equal('polite');
  expect(el.getAttribute('mode')).to.equal('polite');
  expect(sinkElement('polite')).to.not.equal(null);
});

it('defaults throttleMs to 500, settable via the throttle-ms attribute', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  expect(el.throttleMs).to.equal(500);

  const withAttr = (await fixture(
    html`<lr-live-region throttle-ms="120"></lr-live-region>`,
  )) as LyraLiveRegion;
  expect(withAttr.throttleMs).to.equal(120);
});

it('renders the region visually hidden, but present in the accessibility tree', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  const region = regionEl(el);
  const rect = region.getBoundingClientRect();
  expect(rect.width).to.be.at.most(1);
  expect(rect.height).to.be.at.most(1);

  const sink = sinkElement('polite')!;
  const sinkRect = sink.getBoundingClientRect();
  expect(sinkRect.width).to.be.at.most(1);
  expect(sinkRect.height).to.be.at.most(1);
});

it('announce() writes the coalesced text into the sink once the throttle window elapses', async () => {
  const el = (await fixture(
    html`<lr-live-region throttle-ms="30"></lr-live-region>`,
  )) as LyraLiveRegion;
  const region = regionEl(el);

  el.announce('first');
  el.announce('second');
  expect(sinkTexts(), 'must not announce synchronously').to.deep.equal([]);

  await waitUntil(() => sinkTexts().length > 0, 'expected the coalesced text to land', {
    timeout: 2000,
  });
  expect(sinkTexts(), 'the throttle must still coalesce a burst to one announcement').to.deep.equal([
    'second',
  ]);
  expect(region.textContent, 'the shadow mirror tracks the announced text').to.equal('second');
});

it('announce(text, { force: true }) announces immediately, bypassing the throttle window', async () => {
  const el = (await fixture(
    html`<lr-live-region throttle-ms="5000"></lr-live-region>`,
  )) as LyraLiveRegion;

  el.announce('urgent', { force: true });
  expect(sinkTexts()).to.deep.equal(['urgent']);
  expect(regionEl(el).textContent).to.equal('urgent');
});

it('announces the same text twice as two additions, with no clear-then-restore step', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  const region = regionEl(el);

  el.announce('same', { force: true });
  el.announce('same', { force: true });

  expect(
    sinkTexts(),
    'a repeat must be a second addition so assistive tech reads it twice',
  ).to.deep.equal(['same', 'same']);
  // The old clear-then-reannounce dance blanked the text for a frame; nothing does that now.
  expect(region.textContent, 'the mirror must never blank out').to.equal('same');
  await nextFrame();
  expect(region.textContent).to.equal('same');
  expect(sinkTexts()).to.deep.equal(['same', 'same']);
});

it('back-to-back distinct announcements each land in order', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  const region = regionEl(el);

  el.announce('one', { force: true });
  el.announce('two', { force: true });
  expect(sinkTexts()).to.deep.equal(['one', 'two']);
  expect(region.textContent).to.equal('two');
});

it('normalizes a NaN/negative throttleMs to the sane 500ms default instead of an ~immediate flush', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;

  el.throttleMs = NaN;
  await el.updateComplete;
  el.announce('a');
  // An unsanitized NaN/negative throttleMs reaching the real setTimeout would clamp to ~0ms per spec
  // and flush almost immediately; the sanitized 500ms default must still be pending a frame later.
  await nextFrame();
  expect(
    sinkTexts(),
    'must not have flushed on the very next frame with the sanitized default',
  ).to.deep.equal([]);
  await waitUntil(
    () => sinkTexts().length === 1,
    'expected the sanitized default window to eventually flush',
    { timeout: 2000 },
  );

  // A negative window clamps to 0 rather than back to the 500ms default (`finiteDuration`'s floor
  // is 0), which is still a *scheduled* flush -- never the same-turn write an unsanitized negative
  // value would make setTimeout attempt. Asserting "still pending one frame later" here would be a
  // race against that 0ms timer, so this asserts what actually holds: nothing lands synchronously,
  // and the text still arrives.
  el.throttleMs = -100;
  await el.updateComplete;
  el.announce('b');
  expect(sinkTexts(), 'a negative throttleMs must not flush synchronously').to.deep.equal(['a']);
  await waitUntil(() => sinkTexts().length === 2, 'expected the clamped window to flush', {
    timeout: 2000,
  });
  expect(sinkTexts()).to.deep.equal(['a', 'b']);
});

it('changing throttle-ms applies to the next burst', async () => {
  const el = (await fixture(
    html`<lr-live-region throttle-ms="5000"></lr-live-region>`,
  )) as LyraLiveRegion;

  el.throttleMs = 20;
  await el.updateComplete;

  el.announce('fast');
  await waitUntil(() => sinkTexts().includes('fast'), 'expected the shortened window to apply', {
    timeout: 2000,
  });
});

it('buffers a flush that lands before the first render and applies it once ready', async () => {
  const el = document.createElement('lr-live-region') as LyraLiveRegion;
  document.body.appendChild(el);
  // Synchronously right after mounting -- before firstUpdated() has had a
  // chance to run -- mirrors a consumer that mounts-then-immediately-uses a
  // region the way toaster.ts mounts-then-immediately-uses a toast region.
  el.announce('early', { force: true });
  expect(sinkTexts(), 'the announcement itself never waits on a render').to.deep.equal(['early']);

  await el.updateComplete;
  expect(regionEl(el).textContent, 'the mirror catches up on first render').to.equal('early');
  expect(
    sinkTexts(),
    'catching the mirror up must not announce the buffered text a second time',
  ).to.deep.equal(['early']);
  el.remove();
});

it('a mode change followed immediately by a force-announce lands with the new urgency', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;

  // Mirrors stream-status's announceTransition(): set `mode` then force an
  // announcement in the same synchronous turn, before Lit's template
  // re-render for the `mode` change has had a chance to flush.
  el.mode = 'assertive';
  el.announce('urgent update', { force: true });

  expect(sinkTexts('assertive'), 'the text must land in the assertive sink').to.deep.equal([
    'urgent update',
  ]);
  expect(sinkTexts('polite'), 'and never in the polite one').to.deep.equal([]);
  expect(regionEl(el).textContent).to.equal('urgent update');
});

it('releases its sink on disconnect, unmounting the shared region once nobody holds it', async () => {
  const first = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  const second = document.createElement('lr-live-region') as LyraLiveRegion;
  document.body.appendChild(second);

  first.announce('one', { force: true });
  second.announce('two', { force: true });
  expect(sinkTexts(), 'both regions share one sink').to.deep.equal(['one', 'two']);

  first.remove();
  expect(sinkElement('polite') !== null, 'a still-mounted consumer keeps the sink').to.be.true;
  expect(sinkTexts(), 'the departing consumer takes only its own nodes').to.deep.equal(['two']);

  second.remove();
  expect(sinkElement('polite') === null, 'the last disconnect unmounts the sink').to.be.true;
});

it('cancels a pending announcement on disconnect so it never lands after removal', async () => {
  const el = (await fixture(
    html`<lr-live-region throttle-ms="30"></lr-live-region>`,
  )) as LyraLiveRegion;
  const region = regionEl(el);

  el.announce('too late');
  el.remove();

  await new Promise((resolve) => setTimeout(resolve, 90));
  expect(region.textContent, 'a disconnected region must not still flush').to.equal('');
  expect(sinkElement('polite') === null, 'and must not resurrect a sink').to.be.true;
});

it('drops a force-flushed write buffered before firstUpdated when disconnected', async () => {
  const el = document.createElement('lr-live-region') as LyraLiveRegion;
  document.body.appendChild(el);

  el.announce('stale buffered text', { force: true });
  el.remove();

  await el.updateComplete;
  expect(
    regionEl(el).textContent,
    'a buffered write must not land after the element disconnects',
  ).to.equal('');

  document.body.appendChild(el);
  await el.updateComplete;
  expect(regionEl(el).textContent, 'the dropped write must not reappear on reconnect').to.equal('');
  el.remove();
});

it('announces into its own document once adopted into an iframe', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const ownerDocument = iframe.contentDocument!;

  try {
    ownerDocument.body.appendChild(el);
    el.announce('inside the frame', { force: true });

    expect(sinkTexts('polite', ownerDocument)).to.deep.equal(['inside the frame']);
    expect(
      sinkElement('polite') === null,
      'the host document must not keep a sink for an adopted region',
    ).to.be.true;
  } finally {
    el.remove();
    iframe.remove();
  }
});

it('rebinds throttling timers to the adopted document window', async () => {
  const el = (await fixture(html`<lr-live-region></lr-live-region>`)) as LyraLiveRegion;
  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const ownerWindow = iframe.contentWindow!;
  const originalSetTimeout = ownerWindow.setTimeout;
  const originalClearTimeout = ownerWindow.clearTimeout;
  const callbacks = new Map<number, () => void>();
  const clears: number[] = [];
  ownerWindow.setTimeout = ((handler: TimerHandler) => {
    if (typeof handler === 'function') callbacks.set(61, handler);
    return 61;
  }) as typeof ownerWindow.setTimeout;
  ownerWindow.clearTimeout = ((handle?: number) => {
    if (handle !== undefined) {
      clears.push(handle);
      callbacks.delete(handle);
    }
  }) as typeof ownerWindow.clearTimeout;

  try {
    iframe.contentDocument!.body.append(el);
    el.announce('deferred in frame');
    expect(callbacks.has(61), 'the adopted window schedules the throttle').to.be.true;

    el.remove();
    expect(clears).to.include(61);
    expect(callbacks.size).to.equal(0);
  } finally {
    el.remove();
    ownerWindow.setTimeout = originalSetTimeout;
    ownerWindow.clearTimeout = originalClearTimeout;
    iframe.remove();
  }
});

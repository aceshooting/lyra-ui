import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import {
  ANNOUNCEMENT_SINK_ATTRIBUTE,
  Announcer,
  acquireAnnouncementSink,
  type AnnouncementPoliteness,
} from './announcer.js';

function sinkElement(politeness: AnnouncementPoliteness, doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`);
}

function sinkTexts(politeness: AnnouncementPoliteness, doc: Document = document): string[] {
  const element = sinkElement(politeness, doc);
  return element ? Array.from(element.children).map((child) => child.textContent ?? '') : [];
}

/** Real-timer throttle window used across these tests -- generous enough that
 *  normal CI scheduling jitter never flips a pass/fail outcome. */
const THROTTLE_MS = 60;

it('defaults throttleMs to 500 when not provided', () => {
  const a = new Announcer({ onFlush: () => {} });
  expect(a.throttleMs).to.equal(500);
});

it('sanitizes a non-finite throttleMs passed to the constructor to the 500ms default', () => {
  expect(new Announcer({ throttleMs: NaN, onFlush: () => {} }).throttleMs).to.equal(500);
  expect(new Announcer({ throttleMs: Infinity, onFlush: () => {} }).throttleMs).to.equal(500);
  expect(new Announcer({ throttleMs: -Infinity, onFlush: () => {} }).throttleMs).to.equal(500);
});

it('sanitizes a negative finite throttleMs passed to the constructor by clamping to 0', () => {
  expect(new Announcer({ throttleMs: -100, onFlush: () => {} }).throttleMs).to.equal(0);
});

it('sanitizes a non-finite/negative throttleMs assigned after construction the same way', () => {
  const a = new Announcer({ throttleMs: THROTTLE_MS, onFlush: () => {} });

  a.throttleMs = NaN;
  expect(a.throttleMs).to.equal(500);

  a.throttleMs = Infinity;
  expect(a.throttleMs).to.equal(500);

  a.throttleMs = -100;
  expect(a.throttleMs).to.equal(0);
});

it('flushes a single announce() call after the throttle window elapses', async () => {
  const flushes: string[] = [];
  const a = new Announcer({
    throttleMs: THROTTLE_MS,
    onFlush: (text) => flushes.push(text),
  });

  a.announce('hello');
  expect(flushes, 'must not flush synchronously').to.deep.equal([]);

  await waitUntil(() => flushes.length === 1, 'expected one flush', {
    timeout: 2000,
  });
  expect(flushes).to.deep.equal(['hello']);
});

it('collapses repeated calls within a window to only the latest text', async () => {
  const flushes: string[] = [];
  const a = new Announcer({
    throttleMs: THROTTLE_MS,
    onFlush: (text) => flushes.push(text),
  });

  a.announce('a');
  a.announce('b');
  a.announce('c');

  await waitUntil(() => flushes.length === 1, 'expected exactly one flush', {
    timeout: 2000,
  });
  expect(flushes, 'superseded text must be dropped, not queued or concatenated').to.deep.equal(['c']);
});

it('anchors the flush deadline to the first call in a burst, not later calls', async () => {
  const flushes: string[] = [];
  let flushElapsed: number | undefined;
  const start = performance.now();
  const a = new Announcer({
    throttleMs: THROTTLE_MS,
    onFlush: (text) => {
      flushElapsed ??= performance.now() - start;
      flushes.push(text);
    },
  });

  a.announce('a');
  await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS / 2));
  a.announce('b'); // still inside the first call's window

  await waitUntil(() => flushes.length === 1, 'expected exactly one flush', {
    timeout: 2000,
  });

  // Timestamp is captured inside onFlush itself, not after waitUntil
  // resolves -- waitUntil's own poll `interval` (50ms by default) can add
  // slack on top of the real flush time, which previously made this
  // assertion measure polling granularity instead of the timer's actual
  // deadline. A (wrong) sliding-window reset would push the deadline out to
  // ~1.5x THROTTLE_MS from `start`; trailing-edge-from-first-call lands
  // close to 1x. Assert well below the reset case's deadline.
  expect(flushElapsed).to.be.below(THROTTLE_MS * 1.4);
  expect(flushes).to.deep.equal(['b']);
});

it('force: true flushes immediately, synchronously, regardless of any pending window', () => {
  const flushes: string[] = [];
  const a = new Announcer({
    throttleMs: 5000,
    onFlush: (text) => flushes.push(text),
  });

  a.announce('queued');
  a.announce('final', { force: true });

  expect(flushes, 'force must not wait for the 5s window').to.deep.equal(['final']);
});

it('force: true with nothing already pending still flushes its own text', () => {
  const flushes: string[] = [];
  const a = new Announcer({
    throttleMs: 5000,
    onFlush: (text) => flushes.push(text),
  });

  a.announce('only', { force: true });

  expect(flushes).to.deep.equal(['only']);
});

it('a forced flush cancels the scheduled trailing-edge flush so it never double-fires', async () => {
  const flushes: string[] = [];
  const a = new Announcer({
    throttleMs: THROTTLE_MS,
    onFlush: (text) => flushes.push(text),
  });

  a.announce('a');
  a.announce('b', { force: true });

  // Wait well past the original window; if the timer weren't cancelled,
  // a second (stale) flush of 'a' would land here.
  await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS * 2));
  expect(flushes).to.deep.equal(['b']);
});

it('cancel() drops a pending announcement without flushing it', async () => {
  const flushes: string[] = [];
  const a = new Announcer({
    throttleMs: THROTTLE_MS,
    onFlush: (text) => flushes.push(text),
  });

  a.announce('a');
  a.cancel();

  await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS * 2));
  expect(flushes).to.deep.equal([]);
});

it('cancel() is a no-op when nothing is pending', () => {
  const a = new Announcer({ throttleMs: THROTTLE_MS, onFlush: () => {} });
  expect(() => a.cancel()).to.not.throw();
});

it('exposes isPending/pendingText while a burst is in progress, and clears them after flush', async () => {
  const a = new Announcer({ throttleMs: THROTTLE_MS, onFlush: () => {} });

  expect(a.isPending).to.be.false;
  expect(a.pendingText).to.be.undefined;

  a.announce('a');
  expect(a.isPending).to.be.true;
  expect(a.pendingText).to.equal('a');

  await waitUntil(() => !a.isPending, 'expected the burst to flush', {
    timeout: 2000,
  });
  expect(a.pendingText).to.be.undefined;
});

it('separate, non-overlapping bursts each flush independently', async () => {
  const flushes: string[] = [];
  const a = new Announcer({
    throttleMs: THROTTLE_MS,
    onFlush: (text) => flushes.push(text),
  });

  a.announce('a');
  await waitUntil(() => flushes.length === 1, 'expected the first burst to flush', {
    timeout: 2000,
  });

  a.announce('b');
  await waitUntil(() => flushes.length === 2, 'expected the second burst to flush', {
    timeout: 2000,
  });

  expect(flushes).to.deep.equal(['a', 'b']);
});

it('changing throttleMs between bursts affects the next burst, not one already scheduled', async () => {
  const flushes: string[] = [];
  const a = new Announcer({
    throttleMs: THROTTLE_MS,
    onFlush: (text) => flushes.push(text),
  });

  a.announce('a');
  a.throttleMs = 5; // must not retroactively reschedule the in-flight timer
  await new Promise((resolve) => setTimeout(resolve, 15));
  expect(flushes, 'the in-flight burst should still be waiting out its original window').to.deep.equal([]);

  await waitUntil(() => flushes.length === 1, 'expected the first burst to flush eventually', {
    timeout: 2000,
  });
  expect(flushes).to.deep.equal(['a']);
});

it('uses an injected timer host and rebinds a pending burst without retaining the old host', () => {
  const firstCallbacks = new Map<number, () => void>();
  const secondCallbacks = new Map<number, () => void>();
  const firstClears: number[] = [];
  const makeTimerHost = (callbacks: Map<number, () => void>, clears: number[], handle: number) => ({
    setTimeout(callback: () => void): number {
      callbacks.set(handle, callback);
      return handle;
    },
    clearTimeout(timer: number): void {
      clears.push(timer);
      callbacks.delete(timer);
    },
  });
  const first = makeTimerHost(firstCallbacks, firstClears, 41);
  const secondClears: number[] = [];
  const second = makeTimerHost(secondCallbacks, secondClears, 73);
  const flushes: string[] = [];
  const announcer = new Announcer({
    throttleMs: 500,
    timerHost: first,
    onFlush: (text) => flushes.push(text),
  });

  announcer.announce('adopt me');
  expect(firstCallbacks.has(41)).to.be.true;
  announcer.setTimerHost(second);
  expect(firstClears).to.deep.equal([41]);
  expect(firstCallbacks.size).to.equal(0);
  expect(secondCallbacks.has(73)).to.be.true;

  secondCallbacks.get(73)!();
  expect(flushes).to.deep.equal(['adopt me']);
  expect(secondClears).to.deep.equal([73]);
});

it('creates the announcement sink in the document light DOM, not in any shadow root', () => {
  const sink = acquireAnnouncementSink('polite');
  try {
    const element = sinkElement('polite');
    // Node identity is compared as a boolean on purpose: a failing chai assertion carrying a DOM
    // node as actual/expected hangs the whole test file.
    expect(element === sink.element, 'the sink must be a light-DOM element').to.be.true;
    expect(element!.parentElement === document.body, 'the sink must hang off document.body').to.be.true;
    expect(element!.getRootNode() === document, 'the sink must not live inside a shadow root').to.be.true;
    expect(element!.getAttribute('role')).to.equal('status');
    expect(element!.getAttribute('aria-live')).to.equal('polite');
    expect(element!.getAttribute('aria-relevant')).to.equal('additions');
    expect(element!.getAttribute('aria-atomic')).to.equal('false');
  } finally {
    sink.release();
  }
});

it('renders the sink visually hidden but present in the accessibility tree', () => {
  const sink = acquireAnnouncementSink('polite');
  try {
    sink.announce('measurable');
    const rect = sink.element.getBoundingClientRect();
    expect(rect.width).to.be.at.most(1);
    expect(rect.height).to.be.at.most(1);
    expect(getComputedStyle(sink.element).position).to.equal('absolute');
  } finally {
    sink.release();
  }
});

it('clips the sink with clip-path, not the deprecated clip shorthand', () => {
  const sink = acquireAnnouncementSink('polite');
  try {
    expect(getComputedStyle(sink.element).clipPath).to.equal('inset(50%)');
    expect(
      (sink.element.getAttribute('style') ?? '').includes('clip:'),
      'the deprecated `clip` declaration must be gone, not merely supplemented',
    ).to.equal(false);
  } finally {
    sink.release();
  }
});

it('announces by appending a child node rather than rewriting one text node', () => {
  const sink = acquireAnnouncementSink('polite');
  try {
    sink.announce('first');
    sink.announce('second');
    expect(sinkTexts('polite')).to.deep.equal(['first', 'second']);
  } finally {
    sink.release();
  }
});

it('announces an identical repeat again instead of silently rewriting the same string', () => {
  const sink = acquireAnnouncementSink('polite');
  try {
    sink.announce('same');
    sink.announce('same');
    expect(sinkTexts('polite'), 'a repeat must be a second addition, so assistive tech reads it twice').to.deep.equal([
      'same',
      'same',
    ]);
  } finally {
    sink.release();
  }
});

it('gates writes on an optional source element accessibility visibility', async () => {
  const ancestor = await fixture<HTMLElement>(html`<div><span>Source</span></div>`);
  const source = ancestor.querySelector('span')!;
  const sink = acquireAnnouncementSink('polite', { source });
  try {
    source.hidden = true;
    sink.announce('hidden source');
    source.hidden = false;

    ancestor.setAttribute('aria-hidden', ' TRUE ');
    sink.announce('hidden ancestor');
    ancestor.removeAttribute('aria-hidden');

    ancestor.style.display = 'none';
    sink.announce('css-hidden ancestor');
    ancestor.style.removeProperty('display');
    expect(sinkTexts('polite'), 'excluded source states never reach the document sink').to.deep.equal([]);

    sink.announce('visible source');
    expect(sinkTexts('polite')).to.deep.equal(['visible source']);
  } finally {
    sink.release();
  }
});

it('silences an ownerless source but announces for the same source in an attached iframe', async () => {
  const ownerlessDocument = document.implementation.createHTMLDocument('ownerless source');
  const ownerlessSource = ownerlessDocument.createElement('div');
  ownerlessDocument.body.append(ownerlessSource);
  const ownerlessSink = acquireAnnouncementSink('polite', {
    document: ownerlessDocument,
    source: ownerlessSource,
  });

  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = iframe.contentDocument!;
  const frameSource = frameDocument.createElement('div');
  frameDocument.body.append(frameSource);
  const frameSink = acquireAnnouncementSink('polite', {
    document: frameDocument,
    source: frameSource,
  });

  try {
    ownerlessSink.announce('ownerless source');
    frameSink.announce('rendered source');

    expect(sinkTexts('polite', ownerlessDocument)).to.deep.equal([]);
    expect(sinkTexts('polite', frameDocument)).to.deep.equal(['rendered source']);
  } finally {
    ownerlessSink.release();
    frameSink.release();
    ownerlessSource.remove();
    frameSource.remove();
    iframe.remove();
  }
});

it('fails closed when a source is adopted away from the acquired sink document', async () => {
  const source = await fixture<HTMLElement>(html`<div>Source</div>`);
  const sink = acquireAnnouncementSink('polite', { source });
  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  try {
    iframe.contentDocument!.body.append(iframe.contentDocument!.adoptNode(source));
    sink.announce('wrong document');
    expect(sinkTexts('polite')).to.deep.equal([]);
    expect(sinkTexts('polite', iframe.contentDocument!)).to.deep.equal([]);
  } finally {
    sink.release();
    source.remove();
    iframe.remove();
  }
});

it('removes an announced node once its ttl elapses so stale text is never re-read', async () => {
  const sink = acquireAnnouncementSink('polite', { messageTtlMs: 40 });
  try {
    sink.announce('transient');
    expect(sinkTexts('polite')).to.deep.equal(['transient']);
    await waitUntil(() => sinkTexts('polite').length === 0, 'expected the node to be swept', {
      timeout: 2000,
    });
  } finally {
    sink.release();
  }
});

it('bounds a hostile single-handle burst to the latest pending announcements', () => {
  const sink = acquireAnnouncementSink('polite', { messageTtlMs: 5000 });
  try {
    for (let index = 0; index < 50_000; index += 1) {
      sink.announce(`message ${index}`);
    }

    const texts = sinkTexts('polite');
    expect(texts.length).to.equal(32);
    expect(texts[0]).to.equal('message 49968');
    expect(texts.at(-1)).to.equal('message 49999');
  } finally {
    sink.release();
  }
});

it('bounds the shared sink and batches every handle onto one pending sweep timer', async () => {
  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const ownerDocument = iframe.contentDocument!;
  const ownerWindow = iframe.contentWindow!;
  const originalSetTimeout = ownerWindow.setTimeout;
  const originalClearTimeout = ownerWindow.clearTimeout;
  const callbacks = new Map<number, () => void>();
  let nextHandle = 400;
  ownerWindow.setTimeout = ((handler: TimerHandler) => {
    const handle = ++nextHandle;
    if (typeof handler === 'function') callbacks.set(handle, handler);
    return handle;
  }) as typeof ownerWindow.setTimeout;
  ownerWindow.clearTimeout = ((handle?: number) => {
    if (handle !== undefined) callbacks.delete(handle);
  }) as typeof ownerWindow.clearTimeout;

  const sinks = Array.from({ length: 5 }, () =>
    acquireAnnouncementSink('polite', {
      document: ownerDocument,
      messageTtlMs: 5000,
    }),
  );
  try {
    for (const [owner, sink] of sinks.entries()) {
      for (let index = 0; index < 32; index += 1) {
        sink.announce(`owner ${owner} message ${index}`);
      }
    }

    expect(sinkTexts('polite', ownerDocument).length).to.equal(128);
    expect(callbacks.size, 'one shared timer sweeps every pending node').to.equal(1);
    expect(sinkTexts('polite', ownerDocument).at(-1)).to.equal('owner 4 message 31');
  } finally {
    for (const sink of sinks) sink.release();
    ownerWindow.setTimeout = originalSetTimeout;
    ownerWindow.clearTimeout = originalClearTimeout;
    iframe.remove();
  }
});

it('shares one sink per politeness and ref-counts it away when the last consumer releases', () => {
  const first = acquireAnnouncementSink('polite');
  const second = acquireAnnouncementSink('polite');
  expect(second.element === first.element, 'both consumers must share one region').to.be.true;

  first.release();
  expect(sinkElement('polite') !== null, 'a still-held sink must stay mounted').to.be.true;

  second.release();
  expect(sinkElement('polite') === null, 'the last release must unmount the sink').to.be.true;
});

it('remounts an externally detached shared sink for held and newly acquired handles', () => {
  const first = acquireAnnouncementSink('polite');
  let second: ReturnType<typeof acquireAnnouncementSink> | undefined;
  try {
    first.element.remove();
    expect(sinkElement('polite') === null).to.be.true;

    first.announce('from held handle');
    expect(first.element.parentElement === document.body).to.be.true;
    expect(sinkTexts('polite')).to.deep.equal(['from held handle']);

    first.element.remove();
    second = acquireAnnouncementSink('polite');
    expect(second.element === first.element, 'reacquisition remounts the same shared record').to.be.true;
    expect(second.element.parentElement === document.body).to.be.true;
    second.announce('after reacquire');
    expect(sinkTexts('polite')).to.deep.equal(['from held handle', 'after reacquire']);
  } finally {
    second?.release();
    first.release();
  }
});

it('release() is idempotent and never over-decrements the shared ref count', () => {
  const first = acquireAnnouncementSink('polite');
  const second = acquireAnnouncementSink('polite');
  first.release();
  first.release();
  expect(sinkElement('polite') !== null, 'a double release must not unmount a held sink').to.be.true;
  second.release();
  expect(sinkElement('polite') === null).to.be.true;
});

it('release() drops the releasing consumer own pending nodes and their sweep timers', async () => {
  const first = acquireAnnouncementSink('polite', { messageTtlMs: 5000 });
  const second = acquireAnnouncementSink('polite', { messageTtlMs: 5000 });
  try {
    first.announce('from first');
    second.announce('from second');
    expect(sinkTexts('polite')).to.deep.equal(['from first', 'from second']);

    first.release();
    expect(sinkTexts('polite'), 'only the releasing consumer nodes go').to.deep.equal(['from second']);
    first.announce('after release');
    expect(sinkTexts('polite'), 'a released sink must not announce again').to.deep.equal(['from second']);
  } finally {
    second.release();
  }
});

it('keeps polite and assertive sinks separate', () => {
  const polite = acquireAnnouncementSink('polite');
  const assertive = acquireAnnouncementSink('assertive');
  try {
    polite.announce('calm');
    assertive.announce('urgent');
    expect(sinkTexts('polite')).to.deep.equal(['calm']);
    expect(sinkTexts('assertive')).to.deep.equal(['urgent']);
    expect(assertive.element.getAttribute('role')).to.equal('alert');
    expect(assertive.element.getAttribute('aria-live')).to.equal('assertive');
  } finally {
    polite.release();
    assertive.release();
  }
});

it('keys the sink by document so an adopted consumer announces in its own document', async () => {
  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const ownerDocument = iframe.contentDocument!;
  const sink = acquireAnnouncementSink('polite', { document: ownerDocument });
  try {
    sink.announce('inside the frame');
    expect(sinkTexts('polite', ownerDocument)).to.deep.equal(['inside the frame']);
    expect(sinkElement('polite') === null, 'the host document must be untouched').to.be.true;
  } finally {
    sink.release();
    expect(sinkElement('polite', ownerDocument) === null).to.be.true;
  }
});

it('schedules and cancels message sweeps with the sink document timer realm', async () => {
  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const ownerDocument = iframe.contentDocument!;
  const ownerWindow = iframe.contentWindow!;
  const originalSetTimeout = ownerWindow.setTimeout;
  const originalClearTimeout = ownerWindow.clearTimeout;
  const callbacks = new Map<number, () => void>();
  const clears: number[] = [];
  let nextHandle = 90;
  ownerWindow.setTimeout = ((handler: TimerHandler) => {
    const handle = ++nextHandle;
    if (typeof handler === 'function') callbacks.set(handle, handler);
    return handle;
  }) as typeof ownerWindow.setTimeout;
  ownerWindow.clearTimeout = ((handle?: number) => {
    if (handle !== undefined) {
      clears.push(handle);
      callbacks.delete(handle);
    }
  }) as typeof ownerWindow.clearTimeout;

  let sink: ReturnType<typeof acquireAnnouncementSink> | undefined;
  try {
    sink = acquireAnnouncementSink('polite', {
      document: ownerDocument,
      messageTtlMs: 500,
    });
    sink.announce('sweep in frame');
    expect(callbacks.has(91), 'the frame window scheduled the sweep').to.be.true;
    const sweep = callbacks.get(91)!;
    callbacks.delete(91); // a real timer queue drops a fired callback before invoking it
    sweep();
    expect(sinkTexts('polite', ownerDocument)).to.deep.equal([]);

    sink.announce('cancel in frame');
    expect(callbacks.has(92)).to.be.true;
    sink.release();
    sink = undefined;
    expect(clears).to.include(92);
    expect(callbacks.size).to.equal(0);
  } finally {
    sink?.release();
    ownerWindow.setTimeout = originalSetTimeout;
    ownerWindow.clearTimeout = originalClearTimeout;
  }
});

it('reschedules a shared sweep when a newly announced message expires sooner', async () => {
  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const ownerDocument = iframe.contentDocument!;
  const ownerWindow = iframe.contentWindow!;
  const originalSetTimeout = ownerWindow.setTimeout;
  const originalClearTimeout = ownerWindow.clearTimeout;
  const callbacks = new Map<number, () => void>();
  const clears: number[] = [];
  let nextHandle = 200;
  ownerWindow.setTimeout = ((handler: TimerHandler) => {
    const handle = ++nextHandle;
    if (typeof handler === 'function') callbacks.set(handle, handler);
    return handle;
  }) as typeof ownerWindow.setTimeout;
  ownerWindow.clearTimeout = ((handle?: number) => {
    if (handle !== undefined) {
      clears.push(handle);
      callbacks.delete(handle);
    }
  }) as typeof ownerWindow.clearTimeout;

  let sink: ReturnType<typeof acquireAnnouncementSink> | undefined;
  try {
    sink = acquireAnnouncementSink('polite', {
      document: ownerDocument,
      messageTtlMs: 5_000,
    });
    sink.announce('later');
    expect(callbacks.has(201)).to.be.true;

    sink.messageTtlMs = 100;
    sink.announce('sooner');

    expect(clears).to.deep.equal([201]);
    expect(callbacks.has(202)).to.be.true;
  } finally {
    sink?.release();
    ownerWindow.setTimeout = originalSetTimeout;
    ownerWindow.clearTimeout = originalClearTimeout;
    iframe.remove();
  }
});

it('ignores an empty announcement instead of appending a silent node', () => {
  const sink = acquireAnnouncementSink('polite');
  try {
    sink.announce('');
    expect(sinkTexts('polite')).to.deep.equal([]);
  } finally {
    sink.release();
  }
});

it('falls back to the default ttl for a NaN/negative messageTtlMs instead of sweeping instantly', async () => {
  const sink = acquireAnnouncementSink('polite', { messageTtlMs: NaN });
  try {
    sink.announce('sticky');
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(sinkTexts('polite'), 'a NaN ttl must not clamp to a ~0ms sweep').to.deep.equal(['sticky']);
  } finally {
    sink.release();
  }
});

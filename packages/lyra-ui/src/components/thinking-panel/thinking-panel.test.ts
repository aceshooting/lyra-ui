import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './thinking-panel.js';
import type { LyraThinkingPanel } from './thinking-panel.js';

// MutationObserver callbacks are microtasks and the resulting auto-scroll is
// coalesced to a single requestAnimationFrame (see thinking-panel.ts's
// onContentMutated) -- two nested frames reliably lands after that rAF has
// run, the same wait idiom lyra-virtual-list's own tests already use for an
// identical rAF-coalesced recompute.
async function twoFrames(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

it('defaults to label="Thinking", expanded=false, mode="live", no duration', async () => {
  const el = (await fixture(html`<lyra-thinking-panel></lyra-thinking-panel>`)) as LyraThinkingPanel;
  expect(el.label).to.equal('Thinking');
  expect(el.expanded).to.be.false;
  expect(el.hasAttribute('expanded')).to.be.false;
  expect(el.mode).to.equal('live');
  expect(el.getAttribute('mode')).to.equal('live');
  expect(el.durationMs).to.be.undefined;
});

it('renders the label text in [part="label"]', async () => {
  const el = (await fixture(
    html`<lyra-thinking-panel label="Reasoning"></lyra-thinking-panel>`,
  )) as LyraThinkingPanel;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Reasoning');
});

it('links the header to the body region it controls via a collision-safe aria-controls', async () => {
  const a = (await fixture(html`<lyra-thinking-panel></lyra-thinking-panel>`)) as LyraThinkingPanel;
  const b = (await fixture(html`<lyra-thinking-panel></lyra-thinking-panel>`)) as LyraThinkingPanel;
  const headerA = a.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;
  const bodyA = a.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  const headerB = b.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;
  const bodyB = b.shadowRoot!.querySelector('[part="body"]') as HTMLElement;

  expect(headerA.getAttribute('aria-controls')).to.equal(bodyA.id);
  expect(headerB.getAttribute('aria-controls')).to.equal(bodyB.id);
  expect(bodyA.id).to.not.equal('');
  expect(bodyA.id, 'ids must not collide across instances').to.not.equal(bodyB.id);
});

it('hides [part="body"] from the accessibility tree while collapsed, shows it while expanded', async () => {
  const el = (await fixture(html`<lyra-thinking-panel>content</lyra-thinking-panel>`)) as LyraThinkingPanel;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(body.hidden).to.be.true;

  el.expanded = true;
  await el.updateComplete;
  expect(body.hidden).to.be.false;
});

it('toggles expanded and fires lyra-toggle on header click', async () => {
  const el = (await fixture(html`<lyra-thinking-panel></lyra-thinking-panel>`)) as LyraThinkingPanel;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;

  let firing = oneEvent(el, 'lyra-toggle');
  header.click();
  let event = await firing;
  await el.updateComplete;
  expect(el.expanded).to.be.true;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: true });
  expect(header.getAttribute('aria-expanded')).to.equal('true');

  firing = oneEvent(el, 'lyra-toggle');
  header.click();
  event = await firing;
  await el.updateComplete;
  expect(el.expanded).to.be.false;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: false });
  expect(header.getAttribute('aria-expanded')).to.equal('false');
});

describe('duration display', () => {
  it('shows a pulsing "Thinking…" placeholder in live mode while duration-ms is unset', async () => {
    const el = (await fixture(html`<lyra-thinking-panel mode="live"></lyra-thinking-panel>`)) as LyraThinkingPanel;
    const duration = el.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect(duration).to.exist;
    expect(duration.textContent!.trim()).to.equal('Thinking…');
    expect(duration.hasAttribute('data-pending')).to.be.true;
  });

  it('shows nothing in post-hoc mode while duration-ms is unset', async () => {
    const el = (await fixture(
      html`<lyra-thinking-panel mode="post-hoc"></lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    expect(el.shadowRoot!.querySelector('[part="duration"]')).to.not.exist;
  });

  it('shows "Thought for …" once duration-ms is set, in either mode, and clears the pending flag', async () => {
    const live = (await fixture(
      html`<lyra-thinking-panel mode="live" duration-ms="4200"></lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    const liveDuration = live.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect(liveDuration.textContent!.trim()).to.equal('Thought for 4.2s');
    expect(liveDuration.hasAttribute('data-pending')).to.be.false;

    const postHoc = (await fixture(
      html`<lyra-thinking-panel mode="post-hoc" duration-ms="820"></lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    const postHocDuration = postHoc.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect(postHocDuration.textContent!.trim()).to.equal('Thought for 820ms');
  });

  it('treats a NaN duration-ms like unset (pending placeholder in live mode, nothing in post-hoc), and clamps a negative one to 0', async () => {
    const liveNan = (await fixture(
      html`<lyra-thinking-panel mode="live"></lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    liveNan.durationMs = Number.NaN;
    await liveNan.updateComplete;
    const liveDuration = liveNan.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect(liveDuration.textContent!.trim()).to.equal('Thinking…');

    const postHocNan = (await fixture(
      html`<lyra-thinking-panel mode="post-hoc"></lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    postHocNan.durationMs = Number.NaN;
    await postHocNan.updateComplete;
    expect(postHocNan.shadowRoot!.querySelector('[part="duration"]')).to.not.exist;

    const negative = (await fixture(
      html`<lyra-thinking-panel mode="post-hoc"></lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    negative.durationMs = -50;
    await negative.updateComplete;
    expect(negative.shadowRoot!.querySelector('[part="duration"]')!.textContent!.trim()).to.equal('Thought for 0ms');
  });

  it('localizes the "Thinking…" pending placeholder via this.localize() when .strings overrides thinking', async () => {
    const el = (await fixture(
      html`<lyra-thinking-panel mode="live" .strings=${{ thinking: 'Réflexion…' }}></lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    const duration = el.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect(duration.textContent!.trim()).to.equal('Réflexion…');
  });

  it('localizes the "Thought for …" text via this.localize() when .strings overrides thoughtFor', async () => {
    const el = (await fixture(
      html`<lyra-thinking-panel
        duration-ms="4200"
        .strings=${{ thoughtFor: 'Réfléchi pendant {duration}' }}
      ></lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    const duration = el.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect(duration.textContent!.trim()).to.equal('Réfléchi pendant 4.2s');
  });
});

describe('label localization', () => {
  it('localizes the default "Thinking" label via this.localize() when .strings overrides thinkingPanelLabel', async () => {
    const el = (await fixture(
      html`<lyra-thinking-panel .strings=${{ thinkingPanelLabel: 'Raisonnement' }}></lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Raisonnement');
    expect(el.shadowRoot!.querySelector('[part="body"]')!.getAttribute('aria-label')).to.equal('Raisonnement');
  });
});

describe('live-mode auto-scroll', () => {
  // Forces a tiny scrollable body so a handful of appended lines is enough
  // to produce real overflow, without depending on any specific viewport
  // size the test runner happens to use.
  async function forceSmallBody(el: LyraThinkingPanel): Promise<HTMLElement> {
    el.style.setProperty('--lyra-thinking-panel-max-block-size', '48px');
    el.expanded = true;
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  }

  const longText = 'Line of already-streamed reasoning content that wraps across more than one row. '.repeat(20);

  it('auto-scrolls to the new bottom when content is appended while anchored at the bottom', async () => {
    const el = (await fixture(html`<lyra-thinking-panel mode="live"></lyra-thinking-panel>`)) as LyraThinkingPanel;
    const body = await forceSmallBody(el);
    expect(body.scrollTop).to.equal(0);

    for (let i = 0; i < 20; i++) {
      el.appendChild(document.createTextNode(`Line ${i} of streamed reasoning content. `));
    }
    await twoFrames();

    expect(body.scrollTop, 'should have followed the new content to the bottom').to.be.greaterThan(0);
    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
  });

  it('does not force-scroll when the reader has scrolled away from the bottom', async () => {
    const el = (await fixture(
      html`<lyra-thinking-panel mode="live">${longText}</lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    const body = await forceSmallBody(el);
    // forceSmallBody() expanded a live panel with existing content, which
    // jumps it to the bottom first -- confirm that, then simulate the
    // reader manually scrolling back up to read earlier content.
    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);

    body.scrollTop = 0;
    body.dispatchEvent(new Event('scroll'));
    const scrollTopBefore = body.scrollTop;
    expect(scrollTopBefore).to.equal(0);

    el.appendChild(document.createTextNode('A brand new chunk that arrives while scrolled up. '));
    await twoFrames();

    expect(body.scrollTop, 'must not have been yanked back down to the bottom').to.equal(scrollTopBefore);
  });

  it('never auto-scrolls in post-hoc mode, even while expanded and anchored at the bottom', async () => {
    const el = (await fixture(
      html`<lyra-thinking-panel mode="post-hoc">${longText}</lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    const body = await forceSmallBody(el);
    // post-hoc never auto-jumps on expand either -- starts at the top, like
    // reading any other finished document.
    expect(body.scrollTop).to.equal(0);

    el.appendChild(document.createTextNode('Some appended content in post-hoc mode. '));
    await twoFrames();

    expect(body.scrollTop).to.equal(0);
  });

  it('jumps to the bottom on opening an already-populated live panel', async () => {
    const el = (await fixture(
      html`<lyra-thinking-panel mode="live">${longText}</lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    const body = await forceSmallBody(el);

    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
  });

  it('jumps to the bottom when an already-expanded panel\'s mode transitions to live', async () => {
    const el = (await fixture(
      html`<lyra-thinking-panel mode="post-hoc">${longText}</lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    const body = await forceSmallBody(el);
    // post-hoc never auto-jumps on expand -- starts at the top.
    expect(body.scrollTop).to.equal(0);

    // Reader scrolls partway down while reviewing the finished transcript.
    body.scrollTop = 10;
    body.dispatchEvent(new Event('scroll'));

    el.mode = 'live';
    await el.updateComplete;

    expect(
      body.scrollHeight - body.scrollTop - body.clientHeight,
      'mode transitioning to live while already expanded should reset to anchored and jump to the bottom',
    ).to.be.lessThan(2);
  });

  it('keeps following new content after a mode transition to live, even if a prior expand-while-live no-op left `expanded` unchanged', async () => {
    // Mirrors LiveStreamingDemo's second run: `expanded` is set to `true`
    // again (a no-op -- already true, so Lit's `changed` map never contains
    // 'expanded') alongside a real `mode` transition to 'live'. Only the mode
    // transition should be needed to reset stickToBottom and start following.
    const el = (await fixture(
      html`<lyra-thinking-panel mode="post-hoc" expanded>${longText}</lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    const body = await forceSmallBody(el);
    body.scrollTop = 10;
    body.dispatchEvent(new Event('scroll'));

    el.expanded = true; // no-op, already true
    el.mode = 'live'; // real transition
    await el.updateComplete;

    el.appendChild(document.createTextNode('New reasoning content appended right after the mode flip. '));
    await twoFrames();

    expect(
      body.scrollHeight - body.scrollTop - body.clientHeight,
      'should still be following after the mode transition even though `expanded` itself did not change',
    ).to.be.lessThan(2);
  });

  it('re-checks the auto-scroll guard inside the coalesced rAF callback, so a scroll-away between scheduling and firing is respected', async () => {
    const el = (await fixture(html`<lyra-thinking-panel mode="live"></lyra-thinking-panel>`)) as LyraThinkingPanel;
    const body = await forceSmallBody(el);

    for (let i = 0; i < 20; i++) {
      el.appendChild(document.createTextNode(`Line ${i} of streamed reasoning content. `));
    }
    await twoFrames();
    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);

    // Intercept (but do not run) the next requestAnimationFrame callback so
    // the test can fully control the ordering between the mutation being
    // observed and the coalesced frame actually firing.
    const originalRaf = window.requestAnimationFrame;
    let capturedCallback: FrameRequestCallback | undefined;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      capturedCallback = cb;
      return 1;
    }) as typeof window.requestAnimationFrame;

    try {
      el.appendChild(document.createTextNode('A fresh chunk that schedules a coalesced rAF. '));
      // MutationObserver callbacks run as a microtask; flushing a couple of
      // microtask turns is enough for onContentMutated to have run and
      // scheduled (captured) the frame, without invoking it yet.
      await Promise.resolve();
      await Promise.resolve();
      expect(capturedCallback, 'the mutation should have scheduled exactly one rAF callback').to.exist;

      // The reader scrolls away in the window between scheduling and firing.
      body.scrollTop = 0;
      body.dispatchEvent(new Event('scroll'));
      expect(body.scrollTop).to.equal(0);
    } finally {
      window.requestAnimationFrame = originalRaf;
    }

    // Now let the previously-captured frame actually run.
    capturedCallback!(0);

    expect(
      body.scrollTop,
      'must not be yanked back to the bottom -- the reader scrolled away before this frame fired',
    ).to.equal(0);
  });
});

describe('body keyboard accessibility', () => {
  it('is a focusable, named group so a keyboard-only reader can scroll a long transcript', async () => {
    const el = (await fixture(
      html`<lyra-thinking-panel label="Reasoning" expanded>content</lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;

    expect(body.getAttribute('tabindex')).to.equal('0');
    expect(body.getAttribute('role')).to.equal('group');
    expect(body.getAttribute('aria-label')).to.equal('Reasoning');

    body.focus();
    expect(el.shadowRoot!.activeElement).to.equal(body);
  });
});

describe('body scroll containment', () => {
  it('sets overscroll-behavior: contain on the scrollable body', async () => {
    const el = (await fixture(html`<lyra-thinking-panel expanded></lyra-thinking-panel>`)) as LyraThinkingPanel;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(getComputedStyle(body).overscrollBehavior).to.equal('contain');
  });
});

describe('RTL', () => {
  it('mirrors the collapsed-state toggle chevron under dir="rtl"', async () => {
    const wrapper = await fixture(html`
      <div dir="rtl">
        <lyra-thinking-panel></lyra-thinking-panel>
      </div>
    `);
    const el = wrapper.querySelector('lyra-thinking-panel') as LyraThinkingPanel;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
    expect(getComputedStyle(toggle).transform).to.equal('matrix(-1, 0, 0, 1, 0, 0)');
  });

  it('does not mirror the expanded-state (already-rotated) toggle chevron under dir="rtl"', async () => {
    const wrapper = await fixture(html`
      <div dir="rtl">
        <lyra-thinking-panel expanded></lyra-thinking-panel>
      </div>
    `);
    const el = wrapper.querySelector('lyra-thinking-panel') as LyraThinkingPanel;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
    // rotate(90deg): cos(90)=0, sin(90)=1 -> matrix(0, 1, -1, 0, 0, 0)
    expect(getComputedStyle(toggle).transform).to.equal('matrix(0, 1, -1, 0, 0, 0)');
  });
});

describe('motion', () => {
  it('uses the ambient (slow, breathing) transition token for the pending-duration pulse dot, not the fast discrete-transition token', async () => {
    const el = (await fixture(
      html`<lyra-thinking-panel mode="live" expanded></lyra-thinking-panel>`,
    )) as LyraThinkingPanel;
    const dot = el.shadowRoot!.querySelector('.pending-dot') as HTMLElement;
    expect(dot).to.exist;
    expect(getComputedStyle(dot).animationDuration).to.equal('1.8s');
  });
});

it('is accessible with no content and collapsed', async () => {
  const el = (await fixture(html`<lyra-thinking-panel></lyra-thinking-panel>`)) as LyraThinkingPanel;
  await expect(el).to.be.accessible();
});

it('is accessible with content, expanded, and a duration set', async () => {
  const el = (await fixture(html`
    <lyra-thinking-panel mode="post-hoc" duration-ms="4200" expanded>
      The reasoning transcript goes here, with a bit of detail about the approach taken.
    </lyra-thinking-panel>
  `)) as LyraThinkingPanel;
  await expect(el).to.be.accessible();
});

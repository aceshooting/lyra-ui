import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './thinking-panel.js';
import type { LyraThinkingPanel } from './thinking-panel.js';
import '../../conversation/streaming-text/streaming-text.js';
import '../../conversation/markdown/markdown.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { contrastRatio, effectiveBackground, resolvedColorToken } from '../../../../test/color-contrast.js';
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-thinking-panel', 'appearance');

// MutationObserver callbacks are microtasks and the resulting auto-scroll is
// coalesced to a single requestAnimationFrame (see thinking-panel.ts's
// onContentMutated) -- two nested frames reliably lands after that rAF has
// run, the same wait idiom lr-virtual-list's own tests already use for an
// identical rAF-coalesced recompute.
async function twoFrames(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

it('defaults to a localized Thinking label, expanded=false, mode="live", follow=true, no duration', async () => {
  const el = (await fixture(html`<lr-thinking-panel></lr-thinking-panel>`)) as LyraThinkingPanel;
  expect(el.label).to.be.undefined;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Thinking');
  expect(el.expanded).to.be.false;
  expect(el.hasAttribute('expanded')).to.be.false;
  expect(el.mode).to.equal('live');
  expect(el.getAttribute('mode')).to.equal('live');
  expect(el.follow).to.be.true;
  expect(el.hasAttribute('follow')).to.be.false;
  expect(el.durationMs).to.be.undefined;
});

it('renders the label text in [part="label"]', async () => {
  const el = (await fixture(
    html`<lr-thinking-panel label="Reasoning"></lr-thinking-panel>`,
  )) as LyraThinkingPanel;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Reasoning');
});

it('links the header to the body region it controls via a collision-safe aria-controls', async () => {
  const a = (await fixture(html`<lr-thinking-panel></lr-thinking-panel>`)) as LyraThinkingPanel;
  const b = (await fixture(html`<lr-thinking-panel></lr-thinking-panel>`)) as LyraThinkingPanel;
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
  const el = (await fixture(html`<lr-thinking-panel>content</lr-thinking-panel>`)) as LyraThinkingPanel;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(body.hidden).to.be.true;

  el.expanded = true;
  await el.updateComplete;
  expect(body.hidden).to.be.false;
});

it('requests a toggle before committing expanded and lr-toggle', async () => {
  const el = (await fixture(html`<lr-thinking-panel></lr-thinking-panel>`)) as LyraThinkingPanel;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;

  const order: string[] = [];
  el.addEventListener('lr-toggle-request', () => order.push('request'));
  el.addEventListener('lr-toggle', () => order.push('commit'));
  let request = oneEvent(el, 'lr-toggle-request');
  let firing = oneEvent(el, 'lr-toggle');
  header.click();
  let requested = await request;
  let event = await firing;
  await el.updateComplete;
  expect(requested.cancelable).to.be.true;
  expect((requested as CustomEvent).detail).to.deep.equal({ expanded: true });
  expect(el.expanded).to.be.true;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: true });
  expect(header.getAttribute('aria-expanded')).to.equal('true');
  expect(order).to.deep.equal(['request', 'commit']);

  request = oneEvent(el, 'lr-toggle-request');
  firing = oneEvent(el, 'lr-toggle');
  header.click();
  requested = await request;
  event = await firing;
  await el.updateComplete;
  expect((requested as CustomEvent).detail).to.deep.equal({ expanded: false });
  expect(el.expanded).to.be.false;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: false });
  expect(header.getAttribute('aria-expanded')).to.equal('false');
});

it('honors a prevented lr-toggle-request without mutating or emitting lr-toggle', async () => {
  const el = (await fixture(html`<lr-thinking-panel></lr-thinking-panel>`)) as LyraThinkingPanel;
  let commits = 0;
  el.addEventListener('lr-toggle-request', (event) => event.preventDefault());
  el.addEventListener('lr-toggle', () => commits++);

  (el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.expanded).to.be.false;
  expect(commits).to.equal(0);
});

describe('duration display', () => {
  it('shows a pulsing "Thinking…" placeholder in live mode while duration-ms is unset', async () => {
    const el = (await fixture(html`<lr-thinking-panel mode="live"></lr-thinking-panel>`)) as LyraThinkingPanel;
    const duration = el.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect((duration) != null).to.equal(true);
    expect(duration.textContent!.trim()).to.equal('Thinking…');
    expect(duration.hasAttribute('data-pending')).to.be.true;
  });

  it('shows nothing in post-hoc mode while duration-ms is unset', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel mode="post-hoc"></lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    expect((el.shadowRoot!.querySelector('[part="duration"]')) == null).to.be.true;
  });

  it('shows "Thought for …" once duration-ms is set, in either mode, and clears the pending flag', async () => {
    const live = (await fixture(
      html`<lr-thinking-panel mode="live" duration-ms="4200"></lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const liveDuration = live.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect(liveDuration.textContent!.trim()).to.equal('Thought for 4.2s');
    expect(liveDuration.hasAttribute('data-pending')).to.be.false;

    const postHoc = (await fixture(
      html`<lr-thinking-panel mode="post-hoc" duration-ms="820"></lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const postHocDuration = postHoc.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect(postHocDuration.textContent!.trim()).to.equal('Thought for 820ms');
  });

  it('formats duration numbers with the effective locale', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel lang="de-DE" mode="post-hoc" duration-ms="4200"></lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    expect(el.shadowRoot!.querySelector('[part="duration"]')!.textContent!.trim()).to.equal('Thought for 4,2s');
  });

  it('treats a NaN duration-ms like unset (pending placeholder in live mode, nothing in post-hoc), and clamps a negative one to 0', async () => {
    const liveNan = (await fixture(
      html`<lr-thinking-panel mode="live"></lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    liveNan.durationMs = Number.NaN;
    await liveNan.updateComplete;
    const liveDuration = liveNan.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect(liveDuration.textContent!.trim()).to.equal('Thinking…');

    const postHocNan = (await fixture(
      html`<lr-thinking-panel mode="post-hoc"></lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    postHocNan.durationMs = Number.NaN;
    await postHocNan.updateComplete;
    expect((postHocNan.shadowRoot!.querySelector('[part="duration"]')) == null).to.be.true;

    const negative = (await fixture(
      html`<lr-thinking-panel mode="post-hoc"></lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    negative.durationMs = -50;
    await negative.updateComplete;
    expect(negative.shadowRoot!.querySelector('[part="duration"]')!.textContent!.trim()).to.equal('Thought for 0ms');
  });

  it('localizes the "Thinking…" pending placeholder via this.localize() when .strings overrides thinking', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel mode="live" .strings=${{ thinking: 'Réflexion…' }}></lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const duration = el.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect(duration.textContent!.trim()).to.equal('Réflexion…');
  });

  it('localizes the "Thought for …" text via this.localize() when .strings overrides thoughtFor', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel
        duration-ms="4200"
        .strings=${{ thoughtFor: 'Réfléchi pendant {duration}' }}
      ></lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const duration = el.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
    expect(duration.textContent!.trim()).to.equal('Réfléchi pendant 4.2s');
  });
});

describe('label localization', () => {
  it('localizes the default "Thinking" label via this.localize() when .strings overrides thinkingPanelLabel', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel .strings=${{ thinkingPanelLabel: 'Raisonnement' }}></lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Raisonnement');
    expect(el.shadowRoot!.querySelector('[part="body"]')!.getAttribute('aria-label')).to.equal('Raisonnement');
  });

  it('keeps explicit English and empty label overrides verbatim', async () => {
    const labels: string[] = [];
    for (const template of [
      html`<lr-thinking-panel
        label="Thinking"
        .strings=${{ thinkingPanelLabel: 'Raisonnement' }}
      ></lr-thinking-panel>`,
      html`<lr-thinking-panel label="" .strings=${{ thinkingPanelLabel: 'Raisonnement' }}></lr-thinking-panel>`,
    ]) {
      const el = (await fixture(template)) as LyraThinkingPanel;
      labels.push(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim());
    }
    expect(labels).to.deep.equal(['Thinking', '']);
  });
});

describe('compact / frame escape hatches', () => {
  function chrome(el: LyraThinkingPanel): {
    base: {
      borderTopWidth: string;
      borderTopLeftRadius: string;
      backgroundColor: string;
    };
    header: { padding: string; gap: string };
    body: { padding: string; borderTopWidth: string };
  } {
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    const header = getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement);
    const body = getComputedStyle(el.shadowRoot!.querySelector('[part="body"]') as HTMLElement);
    return {
      base: {
        borderTopWidth: base.borderTopWidth,
        borderTopLeftRadius: base.borderTopLeftRadius,
        backgroundColor: base.backgroundColor,
      },
      header: { padding: header.padding, gap: header.gap },
      body: { padding: body.padding, borderTopWidth: body.borderTopWidth },
    };
  }

  it('leaves the existing regular card treatment unchanged when compact and frame are unset', async () => {
    const implicit = (await fixture(
      html`<lr-thinking-panel expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const explicit = (await fixture(
      html`<lr-thinking-panel .compact=${false} frame="card" expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;

    expect(implicit.compact).to.be.false;
    expect(implicit.frame).to.equal('card');
    expect(implicit.hasAttribute('compact')).to.be.false;
    expect(implicit.getAttribute('frame')).to.equal('card');
    expect(chrome(implicit)).to.deep.equal(chrome(explicit));
    expect(chrome(implicit).base.borderTopWidth).to.equal('1px');
    expect(chrome(implicit).base.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('reflects compact and tightens header/body dimensions through dedicated cssprops', async () => {
    const regular = (await fixture(
      html`<lr-thinking-panel expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const compact = (await fixture(
      html`<lr-thinking-panel compact expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const regularChrome = chrome(regular);
    const compactChrome = chrome(compact);

    expect(compact.compact).to.be.true;
    expect(compact.hasAttribute('compact')).to.be.true;
    expect(compactChrome.header.padding).to.not.equal(regularChrome.header.padding);
    expect(compactChrome.header.gap).to.not.equal(regularChrome.header.gap);
    expect(compactChrome.body.padding).to.not.equal(regularChrome.body.padding);
    expect(compactChrome.base.borderTopWidth).to.equal('1px');
    expect(compactChrome.base.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');

    compact.style.setProperty('--lr-thinking-panel-compact-header-padding', '1px 2px');
    compact.style.setProperty('--lr-thinking-panel-compact-header-gap', '3px');
    compact.style.setProperty('--lr-thinking-panel-compact-body-padding', '4px 5px 6px');
    const retuned = chrome(compact);
    expect(retuned.header.padding).to.equal('1px 2px');
    expect(retuned.header.gap).to.equal('3px');
    expect(retuned.body.padding).to.equal('4px 5px 6px');
  });

  it('reduces compact header typography through its dedicated retunable cssprop', async () => {
    const regular = (await fixture(
      html`<lr-thinking-panel expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const compact = (await fixture(
      html`<lr-thinking-panel compact expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const regularHeader = regular.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const compactHeader = compact.shadowRoot!.querySelector('[part="header"]') as HTMLElement;

    expect(Number.parseFloat(getComputedStyle(compactHeader).fontSize)).to.be.lessThan(
      Number.parseFloat(getComputedStyle(regularHeader).fontSize),
    );

    compact.style.setProperty('--lr-thinking-panel-compact-header-font-size', '11px');
    expect(getComputedStyle(compactHeader).fontSize).to.equal('11px');
  });

  it('also reduces compact body typography through its own dedicated retunable cssprop', async () => {
    const regular = (await fixture(
      html`<lr-thinking-panel expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const compact = (await fixture(
      html`<lr-thinking-panel compact expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const regularBody = regular.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const compactBody = compact.shadowRoot!.querySelector('[part="body"]') as HTMLElement;

    expect(Number.parseFloat(getComputedStyle(compactBody).fontSize)).to.be.lessThan(
      Number.parseFloat(getComputedStyle(regularBody).fontSize),
    );

    compact.style.setProperty('--lr-thinking-panel-compact-body-font-size', '11px');
    expect(getComputedStyle(compactBody).fontSize).to.equal('11px');
  });

  it('drops only the outer chrome under frame="plain", retaining the collapse divider and density', async () => {
    const plain = (await fixture(
      html`<lr-thinking-panel compact frame="plain" expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const plainChrome = chrome(plain);

    expect(plain.frame).to.equal('plain');
    expect(plain.getAttribute('frame')).to.equal('plain');
    expect(plainChrome.base.borderTopWidth).to.equal('0px');
    expect(plainChrome.base.borderTopLeftRadius).to.equal('0px');
    expect(plainChrome.base.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(plainChrome.body.borderTopWidth).to.equal('1px');
    expect(plainChrome.header.padding).to.equal('2px 8px');
    expect(plainChrome.body.padding).to.equal('8px');
  });

  it('re-renders the outer chrome when frame changes as a property', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    expect(chrome(el).base.borderTopWidth).to.equal('1px');

    el.frame = 'plain';
    await el.updateComplete;
    expect(el.getAttribute('frame')).to.equal('plain');
    expect(chrome(el).base.borderTopWidth).to.equal('0px');

    el.frame = 'card';
    await el.updateComplete;
    expect(chrome(el).base.borderTopWidth).to.equal('1px');
  });

  it('does not treat the fill-oriented appearance attribute as a frame alias', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel appearance="plain" expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    expect(el.frame).to.equal('card');
    expect(chrome(el).base.borderTopWidth).to.equal('1px');
  });

  it('is accessible with populated compact plain chrome', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel compact frame="plain" expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    await expect(el).to.be.accessible();
  });
});

describe('live-mode auto-scroll', () => {
  // Forces a tiny scrollable body so a handful of appended lines is enough
  // to produce real overflow, without depending on any specific viewport
  // size the test runner happens to use.
  async function forceSmallBody(el: LyraThinkingPanel): Promise<HTMLElement> {
    el.style.setProperty('--lr-thinking-panel-max-block-size', '48px');
    el.expanded = true;
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  }

  const longText = 'Line of already-streamed reasoning content that wraps across more than one row. '.repeat(20);

  it('auto-scrolls to the new bottom when content is appended while anchored at the bottom', async () => {
    const el = (await fixture(html`<lr-thinking-panel mode="live"></lr-thinking-panel>`)) as LyraThinkingPanel;
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
      html`<lr-thinking-panel mode="live">${longText}</lr-thinking-panel>`,
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

  it('emits follow transitions only for user scrolling away from and back to the tail', async () => {
    const el = await fixture<LyraThinkingPanel>(html`
      <lr-thinking-panel mode="live">${longText}</lr-thinking-panel>
    `);
    const body = await forceSmallBody(el);

    let pending = oneEvent(el, 'lr-follow-change');
    body.scrollTop = 0;
    body.dispatchEvent(new Event('scroll'));
    expect((await pending).detail).to.deep.equal({ following: false });
    expect(el.follow).to.be.false;

    pending = oneEvent(el, 'lr-follow-change');
    body.scrollTop = body.scrollHeight;
    body.dispatchEvent(new Event('scroll'));
    expect((await pending).detail).to.deep.equal({ following: true });
    expect(el.follow).to.be.true;
  });

  it('does not echo direct follow assignment or imperative scrollToBottom()', async () => {
    const el = await fixture<LyraThinkingPanel>(html`
      <lr-thinking-panel mode="live" expanded>${longText}</lr-thinking-panel>
    `);
    let events = 0;
    el.addEventListener('lr-follow-change', () => events++);

    el.follow = false;
    await el.updateComplete;
    expect(events).to.equal(0);

    el.scrollToBottom();
    await el.updateComplete;
    await twoFrames();
    expect(el.follow).to.be.true;
    expect(events).to.equal(0);
  });

  it('never auto-scrolls in post-hoc mode, even while expanded and anchored at the bottom', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel mode="post-hoc">${longText}</lr-thinking-panel>`,
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
      html`<lr-thinking-panel mode="live">${longText}</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const body = await forceSmallBody(el);

    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
  });

  it('jumps to the bottom when an already-expanded panel\'s mode transitions to live', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel mode="post-hoc">${longText}</lr-thinking-panel>`,
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
    // transition should be needed to reset follow and start following.
    const el = (await fixture(
      html`<lr-thinking-panel mode="post-hoc" expanded>${longText}</lr-thinking-panel>`,
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
    const el = (await fixture(html`<lr-thinking-panel mode="live"></lr-thinking-panel>`)) as LyraThinkingPanel;
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

describe('live-mode auto-scroll via composed lr-content-settled (property-driven shadow-DOM producers)', () => {
  // Forces a tiny scrollable body -- identical helper to the describe block above, duplicated
  // locally since that one is not exported.
  async function forceSmallBody(el: LyraThinkingPanel): Promise<HTMLElement> {
    el.style.setProperty('--lr-thinking-panel-max-block-size', '48px');
    el.expanded = true;
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  }

  const longChunk =
    'A chunk of streamed reasoning content long enough to wrap across more than one row. '.repeat(20);

  it("auto-scrolls when a composed <lr-streaming-text>'s content PROPERTY changes -- a change the light-DOM MutationObserver alone cannot see", async () => {
    const el = await fixture<LyraThinkingPanel>(html`
      <lr-thinking-panel mode="live">
        <lr-streaming-text content-mode="plain" coalesce-ms="0"></lr-streaming-text>
      </lr-thinking-panel>
    `);
    const body = await forceSmallBody(el);
    expect(body.scrollTop).to.equal(0);
    const streamingText = el.querySelector('lr-streaming-text') as unknown as { content: string };

    const settled = oneEvent(el, 'lr-content-settled');
    streamingText.content = longChunk;
    await settled;
    await twoFrames();

    expect(body.scrollTop, 'should have followed the composed child to the bottom').to.be.greaterThan(0);
    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
  });

  it("triggers a follow-scroll attempt when a composed <lr-markdown>'s content PROPERTY changes -- the same property-driven case the class doc's own example composes", async () => {
    // Asserts that the mechanism actually ran (scrollToBottom() was invoked), the same
    // observable this suite's own "does not double-scroll" test below uses, rather than exact
    // post-scroll pixel math -- <lr-markdown> can settle more than once for one content
    // assignment (a transient plain-text fallback frame, then the real parsed render; see its own
    // class doc), and the browser's own scroll-anchoring can additionally nudge a tiny, capped
    // scrollable region as that multi-step layout settles, making an exact final scrollTop/
    // scrollHeight assertion here flaky in a way this component's own behavior is not responsible
    // for. lr-content-settled's own emission points are covered directly by markdown.test.ts and
    // streaming-text.test.ts.
    const el = await fixture<LyraThinkingPanel>(html`
      <lr-thinking-panel mode="live">
        <lr-markdown></lr-markdown>
      </lr-thinking-panel>
    `);
    await forceSmallBody(el);
    // Lets the native 'scroll' event from forceSmallBody()'s own initial (near-empty) jump-to-
    // bottom resolve before the assertion-relevant content change below -- the browser dispatches
    // that event asynchronously, and an unrelated content growth landing in between can leave it
    // reading a stale scrollTop against the new scrollHeight, misreading a followed panel as
    // scrolled-away.
    await twoFrames();
    const markdown = el.querySelector('lr-markdown')!;

    let scrollCalls = 0;
    const originalScrollToBottom = el.scrollToBottom.bind(el);
    el.scrollToBottom = () => {
      scrollCalls += 1;
      originalScrollToBottom();
    };

    const settled = oneEvent(el, 'lr-content-settled');
    (markdown as unknown as { content: string }).content = longChunk;
    await settled;
    await twoFrames();

    expect(
      scrollCalls,
      'the composed lr-markdown settle should have triggered at least one follow-scroll attempt',
    ).to.be.greaterThan(0);
  });

  it('does not force-scroll when the reader has scrolled away, even though the new content arrived via the composed event', async () => {
    const el = await fixture<LyraThinkingPanel>(html`
      <lr-thinking-panel mode="live">
        <lr-streaming-text content-mode="plain" coalesce-ms="0" .content=${longChunk}></lr-streaming-text>
      </lr-thinking-panel>
    `);
    const body = await forceSmallBody(el);
    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);

    body.scrollTop = 0;
    body.dispatchEvent(new Event('scroll'));
    const scrollTopBefore = body.scrollTop;
    expect(scrollTopBefore).to.equal(0);

    const streamingText = el.querySelector('lr-streaming-text') as unknown as { content: string };
    const settled = oneEvent(el, 'lr-content-settled');
    streamingText.content = `${longChunk}A brand new chunk that arrives while scrolled up. `;
    await settled;
    await twoFrames();

    expect(body.scrollTop, 'must not have been yanked back down to the bottom').to.equal(scrollTopBefore);
  });

  it('never auto-scrolls in post-hoc mode even when a composed child emits lr-content-settled', async () => {
    const el = await fixture<LyraThinkingPanel>(html`
      <lr-thinking-panel mode="post-hoc" expanded>
        <lr-streaming-text content-mode="plain" coalesce-ms="0"></lr-streaming-text>
      </lr-thinking-panel>
    `);
    const body = await forceSmallBody(el);
    expect(body.scrollTop).to.equal(0);
    const streamingText = el.querySelector('lr-streaming-text') as unknown as { content: string };

    const settled = oneEvent(el, 'lr-content-settled');
    streamingText.content = longChunk;
    await settled;
    await twoFrames();

    expect(body.scrollTop, 'post-hoc mode must never auto-scroll, per the class doc').to.equal(0);
  });

  // Both signals are raised inside one task, so no animation frame can separate them in any
  // engine. A real streaming child settles on its own schedule (a Lit update, possibly a later
  // task), which is exactly why the fixture must not rely on it to share the mutation's frame.
  for (const order of ['settle before the mutation record', 'mutation record before the settle'] as const) {
    it(`does not double-scroll when the light-DOM MutationObserver and a composed lr-content-settled both fire within the same frame (${order})`, async () => {
      const el = await fixture<LyraThinkingPanel>(html`
        <lr-thinking-panel mode="live">
          <lr-streaming-text content-mode="plain" coalesce-ms="0"></lr-streaming-text>
        </lr-thinking-panel>
      `);
      await forceSmallBody(el);
      const streamingText = el.querySelector('lr-streaming-text')!;

      let scrollCalls = 0;
      el.scrollToBottom = () => {
        scrollCalls += 1;
      };

      const settled = oneEvent(el, 'lr-content-settled');
      const settle = (): void => {
        streamingText.dispatchEvent(new CustomEvent('lr-content-settled', { bubbles: true, composed: true }));
      };
      // The append queues the MutationObserver's microtask. Dispatching synchronously runs the
      // settle listener before it; queueing the dispatch as a microtask runs it after. Either way
      // both land before the next frame.
      el.appendChild(document.createTextNode('Plain light-DOM chunk. '));
      if (order === 'settle before the mutation record') settle();
      else queueMicrotask(settle);
      await settled;
      await twoFrames();

      expect(scrollCalls, 'both signals landing in one frame must still coalesce to a single scroll').to.equal(1);
    });
  }
});

describe('body keyboard accessibility', () => {
  it('is a focusable, named group so a keyboard-only reader can scroll a long transcript', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel label="Reasoning" expanded>content</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;

    expect(body.getAttribute('tabindex')).to.equal('0');
    expect(body.getAttribute('role')).to.equal('group');
    expect(body.getAttribute('aria-label')).to.equal('Reasoning');

    body.focus();
    expect((el.shadowRoot!.activeElement) === (body)).to.equal(true);
  });
});

it('rebinds content observation and animation frames to its owner realm across adoption', async () => {
  const el = (await fixture(
    html`<lr-thinking-panel expanded>reasoning</lr-thinking-panel>`,
  )) as LyraThinkingPanel;
  await el.updateComplete;
  el.remove();
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const originalMutationObserver = frameWindow.MutationObserver;
  const originalRequestAnimationFrame = frameWindow.requestAnimationFrame;
  const originalCancelAnimationFrame = frameWindow.cancelAnimationFrame;
  let contentMutationCallback: MutationCallback | undefined;
  let observerDisconnects = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const cancelledFrames: number[] = [];
  class OwnerMutationObserver implements MutationObserver {
    private readonly callback: MutationCallback;
    private observesContent = false;
    constructor(callback: MutationCallback) {
      this.callback = callback;
    }
    observe(target: Node): void {
      if (target === el) {
        this.observesContent = true;
        contentMutationCallback = this.callback;
      }
    }
    takeRecords(): MutationRecord[] { return []; }
    disconnect(): void {
      if (this.observesContent) observerDisconnects += 1;
    }
  }
  frameWindow.MutationObserver = OwnerMutationObserver;
  frameWindow.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    frames.set(71, callback);
    return 71;
  }) as typeof frameWindow.requestAnimationFrame;
  frameWindow.cancelAnimationFrame = ((handle: number): void => {
    cancelledFrames.push(handle);
    frames.delete(handle);
  }) as typeof frameWindow.cancelAnimationFrame;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(contentMutationCallback, 'the adopted window constructs the content observer').to.be.a('function');
    contentMutationCallback!([], {} as MutationObserver);
    const staleFrame = frames.get(71);
    expect(staleFrame, 'the observer schedules through the adopted window').to.be.a('function');

    document.adoptNode(el);
    expect(observerDisconnects, 'adoption disconnects the old observer').to.equal(1);
    expect(cancelledFrames, 'adoption cancels the old owner frame').to.deep.equal([71]);
    contentMutationCallback!([], {} as MutationObserver);
    expect(frames.size, 'a stale old-realm observer callback cannot schedule new work').to.equal(0);
    let scrollCalls = 0;
    el.scrollToBottom = () => { scrollCalls += 1; };
    staleFrame!(0);
    expect(scrollCalls, 'a stale old-realm callback cannot mutate the adopted element').to.equal(0);
  } finally {
    frameWindow.MutationObserver = originalMutationObserver;
    frameWindow.requestAnimationFrame = originalRequestAnimationFrame;
    frameWindow.cancelAnimationFrame = originalCancelAnimationFrame;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

describe('body scroll containment', () => {
  it('sets overscroll-behavior: contain on the scrollable body', async () => {
    const el = (await fixture(html`<lr-thinking-panel expanded></lr-thinking-panel>`)) as LyraThinkingPanel;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(getComputedStyle(body).overscrollBehavior).to.equal('contain');
  });
});

describe('RTL', () => {
  it('mirrors the collapsed-state toggle chevron under dir="rtl"', async () => {
    const wrapper = await fixture(html`
      <div dir="rtl">
        <lr-thinking-panel></lr-thinking-panel>
      </div>
    `);
    const el = wrapper.querySelector('lr-thinking-panel') as LyraThinkingPanel;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
    expect(getComputedStyle(toggle).transform).to.equal('matrix(-1, 0, 0, 1, 0, 0)');
  });

  it('does not mirror the expanded-state (already-rotated) toggle chevron under dir="rtl"', async () => {
    const wrapper = await fixture(html`
      <div dir="rtl">
        <lr-thinking-panel expanded></lr-thinking-panel>
      </div>
    `);
    const el = wrapper.querySelector('lr-thinking-panel') as LyraThinkingPanel;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
    // rotate(90deg): cos(90)=0, sin(90)=1 -> matrix(0, 1, -1, 0, 0, 0)
    expect(getComputedStyle(toggle).transform).to.equal('matrix(0, 1, -1, 0, 0, 0)');
  });
});

describe('motion', () => {
  it('uses the ambient (slow, breathing) transition token for the pending-duration pulse dot, not the fast discrete-transition token', async () => {
    const el = (await fixture(
      html`<lr-thinking-panel mode="live" expanded></lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const dot = el.shadowRoot!.querySelector('.pending-dot') as HTMLElement;
    expect((dot) != null).to.equal(true);
    expect(getComputedStyle(dot).animationDuration).to.equal('1.8s');
  });
});

it('is accessible with no content and collapsed', async () => {
  const el = (await fixture(html`<lr-thinking-panel></lr-thinking-panel>`)) as LyraThinkingPanel;
  await expect(el).to.be.accessible();
});

it('is accessible with content, expanded, and a duration set', async () => {
  const el = (await fixture(html`
    <lr-thinking-panel mode="post-hoc" duration-ms="4200" expanded>
      The reasoning transcript goes here, with a bit of detail about the approach taken.
    </lr-thinking-panel>
  `)) as LyraThinkingPanel;
  await expect(el).to.be.accessible();
});

it('contains unbroken plain slotted content without creating a horizontal scroller', async () => {
  const long = `reasoning-${'identifier'.repeat(180)}`;
  const el = (await fixture(html`
    <div style="inline-size:256px">
      <lr-thinking-panel expanded>${long}</lr-thinking-panel>
    </div>
  `)).querySelector('lr-thinking-panel') as LyraThinkingPanel;
  await el.updateComplete;
  const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  expect(Math.ceil(el.getBoundingClientRect().width)).to.be.at.most(256);
  expect(body.scrollWidth).to.be.at.most(body.clientWidth + 1);
});

it('exposes a component-scoped pending color', async () => {
  const el = (await fixture(html`
    <lr-thinking-panel
      mode="live"
      expanded
      style="--lr-thinking-panel-pending-color: rgb(1, 2, 3)"
    ></lr-thinking-panel>
  `)) as LyraThinkingPanel;
  const pending = el.shadowRoot!.querySelector<HTMLElement>('[part="duration"][data-pending]')!;
  expect(getComputedStyle(pending).color).to.equal('rgb(1, 2, 3)');
});

describe('the tabbable scroll region\'s own affordances', () => {
  // [part='body'] is unconditionally tabindex="0" -- a real, always-focusable, independently
  // scrollable region (the class file cites lr-code-block and lr-virtual-list as sharing this
  // convention). Both of those pair the tabindex with a :focus-visible outline; without one a
  // keyboard user tabbing in gets no indication at all, and a mouse user gets no cue that the
  // region is separately scrollable. Both assertions read the *rendered* computed result rather
  // than the stylesheet text, so a rule that never actually matches the part still fails.
  async function panelBody(): Promise<{ el: LyraThinkingPanel; body: HTMLElement }> {
    const el = (await fixture(html`
      <lr-thinking-panel expanded>Long reasoning transcript</lr-thinking-panel>
    `)) as LyraThinkingPanel;
    const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    expect(body.getAttribute('tabindex')).to.equal('0');
    expect(getComputedStyle(body).outlineStyle, 'the resting region draws no ring').to.equal('none');
    return { el, body };
  }

  /** Resolves a declaration inside the component's own shadow root, so the expectation is the
   *  token's real cascaded value rather than a hard-coded px/colour literal. */
  function resolvedInShadow(el: LyraThinkingPanel, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  it('draws the shared focus ring on the scroll region while it is keyboard-focused', async () => {
    const { el, body } = await panelBody();
    const expectedWidth = resolvedInShadow(el, 'outline-width: var(--lr-focus-ring-width)', 'outline-width');
    const expectedColor = resolvedInShadow(el, 'outline-color: var(--lr-focus-ring-color)', 'outline-color');
    const expectedOffset = resolvedInShadow(
      el,
      'outline-offset: calc(-1 * var(--lr-focus-ring-offset))',
      'outline-offset',
    );

    body.focus();
    expect(el.shadowRoot!.activeElement === body).to.equal(true);
    const focused = getComputedStyle(body);
    expect(focused.outlineStyle).to.equal('solid');
    expect(focused.outlineWidth).to.equal(expectedWidth);
    expect(focused.outlineColor).to.equal(expectedColor);
    // Inward, or the ring is clipped by the region's own overflow-block: auto.
    expect(focused.outlineOffset).to.equal(expectedOffset);
    expect(Number.parseFloat(focused.outlineOffset)).to.be.lessThan(0);
    body.blur();
  });

  it('previews the same treatment in a plain border colour on pointer hover', async () => {
    const { el, body } = await panelBody();
    const expectedColor = resolvedInShadow(el, 'outline-color: var(--lr-color-border)', 'outline-color');
    const focusRingColor = resolvedInShadow(el, 'outline-color: var(--lr-focus-ring-color)', 'outline-color');
    body.scrollIntoView({ block: 'center' });
    const rect = body.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      const hovered = getComputedStyle(body);
      expect(hovered.outlineStyle, 'hover must give the mouse user a cue of its own').to.equal('solid');
      expect(hovered.outlineColor).to.equal(expectedColor);
      // A preview, deliberately not the focus ring's own colour, so the two stay distinguishable.
      expect(hovered.outlineColor).to.not.equal(focusRingColor);
    } finally {
      await resetMouse();
    }
  });

  it('lets each body hover-outline longhand be retinted independently and keeps them unchanged while pressed', async () => {
    const el = (await fixture(html`
      <lr-thinking-panel
        expanded
        style="
          --lr-thinking-panel-body-hover-outline-width: 3px;
          --lr-thinking-panel-body-hover-outline-style: dashed;
          --lr-thinking-panel-body-hover-outline-color: rgb(12, 34, 56);
          --lr-thinking-panel-body-hover-outline-offset: -2px;
        "
      >Long reasoning transcript</lr-thinking-panel>
    `)) as LyraThinkingPanel;
    const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    body.scrollIntoView({ block: 'center' });
    const rect = body.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(
        () => getComputedStyle(body).outlineColor === 'rgb(12, 34, 56)',
        'the scoped body hover outline color never rendered',
      );
      const hovered = getComputedStyle(body);
      expect(hovered.outlineWidth).to.equal('3px');
      expect(hovered.outlineStyle).to.equal('dashed');
      expect(hovered.outlineColor).to.equal('rgb(12, 34, 56)');
      expect(hovered.outlineOffset).to.equal('-2px');

      await sendMouse({ type: 'down' });
      const pressed = getComputedStyle(body);
      expect(pressed.outlineWidth).to.equal('3px');
      expect(pressed.outlineStyle).to.equal('dashed');
      expect(pressed.outlineColor).to.equal('rgb(12, 34, 56)');
      expect(pressed.outlineOffset).to.equal('-2px');
    } finally {
      await resetMouse();
    }
  });
});

describe('card chrome theming hooks', () => {
  const part = (el: LyraThinkingPanel, name: string) =>
    el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it('repaints the card through --lr-thinking-panel-background/-border-color/-radius', async () => {
    const el = (await fixture(html`
      <lr-thinking-panel
        expanded
        style="--lr-thinking-panel-background: rgb(1, 2, 3); --lr-thinking-panel-border-color: rgb(4, 5, 6); --lr-thinking-panel-radius: 11px"
        >Reasoning</lr-thinking-panel
      >
    `)) as LyraThinkingPanel;
    const chrome = getComputedStyle(part(el, 'base'));
    expect(chrome.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(chrome.borderTopColor).to.equal('rgb(4, 5, 6)');
    expect(chrome.borderTopLeftRadius).to.equal('11px');
    expect(getComputedStyle(part(el, 'body')).borderTopColor).to.equal('rgb(4, 5, 6)');
  });

  it('leaves the card paint byte-identical when the hooks are unset', async () => {
    const control = (await fixture(
      html`<lr-thinking-panel expanded>Reasoning</lr-thinking-panel>`,
    )) as LyraThinkingPanel;
    const tokened = (await fixture(html`
      <lr-thinking-panel
        expanded
        style="--lr-thinking-panel-background: var(--lr-color-surface); --lr-thinking-panel-border-color: var(--lr-color-border); --lr-thinking-panel-radius: var(--lr-radius)"
        >Reasoning</lr-thinking-panel
      >
    `)) as LyraThinkingPanel;
    const unset = getComputedStyle(part(control, 'base'));
    const explicit = getComputedStyle(part(tokened, 'base'));
    expect(unset.backgroundColor).to.equal(explicit.backgroundColor);
    expect(unset.borderTopColor).to.equal(explicit.borderTopColor);
    expect(unset.borderTopLeftRadius).to.equal(explicit.borderTopLeftRadius);
    expect(unset.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(part(control, 'body')).borderTopColor).to.equal(
      getComputedStyle(part(tokened, 'body')).borderTopColor,
    );
  });

  // The header is a borderless button, so the card edge is that control's only visible boundary
  // (WCAG 2.2 SC 1.4.11): it stays on the control tier even when the decorative input is set.
  it('keeps the card edge and divider on the --lr-color-border control tier, not the subtle tier', async () => {
    const el = (await fixture(html`
      <lr-thinking-panel
        expanded
        style="--lr-theme-color-surface-border: rgb(10, 20, 30); --lr-theme-color-surface-border-subtle: rgb(7, 8, 9)"
        >Reasoning</lr-thinking-panel
      >
    `)) as LyraThinkingPanel;
    expect(getComputedStyle(part(el, 'base')).borderTopColor).to.equal('rgb(10, 20, 30)');
    expect(getComputedStyle(part(el, 'body')).borderTopColor).to.equal('rgb(10, 20, 30)');
  });
});

describe('header text contrast at rest, hover and press', () => {
  afterEach(async () => {
    await resetMouse();
  });

  // The quiet duration and the brand pending label both sit on the header's hover tint and on the
  // deeper pressed mix; each must follow the header colour there instead of keeping its own.
  const cases = [
    { name: 'finished duration', template: html`<lr-thinking-panel mode="post-hoc" .durationMs=${4200}></lr-thinking-panel>` },
    { name: 'pending live label', template: html`<lr-thinking-panel mode="live"></lr-thinking-panel>` },
  ];
  for (const theme of ['light', 'dark'] as const) {
    for (const { name, template } of cases) {
      it(`keeps the ${name} readable and following the header colour (${theme})`, async () => {
        const wrapper = await fixture<HTMLElement>(
          html`<div data-lr-theme=${theme}>${template}</div>`,
        );
        const el = wrapper.querySelector('lr-thinking-panel') as LyraThinkingPanel;
        await el.updateComplete;
        const root = el.shadowRoot!;
        const header = root.querySelector<HTMLElement>('[part="header"]')!;
        const base = root.querySelector<HTMLElement>('[part="base"]')!;
        const texts = ['label', 'duration'].map((partName) => root.querySelector<HTMLElement>(`[part="${partName}"]`)!);
        expect(texts.every(Boolean), 'label and duration both render').to.equal(true);
        const assertContrast = (state: string): void => {
          const background = effectiveBackground(header, base);
          for (const node of texts) {
            expect(
              contrastRatio(getComputedStyle(node).color, background),
              `${state} ${node.getAttribute('part')}`,
            ).to.be.at.least(4.5);
          }
        };
        assertContrast('rest');

        const restBackground = getComputedStyle(header).backgroundColor;
        await hoverUntilMatched(header, 'thinking-panel header under the pointer');
        await waitUntil(() => getComputedStyle(header).backgroundColor !== restBackground, 'hover background');
        const brand = resolvedColorToken(root, '--lr-color-brand');
        expect(texts.map((node) => getComputedStyle(node).color)).to.deep.equal([brand, brand]);
        assertContrast('hover');
        const hoverBackground = getComputedStyle(header).backgroundColor;

        await sendMouse({ type: 'down' });
        try {
          await waitUntil(() => getComputedStyle(header).backgroundColor !== hoverBackground, 'pressed background');
          const body = resolvedColorToken(root, '--lr-color-text');
          await waitUntil(
            () => texts.every((node) => getComputedStyle(node).color === body),
            'pressed header text returns to the body colour',
          );
          assertContrast('pressed');
        } finally {
          await sendMouse({ type: 'up' });
        }
      });
    }
  }
});

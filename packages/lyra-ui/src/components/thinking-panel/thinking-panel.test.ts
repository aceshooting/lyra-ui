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

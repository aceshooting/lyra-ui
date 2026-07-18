import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './chat-viewport.js';
import '../chat-message/chat-message.js';
import '../virtual-list/virtual-list.js';
import type { LyraChatViewport } from './chat-viewport.js';
import type { LyraVirtualList } from '../virtual-list/virtual-list.class.js';

/** Waits two animation frames -- enough for this component's own rAF-coalesced growth tick (and,
 *  when a slotted lyra-virtual-list is involved, its own rAF-coalesced scroll handler) to settle. */
async function nextFrame(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

// Returns a real lit-html TemplateResult (not a plain HTML string) -- a plain string
// interpolated via `${...}` in an `html` tagged template renders as escaped text, not parsed
// markup, which would leave `el.children` empty and defeat every index-based assertion below.
function row(text: string, heightPx = 40) {
  return html`<div style="block-size:${heightPx}px;box-sizing:border-box;">${text}</div>`;
}

it('defaults to follow=true, bottomThreshold=24, unreadStartIndex=null', async () => {
  const el = (await fixture(html`<lyra-chat-viewport></lyra-chat-viewport>`)) as LyraChatViewport;
  expect(el.follow).to.be.true;
  expect(el.bottomThreshold).to.equal(24);
  expect(el.unreadStartIndex).to.equal(null);
});

it('is role="log" with aria-live="off" and tabindex="0", labeled by the default or a custom label', async () => {
  const el = (await fixture(html`<lyra-chat-viewport></lyra-chat-viewport>`)) as LyraChatViewport;
  const scroll = el.shadowRoot!.querySelector('[part="scroll"]')!;
  expect(scroll.getAttribute('role')).to.equal('log');
  expect(scroll.getAttribute('aria-live')).to.equal('off');
  expect(scroll.getAttribute('tabindex')).to.equal('0');
  expect(scroll.getAttribute('aria-label')).to.equal('Conversation');

  const labeled = (await fixture(
    html`<lyra-chat-viewport label="Support thread"></lyra-chat-viewport>`,
  )) as LyraChatViewport;
  expect(labeled.shadowRoot!.querySelector('[part="scroll"]')!.getAttribute('aria-label')).to.equal(
    'Support thread',
  );
});

it('forwards a host aria-label to the role="log" element, winning over the label property', async () => {
  const el = (await fixture(
    html`<lyra-chat-viewport aria-label="Team thread" label="Support thread"></lyra-chat-viewport>`,
  )) as LyraChatViewport;
  const scroll = el.shadowRoot!.querySelector('[part="scroll"]')!;
  // An aria-label on the custom-element host itself never names the shadow-side log element --
  // the forwarded accessibleLabel property is what actually reaches the role.
  expect(el.accessibleLabel).to.equal('Team thread');
  expect(scroll.getAttribute('aria-label')).to.equal('Team thread');

  // Clearing the forwarded name falls back to the label property.
  el.accessibleLabel = null;
  await el.updateComplete;
  expect(scroll.getAttribute('aria-label')).to.equal('Support thread');
});

it('keeps the jump pill horizontally centered under dir="rtl" by flipping its translate sign', async () => {
  const pillTranslateX = async (dirAttr: string): Promise<number> => {
    const el = (await fixture(
      html`<lyra-chat-viewport dir=${dirAttr} style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    el.follow = false;
    await el.updateComplete;
    const pill = el.shadowRoot!.querySelector('[part="jump-pill"]') as HTMLElement;
    return new DOMMatrixReadOnly(getComputedStyle(pill).transform).m41;
  };
  // inset-inline-start: 50% anchors the pill to the physical right edge under RTL, so the
  // centering translateX must resolve leftward (negative) in LTR and rightward (positive) in RTL.
  expect(await pillTranslateX('ltr')).to.be.lessThan(0);
  expect(await pillTranslateX('rtl')).to.be.greaterThan(0);
});

describe('slotted mode -- follow/release/re-engage state machine', () => {
  it('auto-scrolls to the end as content grows while following', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:120px" unread-start-index="0"
        >${[1, 2, 3].map((n) => row(`m${n}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;
    const before = scroll.scrollTop;

    const extra = document.createElement('div');
    extra.style.blockSize = '40px';
    extra.textContent = 'm4';
    el.appendChild(extra);
    await nextFrame();
    await nextFrame();

    expect(scroll.scrollTop).to.be.greaterThan(before);
    expect(scroll.scrollTop + scroll.clientHeight).to.be.closeTo(scroll.scrollHeight, 1);
  });

  it('releases follow on a user wheel scroll-up past bottomThreshold, and fires lyra-follow-change', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;
    expect(scroll.scrollTop + scroll.clientHeight).to.be.closeTo(scroll.scrollHeight, 1);

    const eventPromise = oneEvent(el, 'lyra-follow-change');
    scroll.dispatchEvent(new WheelEvent('wheel', { bubbles: true, composed: true }));
    scroll.scrollTop = 0;
    scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
    const ev = await eventPromise;
    expect(ev.detail).to.deep.equal({ following: false });
    expect(el.follow).to.be.false;
  });

  it('falls back to the documented default distance when bottom-threshold is non-finite or negative, instead of permanently blocking re-engagement', async () => {
    const expectReengages = async (bottomThreshold: string) => {
      const el = (await fixture(
        html`<lyra-chat-viewport style="block-size:100px" bottom-threshold=${bottomThreshold}
          >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
        >`,
      )) as LyraChatViewport;
      el.follow = false;
      await el.updateComplete;
      await nextFrame();
      const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;
      scroll.scrollTop = scroll.scrollHeight - scroll.clientHeight; // exactly at the end
      scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
      expect(
        el.follow,
        `bottom-threshold="${bottomThreshold}" must not permanently block reaching the bottom (a NaN comparison is always false)`,
      ).to.be.true;
    };
    await expectReengages('not-a-number');
    await expectReengages('-10');
  });

  it('does not release follow for a programmatic/layout-driven scroll with no preceding intent gesture', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;

    let fired = false;
    el.addEventListener('lyra-follow-change', () => (fired = true));
    // A scroll event with no preceding wheel/touch/keydown/pointerdown intent gesture -- e.g. the
    // component's own scrollTo() call settling, or a layout shift.
    scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
    await nextFrame();
    expect(fired).to.be.false;
    expect(el.follow).to.be.true;
  });

  it('re-engages follow once scroll naturally reaches the bottom again', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;

    scroll.dispatchEvent(new WheelEvent('wheel', { bubbles: true, composed: true }));
    scroll.scrollTop = 0;
    scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
    await nextFrame();
    expect(el.follow).to.be.false;

    const eventPromise = oneEvent(el, 'lyra-follow-change');
    scroll.scrollTop = scroll.scrollHeight - scroll.clientHeight;
    scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
    const ev = await eventPromise;
    expect(ev.detail).to.deep.equal({ following: true });
    expect(el.follow).to.be.true;
  });

  it('never fires lyra-follow-change for the initial mount state', async () => {
    const el = (await fixture(html`<lyra-chat-viewport></lyra-chat-viewport>`)) as LyraChatViewport;
    let fired = false;
    el.addEventListener('lyra-follow-change', () => (fired = true));
    await el.updateComplete;
    await nextFrame();
    expect(fired).to.be.false;
  });

  it('clears scrollbarDragActive on a pointerup outside the scroll part, so a later layout-shift scroll away from the bottom does not spuriously release follow', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;

    // A scrollbar-drag start, then a release that lands outside [part="scroll"] entirely (e.g.
    // the native scrollbar thumb, or the pointer having left the element mid-drag) -- dispatched
    // directly on window, never bubbling through the scroll part.
    scroll.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    window.dispatchEvent(new PointerEvent('pointerup'));

    let fired = false;
    el.addEventListener('lyra-follow-change', () => (fired = true));
    // A layout shift moves the scroll position away from the bottom with no wheel/touch/keydown
    // gesture, and -- assuming the drag above actually ended -- no active scrollbar drag either.
    scroll.scrollTop = 0;
    scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
    expect(fired, 'a stuck scrollbarDragActive flag would misattribute this as a user release').to.be.false;
    expect(el.follow).to.be.true;
  });
});

describe('scrollToBottom()', () => {
  it('scrolls to the end and re-engages a released follow', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:100px" follow="false"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    el.follow = false;
    await el.updateComplete;
    await nextFrame();
    const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;
    scroll.scrollTop = 0;

    el.scrollToBottom({ behavior: 'auto' });
    await nextFrame();
    expect(el.follow).to.be.true;
    expect(scroll.scrollTop + scroll.clientHeight).to.be.closeTo(scroll.scrollHeight, 1);
  });

  it('forces behavior "auto" under prefers-reduced-motion', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as typeof window.matchMedia;
    try {
      const el = (await fixture(
        html`<lyra-chat-viewport style="block-size:100px"
          >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
        >`,
      )) as LyraChatViewport;
      await el.updateComplete;
      await nextFrame();
      const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;
      scroll.scrollTop = 0;
      el.scrollToBottom({ behavior: 'smooth' });
      await nextFrame();
      // Reduced motion forces an immediate jump rather than an animated scroll.
      expect(scroll.scrollTop + scroll.clientHeight).to.be.closeTo(scroll.scrollHeight, 1);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('jump pill', () => {
  it('is absent while following and appears once follow is released', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    expect(el.shadowRoot!.querySelector('[part="jump-pill"]')).to.not.exist;

    el.follow = false;
    await el.updateComplete;
    const pill = el.shadowRoot!.querySelector('[part="jump-pill"]');
    expect(pill).to.exist;
  });

  it('shows a pluralized unread count once unreadStartIndex yields a positive count', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:100px" unread-start-index="8"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    el.follow = false;
    await el.updateComplete;
    const pill = el.shadowRoot!.querySelector('[part="jump-pill"]')!;
    expect(pill.textContent).to.include('2'); // 10 total - 8 unread-start = 2 new
  });

  it('activating the pill calls scrollToBottom()', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    el.follow = false;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="jump-pill"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.follow).to.be.true;
  });
});

describe('unread divider (slotted mode)', () => {
  it('positions the divider above the child at unreadStartIndex', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:200px" unread-start-index="2"
        >${Array.from({ length: 5 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const divider = el.shadowRoot!.querySelector('[part="unread-divider"]') as HTMLElement;
    expect(divider).to.exist;
    expect(divider.getAttribute('role')).to.equal('separator');
    expect(parseFloat(divider.style.top)).to.equal(80); // 2 rows * 40px
  });

  it('renders no divider when unreadStartIndex is null', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:200px"
        >${Array.from({ length: 5 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    expect(el.shadowRoot!.querySelector('[part="unread-divider"]')).to.not.exist;
    // `null` is the one true "disabled" sentinel -- confirmed untouched by the clamping in the
    // next test, which normalizes every other (non-null) value to a safe non-negative integer.
    expect(el.unreadStartIndex).to.equal(null);
  });

  it('clamps a non-finite or negative unread-start-index to a safe non-negative index instead of silently disabling the divider', async () => {
    const negative = (await fixture(
      html`<lyra-chat-viewport style="block-size:200px" unread-start-index="-3"
        >${Array.from({ length: 5 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    await negative.updateComplete;
    await nextFrame();
    const negativeDivider = negative.shadowRoot!.querySelector('[part="unread-divider"]') as HTMLElement;
    expect(negativeDivider, 'a negative index must clamp to 0, not silently disable the divider').to.exist;
    expect(parseFloat(negativeDivider.style.top)).to.equal(0);

    const nonFinite = (await fixture(
      html`<lyra-chat-viewport style="block-size:200px" unread-start-index="not-a-number"
        >${Array.from({ length: 5 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    await nonFinite.updateComplete;
    await nextFrame();
    expect(nonFinite.shadowRoot!.querySelector('[part="unread-divider"]'), 'NaN must clamp the same way as a negative index')
      .to.exist;
  });

  it('scrollToUnread scrolls to the divider and returns true; false when unreadStartIndex is null', async () => {
    const el = (await fixture(
      html`<lyra-chat-viewport style="block-size:100px" unread-start-index="8"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;
    scroll.scrollTop = 0;

    const result = el.scrollToUnread({ behavior: 'auto' });
    await nextFrame();
    expect(result).to.be.true;
    expect(scroll.scrollTop).to.be.closeTo(320, 1); // 8 rows * 40px

    const noUnread = (await fixture(
      html`<lyra-chat-viewport style="block-size:100px"
        >${row('only')}</lyra-chat-viewport
      >`,
    )) as LyraChatViewport;
    expect(noUnread.scrollToUnread()).to.be.false;
  });
});

describe('virtual mode', () => {
  function virtualFixtureMarkup(itemCount: number) {
    return html`
      <lyra-chat-viewport style="block-size:120px">
        <lyra-virtual-list
          style="--lyra-virtual-list-height:120px"
          row-height="40"
          .items=${Array.from({ length: itemCount }, (_, i) => i)}
          .renderItem=${(item: unknown) => html`row ${item}`}
          .keyFunction=${(item: unknown) => item as number}
        ></lyra-virtual-list>
      </lyra-chat-viewport>
    `;
  }

  it('detects a single slotted lyra-virtual-list and defers scrolling to it', async () => {
    const el = (await fixture(virtualFixtureMarkup(20))) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const list = el.querySelector('lyra-virtual-list') as LyraVirtualList;
    const base = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    el.follow = false;
    await el.updateComplete;
    base.scrollTop = 0;
    base.dispatchEvent(new Event('scroll'));
    await nextFrame();

    el.scrollToBottom({ behavior: 'auto' });
    await nextFrame();
    expect(base.scrollTop).to.be.greaterThan(0);
  });

  it('re-engages follow once the visible range reaches the last item', async () => {
    const el = (await fixture(virtualFixtureMarkup(20))) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const list = el.querySelector('lyra-virtual-list') as LyraVirtualList;
    const base = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    base.dispatchEvent(new WheelEvent('wheel', { bubbles: true, composed: true }));
    base.scrollTop = 0;
    base.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(el.follow).to.be.false;

    const eventPromise = oneEvent(el, 'lyra-follow-change');
    base.scrollTop = base.scrollHeight - base.clientHeight;
    base.dispatchEvent(new Event('scroll'));
    const ev = await eventPromise;
    expect(ev.detail).to.deep.equal({ following: true });
  });

  it('does not misattribute a later append as user-caused after a wheel gesture that changed no visible range', async () => {
    const el = (await fixture(virtualFixtureMarkup(20))) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const list = el.querySelector('lyra-virtual-list') as LyraVirtualList;
    const base = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    // A wheel-down gesture at the bottom that moves nothing: no scroll event follows, so nothing
    // ever consumes the pending user-intent flag it set -- until it goes stale.
    base.dispatchEvent(new WheelEvent('wheel', { bubbles: true, composed: true }));
    await new Promise<void>((r) => setTimeout(r, 600));

    let fired = false;
    el.addEventListener('lyra-follow-change', () => (fired = true));
    // Simulates the range event a later, unrelated append produces while not at the bottom --
    // never actually user-caused.
    list.dispatchEvent(new CustomEvent('lyra-visible-range-changed', { detail: { start: 10, end: 18 } }));
    expect(fired, 'a stale pendingUserIntent would misattribute this as a user release').to.be.false;
    expect(el.follow).to.be.true;
  });
});

it('is accessible in slotted mode with an unread divider and a released follow', async () => {
  const el = (await fixture(
    html`<lyra-chat-viewport style="block-size:100px" unread-start-index="1" follow="false"
      >${row('m0')}${row('m1')}${row('m2')}</lyra-chat-viewport
    >`,
  )) as LyraChatViewport;
  el.follow = false;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible populated with real chat messages, an unread divider, and a failed message', async () => {
  // Populated-state axe check: a realistic chat surface — actual `<lyra-chat-message>`
  // children (with timestamps, a failed status, and its retry button) plus the unread
  // divider — renders a11y surface that plain placeholder rows never exercise. axe
  // traverses into each message's shadow root, so this covers the composed tree. Assert
  // the populated markers rendered before running axe.
  const el = (await fixture(
    html`<lyra-chat-viewport style="block-size:120px" unread-start-index="1" follow="false">
      <lyra-chat-message data-role="user" .timestamp=${new Date('2024-05-01T10:00:00Z')}
        >Hello there</lyra-chat-message
      >
      <lyra-chat-message data-role="assistant" .timestamp=${new Date('2024-05-01T10:00:05Z')}
        >Hi! How can I help?</lyra-chat-message
      >
      <lyra-chat-message data-role="user" status="failed">Did this send?</lyra-chat-message>
    </lyra-chat-viewport>`,
  )) as LyraChatViewport;
  el.follow = false;
  await el.updateComplete;
  await nextFrame();
  expect(el.shadowRoot!.querySelector('[part="unread-divider"]')).to.exist;
  const failed = el.querySelector('lyra-chat-message[status="failed"]')!;
  expect(failed.shadowRoot!.querySelector('[part="retry-button"]')).to.exist;
  await expect(el).to.be.accessible();
});

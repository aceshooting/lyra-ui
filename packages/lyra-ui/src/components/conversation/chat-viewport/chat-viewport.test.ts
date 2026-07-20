import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './chat-viewport.js';
import '../chat-message/chat-message.js';
import '../../layout/virtual-list/virtual-list.js';
import type { LyraChatViewport } from './chat-viewport.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import { styles } from './chat-viewport.styles.js';

/** Waits two animation frames -- enough for this component's own rAF-coalesced growth tick (and,
 *  when a slotted lr-virtual-list is involved, its own rAF-coalesced scroll handler) to settle. */
async function nextFrame(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

// Returns a real lit-html TemplateResult (not a plain HTML string) -- a plain string
// interpolated via `${...}` in an `html` tagged template renders as escaped text, not parsed
// markup, which would leave `el.children` empty and defeat every index-based assertion below.
function row(text: string, heightPx = 40) {
  return html`<div style="block-size:${heightPx}px;box-sizing:border-box;">${text}</div>`;
}

it('defaults to follow=true, bottomThreshold=24, unreadStartIndex=null, and live=off', async () => {
  const el = (await fixture(html`<lr-chat-viewport></lr-chat-viewport>`)) as LyraChatViewport;
  expect(el.follow).to.be.true;
  expect(el.bottomThreshold).to.equal(24);
  expect(el.unreadStartIndex).to.equal(null);
  expect(el.live).to.equal('off');
});

it('parses the plain-HTML attribute string follow="false", not just a .follow property binding', async () => {
  // trueDefaultBooleanConverter's fromAttribute checks the literal string rather than Lit's
  // default presence-based Boolean converter, which can never distinguish an omitted attribute
  // from one explicitly written as the literal string "false" -- both would otherwise map to
  // `follow`'s own `true` default (auto-scroll-to-bottom staying engaged against the markup's
  // intent). Asserted with no subsequent `.follow = false` property assignment, unlike the fixtures
  // elsewhere in this file that set the attribute and then immediately overwrite it with a property
  // binding before ever asserting -- that pattern never actually proves the attribute string itself
  // was parsed.
  const el = (await fixture(html`<lr-chat-viewport follow="false"></lr-chat-viewport>`)) as LyraChatViewport;
  expect(el.follow).to.be.false;
});

it('is role="log" with aria-live="off" and tabindex="0", labeled by the default or a custom label', async () => {
  const el = (await fixture(html`<lr-chat-viewport></lr-chat-viewport>`)) as LyraChatViewport;
  const scroll = el.shadowRoot!.querySelector('[part="scroll"]')!;
  expect(scroll.getAttribute('role')).to.equal('log');
  expect(scroll.getAttribute('aria-live')).to.equal('off');
  expect(scroll.getAttribute('tabindex')).to.equal('0');
  expect(scroll.getAttribute('aria-label')).to.equal('Conversation');

  const labeled = (await fixture(
    html`<lr-chat-viewport label="Support thread"></lr-chat-viewport>`,
  )) as LyraChatViewport;
  expect(labeled.shadowRoot!.querySelector('[part="scroll"]')!.getAttribute('aria-label')).to.equal(
    'Support thread',
  );
});

it('pins overflow-x explicitly alongside overflow-y so the transcript never grows a phantom horizontal scrollbar', async () => {
  // Per the CSS overflow spec, pinning only overflow-y to a non-'visible' value still forces the
  // other axis's *used* value to 'auto' (never 'visible') -- so a sub-pixel-wide inline code span
  // or a fractional-width bubble under zoom could trip a spurious horizontal scrollbar unless
  // overflow-x is pinned explicitly too (mirrors lr-tabs's fix for the identical bug class).
  const el = (await fixture(html`<lr-chat-viewport></lr-chat-viewport>`)) as LyraChatViewport;
  const scroll = getComputedStyle(el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement);
  expect(scroll.overflowX).to.equal('hidden');
  expect(scroll.overflowY).to.equal('auto');
});

it('forwards the live announcement policy to the internal log and reacts to property changes', async () => {
  const polite = (await fixture(
    html`<lr-chat-viewport live="polite"></lr-chat-viewport>`,
  )) as LyraChatViewport;
  const log = polite.shadowRoot!.querySelector('[role="log"]')!;
  expect(polite.live).to.equal('polite');
  expect(log.getAttribute('aria-live')).to.equal('polite');

  polite.live = 'assertive';
  await polite.updateComplete;
  expect(log.getAttribute('aria-live')).to.equal('assertive');

  polite.live = 'off';
  await polite.updateComplete;
  expect(log.getAttribute('aria-live')).to.equal('off');
});

it('forwards a host aria-label to the role="log" element, winning over the label property', async () => {
  const el = (await fixture(
    html`<lr-chat-viewport aria-label="Team thread" label="Support thread"></lr-chat-viewport>`,
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
      html`<lr-chat-viewport dir=${dirAttr} style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
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
      html`<lr-chat-viewport style="block-size:120px" unread-start-index="0"
        >${[1, 2, 3].map((n) => row(`m${n}`))}</lr-chat-viewport
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

  it('releases follow on a user wheel scroll-up past bottomThreshold, and fires lr-follow-change', async () => {
    const el = (await fixture(
      html`<lr-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
      >`,
    )) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;
    expect(scroll.scrollTop + scroll.clientHeight).to.be.closeTo(scroll.scrollHeight, 1);

    const eventPromise = oneEvent(el, 'lr-follow-change');
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
        html`<lr-chat-viewport style="block-size:100px" bottom-threshold=${bottomThreshold}
          >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
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
      html`<lr-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
      >`,
    )) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;

    let fired = false;
    el.addEventListener('lr-follow-change', () => (fired = true));
    // A scroll event with no preceding wheel/touch/keydown/pointerdown intent gesture -- e.g. the
    // component's own scrollTo() call settling, or a layout shift.
    scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
    await nextFrame();
    expect(fired).to.be.false;
    expect(el.follow).to.be.true;
  });

  it('re-engages follow once scroll naturally reaches the bottom again', async () => {
    const el = (await fixture(
      html`<lr-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
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

    const eventPromise = oneEvent(el, 'lr-follow-change');
    scroll.scrollTop = scroll.scrollHeight - scroll.clientHeight;
    scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
    const ev = await eventPromise;
    expect(ev.detail).to.deep.equal({ following: true });
    expect(el.follow).to.be.true;
  });

  it('never fires lr-follow-change for the initial mount state', async () => {
    const el = (await fixture(html`<lr-chat-viewport></lr-chat-viewport>`)) as LyraChatViewport;
    let fired = false;
    el.addEventListener('lr-follow-change', () => (fired = true));
    await el.updateComplete;
    await nextFrame();
    expect(fired).to.be.false;
  });

  it('clears scrollbarDragActive on a pointerup outside the scroll part, so a later layout-shift scroll away from the bottom does not spuriously release follow', async () => {
    const el = (await fixture(
      html`<lr-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
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
    el.addEventListener('lr-follow-change', () => (fired = true));
    // A layout shift moves the scroll position away from the bottom with no wheel/touch/keydown
    // gesture, and -- assuming the drag above actually ended -- no active scrollbar drag either.
    scroll.scrollTop = 0;
    scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
    expect(fired, 'a stuck scrollbarDragActive flag would misattribute this as a user release').to.be.false;
    expect(el.follow).to.be.true;
  });

  for (const releaseEventType of ['pointercancel', 'lostpointercapture']) {
    it(`clears scrollbarDragActive on a ${releaseEventType} (drag interrupted without a pointerup), so a later layout-shift scroll away from the bottom does not spuriously release follow`, async () => {
      const el = (await fixture(
        html`<lr-chat-viewport style="block-size:100px"
          >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
        >`,
      )) as LyraChatViewport;
      await el.updateComplete;
      await nextFrame();
      const scroll = el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement;

      // A scrollbar-drag start interrupted by a system gesture (pointercancel) or a loss of
      // implicit pointer capture (lostpointercapture) -- neither is a pointerup, so a listener
      // that only tears down on pointerup would never see this and would leave the flag stuck.
      scroll.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      window.dispatchEvent(new PointerEvent(releaseEventType));

      let fired = false;
      el.addEventListener('lr-follow-change', () => (fired = true));
      scroll.scrollTop = 0;
      scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
      expect(fired, 'a stuck scrollbarDragActive flag would misattribute this as a user release').to.be.false;
      expect(el.follow).to.be.true;
    });
  }
});

describe('scrollToBottom()', () => {
  it('scrolls to the end and re-engages a released follow', async () => {
    const el = (await fixture(
      html`<lr-chat-viewport style="block-size:100px" follow="false"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
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
        html`<lr-chat-viewport style="block-size:100px"
          >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
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
      html`<lr-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
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
      html`<lr-chat-viewport style="block-size:100px" unread-start-index="8"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
      >`,
    )) as LyraChatViewport;
    el.follow = false;
    await el.updateComplete;
    const pill = el.shadowRoot!.querySelector('[part="jump-pill"]')!;
    expect(pill.textContent).to.include('2'); // 10 total - 8 unread-start = 2 new
  });

  it('activating the pill calls scrollToBottom()', async () => {
    const el = (await fixture(
      html`<lr-chat-viewport style="block-size:100px"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
      >`,
    )) as LyraChatViewport;
    el.follow = false;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="jump-pill"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.follow).to.be.true;
  });

  it('gives jump-pill a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='jump-pill'\]:hover/);
  });
});

describe('unread divider (slotted mode)', () => {
  it('positions the divider above the child at unreadStartIndex', async () => {
    const el = (await fixture(
      html`<lr-chat-viewport style="block-size:200px" unread-start-index="2"
        >${Array.from({ length: 5 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
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
      html`<lr-chat-viewport style="block-size:200px"
        >${Array.from({ length: 5 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
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
      html`<lr-chat-viewport style="block-size:200px" unread-start-index="-3"
        >${Array.from({ length: 5 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
      >`,
    )) as LyraChatViewport;
    await negative.updateComplete;
    await nextFrame();
    const negativeDivider = negative.shadowRoot!.querySelector('[part="unread-divider"]') as HTMLElement;
    expect(negativeDivider, 'a negative index must clamp to 0, not silently disable the divider').to.exist;
    expect(parseFloat(negativeDivider.style.top)).to.equal(0);

    const nonFinite = (await fixture(
      html`<lr-chat-viewport style="block-size:200px" unread-start-index="not-a-number"
        >${Array.from({ length: 5 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
      >`,
    )) as LyraChatViewport;
    await nonFinite.updateComplete;
    await nextFrame();
    expect(nonFinite.shadowRoot!.querySelector('[part="unread-divider"]'), 'NaN must clamp the same way as a negative index')
      .to.exist;
  });

  it('scrollToUnread scrolls to the divider and returns true; false when unreadStartIndex is null', async () => {
    const el = (await fixture(
      html`<lr-chat-viewport style="block-size:100px" unread-start-index="8"
        >${Array.from({ length: 10 }, (_, i) => row(`m${i}`))}</lr-chat-viewport
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
      html`<lr-chat-viewport style="block-size:100px"
        >${row('only')}</lr-chat-viewport
      >`,
    )) as LyraChatViewport;
    expect(noUnread.scrollToUnread()).to.be.false;
  });
});

describe('virtual mode', () => {
  function virtualFixtureMarkup(itemCount: number) {
    return html`
      <lr-chat-viewport style="block-size:120px">
        <lr-virtual-list
          style="--lr-virtual-list-height:120px"
          row-height="40"
          .items=${Array.from({ length: itemCount }, (_, i) => i)}
          .renderItem=${(item: unknown) => html`row ${item}`}
          .keyFunction=${(item: unknown) => item as number}
        ></lr-virtual-list>
      </lr-chat-viewport>
    `;
  }

  // No `--lr-virtual-list-height` override anywhere: this is the consumer-CSS-free shape the
  // sizing fix is about. Every other fixture in this describe block deliberately keeps its own
  // inline override, which must keep winning (a document-tree inline style beats a ::slotted()
  // declaration from this component's shadow tree).
  function unsizedVirtualFixtureMarkup(itemCount: number, hostStyle: string) {
    return html`
      <div style=${hostStyle}>
        <lr-chat-viewport>
          <lr-virtual-list
            row-height="40"
            .items=${Array.from({ length: itemCount }, (_, i) => i)}
            .renderItem=${(item: unknown) => html`row ${item}`}
            .keyFunction=${(item: unknown) => item as number}
          ></lr-virtual-list>
        </lr-chat-viewport>
      </div>
    `;
  }

  // Regression guard for a latent styling bug found while fixing the sizing: virtual mode's layout
  // rules were written as `:host(:has(> lr-virtual-list))`, and `:has()` is invalid inside
  // `:host()` (Chromium reports `CSS.supports('selector(:host(:has(> em)))')` as false), so the
  // whole rule was dropped -- [part="scroll"] kept its own padding and overflow in virtual mode
  // and [part="content"] never got a resolvable height for the list to size against.
  it('hands scrolling to the slotted list: [part="scroll"] stops scrolling and drops its padding', async () => {
    const el = (await fixture(virtualFixtureMarkup(20))) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const scroll = getComputedStyle(el.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement);
    expect(scroll.overflowY).to.equal('visible');
    expect(scroll.paddingTop).to.equal('0px');

    const slotted = (await fixture(
      html`<lr-chat-viewport style="block-size:120px">${row('only')}</lr-chat-viewport>`,
    )) as LyraChatViewport;
    await slotted.updateComplete;
    await nextFrame();
    const slottedScroll = getComputedStyle(slotted.shadowRoot!.querySelector('[part="scroll"]') as HTMLElement);
    expect(slottedScroll.overflowY).to.equal('auto');
    expect(parseFloat(slottedScroll.paddingTop)).to.be.greaterThan(0);
  });

  it('sizes the slotted list to the full bounded viewport with no consumer CSS', async () => {
    const wrapper = await fixture(
      unsizedVirtualFixtureMarkup(60, 'block-size:700px; display:flex; flex-direction:column;'),
    );
    const el = wrapper.querySelector('lr-chat-viewport') as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const list = el.querySelector('lr-virtual-list') as LyraVirtualList;
    const base = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getBoundingClientRect().height).to.be.closeTo(700, 1);
    expect(base.scrollHeight).to.be.greaterThan(base.clientHeight);
  });

  it('does not collapse the slotted list to zero height in an auto-height container', async () => {
    const wrapper = await fixture(unsizedVirtualFixtureMarkup(60, 'display:flex; flex-direction:column;'));
    const el = wrapper.querySelector('lr-chat-viewport') as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const list = el.querySelector('lr-virtual-list') as LyraVirtualList;
    const base = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getBoundingClientRect().height).to.be.greaterThan(0);
  });

  it('lets a consumer-set --lr-virtual-list-height keep winning', async () => {
    const el = (await fixture(virtualFixtureMarkup(20))) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const list = el.querySelector('lr-virtual-list') as LyraVirtualList;
    const base = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getBoundingClientRect().height).to.be.closeTo(120, 1);
  });

  it('detects a single slotted lr-virtual-list and defers scrolling to it', async () => {
    const el = (await fixture(virtualFixtureMarkup(20))) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const list = el.querySelector('lr-virtual-list') as LyraVirtualList;
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
    const list = el.querySelector('lr-virtual-list') as LyraVirtualList;
    const base = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    base.dispatchEvent(new WheelEvent('wheel', { bubbles: true, composed: true }));
    base.scrollTop = 0;
    base.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(el.follow).to.be.false;

    const eventPromise = oneEvent(el, 'lr-follow-change');
    base.scrollTop = base.scrollHeight - base.clientHeight;
    base.dispatchEvent(new Event('scroll'));
    const ev = await eventPromise;
    expect(ev.detail).to.deep.equal({ following: true });
  });

  it('does not misattribute a later append as user-caused after a wheel gesture that changed no visible range settles', async () => {
    const el = (await fixture(virtualFixtureMarkup(20))) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const list = el.querySelector('lr-virtual-list') as LyraVirtualList;
    const base = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    // A wheel-down gesture at the bottom that moves nothing: no scroll event follows, so nothing
    // ever consumes the pending user-intent flag it set -- it must expire on its own instead.
    base.dispatchEvent(new WheelEvent('wheel', { bubbles: true, composed: true }));
    // Longer than the frame-based expiry markUserIntent() schedules, well under any realistic gap
    // to an unrelated later event.
    await nextFrame();
    await nextFrame();

    let fired = false;
    el.addEventListener('lr-follow-change', () => (fired = true));
    // Simulates the range event a later, unrelated append produces while not at the bottom --
    // never actually user-caused.
    list.dispatchEvent(new CustomEvent('lr-visible-range-changed', { detail: { start: 10, end: 18 } }));
    expect(fired, 'a stuck pendingUserIntent would misattribute this as a user release').to.be.false;
    expect(el.follow).to.be.true;
  });

  it('does not misattribute a same-burst streamed append as user-caused after a wheel gesture that changed nothing', async () => {
    const el = (await fixture(virtualFixtureMarkup(20))) as LyraChatViewport;
    await el.updateComplete;
    await nextFrame();
    const list = el.querySelector('lr-virtual-list') as LyraVirtualList;
    const base = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    // A wheel-down gesture at the bottom that moves nothing.
    base.dispatchEvent(new WheelEvent('wheel', { bubbles: true, composed: true }));
    // A realistic streamed-token append cadence: far sooner than a wall-clock timeout could ever
    // safely expire on (active token streaming fires range-changed events much more often than
    // once every few hundred milliseconds), but well after the gesture's own settle window, so a
    // fix that proactively clears a no-op gesture's intent (rather than waiting out a generous
    // fixed timeout) must not misattribute this.
    await new Promise<void>((r) => setTimeout(r, 50));

    let fired = false;
    el.addEventListener('lr-follow-change', () => (fired = true));
    list.dispatchEvent(new CustomEvent('lr-visible-range-changed', { detail: { start: 10, end: 18 } }));
    expect(fired, 'a same-burst append must not be misattributed as a user release').to.be.false;
    expect(el.follow).to.be.true;
  });
});

it('is accessible in slotted mode with an unread divider and a released follow', async () => {
  const el = (await fixture(
    html`<lr-chat-viewport style="block-size:100px" unread-start-index="1" follow="false"
      >${row('m0')}${row('m1')}${row('m2')}</lr-chat-viewport
    >`,
  )) as LyraChatViewport;
  el.follow = false;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible populated with real chat messages, an unread divider, and a failed message', async () => {
  // Populated-state axe check: a realistic chat surface — actual `<lr-chat-message>`
  // children (with timestamps, a failed status, and its retry button) plus the unread
  // divider — renders a11y surface that plain placeholder rows never exercise. axe
  // traverses into each message's shadow root, so this covers the composed tree. Assert
  // the populated markers rendered before running axe.
  const el = (await fixture(
    html`<lr-chat-viewport style="block-size:120px" unread-start-index="1" follow="false">
      <lr-chat-message data-role="user" .timestamp=${new Date('2024-05-01T10:00:00Z')}
        >Hello there</lr-chat-message
      >
      <lr-chat-message data-role="assistant" .timestamp=${new Date('2024-05-01T10:00:05Z')}
        >Hi! How can I help?</lr-chat-message
      >
      <lr-chat-message data-role="user" status="failed">Did this send?</lr-chat-message>
    </lr-chat-viewport>`,
  )) as LyraChatViewport;
  el.follow = false;
  await el.updateComplete;
  await nextFrame();
  expect(el.shadowRoot!.querySelector('[part="unread-divider"]')).to.exist;
  const failed = el.querySelector('lr-chat-message[status="failed"]')!;
  expect(failed.shadowRoot!.querySelector('[part="retry-button"]')).to.exist;
  await expect(el).to.be.accessible();
});

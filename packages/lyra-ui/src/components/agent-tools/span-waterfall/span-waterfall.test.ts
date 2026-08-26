import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './span-waterfall.js';
import type { LyraSpanWaterfall } from './span-waterfall.js';
import type { LyraSpan } from '../trace-tree/span.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

const SPANS: LyraSpan[] = [
  { id: 'root', name: 'Plan trip', kind: 'agent', startMs: 0, endMs: 400, status: 'success' },
  { id: 'search', parentId: 'root', name: 'web_search', kind: 'tool', startMs: 10, endMs: 120, status: 'success' },
  { id: 'llm', parentId: 'root', name: 'gpt-turbo', kind: 'llm', startMs: 130, endMs: 390, status: 'running' },
];

const motionMatchMedia = (matches: boolean): typeof window.matchMedia =>
  ((query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }) satisfies MediaQueryList);

describe('lr-span-waterfall', () => {
  it('renders one row per span in start order, regardless of hierarchy', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')].map((b) => b.getAttribute('data-id'));
    expect(bars).to.deep.equal(['root', 'search', 'llm']);
  });

  it('positions each bar from the shared time scale using inline-start/inline-size', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(bar.style.insetInlineStart).to.equal('2.5%');
    expect(bar.style.inlineSize).to.equal('27.5%');
  });

  it('clips bars to viewStartMs/viewEndMs when set', async () => {
    const el = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} .viewStartMs=${100} .viewEndMs=${300}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(bar.style.insetInlineStart).to.equal('0%');
  });

  it('normalizes a NaN viewStartMs/viewEndMs the same as unset (fits the whole trace)', async () => {
    const baseline = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} .viewStartMs=${0} .viewEndMs=${400}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await baseline.updateComplete;
    const expectedStart = (baseline.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement).style
      .insetInlineStart;

    const el = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} .viewStartMs=${NaN} .viewEndMs=${NaN}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(bar.style.insetInlineStart).to.not.include('NaN');
    expect(bar.style.insetInlineStart).to.equal(expectedStart);
  });

  it('clamps a negative viewStartMs to 0 (trace-relative ms is never negative)', async () => {
    const el = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} .viewStartMs=${-50} .viewEndMs=${400}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    // root spans startMs=0..endMs=400 -- the same as the clamped [0, 400] view window, so it
    // should fill the bar track completely.
    const bar = el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement;
    expect(bar.style.insetInlineStart).to.equal('0%');
    expect(bar.style.inlineSize).to.equal('100%');
  });

  it('widens an inverted/degenerate view window (viewEndMs <= viewStartMs) to a minimal span instead of a negative-width window', async () => {
    const el = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} .viewStartMs=${300} .viewEndMs=${100}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as HTMLElement[];
    expect(bars.length).to.be.greaterThan(0);
    for (const bar of bars) {
      expect(bar.style.inlineSize).to.not.include('NaN');
      expect(bar.style.inlineSize).to.not.include('-');
      expect(bar.style.insetInlineStart).to.not.include('NaN');
    }
  });

  it('emits lr-span-select on bar click and on Enter', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement;
    setTimeout(() => bar.click());
    const ev = await oneEvent(el, 'lr-span-select');
    expect(ev.detail).to.deep.equal({ spanId: 'llm' });

    const keyboardSelection = oneEvent(el, 'lr-span-select');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    expect((await keyboardSelection).detail).to.deep.equal({ spanId: 'llm' });
  });

  it('tints bar on hover, and further again while pressed', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const centre: [number, number] = [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
    // The tint lives on a ::after veil rather than the bar's own background, because a bar's fill is
    // one of five different things (four solid tones, a striped gradient, a transparent dashed box)
    // and no single background declaration tints all of them.
    const veil = (): string => getComputedStyle(bar, '::after').backgroundColor;
    const rest = veil();
    try {
      await sendMouse({ type: 'move', position: centre });
      const hovered = veil();
      await sendMouse({ type: 'down' });
      const pressed = veil();
      await sendMouse({ type: 'up' });
      expect(hovered, 'hover must move the veil off its resting colour').to.not.equal(rest);
      expect(pressed, 'pressed must be visibly stronger than hover, not identical to it').to.not.equal(
        hovered,
      );
      expect(pressed).to.not.equal(rest);
    } finally {
      await resetMouse();
    }
  });

  it('moves roving tabindex among bars with ArrowDown/ArrowUp', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const first = el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement;
    expect(first.getAttribute('tabindex')).to.equal('0');
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    await el.updateComplete;
    const second = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(second.getAttribute('tabindex')).to.equal('0');
    expect(first.getAttribute('tabindex')).to.equal('-1');

    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(first.getAttribute('tabindex')).to.equal('0');
    expect(second.getAttribute('tabindex')).to.equal('-1');

    const unrelated = new KeyboardEvent('keydown', {
      key: 'F2',
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    base.dispatchEvent(unrelated);
    expect(unrelated.defaultPrevented).to.equal(false);
  });

  it('repairs roving focus when a changed view hides the first sorted span', async () => {
    const spans: LyraSpan[] = [
      { id: 'early', name: 'Early', kind: 'tool', startMs: 0, endMs: 10, status: 'success' },
      { id: 'visible', name: 'Visible', kind: 'tool', startMs: 100, endMs: 120, status: 'success' },
    ];
    const el = (await fixture(html`
      <lr-span-waterfall .spans=${spans} .viewStartMs=${0} .viewEndMs=${120}></lr-span-waterfall>
    `)) as LyraSpanWaterfall;
    expect(el.shadowRoot!.querySelector('[data-id="early"]')!.getAttribute('tabindex')).to.equal('0');

    el.viewStartMs = 100;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[data-id="visible"]')!.getAttribute('tabindex')).to.equal('0');
    expect(el.shadowRoot!.querySelector('[data-id="early"]')!.getAttribute('tabindex')).to.equal('-1');
  });

  it('keeps even a tiny-duration bar at or above the 24px WCAG 2.5.8 floor in both axes', async () => {
    const spans: LyraSpan[] = [
      { id: 'tiny', name: 'Tiny span', kind: 'tool', startMs: 10, endMs: 11, status: 'success' },
    ];
    const el = (await fixture(html`
      <lr-span-waterfall
        style="inline-size: 320px"
        .spans=${spans}
        .viewStartMs=${0}
        .viewEndMs=${10_000}
      ></lr-span-waterfall>
    `)) as LyraSpanWaterfall;
    await el.updateComplete;
    const bars = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="bar"]')];
    expect(bars.length).to.be.greaterThan(0);
    for (const bar of bars) {
      const rect = bar.getBoundingClientRect();
      expect(rect.width, `${bar.dataset['id'] ?? ''} width`).to.be.at.least(24);
      expect(rect.height, `${bar.dataset['id'] ?? ''} height`).to.be.at.least(24);
    }
  });

  it('marks the bar matching activeSpanId with aria-current', async () => {
    const el = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} active-span-id="llm"></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement;
    expect(bar.getAttribute('aria-current')).to.equal('true');
    const inactive = el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement;
    expect(inactive.getAttribute('aria-current')).to.equal('false');
  });

  it('uses adopted owner motion/CSS realms and falls back to an exact id scan without owner CSS.escape', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const ownerDocument = frame.contentDocument!;
    const ownerWindow = frame.contentWindow!;
    const originalTopMatchMedia = window.matchMedia;
    const originalOwnerMatchMedia = ownerWindow.matchMedia;
    const originalTopEscape = window.CSS.escape;
    const originalOwnerEscape = ownerWindow.CSS.escape;
    const specialId = 'span\" ] owner';
    const secondSpecialId = 'span two\" ] owner';
    const el = document.createElement('lr-span-waterfall') as LyraSpanWaterfall;
    try {
      window.matchMedia = motionMatchMedia(false);
      ownerWindow.matchMedia = motionMatchMedia(true);
      window.CSS.escape = () => {
        throw new Error('ambient CSS.escape must not be used');
      };
      el.spans = [
        { ...SPANS[0]!, id: specialId },
        { ...SPANS[1]!, id: secondSpecialId },
      ];
      document.body.append(el);
      await el.updateComplete;
      ownerDocument.body.append(ownerDocument.adoptNode(el));
      await el.updateComplete;

      let behavior: ScrollBehavior | undefined;
      const bar = el.shadowRoot!.querySelector('[part="bar"]') as HTMLElement;
      bar.scrollIntoView = ((options?: ScrollIntoViewOptions) => {
        behavior = options?.behavior;
      }) as typeof bar.scrollIntoView;
      el.activeSpanId = specialId;
      await el.updateComplete;
      expect(behavior).to.equal('auto');

      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      base.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
      await el.updateComplete;
      expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['id']).to.equal(secondSpecialId);

      el.activeSpanId = '';
      await el.updateComplete;
      (ownerWindow.CSS as unknown as { escape?: typeof CSS.escape }).escape = undefined;
      behavior = undefined;
      el.activeSpanId = specialId;
      await el.updateComplete;
      expect(behavior).to.equal('auto');
    } finally {
      el.remove();
      window.matchMedia = originalTopMatchMedia;
      ownerWindow.matchMedia = originalOwnerMatchMedia;
      window.CSS.escape = originalTopEscape;
      ownerWindow.CSS.escape = originalOwnerEscape;
      frame.remove();
    }
  });

  it('hides the axis when hide-axis is set', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS} hide-axis></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="axis"]')) == null).to.be.true;
  });

  it('keeps the terminal axis label inside a 256px allocation', async () => {
    const container = document.createElement('div');
    container.style.inlineSize = '256px';
    const el = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`,
      { parentNode: container },
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    const axis = el.shadowRoot!.querySelector<HTMLElement>('[part="axis"]')!;
    const labels = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="tick-label"]')];
    const terminal = labels[labels.length - 1]!;
    const axisRect = axis.getBoundingClientRect();
    const labelRect = terminal.getBoundingClientRect();
    expect(labelRect.right).to.be.at.most(axisRect.right + 1);
    expect(labelRect.left).to.be.at.least(axisRect.left - 1);
  });

  it('renders lr-empty when spans is empty', async () => {
    const el = (await fixture(html`<lr-span-waterfall></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
  });

  it('registers lr-live-region and lr-empty as a side effect of importing span-waterfall.js (regression)', async () => {
    // Importing the *.class.js module alone never calls defineElement -- only the barrel (*.js)
    // does. Rendering an un-registered dependency silently produces a plain, un-upgraded
    // HTMLElement instead of the real component.
    expect(customElements.get('lr-live-region')).to.exist;
    expect(customElements.get('lr-empty')).to.exist;
  });

  it('falls back to the built-in English label and honors a strings override', async () => {
    const el = (await fixture(html`<lr-span-waterfall></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Span timeline');
    el.strings = { spanWaterfall: 'Ligne du temps' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Ligne du temps');
  });

  it('reverses the running-bar stripe crawl under dir="rtl"', async () => {
    const ltr = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await ltr.updateComplete;
    const ltrBar = ltr.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement; // running -> accent
    expect(getComputedStyle(ltrBar).animationDirection).to.equal('normal');

    // background-position keyframes are physical, so the RTL variant plays the same stripe
    // animation backwards instead of always crawling in the LTR direction.
    const rtl = (await fixture(
      html`<lr-span-waterfall dir="rtl" .spans=${SPANS}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await rtl.updateComplete;
    const rtlBar = rtl.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement;
    expect(getComputedStyle(rtlBar).animationDirection).to.equal('reverse');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('keeps the truncation note outside the owned role=list children and passes axe when populated past the limit', async () => {
    const spans: LyraSpan[] = Array.from({ length: 501 }, (_, index) => ({
      id: `span-${index}`,
      name: `Span ${index}`,
      kind: 'tool',
      startMs: index,
      endMs: index + 1,
      status: 'success',
    }));
    const el = await fixture<LyraSpanWaterfall>(html`
      <lr-span-waterfall .spans=${spans}></lr-span-waterfall>
    `);
    const list = el.shadowRoot!.querySelector('[role="list"]')!;
    const limit = el.shadowRoot!.querySelector('[part="limit"]')!;
    expect(limit.parentElement === list).to.equal(false);
    await expect(el).to.be.accessible();
  });

  it('honors a programmatic accessibleLabel binding on the owned list', async () => {
    const el = await fixture<LyraSpanWaterfall>(html`
      <lr-span-waterfall .accessibleLabel=${'Deployment trace'}></lr-span-waterfall>
    `);
    expect(el.shadowRoot!.querySelector('[role="list"]')!.getAttribute('aria-label')).to.equal('Deployment trace');
  });

  describe('--lr-span-waterfall-row-active-bg', () => {
    const activeFixture = async (): Promise<LyraSpanWaterfall> => {
      const el = (await fixture(
        html`<lr-span-waterfall .spans=${SPANS} .activeSpanId=${'root'}></lr-span-waterfall>`,
      )) as LyraSpanWaterfall;
      await el.updateComplete;
      return el;
    };

    it('retints only the active row via the cssprop', async () => {
      const el = await activeFixture();
      el.style.setProperty('--lr-span-waterfall-row-active-bg', 'rgb(10, 20, 30)');
      const active = el.shadowRoot!.querySelector('[part="row"][data-active]') as HTMLElement;
      const inactive = el.shadowRoot!.querySelector('[part="row"]:not([data-active])') as HTMLElement;
      expect((active) != null).to.equal(true);
      expect(getComputedStyle(active).backgroundColor).to.equal('rgb(10, 20, 30)');
      expect(getComputedStyle(inactive).backgroundColor).to.not.equal('rgb(10, 20, 30)');
    });

    it('renders byte-identically to the brand-quiet token default when unset', async () => {
      const el = await activeFixture();
      const active = el.shadowRoot!.querySelector('[part="row"][data-active]') as HTMLElement;
      const unset = getComputedStyle(active).backgroundColor;
      el.style.setProperty('--lr-span-waterfall-row-active-bg', 'var(--lr-color-brand-quiet)');
      expect(getComputedStyle(active).backgroundColor).to.equal(unset);
    });

    it('is accessible with an active row', async () => {
      const el = await activeFixture();
      await expect(el).to.be.accessible();
    });
  });

  it('exposes component-scoped hooks for every status bar tone', async () => {
    const statusSpans: LyraSpan[] = [
      { id: 'ok', name: 'ok', kind: 'tool', status: 'success', startMs: 0, endMs: 1 },
      { id: 'bad', name: 'bad', kind: 'tool', status: 'error', startMs: 1, endMs: 2 },
      { id: 'deny', name: 'deny', kind: 'tool', status: 'denied', startMs: 2, endMs: 3 },
      { id: 'wait', name: 'wait', kind: 'tool', status: 'pending', startMs: 3, endMs: 4 },
    ];
    const el = (await fixture(html`
      <lr-span-waterfall
        style="
          --lr-span-waterfall-success-color: rgb(1, 2, 3);
          --lr-span-waterfall-error-color: rgb(4, 5, 6);
          --lr-span-waterfall-denied-color: rgb(7, 8, 9);
          --lr-span-waterfall-pending-border-color: rgb(10, 11, 12);
        "
        .spans=${statusSpans}
      ></lr-span-waterfall>
    `)) as LyraSpanWaterfall;
    expect(getComputedStyle(el.shadowRoot!.querySelector('[data-id="ok"]')!).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(el.shadowRoot!.querySelector('[data-id="bad"]')!).backgroundColor).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(el.shadowRoot!.querySelector('[data-id="deny"]')!).backgroundColor).to.equal('rgb(7, 8, 9)');
    expect(getComputedStyle(el.shadowRoot!.querySelector('[data-id="wait"]' )!).borderTopColor).to.equal(
      'rgb(10, 11, 12)',
    );
  });
});

it('drops invalid span timestamps before they can poison otherwise valid geometry', async () => {
  const el = (await fixture(html`
    <lr-span-waterfall
      .spans=${[
        { id: 'valid', name: 'Valid', kind: 'tool', status: 'success', startMs: 0, endMs: 10 },
        { id: 'invalid', name: 'Invalid', kind: 'tool', status: 'error', startMs: Number.NaN, endMs: Infinity },
      ]}
    ></lr-span-waterfall>
  `)) as LyraSpanWaterfall;
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(1);
  expect(el.shadowRoot!.innerHTML).to.not.include('NaN');
  expect(el.shadowRoot!.innerHTML).to.not.include('Infinity');
});

it('normalizes foreign runtime enum values before rendering and focusing a span', async () => {
  const el = (await fixture(html`
    <lr-span-waterfall
      .spans=${[
        {
          id: 'foreign',
          name: 'Foreign enum',
          kind: 99,
          status: 42,
          startMs: 0,
          endMs: 10,
        } as unknown as LyraSpan,
      ]}
    ></lr-span-waterfall>
  `)) as LyraSpanWaterfall;
  const bar = el.shadowRoot!.querySelector('[data-id="foreign"]') as HTMLButtonElement;
  const status = el.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement;

  expect(bar.getAttribute('data-tone')).to.equal('neutral');
  expect(bar.getAttribute('data-status')).to.equal('pending');
  expect(bar.getAttribute('aria-label')).to.include('Other');
  expect(status.getAttribute('data-status')).to.equal('pending');
  expect(status.textContent).to.equal('Pending');

  const live = el.shadowRoot!.querySelector('lr-live-region')!;
  live.throttleMs = 0;
  await live.updateComplete;
  (el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(live.shadowRoot!.textContent).to.include('Pending');
});

it('keeps a tabbable row when activeSpanId is dangling', async () => {
  const el = (await fixture(html`
    <lr-span-waterfall
      active-span-id="missing"
      .spans=${[{ id: 'valid', name: 'Valid', kind: 'tool', status: 'success', startMs: 0, endMs: 10 }]}
    ></lr-span-waterfall>
  `)) as LyraSpanWaterfall;
  expect(el.shadowRoot!.querySelectorAll('[part="bar"][tabindex="0"]').length).to.equal(1);
});

it('keeps a rendered bar tabbable when activeSpanId names a raw span filtered out by invalid geometry', async () => {
  const el = (await fixture(html`
    <lr-span-waterfall
      active-span-id="invalid"
      .spans=${[
        { id: 'invalid', name: 'Invalid', kind: 'tool', status: 'error', startMs: Number.NaN },
        { id: 'valid', name: 'Valid', kind: 'tool', status: 'success', startMs: 0, endMs: 10 },
      ]}
    ></lr-span-waterfall>
  `)) as LyraSpanWaterfall;
  expect(el.shadowRoot!.querySelectorAll('[part="bar"][tabindex="0"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="bar"][tabindex="0"]')!.getAttribute('data-id')).to.equal('valid');
});

it('deduplicates provider ids first-wins and bounds the shared projection with a visible notice', async () => {
  const duplicate = await fixture<LyraSpanWaterfall>(html`
    <lr-span-waterfall
      .spans=${[
        { id: 'same', name: 'first', kind: 'tool', status: 'success', startMs: 0, endMs: 1 },
        { id: 'same', name: 'second', kind: 'tool', status: 'error', startMs: 1, endMs: 2 },
      ]}
    ></lr-span-waterfall>
  `);
  expect(duplicate.shadowRoot!.querySelectorAll('[data-id="same"]')).to.have.length(1);
  expect(duplicate.shadowRoot!.querySelector('[part="name"]')!.textContent).to.equal('first');
  expect(duplicate.shadowRoot!.querySelectorAll('[part="bar"][tabindex="0"]')).to.have.length(1);

  const spans = Array.from({ length: 501 }, (_, index) => ({
    id: `span-${index}`,
    name: `Span ${index}`,
    kind: 'tool' as const,
    status: 'success' as const,
    startMs: index,
    endMs: index + 1,
  }));
  const bounded = await fixture<LyraSpanWaterfall>(html`
    <lr-span-waterfall
      .spans=${spans}
      .strings=${{ spanProjectionLimit: 'Showing at most {count} spans' }}
    ></lr-span-waterfall>
  `);
  expect(bounded.shadowRoot!.querySelectorAll('[part="row"]')).to.have.length(500);
  expect(bounded.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('Showing at most 500 spans');
});

it('announces when a live trace first crosses the bounded projection limit', async () => {
  const spans: LyraSpan[] = Array.from({ length: 501 }, (_, index) => ({
    id: `span-${index}`,
    name: `Span ${index}`,
    kind: 'tool',
    status: 'success',
    startMs: index,
    endMs: index + 1,
  }));
  const el = await fixture<LyraSpanWaterfall>(html`
    <lr-span-waterfall
      .spans=${spans.slice(0, 500)}
      .strings=${{ spanProjectionLimit: 'Limited to {count} trace spans' }}
    ></lr-span-waterfall>
  `);
  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
  expect(sink.childElementCount).to.equal(0);

  el.spans = spans;
  await el.updateComplete;

  expect(sink.lastElementChild?.textContent).to.equal('Limited to 500 trace spans');
});

it('reserves an active span beyond the shared 500-row projection boundary', async () => {
  const spans: LyraSpan[] = Array.from({ length: 501 }, (_, index) => ({
    id: `span-${index}`,
    name: `Span ${index}`,
    kind: 'tool',
    status: 'success',
    startMs: index,
    endMs: index + 1,
  }));
  const el = await fixture<LyraSpanWaterfall>(html`
    <lr-span-waterfall .spans=${spans} .activeSpanId=${'span-500'}></lr-span-waterfall>
  `);

  expect(el.shadowRoot!.querySelectorAll('[part="row"]')).to.have.length(500);
  expect(el.shadowRoot!.querySelector('[data-id="span-500"]')?.getAttribute('aria-current')).to.equal('true');
});

it('keeps wholly out-of-window bars hidden and moves the roving stop to a visible bar', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`
    <lr-span-waterfall
      view-start-ms="0"
      view-end-ms="50"
      .spans=${[
        { id: 'outside', name: 'Outside', kind: 'tool', status: 'success', startMs: 100, endMs: 110 },
        { id: 'inside', name: 'Inside', kind: 'tool', status: 'success', startMs: 10, endMs: 20 },
      ]}
    ></lr-span-waterfall>
  `);
  const outside = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-id="outside"]')!;
  const inside = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-id="inside"]')!;
  expect(outside.hidden).to.be.true;
  expect(outside.tabIndex).to.equal(-1);
  expect(getComputedStyle(outside).display).to.equal('none');
  expect(inside.hidden).to.be.false;
  expect(inside.tabIndex).to.equal(0);
});

it('renders a bounded finite axis at extreme finite public bounds', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`
    <lr-span-waterfall
      .viewStartMs=${Number.MAX_VALUE}
      .viewEndMs=${Number.MAX_VALUE}
      .spans=${[{ id: 'edge', name: 'Edge', kind: 'tool', status: 'success', startMs: Number.MAX_VALUE }]}
    ></lr-span-waterfall>
  `);
  const ticks = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="tick"]')];
  expect(ticks.length).to.be.at.most(8);
  expect(ticks.every((tick) => !tick.getAttribute('style')!.includes('Infinity'))).to.be.true;
});

it('aligns the ruler and bar track in wide, narrow, LTR, and RTL allocations', async () => {
  for (const [width, dir] of [[640, 'ltr'], [320, 'ltr'], [640, 'rtl'], [320, 'rtl']] as const) {
    const container = document.createElement('div');
    container.style.inlineSize = `${width}px`;
    container.dir = dir;
    const el = await fixture<LyraSpanWaterfall>(html`
      <lr-span-waterfall
        .spans=${[{ id: `${width}-${dir}`, name: 'Span', kind: 'tool', status: 'success', startMs: 0, endMs: 10 }]}
      ></lr-span-waterfall>
    `, { parentNode: container });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const axis = el.shadowRoot!.querySelector<HTMLElement>('[part="axis"]')!.getBoundingClientRect();
    const track = el.shadowRoot!.querySelector<HTMLElement>('[part="bar-track"]')!.getBoundingClientRect();
    const delta = dir === 'rtl' ? Math.abs(axis.right - track.right) : Math.abs(axis.left - track.left);
    expect(delta, `${width}px ${dir}`).to.be.lessThan(1);
  }
});

it('formats durations with the effective locale', async () => {
  const el = (await fixture(html`
    <lr-span-waterfall
      lang="de-DE"
      hide-axis
      .spans=${[{ id: 'valid', name: 'Valid', kind: 'tool', status: 'success', startMs: 0, endMs: 2500 }]}
    ></lr-span-waterfall>
  `)) as LyraSpanWaterfall;
  expect(el.shadowRoot!.querySelector('[part="duration"]')!.textContent).to.equal('2,5 Sek.');
});

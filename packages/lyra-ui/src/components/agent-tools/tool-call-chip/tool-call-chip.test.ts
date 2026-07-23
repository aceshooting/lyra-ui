import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tool-call-chip.js';
import type { LyraToolCallChip } from './tool-call-chip.js';
import { styles } from './tool-call-chip.styles.js';

it('defaults to status="pending" with empty name/category/summary/icon/call-id and no duration', async () => {
  const el = (await fixture(html`<lr-tool-call-chip></lr-tool-call-chip>`)) as LyraToolCallChip;
  expect(el.status).to.equal('pending');
  expect(el.getAttribute('status')).to.equal('pending');
  expect(el.name).to.equal('');
  expect(el.category).to.equal('');
  expect(el.summary).to.equal('');
  expect(el.icon).to.equal('');
  expect(el.callId).to.equal('');
  expect(el.durationMs).to.be.undefined;
});

it('reflects status changes onto the host attribute', async () => {
  const el = (await fixture(html`<lr-tool-call-chip></lr-tool-call-chip>`)) as LyraToolCallChip;
  el.status = 'error';
  await el.updateComplete;
  expect(el.getAttribute('status')).to.equal('error');
});

it('formats fractional duration numbers with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-tool-call-chip lang="de-DE" duration-ms="1500"></lr-tool-call-chip>`,
  )) as LyraToolCallChip;
  expect(el.shadowRoot!.querySelector('[part="duration"]')!.textContent!.trim()).to.equal('1,5s');
});

it('is a real <button type="button"> — Enter/Space activation is native, no custom keydown handler needed', async () => {
  const el = (await fixture(html`<lr-tool-call-chip name="web_search"></lr-tool-call-chip>`)) as LyraToolCallChip;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  expect(base.tagName).to.equal('BUTTON');
  expect(base.type).to.equal('button');
});

it('renders the tool name, falling back to "Tool call" when unset', async () => {
  const withName = (await fixture(html`<lr-tool-call-chip name="web_search"></lr-tool-call-chip>`)) as LyraToolCallChip;
  expect(withName.shadowRoot!.querySelector('[part="name"]')!.textContent).to.equal('web_search');

  const withoutName = (await fixture(html`<lr-tool-call-chip></lr-tool-call-chip>`)) as LyraToolCallChip;
  expect(withoutName.shadowRoot!.querySelector('[part="name"]')!.textContent).to.equal('Tool call');
});

it('hides the category and summary parts when unset, shows them when set', async () => {
  const el = (await fixture(html`<lr-tool-call-chip name="web_search"></lr-tool-call-chip>`)) as LyraToolCallChip;
  const category = el.shadowRoot!.querySelector('[part="category"]') as HTMLElement;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  expect(category.hidden).to.be.true;
  expect(summary.hidden).to.be.true;

  el.category = 'research';
  el.summary = 'Searching web…';
  await el.updateComplete;
  expect(category.hidden).to.be.false;
  expect(category.textContent).to.equal('research');
  expect(summary.hidden).to.be.false;
  expect(summary.textContent).to.equal('Searching web…');
});

it('shows a visible status label for every status value, not just a color', async () => {
  const statuses = ['pending', 'running', 'success', 'error', 'denied'] as const;
  const labels = ['Pending', 'Running', 'Success', 'Error', 'Denied'];
  for (let i = 0; i < statuses.length; i++) {
    const el = (await fixture(
      html`<lr-tool-call-chip status=${statuses[i]}></lr-tool-call-chip>`,
    )) as LyraToolCallChip;
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal(labels[i]);
  }
});

it('falls back to pending for an out-of-union status attribute', async () => {
  const el = (await fixture(
    html`<lr-tool-call-chip name="web_search" status="bogus"></lr-tool-call-chip>`,
  )) as LyraToolCallChip;

  expect(el.status).to.equal('pending');
  expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Pending');
  expect(el.shadowRoot!.querySelector('slot[name="icon"] svg')).to.exist;
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement).ariaLabel).to.contain('Pending');
});

it('renders a pending fallback for a direct out-of-union status assignment', async () => {
  const el = (await fixture(
    html`<lr-tool-call-chip name="web_search"></lr-tool-call-chip>`,
  )) as LyraToolCallChip;

  el.status = 'bogus' as LyraToolCallChip['status'];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Pending');
  expect(el.shadowRoot!.querySelector('slot[name="icon"] svg')).to.exist;
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement).ariaLabel).to.contain('Pending');
});

it('renders a distinct built-in glyph per status as the icon slot fallback content', async () => {
  const statuses = ['pending', 'running', 'success', 'error', 'denied'] as const;
  const markups = new Set<string>();
  for (const status of statuses) {
    const el = (await fixture(html`<lr-tool-call-chip status=${status}></lr-tool-call-chip>`)) as LyraToolCallChip;
    const slot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
    const svg = slot.querySelector('svg');
    expect(svg, `status=${status} should render a built-in svg glyph`).to.exist;
    markups.add(svg!.innerHTML);
  }
  expect(markups.size, 'every status should render a visually distinct glyph').to.equal(statuses.length);
});

it('omits the duration part entirely when duration-ms is unset, formats it once set', async () => {
  const el = (await fixture(html`<lr-tool-call-chip></lr-tool-call-chip>`)) as LyraToolCallChip;
  const duration = el.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;
  expect(duration.hidden).to.be.true;

  el.durationMs = 820;
  await el.updateComplete;
  expect(duration.hidden).to.be.false;
  expect(duration.textContent).to.equal('820ms');

  el.durationMs = 1500;
  await el.updateComplete;
  expect(duration.textContent).to.equal('1.5s');

  el.durationMs = 2000;
  await el.updateComplete;
  expect(duration.textContent).to.equal('2s');
});

it('omits a non-finite duration instead of rendering "NaN ms", and clamps a negative duration to 0', async () => {
  const el = (await fixture(html`<lr-tool-call-chip></lr-tool-call-chip>`)) as LyraToolCallChip;
  const duration = el.shadowRoot!.querySelector('[part="duration"]') as HTMLElement;

  el.durationMs = Number.NaN;
  await el.updateComplete;
  expect(duration.hidden).to.be.true;
  expect(duration.textContent).to.equal('');

  el.durationMs = -20;
  await el.updateComplete;
  expect(duration.hidden).to.be.false;
  expect(duration.textContent).to.equal('0ms');
});

it('interpolates duration values through localized message templates', async () => {
  const el = (await fixture(html`
    <lr-tool-call-chip
      duration-ms="1500"
      .strings=${{
        durationMilliseconds: '{value} millisecondes',
        durationSeconds: '{value} secondes',
      }}
    ></lr-tool-call-chip>
  `)) as LyraToolCallChip;

  expect(el.shadowRoot!.querySelector('[part="duration"]')!.textContent).to.equal('1.5 secondes');
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement).ariaLabel).to.contain(
    '1.5 secondes',
  );
});

it('uses themeable motion values for running and pending statuses', async () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(
    'animation: lr-tool-call-chip-spin var(--lr-tool-call-chip-spin) infinite;',
  );
  expect(css).to.include(
    'animation: lr-tool-call-chip-pulse var(--lr-transition-ambient) infinite;',
  );

  const running = (await fixture(html`
    <lr-tool-call-chip
      status="running"
      style="--lr-tool-call-chip-spin: 2.5s linear"
    ></lr-tool-call-chip>
  `)) as LyraToolCallChip;
  const runningGlyph = running.shadowRoot!.querySelector('[part="icon"] svg')!;
  expect(getComputedStyle(runningGlyph).animationDuration).to.equal('2.5s');

  // The pulse rule matched via the cssText check above must actually reach a
  // rendered status="pending" chip's icon too, not just exist as a string in
  // the stylesheet -- proven live against the token's real default resolved
  // value (--lr-transition-ambient defaults to 1.8s), mirroring
  // lr-thinking-panel's own pending pulse-dot check.
  const pending = (await fixture(html`<lr-tool-call-chip status="pending"></lr-tool-call-chip>`)) as LyraToolCallChip;
  const pendingGlyph = pending.shadowRoot!.querySelector('[part="icon"] svg')!;
  expect(getComputedStyle(pendingGlyph).animationDuration).to.equal('1.8s');
});

it('disables the infinite running/pending glyph animations under prefers-reduced-motion: reduce', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  // The media block also resets [part='base']'s hover/focus transition first, so the match must
  // span across that nested rule's own closing brace rather than stopping at the first `}`.
  expect(css).to.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*animation: none !important;/);
});

it('emits lr-tool-call-chip-select with { name, callId } on click', async () => {
  const el = (await fixture(
    html`<lr-tool-call-chip name="web_search" call-id="call-42"></lr-tool-call-chip>`,
  )) as LyraToolCallChip;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;

  setTimeout(() => base.click());
  const ev = await oneEvent(el, 'lr-tool-call-chip-select');
  expect(ev.detail).to.deep.equal({ name: 'web_search', callId: 'call-42' });
  expect(ev.bubbles).to.be.true;
  expect(ev.composed).to.be.true;
});

it('also emits the deprecated lr-tool-chip-select alias for one minor cycle', async () => {
  const el = (await fixture(
    html`<lr-tool-call-chip name="web_search" call-id="call-42"></lr-tool-call-chip>`,
  )) as LyraToolCallChip;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;

  setTimeout(() => base.click());
  const ev = await oneEvent(el, 'lr-tool-chip-select');
  expect(ev.detail).to.deep.equal({ name: 'web_search', callId: 'call-42' });
  expect(ev.bubbles).to.be.true;
  expect(ev.composed).to.be.true;
});

it('builds an aria-label from name, summary, status and duration', async () => {
  const el = (await fixture(html`
    <lr-tool-call-chip
      name="web_search"
      summary="Searching web…"
      status="running"
      duration-ms="1500"
    ></lr-tool-call-chip>
  `)) as LyraToolCallChip;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('web_search — Searching web… — Running — 1.5s');
});

it('localizes the status labels and the unnamed-tool fallback via .strings', async () => {
  const el = (await fixture(html`
    <lr-tool-call-chip
      status="running"
      .strings=${{ statusRunning: 'En cours', toolCall: 'Appel d’outil' }}
    ></lr-tool-call-chip>
  `)) as LyraToolCallChip;
  expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('En cours');
  expect(el.shadowRoot!.querySelector('[part="name"]')!.textContent).to.equal('Appel d’outil');
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement).ariaLabel).to.equal(
    'Appel d’outil — En cours',
  );
});

it('lets an explicit host aria-label override the computed one', async () => {
  const el = (await fixture(
    html`<lr-tool-call-chip name="web_search" aria-label="Custom label"></lr-tool-call-chip>`,
  )) as LyraToolCallChip;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Custom label');
});

describe('icon override precedence', () => {
  it('falls back to the built-in status glyph when neither the icon slot nor icon prop is set', async () => {
    const el = (await fixture(html`<lr-tool-call-chip status="success"></lr-tool-call-chip>`)) as LyraToolCallChip;
    const slot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
    // Plain (non-flattened) assignedElements() reports only real light-DOM
    // assignment, staying empty here -- {flatten: true} would instead report
    // the slot's own fallback content (the built-in svg below) once nothing
    // is actually assigned, per the platform's own slot-fallback semantics.
    expect(slot.assignedElements()).to.have.length(0);
    expect(slot.querySelector('svg')).to.exist;
  });

  it('renders the icon prop as literal fallback text when the icon slot is empty', async () => {
    const el = (await fixture(html`<lr-tool-call-chip icon="🔍"></lr-tool-call-chip>`)) as LyraToolCallChip;
    const slot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
    expect(slot.assignedElements()).to.have.length(0);
    expect(slot.querySelector('svg')).to.not.exist;
    expect(slot.textContent!.trim()).to.equal('🔍');
  });

  it('lets a slot="icon" child override both the built-in glyph and the icon prop', async () => {
    const el = (await fixture(
      html`<lr-tool-call-chip icon="🔍"><span slot="icon" id="custom">X</span></lr-tool-call-chip>`,
    )) as LyraToolCallChip;
    const slot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    expect(assigned).to.have.length(1);
    expect(assigned[0].id).to.equal('custom');
  });
});

describe('detail tooltip', () => {
  it('does not open the tooltip on hover/focus when the default slot is empty', async () => {
    const el = (await fixture(html`<lr-tool-call-chip name="web_search"></lr-tool-call-chip>`)) as LyraToolCallChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltip.hidden).to.be.true;

    base.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(tooltip.hidden).to.be.true;
  });

  it('opens the tooltip on mouseenter and closes it on mouseleave when detail content is slotted', async () => {
    const el = (await fixture(
      html`<lr-tool-call-chip name="web_search"><p>Query: solar panel efficiency</p></lr-tool-call-chip>`,
    )) as LyraToolCallChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltip.hidden).to.be.true;

    base.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(tooltip.hidden).to.be.false;

    base.dispatchEvent(new MouseEvent('mouseleave'));
    await el.updateComplete;
    expect(tooltip.hidden).to.be.true;
  });

  it('opens the tooltip on focus and closes it on blur when detail content is slotted', async () => {
    const el = (await fixture(
      html`<lr-tool-call-chip name="web_search"><p>Query: solar panel efficiency</p></lr-tool-call-chip>`,
    )) as LyraToolCallChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;

    base.focus();
    await el.updateComplete;
    expect(tooltip.hidden).to.be.false;

    base.blur();
    await el.updateComplete;
    expect(tooltip.hidden).to.be.true;
  });

  it('closes an open tooltip on Escape', async () => {
    const el = (await fixture(
      html`<lr-tool-call-chip name="web_search"><p>Detail</p></lr-tool-call-chip>`,
    )) as LyraToolCallChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;

    base.focus();
    await el.updateComplete;
    expect(tooltip.hidden).to.be.false;

    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(tooltip.hidden).to.be.true;
  });

  it('keeps the tooltip open via focus after the pointer leaves, closing only once focus is also lost', async () => {
    const el = (await fixture(
      html`<lr-tool-call-chip name="web_search"><p>Query: solar panel efficiency</p></lr-tool-call-chip>`,
    )) as LyraToolCallChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;

    base.focus();
    await el.updateComplete;
    expect(tooltip.hidden).to.be.false;

    base.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    base.dispatchEvent(new MouseEvent('mouseleave'));
    await el.updateComplete;
    // Still focused -- the pointer leaving shouldn't close a tooltip that's
    // open because of focus, not hover.
    expect(tooltip.hidden).to.be.false;
    expect(el.shadowRoot!.activeElement).to.equal(base);

    base.blur();
    await el.updateComplete;
    expect(tooltip.hidden).to.be.true;
  });

  it('keeps the tooltip open via hover after blur, closing only once the pointer also leaves', async () => {
    const el = (await fixture(
      html`<lr-tool-call-chip name="web_search"><p>Query: solar panel efficiency</p></lr-tool-call-chip>`,
    )) as LyraToolCallChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;

    base.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    base.focus();
    await el.updateComplete;
    base.blur();
    await el.updateComplete;
    // Still hovered -- blur shouldn't close a tooltip the pointer is still
    // resting on.
    expect(tooltip.hidden).to.be.false;

    base.dispatchEvent(new MouseEvent('mouseleave'));
    await el.updateComplete;
    expect(tooltip.hidden).to.be.true;
  });

  it('closes the tooltip if the slotted detail content is removed while open', async () => {
    const el = (await fixture(
      html`<lr-tool-call-chip name="web_search"><p id="detail">Query: solar panel efficiency</p></lr-tool-call-chip>`,
    )) as LyraToolCallChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;

    base.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(tooltip.hidden).to.be.false;

    el.querySelector('#detail')!.remove();
    // slotchange fires asynchronously after the light-DOM mutation.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;
    expect(tooltip.hidden).to.be.true;
  });

  it('closes the tooltip (rather than leaving it frozen open with no positioner) after a disconnect+reconnect while open', async () => {
    const el = (await fixture(
      html`<lr-tool-call-chip name="web_search"><p>Query: solar panel efficiency</p></lr-tool-call-chip>`,
    )) as LyraToolCallChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;

    base.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(tooltip.hidden).to.be.false;

    const parent = el.parentElement!;
    el.remove();
    parent.appendChild(el);
    await el.updateComplete;

    // `disconnectedCallback()` resets `tooltipOpen` to `false` -- asserting
    // that directly is what distinguishes the fix from the pre-fix bug
    // (tearing down `cleanupPositioner` alone leaves the tooltip rendered
    // open at a stale position with no live positioner attached).
    const tooltipAfterReconnect = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltipAfterReconnect.hidden).to.be.true;
  });

  it('associates the trigger with the open tooltip via aria-describedby, using a stable id', async () => {
    const el = (await fixture(
      html`<lr-tool-call-chip name="web_search"><p>Query: solar panel efficiency</p></lr-tool-call-chip>`,
    )) as LyraToolCallChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;

    expect(base.hasAttribute('aria-describedby')).to.be.false;

    base.focus();
    await el.updateComplete;
    expect(tooltip.id).to.not.equal('');
    expect(base.getAttribute('aria-describedby')).to.equal(tooltip.id);

    base.blur();
    await el.updateComplete;
    expect(base.hasAttribute('aria-describedby')).to.be.false;
  });
});

it('is accessible in the default (empty, no detail) state', async () => {
  const el = (await fixture(html`<lr-tool-call-chip name="web_search" summary="Searching web…"></lr-tool-call-chip>`)) as LyraToolCallChip;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated state with category, duration, and an open detail tooltip', async () => {
  const el = (await fixture(html`
    <lr-tool-call-chip
      name="web_search"
      category="research"
      status="success"
      summary="Found 8 results"
      duration-ms="1450"
      call-id="call-1"
    >
      <p>Query: solar panel efficiency</p>
    </lr-tool-call-chip>
  `)) as LyraToolCallChip;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  base.focus();
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. Wired to --lr-popover-viewport-clamp the min() collapses to that
 *  pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement('span');
  probe.style.display = 'block';
  probe.style.setProperty('--lr-popover-viewport-clamp', '10px');
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it('clamps its floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(html`<lr-tool-call-chip></lr-tool-call-chip>`)) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  expect(renderedClamp(el, "[part='tooltip']")).to.equal('10px');
});

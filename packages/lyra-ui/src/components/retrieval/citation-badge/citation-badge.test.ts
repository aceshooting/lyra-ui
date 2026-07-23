import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './citation-badge.js';
import type { LyraCitationBadge } from './citation-badge.js';

it('defaults to index=1, status="default", empty source-id/href/label', async () => {
  const el = (await fixture(html`<lr-citation-badge></lr-citation-badge>`)) as LyraCitationBadge;
  expect(el.index).to.equal(1);
  expect(el.status).to.equal('default');
  expect(el.getAttribute('status')).to.equal('default');
  expect(el.sourceId).to.equal('');
  expect(el.href).to.equal('');
  expect(el.label).to.equal('');
});

it('sanitizes a NaN/non-integer/non-positive index to a finite, 1-indexed integer instead of rendering "[NaN]"', async () => {
  const el = (await fixture(html`<lr-citation-badge></lr-citation-badge>`)) as LyraCitationBadge;

  el.index = NaN;
  expect(el.index).to.equal(1); // falls back to the documented default, not NaN
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="index"]')!.textContent).to.equal('1');

  el.index = -5;
  expect(el.index).to.equal(1); // clamped to the 1-indexed floor

  el.index = 3.7;
  expect(el.index).to.equal(3); // truncated, not rounded
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="index"]')!.textContent).to.equal('3');
});

it('renders [index] as its visible content', async () => {
  const el = (await fixture(html`<lr-citation-badge index="3"></lr-citation-badge>`)) as LyraCitationBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.textContent?.replace(/\s+/g, '')).to.equal('[3]');
  expect(el.shadowRoot!.querySelector('[part="index"]')!.textContent).to.equal('3');
});

it('is a real <button type="button"> — Enter activation is native, no custom keydown handler needed', async () => {
  const el = (await fixture(html`<lr-citation-badge index="3"></lr-citation-badge>`)) as LyraCitationBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  expect(base.tagName).to.equal('BUTTON');
  expect(base.type).to.equal('button');
});

it('maps the source-id attribute onto the sourceId property', async () => {
  const el = (await fixture(
    html`<lr-citation-badge index="1" source-id="doc-42"></lr-citation-badge>`,
  )) as LyraCitationBadge;
  expect(el.sourceId).to.equal('doc-42');
});

it('reflects status changes onto the host attribute', async () => {
  const el = (await fixture(html`<lr-citation-badge></lr-citation-badge>`)) as LyraCitationBadge;
  el.status = 'verified';
  await el.updateComplete;
  expect(el.getAttribute('status')).to.equal('verified');
});

describe('accessible name', () => {
  it('combines index and status when both are present', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="3" status="verified"></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Citation 3, Verified');
  });

  it('omits the status clause for status="default"', async () => {
    const el = (await fixture(html`<lr-citation-badge index="5"></lr-citation-badge>`)) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Citation 5');
  });

  it('produces a distinct visible status word per non-default status', async () => {
    const statuses = ['high', 'medium', 'low', 'verified', 'unverified'] as const;
    const labels = ['High confidence', 'Medium confidence', 'Low confidence', 'Verified', 'Unverified'];
    for (let i = 0; i < statuses.length; i++) {
      const el = (await fixture(
        html`<lr-citation-badge index="1" status=${statuses[i]}></lr-citation-badge>`,
      )) as LyraCitationBadge;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      expect(base.getAttribute('aria-label')).to.equal(`Citation 1, ${labels[i]}`);
    }
  });

  it('localizes each status word via this.localize() when .strings overrides the citation* keys', async () => {
    const el = (await fixture(html`
      <lr-citation-badge
        index="1"
        status="verified"
        .strings=${{ citationVerified: 'Vérifié', citationUnverified: 'Non vérifié' }}
      ></lr-citation-badge>
    `)) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Citation 1, Vérifié');

    el.status = 'unverified';
    await el.updateComplete;
    expect(base.getAttribute('aria-label')).to.equal('Citation 1, Non vérifié');
  });

  it('localizes the complete citation-with-status message so translators control its order and punctuation', async () => {
    const el = (await fixture(html`
      <lr-citation-badge
        index="3"
        status="verified"
        .strings=${{
          citationVerified: 'Vérifiée',
          citationWithStatus: '{status} — référence {index}',
        }}
      ></lr-citation-badge>
    `)) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Vérifiée — référence 3');
  });

  it('localizes the "Citation {index}" clause itself via this.localize() when .strings overrides the citation key', async () => {
    const el = (await fixture(html`
      <lr-citation-badge index="3" .strings=${{ citation: 'Référence {index}' }}></lr-citation-badge>
    `)) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Référence 3');
  });

  it('lets the label prop fully override the computed accessible name', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="3" status="verified" label="Source: report.pdf, page 4"></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Source: report.pdf, page 4');
  });

  it('lets an explicit host aria-label override both the label prop and the computed name', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="3" label="ignored" aria-label="Custom"></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Custom');
  });
});

describe('lr-citation-activate', () => {
  it('fires on click with { sourceId, index }', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="4" source-id="doc-9"></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;

    setTimeout(() => base.click());
    const ev = await oneEvent(el, 'lr-citation-activate');
    expect(ev.detail).to.deep.equal({ sourceId: 'doc-9', index: 4 });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe('lr-citation-open', () => {
  it('fires on dblclick with { sourceId, index, href }', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="4" source-id="doc-9" href="https://example.com/doc.pdf"></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;

    setTimeout(() => base.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const ev = await oneEvent(el, 'lr-citation-open');
    expect(ev.detail).to.deep.equal({ sourceId: 'doc-9', index: 4, href: 'https://example.com/doc.pdf' });
  });

  it('carries href: undefined when the href prop is unset', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="4" source-id="doc-9"></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;

    setTimeout(() => base.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const ev = await oneEvent(el, 'lr-citation-open');
    expect(ev.detail.sourceId).to.equal('doc-9');
    expect(ev.detail.index).to.equal(4);
    expect(ev.detail.href).to.be.undefined;
  });

  it('fires on Space while focused, pre-empting the native click that would otherwise fire lr-citation-activate instead', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="2" source-id="doc-1"></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    base.focus();

    let activateCount = 0;
    el.addEventListener('lr-citation-activate', () => activateCount++);

    setTimeout(() =>
      base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })),
    );
    const ev = await oneEvent(el, 'lr-citation-open');
    expect(ev.detail).to.deep.equal({ sourceId: 'doc-1', index: 2, href: undefined });
    expect(activateCount, 'Space should not also fire lr-citation-activate').to.equal(0);
  });

  it('preventDefaults the Space keydown so no native click is synthesized', async () => {
    const el = (await fixture(html`<lr-citation-badge index="2"></lr-citation-badge>`)) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    base.focus();

    const keyEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    base.dispatchEvent(keyEvent);
    expect(keyEvent.defaultPrevented).to.be.true;
  });
});

describe('hover/focus preview popover', () => {
  it('never shows when the default slot is empty', async () => {
    const el = (await fixture(html`<lr-citation-badge index="1"></lr-citation-badge>`)) as LyraCitationBadge;
    const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
    expect(popover.hidden).to.be.true;

    wrapper.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await el.updateComplete;
    expect(popover.hidden).to.be.true;
  });

  it('shows on pointerenter and hides (after the grace period) on pointerleave when preview content is slotted', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="1"><p>report.pdf, page 4</p></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
    expect(popover.hidden).to.be.true;

    wrapper.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await el.updateComplete;
    expect(popover.hidden).to.be.false;

    wrapper.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await el.updateComplete;
    expect(popover.hidden, 'should still be visible immediately after leave -- grace period').to.be.false;

    await aTimeout(300);
    expect(popover.hidden, 'should be hidden once the grace period elapses').to.be.true;
  });

  it('cancels a pending hide when hover returns before the grace period elapses', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="1"><p>preview</p></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;

    wrapper.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await el.updateComplete;
    expect(popover.hidden).to.be.false;

    wrapper.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await el.updateComplete;

    // Re-enter well within the 200ms grace period -- this must cancel the
    // scheduled hide outright, not just leave the popover open transiently
    // until the stale timer catches up with it.
    wrapper.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await el.updateComplete;
    expect(popover.hidden).to.be.false;

    // Wait past when the original hide timer would have fired. If it wasn't
    // actually cancelled, the popover silently closes here despite hover
    // having returned.
    await aTimeout(300);
    expect(popover.hidden, 'the stale hide timer must not fire after hover returned').to.be.false;
  });

  it('shows on focusin and hides immediately (no grace period) on focusout when preview content is slotted', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="1"><p>report.pdf, page 4</p></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;

    base.focus();
    await el.updateComplete;
    expect(popover.hidden).to.be.false;

    base.blur();
    await el.updateComplete;
    expect(popover.hidden, 'a deliberate blur should close it at once, unlike pointerleave').to.be.true;
  });

  it('stays open on pointerleave while focus still holds it open', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="1"><p>preview</p></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;

    base.focus();
    wrapper.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await el.updateComplete;
    expect(popover.hidden).to.be.false;

    wrapper.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await aTimeout(300);
    expect(popover.hidden, 'focus should still hold the popover open').to.be.false;
  });

  it('keeps the tooltip associated via aria-describedby whenever preview content exists', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="1"><p>preview</p></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
    expect(base.getAttribute('aria-describedby')).to.equal(popover.id);

    base.focus();
    await el.updateComplete;
    expect(base.getAttribute('aria-describedby')).to.equal(popover.id);

    base.blur();
    await el.updateComplete;
    expect(base.getAttribute('aria-describedby')).to.equal(popover.id);
  });

  it('closes immediately on Escape while focus is within the badge', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="1"><p>preview</p></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;

    base.focus();
    await el.updateComplete;
    expect(popover.hidden).to.be.false;

    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(popover.hidden).to.be.true;
  });

  it('does not trap Tab focus — no tabindex/focus-trap wiring on the popover itself', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="1"><p>preview</p></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
    expect(popover.hasAttribute('tabindex')).to.be.false;
  });

  it('shows the popover for preview content that is plain text with no wrapping element', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="5">No source has confirmed this yet.</lr-citation-badge>`,
    )) as LyraCitationBadge;
    const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
    expect(popover.hidden).to.be.true;

    wrapper.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await el.updateComplete;
    expect(popover.hidden, 'bare slotted text should count as real preview content').to.be.false;
  });

  it('force-closes an already-open popover when its preview content is removed from the slot', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="1"><p>preview</p></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;

    base.focus();
    await el.updateComplete;
    expect(popover.hidden).to.be.false;

    el.querySelector('p')!.remove();
    // slotchange fires asynchronously after the light-DOM mutation.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;

    expect(popover.hidden, 'popover must close once its preview content is emptied out from under it').to.be.true;
  });

  it('resets the open preview popover on disconnect, instead of leaving it visually open with a torn-down positioner', async () => {
    const el = (await fixture(
      html`<lr-citation-badge index="1"><p>preview</p></lr-citation-badge>`,
    )) as LyraCitationBadge;
    const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;

    wrapper.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await el.updateComplete;
    expect(popover.hidden, 'precondition: popover is open').to.be.false;

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(el); // disconnect + reconnect synchronously, same instance
    await el.updateComplete;

    const reconnectedPopover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
    expect(reconnectedPopover.hidden, 'a reconnect must not leave a stale popover rendered open').to.be.true;

    container.remove();
  });
});

it('is accessible in the default (empty, no preview) state', async () => {
  const el = (await fixture(html`<lr-citation-badge index="1"></lr-citation-badge>`)) as LyraCitationBadge;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated state with status, href, and an open preview popover', async () => {
  const el = (await fixture(html`
    <lr-citation-badge index="3" status="verified" source-id="doc-1" href="https://example.com/doc.pdf">
      <strong>report.pdf</strong>, p. 4 — "annual generation increased 12%"
    </lr-citation-badge>
  `)) as LyraCitationBadge;
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
  const el = (await fixture(html`<lr-citation-badge></lr-citation-badge>`)) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  expect(renderedClamp(el, "[part='popover']")).to.equal('10px');
});

it('keeps rich tooltip content non-interactive', async () => {
  const el = (await fixture(
    html`<lr-citation-badge index="1"><button>Unexpected action</button></lr-citation-badge>`,
  )) as LyraCitationBadge;
  expect((el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement).inert).to.be.true;
});

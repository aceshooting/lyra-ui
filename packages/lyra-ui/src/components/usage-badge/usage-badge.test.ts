import { fixture, expect, html } from '@open-wc/testing';
import './usage-badge.js';
import type { LyraUsageBadge } from './usage-badge.js';

it('defaults to no tokensIn/tokensOut/costText/latencyMs, compact=false', async () => {
  const el = (await fixture(html`<lyra-usage-badge></lyra-usage-badge>`)) as LyraUsageBadge;
  expect(el.tokensIn).to.be.undefined;
  expect(el.tokensOut).to.be.undefined;
  expect(el.costText).to.equal('');
  expect(el.latencyMs).to.be.undefined;
  expect(el.compact).to.be.false;
});

it('renders nothing when no segment is set', async () => {
  const el = (await fixture(html`<lyra-usage-badge></lyra-usage-badge>`)) as LyraUsageBadge;
  expect(el.shadowRoot!.querySelector('[part="tokens-in"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="tokens-out"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="cost"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="latency"]')).to.not.exist;
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).hasAttribute('tabindex')).to.be.false;
});

it('renders only the segments that are set, each independently optional', async () => {
  const el = (await fixture(
    html`<lyra-usage-badge tokens-in="1204" cost-text="$0.012"></lyra-usage-badge>`,
  )) as LyraUsageBadge;
  expect(el.shadowRoot!.querySelector('[part="tokens-in"]')!.textContent!.trim()).to.equal('1,204 in');
  expect(el.shadowRoot!.querySelector('[part="tokens-out"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="cost"]')!.textContent!.trim()).to.equal('$0.012');
  expect(el.shadowRoot!.querySelector('[part="latency"]')).to.not.exist;
});

it('formats latency-ms with the shared duration algorithm', async () => {
  const sub = (await fixture(html`<lyra-usage-badge latency-ms="820"></lyra-usage-badge>`)) as LyraUsageBadge;
  expect(sub.shadowRoot!.querySelector('[part="latency"]')!.textContent!.trim()).to.equal('820ms');
  const over = (await fixture(html`<lyra-usage-badge latency-ms="1500"></lyra-usage-badge>`)) as LyraUsageBadge;
  expect(over.shadowRoot!.querySelector('[part="latency"]')!.textContent!.trim()).to.equal('1.5s');
});

it('renders compact token notation when compact is set, full grouped figures otherwise', async () => {
  const full = (await fixture(html`<lyra-usage-badge tokens-in="12345"></lyra-usage-badge>`)) as LyraUsageBadge;
  expect(full.shadowRoot!.querySelector('[part="tokens-in"]')!.textContent!.trim()).to.equal('12,345 in');

  const compact = (await fixture(
    html`<lyra-usage-badge tokens-in="12345" compact></lyra-usage-badge>`,
  )) as LyraUsageBadge;
  expect(compact.shadowRoot!.querySelector('[part="tokens-in"]')!.textContent!.trim()).to.equal('12K in');
});

it('is a focusable non-button group named "Usage" whenever any segment is set', async () => {
  const el = (await fixture(html`<lyra-usage-badge tokens-in="10"></lyra-usage-badge>`)) as LyraUsageBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.tagName).to.not.equal('BUTTON');
  expect(base.getAttribute('role')).to.equal('group');
  expect(base.getAttribute('tabindex')).to.equal('0');
  expect(base.getAttribute('aria-label')).to.equal('Usage');
});

describe('tooltip breakdown', () => {
  it('is hidden until hover/focus, and shows full-precision labeled rows', async () => {
    const el = (await fixture(
      html`<lyra-usage-badge
        tokens-in="1204"
        tokens-out="386"
        cost-text="$0.012"
        latency-ms="2350"
        compact
      ></lyra-usage-badge>`,
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden).to.be.true;

    base.dispatchEvent(new Event('mouseenter'));
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltip.hidden).to.be.false;
    expect(tooltip.textContent).to.include('Input tokens');
    expect(tooltip.textContent).to.include('1,204');
    expect(tooltip.textContent).to.include('Output tokens');
    expect(tooltip.textContent).to.include('386');
    expect(tooltip.textContent).to.include('Total tokens');
    expect(tooltip.textContent).to.include('1,590');
    expect(tooltip.textContent).to.include('Cost');
    expect(tooltip.textContent).to.include('$0.012');
    expect(tooltip.textContent).to.include('Latency');
    expect(tooltip.textContent).to.include('2.4s');

    base.dispatchEvent(new Event('mouseleave'));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden).to.be.true;
  });

  it('only shows the Total tokens row when both tokensIn and tokensOut are set', async () => {
    const el = (await fixture(html`<lyra-usage-badge tokens-in="1204"></lyra-usage-badge>`)) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event('mouseenter'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent).to.not.include('Total tokens');
  });

  it('keeps the tooltip open while hover releases but focus still holds it, and vice versa', async () => {
    const el = (await fixture(html`<lyra-usage-badge tokens-in="10"></lyra-usage-badge>`)) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event('mouseenter'));
    base.dispatchEvent(new Event('focus'));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden).to.be.false;

    base.dispatchEvent(new Event('mouseleave'));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden, 'focus still holds it open').to
      .be.false;

    base.dispatchEvent(new Event('blur'));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden).to.be.true;
  });

  it('dismisses on Escape', async () => {
    const el = (await fixture(html`<lyra-usage-badge tokens-in="10"></lyra-usage-badge>`)) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event('focus'));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden).to.be.false;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden).to.be.true;
  });

  it('sets aria-describedby on base only while the tooltip is open and has content', async () => {
    const el = (await fixture(html`<lyra-usage-badge tokens-in="10"></lyra-usage-badge>`)) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.hasAttribute('aria-describedby')).to.be.false;
    base.dispatchEvent(new Event('focus'));
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(base.getAttribute('aria-describedby')).to.equal(tooltip.id);
  });

  it('renders extra slotted rows below the built-in breakdown', async () => {
    const el = (await fixture(
      html`<lyra-usage-badge tokens-in="10"><div>Cache-read: 500</div></lyra-usage-badge>`,
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event('focus'));
    await el.updateComplete;
    // Assigned content stays in the light DOM under Shadow DOM slotting, so it never becomes
    // descendant text of a shadow-tree node -- querying the tooltip's own `.textContent` (as
    // opposed to the slot's `assignedElements()`) would never see it regardless of whether the
    // slot is wired up correctly. Assert through the slot's real assignment instead, the same way
    // `tool-call-chip.test.ts`'s icon-slot-precedence tests do.
    const slot = el.shadowRoot!.querySelector('[part="tooltip"] slot') as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    expect(assigned).to.have.length(1);
    expect(assigned[0].textContent).to.include('Cache-read: 500');
  });
});

it('localizes built-in tooltip row labels via .strings', async () => {
  const el = (await fixture(
    html`<lyra-usage-badge tokens-in="10" .strings=${{ usageBadgeTokensInLabel: 'Jetons entrée' }}></lyra-usage-badge>`,
  )) as LyraUsageBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.dispatchEvent(new Event('focus'));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent).to.include('Jetons entrée');
});

it('is accessible with nothing set', async () => {
  const el = (await fixture(html`<lyra-usage-badge></lyra-usage-badge>`)) as LyraUsageBadge;
  await expect(el).to.be.accessible();
});

it('is accessible with every segment set and the tooltip open', async () => {
  const el = (await fixture(
    html`<lyra-usage-badge tokens-in="1204" tokens-out="386" cost-text="$0.012" latency-ms="2350"></lyra-usage-badge>`,
  )) as LyraUsageBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.dispatchEvent(new Event('focus'));
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

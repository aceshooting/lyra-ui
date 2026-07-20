import { fixture, expect, html } from '@open-wc/testing';
import './details.js';
import './accordion.js';
import './accordion-item.js';
import type { LyraDetails } from './details.js';
import { styles as detailsStyles } from './details.styles.js';
import { styles as accordionStyles } from './accordion.styles.js';

it('renders a disclosure panel and reports its state', async () => {
  const el = (await fixture(html`<lr-details summary="More">Content</lr-details>`)) as LyraDetails;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  expect(summary.getAttribute('aria-expanded')).to.equal('false');
  el.open = true;
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLDetailsElement).open).to.be.true;
  expect(summary.getAttribute('aria-expanded')).to.equal('true');
  await expect(el).to.be.accessible();
});

it('closes sibling panels when multiple is false', async () => {
  const el = await fixture(html`<lr-accordion>
    <lr-accordion-item open summary="One">A</lr-accordion-item>
    <lr-accordion-item summary="Two">B</lr-accordion-item>
  </lr-accordion>`);
  const panels = [...el.querySelectorAll('lr-accordion-item')] as LyraDetails[];
  panels[1].open = true;
  panels[1].dispatchEvent(new CustomEvent('lr-toggle', { detail: { open: true }, bubbles: true, composed: true }));
  await Promise.all(panels.map((panel) => panel.updateComplete));
  expect(panels[0].open).to.be.false;
});

it('suppresses the localized "Details" fallback once rich content is slotted into summary', async () => {
  const el = (await fixture(
    html`<lr-details><span slot="summary">Custom Label</span>Content</lr-details>`,
  )) as LyraDetails;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  // Slotted light-DOM content isn't reparented into the shadow tree, so `textContent` on the
  // shadow part only ever reflects the shadow-side fallback text node -- it must be empty once a
  // slot="summary" child exists, or the fallback renders ahead of the real label.
  expect(summary.textContent?.trim()).to.equal('');
  expect(el.textContent?.trim()).to.equal('Custom LabelContent');
});

it('exposes disabled to assistive tech via aria-disabled on the summary, rendered in both states', async () => {
  const el = (await fixture(html`<lr-details summary="More" disabled>Content</lr-details>`)) as LyraDetails;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  expect(summary.getAttribute('aria-disabled')).to.equal('true');

  el.disabled = false;
  await el.updateComplete;
  expect(summary.getAttribute('aria-disabled')).to.equal('false');
});

it('blocks both pointer and synthesized keyboard activation while disabled', async () => {
  const el = (await fixture(html`<lr-details summary="More" disabled>Content</lr-details>`)) as LyraDetails;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLDetailsElement;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;

  // A native <summary> synthesizes a click for Enter/Space activation, so exercising the click
  // path (which onClick guards with event.preventDefault()) covers the keyboard path too.
  summary.click();
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(base.open).to.be.false;
});

it('mirrors the disclosure marker rotation under RTL so it still points down/up instead of sideways', () => {
  const css = detailsStyles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(":host(:dir(rtl)) [part='summary']::after { transform: rotate(-45deg); }");
  expect(css).to.include(":host([open]:dir(rtl)) [part='summary']::after { transform: rotate(-225deg); }");
});

it('gives the summary (the real focusable/clickable surface) hover and focus-visible treatment', () => {
  const css = detailsStyles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='summary'\]:hover\s*\{[^}]*background:/);
  expect(css).to.match(/\[part='summary'\]:focus-visible\s*\{[^}]*outline:/);
});

it('gives lr-accordion its own stylesheet instead of reusing details.styles.ts wholesale', () => {
  const css = accordionStyles.cssText.replace(/\s+/g, ' ');
  // details.styles.ts's [part='base'] rule paints a border-block-end meant for <lr-details>'s
  // own root; the accordion's [part='base'] is a plain wrapper div, so inheriting that rule
  // doubled up with the last panel's own border. None of details.styles.ts's <details>-shaped
  // selectors (summary/content/disabled/reduced-motion) apply to the accordion's shadow root.
  expect(css).to.not.include('border-block-end');
  expect(css).to.not.include("[part='summary']");
  expect(css).to.not.include("[part='content']");
});

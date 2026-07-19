import { fixture, expect, html } from '@open-wc/testing';
import './callout.js';
import type { LyraCallout } from './callout.js';
import { styles } from './callout.styles.js';

it('renders status content and a localized close action', async () => {
  const el = (await fixture(html`<lr-callout closable>Something happened</lr-callout>`)) as LyraCallout;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  expect(button.getAttribute('aria-label')).to.equal('Close');
  expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('role')).to.equal('status');
  await expect(el).to.be.accessible();
});

it('allows close to be vetoed and otherwise hides', async () => {
  const el = (await fixture(html`<lr-callout closable>Message</lr-callout>`)) as LyraCallout;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  const veto = (event: Event) => event.preventDefault();
  el.addEventListener('lr-close', veto);
  button.click();
  expect(el.open).to.be.true;
  el.removeEventListener('lr-close', veto);
  const next = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  next.click();
  expect(el.open).to.be.false;
});

it('forwards a host-level aria-label to the base region when accessible-label is unset', async () => {
  const el = (await fixture(html`<lr-callout aria-label="Storage warning">Disk is nearly full</lr-callout>`)) as LyraCallout;
  expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Storage warning');
});

it('lets accessible-label take precedence over a host-level aria-label', async () => {
  const el = (await fixture(
    html`<lr-callout accessible-label="Explicit label" aria-label="Host label">Message</lr-callout>`
  )) as LyraCallout;
  expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Explicit label');
});

it('gives the close button the shared minimum hit area in both the default and inline variants, shrinking only the visible glyph', async () => {
  const el = (await fixture(html`<lr-callout closable>Message</lr-callout>`)) as LyraCallout;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect(getComputedStyle(button).minInlineSize).to.equal('40px');
  expect(getComputedStyle(button).minBlockSize).to.equal('40px');

  const inlineEl = (await fixture(
    html`<lr-callout inline closable>Message</lr-callout>`,
  )) as LyraCallout;
  const inlineButton = inlineEl.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  const inlineIcon = inlineEl.shadowRoot!.querySelector('[part="close-icon"]') as HTMLElement;
  expect(getComputedStyle(inlineButton).minInlineSize).to.equal('40px');
  expect(getComputedStyle(inlineButton).minBlockSize).to.equal('40px');
  // The visible "×" glyph shrinks to the compact inline size, not the button's own hit target.
  expect(getComputedStyle(inlineIcon).inlineSize).to.equal('24px');
  expect(getComputedStyle(inlineIcon).blockSize).to.equal('24px');
});

it('supports a lightweight inline status/error treatment', async () => {
  const el = (await fixture(html`<lr-callout inline variant="danger"><span slot="icon">!</span>Try again</lr-callout>`)) as LyraCallout;
  expect(el.inline).to.be.true;
  expect(el.hasAttribute('inline')).to.be.true;
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(':host([inline]) [part=\'base\']');
  expect(css).to.include('background: transparent;');
  await expect(el).to.be.accessible();
});

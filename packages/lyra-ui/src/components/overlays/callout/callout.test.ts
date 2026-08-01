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

it('does not announce static content on mount but activates its live policy for later content changes', async () => {
  const el = (await fixture(html`<lr-callout>Historical status</lr-callout>`)) as LyraCallout;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-live')).to.equal('off');
  el.firstChild!.textContent = 'Fresh status';
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
  expect(base.getAttribute('aria-live')).to.equal('polite');
});

it('renders closed when open="false" is set as a plain HTML attribute', async () => {
  // Regression test: `open` defaults `true`, and Lit's default presence-based `type: Boolean`
  // converter cannot distinguish an absent attribute from the literal string "false" -- only a
  // `true`-aware converter parses the literal attribute form correctly.
  const el = (await fixture(html`<lr-callout open="false">Message</lr-callout>`)) as LyraCallout;
  expect(el.open).to.be.false;
  expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(0);
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

it('lets a host-level aria-label take precedence over accessible-label on the status owner', async () => {
  const el = (await fixture(
    html`<lr-callout accessible-label="Explicit label" aria-label="Host label">Message</lr-callout>`
  )) as LyraCallout;
  expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Host label');
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

it('actually renders the inline variant with a transparent panel background', async () => {
  // Companion to the cssText-source check above -- proves the rule reaches a real rendered
  // element rather than only existing as unapplied stylesheet text (e.g. a future higher-
  // specificity rule elsewhere, or the selector losing to [part='base']'s own background
  // declaration, would break this while the cssText check above kept passing).
  const nonInline = (await fixture(html`<lr-callout variant="danger">Try again</lr-callout>`)) as LyraCallout;
  const nonInlineBase = nonInline.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(nonInlineBase).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');

  const inlineEl = (await fixture(html`<lr-callout inline variant="danger">Try again</lr-callout>`)) as LyraCallout;
  const inlineBase = inlineEl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(inlineBase).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
});

// -- size --------------------------------------------------------------------

describe('size', () => {
  const panel = (el: LyraCallout): CSSStyleDeclaration =>
    getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);

  const render = async (size?: string): Promise<LyraCallout> =>
    (await fixture(
      size === undefined
        ? html`<lr-callout>Message</lr-callout>`
        : html`<lr-callout size=${size}>Message</lr-callout>`,
    )) as LyraCallout;

  it('defaults to "m", and the unset default renders identically to the explicit tier', async () => {
    const unset = await render();
    const explicit = await render('m');
    expect(unset.size).to.equal('m');
    expect(unset.getAttribute('size')).to.equal('m');
    expect(panel(unset).paddingBlockStart).to.equal(panel(explicit).paddingBlockStart);
    expect(panel(unset).fontSize).to.equal(panel(explicit).fontSize);
  });

  it('grows the rendered panel padding and font size monotonically across the ladder', async () => {
    const measured: { padding: number; font: number }[] = [];
    for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const) {
      const style = panel(await render(size));
      measured.push({
        padding: Number.parseFloat(style.paddingBlockStart),
        font: Number.parseFloat(style.fontSize),
      });
    }
    for (let i = 1; i < measured.length; i++) {
      expect(measured[i]!.padding, `padding tier ${i} >= ${i - 1}`).to.be.at.least(measured[i - 1]!.padding);
      expect(measured[i]!.font, `font tier ${i} >= ${i - 1}`).to.be.at.least(measured[i - 1]!.font);
    }
    expect(measured.at(-1)!.padding, 'xl padding beats 2xs').to.be.greaterThan(measured[0]!.padding);
    expect(measured.at(-1)!.font, 'xl font beats 2xs').to.be.greaterThan(measured[0]!.font);
  });

  it('accepts the Web Awesome size spellings as exact synonyms of the step names', async () => {
    for (const [step, alias] of [['s', 'small'], ['m', 'medium'], ['l', 'large']] as const) {
      const stepped = panel(await render(step));
      const aliased = panel(await render(alias));
      expect(aliased.paddingBlockStart, `${alias} padding`).to.equal(stepped.paddingBlockStart);
      expect(aliased.fontSize, `${alias} font`).to.equal(stepped.fontSize);
    }
  });

  it('keeps the compact inline treatment padding-free at every tier', async () => {
    const el = (await fixture(html`<lr-callout inline size="xl">Message</lr-callout>`)) as LyraCallout;
    expect(panel(el).paddingBlockStart).to.equal('0px');
    expect(panel(el).paddingInlineStart).to.equal('0px');
  });

  it('stays accessible at the smallest tier with a close action', async () => {
    const el = (await fixture(html`<lr-callout size="2xs" closable>Message</lr-callout>`)) as LyraCallout;
    await expect(el).to.be.accessible();
  });
});

it('gives close-button a hover state', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='close-button'\]:hover/);
});

it('decouples the close-button hover fill from --lr-callout-background so a brand-variant panel is not the sole override hook', async () => {
  const el = (await fixture(
    html`<lr-callout variant="brand" closable>Message</lr-callout>`,
  )) as LyraCallout;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;

  // Overriding the hover-fill token alone must not move the panel background.
  const panelBefore = getComputedStyle(base).backgroundColor;
  el.style.setProperty('--lr-callout-close-hover-bg', 'rgb(1, 2, 3)');
  await el.updateComplete;
  expect(getComputedStyle(base).backgroundColor).to.equal(panelBefore);

  // The dedicated token is reachable at all -- proof it is not just a bare literal.
  expect(getComputedStyle(button).getPropertyValue('--lr-callout-close-hover-bg').trim()).to.equal(
    'rgb(1, 2, 3)',
  );
});

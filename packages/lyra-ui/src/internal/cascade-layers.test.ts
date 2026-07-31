import { expect, fixture, html } from '@open-wc/testing';

/**
 * `theme.css` used to declare its tokens unlayered at `:root` — specificity (0,1,0), the same as
 * any consumer's own `:root` rule. Whether the consumer's override won therefore came down to
 * stylesheet order, which is not something an application controls reliably once a bundler,
 * a `<link>` and an `@import` are all in play. That is the difference between "themeable" and
 * "themeable if you get lucky".
 *
 * Wrapping the theme in a named cascade layer fixes it outright: **any** unlayered declaration
 * beats **every** layered one, regardless of specificity or order. So a consumer's plain
 * `:root { --lr-theme-…: … }` now always wins, even when their stylesheet loads first.
 */

const THEME_LAYER = 'lr-theme';

async function loadThemeInto(root: ShadowRoot | Document, order: 'theme-first' | 'consumer-first'): Promise<void> {
  const theme = new URL('../theme.css', import.meta.url).href;
  const themeLink = document.createElement('link');
  themeLink.rel = 'stylesheet';
  themeLink.href = theme;
  const consumer = document.createElement('style');
  // Deliberately the *same* specificity the theme uses, and no `!important`.
  consumer.textContent = ':root, .lr-light { --lr-theme-color-brand-fill-loud: rgb(1, 2, 3); }';

  const target = (root as Document).head ?? root;
  const nodes = order === 'theme-first' ? [themeLink, consumer] : [consumer, themeLink];
  for (const node of nodes) target.append(node);
  await new Promise((resolve) => themeLink.addEventListener('load', resolve, { once: true }));
}

it('declares the theme inside a named cascade layer', async () => {
  const response = await fetch(new URL('../theme.css', import.meta.url).href);
  const text = await response.text();
  // Not a rendered-result assertion — a cascade *origin* has no computed-style projection. The
  // behavioural consequence is what the next test asserts. Slice rather than compare the whole
  // file, so a failure prints a readable diff instead of the entire stylesheet.
  const declaration = text.split('\n').find((line) => line.startsWith('@layer ')) ?? '(none)';
  expect(declaration).to.contain(THEME_LAYER);
});

it('lets a consumer override win even when its stylesheet is declared first', async () => {
  const host = await fixture(html`<div></div>`);
  await loadThemeInto(document, 'consumer-first');
  const probe = document.createElement('span');
  probe.style.color = 'var(--lr-theme-color-brand-fill-loud)';
  host.append(probe);
  expect(getComputedStyle(probe).color).to.equal('rgb(1, 2, 3)');
});

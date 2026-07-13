import { fixture, expect, html } from '@open-wc/testing';
import './skeleton.js';
import type { LyraSkeleton } from './skeleton.js';
import { styles } from './skeleton.styles.js';

it('defaults to a text variant with a status role', async () => {
  const el = (await fixture(html`<lyra-skeleton></lyra-skeleton>`)) as LyraSkeleton;
  expect(el.variant).to.equal('text');
  expect(el.getAttribute('role')).to.equal('status');
});

it('applies explicit width/height as inline custom properties on the host', async () => {
  const el = (await fixture(
    html`<lyra-skeleton variant="circle" width="3rem" height="3rem"></lyra-skeleton>`,
  )) as LyraSkeleton;
  expect(el.style.getPropertyValue('--lyra-skeleton-w')).to.equal('3rem');
  expect(el.style.getPropertyValue('--lyra-skeleton-h')).to.equal('3rem');

  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const rect = el.getBoundingClientRect();
  expect(rect.width).to.be.closeTo(3 * rootFontSize, 1);
  expect(rect.height).to.be.closeTo(3 * rootFontSize, 1);
});

it('clears the width/height custom properties when width/height are unset', async () => {
  const el = (await fixture(
    html`<lyra-skeleton width="3rem" height="3rem"></lyra-skeleton>`,
  )) as LyraSkeleton;
  expect(el.style.getPropertyValue('--lyra-skeleton-w')).to.equal('3rem');
  expect(el.style.getPropertyValue('--lyra-skeleton-h')).to.equal('3rem');

  el.width = undefined;
  el.height = undefined;
  await el.updateComplete;

  expect(el.style.getPropertyValue('--lyra-skeleton-w')).to.equal('');
  expect(el.style.getPropertyValue('--lyra-skeleton-h')).to.equal('');

  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const rect = el.getBoundingClientRect();
  expect(rect.height).to.be.closeTo(rootFontSize, 1);
  expect(rect.width).to.be.greaterThan(3 * rootFontSize);
});

it('reflects variant onto the host attribute and gives each variant a distinct border-radius', async () => {
  const text = (await fixture(html`<lyra-skeleton variant="text"></lyra-skeleton>`)) as LyraSkeleton;
  expect(text.getAttribute('variant')).to.equal('text');
  const textRadius = getComputedStyle(text.shadowRoot!.querySelector('[part="base"]')!).borderRadius;

  const circle = (await fixture(
    html`<lyra-skeleton variant="circle"></lyra-skeleton>`,
  )) as LyraSkeleton;
  expect(circle.getAttribute('variant')).to.equal('circle');
  const circleRadius = getComputedStyle(circle.shadowRoot!.querySelector('[part="base"]')!).borderRadius;
  expect(circleRadius).to.equal('50%');
  expect(circleRadius).to.not.equal(textRadius);

  const rect = (await fixture(html`<lyra-skeleton variant="rect"></lyra-skeleton>`)) as LyraSkeleton;
  expect(rect.getAttribute('variant')).to.equal('rect');
  const rectRadius = getComputedStyle(rect.shadowRoot!.querySelector('[part="base"]')!).borderRadius;
  expect(rectRadius).to.equal(textRadius);
  expect(rectRadius).to.not.equal(circleRadius);
});

it('reflects effect onto the host attribute', async () => {
  const pulse = (await fixture(html`<lyra-skeleton effect="pulse"></lyra-skeleton>`)) as LyraSkeleton;
  expect(pulse.getAttribute('effect')).to.equal('pulse');

  const sheen = (await fixture(html`<lyra-skeleton effect="sheen"></lyra-skeleton>`)) as LyraSkeleton;
  expect(sheen.getAttribute('effect')).to.equal('sheen');
});

it('gives pulse and sheen distinct keyframe animations, disabled under reduced motion', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(
    "[part='base'] { animation: lyra-skeleton-pulse 1.5s ease-in-out infinite; }",
  );
  expect(css).to.include('background-image: linear-gradient(');
  expect(css).to.include('animation: lyra-skeleton-sheen 1.5s ease-in-out infinite;');
  expect(css).to.include(
    "@media (prefers-reduced-motion: reduce) { [part='base'] { animation: none !important; } " +
      ":host([effect='sheen']) [part='base'] { background-image: none; } }",
  );
});

it('defaults the accessible name to "Loading…" and reflects a custom label', async () => {
  const defaulted = (await fixture(html`<lyra-skeleton></lyra-skeleton>`)) as LyraSkeleton;
  expect(defaulted.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Loading…');

  const labeled = (await fixture(
    html`<lyra-skeleton label="Loading chart"></lyra-skeleton>`,
  )) as LyraSkeleton;
  expect(labeled.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Loading chart');
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-skeleton></lyra-skeleton>`)) as LyraSkeleton;
  await expect(el).to.be.accessible();
});

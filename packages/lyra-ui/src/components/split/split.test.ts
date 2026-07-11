import { fixture, expect, html, elementUpdated } from '@open-wc/testing';
import './split.js';
import type { LyraSplit } from './split.js';
import { styles } from './split.styles.js';

it('splits children evenly by default', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div><div>C</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  expect(el.sizes.length).to.equal(3);
  const sum = el.sizes.reduce((a, b) => a + b, 0);
  expect(Math.round(sum)).to.equal(100);
  expect(el.shadowRoot!.querySelectorAll('[part="divider"]').length).to.equal(2);
});

it('resizes via keyboard on a divider and emits lyra-resize', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  expect(divider.getAttribute('role')).to.equal('separator');
  const before = el.sizes[0];
  let detail: { sizes: number[] } | undefined;
  el.addEventListener('lyra-resize', (e) => (detail = (e as CustomEvent).detail));
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.be.greaterThan(before);
  expect(detail!.sizes[0]).to.equal(el.sizes[0]);
});

it('clamps panel sizes to the configured minimum', async () => {
  const el = (await fixture(
    html`<lyra-split min="20"><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  el.sizes = [20, 80];
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.equal(20);
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  await expect(el).to.be.accessible();
});

it('persists sizes to localStorage when storageKey is set', async () => {
  const storageKey = 'test-split-' + Math.random();
  localStorage.clear();

  const el = (await fixture(
    html`<lyra-split storage-key=${storageKey}><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);

  el.sizes = [25, 75];
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(el);

  const stored = localStorage.getItem(`lyra-split:${storageKey}:2`);
  expect(stored).to.not.be.null;
  const parsed = JSON.parse(stored!);
  expect(parsed).to.be.an('array');
  expect(parsed.length).to.equal(2);
});

it('supports vertical orientation with vertical arrow keys', async () => {
  const el = (await fixture(
    html`<lyra-split orientation="vertical"><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  expect(el.orientation).to.equal('vertical');

  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  const before = el.sizes[0];
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.be.greaterThan(before);
});

it('applies flex styles and interleaving order to panels', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div><div>C</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);

  const [panelA, panelB, panelC] = [...el.children] as HTMLElement[];
  expect(panelA.style.flex).to.include('%');
  // Panels sit at even order values (0, 2, 4…); dividers (rendered in the
  // shadow root) take the odd slots (1, 3…) in between, so flexbox
  // interleaves panel/divider/panel/divider/panel visually.
  expect(panelA.style.order).to.equal('0');
  expect(panelB.style.order).to.equal('2');
  expect(panelC.style.order).to.equal('4');
});

it('widens the horizontal divider hit area with a ::before without changing its visible 3px width', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;

  expect(getComputedStyle(divider).position).to.equal('relative');
  expect(getComputedStyle(divider).width).to.equal('3px');

  const before = getComputedStyle(divider, '::before');
  expect(before.content).to.not.equal('none');
  expect(before.position).to.equal('absolute');
  // resize axis (inline, i.e. left/right in horizontal orientation) is widened...
  expect(parseFloat(before.left)).to.be.lessThan(0);
  expect(parseFloat(before.right)).to.be.lessThan(0);
  // ...but the cross axis (block, i.e. top/bottom) is left flush, matching the divider's own box
  expect(before.top).to.equal('0px');
  expect(before.bottom).to.equal('0px');
});

it('widens the vertical divider hit area along the block axis instead', async () => {
  const el = (await fixture(
    html`<lyra-split orientation="vertical"><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;

  expect(getComputedStyle(divider).height).to.equal('3px');

  const before = getComputedStyle(divider, '::before');
  expect(before.content).to.not.equal('none');
  expect(parseFloat(before.top)).to.be.lessThan(0);
  expect(parseFloat(before.bottom)).to.be.lessThan(0);
  expect(before.left).to.equal('0px');
  expect(before.right).to.equal('0px');
});

it('splits :hover and :focus-visible into separate divider rules with a token-driven outline', () => {
  const css = styles.cssText;

  // The two states must no longer share one selector list.
  expect(css).to.not.match(/\[part=['"]?divider['"]?]:hover\s*,\s*\[part=['"]?divider['"]?]:focus-visible/);

  const hoverBlock = /\[part=['"]?divider['"]?]:hover\s*{([^}]*)}/.exec(css);
  expect(hoverBlock, 'expected a standalone [part="divider"]:hover rule').to.not.equal(null);
  expect(hoverBlock![1]).to.include('background');

  const focusVisibleBlock = /\[part=['"]?divider['"]?]:focus-visible\s*{([^}]*)}/.exec(css);
  expect(focusVisibleBlock, 'expected a standalone [part="divider"]:focus-visible rule').to.not.equal(null);
  const focusBody = focusVisibleBlock![1];

  // No more `outline: none` on focus-visible...
  expect(focusBody).to.not.include('outline: none');
  // ...it now uses the exact shared focus-ring tokens, not hardcoded literals.
  expect(focusBody).to.include('var(--lyra-focus-ring-width)');
  expect(focusBody).to.include('var(--lyra-focus-ring-color)');
  expect(focusBody).to.include('outline-offset: var(--lyra-focus-ring-offset)');
});

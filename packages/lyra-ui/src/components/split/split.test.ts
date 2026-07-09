import { fixture, expect, html, elementUpdated } from '@open-wc/testing';
import './split.js';
import type { LyraSplit } from './split.js';

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

it('applies flex styles to panels with correct percentages', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);

  const panelA = el.children[0] as HTMLElement;
  expect(panelA.getAttribute('part')).to.equal('panel');
  expect(panelA.style.flex).to.include('50%');
});

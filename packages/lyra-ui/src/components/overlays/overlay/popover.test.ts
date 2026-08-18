import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './popover.js';
import { LyraPopover } from './popover.class.js';

function trigger(el: LyraPopover): HTMLButtonElement {
  return el.querySelector('[slot="trigger"]') as HTMLButtonElement;
}

function popup(el: LyraPopover): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
}

async function basic(): Promise<LyraPopover> {
  return fixture(html`
    <lr-popover style="--show-duration: 0ms; --hide-duration: 0ms">
      <button slot="trigger">Open</button>
      <p>Details</p>
    </lr-popover>
  `) as Promise<LyraPopover>;
}

// This file is the colocated `popover.class.ts` test once it exists (scripts/check-source-policy.mjs's
// `colocatedTestSource()` prefers an exact `popover.test.ts` over scanning the whole directory), so it
// carries the class's own keydown-wiring and this.localize() coverage directly rather than relying on
// overlay.test.ts's equivalent cases.

it('dispatches a trigger keydown without throwing; generic popovers stay click-only', async () => {
  const el = await basic();
  expect(() =>
    trigger(el).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    ),
  ).not.to.throw();
  await el.updateComplete;
  expect(el.open).to.equal(false);
});

it('reaches a .strings override for the localized popup aria-label fallback', async () => {
  const el = await basic();
  expect(popup(el).getAttribute('aria-label')).to.equal('Popover');

  el.strings = { popover: 'Localized fallback' };
  await el.updateComplete;
  expect(popup(el).getAttribute('aria-label')).to.equal('Localized fallback');
});

// `disabled` mirrors `<lr-tooltip>`'s own property of the same name (and, until this change,
// `<lr-dropdown>`'s own redeclared getter/setter pair) -- see tooltip.test.ts's matching cases.

it('disabled blocks pointer-triggered opening', async () => {
  const el = await basic();
  el.disabled = true;
  await el.updateComplete;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.equal(false);
});

it('disabled blocks programmatic show() and a direct open=true assignment', async () => {
  const el = await basic();
  el.disabled = true;
  await el.updateComplete;

  await el.show();
  expect(el.open).to.equal(false);

  el.open = true;
  await el.updateComplete;
  expect(el.open).to.equal(false);
});

it('closes an already-rendered open popover immediately when disabled is set afterward', async () => {
  const el = await basic();
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.equal(true);

  el.disabled = true;
  await el.updateComplete;
  expect(el.open).to.equal(false);
});

it('closes a popover that starts both open and disabled before its very first update runs', async () => {
  const el = (await fixture(html`
    <lr-popover open disabled style="--show-duration: 0ms; --hide-duration: 0ms">
      <button slot="trigger">Open</button>
      <p>Details</p>
    </lr-popover>
  `)) as LyraPopover;
  await el.updateComplete;
  expect(el.open).to.equal(false);
  expect(el.hasAttribute('open')).to.equal(false);
});

it('normalizes disabled plus open initial markup to closed in either attribute order', async () => {
  const cases = [
    html`<lr-popover disabled open style="--show-duration: 0ms; --hide-duration: 0ms">
      <button slot="trigger">Open</button>
      <p>Details</p>
    </lr-popover>`,
    html`<lr-popover open disabled style="--show-duration: 0ms; --hide-duration: 0ms">
      <button slot="trigger">Open</button>
      <p>Details</p>
    </lr-popover>`,
  ];
  for (const [index, template] of cases.entries()) {
    const el = (await fixture(template)) as LyraPopover;
    await el.updateComplete;
    expect(el.open, `case ${index}`).to.equal(false);
    expect(el.hasAttribute('open'), `case ${index}`).to.equal(false);
  }
});

it('reflects disabled as an attribute, defaulting to false', async () => {
  const el = await basic();
  expect(el.disabled).to.equal(false);
  expect(el.hasAttribute('disabled')).to.equal(false);

  el.disabled = true;
  await el.updateComplete;
  expect(el.hasAttribute('disabled')).to.equal(true);

  el.disabled = false;
  await el.updateComplete;
  expect(el.hasAttribute('disabled')).to.equal(false);
});

// Unset-regression (AGENTS.md/testing.md): a generic popover's positioning strategy was always
// unconditionally 'fixed' before `disabled` existed, driven entirely by `canOpen`. Adding
// `disabled` (which now gates `canOpen`) must not change that when left unset.
it('defaults disabled to false, leaving open and positioning behavior unchanged', async () => {
  const el = await basic();
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.equal(true);
  await waitUntil(() => !popup(el).hasAttribute('data-hidden'));
  expect(popup(el).style.position).to.equal('fixed');
});

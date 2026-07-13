import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './export-button.js';
import type { LyraExportButton } from './export-button.js';

const rows = [{ id: 'a', name: 'Alpha' }];
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
];

it('emits lyra-export then lyra-export-complete for a single format', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.rows = rows;
  el.columns = columns;
  await el.updateComplete;
  const btn = el.shadowRoot!.querySelector('button') as HTMLButtonElement;
  const exportEvent = oneEvent(el, 'lyra-export');
  const completeEvent = oneEvent(el, 'lyra-export-complete');
  btn.click();
  const ev = await exportEvent;
  expect(ev.detail.format).to.equal('csv');
  await completeEvent;
});

it('suppresses the built-in download when lyra-export is cancelled', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.rows = rows;
  el.columns = columns;
  el.addEventListener('lyra-export', (e) => e.preventDefault());
  await el.updateComplete;
  let completed = false;
  el.addEventListener('lyra-export-complete', () => (completed = true));
  const btn = el.shadowRoot!.querySelector('button') as HTMLButtonElement;
  btn.click();
  await new Promise((r) => setTimeout(r, 10));
  expect(completed).to.be.false;
});

it('offers a format menu when multiple formats are configured', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="menu-item"]').length).to.equal(2);
});

it('reflects open as a host attribute so the menu becomes visible', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.hasAttribute('open')).to.be.true;
  const menu = el.shadowRoot!.querySelector('[part="menu"]') as HTMLElement;
  expect(getComputedStyle(menu).visibility).to.equal('visible');
});

it('closes the menu on an outside pointerdown', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('closes on an outside pointerdown even when opened via the `open` property directly', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;

  // Bypasses openMenu()/the trigger click entirely -- `open` is a public,
  // reflect: true property, so setting it directly is valid API surface.
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('closes on Escape and returns focus to the trigger', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.shadowRoot!.activeElement).to.equal(trigger);
});

it('closes the menu and returns focus to the trigger after picking a format', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.rows = rows;
  el.columns = columns;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const menuItem = el.shadowRoot!.querySelector('[part="menu-item"]') as HTMLButtonElement;
  menuItem.click();
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(el.shadowRoot!.activeElement).to.equal(trigger);
});

it('exports JSON and applies the same columns allow-list CSV uses', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.rows = [{ id: 'a', name: 'Alpha', secret: 'shh' }];
  el.columns = columns;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;

  const menuItems = Array.from(el.shadowRoot!.querySelectorAll('[part="menu-item"]')) as HTMLButtonElement[];
  const jsonButton = menuItems.find((b) => b.textContent?.trim() === 'JSON')!;

  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  let capturedBlob: Blob | undefined;
  URL.createObjectURL = (blob: Blob) => {
    capturedBlob = blob;
    return originalCreateObjectURL(blob);
  };
  const completeEvent = oneEvent(el, 'lyra-export-complete');
  try {
    jsonButton.click();
    await completeEvent;
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
  }

  expect(capturedBlob).to.exist;
  const text = await capturedBlob!.text();
  expect(JSON.parse(text)).to.deep.equal([{ id: 'a', name: 'Alpha' }]);
});

it('derives CSV columns from the rows own keys when `columns` is left at its default empty array', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.rows = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
  ];
  // `columns` is intentionally left unset (its default `[]`).
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;

  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  let capturedBlob: Blob | undefined;
  URL.createObjectURL = (blob: Blob) => {
    capturedBlob = blob;
    return originalCreateObjectURL(blob);
  };
  const completeEvent = oneEvent(el, 'lyra-export-complete');
  try {
    trigger.click();
    await completeEvent;
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
  }

  expect(capturedBlob).to.exist;
  const text = await capturedBlob!.text();
  expect(text).to.equal('id,name\r\na,Alpha\r\nb,Beta');
});

it('blocks export via an already-open menu item once disabled is set, even without a re-render', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.rows = rows;
  el.columns = columns;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  el.disabled = true;
  await el.updateComplete;

  let exported = false;
  el.addEventListener('lyra-export', () => (exported = true));
  const menuItem = el.shadowRoot!.querySelector('[part="menu-item"]') as HTMLButtonElement;
  menuItem.click();
  await el.updateComplete;
  expect(exported).to.be.false;
});

it('closes the menu on Tab without preventing default', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const menuItem = el.shadowRoot!.querySelector('[part="menu-item"]') as HTMLButtonElement;
  const tabEvent = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  menuItem.dispatchEvent(tabEvent);
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(tabEvent.defaultPrevented).to.be.false;
});

it('does not open the menu or export when disabled', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.rows = rows;
  el.columns = columns;
  el.formats = ['csv', 'json'];
  el.disabled = true;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(trigger.disabled).to.be.true;

  let exported = false;
  el.addEventListener('lyra-export', () => (exported = true));
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(exported).to.be.false;
});

it('removes the document pointerdown listener on disconnect', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  // Spy on document.removeEventListener directly -- checking `el.open` alone
  // is no longer a valid proxy for "was the listener removed" now that
  // disconnectedCallback() also resets `open` to `false` itself (that reset
  // would make closeMenu()'s own `if (!this.open) return;` guard mask a
  // leaked listener, since `open` is already false before any dispatch).
  const originalRemove = document.removeEventListener.bind(document);
  let removedPointerdown = false;
  document.removeEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) => {
    if (type === 'pointerdown') removedPointerdown = true;
    return originalRemove(type, listener, options);
  }) as typeof document.removeEventListener;

  try {
    el.remove();
  } finally {
    document.removeEventListener = originalRemove;
  }

  expect(removedPointerdown).to.be.true;
  expect(el.open).to.be.false;
});

it('exposes aria-haspopup/aria-expanded only when a menu exists', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(trigger.getAttribute('aria-haspopup')).to.equal('menu');
  expect(trigger.getAttribute('aria-expanded')).to.equal('false');
  trigger.click();
  await el.updateComplete;
  expect(trigger.getAttribute('aria-expanded')).to.equal('true');

  el.formats = ['csv'];
  await el.updateComplete;
  const singleTrigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(singleTrigger.hasAttribute('aria-haspopup')).to.be.false;
  expect(singleTrigger.hasAttribute('aria-expanded')).to.be.false;
});

it('animates the menu open/closed with an opacity+transform transition', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const menu = el.shadowRoot!.querySelector('[part="menu"]') as HTMLElement;

  const closedStyle = getComputedStyle(menu);
  expect(closedStyle.opacity).to.equal('0');
  expect(closedStyle.transitionDuration).to.not.equal('0s');

  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  // visibility keeps the element in the render tree while opacity/transform
  // are closed, so opening it now genuinely runs a transition instead of
  // snapping instantly -- wait for it to finish before reading the end value.
  const transitionEnd = oneEvent(menu, 'transitionend');
  trigger.click();
  await el.updateComplete;
  await transitionEnd;
  expect(getComputedStyle(menu).opacity).to.equal('1');
});

it('shows a focus ring on the trigger via :focus-visible', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.focus();
  await el.updateComplete;
  const style = getComputedStyle(trigger);
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('shows a focus ring on menu items via :focus-visible', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  const menuItem = el.shadowRoot!.querySelector('[part="menu-item"]') as HTMLButtonElement;
  menuItem.focus();
  await el.updateComplete;
  const style = getComputedStyle(menuItem);
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('links the trigger to the menu via aria-controls/id only when a menu exists', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  const menu = el.shadowRoot!.querySelector('[part="menu"]') as HTMLElement;
  expect(trigger.getAttribute('aria-controls')).to.equal(menu.id);
  expect(menu.id).to.not.equal('');

  el.formats = ['csv'];
  await el.updateComplete;
  const singleTrigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(singleTrigger.hasAttribute('aria-controls')).to.be.false;
});

it('opens the menu and focuses the first item on ArrowDown from the trigger', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.focus();

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;

  expect(el.open).to.be.true;
  const items = Array.from(el.shadowRoot!.querySelectorAll('[part="menu-item"]')) as HTMLButtonElement[];
  expect(el.shadowRoot!.activeElement).to.equal(items[0]);
});

it('opens the menu and focuses the last item on ArrowUp from the trigger', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.focus();

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
  await el.updateComplete;

  expect(el.open).to.be.true;
  const items = Array.from(el.shadowRoot!.querySelectorAll('[part="menu-item"]')) as HTMLButtonElement[];
  expect(el.shadowRoot!.activeElement).to.equal(items[items.length - 1]);
});

it('moves focus between open menu items with ArrowDown/ArrowUp, and jumps with Home/End', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;

  const items = Array.from(el.shadowRoot!.querySelectorAll('[part="menu-item"]')) as HTMLButtonElement[];
  expect(el.shadowRoot!.activeElement).to.equal(items[0]);

  items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(items[1]);

  items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(items[0]);

  items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(items[items.length - 1]);

  items[items.length - 1].dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }),
  );
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(items[0]);
});

it('resets to closed on disconnect and re-binds the outside-click listener when reopened after reconnect', async () => {
  const el = (await fixture(
    html`<lyra-export-button open .formats=${['csv', 'json']}></lyra-export-button>`,
  )) as LyraExportButton;
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  // The real, discriminating check: a leftover inline `position` style is set
  // once on first open and never cleared either way, so it can't tell a fixed
  // reconnect apart from the pre-fix bug (which left `open` stuck `true`
  // across the whole cycle). `open` itself is what the fix actually resets.
  expect(el.open).to.be.false;

  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.true;
  // Confirms the outside-click listener was genuinely re-armed by this fresh
  // open, not left stale/leaked from before the reconnect.
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  expect(el.open).to.be.false;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  await expect(el).to.be.accessible();
});

it('is accessible with a multi-format menu open, including its accessible name', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  el.open = true;
  await el.updateComplete;
  const menu = el.shadowRoot!.querySelector('[part="menu"]') as HTMLElement;
  expect(menu.getAttribute('aria-label')).to.equal('Export format');
  await expect(el).to.be.accessible();
});

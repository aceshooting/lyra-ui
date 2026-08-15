import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './export-button.js';
import type { LyraExportButton } from './export-button.js';
import { styles } from './export-button.styles.js';

const rows = [{ id: 'a', name: 'Alpha' }];
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
];

it('emits lr-export then lr-export-complete for a single format', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.rows = rows;
  el.columns = columns;
  await el.updateComplete;
  const btn = el.shadowRoot!.querySelector('button') as HTMLButtonElement;
  const exportEvent = oneEvent(el, 'lr-export');
  const completeEvent = oneEvent(el, 'lr-export-complete');
  btn.click();
  const ev = await exportEvent;
  expect(ev.detail.format).to.equal('csv');
  expect(Object.isFrozen(ev.detail)).to.equal(true);
  await completeEvent;
});

it('suppresses the built-in download when lr-export is cancelled', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.rows = rows;
  el.columns = columns;
  el.addEventListener('lr-export', (e) => e.preventDefault());
  await el.updateComplete;
  let completed = false;
  el.addEventListener('lr-export-complete', () => (completed = true));
  const btn = el.shadowRoot!.querySelector('button') as HTMLButtonElement;
  btn.click();
  await new Promise((r) => setTimeout(r, 10));
  expect(completed).to.be.false;
});

it('offers a format menu when multiple formats are configured', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="menu-item"]').length).to.equal(2);
});

it('renders custom format descriptors and carries their formatId through lr-export', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = [
    'csv',
    { formatId: 'xlsx', label: 'Excel', description: 'Native spreadsheet format', extension: 'xlsx' },
  ];
  await el.updateComplete;
  const items = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="menu-item"]')];
  expect(items[1]!.querySelector('[part="format-label"]')!.textContent).to.equal('Excel');
  expect(items[1]!.querySelector('[part="format-description"]')!.textContent).to.equal(
    'Native spreadsheet format',
  );
  const exportEvent = oneEvent(el, 'lr-export');
  items[1]!.click();
  expect((await exportEvent).detail.format).to.equal('xlsx');
});

it('owns frozen collection snapshots instead of retaining caller-owned arrays', async () => {
  const sourceRows = [{ id: 'a' }];
  const sourceColumns = [{ key: 'id', label: 'ID' }];
  const sourceFormats = [{ formatId: 'xlsx', label: 'Excel' }];
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.rows = sourceRows;
  el.columns = sourceColumns;
  el.formats = sourceFormats;
  await el.updateComplete;

  sourceRows.push({ id: 'b' });
  sourceColumns.push({ key: 'name', label: 'Name' });
  sourceFormats.push({ formatId: 'pdf', label: 'PDF' });
  sourceColumns[0]!.label = 'Mutated';
  sourceFormats[0]!.label = 'Mutated';
  sourceRows[0]!.id = 'mutated';

  expect(el.rows.length).to.equal(1);
  expect(el.rows[0]!.id).to.equal('a');
  expect(el.columns.map((column) => column.label)).to.deep.equal(['ID']);
  expect(el.formats.map((format) => (typeof format === 'string' ? format : format.label))).to.deep.equal(['Excel']);
  expect(Object.isFrozen(el.rows)).to.equal(true);
  expect(Object.isFrozen(el.rows[0])).to.equal(true);
  expect(Object.isFrozen(el.columns)).to.equal(true);
  expect(Object.isFrozen(el.columns[0])).to.equal(true);
  expect(Object.isFrozen(el.formats)).to.equal(true);
  expect(Object.isFrozen(el.formats[0])).to.equal(true);
});

it('disables activation and exposes busy state while loading', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.loading = true;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(trigger.disabled).to.be.true;
  expect(trigger.getAttribute('aria-busy')).to.equal('true');
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(el.hasAttribute('loading')).to.be.true;
  let exported = false;
  el.addEventListener('lr-export', () => (exported = true));
  trigger.click();
  expect(exported).to.be.false;
  el.loading = false;
  await el.updateComplete;
  expect(trigger.getAttribute('aria-busy')).to.equal('false');
  expect(el.getAttribute('aria-busy')).to.equal('false');
});

it('preserves focus ownership when loading/disabled invalidates the focused control', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  (el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement).click();
  await el.updateComplete;
  const item = el.shadowRoot!.querySelector('[part="menu-item"]') as HTMLButtonElement;
  item.focus();

  el.loading = true;
  await el.updateComplete;
  expect(document.activeElement?.tagName).to.equal('LR-EXPORT-BUTTON');
  expect(el.open).to.be.false;
  expect(el.getAttribute('tabindex')).to.equal('-1');

  el.loading = false;
  await el.updateComplete;
  expect(el.hasAttribute('tabindex')).to.be.false;
  el.focus();
  expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part')).to.equal('trigger');
  el.disabled = true;
  await el.updateComplete;
  expect(document.activeElement?.tagName).to.equal('LR-EXPORT-BUTTON');
});

it('preserves an author-owned host tabindex across disable and re-enable', async () => {
  const el = (await fixture(
    html`<lr-export-button tabindex="3"></lr-export-button>`,
  )) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  (el.shadowRoot!.querySelector('[part="menu-item"]') as HTMLButtonElement).focus();

  el.disabled = true;
  await el.updateComplete;
  expect(el.getAttribute('tabindex')).to.equal('3');

  el.disabled = false;
  await el.updateComplete;
  expect(el.getAttribute('tabindex')).to.equal('3');
});

it('preserves focus ownership when the owner realm exposes focus through a receiver-sensitive accessor', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  const item = el.shadowRoot!.querySelector('[part="menu-item"]') as HTMLButtonElement;
  item.focus();

  const ownerWindow = el.ownerDocument.defaultView!;
  const prototype = ownerWindow.HTMLElement.prototype;
  const focusDescriptor = Object.getOwnPropertyDescriptor(prototype, 'focus')!;
  const nativeFocus = Reflect.get(prototype, 'focus', el) as HTMLElement['focus'];
  Object.defineProperty(prototype, 'focus', {
    configurable: true,
    enumerable: focusDescriptor.enumerable,
    get(this: HTMLElement) {
      if (!(this instanceof ownerWindow.HTMLElement)) throw new TypeError('Illegal invocation');
      return nativeFocus;
    },
  });

  try {
    el.loading = true;
    await el.updateComplete;
    expect(el.ownerDocument.activeElement?.tagName).to.equal('LR-EXPORT-BUTTON');
  } finally {
    Object.defineProperty(prototype, 'focus', focusDescriptor);
  }
});

it('rejects open state when there is no format menu and emits no show event', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  let shows = 0;
  el.addEventListener('lr-show', () => shows++);
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="menu"]')) == null).to.be.true;
  expect(shows).to.equal(0);
});

it('closes stale open state when formats shrink without a focused menu item', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="outside">Outside</button>
      <lr-export-button></lr-export-button>
    </div>
  `);
  const el = wrapper.querySelector('lr-export-button') as LyraExportButton;
  const outside = wrapper.querySelector('#outside') as HTMLButtonElement;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  outside.focus();
  expect(document.activeElement?.id).to.equal('outside');

  el.formats = ['csv'];
  await el.updateComplete;
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
});

it('reflects open as a host attribute so the menu becomes visible', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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

it('binds outside-pointer dismissal to the adopted owner document', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = document.createElement('lr-export-button') as LyraExportButton;
  el.formats = ['csv', 'json'];

  try {
    document.body.append(el);
    await el.updateComplete;
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    frameDocument.body.dispatchEvent(
      new frameWindow.PointerEvent('pointerdown', { bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(el.open).to.be.false;
  } finally {
    el.remove();
    frame.remove();
  }
});

it('rescues focus from an iframe-realm menu row when disabled after adoption before first render', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const el = document.createElement('lr-export-button') as LyraExportButton;
  el.formats = ['csv', 'json'];
  // Attach Lit's defining-realm stylesheet before adoption without performing a render. The first
  // actual update then creates native controls in the iframe realm.
  const lifecycle = el as unknown as {
    renderRoot: HTMLElement | DocumentFragment;
    createRenderRoot(): ShadowRoot;
  };
  lifecycle.renderRoot = lifecycle.createRenderRoot();
  expect(el.hasUpdated).to.be.false;

  try {
    frameDocument.adoptNode(el);
    frameDocument.body.append(el);
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="menu-item"]') as HTMLButtonElement;
    row.focus();
    expect(el.shadowRoot!.activeElement === row).to.equal(true);

    el.disabled = true;
    await el.updateComplete;
    expect(frameDocument.activeElement === el).to.equal(true);
  } finally {
    el.remove();
    frame.remove();
  }
});

it('creates built-in export resources and schedules revocation in the adopted owner realm', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const url = frameWindow.URL;
  const createDescriptor = Object.getOwnPropertyDescriptor(url, 'createObjectURL');
  const revokeDescriptor = Object.getOwnPropertyDescriptor(url, 'revokeObjectURL');
  const clickDescriptor = Object.getOwnPropertyDescriptor(
    frameWindow.HTMLAnchorElement.prototype,
    'click',
  );
  const timerDescriptor = Object.getOwnPropertyDescriptor(frameWindow, 'setTimeout');
  let ownerBlob = false;
  let clickedAnchor: HTMLAnchorElement | undefined;
  let timerDelay: number | undefined;
  let scheduled: TimerHandler | undefined;
  let revoked = '';
  Object.defineProperty(url, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => {
      ownerBlob = blob instanceof frameWindow.Blob;
      return 'blob:owner-realm-export';
    },
  });
  Object.defineProperty(url, 'revokeObjectURL', {
    configurable: true,
    value: (value: string) => {
      revoked = value;
    },
  });
  Object.defineProperty(frameWindow.HTMLAnchorElement.prototype, 'click', {
    configurable: true,
    value(this: HTMLAnchorElement) {
      clickedAnchor = this;
    },
  });
  Object.defineProperty(frameWindow, 'setTimeout', {
    configurable: true,
    value: (handler: TimerHandler, timeout?: number) => {
      scheduled = handler;
      timerDelay = timeout;
      return 1;
    },
  });

  const el = document.createElement('lr-export-button') as LyraExportButton;
  el.rows = rows;
  el.columns = columns;
  const lifecycle = el as unknown as {
    renderRoot: HTMLElement | DocumentFragment;
    createRenderRoot(): ShadowRoot;
  };
  lifecycle.renderRoot = lifecycle.createRenderRoot();
  try {
    frameDocument.adoptNode(el);
    frameDocument.body.append(el);
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement).click();

    expect(ownerBlob).to.be.true;
    expect(clickedAnchor?.ownerDocument === frameDocument).to.equal(true);
    expect(clickedAnchor?.download).to.equal('export.csv');
    expect(timerDelay).to.equal(5000);
    if (typeof scheduled === 'function') scheduled();
    expect(revoked).to.equal('blob:owner-realm-export');
  } finally {
    el.remove();
    if (createDescriptor) Object.defineProperty(url, 'createObjectURL', createDescriptor);
    if (revokeDescriptor) Object.defineProperty(url, 'revokeObjectURL', revokeDescriptor);
    if (clickDescriptor) {
      Object.defineProperty(frameWindow.HTMLAnchorElement.prototype, 'click', clickDescriptor);
    }
    if (timerDescriptor) Object.defineProperty(frameWindow, 'setTimeout', timerDescriptor);
    frame.remove();
  }
});

it('closes on an outside pointerdown even when opened via the `open` property directly', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect((el.shadowRoot!.activeElement) === (trigger)).to.equal(true);
});

it('closes the menu and returns focus to the trigger after picking a format', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  expect((el.shadowRoot!.activeElement) === (trigger)).to.equal(true);
});

it('exports JSON and applies the same columns allow-list CSV uses', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  const completeEvent = oneEvent(el, 'lr-export-complete');
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

it('preserves an own enumerable "__proto__" column in JSON exports', async () => {
  const row = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(row, '__proto__', {
    value: { retained: true },
    enumerable: true,
    writable: true,
    configurable: true,
  });
  row['safe'] = 'value';
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.rows = [row];
  el.columns = [
    { key: '__proto__', label: '__proto__' },
    { key: 'safe', label: 'safe' },
  ];
  el.formats = ['json'];
  await el.updateComplete;

  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  let capturedBlob: Blob | undefined;
  URL.createObjectURL = (blob: Blob) => {
    capturedBlob = blob;
    return originalCreateObjectURL(blob);
  };
  const complete = oneEvent(el, 'lr-export-complete');
  try {
    (el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement).click();
    await complete;
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
  }

  const parsed = JSON.parse(await capturedBlob!.text()) as Record<string, unknown>[];
  expect(Object.prototype.hasOwnProperty.call(parsed[0], '__proto__')).to.be.true;
  expect(parsed[0]!['__proto__']).to.deep.equal({ retained: true });
  expect(parsed[0]!['safe']).to.equal('value');
});

it('reports non-serializable built-in JSON data through lr-export-error without throwing or completing', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.rows = [{ id: 'a', count: 10n }];
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  (el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement).click();
  await el.updateComplete;

  let completed = false;
  el.addEventListener('lr-export-complete', () => (completed = true));
  const errorEvent = oneEvent(el, 'lr-export-error');
  const jsonButton = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="menu-item"]')].find(
    (button) => button.textContent?.trim() === 'JSON',
  )!;

  expect(() => jsonButton.click()).to.not.throw();
  const event = await errorEvent;
  expect(event.detail.format).to.equal('json');
  expect(event.detail.error).to.be.instanceOf(Error);
  expect(completed).to.be.false;
});

it('derives CSV columns from the rows own keys when `columns` is left at its default empty array', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  const completeEvent = oneEvent(el, 'lr-export-complete');
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
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  el.addEventListener('lr-export', () => (exported = true));
  const menuItem = el.shadowRoot!.querySelector('[part="menu-item"]') as HTMLButtonElement;
  menuItem.click();
  await el.updateComplete;
  expect(exported).to.be.false;
});

it('closes the menu on Tab without preventing default', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.rows = rows;
  el.columns = columns;
  el.formats = ['csv', 'json'];
  el.disabled = true;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(trigger.disabled).to.be.true;

  let exported = false;
  el.addEventListener('lr-export', () => (exported = true));
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(exported).to.be.false;
});

it('removes the document pointerdown listener on disconnect', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.focus();
  await el.updateComplete;
  const style = getComputedStyle(trigger);
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('shows a focus ring on menu items via :focus-visible', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
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
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.focus();

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;

  expect(el.open).to.be.true;
  const items = Array.from(el.shadowRoot!.querySelectorAll('[part="menu-item"]')) as HTMLButtonElement[];
  expect((el.shadowRoot!.activeElement) === (items[0])).to.equal(true);
});

it('opens the menu and focuses the last item on ArrowUp from the trigger', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.focus();

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
  await el.updateComplete;

  expect(el.open).to.be.true;
  const items = Array.from(el.shadowRoot!.querySelectorAll('[part="menu-item"]')) as HTMLButtonElement[];
  expect((el.shadowRoot!.activeElement) === (items[items.length - 1])).to.equal(true);
});

it('moves focus between open menu items with ArrowDown/ArrowUp, and jumps with Home/End', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;

  const items = Array.from(el.shadowRoot!.querySelectorAll('[part="menu-item"]')) as HTMLButtonElement[];
  expect((el.shadowRoot!.activeElement) === (items[0])).to.equal(true);

  items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((el.shadowRoot!.activeElement) === (items[1])).to.equal(true);

  items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((el.shadowRoot!.activeElement) === (items[0])).to.equal(true);

  items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((el.shadowRoot!.activeElement) === (items[items.length - 1])).to.equal(true);

  items[items.length - 1].dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }),
  );
  await el.updateComplete;
  expect((el.shadowRoot!.activeElement) === (items[0])).to.equal(true);
});

it('transfers focus to a surviving menu item when the focused format is removed', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  el.open = true;
  await el.updateComplete;
  const items = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="menu-item"]')];
  items[1]!.focus();
  expect((el.shadowRoot!.activeElement) === (items[1])).to.equal(true);

  el.formats = ['csv', { formatId: 'xml', label: 'XML' }];
  await el.updateComplete;

  const survivingItems = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="menu-item"]')];
  expect((el.shadowRoot!.activeElement) === (survivingItems[1])).to.equal(true);
  expect(survivingItems[1]!.textContent!.trim()).to.equal('XML');
});

it('returns focus to the trigger when an open menu collapses to a single format', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  el.open = true;
  await el.updateComplete;
  const item = el.shadowRoot!.querySelector('[part="menu-item"]') as HTMLButtonElement;
  item.focus();

  el.formats = ['csv'];
  await el.updateComplete;
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect((el.shadowRoot!.activeElement) === (el.shadowRoot!.querySelector('[part="trigger"]'))).to.equal(true);
});

it('resets to closed on disconnect and re-binds the outside-click listener when reopened after reconnect', async () => {
  const el = (await fixture(
    html`<lr-export-button open .formats=${['csv', 'json']}></lr-export-button>`,
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
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  await expect(el).to.be.accessible();
});

it('is accessible with a multi-format menu open, including its accessible name', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  el.open = true;
  await el.updateComplete;
  const menu = el.shadowRoot!.querySelector('[part="menu"]') as HTMLElement;
  expect(menu.getAttribute('aria-label')).to.equal('Export format');
  // `[part='menu']`'s opacity transition (gated by :host([open])) is still running right after
  // `open` is set and the update settles. Left running, axe's color-contrast check factors in the
  // menu's current (transitional) opacity, so sampling mid-fade blends its text and background
  // toward each other and reports a false "serious" violation. Finishing it outright matches the
  // idiom overlay.test.ts already uses for this same kind of reveal animation.
  menu.getAnimations().forEach((animation) => animation.finish());
  await expect(el).to.be.accessible();
});

it('forwards a host aria-label to the trigger and derives the menu name from it', async () => {
  const el = (await fixture(html`
    <lr-export-button
      aria-label="Download metrics"
      .formats=${['csv', 'json']}
    ></lr-export-button>
  `)) as LyraExportButton;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  const menu = el.shadowRoot!.querySelector('[part="menu"]') as HTMLElement;
  expect(trigger.getAttribute('aria-label')).to.equal('Download metrics');
  expect(trigger.textContent!.trim()).to.equal('Export');
  expect(menu.getAttribute('aria-label')).to.equal('Download metrics format');
});

it('preserves an explicit empty host aria-label and restores visible-text naming on removal', async () => {
  const el = (await fixture(html`
    <lr-export-button aria-label="" .formats=${['csv', 'json']}></lr-export-button>
  `)) as LyraExportButton;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(trigger.getAttribute('aria-label')).to.equal('');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(trigger.getAttribute('aria-label')).to.equal(null);
  expect(trigger.textContent!.trim()).to.equal('Export');
});

it('focus() delegates to the native trigger button', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');
});

it('click() delegates to the native trigger and respects its disabled state', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  let exports = 0;
  el.addEventListener('lr-export', (event) => {
    event.preventDefault();
    exports++;
  });
  el.click();
  expect(exports).to.equal(1);

  el.disabled = true;
  await el.updateComplete;
  el.click();
  expect(exports).to.equal(1);
});

it('gives the trigger and menu items the shared minimum hit area', async () => {
  const el = (await fixture(
    html`<lr-export-button open .formats=${['csv', 'json']}></lr-export-button>`,
  )) as LyraExportButton;
  for (const control of el.shadowRoot!.querySelectorAll<HTMLElement>(
    '[part="trigger"], [part="menu-item"]',
  )) {
    const computed = getComputedStyle(control);
    expect(computed.minInlineSize).to.equal('40px');
    expect(computed.minBlockSize).to.equal('40px');
  }
});

it('bounds and wraps a long format menu within the positioner available inline size', () => {
  const css = styles.cssText
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
  expect(css).to.include(
    'max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-20rem), var(--lr-positioner-available-inline-size, 100vw));',
  );
  expect(css).to.include('overflow-wrap: anywhere;');
  expect(css).to.include("[part='menu-item'] { display: flex; flex-direction: column;");
  expect(css).to.include('box-sizing: border-box;');
});

describe('label localization', () => {
  it('defaults the trigger button text to the built-in English "Export"', async () => {
    const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
    const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
    expect(trigger.textContent!.trim()).to.equal('Export');
  });

  it('localizes the default trigger label via .strings (exportButtonLabel) when label is left unset', async () => {
    const el = (await fixture(html`
      <lr-export-button .strings=${{ exportButtonLabel: 'Exporter' }}></lr-export-button>
    `)) as LyraExportButton;
    const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
    expect(trigger.textContent!.trim()).to.equal('Exporter');
  });

  it('still honors an explicit label attribute when no .strings override applies', async () => {
    const el = (await fixture(
      html`<lr-export-button label="Télécharger"></lr-export-button>`,
    )) as LyraExportButton;
    const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
    expect(trigger.textContent!.trim()).to.equal('Télécharger');
  });

  it('keeps every explicit label caller-owned, including the old English default and empty text', async () => {
    const el = (await fixture(html`
      <lr-export-button label="Télécharger" .strings=${{ exportButtonLabel: 'Exporter' }}></lr-export-button>
    `)) as LyraExportButton;
    const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
    expect(trigger.textContent!.trim()).to.equal('Télécharger');

    el.label = 'Export';
    await el.updateComplete;
    expect(trigger.textContent!.trim()).to.equal('Export');

    el.label = '';
    await el.updateComplete;
    expect(trigger.textContent!.trim()).to.equal('');
  });
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. Wired to --lr-popover-viewport-clamp the min() collapses to that
 *  pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement('span');
  probe.style.display = 'block';
  probe.style.setProperty('--lr-popover-viewport-clamp', '10px');
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it('clamps its floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  expect(renderedClamp(el, "[part='menu']")).to.equal('10px');
});

it('blur() releases the native trigger it focused', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  await el.updateComplete;
  el.focus();
  expect((el.shadowRoot!.activeElement) != null).to.equal(true);
  el.blur();
  expect((el.shadowRoot!.activeElement) === null).to.equal(true);
});

const twoFormats = [
  { formatId: 'csv', label: 'CSV' },
  { formatId: 'json', label: 'JSON' },
] as unknown as LyraExportButton['formats'];

it('honours preventDefault() on lr-show and lr-hide for the format menu', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = twoFormats;
  await el.updateComplete;

  el.addEventListener('lr-show', (event) => event.preventDefault(), { once: true });
  el.open = true;
  await el.updateComplete;
  expect(el.open, 'a vetoed open never applies').to.be.false;
  expect(el.hasAttribute('open')).to.be.false;

  el.open = true;
  await el.updateComplete;
  expect(el.open, 'the veto was one-shot').to.be.true;

  el.addEventListener('lr-hide', (event) => event.preventDefault(), { once: true });
  el.open = false;
  await el.updateComplete;
  expect(el.open, 'a vetoed close stays open').to.be.true;
  expect(el.hasAttribute('open')).to.be.true;
});

it('never lets a veto hold the menu open once the component disables itself', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = twoFormats;
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  let hides = 0;
  el.addEventListener('lr-hide', (event) => {
    hides += 1;
    event.preventDefault();
  });
  el.disabled = true;
  await el.updateComplete;
  expect(el.open, 'a self-imposed close is not vetoable').to.be.false;
  expect(hides, 'a self-imposed close does not advertise a lifecycle veto point').to.equal(0);
});

it('makes the menu lifecycle events cancelable', async () => {
  const el = (await fixture(html`<lr-export-button></lr-export-button>`)) as LyraExportButton;
  el.formats = twoFormats;
  await el.updateComplete;
  const seen: CustomEvent[] = [];
  el.addEventListener('lr-show', (event) => seen.push(event as CustomEvent));
  el.addEventListener('lr-hide', (event) => seen.push(event as CustomEvent));
  el.open = true;
  await el.updateComplete;
  el.open = false;
  await el.updateComplete;
  expect(seen.map((event) => event.type)).to.deep.equal(['lr-show', 'lr-hide']);
  expect(seen.every((event) => event.cancelable)).to.be.true;
});

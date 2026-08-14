import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './selection-toolbar.js';
import type { LyraSelectionToolbar, SelectionActionDetail } from './selection-toolbar.class.js';

it('renders a named toolbar at a supplied selection rectangle', async () => {
  const rect = new DOMRect(20, 30, 100, 20);
  const el = (await fixture(html`<lr-selection-toolbar
    open
    text="selected passage"
    .anchor=${{ kind: 'page', page: 4 }}
    .rect=${rect}
    .strings=${{ selectionToolbarLabel: 'Actions de sélection' }}
  ></lr-selection-toolbar>`)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  expect(toolbar.getAttribute('role')).to.equal('toolbar');
  expect(toolbar.getAttribute('aria-label')).to.equal('Actions de sélection');
  expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-inline-start')).to.equal('70px');
  expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-block-start')).to.equal('30px');
  expect(el.shadowRoot!.querySelectorAll('[part~="action"]')).to.have.lengthOf(4);
});

it('emits the selected text and document anchor for an action', async () => {
  const anchor = { kind: 'text-quote' as const, quote: 'selected passage' };
  const el = (await fixture(html`<lr-selection-toolbar
    open
    text="selected passage"
    .anchor=${anchor}
  ></lr-selection-toolbar>`)) as LyraSelectionToolbar;
  const activated = oneEvent(el, 'lr-selection-action');
  (el.shadowRoot!.querySelector('[data-action="ask"]') as HTMLElement).click();
  const event = (await activated) as CustomEvent<SelectionActionDetail>;
  expect(event.detail.action).to.equal('ask');
  expect(event.detail.text).to.equal('selected passage');
  expect(event.detail.anchor).to.deep.equal(anchor);
});

it('dismisses on Escape through the shared overlay manager', async () => {
  const el = (await fixture(
    html`<lr-selection-toolbar open text="selected"></lr-selection-toolbar>`
  )) as LyraSelectionToolbar;
  await el.updateComplete;
  const dismissed = oneEvent(el, 'lr-dismiss');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await dismissed;
  expect(el.open).to.be.false;
});

it('is accessible in its open populated state', async () => {
  const el = await fixture(html`<lr-selection-toolbar open text="selected passage"></lr-selection-toolbar>`);
  expect(el.shadowRoot!.querySelectorAll('[part~="action"]')).to.have.lengthOf(4);
  await expect(el).to.be.accessible();
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-selection-toolbar
    open
    text="selected"
    .strings=${{ selectionToolbarLabel: 'Localized selection actions' }}
  ></lr-selection-toolbar>`)) as LyraSelectionToolbar;
  expect(el.shadowRoot!.querySelector('[part="toolbar"]')!.getAttribute('aria-label')).to.equal(
    'Localized selection actions'
  );
});

it('keeps every viewport-edge placement inside the visible viewport', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  for (const rect of [
    new DOMRect(0, 0, 1, 1),
    new DOMRect(window.innerWidth - 1, 0, 1, 1),
    new DOMRect(0, window.innerHeight - 1, 1, 1),
    new DOMRect(window.innerWidth - 1, window.innerHeight - 1, 1, 1),
  ]) {
    el.rect = rect;
    await el.updateComplete;
    await waitUntil(() => toolbar.hasAttribute('data-positioned'));
    await aTimeout(0);
    const positioned = toolbar.getBoundingClientRect();
    expect(positioned.left).to.be.at.least(0);
    expect(positioned.top).to.be.at.least(0);
    expect(positioned.right).to.be.at.most(window.innerWidth);
    expect(positioned.bottom).to.be.at.most(window.innerHeight);
  }
});

it('keeps the historical 8px placement gap when the themeable hook is unset', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar
      open
      text="selected"
      .rect=${new DOMRect(240, 200, 20, 20)}
    ></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));
  await aTimeout(0);

  expect(Math.round(200 - toolbar.getBoundingClientRect().bottom)).to.equal(8);
});

it('resolves a themeable placement gap for both the selection anchor and viewport collisions', async () => {
  const gap = 1.5 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const el = (await fixture(html`
    <lr-selection-toolbar
      open
      text="selected"
      style="--lr-selection-toolbar-placement-gap: 1.5rem"
      .rect=${new DOMRect(240, 200, 20, 20)}
    ></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));
  await aTimeout(0);

  expect(Math.round(200 - toolbar.getBoundingClientRect().bottom)).to.equal(Math.round(gap));

  el.rect = new DOMRect(0, 0, 1, 1);
  await el.updateComplete;
  await aTimeout(0);
  const edgePosition = toolbar.getBoundingClientRect();
  expect(Math.round(edgePosition.left)).to.be.at.least(Math.round(gap));
  expect(Math.round(edgePosition.top)).to.be.at.least(Math.round(gap));
});

it('falls back to the historical placement gap for an unsupported CSS length', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar
      open
      text="selected"
      style="--lr-selection-toolbar-placement-gap: calc(1rem + 2px)"
      .rect=${new DOMRect(240, 200, 20, 20)}
    ></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));
  await aTimeout(0);

  expect(Math.round(200 - toolbar.getBoundingClientRect().bottom)).to.equal(8);
});

it('clamps a negative placement gap at zero', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar
      open
      text="selected"
      style="--lr-selection-toolbar-placement-gap: -1rem"
      .rect=${new DOMRect(240, 200, 20, 20)}
    ></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));
  await aTimeout(0);

  expect(Math.round(toolbar.getBoundingClientRect().bottom)).to.equal(200);
});

it('contains long localized action labels inside a 375px toolbar allocation', async () => {
  const token = 'Supercalifragilisticexpialidocious'.repeat(4);
  const el = (await fixture(html`
    <lr-selection-toolbar
      open
      text="selected"
      .strings=${{
        selectionAsk: token,
        selectionQuote: token,
        selectionCite: token,
        copy: token,
      }}
    ></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  toolbar.style.maxInlineSize = '375px';
  await aTimeout(0);

  expect(toolbar.scrollWidth).to.be.at.most(toolbar.clientWidth);
});

it('keeps an otherwise-fitting RTL edge toolbar in one row before collision shifting', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar dir="rtl" open text="selected" .rect=${new DOMRect(0, 200, 1, 20)}></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));
  const tops = [...toolbar.querySelectorAll<HTMLElement>('lr-button')].map((button) =>
    Math.round(button.getBoundingClientRect().top)
  );
  expect(new Set(tops).size).to.equal(1);
});

it('starts positioning when text becomes nonempty while open', async () => {
  const el = (await fixture(html` <lr-selection-toolbar open></lr-selection-toolbar> `)) as LyraSelectionToolbar;
  expect((el.shadowRoot!.querySelector('[part="toolbar"]')) == null).to.be.true;

  el.text = 'selected';
  await el.updateComplete;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));
  expect(toolbar.hasAttribute('data-positioned')).to.be.true;
});

it('deactivates overlay ownership when live text becomes empty', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await el.updateComplete;
  let dismissed = 0;
  el.addEventListener('lr-dismiss', () => dismissed++);

  el.text = '';
  await el.updateComplete;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  expect(dismissed).to.equal(0);
  expect(el.open).to.be.true;
});

it('maintains one roving toolbar stop and moves it from the directly focused action', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);
  const actions = [...el.shadowRoot!.querySelectorAll('lr-button[data-action]')] as Array<
    HTMLElement & { updateComplete: Promise<unknown> }
  >;
  await Promise.all(actions.map((action) => action.updateComplete));
  const controls = actions.map((action) => action.shadowRoot!.querySelector('[part~="base"]') as HTMLButtonElement);
  expect(controls.map((control) => control.tabIndex)).to.deep.equal([0, -1, -1, -1]);

  actions[2]!.focus();
  await aTimeout(0);
  controls[2]!.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      composed: true,
    })
  );
  await aTimeout(0);
  expect(controls.map((control) => control.tabIndex)).to.deep.equal([-1, -1, -1, 0]);
  expect(actions[3]!.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base button');
});

it('moves real focus to the nearest surviving action when the controlled action list shrinks', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);
  const quote = el.shadowRoot!.querySelector<HTMLElement>('[data-action="quote"]')!;
  quote.focus();

  el.actions = ['ask'];
  await el.updateComplete;
  await aTimeout(0);

  const focused = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focused?.dataset['action']).to.equal('ask');
  const controls = [...el.shadowRoot!.querySelectorAll<HTMLElement>('lr-button[data-action]')].map(
    (button) => button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!.tabIndex
  );
  expect(controls).to.deep.equal([0]);
});

it('preserves a focused action by id when controlled actions reorder', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);
  el.shadowRoot!.querySelector<HTMLElement>('[data-action="cite"]')!.focus();

  el.actions = ['cite', 'ask'];
  await el.updateComplete;
  await aTimeout(0);

  expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['action']).to.equal('cite');
});

it('focuses the stable toolbar when the focused final action is removed', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected" .actions=${['ask']}></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);
  el.shadowRoot!.querySelector<HTMLElement>('[data-action="ask"]')!.focus();

  el.actions = [];
  await el.updateComplete;
  await aTimeout(0);

  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('toolbar');
});

it('does not steal a newer external focus destination while actions shrink', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="outside-selection-toolbar">Outside</button>
      <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
    </div>
  `);
  const el = wrapper.querySelector('lr-selection-toolbar') as LyraSelectionToolbar;
  await aTimeout(0);
  el.shadowRoot!.querySelector<HTMLElement>('[data-action="quote"]')!.focus();

  el.actions = ['ask'];
  wrapper.querySelector<HTMLElement>('#outside-selection-toolbar')!.focus();
  await el.updateComplete;
  await aTimeout(0);

  expect(el.ownerDocument.activeElement?.id).to.equal('outside-selection-toolbar');
});

it('restarts positioning after a disconnect/reconnect while open', async () => {
  const rect = new DOMRect(20, 30, 100, 20);
  const el = (await fixture(html`<lr-selection-toolbar
    open
    text="selected"
    .rect=${rect}
  ></lr-selection-toolbar>`)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));

  // Simulate a same-instance reparent (e.g. drag-and-drop), which fires
  // disconnectedCallback then connectedCallback synchronously with no Lit
  // update in between -- `updated()`'s `changed.has('open')` branch never
  // reruns to notice `open` is still true.
  const parent = el.parentElement!;
  el.remove();
  parent.append(el);

  // Clear the previously stamped position so a stale value can't pass this
  // assertion by accident -- only a live resize-listener re-running
  // updateToolbarPosition() can restore it.
  toolbar.removeAttribute('data-positioned');
  toolbar.style.removeProperty('--lr-selection-toolbar-inline-start');
  toolbar.style.removeProperty('--lr-selection-toolbar-block-start');

  window.dispatchEvent(new Event('resize'));
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));

  expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-inline-start')).to.equal('70px');
  expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-block-start')).to.equal('30px');
});

it('replaces an inactive overlay handle after a settled detach so Escape still dismisses on reconnect', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const parent = el.parentElement!;
  el.remove();
  await aTimeout(0);
  parent.append(el);
  await el.updateComplete;

  let dismissals = 0;
  el.addEventListener('lr-dismiss', () => dismissals++);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(dismissals).to.equal(1);
});

it('does not re-arm its former document during a detached update and reconnects to its new owner', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const el = (await fixture(html`
      <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
    `)) as LyraSelectionToolbar;
    let dismissals = 0;
    el.addEventListener('lr-dismiss', () => dismissals++);

    el.remove();
    el.text = 'changed while detached';
    await el.updateComplete;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.open).to.be.true;
    expect(dismissals).to.equal(0);

    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.open).to.be.true;
    expect(dismissals).to.equal(0);

    frameDocument.dispatchEvent(new frameWindow.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(dismissals).to.equal(1);
  } finally {
    frame.remove();
  }
});

it('snapshots selection detail before awaiting clipboard writes', async () => {
  const originalWriteText = navigator.clipboard.writeText;
  let release: (() => void) | undefined;
  navigator.clipboard.writeText = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  try {
    const oldAnchor = { kind: 'text-quote' as const, quote: 'old text' };
    const el = (await fixture(html`
      <lr-selection-toolbar open text="old text" .anchor=${oldAnchor}></lr-selection-toolbar>
    `)) as LyraSelectionToolbar;
    const activated = oneEvent(el, 'lr-selection-action');
    (el.shadowRoot!.querySelector('[data-action="copy"]') as HTMLElement).click();
    await waitUntil(() => release !== undefined);
    el.text = 'new text';
    el.anchor = { kind: 'text-quote', quote: 'new text' };
    release!();

    const event = (await activated) as CustomEvent<SelectionActionDetail>;
    expect(event.detail.text).to.equal('old text');
    expect(event.detail.anchor).to.deep.equal(oldAnchor);
  } finally {
    navigator.clipboard.writeText = originalWriteText;
  }
});

it('uses owner-window geometry and observers, and retires an adopted positioning callback', async () => {
  interface ObserverRecord {
    callback: ResizeObserverCallback;
    observed: Element[];
    disconnects: number;
  }

  const recordsFor = (records: ObserverRecord[]): typeof ResizeObserver =>
    class implements ResizeObserver {
      private readonly record: ObserverRecord;

      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, observed: [], disconnects: 0 };
        records.push(this.record);
      }

      observe(target: Element): void {
        this.record.observed.push(target);
      }

      unobserve(): void {}

      disconnect(): void {
        this.record.disconnects++;
      }
    };

  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const mainObserver = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
  const frameObserver = Object.getOwnPropertyDescriptor(frameWindow, 'ResizeObserver');
  const frameInnerWidth = Object.getOwnPropertyDescriptor(frameWindow, 'innerWidth');
  const mainRecords: ObserverRecord[] = [];
  const frameRecords: ObserverRecord[] = [];
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: recordsFor(mainRecords),
  });
  Object.defineProperty(frameWindow, 'ResizeObserver', {
    configurable: true,
    value: recordsFor(frameRecords),
  });
  Object.defineProperty(frameWindow, 'innerWidth', {
    configurable: true,
    value: 420,
  });
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  mainRecords.length = 0;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    // Force styleMap to recompute after adoption without creating fresh child custom elements in
    // the destination document (constructed stylesheets intentionally remain document-scoped).
    el.requestUpdate();
    await el.updateComplete;
    const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;

    expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-inline-start')).to.equal('210px');
    expect(mainRecords.length).to.equal(0);
    expect(frameRecords.length).to.equal(1);
    expect(frameRecords[0]!.observed.length).to.equal(1);
    expect(frameRecords[0]!.observed[0] === toolbar).to.be.true;

    document.body.append(document.adoptNode(el));
    await el.updateComplete;
    expect(frameRecords[0]!.disconnects).to.equal(1);
    expect(mainRecords.length).to.equal(1);

    toolbar.removeAttribute('data-positioned');
    toolbar.style.removeProperty('--lr-selection-toolbar-inline-start');
    frameRecords[0]!.callback([], {} as ResizeObserver);
    expect(toolbar.hasAttribute('data-positioned')).to.be.false;
    expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-inline-start')).to.equal('');

    mainRecords[0]!.callback([], {} as ResizeObserver);
    expect(toolbar.hasAttribute('data-positioned')).to.be.true;
  } finally {
    el.remove();
    if (mainObserver) Object.defineProperty(window, 'ResizeObserver', mainObserver);
    else Reflect.deleteProperty(window, 'ResizeObserver');
    if (frameObserver) Object.defineProperty(frameWindow, 'ResizeObserver', frameObserver);
    else Reflect.deleteProperty(frameWindow, 'ResizeObserver');
    if (frameInnerWidth) Object.defineProperty(frameWindow, 'innerWidth', frameInnerWidth);
    else Reflect.deleteProperty(frameWindow, 'innerWidth');
    frame.remove();
  }
});

it('never lets a non-finite rect reach the styleMap-bound coordinates (CSS injection/NaN hardening)', async () => {
  const el = (await fixture(
    html`<lr-selection-toolbar open text="selected"></lr-selection-toolbar>`
  )) as LyraSelectionToolbar;
  // `rect` is typed `DOMRectReadOnly`, but a caller passing a plain object (or a Range computed
  // over a collapsed/detached selection) can hand this a non-finite value at runtime; TS cannot
  // enforce the type across the property boundary.
  el.rect = {
    left: NaN,
    top: Infinity,
    width: -Infinity,
    height: 0,
    bottom: NaN,
  } as unknown as DOMRectReadOnly;
  await el.updateComplete;
  const coordinates = (el as unknown as { coordinates(): Record<string, string> }).coordinates();
  expect(coordinates['--lr-selection-toolbar-inline-start']).to.match(/^-?\d+(\.\d+)?px$/);
  expect(coordinates['--lr-selection-toolbar-block-start']).to.match(/^-?\d+(\.\d+)?px$/);
});

it('computes ownerless coordinates without consulting ambient viewport geometry', async () => {
  const inertDocument = document.implementation.createHTMLDocument('ownerless toolbar');
  const innerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;

  try {
    el.remove();
    inertDocument.adoptNode(el);
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      get(): never {
        throw new Error('ambient viewport consulted');
      },
    });
    const coordinates = (el as unknown as { coordinates(): Record<string, string> }).coordinates();
    expect(coordinates['--lr-selection-toolbar-inline-start']).to.equal('0px');
  } finally {
    if (innerWidth) Object.defineProperty(window, 'innerWidth', innerWidth);
    else Reflect.deleteProperty(window, 'innerWidth');
    el.remove();
  }
});

it('uses the current owner clipboard and suppresses adopted or ownerless async completions', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const mainClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const frameClipboard = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
  let rejectWrite!: (reason: unknown) => void;
  const pending = new Promise<void>((_resolve, reject) => {
    rejectWrite = reject;
  });
  let mainWrites = 0;
  let frameWrites = 0;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: () => {
        mainWrites++;
        return pending;
      },
    },
  });
  Object.defineProperty(frameWindow.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: () => {
        frameWrites++;
        return pending;
      },
    },
  });
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  let actions = 0;
  let errors = 0;
  el.addEventListener('lr-selection-action', () => actions++);
  el.addEventListener('lr-copy-error', () => errors++);

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    const copy = el.shadowRoot!.querySelector('[data-action="copy"]') as HTMLElement;
    copy.click();
    await Promise.resolve();

    document.body.append(document.adoptNode(el));
    rejectWrite(new frameWindow.DOMException('Denied', 'NotAllowedError'));
    await Promise.resolve();
    await Promise.resolve();
    expect(frameWrites).to.equal(1);
    expect(mainWrites).to.equal(0);
    expect(actions).to.equal(0);
    expect(errors).to.equal(0);

    const inertDocument = document.implementation.createHTMLDocument('ownerless toolbar');
    el.remove();
    inertDocument.adoptNode(el);
    copy.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(mainWrites).to.equal(0);
  } finally {
    el.remove();
    if (mainClipboard) Object.defineProperty(navigator, 'clipboard', mainClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
    if (frameClipboard) Object.defineProperty(frameWindow.navigator, 'clipboard', frameClipboard);
    else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
    frame.remove();
  }
});

it('does not mutate or focus stale roving buttons after adoption', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);
  const actions = [...el.shadowRoot!.querySelectorAll('lr-button[data-action]')] as Array<
    HTMLElement & { updateComplete: Promise<unknown> }
  >;
  await Promise.all(actions.map((action) => action.updateComplete));
  const controls = actions.map((action) => action.shadowRoot!.querySelector('[part~="base"]') as HTMLButtonElement);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  actions.forEach((action) => {
    Object.defineProperty(action, 'updateComplete', {
      configurable: true,
      value: pending,
    });
  });
  let focusCalls = 0;
  actions[1]!.focus = () => {
    focusCalls++;
  };

  try {
    const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
    toolbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    frameDocument.body.append(frameDocument.adoptNode(el));
    release();
    await Promise.resolve();
    await Promise.resolve();

    expect(controls.map((control) => control.tabIndex)).to.deep.equal([0, -1, -1, -1]);
    expect(focusCalls).to.equal(0);
  } finally {
    el.remove();
    frame.remove();
  }
});

it('renders an actions slot so a consumer can add a fifth action beyond the four built-ins', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected">
      <button slot="actions" id="translate" type="button">Translate</button>
    </lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);

  const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="actions"]');
  expect(slot === null, 'the toolbar renders an actions slot').to.equal(false);
  const extra = el.querySelector<HTMLButtonElement>('#translate')!;
  expect(slot!.assignedElements({ flatten: true }).includes(extra)).to.equal(true);
  // It has to sit inside the role="toolbar" element, or it is not part of the toolbar at all.
  expect(slot!.closest('[part="toolbar"]') === null).to.equal(false);
  // ...and after the built-ins, so the shipped four keep their documented order.
  const toolbarChildren = [...el.shadowRoot!.querySelector('[part="toolbar"]')!.children];
  expect(toolbarChildren.indexOf(slot!)).to.equal(toolbarChildren.length - 1);
});

it('includes a slotted action in the toolbar roving-tabindex group and its keyboard navigation', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected">
      <button slot="actions" id="translate" type="button">Translate</button>
    </lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);
  const actions = [...el.shadowRoot!.querySelectorAll('lr-button[data-action]')] as Array<
    HTMLElement & { updateComplete: Promise<unknown> }
  >;
  await Promise.all(actions.map((action) => action.updateComplete));
  const extra = el.querySelector<HTMLButtonElement>('#translate')!;

  const stops = (): number[] => [
    ...actions.map((action) => (action.shadowRoot!.querySelector('[part~="base"]') as HTMLElement).tabIndex),
    extra.tabIndex,
  ];
  expect(stops(), 'exactly one tab stop, on the first action').to.deep.equal([0, -1, -1, -1, -1]);

  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  toolbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await aTimeout(0);
  expect(stops(), 'End lands on the slotted action, now the last stop').to.deep.equal([-1, -1, -1, -1, 0]);
  expect(el.ownerDocument.activeElement === extra).to.equal(true);
});

it('uses each real action inside a slotted wrapper as a separate roving stop', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected">
      <div slot="actions" id="extra-action-wrapper">
        <button id="translate" type="button">Translate</button>
        <button id="define" type="button">Define</button>
      </div>
    </lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);
  const toolbar = el.shadowRoot!.querySelector<HTMLElement>('[part="toolbar"]')!;
  const translate = el.querySelector<HTMLButtonElement>('#translate')!;
  const define = el.querySelector<HTMLButtonElement>('#define')!;

  toolbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await aTimeout(0);
  expect(el.ownerDocument.activeElement === define).to.equal(true);
  expect([translate.tabIndex, define.tabIndex]).to.deep.equal([-1, 0]);

  define.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await aTimeout(0);
  const firstBuiltIn = el.shadowRoot!.querySelector<HTMLElement>('lr-button[data-action="ask"]')!;
  expect(firstBuiltIn.shadowRoot!.activeElement?.localName).to.equal('button');
});

it('does not turn a decorative slotted root into a toolbar action merely because it can be focused', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected">
      <span slot="actions" id="selection-decoration">Decoration</span>
      <span slot="actions" aria-hidden=" TRUE ">
        <button id="hidden-selection-action">Hidden</button>
      </span>
      <button slot="actions" id="visible-selection-action">Visible</button>
    </lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);
  const access = el as unknown as { actionButtons(): HTMLElement[] };

  expect(access.actionButtons().map((stop) => stop.id).filter(Boolean)).to.deep.equal([
    'visible-selection-action',
  ]);
});

it('live-reconciles slotted action availability and clears stale roving stops', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected" .actions=${[]}>
      <button slot="actions" id="first-live-selection-action">First</button>
      <button slot="actions" id="second-live-selection-action">Second</button>
      <span slot="actions" id="promoted-live-selection-action">Promoted</span>
    </lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const first = el.querySelector<HTMLButtonElement>('#first-live-selection-action')!;
  const second = el.querySelector<HTMLButtonElement>('#second-live-selection-action')!;
  const promoted = el.querySelector<HTMLElement>('#promoted-live-selection-action')!;
  const access = el as unknown as { actionButtons(): HTMLElement[] };
  await waitUntil(() => first.tabIndex === 0);

  first.disabled = true;
  await waitUntil(() => second.tabIndex === 0);
  expect(first.tabIndex).to.equal(-1);
  second.setAttribute('aria-disabled', 'true');
  await waitUntil(() => second.tabIndex === -1);
  expect(access.actionButtons()).to.have.lengthOf(0);
  expect(second.tabIndex).to.equal(-1);

  first.disabled = false;
  second.removeAttribute('aria-disabled');
  await waitUntil(() => first.tabIndex === 0);
  first.hidden = true;
  await waitUntil(() => second.tabIndex === 0);
  second.inert = true;
  await waitUntil(() => second.tabIndex === -1);
  expect(access.actionButtons()).to.have.lengthOf(0);
  expect(second.tabIndex).to.equal(-1);

  promoted.setAttribute('tabindex', '-1');
  await waitUntil(() => promoted.tabIndex === 0);
  expect(access.actionButtons().includes(promoted)).to.equal(true);
  promoted.removeAttribute('tabindex');
  await waitUntil(() => !access.actionButtons().includes(promoted));
  expect(promoted.tabIndex).to.equal(-1);
});

it('drops a role-only slotted action when its authored actionability is removed', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected" .actions=${[]}>
      <span slot="actions" id="role-only-selection-action" role="button">Role action</span>
      <button slot="actions" id="native-selection-fallback">Native fallback</button>
    </lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const roleAction = el.querySelector<HTMLElement>('#role-only-selection-action')!;
  const fallback = el.querySelector<HTMLButtonElement>('#native-selection-fallback')!;
  const access = el as unknown as { actionButtons(): HTMLElement[] };
  await waitUntil(() => roleAction.tabIndex === 0);

  roleAction.removeAttribute('role');
  await waitUntil(() => fallback.tabIndex === 0);

  expect(roleAction.tabIndex).to.equal(-1);
  expect(access.actionButtons().map((stop) => stop.id)).to.deep.equal(['native-selection-fallback']);
});

it('repairs focused slotted action removal to the nearest survivor, then the toolbar', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected" .actions=${[]}>
      <button slot="actions" id="removed-live-selection-action">Removed</button>
      <button slot="actions" id="surviving-live-selection-action">Survivor</button>
    </lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const removed = el.querySelector<HTMLButtonElement>('#removed-live-selection-action')!;
  const survivor = el.querySelector<HTMLButtonElement>('#surviving-live-selection-action')!;
  const toolbar = el.shadowRoot!.querySelector<HTMLElement>('[part="toolbar"]')!;
  await waitUntil(() => removed.tabIndex === 0);

  removed.focus();
  removed.remove();
  await waitUntil(() => el.ownerDocument.activeElement === survivor);
  expect(survivor.tabIndex).to.equal(0);

  survivor.setAttribute('inert', '');
  await waitUntil(() => el.shadowRoot!.activeElement === toolbar);
  expect(survivor.tabIndex).to.equal(-1);
});

it('does not steal newer external focus during live slotted-action repair', async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-selection-toolbar open text="selected" .actions=${[]}>
        <button slot="actions" id="invalidated-selection-action">Action</button>
      </lr-selection-toolbar>
      <button id="outside-selection-toolbar-live">Outside</button>
    </div>
  `);
  const el = wrapper.querySelector('lr-selection-toolbar') as LyraSelectionToolbar;
  const action = wrapper.querySelector<HTMLButtonElement>('#invalidated-selection-action')!;
  const outside = wrapper.querySelector<HTMLButtonElement>('#outside-selection-toolbar-live')!;
  await waitUntil(() => action.tabIndex === 0);

  action.focus();
  action.setAttribute('aria-disabled', 'true');
  outside.focus();
  await aTimeout(0);
  await aTimeout(0);

  expect(el.ownerDocument.activeElement === outside).to.equal(true);
});

it('manages built-in actions without relying on their private part name', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);
  const hosts = [...el.shadowRoot!.querySelectorAll('lr-button[data-action]')] as Array<
    HTMLElement & { updateComplete: Promise<unknown> }
  >;
  await Promise.all(hosts.map((host) => host.updateComplete));
  const controls = hosts.map((host) => host.shadowRoot!.querySelector<HTMLButtonElement>('button')!);
  controls.forEach((control) => control.removeAttribute('part'));
  const access = el as unknown as {
    syncRovingStops(index: number): Promise<HTMLElement | undefined>;
  };

  const target = await access.syncRovingStops(2);
  expect(target === controls[2]).to.equal(true);
  expect(controls.map((control) => control.tabIndex)).to.deep.equal([-1, -1, 0, -1]);
});

it('rebinds live slotted-action observation to the current realm after adoption', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected" .actions=${[]}>
      <button slot="actions" id="adopted-first-selection-action">First</button>
      <button slot="actions" id="adopted-second-selection-action">Second</button>
    </lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const first = el.querySelector<HTMLButtonElement>('#adopted-first-selection-action')!;
  const second = el.querySelector<HTMLButtonElement>('#adopted-second-selection-action')!;
  await waitUntil(() => first.tabIndex === 0);
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameWindow = iframe.contentWindow!;
  const NativeObserver = frameWindow.MutationObserver;
  let observerConstructions = 0;
  frameWindow.MutationObserver = class extends NativeObserver {
    constructor(callback: MutationCallback) {
      observerConstructions++;
      super(callback);
    }
  };
  try {
    iframe.contentDocument!.body.append(iframe.contentDocument!.adoptNode(el));
    await aTimeout(0);
    first.setAttribute('aria-disabled', 'true');
    await waitUntil(() => second.tabIndex === 0);

    expect(observerConstructions).to.be.greaterThan(0);
    expect(first.tabIndex).to.equal(-1);
  } finally {
    frameWindow.MutationObserver = NativeObserver;
    el.remove();
    iframe.remove();
  }
});

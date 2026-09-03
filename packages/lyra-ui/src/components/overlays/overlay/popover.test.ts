import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './popover.js';
import { LyraPopover } from './popover.class.js';
import {
  __setAnchoredOverlayRuntimeLoaderForTesting,
  type AnchoredOverlayRuntime,
} from '../../../internal/anchored-overlay-runtime.js';

function positionedRuntime(onPlace?: () => void): AnchoredOverlayRuntime {
  return {
    place: (_anchor, popupElement, options = {}) => {
      onPlace?.();
      popupElement.style.position = options.strategy ?? 'fixed';
      queueMicrotask(() => options.onPlaced?.({ placement: options.placement ?? 'bottom-start' }));
      return () => undefined;
    },
  } as AnchoredOverlayRuntime;
}

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

it('keeps popover rendering and lifecycle available behind a throwing internals accessor', async () => {
  const prototype = LyraPopover.prototype as unknown as object;
  const original = Object.getOwnPropertyDescriptor(prototype, 'attachInternals');
  let accessorReads = 0;
  Object.defineProperty(prototype, 'attachInternals', {
    configurable: true,
    get(): never {
      accessorReads += 1;
      throw new Error('partial DOM attachInternals accessor');
    },
  });
  let el!: LyraPopover;
  try {
    el = new LyraPopover();
  } finally {
    if (original) Object.defineProperty(prototype, 'attachInternals', original);
    else delete (prototype as { attachInternals?: unknown }).attachInternals;
  }

  expect(accessorReads).to.equal(0);
  el.style.setProperty('--show-duration', '0ms');
  el.style.setProperty('--hide-duration', '0ms');
  const button = document.createElement('button');
  button.slot = 'trigger';
  button.textContent = 'Open';
  const content = document.createElement('p');
  content.textContent = 'Details';
  el.append(button, content);
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(popup(el).hasAttribute('data-hidden')).to.equal(true);

    await el.show();
    expect(el.open).to.equal(true);
    expect(el.hasAttribute('open')).to.equal(true);
    expect(popup(el).hasAttribute('data-hidden')).to.equal(false);
    const internals = (el as unknown as { popoverInternals: ElementInternals }).popoverInternals;
    expect(internals.states.has('open')).to.equal(true);

    await el.hide({ focusTrigger: false });
    expect(el.open).to.equal(false);
    expect(el.hasAttribute('open')).to.equal(false);
    expect(internals.states.has('open')).to.equal(false);
  } finally {
    el.remove();
  }
});

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

it('rolls back a virtual anchor when opening is vetoed', async () => {
  const el = await basic();
  const returnFocusTo = document.createElement('button');
  const seam = el as unknown as {
    virtualAnchor?: unknown;
    returnFocusTo?: HTMLElement;
  };
  el.addEventListener('lr-show', (event) => event.preventDefault(), { once: true });

  el.showAt({ x: 12, y: 24, width: 8, height: 6 }, { returnFocusTo });
  await el.updateComplete;

  expect(el.open).to.equal(false);
  expect(seam.virtualAnchor === undefined).to.equal(true);
  expect(seam.returnFocusTo === undefined).to.equal(true);
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

it('keeps first-open content hidden and defers after-show until the cached runtime positions it', async () => {
  let resolveRuntime!: (runtime: AnchoredOverlayRuntime) => void;
  const pendingRuntime = new Promise<AnchoredOverlayRuntime>((resolve) => {
    resolveRuntime = resolve;
  });
  __setAnchoredOverlayRuntimeLoaderForTesting(() => pendingRuntime);
  try {
    const el = await basic();
    let afterShow = false;
    el.addEventListener('lr-after-show', () => {
      afterShow = true;
    });
    const shown = el.show();
    await el.updateComplete;

    expect(popup(el).hasAttribute('data-hidden')).to.equal(true);
    expect(afterShow).to.equal(false);
    resolveRuntime(positionedRuntime());
    await shown;

    expect(popup(el).hasAttribute('data-hidden')).to.equal(false);
    expect(afterShow).to.equal(true);
  } finally {
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  }
});

it('invalidates a deferred positioning generation when disconnected before the runtime loads', async () => {
  let resolveRuntime!: (runtime: AnchoredOverlayRuntime) => void;
  const pendingRuntime = new Promise<AnchoredOverlayRuntime>((resolve) => {
    resolveRuntime = resolve;
  });
  let placeCalls = 0;
  __setAnchoredOverlayRuntimeLoaderForTesting(() => pendingRuntime);
  try {
    const el = await basic();
    void el.show();
    await el.updateComplete;
    el.remove();
    resolveRuntime(positionedRuntime(() => placeCalls++));
    await Promise.resolve();
    await Promise.resolve();

    expect(placeCalls).to.equal(0);
  } finally {
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  }
});

it('fails closed when the positioning runtime rejects', async () => {
  __setAnchoredOverlayRuntimeLoaderForTesting(() =>
    Promise.reject(new Error('positioning unavailable')),
  );
  try {
    const el = await basic();
    let afterShow = 0;
    el.addEventListener('lr-after-show', () => afterShow++);

    await el.show();
    await el.updateComplete;

    expect(el.open).to.equal(false);
    expect(afterShow).to.equal(0);
    expect(popup(el).hasAttribute('data-hidden')).to.equal(true);
  } finally {
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  }
});

it('positions only the current owner document after adoption while the runtime is loading', async () => {
  let resolveRuntime!: (runtime: AnchoredOverlayRuntime) => void;
  const pendingRuntime = new Promise<AnchoredOverlayRuntime>((resolve) => {
    resolveRuntime = resolve;
  });
  const placedDocuments: Document[] = [];
  __setAnchoredOverlayRuntimeLoaderForTesting(() => pendingRuntime);
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error('The iframe document was unavailable.');
    const el = await basic();
    void el.show();
    await el.updateComplete;
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;

    resolveRuntime({
      place: (_anchor, popupElement, options = {}) => {
        placedDocuments.push(popupElement.ownerDocument);
        queueMicrotask(() => options.onPlaced?.({ placement: options.placement ?? 'bottom-start' }));
        return () => undefined;
      },
    } as AnchoredOverlayRuntime);
    await waitUntil(() => placedDocuments.length === 1 && !popup(el).hasAttribute('data-hidden'));

    expect(placedDocuments).to.deep.equal([frameDocument]);
  } finally {
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
    frame.remove();
  }
});

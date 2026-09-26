import { fixture, fixtureSync, expect, html, oneEvent, aTimeout, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { contrastRatio, effectiveBackground, resolvedColorToken } from '../../../../test/color-contrast.js';
import './source-list.js';
import '../source-card/source-card.js';
import '../../utility/copy-button/copy-button.js';
import { LyraSourceList } from './source-list.js';

it('defaults to collapsed with an omitted label and an empty label-plural', async () => {
  const el = (await fixture(html`<lr-source-list></lr-source-list>`)) as LyraSourceList;
  expect(el.expanded).to.be.false;
  expect(el.hasAttribute('expanded')).to.be.false;
  expect(el.label).to.equal(undefined);
  expect(el.labelPlural).to.equal('');
});

it('falls back to the literal word "Sources" when neither label nor label-plural is set', async () => {
  const el = (await fixture(html`<lr-source-list></lr-source-list>`)) as LyraSourceList;
  expect(el.shadowRoot!.querySelector('[part="header"]')!.textContent!.trim()).to.equal('Sources');
});

it('uses label when set and label-plural is unset', async () => {
  const el = (await fixture(html`<lr-source-list label="Source"></lr-source-list>`)) as LyraSourceList;
  expect(el.shadowRoot!.querySelector('[part="header"]')!.textContent!.trim()).to.equal('Source');
});

it('honors an explicitly empty label as genuinely empty, distinct from omitting it', async () => {
  const el = (await fixture(html`<lr-source-list label=""></lr-source-list>`)) as LyraSourceList;
  expect(el.label).to.equal('');
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;
  expect(header.textContent!.trim()).to.equal('Sources');
  expect(header.getAttribute('aria-label')).to.equal('Sources');

  el.label = undefined;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="header"]')!.textContent!.trim()).to.equal('Sources');
});

it('prefers label-plural over label when both are set', async () => {
  const el = (await fixture(
    html`<lr-source-list label="Source" label-plural="3 sources"></lr-source-list>`,
  )) as LyraSourceList;
  expect(el.shadowRoot!.querySelector('[part="header"]')!.textContent!.trim()).to.equal('3 sources');
});

it('localizes the fallback "Sources" header text via this.localize() when .strings overrides sourceListDefaultLabel', async () => {
  const el = (await fixture(
    html`<lr-source-list .strings=${{ sourceListDefaultLabel: 'Origines' }}></lr-source-list>`,
  )) as LyraSourceList;
  expect(el.shadowRoot!.querySelector('[part="header"]')!.textContent!.trim()).to.equal('Origines');
});

it('hides [part="list"] from the accessibility tree while collapsed, shows it while expanded', async () => {
  const el = (await fixture(
    html`<lr-source-list><lr-source-card title="a.pdf"></lr-source-card></lr-source-list>`,
  )) as LyraSourceList;
  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  expect(list.hidden).to.be.true;

  el.expanded = true;
  await el.updateComplete;
  expect(list.hidden).to.be.false;
});

it('toggles expanded and fires lr-toggle on header click', async () => {
  const el = (await fixture(html`<lr-source-list label-plural="2 sources"></lr-source-list>`)) as LyraSourceList;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;

  let firing = oneEvent(el, 'lr-toggle');
  header.click();
  let event = await firing;
  await el.updateComplete;
  expect(el.expanded).to.be.true;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: true });
  expect(header.getAttribute('aria-expanded')).to.equal('true');

  firing = oneEvent(el, 'lr-toggle');
  header.click();
  event = await firing;
  await el.updateComplete;
  expect(el.expanded).to.be.false;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: false });
  expect(header.getAttribute('aria-expanded')).to.equal('false');
});

it('links the header to the list region it controls via aria-controls', async () => {
  const el = (await fixture(html`<lr-source-list></lr-source-list>`)) as LyraSourceList;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;
  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  expect(header.getAttribute('aria-controls')).to.equal(list.id);
  expect(list.id).to.not.equal('');
});

it('exposes a live sourceCount reflecting the slotted children, including on later add/remove', async () => {
  const el = (await fixture(
    html`<lr-source-list>
      <lr-source-card title="a.pdf"></lr-source-card>
      <lr-source-card title="b.pdf"></lr-source-card>
    </lr-source-list>`,
  )) as LyraSourceList;
  expect(el.sourceCount).to.equal(2);

  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  const third = document.createElement('lr-source-card');
  const slotChanged = oneEvent(slot, 'slotchange');
  el.appendChild(third);
  await slotChanged;
  await el.updateComplete;
  expect(el.sourceCount).to.equal(3);

  const removed = oneEvent(slot, 'slotchange');
  el.removeChild(third);
  await removed;
  await el.updateComplete;
  expect(el.sourceCount).to.equal(2);
});

it('reports sourceCount as 0 for an empty list', async () => {
  const el = (await fixture(html`<lr-source-list></lr-source-list>`)) as LyraSourceList;
  expect(el.sourceCount).to.equal(0);
});

it('does not throw when sourceCount is assigned, e.g. from a lit-html property binding', async () => {
  const el = (await fixture(
    html`<lr-source-list>
      <lr-source-card title="a.pdf"></lr-source-card>
    </lr-source-list>`,
  )) as LyraSourceList;
  expect(el.sourceCount).to.equal(1);
  expect(() => {
    (el as unknown as { sourceCount: number }).sourceCount = 99;
  }).to.not.throw();
  // The assignment is inert -- sourceCount stays live-derived from the actual slotted count.
  expect(el.sourceCount).to.equal(1);
});

it("keeps willUpdate's pre-count in sync with firstUpdated's authoritative count when a direct child carries a foreign slot attribute, avoiding a wasted second update", async () => {
  // `fixtureSync` (unlike `fixture`) hands back the element before its first
  // Lit update microtask has run, so `updated` can be wrapped in time to
  // observe every update pass triggered by the initial connect -- including
  // any wasted extra pass caused by `willUpdate`'s pre-count disagreeing with
  // `firstUpdated`'s slot-based recount.
  const el = fixtureSync<LyraSourceList>(html`
    <lr-source-list>
      <lr-source-card title="a.pdf"></lr-source-card>
      <span slot="not-a-real-slot">not assigned to the default slot</span>
    </lr-source-list>
  `);

  let updateCount = 0;
  const originalUpdated = (el as unknown as { updated: (changed: Map<string, unknown>) => void }).updated.bind(el);
  (el as unknown as { updated: (changed: Map<string, unknown>) => void }).updated = (changed) => {
    updateCount++;
    originalUpdated(changed);
  };

  await el.updateComplete;
  // Give a wasted cascading update (if any) a chance to run before asserting.
  await aTimeout(50);

  // Only the `<lr-source-card>` is assigned to the default slot; the
  // foreign-slotted `<span>` must not count.
  expect(el.sourceCount).to.equal(1);
  expect(updateCount).to.equal(1);
});

it('is accessible with no cards and collapsed', async () => {
  const el = (await fixture(html`<lr-source-list label-plural="0 sources"></lr-source-list>`)) as LyraSourceList;
  await expect(el).to.be.accessible();
});

it('is accessible with cards and expanded', async () => {
  const el = (await fixture(
    html`<lr-source-list label-plural="2 sources" expanded>
      <lr-source-card source-id="a" title="annual_report.pdf" page="12">
        <span slot="excerpt">Revenue grew 12% year over year.</span>
      </lr-source-card>
      <lr-source-card source-id="b" title="notes.txt"></lr-source-card>
    </lr-source-list>`,
  )) as LyraSourceList;
  await expect(el).to.be.accessible();
});

describe('lifecycle: super calls', () => {
  it('calls super.willUpdate() so a future shared mixin layered under LyraElement keeps running', async () => {
    // Neither LyraElement nor LitElement override willUpdate today (a true no-op on
    // ReactiveElement.prototype), so this can only be proven by spying on the inherited method
    // itself and confirming lr-source-list's own override still reaches it via
    // `super.willUpdate()` -- mirrors `<lr-graph>`'s identical test for the same pattern.
    const proto = Object.getPrototypeOf(LyraSourceList.prototype) as {
      willUpdate?: (changed: unknown) => void;
    };
    const hadOwnWillUpdate = Object.prototype.hasOwnProperty.call(proto, 'willUpdate');
    const originalWillUpdate = proto.willUpdate;
    let willUpdateCalls = 0;
    // Created (and the `el` reference bound) via `document.createElement` *before* connecting to
    // the DOM -- unlike `fixture()`, which appends and awaits `updateComplete` internally, so its
    // own first `willUpdate` call would already have fired before an `await fixture(...)`
    // assignment lands, leaving `el` still `undefined` when the spy's `this === el` check runs.
    const el = document.createElement('lr-source-list') as LyraSourceList;
    proto.willUpdate = function (this: unknown, changed: unknown) {
      if (this === el) willUpdateCalls++;
      originalWillUpdate?.call(this, changed);
    };
    try {
      document.body.appendChild(el);
      await el.updateComplete;
      expect(willUpdateCalls).to.be.greaterThan(0);
    } finally {
      el.remove();
      if (hadOwnWillUpdate) proto.willUpdate = originalWillUpdate;
      else delete proto.willUpdate;
    }
  });
});

it('keeps explicit-empty and dynamic host naming distinct from the disclosure button', async () => {
  const el = (await fixture(
    html`<lr-source-list aria-label="Evidence sources"></lr-source-list>`,
  )) as LyraSourceList;
  const header = el.shadowRoot!.querySelector('[part="header"]')!;
  expect(el.getAttribute('aria-label')).to.equal('Evidence sources');
  expect(header.getAttribute('aria-label')).to.equal('Sources');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(header.getAttribute('aria-label')).to.equal('Sources');
  el.setAttribute('aria-label', 'Revised evidence sources');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Revised evidence sources');
  expect(header.getAttribute('aria-label')).to.equal('Sources');
});

it('exposes slotted cards as list items while preserving author roles on removal', async () => {
  const card = document.createElement('lr-source-card');
  const el = (await fixture(html`<lr-source-list expanded></lr-source-list>`)) as LyraSourceList;
  el.append(card);
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve));
  expect(el.shadowRoot!.querySelector('[part="list"]')!.getAttribute('role')).to.equal('list');
  expect(card.getAttribute('role')).to.equal('listitem');
  card.remove();
  await new Promise((resolve) => setTimeout(resolve));
  expect(card.hasAttribute('role')).to.be.false;
});

it('preserves native and author-defined interactive roles in the default slot', async () => {
  const el = (await fixture(html`
    <lr-source-list expanded>
      <button type="button">Open all sources</button>
      <div role="button" tabindex="0">Load more sources</div>
    </lr-source-list>
  `)) as LyraSourceList;
  const nativeButton = el.querySelector('button')!;
  const authorButton = el.querySelector('[role="button"]')!;

  await aTimeout(0);
  expect(nativeButton.getAttribute('role'), 'the native button keeps its implicit button role').to.equal(null);
  expect(authorButton.getAttribute('role'), 'the author-defined button role is retained').to.equal('button');
  expect(el.shadowRoot!.querySelector('[part="list"]')!.hasAttribute('role')).to.be.false;
  await expect(el).to.be.accessible();
});

it('preserves native semantic and ElementInternals-owned slotted children', async () => {
  const el = (await fixture(html`
    <lr-source-list expanded>
      <article>Source overview</article>
      <dialog open aria-label="Source details">Details</dialog>
      <lr-copy-button value="Citation"></lr-copy-button>
    </lr-source-list>
  `)) as LyraSourceList;
  const article = el.querySelector('article')!;
  const dialog = el.querySelector('dialog')!;
  const copyButton = el.querySelector('lr-copy-button')!;

  await aTimeout(0);
  expect(article.getAttribute('role'), 'the native article role is not overwritten').to.equal(null);
  expect(dialog.getAttribute('role'), 'the native dialog role is not overwritten').to.equal(null);
  expect(copyButton.getAttribute('role'), 'the ElementInternals role is not overwritten').to.equal('group');
  expect(el.shadowRoot!.querySelector('[part="list"]')!.hasAttribute('role')).to.be.false;
  await expect(el).to.be.accessible();
});

it('releases a neutral slotted item when its author makes it interactive', async () => {
  const el = (await fixture(html`
    <lr-source-list expanded><div>Load more sources</div></lr-source-list>
  `)) as LyraSourceList;
  const item = el.querySelector('div')!;
  const list = el.shadowRoot!.querySelector('[part="list"]')!;

  await aTimeout(0);
  expect(item.getAttribute('role')).to.equal('listitem');
  expect(list.getAttribute('role')).to.equal('list');

  item.setAttribute('tabindex', '0');
  await aTimeout(0);
  expect(item.getAttribute('tabindex')).to.equal('0');
  expect(item.hasAttribute('role')).to.be.false;
  expect(list.hasAttribute('role')).to.be.false;

  item.removeAttribute('tabindex');
  await aTimeout(0);
  expect(item.getAttribute('role')).to.equal('listitem');
  expect(list.getAttribute('role')).to.equal('list');

  item.setAttribute('role', 'button');
  await aTimeout(0);
  expect(item.getAttribute('role')).to.equal('button');
  expect(list.hasAttribute('role')).to.be.false;

  item.removeAttribute('role');
  await aTimeout(0);
  expect(item.getAttribute('role')).to.equal('listitem');
  expect(list.getAttribute('role')).to.equal('list');
});

it('does not transiently restore list semantics when reconnecting direct controls', async () => {
  const wrapper = (await fixture(
    html`<div><lr-source-list expanded><button type="button">Open all sources</button></lr-source-list></div>`,
  )) as HTMLElement;
  const el = wrapper.querySelector('lr-source-list') as LyraSourceList;
  const list = el.shadowRoot!.querySelector('[part="list"]')!;

  await aTimeout(0);
  expect(list.hasAttribute('role')).to.be.false;
  el.remove();
  expect(list.hasAttribute('role')).to.be.false;
  wrapper.append(el);
  expect(list.hasAttribute('role')).to.be.false;
  await el.updateComplete;
  await aTimeout(0);
  expect(list.hasAttribute('role')).to.be.false;
});

it('reapplies owned listitem roles after disconnect and reconnect', async () => {
  const wrapper = (await fixture(
    html`<div><lr-source-list expanded><lr-source-card></lr-source-card></lr-source-list></div>`,
  )) as HTMLElement;
  const el = wrapper.querySelector('lr-source-list') as LyraSourceList;
  const card = el.querySelector('lr-source-card')!;
  await new Promise<void>((resolve) => setTimeout(resolve));
  expect(card.getAttribute('role')).to.equal('listitem');

  el.remove();
  expect(card.hasAttribute('role')).to.be.false;
  wrapper.append(el);
  await el.updateComplete;
  await new Promise<void>((resolve) => setTimeout(resolve));
  expect(card.getAttribute('role')).to.equal('listitem');
});

it('does not let a stale reconnect continuation reapply owned roles after disconnect', async () => {
  const wrapper = (await fixture(
    html`<div><lr-source-list expanded><lr-source-card></lr-source-card></lr-source-list></div>`,
  )) as HTMLElement;
  const el = wrapper.querySelector('lr-source-list') as LyraSourceList;
  const card = el.querySelector('lr-source-card')!;
  expect(card.getAttribute('role')).to.equal('listitem');

  el.remove();
  expect(card.hasAttribute('role')).to.be.false;
  let resolveUpdate!: (value: boolean) => void;
  const deferredUpdate = new Promise<boolean>((resolve) => {
    resolveUpdate = resolve;
  });
  Object.defineProperty(el, 'updateComplete', {
    configurable: true,
    get: () => deferredUpdate,
  });

  wrapper.append(el);
  el.remove();
  expect(card.hasAttribute('role')).to.be.false;
  resolveUpdate(true);
  await deferredUpdate;
  await Promise.resolve();
  expect(card.hasAttribute('role')).to.be.false;
});

it('recreates its role observer in the adopted owner realm and disconnects it on adoption', async () => {
  const el = (await fixture(
    html`<lr-source-list expanded><lr-source-card></lr-source-card></lr-source-list>`,
  )) as LyraSourceList;
  await el.updateComplete;
  el.remove();
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const originalMutationObserver = frameWindow.MutationObserver;
  let roleObservations = 0;
  let roleDisconnects = 0;
  class OwnerMutationObserver implements MutationObserver {
    private observesList = false;
    constructor(_callback: MutationCallback) {}
    observe(target: Node, options?: MutationObserverInit): void {
      if (target === el && options?.attributeFilter?.includes('role')) {
        this.observesList = true;
        roleObservations += 1;
      }
    }
    takeRecords(): MutationRecord[] { return []; }
    disconnect(): void { if (this.observesList) roleDisconnects += 1; }
  }
  frameWindow.MutationObserver = OwnerMutationObserver;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(roleObservations, 'the destination window observes the source list').to.be.greaterThan(0);
    document.adoptNode(el);
    expect(roleDisconnects, 'adoption disconnects the old owner observer').to.be.greaterThan(0);
  } finally {
    frameWindow.MutationObserver = originalMutationObserver;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

it('preserves live author roles while connected and after release', async () => {
  const card = document.createElement('lr-source-card');
  const el = (await fixture(html`<lr-source-list expanded></lr-source-list>`)) as LyraSourceList;
  el.append(card);
  await new Promise<void>((resolve) => setTimeout(resolve));
  expect(card.getAttribute('role')).to.equal('listitem');

  card.setAttribute('role', 'article');
  await new Promise<void>((resolve) => setTimeout(resolve));
  expect(card.getAttribute('role')).to.equal('article');
  expect(el.shadowRoot!.querySelector('[part="list"]')!.hasAttribute('role')).to.be.false;

  card.remove();
  await new Promise<void>((resolve) => setTimeout(resolve));
  expect(card.getAttribute('role')).to.equal('article');
});

describe('compact and frame', () => {
  const part = (el: LyraSourceList, name: string) =>
    el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it('defaults compact to false and frame to "card", reflecting both as attributes when set', async () => {
    const plain = (await fixture(html`<lr-source-list></lr-source-list>`)) as LyraSourceList;
    expect(plain.compact).to.be.false;
    expect(plain.hasAttribute('compact')).to.be.false;
    expect(plain.frame).to.equal('card');
    expect(plain.getAttribute('frame')).to.equal('card');

    const el = (await fixture(
      html`<lr-source-list compact frame="plain"></lr-source-list>`,
    )) as LyraSourceList;
    expect(el.compact).to.be.true;
    expect(el.hasAttribute('compact')).to.be.true;
    expect(el.frame).to.equal('plain');
  });

  it('compact tightens header padding/gap and list padding/gap, keeping the outer card chrome', async () => {
    const regular = (await fixture(html`<lr-source-list expanded></lr-source-list>`)) as LyraSourceList;
    const el = (await fixture(
      html`<lr-source-list compact expanded></lr-source-list>`,
    )) as LyraSourceList;

    const compactBase = getComputedStyle(part(el, 'base'));
    const regularBase = getComputedStyle(part(regular, 'base'));
    expect(compactBase.borderTopWidth).to.equal(regularBase.borderTopWidth);
    expect(compactBase.borderTopWidth).to.not.equal('0px');

    const compactHeader = getComputedStyle(part(el, 'header'));
    const regularHeader = getComputedStyle(part(regular, 'header'));
    expect(parseFloat(compactHeader.paddingTop)).to.be.lessThan(parseFloat(regularHeader.paddingTop));
    expect(parseFloat(compactHeader.columnGap)).to.be.lessThan(parseFloat(regularHeader.columnGap));

    const compactList = getComputedStyle(part(el, 'list'));
    const regularList = getComputedStyle(part(regular, 'list'));
    expect(parseFloat(compactList.paddingTop)).to.be.lessThan(parseFloat(regularList.paddingTop));
    expect(parseFloat(compactList.rowGap)).to.be.lessThan(parseFloat(regularList.rowGap));
  });

  it('lets a consumer retune the compact values through --lr-source-list-compact-*', async () => {
    const el = (await fixture(
      html`<lr-source-list compact expanded></lr-source-list>`,
    )) as LyraSourceList;
    el.style.setProperty('--lr-source-list-compact-header-padding', '1px 2px');
    el.style.setProperty('--lr-source-list-compact-header-gap', '3px');
    el.style.setProperty('--lr-source-list-compact-gap', '4px');
    el.style.setProperty('--lr-source-list-compact-list-padding', '5px');
    await el.updateComplete;

    const header = getComputedStyle(part(el, 'header'));
    expect(header.padding).to.equal('1px 2px');
    expect(header.gap).to.equal('3px');

    const list = getComputedStyle(part(el, 'list'));
    expect(list.gap).to.equal('4px');
    expect(list.padding).to.equal('5px');
  });

  it('frame="plain" removes the outer border/background, keeping the header/list divider', async () => {
    const el = (await fixture(html`<lr-source-list frame="plain" expanded></lr-source-list>`)) as LyraSourceList;
    const baseStyle = getComputedStyle(part(el, 'base'));
    expect(baseStyle.borderTopWidth).to.equal('0px');
    expect(baseStyle.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    const listStyle = getComputedStyle(part(el, 'list'));
    expect(listStyle.borderTopWidth).to.not.equal('0px');
  });

  it('leaves the default presentation byte-identical when compact and frame are unset', async () => {
    const implicit = (await fixture(html`<lr-source-list></lr-source-list>`)) as LyraSourceList;
    const explicit = (await fixture(
      html`<lr-source-list .compact=${false} frame="card"></lr-source-list>`,
    )) as LyraSourceList;
    expect(getComputedStyle(part(implicit, 'base')).cssText).to.equal(
      getComputedStyle(part(explicit, 'base')).cssText,
    );
  });
});

describe('header text contrast at rest, hover and press', () => {
  afterEach(async () => {
    await resetMouse();
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`keeps the header text readable and following the header colour (${theme})`, async () => {
      const wrapper = await fixture<HTMLElement>(
        html`<div data-lr-theme=${theme}><lr-source-list style="--lr-transition-fast: 0s"></lr-source-list></div>`,
      );
      const el = wrapper.querySelector('lr-source-list') as LyraSourceList;
      await el.updateComplete;
      const root = el.shadowRoot!;
      const header = root.querySelector<HTMLElement>('[part="header"]')!;
      const base = root.querySelector<HTMLElement>('[part="base"]')!;
      const text = header.querySelector<HTMLElement>('span:not([part])')!;
      expect(text.textContent!.trim()).to.equal('Sources');
      const assertContrast = (state: string): void => {
        expect(
          contrastRatio(getComputedStyle(text).color, effectiveBackground(header, base)),
          state,
        ).to.be.at.least(4.5);
      };
      assertContrast('rest');

      const restBackground = getComputedStyle(header).backgroundColor;
      await hoverUntilMatched(header, 'source-list header under the pointer');
      await waitUntil(() => getComputedStyle(header).backgroundColor !== restBackground, 'hover background');
      const brand = resolvedColorToken(root, '--lr-color-brand');
      await waitUntil(() => getComputedStyle(text).color === brand, 'hovered header text turns brand');
      assertContrast('hover');
      const hoverBackground = getComputedStyle(header).backgroundColor;

      await sendMouse({ type: 'down' });
      try {
        await waitUntil(() => getComputedStyle(header).backgroundColor !== hoverBackground, 'pressed background');
        const body = resolvedColorToken(root, '--lr-color-text');
        await waitUntil(() => getComputedStyle(text).color === body, 'pressed header text returns to the body colour');
        assertContrast('pressed');
      } finally {
        await sendMouse({ type: 'up' });
      }
    });
  }
});

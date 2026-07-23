import { fixture, fixtureSync, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './source-list.js';
import '../source-card/source-card.js';
import { LyraSourceList } from './source-list.js';

it('defaults to collapsed with empty label/label-plural', async () => {
  const el = (await fixture(html`<lr-source-list></lr-source-list>`)) as LyraSourceList;
  expect(el.expanded).to.be.false;
  expect(el.hasAttribute('expanded')).to.be.false;
  expect(el.label).to.equal('');
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

it('forwards the host aria-label to the actual disclosure button', async () => {
  const el = (await fixture(
    html`<lr-source-list aria-label="Evidence sources"></lr-source-list>`,
  )) as LyraSourceList;
  expect(el.shadowRoot!.querySelector('[part="header"]')!.getAttribute('aria-label')).to.equal(
    'Evidence sources',
  );
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

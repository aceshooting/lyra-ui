import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './memory-panel.js';
import type { LyraMemoryPanel, LyraMemoryItem } from './memory-panel.js';
import { styles } from './memory-panel.styles.js';

/**
 * A dynamically-inserted `<lr-confirm-bar>` is created as part of `lr-memory-panel`'s own render
 * commit -- awaiting only the parent's `updateComplete` does not guarantee the freshly-connected
 * child (and in turn its own `<lr-button>` children) has completed *its* first Lit update cycle.
 * With the old hand-rolled native `<button>`s this never mattered (a native button needs no
 * upgrade/render cycle to be clickable); `<lr-button>` does. Every test that reaches into a
 * confirm-bar's shadow root right after it appears awaits this first.
 */
async function readyConfirmBar(el: Element): Promise<HTMLElement> {
  const confirmBar = el.querySelector('lr-confirm-bar') as HTMLElement & { updateComplete: Promise<unknown> };
  await confirmBar.updateComplete;
  return confirmBar;
}

const shortTermItems: LyraMemoryItem[] = [
  { id: 's1', text: 'User is debugging a TypeScript build error.', confidence: 0.9 },
  { id: 's2', text: 'User prefers concise answers.' },
];

const longTermItems: LyraMemoryItem[] = [
  {
    id: 'l1',
    text: "User's name is Alex and they work at Acme Corp.",
    confidence: 0.4,
    provenance: { entities: [{ id: 'e1', label: 'Alex', type: 'person' }] },
  },
  { id: 'l2', text: 'User is allergic to peanuts.', confidence: 0.85 },
];

async function populated(): Promise<LyraMemoryPanel> {
  const el = (await fixture(html`<lr-memory-panel></lr-memory-panel>`)) as LyraMemoryPanel;
  el.shortTerm = shortTermItems;
  el.longTerm = longTermItems;
  await el.updateComplete;
  return el;
}

describe('lr-memory-panel', () => {
  it('renders lr-empty and no sections when both shortTerm and longTerm are empty', async () => {
    const el = (await fixture(html`<lr-memory-panel></lr-memory-panel>`)) as LyraMemoryPanel;
    expect(el.shortTerm).to.deep.equal([]);
    expect(el.longTerm).to.deep.equal([]);
    expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="section"]')).to.not.exist;
  });

  it('renders one section per non-empty list with localized headings and role="list" wrappers', async () => {
    const el = await populated();
    const sections = el.shadowRoot!.querySelectorAll('[part="section"]');
    expect(sections.length).to.equal(2);
    const headings = [...el.shadowRoot!.querySelectorAll('[part="heading"]')].map((h) => h.textContent);
    expect(headings).to.include('Short-term context');
    expect(headings).to.include('Long-term memories');
    const lists = el.shadowRoot!.querySelectorAll('[part="list"]');
    expect(lists.length).to.equal(2);
    for (const list of lists) expect(list.getAttribute('role')).to.equal('list');
    expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(4);
  });

  it('shows a localized "no items" message for an empty section while the other section has items', async () => {
    const el = (await fixture(html`<lr-memory-panel></lr-memory-panel>`)) as LyraMemoryPanel;
    el.shortTerm = shortTermItems;
    await el.updateComplete;
    const emptySection = [...el.shadowRoot!.querySelectorAll('[part="section"]')].find(
      (s) => s.getAttribute('data-scope') === 'long-term',
    )!;
    expect(emptySection.querySelector('[part="section-empty"]')!.textContent).to.equal('No data');
    expect(emptySection.querySelector('[part="list"]')).to.not.exist;
  });

  it('renders a visible, tone-mapped confidence tier label (never color alone) reusing the citation confidence vocabulary', async () => {
    const el = await populated();
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')];
    const high = rows.find((r) => r.getAttribute('data-id') === 's1')!; // 0.9
    const medium = rows.find((r) => r.getAttribute('data-id') === 'l1')!; // 0.4
    const highConfidence = high.querySelector('[part="confidence"]')!;
    expect(highConfidence.textContent).to.equal('High confidence');
    expect(highConfidence.getAttribute('data-tone')).to.equal('success');
    const mediumConfidence = medium.querySelector('[part="confidence"]')!;
    expect(mediumConfidence.textContent).to.equal('Low confidence');
    expect(mediumConfidence.getAttribute('data-tone')).to.equal('danger');
  });

  it('respects a custom thresholds prop when computing the confidence tier', async () => {
    const el = await populated();
    el.thresholds = { high: 0.95, medium: 0.1 };
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!; // 0.9, below the new high bar
    expect(row.querySelector('[part="confidence"]')!.textContent).to.equal('Medium confidence');
  });

  it('omits the confidence part entirely when an item has no confidence', async () => {
    const el = await populated();
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s2"]')!;
    expect(row.querySelector('[part="confidence"]')).to.not.exist;
  });

  it('only renders the provenance expand-toggle (and disclosure body) when an item defines provenance, collapsed by default', async () => {
    const el = await populated();
    const withProvenance = el.shadowRoot!.querySelector('[part="item"][data-id="l1"]')!;
    const withoutProvenance = el.shadowRoot!.querySelector('[part="item"][data-id="l2"]')!;
    expect(withoutProvenance.querySelector('[part="expand-toggle"]')).to.equal(null);
    expect(withoutProvenance.querySelector('[part="item-body"]')).to.equal(null);

    const toggle = withProvenance.querySelector('[part="expand-toggle"]') as HTMLButtonElement;
    const body = withProvenance.querySelector('[part="item-body"]') as HTMLElement;
    expect(toggle == null).to.equal(false);
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    // The body -- and its lr-provenance-panel -- stay mounted while collapsed (hidden via the
    // `hidden` attribute, not removed from the DOM), the same always-present-but-hidden pattern
    // lr-confirm-bar's own [part="status"] uses.
    expect(body == null).to.equal(false);
    expect(body.hasAttribute('hidden')).to.equal(true);
  });

  it('toggling the expand-toggle emits lr-expand, unhides the body, and reveals a populated lr-provenance-panel', async () => {
    const el = await populated();
    const withProvenance = el.shadowRoot!.querySelector('[part="item"][data-id="l1"]')!;
    const toggle = withProvenance.querySelector('[part="expand-toggle"]') as HTMLButtonElement;

    const listener = oneEvent(el, 'lr-expand');
    toggle.click();
    const event = await listener;
    expect(event.detail.id).to.equal('l1');
    expect(event.detail.expanded).to.equal(true);
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    const body = withProvenance.querySelector('[part="item-body"]') as HTMLElement;
    expect(body.hasAttribute('hidden')).to.equal(false);
    const panel = withProvenance.querySelector('lr-provenance-panel') as HTMLElement & { provenance: unknown };
    const receivedEntities = (panel.provenance as { entities?: { id: string }[] })?.entities ?? [];
    expect(receivedEntities.length).to.equal(1);
    expect(receivedEntities[0]!.id).to.equal('e1');
  });

  it('forwards types and thresholds through to the nested lr-provenance-panel', async () => {
    const el = await populated();
    el.types = [{ id: 'person', label: 'Person' }];
    el.thresholds = { high: 0.8, medium: 0.3 };
    (el.shadowRoot!.querySelector('[part="item"][data-id="l1"] [part="expand-toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('lr-provenance-panel') as HTMLElement & {
      types: unknown;
      thresholds: unknown;
    };
    expect(panel.types).to.deep.equal([{ id: 'person', label: 'Person' }]);
    expect(panel.thresholds).to.deep.equal({ high: 0.8, medium: 0.3 });
  });

  it('short-term items show Add and Remove actions; long-term items show Remove only', async () => {
    const el = await populated();
    const shortRow = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    expect(shortRow.querySelector('[part="add-button"]')).to.exist;
    expect(shortRow.querySelector('[part="remove-button"]')).to.exist;

    const longRow = el.shadowRoot!.querySelector('[part="item"][data-id="l1"]')!;
    expect(longRow.querySelector('[part="add-button"]')).to.not.exist;
    expect(longRow.querySelector('[part="remove-button"]')).to.exist;
  });

  it('Add opens an inline lr-confirm-bar; approving emits lr-add with the item and reverts the row, mutating nothing itself', async () => {
    const el = await populated();
    const originalShortTerm = el.shortTerm;
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="add-button"]') as HTMLButtonElement).click();
    await el.updateComplete;

    const confirmBar = (await readyConfirmBar(row)) as HTMLElement & { tone: string; heading: string };
    expect(confirmBar).to.exist;
    expect(confirmBar.tone).to.equal('neutral');
    expect(confirmBar.heading).to.equal('Add this to long-term memory?');
    expect(row.querySelector('[part="add-button"]')).to.not.exist;
    expect(row.querySelector('[part="remove-button"]')).to.not.exist;

    const listener = oneEvent(el, 'lr-add');
    (confirmBar.shadowRoot!.querySelector('[part="approve-button"]') as HTMLButtonElement).click();
    const event = await listener;
    expect(event.detail).to.deep.equal({ item: shortTermItems[0] });
    await el.updateComplete;

    expect(row.querySelector('lr-confirm-bar')).to.not.exist;
    expect(row.querySelector('[part="add-button"]')).to.exist;
    expect(el.shortTerm).to.equal(originalShortTerm); // controlled: never mutated by the component itself
  });

  it('Remove opens a danger-tone lr-confirm-bar; approving emits lr-remove with id and scope', async () => {
    const el = await populated();
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="l2"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;

    const confirmBar = (await readyConfirmBar(row)) as HTMLElement & { tone: string };
    expect(confirmBar.tone).to.equal('danger');

    const listener = oneEvent(el, 'lr-remove');
    (confirmBar.shadowRoot!.querySelector('[part="approve-button"]') as HTMLButtonElement).click();
    const event = await listener;
    expect(event.detail).to.deep.equal({ id: 'l2', scope: 'long-term' });
  });

  it('Deny cancels the pending action silently: no lr-add/lr-remove/lr-forget fires, and the row reverts', async () => {
    const el = await populated();
    let added = false;
    let removed = false;
    el.addEventListener('lr-add', () => (added = true));
    el.addEventListener('lr-remove', () => (removed = true));
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const confirmBar = await readyConfirmBar(row);
    (confirmBar.shadowRoot!.querySelector('[part="deny-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(added).to.be.false;
    expect(removed).to.be.false;
    expect(row.querySelector('lr-confirm-bar')).to.not.exist;
    expect(row.querySelector('[part="remove-button"]')).to.exist;
  });

  it('only allows one pending confirmation at a time: starting a new action on a different item cancels the first', async () => {
    const el = await populated();
    const rowA = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    const rowB = el.shadowRoot!.querySelector('[part="item"][data-id="s2"]')!;
    (rowA.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(rowA.querySelector('lr-confirm-bar')).to.exist;

    (rowB.querySelector('[part="add-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(rowA.querySelector('lr-confirm-bar')).to.not.exist;
    expect(rowA.querySelector('[part="remove-button"]')).to.exist;
    expect(rowB.querySelector('lr-confirm-bar')).to.exist;
  });

  it('renders a section-level "Forget all" control only while longTerm is non-empty', async () => {
    const withLongTerm = await populated();
    expect(withLongTerm.shadowRoot!.querySelector('[part="forget-all-button"]')).to.exist;

    const withoutLongTerm = (await fixture(html`<lr-memory-panel></lr-memory-panel>`)) as LyraMemoryPanel;
    withoutLongTerm.shortTerm = shortTermItems;
    await withoutLongTerm.updateComplete;
    expect(withoutLongTerm.shadowRoot!.querySelector('[part="forget-all-button"]')).to.not.exist;
  });

  it('Forget all opens a danger-tone lr-confirm-bar with the memory count in its body; approving emits lr-forget with no id', async () => {
    const el = await populated();
    (el.shadowRoot!.querySelector('[part="forget-all-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const confirmBar = (await readyConfirmBar(el.shadowRoot!.querySelector('[part="section"][data-scope="long-term"]')!)) as HTMLElement & {
      tone: string;
      heading: string;
    };
    expect(confirmBar.tone).to.equal('danger');
    expect(confirmBar.heading).to.equal('Forget all long-term memories?');
    expect(confirmBar.textContent).to.include('2');

    const listener = oneEvent(el, 'lr-forget');
    (confirmBar.shadowRoot!.querySelector('[part="approve-button"]') as HTMLButtonElement).click();
    const event = await listener;
    expect(event.detail).to.be.null;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="forget-all-button"]')).to.exist;
  });

  it('re-emits child events unmodified (lr-toggle bubbles up from a nested lr-provenance-panel)', async () => {
    const el = await populated();
    (el.shadowRoot!.querySelector('[part="item"][data-id="l1"] [part="expand-toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-toggle');
    (el.shadowRoot!.querySelector('lr-provenance-panel')!.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement).click();
    const event = await listener;
    expect(event.detail.section).to.equal('entities');
  });

  it('moves focus to a stable element after resolving a pending confirmation, never leaving it stranded', async () => {
    const el = await populated();
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const confirmBar = await readyConfirmBar(row);
    (confirmBar.shadowRoot!.querySelector('[part="deny-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.shadowRoot!.activeElement).to.exist;
    expect(row.contains(el.shadowRoot!.activeElement)).to.be.true;
  });

  it('uses instance-safe disclosure ids for hostile and duplicate caller ids', async () => {
    const hostile = 'same id\"]';
    const item = (text: string): LyraMemoryItem => ({
      id: hostile,
      text,
      provenance: { entities: [{ id: 'entity', label: 'Entity', type: 'person' }] },
    });
    const first = (await fixture(html`<lr-memory-panel></lr-memory-panel>`)) as LyraMemoryPanel;
    const second = (await fixture(html`<lr-memory-panel></lr-memory-panel>`)) as LyraMemoryPanel;
    first.shortTerm = [item('First')];
    first.longTerm = [item('Second')];
    second.shortTerm = [item('Third')];
    await Promise.all([first.updateComplete, second.updateComplete]);

    const toggles = [
      ...first.shadowRoot!.querySelectorAll('[part="expand-toggle"]'),
      ...second.shadowRoot!.querySelectorAll('[part="expand-toggle"]'),
    ];
    const ids = toggles.map((toggle) => toggle.getAttribute('aria-controls')!);
    expect(new Set(ids).size).to.equal(3);
    expect(ids.some((id) => id.includes(hostile))).to.be.false;
    for (const toggle of toggles) {
      expect(first.shadowRoot!.getElementById(toggle.getAttribute('aria-controls')!) != null ||
        second.shadowRoot!.getElementById(toggle.getAttribute('aria-controls')!) != null).to.be.true;
    }
  });

  it('keys pending confirmations by item identity and scope, not a duplicate public id', async () => {
    const duplicateShort = { id: 'duplicate', text: 'Short' };
    const duplicateLong = { id: 'duplicate', text: 'Long' };
    const el = (await fixture(html`<lr-memory-panel></lr-memory-panel>`)) as LyraMemoryPanel;
    el.shortTerm = [duplicateShort];
    el.longTerm = [duplicateLong];
    await el.updateComplete;
    const longRow = el.shadowRoot!.querySelector(
      '[part="section"][data-scope="long-term"] [part="item"]',
    )!;
    (longRow.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-confirm-bar').length).to.equal(1);
    expect(longRow.querySelector('lr-confirm-bar')?.textContent).to.contain('Long');
  });

  it('cancels a pending decision when controlled data replaces the captured record', async () => {
    const el = await populated();
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-confirm-bar').length).to.equal(1);

    el.shortTerm = [{ ...shortTermItems[0]! }, shortTermItems[1]!];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-confirm-bar').length).to.equal(0);
  });

  it('moves focus to a surviving row when approval synchronously removes the focused item', async () => {
    const el = await populated();
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const confirmBar = await readyConfirmBar(row);
    el.addEventListener(
      'lr-remove',
      () => {
        el.shortTerm = el.shortTerm.slice(1);
      },
      { once: true },
    );
    (confirmBar.shadowRoot!.querySelector('[part="approve-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('data-id')).to.equal(
      's2',
    );
  });

  it('shrinks to a 320px allocation with long item text without horizontal overflow', async () => {
    const longItems: LyraMemoryItem[] = [
      {
        id: 'long',
        text: 'ThisIsAnIntentionallyLongUnbrokenPieceOfMemoryTextUsedToVerifyThatTheComponentWrapsInsteadOfOverflowingItsAllocatedWidth',
        confidence: 0.6,
      },
    ];
    const el = (await fixture(html`
      <lr-memory-panel style="inline-size: 320px; max-inline-size: 100%;"></lr-memory-panel>
    `)) as LyraMemoryPanel;
    el.shortTerm = longItems;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(el.clientWidth + 1);
  });

  it('renders correctly under dir="rtl" and stays accessible', async () => {
    const wrapper = (await fixture(html`<div dir="rtl"><lr-memory-panel></lr-memory-panel></div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-memory-panel') as LyraMemoryPanel;
    el.shortTerm = shortTermItems;
    el.longTerm = longTermItems;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(4);
    await expect(el).to.be.accessible();
  });

  it('is accessible in the empty state', async () => {
    const el = (await fixture(html`<lr-memory-panel></lr-memory-panel>`)) as LyraMemoryPanel;
    await expect(el).to.be.accessible();
  });

  it('is accessible in a populated state with a pending confirmation open', async () => {
    const el = await populated();
    (el.shadowRoot!.querySelector('[part="item"][data-id="l1"] [part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    await readyConfirmBar(el.shadowRoot!.querySelector('[part="item"][data-id="l1"]')!);
    await expect(el).to.be.accessible();
  });

  it('gives expand-toggle, add-button, remove-button, and forget-all-button a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='expand-toggle'\]:hover/);
    expect(css).to.match(/\[part='add-button'\]:hover/);
    expect(css).to.match(/\[part='remove-button'\]:hover/);
    expect(css).to.match(/\[part='forget-all-button'\]:hover/);
  });

  describe('localization', () => {
    it('localizes section headings, action labels, and confirm headings via this.localize()', async () => {
      const el = (await fixture(html`
        <lr-memory-panel
          .strings=${{
            memoryPanelShortTermHeading: 'Contexte à court terme',
            memoryPanelLongTermHeading: 'Mémoire à long terme',
            memoryPanelAdd: 'Ajouter à la mémoire',
            remove: 'Supprimer',
            memoryPanelForgetAll: 'Tout oublier',
            memoryPanelConfirmRemoveHeading: 'Supprimer cet élément ?',
          }}
        ></lr-memory-panel>
      `)) as LyraMemoryPanel;
      el.shortTerm = shortTermItems;
      el.longTerm = longTermItems;
      await el.updateComplete;

      const headings = [...el.shadowRoot!.querySelectorAll('[part="heading"]')].map((h) => h.textContent);
      expect(headings).to.include('Contexte à court terme');
      expect(headings).to.include('Mémoire à long terme');

      const shortRow = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
      expect((shortRow.querySelector('[part="add-button"]') as HTMLElement).textContent!.trim()).to.equal(
        'Ajouter à la mémoire',
      );
      expect((shortRow.querySelector('[part="remove-button"]') as HTMLElement).textContent!.trim()).to.equal(
        'Supprimer',
      );
      expect((el.shadowRoot!.querySelector('[part="forget-all-button"]') as HTMLElement).textContent!.trim()).to.equal(
        'Tout oublier',
      );

      (shortRow.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
      await el.updateComplete;
      const confirmBar = shortRow.querySelector('lr-confirm-bar') as HTMLElement & { heading: string };
      expect(confirmBar.heading).to.equal('Supprimer cet élément ?');
    });

    it('renders the built-in English fallback with no locale registered', async () => {
      const el = await populated();
      const groupLabel = (el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute('aria-label');
      expect(groupLabel).to.equal('Memory');
    });
  });

  describe('--lr-memory-panel-confidence-<tone>-color', () => {
    it('recolors only the confidence indicator that reads the matching custom property', async () => {
      const el = await populated();
      const successConfidence = el.shadowRoot!.querySelector('[part="item"][data-id="s1"] [part="confidence"]') as HTMLElement; // data-tone="success"
      el.style.setProperty('--lr-memory-panel-confidence-success-color', 'rgb(10, 20, 30)');
      expect(getComputedStyle(successConfidence).color).to.equal('rgb(10, 20, 30)');

      const dangerConfidence = el.shadowRoot!.querySelector('[part="item"][data-id="l1"] [part="confidence"]') as HTMLElement; // data-tone="danger"
      expect(getComputedStyle(dangerConfidence).color).to.not.equal('rgb(10, 20, 30)');
    });

    it('renders identically to the shared success/warning/danger tokens when unset', async () => {
      const el = await populated();
      const successConfidence = el.shadowRoot!.querySelector('[part="item"][data-id="s1"] [part="confidence"]') as HTMLElement;
      const unset = getComputedStyle(successConfidence).color;
      el.style.setProperty('--lr-memory-panel-confidence-success-color', 'var(--lr-color-success)');
      expect(getComputedStyle(successConfidence).color).to.equal(unset);
    });
  });
});

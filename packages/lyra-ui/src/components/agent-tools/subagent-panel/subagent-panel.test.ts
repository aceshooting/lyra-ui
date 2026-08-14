import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './subagent-panel.js';
import type { LyraSubagentPanel, SubagentRun } from './subagent-panel.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

type CssEscapeHost = { escape?: (identifier: string) => string };

function createRealmFrame(): {
  iframe: HTMLIFrameElement;
  frameDocument: Document;
  frameWindow: Window & typeof globalThis;
} {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('Could not create an iframe realm for the subagent-panel test.');
  }
  return { iframe, frameDocument, frameWindow };
}

function replaceCssEscape(
  target: CssEscapeHost,
  replacement: CssEscapeHost['escape'],
): () => void {
  const previous = Object.getOwnPropertyDescriptor(target, 'escape');
  Object.defineProperty(target, 'escape', {
    configurable: true,
    writable: true,
    value: replacement,
  });
  return () => {
    if (previous) Object.defineProperty(target, 'escape', previous);
    else Reflect.deleteProperty(target, 'escape');
  };
}

function sinkTexts(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"] > div`),
    (node) => node.textContent ?? '',
  );
}

const runs: SubagentRun[] = [
  { id: 'research', label: 'Researcher', status: 'running', task: 'Find sources', progressRatio: 0.5 },
  { id: 'writer', parentId: 'research', label: 'Writer', status: 'waiting-input', task: 'Draft answer' },
  { id: 'review', label: 'Reviewer', status: 'error', task: 'Verify claims' },
];

it('renders nested runs, localized statuses, tasks, and guarded progress', async () => {
  const el = (await fixture(html`<lr-subagent-panel .runs=${runs}></lr-subagent-panel>`)) as LyraSubagentPanel;
  expect(el.shadowRoot!.querySelectorAll('[part~="run"]').length).to.equal(3);
  expect(el.shadowRoot!.querySelector('[data-run-id="writer"]')!.getAttribute('data-depth')).to.equal('1');
  expect(el.shadowRoot!.textContent).to.contain('Find sources');
  expect(el.shadowRoot!.querySelector('[part="progress"]')!.getAttribute('aria-valuenow')).to.equal('50');
  const list = el.shadowRoot!.querySelector('[part="list"]')!;
  const writer = el.shadowRoot!.querySelector('[data-run-id="writer"]')!;
  expect(list.getAttribute('role')).to.equal('tree');
  expect(writer.getAttribute('role')).to.equal('treeitem');
  expect(writer.getAttribute('aria-level')).to.equal('2');
  expect(writer.getAttribute('aria-posinset')).to.equal('1');
  expect(writer.getAttribute('aria-setsize')).to.equal('1');
});

it('emits full selections plus status-appropriate cancel and retry intents', async () => {
  const el = (await fixture(html`<lr-subagent-panel .runs=${runs}></lr-subagent-panel>`)) as LyraSubagentPanel;
  const selectPending = oneEvent(el, 'lr-run-activate');
  (el.shadowRoot!.querySelector('[data-run-id="research"] [part="run-trigger"]') as HTMLButtonElement).click();
  expect((await selectPending).detail).to.deep.equal({ runId: 'research', run: runs[0] });

  const cancelPending = oneEvent(el, 'lr-cancel');
  (el.shadowRoot!.querySelector('[data-run-id="research"] [part="cancel"]') as HTMLButtonElement).click();
  expect((await cancelPending).detail).to.deep.equal({ runId: 'research' });

  const retryPending = oneEvent(el, 'lr-run-retry');
  (el.shadowRoot!.querySelector('[data-run-id="review"] [part="retry"]') as HTMLButtonElement).click();
  expect((await retryPending).detail).to.deep.equal({ runId: 'review' });
});

it('activates the focused treeitem with Enter/Space and contextualizes row actions', async () => {
  const el = (await fixture(html`<lr-subagent-panel .runs=${runs}></lr-subagent-panel>`)) as LyraSubagentPanel;
  await el.updateComplete;
  const research = el.shadowRoot!.querySelector<HTMLElement>('[data-run-id="research"]')!;
  const review = el.shadowRoot!.querySelector<HTMLElement>('[data-run-id="review"]')!;
  research.focus();
  const enterPending = oneEvent(el, 'lr-run-activate');
  research.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
  expect((await enterPending).detail).to.deep.equal({ runId: 'research', run: runs[0] });

  review.focus();
  const spacePending = oneEvent(el, 'lr-run-activate');
  review.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
  expect((await spacePending).detail).to.deep.equal({ runId: 'review', run: runs[2] });
  expect(
    el.shadowRoot!.querySelector('[data-run-id="research"] [part="cancel"]')!.getAttribute('aria-label'),
  ).to.equal('Cancel Researcher');
  expect(
    el.shadowRoot!.querySelector('[data-run-id="review"] [part="retry"]')!.getAttribute('aria-label'),
  ).to.equal('Retry Reviewer');
});

it('renders an empty state and has an accessible populated state', async () => {
  const empty = (await fixture(html`<lr-subagent-panel></lr-subagent-panel>`)) as LyraSubagentPanel;
  expect(empty.shadowRoot!.querySelector('lr-empty')).to.exist;
  const populated = (await fixture(html`<lr-subagent-panel .runs=${runs}></lr-subagent-panel>`)) as LyraSubagentPanel;
  await expect(populated).shadowDom.to.be.accessible();
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-subagent-panel
    .runs=${runs}
    .strings=${{ subagentPanelLabel: 'Localized agent hierarchy' }}
  ></lr-subagent-panel>`)) as LyraSubagentPanel;
  expect(el.shadowRoot!.querySelector('[part="list"]')!.getAttribute('aria-label')).to.equal('Localized agent hierarchy');
});

it('iteratively bounds a deeply nested hierarchy without overflowing the stack', async () => {
  const deep: SubagentRun[] = Array.from({ length: 10_000 }, (_, index) => ({
    id: `run-${index}`,
    parentId: index === 0 ? undefined : `run-${index - 1}`,
    label: `Run ${index}`,
    status: 'done',
  }));
  const el = (await fixture(html`<lr-subagent-panel .runs=${deep}></lr-subagent-panel>`)) as LyraSubagentPanel;
  const rows = el.shadowRoot!.querySelectorAll('[part~="run"]');
  expect(rows.length).to.equal(500);
  expect((rows[rows.length - 1] as HTMLElement).style.getPropertyValue('--lr-subagent-depth')).to.equal('12');
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal(
    'Only the first 500 subagent runs are shown.',
  );
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.getAttribute('role')).to.equal(null);
  expect(sinkTexts(), 'a hierarchy that mounts already truncated is not a live change').to.deep.equal([]);
});

it('announces a newly reached run ceiling through the shared light-DOM sink', async () => {
  const el = (await fixture(html`<lr-subagent-panel .runs=${runs}></lr-subagent-panel>`)) as LyraSubagentPanel;
  el.runs = Array.from({ length: 501 }, (_, index) => ({
    id: `run-${index}`,
    label: `Run ${index}`,
    status: 'done' as const,
  }));
  await el.updateComplete;

  expect(sinkTexts()).to.deep.equal(['Only the first 500 subagent runs are shown.']);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.getAttribute('role')).to.equal(null);
  el.remove();
  expect(document.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`).length).to.equal(0);
});

it('moves roving tabindex through a nested hierarchy with ArrowDown/ArrowUp/Home/End', async () => {
  const nested: SubagentRun[] = [
    { id: 'root', label: 'Root', status: 'running' },
    { id: 'child', parentId: 'root', label: 'Child', status: 'running' },
    { id: 'grandchild', parentId: 'child', label: 'Grandchild', status: 'done' },
  ];
  const el = (await fixture(html`<lr-subagent-panel .runs=${nested}></lr-subagent-panel>`)) as LyraSubagentPanel;
  await el.updateComplete;
  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  const root = el.shadowRoot!.querySelector('[data-run-id="root"]') as HTMLElement;
  const child = el.shadowRoot!.querySelector('[data-run-id="child"]') as HTMLElement;
  const grandchild = el.shadowRoot!.querySelector('[data-run-id="grandchild"]') as HTMLElement;
  const tabbableCount = () =>
    Array.from(el.shadowRoot!.querySelectorAll('[role="treeitem"]')).filter(
      (row) => row.getAttribute('tabindex') === '0',
    ).length;

  expect(root.getAttribute('tabindex')).to.equal('0');
  expect(child.getAttribute('tabindex')).to.equal('-1');
  expect(grandchild.getAttribute('tabindex')).to.equal('-1');
  expect(tabbableCount()).to.equal(1);

  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(root.getAttribute('tabindex')).to.equal('-1');
  expect(child.getAttribute('tabindex')).to.equal('0');
  expect((el.shadowRoot!.activeElement) === (child)).to.equal(true);
  expect(tabbableCount()).to.equal(1);

  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(grandchild.getAttribute('tabindex')).to.equal('0');
  expect((el.shadowRoot!.activeElement) === (grandchild)).to.equal(true);
  expect(tabbableCount()).to.equal(1);

  // Already at the last row -- ArrowDown must clamp, not run off the end.
  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(grandchild.getAttribute('tabindex')).to.equal('0');
  expect(tabbableCount()).to.equal(1);

  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(child.getAttribute('tabindex')).to.equal('0');
  expect((el.shadowRoot!.activeElement) === (child)).to.equal(true);
  expect(tabbableCount()).to.equal(1);

  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(grandchild.getAttribute('tabindex')).to.equal('0');
  expect((el.shadowRoot!.activeElement) === (grandchild)).to.equal(true);
  expect(tabbableCount()).to.equal(1);

  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(root.getAttribute('tabindex')).to.equal('0');
  expect((el.shadowRoot!.activeElement) === (root)).to.equal(true);
  expect(tabbableCount()).to.equal(1);
});

it('uses the adopted owner realm CSS escape when keyboard focus targets a special run id', async () => {
  const specialId = 'target\"] [data-run-id=\"decoy';
  const adoptedRuns: SubagentRun[] = [
    { id: 'start', label: 'Start', status: 'running' },
    { id: specialId, label: 'Special', status: 'done' },
    { id: 'decoy', label: 'Decoy', status: 'done' },
  ];
  const { iframe, frameDocument, frameWindow } = createRealmFrame();
  const el = (await fixture(
    html`<lr-subagent-panel .runs=${adoptedRuns}></lr-subagent-panel>`,
  )) as LyraSubagentPanel;
  el.remove();
  frameDocument.adoptNode(el);
  frameDocument.body.append(el);
  await el.updateComplete;

  const ownerEscape = frameWindow.CSS.escape.bind(frameWindow.CSS);
  let ownerCalls = 0;
  const restoreOwner = replaceCssEscape(frameWindow.CSS, (identifier) => {
    ownerCalls += 1;
    return ownerEscape(identifier);
  });
  const restoreAmbient = replaceCssEscape(CSS, () => 'decoy');
  try {
    el.shadowRoot!.querySelector<HTMLElement>('[part="list"]')!.dispatchEvent(
      new frameWindow.KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        composed: true,
      }),
    );
    await el.updateComplete;
    await Promise.resolve();

    expect(ownerCalls).to.equal(1);
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('data-run-id')).to.equal(specialId);
  } finally {
    restoreAmbient();
    restoreOwner();
    el.remove();
    iframe.remove();
  }
});

it('falls back to an exact run-id scan when adopted owner CSS escape is missing or throws', async () => {
  const specialId = 'target\"] [data-run-id=\"decoy';
  for (const mode of ['missing', 'throwing'] as const) {
    const { iframe, frameDocument, frameWindow } = createRealmFrame();
    const el = (await fixture(
      html`<lr-subagent-panel
        .runs=${[
          { id: 'start', label: 'Start', status: 'running' as const },
          { id: specialId, label: 'Special', status: 'done' as const },
          { id: 'decoy', label: 'Decoy', status: 'done' as const },
        ]}
      ></lr-subagent-panel>`,
    )) as LyraSubagentPanel;
    el.remove();
    frameDocument.adoptNode(el);
    frameDocument.body.append(el);
    await el.updateComplete;

    let ownerCalls = 0;
    const restoreOwner = replaceCssEscape(
      frameWindow.CSS,
      mode === 'missing'
        ? undefined
        : () => {
            ownerCalls += 1;
            throw new Error('owner CSS escape unavailable');
          },
    );
    const restoreAmbient = replaceCssEscape(CSS, () => 'decoy');
    try {
      el.shadowRoot!.querySelector<HTMLElement>('[part="list"]')!.dispatchEvent(
        new frameWindow.KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          composed: true,
        }),
      );
      await el.updateComplete;
      await Promise.resolve();

      expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('data-run-id')).to.equal(specialId);
      expect(ownerCalls).to.equal(mode === 'throwing' ? 1 : 0);
    } finally {
      restoreAmbient();
      restoreOwner();
      el.remove();
      iframe.remove();
    }
  }
});

it('re-points roving tabindex to a surviving row when the focused row disappears from a runs update (regression)', async () => {
  const nested: SubagentRun[] = [
    { id: 'root', label: 'Root', status: 'running' },
    { id: 'child', parentId: 'root', label: 'Child', status: 'running' },
    { id: 'grandchild', parentId: 'child', label: 'Grandchild', status: 'done' },
  ];
  const el = (await fixture(html`<lr-subagent-panel .runs=${nested}></lr-subagent-panel>`)) as LyraSubagentPanel;
  await el.updateComplete;
  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;

  // Focus the grandchild -- the row about to disappear.
  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[data-run-id="grandchild"]') as HTMLElement).getAttribute('tabindex')).to.equal(
    '0',
  );

  // Data shrinks below the roving index: the focused row is removed by a `runs` update.
  el.runs = nested.filter((run) => run.id !== 'grandchild');
  await el.updateComplete;

  expect((el.shadowRoot!.querySelector('[data-run-id="grandchild"]')) == null).to.be.true;
  const tabbable = Array.from(el.shadowRoot!.querySelectorAll('[role="treeitem"]')).filter(
    (row) => row.getAttribute('tabindex') === '0',
  );
  // Exactly one stop remains tabbable -- never zero -- and it's a row that still exists.
  expect(tabbable.length).to.equal(1);
  expect((tabbable[0] as HTMLElement).getAttribute('data-run-id')).to.equal('root');
});

it('tracks roving focus when focus lands directly on a nested action button, bypassing the row (regression)', async () => {
  // Non-bubbling native "focus" only fires the row's own listener when focus lands on the <li>
  // itself. Landing focus directly on a nested run-trigger/cancel/retry button (script .focus(),
  // or Tab-then-click) must still update the tracker -- verified here by checking that a
  // SUBSEQUENT arrow-key press moves relative to the row that actually owns the focused button,
  // not from a stale tracked id.
  const chain: SubagentRun[] = [
    { id: 'root', label: 'Root', status: 'running' },
    { id: 'child', parentId: 'root', label: 'Child', status: 'running' },
    { id: 'grandchild', parentId: 'child', label: 'Grandchild', status: 'running' },
    { id: 'leaf', parentId: 'grandchild', label: 'Leaf', status: 'running' },
  ];
  const el = (await fixture(html`<lr-subagent-panel .runs=${chain}></lr-subagent-panel>`)) as LyraSubagentPanel;
  await el.updateComplete;
  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  const root = el.shadowRoot!.querySelector('[data-run-id="root"]') as HTMLElement;
  const grandchild = el.shadowRoot!.querySelector('[data-run-id="grandchild"]') as HTMLElement;
  const leafCancel = el.shadowRoot!.querySelector('[data-run-id="leaf"] [part="cancel"]') as HTMLButtonElement;

  // Skip the row entirely -- focus the nested cancel button directly, as native Tab can too.
  leafCancel.focus();
  await el.updateComplete;

  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
  await el.updateComplete;

  // A correctly-updated tracker moves up from "leaf" (index 3) to "grandchild" (index 2). A
  // tracker still stuck at the default first row ("root", index 0) would instead re-focus root.
  expect(grandchild.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.activeElement === grandchild).to.equal(true);
  expect(root.getAttribute('tabindex')).to.equal('-1');
});

it('keeps nested run-trigger/cancel/retry buttons in the native Tab order', async () => {
  const withActionable: SubagentRun[] = [
    { id: 'active', label: 'Active', status: 'running' },
    { id: 'broken', label: 'Broken', status: 'error' },
  ];
  const el = (await fixture(
    html`<lr-subagent-panel .runs=${withActionable}></lr-subagent-panel>`,
  )) as LyraSubagentPanel;
  await el.updateComplete;

  const actions = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(
    '[part="run-trigger"], [part="cancel"], [part="retry"]',
  )];
  expect(actions).to.have.length(4);
  expect(actions.every((button) => button.getAttribute('tabindex') === null)).to.be.true;
  expect(actions.every((button) => button.tabIndex === 0)).to.be.true;
});

it('caches tree ordering and only recomputes it when `runs` changes (regression)', async () => {
  const nested: SubagentRun[] = [
    { id: 'root', label: 'Root', status: 'running' },
    { id: 'child', parentId: 'root', label: 'Child', status: 'running' },
  ];
  const el = (await fixture(html`<lr-subagent-panel .runs=${nested}></lr-subagent-panel>`)) as LyraSubagentPanel;
  await el.updateComplete;

  const original = (el as unknown as { ordered: () => unknown }).ordered.bind(el);
  let calls = 0;
  (el as unknown as { ordered: () => unknown }).ordered = () => {
    calls += 1;
    return original();
  };

  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  // Several keydowns and an unrelated re-render (selectedRunId change, not `runs`) must reuse the
  // cached ordering rather than recomputing it.
  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  el.selectedRunId = 'child';
  await el.updateComplete;
  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
  await el.updateComplete;

  expect(calls, 'ordered() must not be recomputed by keydown handling or unrelated re-renders').to.equal(0);
  // The cached ordering must still be correct across all of that -- Home moved focus back to root.
  expect(
    (el.shadowRoot!.querySelector('[data-run-id="root"]') as HTMLElement).getAttribute('tabindex'),
  ).to.equal('0');

  // Changing `runs` must recompute exactly once and reflect the new tree correctly.
  el.runs = [...nested, { id: 'grandchild', parentId: 'child', label: 'Grandchild', status: 'done' }];
  await el.updateComplete;
  expect(calls).to.equal(1);
  const grandchild = el.shadowRoot!.querySelector('[data-run-id="grandchild"]');
  // A derived primitive, never the node itself: handing chai a live DOM node as actual/expected
  // hangs the whole file in the runner's message serialization.
  expect(grandchild !== null).to.equal(true);
  expect(grandchild!.getAttribute('data-depth')).to.equal('2');
});

it('allows selected and progress states to be rethemed independently', async () => {
  const el = (await fixture(html`
    <lr-subagent-panel
      style="
        --lr-subagent-panel-selected-border: rgb(1, 2, 3);
        --lr-subagent-panel-progress-fill: rgb(4, 5, 6);
      "
      selected-run-id="research"
      .runs=${runs}
    ></lr-subagent-panel>
  `)) as LyraSubagentPanel;
  const selected = el.shadowRoot!.querySelector('[part~="run-selected"]') as HTMLElement;
  const fill = el.shadowRoot!.querySelector('[part="progress"] > span') as HTMLElement;
  expect(getComputedStyle(selected).borderTopColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(fill).backgroundColor).to.equal('rgb(4, 5, 6)');
});

import { expect, fixture, html, oneEvent } from '@open-wc/testing';

import './components/agent-tools/activity-feed/activity-feed.js';
import './components/agent-tools/agent-run/agent-run.js';
import './components/agent-tools/agent-trace/agent-trace.js';
import './components/agent-tools/approval-queue/approval-queue.js';
import './components/agent-tools/artifact-panel/artifact-panel.js';
import './components/agent-tools/browser-frame/browser-frame.js';
import './components/agent-tools/commit-card/commit-card.js';
import './components/agent-tools/compare-panel/compare-panel.js';
import './components/agent-tools/context-inspector/context-inspector.js';
import './components/agent-tools/eval-dataset/eval-dataset.js';
import './components/agent-tools/eval-result/eval-result.js';
import './components/agent-tools/evaluation-run/evaluation-run.js';
import './components/agent-tools/mcp-app/mcp-app.js';
import './components/agent-tools/policy-summary/policy-summary.js';
import './components/agent-tools/prompt-studio/prompt-studio.js';
import './components/agent-tools/schema-viewer/schema-viewer.js';
import './components/agent-tools/span-waterfall/span-waterfall.js';
import './components/agent-tools/stack-trace/stack-trace.js';
import './components/agent-tools/subagent-panel/subagent-panel.js';
import './components/agent-tools/task-list/task-list.js';
import './components/agent-tools/test-results/test-results.js';
import './components/agent-tools/tool-select-dialog/tool-select-dialog.js';
import './components/agent-tools/tool-timeline/tool-timeline.js';
import './components/charts/chart/box-plot.js';
import './components/charts/chart/histogram.js';
import './components/charts/chart/lite-chart.js';
import './components/conversation/message-actions/message-actions.js';
import './components/conversation/message-feedback/message-feedback.js';
import './components/conversation/message-parts/message-parts.js';
import './components/conversation/model-select/model-select.js';
import './components/conversation/model-settings-panel/model-settings-panel.js';
import './components/conversation/prompt-input/prompt-input.js';
import './components/conversation/prompt-queue/prompt-queue.js';
import './components/conversation/realtime-session/realtime-session.js';
import './components/conversation/selection-toolbar/selection-toolbar.js';
import './components/conversation/suggestion-chips/suggestion-chips.js';
import './components/conversation/thread-list/thread-list.js';
import './components/conversation/transcript-feed/transcript-feed.js';
import './components/data/calendar/calendar.js';
import './components/data/context-meter/context-meter.js';
import './components/data/heatmap/heatmap.js';
import './components/layout/command-palette/command-palette.js';
import './components/layout/multi-split/multi-split.js';
import './components/layout/virtual-list/virtual-list.js';

import type { LyraMessageFeedback } from './components/conversation/message-feedback/message-feedback.js';
import type { LyraSchemaViewer } from './components/agent-tools/schema-viewer/schema-viewer.js';
import type {
  LyraVirtualList,
  VirtualListIndexedSource,
} from './components/layout/virtual-list/virtual-list.js';

const COLLECTION_LIMIT = 10_000;

export interface CollectionPropertyCase {
  readonly tag: `lr-${string}`;
  readonly property: string;
}

/**
 * Array-valued fields in the original agent-tools, charts, conversation, data, and layout
 * components that use LyraElement's deep ownership boundary. Bespoke accessor-backed properties
 * have their normalization contracts covered by their colocated component tests instead.
 */
export const APP_OWNED_ARRAY_PROPERTY_CASES: readonly CollectionPropertyCase[] = Object.freeze([
  { tag: 'lr-activity-feed', property: 'entries' },
  { tag: 'lr-agent-run', property: 'metrics' },
  { tag: 'lr-agent-trace', property: 'spans' },
  { tag: 'lr-agent-trace', property: 'hiddenKinds' },
  { tag: 'lr-approval-queue', property: 'requests' },
  { tag: 'lr-artifact-panel', property: 'versions' },
  { tag: 'lr-browser-frame', property: 'pings' },
  { tag: 'lr-commit-card', property: 'files' },
  { tag: 'lr-compare-panel', property: 'allowedVotes' },
  { tag: 'lr-context-inspector', property: 'segments' },
  { tag: 'lr-context-inspector', property: 'exportFormats' },
  { tag: 'lr-eval-dataset', property: 'examples' },
  { tag: 'lr-eval-dataset', property: 'exportFormats' },
  { tag: 'lr-eval-result', property: 'runs' },
  { tag: 'lr-eval-result', property: 'columns' },
  { tag: 'lr-eval-result', property: 'rubricKeys' },
  { tag: 'lr-evaluation-run', property: 'examples' },
  { tag: 'lr-policy-summary', property: 'decisions' },
  { tag: 'lr-prompt-studio', property: 'messages' },
  { tag: 'lr-prompt-studio', property: 'variables' },
  { tag: 'lr-prompt-studio', property: 'versions' },
  { tag: 'lr-schema-viewer', property: 'issues' },
  { tag: 'lr-span-waterfall', property: 'spans' },
  { tag: 'lr-stack-trace', property: 'internalPatterns' },
  { tag: 'lr-subagent-panel', property: 'runs' },
  { tag: 'lr-task-list', property: 'items' },
  { tag: 'lr-test-results', property: 'suites' },
  { tag: 'lr-test-results', property: 'statusFilter' },
  { tag: 'lr-tool-select-dialog', property: 'tools' },
  { tag: 'lr-tool-select-dialog', property: 'selected' },
  { tag: 'lr-tool-timeline', property: 'entries' },
  { tag: 'lr-lite-chart', property: 'labels' },
  { tag: 'lr-lite-chart', property: 'datasets' },
  { tag: 'lr-lite-chart', property: 'selectedIndices' },
  { tag: 'lr-histogram', property: 'values' },
  { tag: 'lr-box-plot', property: 'labels' },
  { tag: 'lr-box-plot', property: 'datasets' },
  { tag: 'lr-box-plot', property: 'hiddenDatasets' },
  { tag: 'lr-message-actions', property: 'controls' },
  { tag: 'lr-message-parts', property: 'parts' },
  { tag: 'lr-model-select', property: 'catalog' },
  { tag: 'lr-model-settings-panel', property: 'catalog' },
  { tag: 'lr-prompt-input', property: 'attachments' },
  { tag: 'lr-prompt-input', property: 'attachmentCapabilities' },
  { tag: 'lr-prompt-input', property: 'mentionItems' },
  { tag: 'lr-prompt-input', property: 'commandItems' },
  { tag: 'lr-prompt-input', property: 'modelCatalog' },
  { tag: 'lr-prompt-input', property: 'voiceCatalog' },
  { tag: 'lr-prompt-input', property: 'sources' },
  { tag: 'lr-prompt-input', property: 'selectedSourceIds' },
  { tag: 'lr-prompt-input', property: 'queue' },
  { tag: 'lr-prompt-queue', property: 'items' },
  { tag: 'lr-realtime-session', property: 'entries' },
  { tag: 'lr-selection-toolbar', property: 'actions' },
  { tag: 'lr-suggestion-chips', property: 'suggestions' },
  { tag: 'lr-thread-list', property: 'threads' },
  { tag: 'lr-thread-list', property: 'groupOrder' },
  { tag: 'lr-thread-list', property: 'collapsedGroupIds' },
  { tag: 'lr-thread-list', property: 'rowActions' },
  { tag: 'lr-transcript-feed', property: 'entries' },
  { tag: 'lr-calendar', property: 'events' },
  { tag: 'lr-context-meter', property: 'segments' },
  { tag: 'lr-heatmap', property: 'annotations' },
  { tag: 'lr-heatmap', property: 'legendStops' },
  { tag: 'lr-heatmap', property: 'colorSteps' },
  { tag: 'lr-multi-split', property: 'sizes' },
  { tag: 'lr-multi-split', property: 'defaultSizes' },
  { tag: 'lr-multi-split', property: 'panelConstraints' },
  { tag: 'lr-virtual-list', property: 'groups' },
]);

/** Top-level records whose legitimate public shapes contain arrays or keyed collections. */
export const APP_OWNED_RECORD_PROPERTY_CASES: readonly CollectionPropertyCase[] = Object.freeze([
  { tag: 'lr-agent-run', property: 'run' },
  { tag: 'lr-agent-run', property: 'statusLabels' },
  { tag: 'lr-agent-run', property: 'statusVariants' },
  { tag: 'lr-mcp-app', property: 'resource' },
  { tag: 'lr-schema-viewer', property: 'schema' },
  { tag: 'lr-message-feedback', property: 'detail' },
  { tag: 'lr-selection-toolbar', property: 'anchor' },
  { tag: 'lr-heatmap', property: 'data' },
]);

/** The only sequence fields in this lane whose caller item identity is the public contract. */
export const APP_IDENTITY_ARRAY_PROPERTY_CASES: readonly CollectionPropertyCase[] = Object.freeze([
  { tag: 'lr-command-palette', property: 'commands' },
  { tag: 'lr-virtual-list', property: 'items' },
  { tag: 'lr-virtual-list', property: 'source' },
]);

type DynamicElement = HTMLElement & Record<string, unknown>;

function createDynamicElement(tagName: `lr-${string}`): DynamicElement {
  return document.createElement(tagName) as DynamicElement;
}

describe('original component collection ownership contracts', () => {
  for (const { tag, property } of APP_OWNED_ARRAY_PROPERTY_CASES) {
    it(`${tag}.${property} owns a bounded, recursively frozen array snapshot`, () => {
      const element = createDynamicElement(tag);
      const source = [{ label: 'first', nested: { values: [1, 2] } }];

      element[property] = source;
      source[0]!.label = 'changed';
      source[0]!.nested.values.push(3);
      source.push({ label: 'later', nested: { values: [] } });

      const snapshot = element[property] as readonly {
        readonly label: string;
        readonly nested: { readonly values: readonly number[] };
      }[];
      expect(snapshot).not.to.equal(source);
      expect(snapshot.map((entry) => entry.label)).to.deep.equal(['first']);
      expect(snapshot[0]!.nested.values).to.deep.equal([1, 2]);
      expect(Object.isFrozen(snapshot)).to.equal(true);
      expect(Object.isFrozen(snapshot[0])).to.equal(true);
      expect(Object.isFrozen(snapshot[0]!.nested)).to.equal(true);
      expect(Object.isFrozen(snapshot[0]!.nested.values)).to.equal(true);

      element[property] = Array.from({ length: COLLECTION_LIMIT + 5 }, (_, index) => index);
      expect((element[property] as readonly unknown[]).length).to.equal(COLLECTION_LIMIT);
      expect(Object.isFrozen(element[property])).to.equal(true);
    });
  }

  for (const { tag, property } of APP_OWNED_RECORD_PROPERTY_CASES) {
    it(`${tag}.${property} owns and freezes nested record collections`, () => {
      const element = createDynamicElement(tag);
      const source = {
        label: 'first',
        nested: { values: Array.from({ length: COLLECTION_LIMIT + 5 }, (_, index) => index) },
      };

      element[property] = source;
      source.label = 'changed';
      source.nested.values.push(COLLECTION_LIMIT + 6);

      const snapshot = element[property] as {
        readonly label: string;
        readonly nested: { readonly values: readonly number[] };
      };
      expect(snapshot).not.to.equal(source);
      expect(snapshot.label).to.equal('first');
      expect(snapshot.nested.values.length).to.equal(COLLECTION_LIMIT);
      expect(Object.isFrozen(snapshot)).to.equal(true);
      expect(Object.isFrozen(snapshot.nested)).to.equal(true);
      expect(Object.isFrozen(snapshot.nested.values)).to.equal(true);
    });
  }

  for (const { tag, property } of APP_IDENTITY_ARRAY_PROPERTY_CASES) {
    it(`${tag}.${property} owns its bounded sequence while retaining item identity`, () => {
      const element = createDynamicElement(tag);
      const item = { id: 'first', nested: { values: [1, 2] } };
      const source = [item];

      element[property] = source;
      source.push({ id: 'later', nested: { values: [] } });

      const snapshot = element[property] as readonly typeof item[];
      expect(snapshot).not.to.equal(source);
      expect(snapshot.length).to.equal(1);
      expect(snapshot[0]).to.equal(item);
      expect(Object.isFrozen(snapshot)).to.equal(true);
      expect(Object.isFrozen(item)).to.equal(false);

      element[property] = Array.from({ length: COLLECTION_LIMIT + 5 }, () => item);
      expect((element[property] as readonly unknown[]).length).to.equal(COLLECTION_LIMIT);
    });
  }

  it('passes a virtual-list indexed source through by identity', () => {
    const element = createDynamicElement('lr-virtual-list') as unknown as LyraVirtualList;
    const source: VirtualListIndexedSource<{ readonly id: string }> = {
      count: 1,
      itemAt: () => ({ id: 'first' }),
    };

    element.source = source;

    expect(element.source).to.equal(source);
    expect(Object.isFrozen(source)).to.equal(false);
  });

  it('detaches and recursively freezes schema records and arrays in emitted details', async () => {
    const schema = {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: ['string', 'null'] },
      },
    };
    const element = (await fixture(
      html`<lr-schema-viewer .schema=${schema}></lr-schema-viewer>`,
    )) as LyraSchemaViewer;
    schema.required.push('later');
    schema.properties.query.type.push('number');

    const pending = oneEvent(element, 'lr-schema-select');
    (element.shadowRoot!.querySelector('[data-path="/properties/query"]') as HTMLButtonElement).click();
    const event = (await pending) as CustomEvent<{
      readonly path: string;
      readonly schema: { readonly type: readonly string[] };
    }>;

    expect(event.detail.path).to.equal('/properties/query');
    expect(event.detail.schema.type).to.deep.equal(['string', 'null']);
    expect(event.detail.schema).not.to.equal(element.schema!.properties!.query);
    expect(Object.isFrozen(event.detail)).to.equal(true);
    expect(Object.isFrozen(event.detail.schema)).to.equal(true);
    expect(Object.isFrozen(event.detail.schema.type)).to.equal(true);
  });

  it('detaches and freezes arrays in feedback event details', async () => {
    const reasons = [{ id: 'wrong', label: 'Factually wrong' }];
    const element = (await fixture(
      html`<lr-message-feedback .detail=${{ reasons }}></lr-message-feedback>`,
    )) as LyraMessageFeedback;
    reasons.push({ id: 'later', label: 'Added after assignment' });
    (element.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement).click();
    await element.updateComplete;
    (element.shadowRoot!.querySelector('[part="reasons"] lr-chip') as HTMLElement).dispatchEvent(
      new CustomEvent('lr-chip-select', {
        detail: { selected: true },
        bubbles: true,
        composed: true,
      }),
    );
    await element.updateComplete;

    const pending = oneEvent(element, 'lr-feedback-submit');
    (element.shadowRoot!.querySelector('[part="submit-button"]') as HTMLButtonElement).click();
    const event = (await pending) as CustomEvent<{
      readonly rating: 'down';
      readonly reasonIds: readonly string[];
      readonly comment: string;
    }>;

    expect(event.detail.reasonIds).to.deep.equal(['wrong']);
    expect(Object.isFrozen(event.detail)).to.equal(true);
    expect(Object.isFrozen(event.detail.reasonIds)).to.equal(true);
  });
});

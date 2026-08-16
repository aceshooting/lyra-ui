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
import './components/agent-tools/tool-param-form/tool-param-form.js';
import './components/agent-tools/tool-select-dialog/tool-select-dialog.js';
import './components/agent-tools/tool-timeline/tool-timeline.js';
import './components/charts/chart/box-plot.js';
import './components/charts/chart/histogram.js';
import './components/charts/chart/lite-chart.js';
import './components/conversation/agent-workspace/agent-workspace.js';
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
import './components/conversation/voice-picker/voice-picker.js';
import './components/data/calendar/calendar.js';
import './components/data/condition-builder/condition-builder.js';
import './components/data/context-meter/context-meter.js';
import './components/data/document-library/document-library.js';
import './components/data/env-list/env-list.js';
import './components/data/file-tree/file-tree.js';
import './components/data/flow-canvas/flow-canvas.js';
import './components/data/flow-node/flow-node.js';
import './components/data/flow-run-status/flow-run-status.js';
import './components/data/graph-query-builder/graph-query-builder.js';
import './components/data/heatmap/heatmap.js';
import './components/data/sequence-strip/sequence-strip.js';
import './components/data/stat/stat.js';
import './components/data/table/table.js';
import './components/data/word-cloud/word-cloud.js';
import './components/layout/command-palette/command-palette.js';
import './components/layout/drilldown-panel/drilldown-panel.js';
import './components/layout/filter-bar/filter-bar.js';
import './components/layout/multi-split/multi-split.js';
import './components/layout/segmented/segmented.js';
import './components/layout/stepper/stepper.js';
import './components/layout/virtual-list/virtual-list.js';

import type { LyraMessageFeedback } from './components/conversation/message-feedback/message-feedback.js';
import type { LyraVoicePicker } from './components/conversation/voice-picker/voice-picker.js';
import type { LyraJsonSchemaViewer } from './components/agent-tools/schema-viewer/schema-viewer.js';
import type { LyraToolParamForm } from './components/agent-tools/tool-param-form/tool-param-form.js';
import type {
  LyraVirtualList,
  LyraVirtualListIndexedSource,
} from './components/layout/virtual-list/virtual-list.js';

const COLLECTION_LIMIT = 10_000;

export interface CollectionPropertyCase {
  readonly tag: `lr-${string}`;
  readonly property: string;
}

export interface BespokeCollectionPropertyCase extends CollectionPropertyCase {
  readonly limit: number;
  makeEntry(index: number): unknown;
  prepare?(element: DynamicElement): void;
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
  { tag: 'lr-agent-workspace', property: 'selectedRetrievalChunkIds' },
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
  { tag: 'lr-eval-run', property: 'examples' },
  { tag: 'lr-policy-summary', property: 'decisions' },
  { tag: 'lr-prompt-studio', property: 'messages' },
  { tag: 'lr-prompt-studio', property: 'variables' },
  { tag: 'lr-prompt-studio', property: 'versions' },
  { tag: 'lr-json-schema-viewer', property: 'issues' },
  { tag: 'lr-span-waterfall', property: 'spans' },
  { tag: 'lr-stack-trace', property: 'internalPatterns' },
  { tag: 'lr-subagent-panel', property: 'runs' },
  { tag: 'lr-task-list', property: 'items' },
  { tag: 'lr-test-results', property: 'statusFilter' },
  { tag: 'lr-tool-select-dialog', property: 'tools' },
  { tag: 'lr-tool-select-dialog', property: 'selectedToolIds' },
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
  { tag: 'lr-context-meter', property: 'segments' },
  { tag: 'lr-heatmap', property: 'annotations' },
  { tag: 'lr-heatmap', property: 'legendStops' },
  { tag: 'lr-heatmap', property: 'colorSteps' },
  { tag: 'lr-multi-split', property: 'sizes' },
  { tag: 'lr-multi-split', property: 'defaultSizes' },
  { tag: 'lr-multi-split', property: 'panelConstraints' },
  { tag: 'lr-virtual-list', property: 'groups' },
]);

/**
 * Top-level records whose legitimate public shapes contain arrays or keyed collections, and which
 * go through LyraElement's generic `ownedCollectionProperties` deep-freeze machinery. `schema`
 * (schema-viewer) and `data` (heatmap) are deliberately excluded: both opt out of the generic
 * machinery in favor of their own bespoke, colocated normalization -- see the JSDoc above
 * `snapshotSchemaNode` in schema-viewer.class.ts and above `identityCollectionObjectProperties`
 * in heatmap.class.ts for why. Per this file's own top comment, bespoke accessor-backed properties
 * have their contracts covered by their colocated component tests instead.
 */
export const APP_OWNED_RECORD_PROPERTY_CASES: readonly CollectionPropertyCase[] = Object.freeze([
  { tag: 'lr-agent-run', property: 'run' },
  { tag: 'lr-agent-run', property: 'statusLabels' },
  { tag: 'lr-agent-run', property: 'statusVariants' },
  { tag: 'lr-mcp-app', property: 'resource' },
  { tag: 'lr-message-feedback', property: 'detail' },
  { tag: 'lr-selection-toolbar', property: 'anchor' },
]);

/** The only sequence fields in this lane whose caller item identity is the public contract. */
export const APP_IDENTITY_ARRAY_PROPERTY_CASES: readonly CollectionPropertyCase[] = Object.freeze([
  { tag: 'lr-command-palette', property: 'commands' },
  { tag: 'lr-test-results', property: 'suites' },
  { tag: 'lr-calendar', property: 'events' },
  { tag: 'lr-virtual-list', property: 'items' },
  { tag: 'lr-virtual-list', property: 'source' },
]);

/** Accessor-backed collection properties with their component/domain-specific synchronous caps. */
export const APP_BESPOKE_ARRAY_PROPERTY_CASES: readonly BespokeCollectionPropertyCase[] =
  Object.freeze([
    { tag: 'lr-stat', property: 'rows', limit: 10_000, makeEntry: (index) => ({ label: String(index), value: String(index) }) },
    { tag: 'lr-file-tree', property: 'nodes', limit: 10_000, makeEntry: (index) => ({ path: `/file-${index}` }) },
    { tag: 'lr-condition-builder', property: 'fields', limit: 200, makeEntry: (index) => ({ name: String(index), type: 'string' }) },
    { tag: 'lr-table', property: 'columns', limit: 10_000, makeEntry: (index) => ({ key: String(index), label: String(index), cell: () => '' }) },
    { tag: 'lr-table', property: 'rows', limit: 10_000, makeEntry: (index) => ({ id: index }) },
    { tag: 'lr-document-library', property: 'documents', limit: 10_000, makeEntry: (index) => ({ id: String(index), name: String(index) }) },
    { tag: 'lr-document-library', property: 'selectedDocumentIds', limit: 10_000, makeEntry: (index) => String(index) },
    { tag: 'lr-document-library', property: 'tagFilter', limit: 10_000, makeEntry: (index) => String(index) },
    { tag: 'lr-drilldown-panel', property: 'path', limit: 256, makeEntry: (index) => ({ nodeId: String(index), label: String(index) }) },
    { tag: 'lr-drilldown-panel', property: 'types', limit: 256, makeEntry: (index) => ({ id: String(index), label: String(index) }) },
    { tag: 'lr-filter-bar', property: 'filters', limit: 10_000, makeEntry: (index) => ({ filterId: String(index), label: String(index), type: 'text' }) },
    { tag: 'lr-env-list', property: 'entries', limit: 10_000, makeEntry: (index) => ({ name: String(index), value: String(index) }) },
    { tag: 'lr-segmented', property: 'items', limit: 256, makeEntry: (index) => ({ value: String(index), label: String(index) }) },
    { tag: 'lr-flow-canvas', property: 'nodes', limit: 10_000, makeEntry: (index) => ({ id: String(index) }) },
    { tag: 'lr-flow-canvas', property: 'edges', limit: 10_000, makeEntry: (index) => ({ id: String(index), source: 'a', target: 'b' }) },
    {
      tag: 'lr-flow-canvas',
      property: 'selectedNodeIds',
      limit: 10_000,
      makeEntry: (index) => String(index),
      prepare: (element) => {
        element['nodes'] = Array.from({ length: COLLECTION_LIMIT }, (_, index) => ({ id: String(index) }));
      },
    },
    {
      tag: 'lr-flow-canvas',
      property: 'selectedEdgeIds',
      limit: 10_000,
      makeEntry: (index) => String(index),
      prepare: (element) => {
        element['nodes'] = [{ id: 'a' }, { id: 'b' }];
        element['edges'] = Array.from({ length: COLLECTION_LIMIT }, (_, index) => ({
          id: String(index),
          source: 'a',
          target: 'b',
        }));
      },
    },
    { tag: 'lr-flow-node', property: 'inputs', limit: 10_000, makeEntry: (index) => ({ id: String(index) }) },
    { tag: 'lr-flow-node', property: 'outputs', limit: 10_000, makeEntry: (index) => ({ id: String(index) }) },
    { tag: 'lr-graph-query-builder', property: 'relationshipTypeOptions', limit: 500, makeEntry: (index) => ({ value: String(index) }) },
    { tag: 'lr-graph-query-builder', property: 'nodeTypeOptions', limit: 500, makeEntry: (index) => ({ value: String(index) }) },
    {
      tag: 'lr-graph-query-builder',
      property: 'savedQueries',
      limit: 200,
      makeEntry: (index) => ({
        id: String(index),
        name: String(index),
        query: { startId: 'a', endId: '', relationshipTypes: [], nodeTypes: [], direction: 'outgoing', minHops: 1, maxHops: 1 },
      }),
    },
    { tag: 'lr-sequence-strip', property: 'items', limit: 10_000, makeEntry: (index) => ({ id: String(index), categoryId: 'default' }) },
    { tag: 'lr-sequence-strip', property: 'categories', limit: 10_000, makeEntry: (index) => ({ id: String(index), color: 'red' }) },
    { tag: 'lr-stepper', property: 'steps', limit: 256, makeEntry: (index) => ({ stepId: String(index), label: String(index), state: 'pending' }) },
    { tag: 'lr-word-cloud', property: 'words', limit: 10_000, makeEntry: () => ({ text: 'w', weight: 1 }) },
    { tag: 'lr-word-cloud', property: 'palette', limit: 64, makeEntry: () => 'red' },
    { tag: 'lr-word-cloud', property: 'legend', limit: 100, makeEntry: (index) => ({ label: String(index), color: 'red' }) },
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
        nested: { values: [1, 2] },
      };

      element[property] = source;
      source.label = 'changed';
      source.nested.values.push(3);

      const snapshot = element[property] as {
        readonly label: string;
        readonly nested: { readonly values: readonly number[] };
      };
      expect(snapshot).not.to.equal(source);
      expect(snapshot.label).to.equal('first');
      expect(snapshot.nested.values).to.deep.equal([1, 2]);
      expect(Object.isFrozen(snapshot)).to.equal(true);
      expect(Object.isFrozen(snapshot.nested)).to.equal(true);
      expect(Object.isFrozen(snapshot.nested.values)).to.equal(true);

      element[property] = {
        label: 'oversized',
        nested: {
          values: Array.from(
            { length: COLLECTION_LIMIT + 5 },
            (_, index) => index
          ),
        },
      };
      expect(element[property]).to.deep.equal({});
      expect(Object.isFrozen(element[property])).to.equal(true);
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

  for (const { tag, property, limit, makeEntry, prepare } of APP_BESPOKE_ARRAY_PROPERTY_CASES) {
    it(`${tag}.${property} owns a frozen sequence within its domain cap`, () => {
      const element = createDynamicElement(tag);
      prepare?.(element);
      const source = [makeEntry(0)];

      element[property] = source;
      source.push(makeEntry(1));

      const snapshot = element[property] as readonly unknown[];
      expect(snapshot).not.to.equal(source);
      expect(snapshot.length).to.equal(1);
      expect(Object.isFrozen(snapshot)).to.equal(true);

      element[property] = Array.from({ length: COLLECTION_LIMIT + 5 }, (_, index) => makeEntry(index));
      expect((element[property] as readonly unknown[]).length).to.equal(limit);
      expect(Object.isFrozen(element[property])).to.equal(true);
    });
  }

  for (const property of ['selectedRowKeys', 'expandedRowKeys'] as const) {
    it(`lr-table.${property} returns a bounded frozen readonly-set facade`, () => {
      const element = createDynamicElement('lr-table');
      const source = new Set<string>(['first']);

      element[property] = source;
      source.add('later');

      const snapshot = element[property] as ReadonlySet<string>;
      expect([...snapshot]).to.deep.equal(['first']);
      expect(Object.isFrozen(snapshot)).to.equal(true);
      expect('add' in snapshot).to.equal(false);

      element[property] = new Set(
        Array.from({ length: COLLECTION_LIMIT + 5 }, (_, index) => String(index)),
      );
      expect((element[property] as ReadonlySet<string>).size).to.equal(COLLECTION_LIMIT);
    });
  }

  for (const tag of ['lr-flow-canvas', 'lr-flow-run-status'] as const) {
    it(`${tag}.decorations owns a bounded deeply frozen record`, () => {
      const element = createDynamicElement(tag);
      const source = { first: { status: 'running', detail: 'before' } };

      element['decorations'] = source;
      source.first.detail = 'changed';

      const snapshot = element['decorations'] as Readonly<Record<string, { readonly detail: string }>>;
      expect(snapshot).not.to.equal(source);
      expect(snapshot['first']!.detail).to.equal('before');
      expect(Object.isFrozen(snapshot)).to.equal(true);
      expect(Object.isFrozen(snapshot['first'])).to.equal(true);

      element['decorations'] = Object.fromEntries(
        Array.from({ length: COLLECTION_LIMIT + 5 }, (_, index) => [String(index), { status: 'running' }]),
      );
      expect(Object.keys(element['decorations'] as object).length).to.equal(COLLECTION_LIMIT);
    });
  }

  it('bounds and freezes condition-builder and graph-query nested value arrays', () => {
    const conditionBuilder = createDynamicElement('lr-condition-builder');
    const conditionValues = Array.from({ length: 505 }, (_, index) => String(index));
    const conditions = Array.from({ length: 205 }, (_, index) => ({
      id: String(index),
      field: '',
      operator: 'in',
      value: index === 0 ? conditionValues : [],
    }));
    conditionBuilder['value'] = { combinator: 'and', conditions };
    conditionValues.push('later');
    conditions.push({ id: 'later', field: '', operator: 'in', value: [] });

    const conditionSnapshot = conditionBuilder['value'] as {
      readonly conditions: readonly { readonly value?: readonly string[] }[];
    };
    expect(conditionSnapshot.conditions.length).to.equal(200);
    expect(conditionSnapshot.conditions[0]!.value!.length).to.equal(500);
    expect(Object.isFrozen(conditionSnapshot)).to.equal(true);
    expect(Object.isFrozen(conditionSnapshot.conditions)).to.equal(true);
    expect(Object.isFrozen(conditionSnapshot.conditions[0])).to.equal(true);
    expect(Object.isFrozen(conditionSnapshot.conditions[0]!.value)).to.equal(true);

    const graphQuery = createDynamicElement('lr-graph-query-builder');
    const relationshipTypes = Array.from({ length: 505 }, (_, index) => `r${index}`);
    const nodeTypes = Array.from({ length: 505 }, (_, index) => `n${index}`);
    graphQuery['value'] = {
      startId: 'start',
      endId: '',
      relationshipTypes,
      nodeTypes,
      direction: 'both',
      minHops: 1,
      maxHops: 2,
    };
    relationshipTypes.push('later');
    nodeTypes.push('later');

    const querySnapshot = graphQuery['value'] as {
      readonly relationshipTypes: readonly string[];
      readonly nodeTypes: readonly string[];
    };
    expect(querySnapshot.relationshipTypes.length).to.equal(500);
    expect(querySnapshot.nodeTypes.length).to.equal(500);
    expect(Object.isFrozen(querySnapshot)).to.equal(true);
    expect(Object.isFrozen(querySnapshot.relationshipTypes)).to.equal(true);
    expect(Object.isFrozen(querySnapshot.nodeTypes)).to.equal(true);
  });

  it('owns and bounds filter-bar definitions and nested value arrays', () => {
    const element = createDynamicElement('lr-filter-bar');
    const options = [{ value: 'first', label: 'First' }];
    const filters = [{ filterId: 'tags', label: 'Tags', type: 'combobox', multiple: true, options }];
    element['filters'] = filters;
    options[0]!.label = 'Changed';
    filters.push({ filterId: 'later', label: 'Later', type: 'combobox', multiple: true, options: [] });

    const filterSnapshot = element['filters'] as readonly {
      readonly options: readonly { readonly label: string }[];
    }[];
    expect(filterSnapshot.length).to.equal(1);
    expect(filterSnapshot[0]!.options[0]!.label).to.equal('First');
    expect(Object.isFrozen(filterSnapshot)).to.equal(true);
    expect(Object.isFrozen(filterSnapshot[0])).to.equal(true);
    expect(Object.isFrozen(filterSnapshot[0]!.options)).to.equal(true);
    expect(Object.isFrozen(filterSnapshot[0]!.options[0])).to.equal(true);

    const values = Array.from({ length: COLLECTION_LIMIT + 5 }, (_, index) => String(index));
    element['value'] = { tags: values };
    values.push('later');
    const valueSnapshot = element['value'] as Readonly<Record<string, readonly string[]>>;
    expect(valueSnapshot['tags']!.length).to.equal(COLLECTION_LIMIT);
    expect(Object.isFrozen(valueSnapshot)).to.equal(true);
    expect(Object.isFrozen(valueSnapshot['tags'])).to.equal(true);
  });

  it('owns and bounds tool-param schema and value collection paths', () => {
    const element = createDynamicElement('lr-tool-param-form') as unknown as LyraToolParamForm;
    const choices = Array.from({ length: 505 }, (_, index) => String(index));
    const properties = Object.fromEntries(
      Array.from({ length: 105 }, (_, index) => [
        `field-${index}`,
        { type: 'string', ...(index === 0 ? { enum: choices } : {}) },
      ]),
    );
    const required = Array.from({ length: 105 }, (_, index) => `field-${index}`);
    element.schema = { type: 'object', properties, required };
    choices.push('later');
    required.push('later');
    properties['field-0']!.type = 'number';

    expect(Object.keys(element.schema.properties).length).to.equal(100);
    expect(element.schema.properties['field-0']!.type).to.equal('string');
    expect(element.schema.properties['field-0']!.enum!.length).to.equal(500);
    expect(element.schema.required!.length).to.equal(100);
    expect(Object.isFrozen(element.schema)).to.equal(true);
    expect(Object.isFrozen(element.schema.properties)).to.equal(true);
    expect(Object.isFrozen(element.schema.properties['field-0'])).to.equal(true);
    expect(Object.isFrozen(element.schema.properties['field-0']!.enum)).to.equal(true);
    expect(Object.isFrozen(element.schema.required)).to.equal(true);

    const nestedValues = Array.from({ length: COLLECTION_LIMIT + 5 }, (_, index) => index);
    const value = { nested: { values: nestedValues } };
    element.value = value;
    nestedValues.push(COLLECTION_LIMIT + 6);
    const valueSnapshot = element.value as {
      readonly nested: { readonly values: readonly number[] };
    };
    expect(valueSnapshot.nested.values.length).to.equal(COLLECTION_LIMIT);
    expect(Object.isFrozen(valueSnapshot)).to.equal(true);
    expect(Object.isFrozen(valueSnapshot.nested)).to.equal(true);
    expect(Object.isFrozen(valueSnapshot.nested.values)).to.equal(true);
  });

  it('passes a virtual-list indexed source through by identity', () => {
    const element = createDynamicElement('lr-virtual-list') as unknown as LyraVirtualList;
    const source: LyraVirtualListIndexedSource<{ readonly id: string }> = {
      count: 1,
      itemAt: () => ({ id: 'first' }),
    };

    element.source = source;

    expect(element.source).to.equal(source);
    expect(Object.isFrozen(source)).to.equal(false);
  });

  it('owns and bounds the bespoke voice catalog accessor snapshot', () => {
    const element = createDynamicElement('lr-voice-picker') as unknown as LyraVoicePicker;
    const source = [{ id: 'aria', label: 'Aria', language: 'en-US' }];

    element.catalog = source;
    source[0]!.label = 'Changed';
    source.push({ id: 'later', label: 'Later', language: 'en-GB' });

    const snapshot = element.catalog as readonly { readonly id: string; readonly label: string }[];
    expect(snapshot).not.to.equal(source);
    expect(snapshot.map((entry) => entry.label)).to.deep.equal(['Aria']);
    expect(Object.isFrozen(snapshot)).to.equal(true);
    expect(Object.isFrozen(snapshot[0])).to.equal(true);

    element.catalog = Array.from({ length: COLLECTION_LIMIT + 5 }, (_, index) => String(index));
    expect(element.catalog!.length).to.equal(COLLECTION_LIMIT);
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
      html`<lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`,
    )) as LyraJsonSchemaViewer;
    schema.required.push('later');
    schema.properties.query.type.push('number');

    const pending = oneEvent(element, 'lr-schema-select');
    (element.shadowRoot!.querySelector('[data-path="/properties/query"]') as HTMLButtonElement).click();
    const event = (await pending) as CustomEvent<{
      readonly schemaPath: string;
      readonly schema: { readonly type: readonly string[] };
    }>;

    expect(event.detail.schemaPath).to.equal('/properties/query');
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

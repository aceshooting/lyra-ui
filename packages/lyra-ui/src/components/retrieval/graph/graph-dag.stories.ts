import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { AsyncDirective } from 'lit/async-directive.js';
import { directive } from 'lit/directive.js';
import { ref } from 'lit/directives/ref.js';
import type { GraphDagDirection } from '@aceshooting/lyra-3d/graph-layout';
import type { LyraGraph, LyraGraphEdge, LyraGraphNode } from './graph.class.js';
import type { LyraSelect } from '../../forms/select/select.class.js';
import '../../lr-graph.js';
import '../../lr-select.js';
import '../../lr-option.js';
import '../../lr-button.js';

const fixtureNodes: LyraGraphNode[] = [
  { id: 'input', label: 'Input' },
  { id: 'parse', label: 'Parse' },
  { id: 'validate', label: 'Validate' },
  { id: 'build', label: 'Build' },
  { id: 'publish', label: 'Publish' },
];
const fixtureEdges: LyraGraphEdge[] = [
  { id: 'input-parse', source: 'input', target: 'parse', directed: true, label: 'Read' },
  { id: 'input-validate', source: 'input', target: 'validate', directed: true, label: 'Check' },
  { id: 'parse-build', source: 'parse', target: 'build', directed: true, label: 'Compile', curvature: 0.3 },
  { id: 'parse-build-cache', source: 'parse', target: 'build', directed: true, label: 'Cache', curvature: -0.3 },
  { id: 'validate-build', source: 'validate', target: 'build', directed: true, label: 'Approve' },
  { id: 'build-publish', source: 'build', target: 'publish', directed: true, label: 'Ship' },
];
const directions: readonly GraphDagDirection[] = ['x', '-x', 'y', '-y', 'z', '-z'];
type Fixture = 'diamond' | 'empty' | 'cycle';

class DagExampleDirective extends AsyncDirective {
  private graph?: LyraGraph;
  private controller?: AbortController;
  private generation = 0;
  private direction: GraphDagDirection = 'y';
  private fixture: Fixture = 'diamond';
  private nodes: LyraGraphNode[] = fixtureNodes;
  private edges: LyraGraphEdge[] = fixtureEdges;
  private status = 'Preparing directed graph…';
  private ranks = '';

  override render(): TemplateResult {
    return this.template();
  }

  private readonly bindGraph = (element?: Element): void => {
    const graph = element as LyraGraph | undefined;
    if (!graph || graph === this.graph) return;
    this.graph = graph;
    queueMicrotask(() => { if (this.isConnected && graph.isConnected) void this.recompute(); });
  };

  private current(generation: number, controller: AbortController): boolean {
    return this.isConnected && !!this.graph?.isConnected && generation === this.generation && !controller.signal.aborted;
  }

  private async recompute(): Promise<void> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const generation = ++this.generation;
    const fixture = this.fixture;
    const direction = this.direction;
    this.status = 'Computing directed graph…';
    this.setValue(this.template());
    try {
      const { layoutGraphDagAsync, GraphDagLayoutError } = await import('@aceshooting/lyra-3d/graph-layout');
      if (!this.current(generation, controller)) return;
      const nodes = fixture === 'empty' ? [] : fixtureNodes;
      const edges = fixture === 'empty' ? [] : fixture === 'cycle'
        ? [...fixtureEdges, { id: 'publish-input', source: 'publish', target: 'input', directed: true }]
        : fixtureEdges;
      const rows = new Map(nodes.map((node, row) => [node.id, row]));
      // These columns stay unchanged while the asynchronous helper borrows them.
      const source = Uint32Array.from(edges, edge => rows.get(edge.source)!);
      const target = Uint32Array.from(edges, edge => rows.get(edge.target)!);
      try {
        const result = await layoutGraphDagAsync({ nodeCount: nodes.length, source, target }, { direction }, { signal: controller.signal });
        if (!this.current(generation, controller)) return;
        this.nodes = nodes.map((node, row) => Object.freeze({ ...node, position: Object.freeze({
          x: result.positions[row * 3]!, y: result.positions[row * 3 + 1]!, z: result.positions[row * 3 + 2]!,
        }) }));
        this.edges = [...edges];
        this.ranks = nodes.map((node, row) => `${node.label}: ${result.ranks[row]}`).join('; ');
        this.status = nodes.length ? `${result.layerCount} layers along ${direction}. Supplied positions stay pinned.` : 'No nodes in this graph. Choose Diamond to restore the example.';
        this.setValue(this.template());
        const graph = this.graph;
        if (!graph) return;
        await graph.updateComplete;
        if (!this.current(generation, controller) || this.graph !== graph) return;
        if (nodes.length) graph.fit();
      } catch (error) {
        if (!this.current(generation, controller)) return;
        this.status = error instanceof GraphDagLayoutError && error.code === 'cyclic-graph'
          ? 'Cycle refused. The previous graph is retained; choose Diamond to recover.'
          : 'Layout unavailable. The previous graph and its List view remain available.';
        this.setValue(this.template());
      }
    } catch {
      if (!this.current(generation, controller)) return;
      this.status = 'Layout helper unavailable. Use the graph’s List view to read the relationships.';
      this.setValue(this.template());
    } finally {
      if (this.controller === controller) this.controller = undefined;
    }
  }

  protected override disconnected(): void {
    ++this.generation;
    this.controller?.abort();
    this.controller = undefined;
  }

  protected override reconnected(): void {
    queueMicrotask(() => { if (this.isConnected && this.graph?.isConnected) void this.recompute(); });
  }

  private readonly changeDirection = (event: Event): void => {
    const value = (event.currentTarget as LyraSelect).value;
    if (typeof value !== 'string' || !directions.includes(value as GraphDagDirection)) return;
    this.direction = value as GraphDagDirection;
    void this.recompute();
  };

  private readonly changeFixture = (event: Event): void => {
    const value = (event.currentTarget as LyraSelect).value;
    if (value !== 'diamond' && value !== 'empty' && value !== 'cycle') return;
    this.fixture = value;
    void this.recompute();
  };

  private template(): TemplateResult {
    return html`
      <section aria-label="Directed acyclic graph example" style="display:grid;gap:var(--lr-space-m);min-inline-size:0">
        <div style="display:flex;flex-wrap:wrap;align-items:end;gap:var(--lr-space-m)">
          <lr-select label="Layer direction" .value=${this.direction} @lr-change=${this.changeDirection}>
            ${directions.map(direction => html`<lr-option value=${direction}>${direction}</lr-option>`)}
          </lr-select>
          <lr-select label="Graph fixture" .value=${this.fixture} @lr-change=${this.changeFixture}>
            <lr-option value="diamond">Diamond</lr-option>
            <lr-option value="empty">Empty graph</lr-option>
            <lr-option value="cycle">Cyclic graph</lr-option>
          </lr-select>
          <lr-button type="button" @click=${() => { void this.recompute(); }}>Recompute</lr-button>
        </div>
        <p role="status">${this.status}</p>
        ${this.nodes.length ? html`<p>Longest-path ranks: ${this.ranks || 'awaiting layout'}</p>` : html`<p>The empty graph has no relationships to display.</p>`}
        <lr-graph ${ref(this.bindGraph)}
          view="3d" label="Directed build pipeline" height="520" with-edge-labels
          style="inline-size:100%;min-inline-size:0"
          .nodes=${this.nodes} .edges=${this.edges}
        ></lr-graph>
      </section>
    `;
  }
}
const dagExample = directive(DagExampleDirective);
const meta: Meta = { title: 'Graph', component: 'lr-graph' };
export default meta;

export const DirectedAcyclicLayout: StoryObj = {
  name: 'Directed acyclic layout',
  parameters: { docs: { description: { story:
    'Opt into the granular DAG helper to compute owned Float32 xyz positions in stable node-row order. ' +
    'The asynchronous helper cooperatively schedules main-thread work; input columns remain immutable until it settles. ' +
    'Axis changes cancel superseded requests. Cycles preserve the previous accepted graph. ' +
    'The built-in Canvas3D renderer needs no renderer peer; existing Fit and List controls remain available. ' +
    'An optional WebGL renderer can use the same explicit positions. Relayout is an explicit action.'
  } } },
  render: () => html`${dagExample()}`,
};

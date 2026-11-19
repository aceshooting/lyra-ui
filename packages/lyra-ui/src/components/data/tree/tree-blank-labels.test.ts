import { fixture, expect, html } from '@open-wc/testing';
import { captureDevWarnings } from '../../../../test/expected-dev-warnings.js';
import './tree.js';
import '../file-tree/file-tree.js';
import '../env-list/env-list.js';
import '../flow-canvas/flow-canvas.js';
import '../flow-minimap/flow-minimap.js';
import '../flow-run-status/flow-run-status.js';
import '../graph-query-builder/graph-query-builder.js';
import type { LyraTree } from './tree.js';
import type { LyraFileTree } from '../file-tree/file-tree.js';
import type { LyraEnvList } from '../env-list/env-list.js';
import type { LyraFlowCanvas } from '../flow-canvas/flow-canvas.js';
import type { LyraFlowMinimap } from '../flow-minimap/flow-minimap.js';
import type { LyraFlowRunStatus } from '../flow-run-status/flow-run-status.js';
import type { LyraGraphQueryBuilder } from '../graph-query-builder/graph-query-builder.js';

describe('whitespace-only names fall back to the localized default', () => {
  it('lr-tree names the tree from its label only when it has text, and badges only when labelled', async () => {
    let blank!: LyraTree;
    await captureDevWarnings(async () => {
      blank = await fixture<LyraTree>(html`<lr-tree label="   " .data=${[
        { id: 'a', label: 'A', badges: [{ text: '3', label: '  ' }] },
      ]}></lr-tree>`);
    });
    const base = blank.shadowRoot!.querySelector('[part~="tree"]')!;
    expect(base.getAttribute('aria-label')).to.equal('Tree');
    blank.strings = { treeDefaultLabel: 'Navigation' };
    await blank.updateComplete;
    expect(base.getAttribute('aria-label')).to.equal('Navigation');
    const badge = blank.querySelector('lr-tree-item')!.shadowRoot!.querySelector('[part="badge"]')!;
    expect(badge.hasAttribute('aria-label')).to.equal(false);
    expect(badge.hasAttribute('role')).to.equal(false);
  });

  it('lr-file-tree and lr-env-list use the default name for a blank label', async () => {
    const files = await fixture<LyraFileTree>(html`<lr-file-tree label="  "></lr-file-tree>`);
    expect(files.shadowRoot!.querySelector('lr-tree')!.label).to.equal('Files');
    const env = await fixture<LyraEnvList>(html`<lr-env-list aria-label="  " label="  " .entries=${[{ name: 'A', value: '1' }]}></lr-env-list>`);
    expect(env.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Environment variables');
  });

  it('lr-flow-run-status and lr-flow-minimap use the default name for a blank label', async () => {
    const status = await fixture<LyraFlowRunStatus>(html`<lr-flow-run-status label="  "></lr-flow-run-status>`);
    expect(status.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')!.trim().length > 0).to.equal(true);
    const wrapper = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas><lr-flow-minimap slot="bottom-end" label="  "></lr-flow-minimap></lr-flow-canvas>`);
    wrapper.nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    await wrapper.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
    await minimap.updateComplete;
    expect(minimap.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Workflow overview');
  });

  it('lr-graph-query-builder renders the default label for a blank label', async () => {
    const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder label="  "></lr-graph-query-builder>`);
    const text = el.shadowRoot!.querySelector('[part~="label"]')!.textContent!.trim();
    expect(text.length > 0).to.equal(true);
  });

  it('lr-flow-canvas ignores a blank node accessible label', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas aria-label="  "></lr-flow-canvas>`);
    el.nodes = [{ id: 'a', position: { x: 0, y: 0 }, accessibleLabel: '  ', data: { label: 'Fetch' } }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')!.trim().length > 0).to.equal(true);
    const control = el.shadowRoot!.querySelector('[part="node-control"]')!;
    expect((control.getAttribute('aria-label') ?? control.textContent ?? '').includes('Fetch')).to.equal(true);
  });
});

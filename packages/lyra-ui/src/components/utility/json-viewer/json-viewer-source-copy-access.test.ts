import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource, LyraInspectionNode } from '../../../data-sources.js';
import type { LyraJsonViewer } from './json-viewer.class.js';
import './json-viewer.js';

type Source = LyraHierarchySource<LyraInspectionNode, LyraHierarchyQuery>;

const row: LyraHierarchyRow<LyraInspectionNode> = {
  key: 'k0', value: { name: 'Key 0', path: 'k0', kind: 'scalar', value: 'Value 0' }, parentKey: null,
  level: 1, position: 1, setSize: 1, childCount: 0, expanded: false, selected: false,
};

function sourceWith(copyAccess: 'throws' | 'function'): Source {
  const source: Source = {
    revision: 1,
    async project() {
      return { state: 'one', total: 1, rows: { count: 1, keyAt: () => 'k0', indexOfKey: () => 0, itemAt: () => row } };
    },
  };
  Object.defineProperty(source, 'copy', {
    enumerable: true,
    get() {
      if (copyAccess === 'throws') throw new Error('hostile accessor');
      return async () => ({ text: 'x', truncated: false });
    },
  });
  return source;
}

describe('lr-json-viewer copy affordance over a provider source', () => {
  it('offers no copy buttons when reading the provider copy capability throws', async () => {
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .treeSource=${sourceWith('throws')}></lr-json-viewer>`);
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')), 'source row mounts');
    expect(el.shadowRoot!.querySelectorAll('[part="copy-button"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="toolbar"]').length).to.equal(0);
  });

  it('offers the toolbar copy button when the provider exposes a copy function', async () => {
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .treeSource=${sourceWith('function')}></lr-json-viewer>`);
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')), 'source row mounts');
    expect(el.shadowRoot!.querySelectorAll('[part="toolbar"] [part="copy-button"]').length).to.equal(1);
  });
});

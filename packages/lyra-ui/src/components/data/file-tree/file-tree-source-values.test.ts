import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraHierarchyQuery, LyraHierarchySource } from '../../../data-sources.js';
import type { FileTreeNode, LyraFileTree } from './file-tree.class.js';
import './file-tree.js';

function provider(value: FileTreeNode): LyraHierarchySource<FileTreeNode, LyraHierarchyQuery> {
  return { revision: 1, async project(request) {
    const row = { key: 'src/file.ts', value, parentKey: null, level: 1, position: 1, setSize: 1,
      childCount: 0, expanded: false, selected: request.action.type === 'select' && request.action.selected };
    return { state: 'files', total: 1,
      rows: { count: 1, keyAt: () => row.key, indexOfKey: (key: string | number) => key === row.key ? 0 : -1, itemAt: () => row },
      ...(request.action.type === 'reveal' ? { focusIndex: 0 } : {}) };
  } };
}

function row(element: LyraFileTree): HTMLElement | null {
  return element.shadowRoot!.querySelector('[part~="source-row"]');
}

describe('file tree source display values', () => {
  const invalid: [string, FileTreeNode][] = [
    ['a mismatched domain path', { path: 'other/file.ts', name: 'Invalid' }],
    ['combined name and MIME type overflow', { path: 'src/file.ts', name: 'a'.repeat(32_768), mimeType: 'b'.repeat(32_769) }],
    ['an individually oversized name', { path: 'src/file.ts', name: 'a'.repeat(65_537) }],
    ['an individually oversized MIME type', { path: 'src/file.ts', name: '', mimeType: 'b'.repeat(65_537) }],
  ];
  for (const [name, value] of invalid) it(`rejects ${name} and restores valid source rows`, async () => {
    const element = await fixture<LyraFileTree>(html`<lr-file-tree label="Files" .treeSource=${provider(value)}
      .strings=${{ treeSourceError: 'Files unavailable' }}></lr-file-tree>`);
    await waitUntil(() => Boolean(element.shadowRoot!.querySelector('[part~="source-error"]')));
    expect(element.shadowRoot!.querySelector('[part~="source-error"]')?.textContent).to.contain('Files unavailable');
    expect(element.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
    expect(await element.revealSourceKey('src/file.ts')).to.equal(false);
    element.treeSource = provider({ path: 'src/file.ts', name: 'Recovered' });
    await waitUntil(() => row(element)?.textContent?.includes('Recovered') === true);
    expect(element.shadowRoot!.querySelectorAll('[part~="source-error"]').length).to.equal(0);
    expect(await element.revealSourceKey('src/file.ts')).to.equal(true);
  });

  it('accepts the exact aggregate name and MIME type budget without truncating event metadata', async () => {
    const name = 'a'.repeat(32_768), mimeType = 'b'.repeat(32_768);
    const element = await fixture<LyraFileTree>(html`<lr-file-tree label="Files"
      .treeSource=${provider({ path: 'src/file.ts', name, mimeType })}></lr-file-tree>`);
    await waitUntil(() => row(element) !== null);
    expect(row(element)?.getAttribute('aria-label')).to.equal(name);
    const selected: FileTreeNode[] = [];
    element.addEventListener('lr-file-select', event => selected.push(event.detail.node));
    row(element)!.click();
    await waitUntil(() => selected.length === 1);
    expect(selected[0]?.name).to.equal(name);
    expect(selected[0]?.mimeType).to.equal(mimeType);
    expect(Object.isFrozen(selected[0])).to.equal(true);
  });

  for (const name of [undefined, '']) it(`names ${name === undefined ? 'an omitted' : 'an empty'} display name from the file path`, async () => {
    const element = await fixture<LyraFileTree>(html`<lr-file-tree label="Files"
      .treeSource=${provider({ path: 'src/file.ts', name, kind: 'directory' })}></lr-file-tree>`);
    await waitUntil(() => row(element) !== null);
    expect(row(element)?.getAttribute('aria-label')).to.equal(name === undefined ? 'file.ts' : 'src/file.ts');
    await expect(element).to.be.accessible();
  });

  for (const field of ['name', 'mimeType', 'gitStatus', 'additions', 'deletions'] as const) {
    it(`rejects an accessor-backed ${field} without evaluating it`, async () => {
      let reads = 0;
      const value: FileTreeNode = { path: 'src/file.ts', name: 'File' };
      Object.defineProperty(value, field, { get() { reads++; return 'unsafe'; } });
      const element = await fixture<LyraFileTree>(html`<lr-file-tree label="Files" .treeSource=${provider(value)}></lr-file-tree>`);
      await waitUntil(() => Boolean(element.shadowRoot!.querySelector('[part~="source-error"]')));
      expect(reads).to.equal(0);
      expect(element.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
    });
  }
});

import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { accessibleName } from '../../../../test/accessible-name.js';
import type { LyraHierarchyAction, LyraHierarchyQuery, LyraHierarchySource } from '../../../data-sources.js';
import type { LyraTree, LyraTreeNodeData, TreeSelection } from './tree.class.js';
import './tree.js';

function provider(value: LyraTreeNodeData, childCount = 0) {
  const actions: LyraHierarchyAction[] = [];
  let selected = false;
  const source: LyraHierarchySource<LyraTreeNodeData, LyraHierarchyQuery> = {
    revision: 1,
    async project(request) {
      actions.push(request.action);
      if (request.action.type === 'select') selected = request.action.selected;
      const row = { key: 'record', value, parentKey: null, level: 1, position: 1, setSize: 1,
        childCount, expanded: false, selected };
      return { state: String(actions.length), total: 1 + childCount,
        rows: { count: 1, keyAt: () => 'record', indexOfKey: (key: string | number) => key === 'record' ? 0 : -1, itemAt: () => row },
        ...(request.action.type === 'reveal' ? { focusIndex: 0 } : {}) };
    },
  };
  return { source, actions };
}

function row(element: LyraTree): HTMLElement | null {
  return element.shadowRoot!.querySelector('[part~="source-row"]');
}

describe('tree source display values', () => {
  const invalid: [string, LyraTreeNodeData][] = [
    ['a mismatched domain key', { id: 'different', label: 'Invalid' }],
    ['combined label and description overflow', { id: 'record', label: 'a'.repeat(32_768), description: 'b'.repeat(32_769) }],
    ['accessible name overflow in the aggregate', { id: 'record', label: 'a'.repeat(65_536), accessibleLabel: 'b' }],
    ['badge text overflow in the aggregate', { id: 'record', label: 'a'.repeat(65_536), badges: [{ text: 'b' }] }],
    ['badge accessible name overflow in the aggregate', { id: 'record', label: 'a'.repeat(65_535), badges: [{ text: 'b', label: 'c' }] }],
    ['too many badges', { id: 'record', label: 'Invalid', badges: Array.from({ length: 101 }, () => ({ text: 'b' })) }],
    ['a non-array badge collection', { id: 'record', label: 'Invalid', badges: {} as LyraTreeNodeData['badges'] }],
  ];
  for (const [name, value] of invalid) it(`rejects ${name} and recovers with valid source data`, async () => {
    const bad = provider(value);
    const element = await fixture<LyraTree>(html`<lr-tree label="Records" .treeSource=${bad.source}
      .strings=${{ treeSourceError: 'Records unavailable' }}></lr-tree>`);
    await waitUntil(() => Boolean(element.shadowRoot!.querySelector('[part~="source-error"]')));
    expect(element.shadowRoot!.querySelector('[part~="source-error"]')?.textContent).to.contain('Records unavailable');
    expect(element.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
    expect(await element.revealSourceKey('record')).to.equal(false);
    expect(bad.actions.some(action => action.type === 'select')).to.equal(false);
    element.treeSource = provider({ id: 'record', label: 'Recovered' }).source;
    await waitUntil(() => row(element)?.textContent?.includes('Recovered') === true);
    expect(element.shadowRoot!.querySelectorAll('[part~="source-error"]').length).to.equal(0);
    expect(await element.revealSourceKey('record')).to.equal(true);
    expect(element.shadowRoot!.activeElement?.getAttribute('data-source-key')).to.equal('record');
  });

  it('accepts the exact aggregate text and badge limits with visible and accessible badge content', async () => {
    const badges = Array.from({ length: 100 }, (_, index) => ({ text: String(index % 10), ...(index === 0 ? { label: 'Badge count' } : {}) }));
    const label = 'a'.repeat(65_536 - 100 - 'Badge count'.length);
    const element = await fixture<LyraTree>(html`<lr-tree label="Records"
      .treeSource=${provider({ id: 'record', label, badges }).source}></lr-tree>`);
    await waitUntil(() => row(element) !== null);
    expect(row(element)?.getAttribute('aria-label')).to.contain(label);
    const labels = row(element)!.querySelector('[part~="source-label"]')!;
    expect(labels.textContent?.startsWith(label)).to.equal(true);
    expect([...labels.querySelectorAll('span')].map(badge => badge.textContent)).to.deep.equal(badges.map(badge => badge.text));
    expect(labels.querySelectorAll('span').length).to.equal(100);
    expect(labels.querySelector('[aria-label]')?.getAttribute('aria-label')).to.equal('Badge count');
    expect(labels.querySelectorAll('span:not([aria-label])').length).to.equal(99);
  });

  const names: [string, Partial<LyraTreeNodeData>, string][] = [
    ['explicit accessible label', { label: 'Visible', description: 'Description', accessibleLabel: 'Visible Description, spoken' }, 'Visible Description, spoken'],
    ['visible label and description', { label: 'Visible', description: 'Description' }, 'Visible Description'],
    ['description', { label: '', description: 'Description' }, 'Description'],
    ['badge text', { label: '', badges: [{ text: 'Badge' }] }, 'Badge'],
    ['badge accessible label', { label: '', badges: [{ text: '', label: 'Spoken badge' }] }, 'Spoken badge'],
    ['badge text with a blank override', { label: '', badges: [{ text: 'Badge', label: ' ' }] }, 'Badge'],
    ['domain identity', { label: '', description: ' ', badges: [{ text: ' ' }] }, 'record'],
  ];
  for (const [name, fields, expected] of names) it(`uses the ${name} for the source row name`, async () => {
    const element = await fixture<LyraTree>(html`<lr-tree label="Records" dir="rtl"
      .treeSource=${provider({ id: 'record', label: '', ...fields }).source}></lr-tree>`);
    await waitUntil(() => row(element) !== null);
    expect(row(element)?.getAttribute('aria-label')).to.equal(expected);
    if (fields.description) expect(row(element)?.textContent).to.contain(fields.description);
    await expect(element).to.be.accessible();
    expect(accessibleName(row(element)!)).to.equal(expected);
  });

  for (const selection of ['single', 'multiple', 'leaf', 'leaf-multiple'] satisfies TreeSelection[]) {
    for (const childCount of [0, 2]) it(`applies ${selection} selection to a ${childCount ? 'branch' : 'leaf'}`, async () => {
      const current = provider({ id: 'record', label: 'Record' }, childCount);
      const element = await fixture<LyraTree>(html`<lr-tree label="Records" .selection=${selection} .treeSource=${current.source}></lr-tree>`);
      await waitUntil(() => row(element) !== null);
      row(element)!.click();
      const rejected = childCount > 0 && (selection === 'leaf' || selection === 'leaf-multiple');
      if (rejected) {
        await element.updateComplete;
        expect(current.actions.filter(action => action.type === 'select')).to.deep.equal([]);
        expect(row(element)?.getAttribute('aria-selected')).to.equal('false');
        return;
      }
      await waitUntil(() => row(element)?.getAttribute('aria-selected') === 'true');
      const multiple = selection === 'multiple' || selection === 'leaf-multiple';
      const scope = multiple && childCount > 0 ? 'subtree' : 'item';
      expect(current.actions.filter(action => action.type === 'select')).to.deep.equal([
        { type: 'select', key: 'record', selected: true, scope },
      ]);
      row(element)!.click();
      await waitUntil(() => current.actions.filter(action => action.type === 'select').length === 2);
      await element.updateComplete;
      expect(row(element)?.getAttribute('aria-selected')).to.equal(String(!multiple));
      expect(current.actions.at(-1)).to.deep.equal({ type: 'select', key: 'record', selected: !multiple, scope });
    });
  }

  it('does not reveal a source row when the source API is unset', async () => {
    const element = await fixture<LyraTree>(html`<lr-tree label="Records" .data=${[{ id: 'record', label: 'Legacy' }]}></lr-tree>`);
    expect(await element.revealSourceKey('record')).to.equal(false);
    expect(element.querySelectorAll('lr-tree-item').length).to.equal(1);
  });
});

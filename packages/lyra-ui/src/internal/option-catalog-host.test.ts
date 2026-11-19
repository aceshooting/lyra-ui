import { expect, fixture, html } from '@open-wc/testing';
import {
  OccurrenceQueue,
  OptionAdornmentCache,
  OptionCatalogMemo,
  SelectedWriteQueue,
  resolveMultipleSelectedWrites,
  resolveOccurrences,
  resolveSingleSelectedWrite,
  type SelectedWrite,
} from './option-catalog-host.js';

class AdornmentProbe extends HTMLElement {
  upgraded = true;
}
customElements.define('h3c-adornment-probe', AdornmentProbe);

describe('OptionCatalogMemo', () => {
  it('recomputes a key only when an input changed by identity or count', () => {
    const memo = new OptionCatalogMemo();
    const list = [1];
    let runs = 0;
    const read = (inputs: readonly unknown[]) => memo.get('k', inputs, () => ++runs);
    expect([read([list, NaN]), read([list, NaN])]).to.deep.equal([1, 1]);
    expect(read([[1], NaN]), 'new identity').to.equal(2);
    expect(read([[1]]), 'new count').to.equal(3);
    expect(memo.get('other', [list], () => 'other')).to.equal('other');
    memo.clear();
    expect(read([[1]])).to.equal(4);
  });
});

describe('OptionAdornmentCache', () => {
  it('clones start/end and alias adornments once, keeping the authored nodes and custom elements live', async () => {
    const option = await fixture<HTMLElement>(html`<div>
      <span slot="start">S</span><h3c-adornment-probe slot="prefix"></h3c-adornment-probe><i slot="end">E</i><b slot="suffix">F</b><em>label</em>
    </div>`);
    const cache = new OptionAdornmentCache<HTMLElement>();
    const first = cache.get(option);
    expect([first.start?.length, first.end?.length]).to.deep.equal([2, 2]);
    expect((first.start?.[1] as AdornmentProbe).upgraded, 'cloned custom element upgraded').to.equal(true);
    expect(first.start?.[0] === option.querySelector('[slot="start"]'), 'clone, not the authored node').to.equal(false);
    expect(option.querySelectorAll('[slot]').length).to.equal(4);
    expect(cache.get(option) === first, 'cached').to.equal(true);
    const bare = document.createElement('div');
    bare.textContent = 'plain';
    expect(cache.get(bare)).to.deep.include({ start: undefined, end: undefined });
  });

  it('keeps clones across label edits and drops them when adornment markup changes or on clear', async () => {
    const option = await fixture<HTMLElement>(html`<div><span slot="start">S</span>label</div>`);
    const cache = new OptionAdornmentCache<HTMLElement>();
    const first = cache.get(option);
    option.append(' more');
    cache.refresh(option);
    expect(cache.get(option) === first, 'label edit keeps clones').to.equal(true);
    option.querySelector('span')!.textContent = 'T';
    cache.refresh(option);
    const second = cache.get(option);
    expect([second === first, (second.start?.[0] as Element).textContent]).to.deep.equal([false, 'T']);
    cache.refresh(document.createElement('div'));
    cache.clear();
    expect(cache.get(option) === second, 'cleared').to.equal(false);
  });
});

describe('SelectedWriteQueue', () => {
  it('flushes each option once per microtask in latest-write order, and clear() discards pending writes', async () => {
    const flushed: string[][] = [];
    const queue = new SelectedWriteQueue<string>(writes => {
      flushed.push(writes.map(([option, write]) => `${option}:${write.selected ? '+' : '-'}${write.value}`));
    });
    queue.record('a', { selected: true, value: '1' });
    queue.record('b', { selected: true, value: '2' });
    queue.record('a', { selected: false, value: '1' });
    expect(flushed).to.deep.equal([]);
    await Promise.resolve();
    expect(flushed).to.deep.equal([['b:+2', 'a:-1']]);
    queue.record('c', { selected: true, value: '3' });
    queue.clear();
    await Promise.resolve();
    expect(flushed, 'nothing to flush').to.have.length(1);
  });
});

describe('selected-write resolution', () => {
  const write = (selected: boolean, value: string): SelectedWrite => ({ selected, value });
  const member = (option: string) => option !== 'stray';

  it('single mode: the last accepted select wins and deselecting the current option clears it', () => {
    expect(resolveSingleSelectedWrite({ value: 'x', option: 'a' }, [['b', write(true, 'y')], ['stray', write(true, 'z')]], member))
      .to.deep.equal({ value: 'y', option: 'b' });
    expect(resolveSingleSelectedWrite({ value: 'x', option: 'a' }, [['c', write(false, 'w')], ['a', write(false, 'x')]], member))
      .to.deep.equal({ value: undefined, option: undefined });
  });

  it('multiple mode: drops deselected occurrences, refreshes reselected values and appends new ones', () => {
    const result = resolveMultipleSelectedWrites(
      ['x', 'unknown', 'y'],
      ['a', undefined, 'b'],
      [['b', write(false, 'y')], ['a', write(true, 'x2')], ['c', write(true, 'z')], ['stray', write(true, 'q')], ['d', write(false, 'w')]],
      member,
    );
    expect(result).to.deep.equal({ values: ['x2', 'unknown', 'z'], occurrences: ['a', undefined, 'c'] });
  });
});

describe('occurrence resolution', () => {
  it('pairs values with unclaimed rows in source order and runs out per value', () => {
    const rows = [{ v: 'a', id: 1 }, undefined, { v: 'b', id: 2 }, { v: 'a', id: 3 }];
    expect(resolveOccurrences(['a', 'a', 'a', 'b', 'c'], rows, row => row.v).map(row => row?.id))
      .to.deep.equal([1, 3, undefined, 2, undefined]);
  });

  it('shares claims across queues and reports membership on claim', () => {
    const claimed = new Set<string>();
    const preferred = new OccurrenceQueue(['a1', 'a2'], row => row[0]!, { claimed });
    const catalog = new OccurrenceQueue(['a2', 'b1', 'a1', 'c1'], row => row[0]!, { claimed, accept: value => value !== 'c' });
    expect(preferred.take('a')).to.equal('a1');
    expect(catalog.peek('a'), 'a1 claimed through the other queue').to.equal('a2');
    expect([catalog.claim('a2'), catalog.claim('a2'), catalog.claim('c1'), catalog.claim('zz')]).to.deep.equal([true, false, false, false]);
    expect([catalog.remaining('a'), catalog.remaining('b'), catalog.remaining('c')]).to.deep.equal([[], ['b1'], []]);
    expect([catalog.take('a'), catalog.take('b'), catalog.take('b')]).to.deep.equal([undefined, 'b1', undefined]);
  });
});

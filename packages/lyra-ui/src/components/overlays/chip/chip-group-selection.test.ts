import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import '../../lr-chip-group.js';
import '../../lr-chip.js';
import type { LyraChipGroup } from '../../lr-chip-group.js';
import type { LyraChip } from '../../lr-chip.js';

const chips = (group: LyraChipGroup) => [...group.querySelectorAll<LyraChip>('lr-chip')];
const pressed = (group: LyraChipGroup) => chips(group).filter((chip) => chip.selected).map((chip) => chip.value);
async function press(group: LyraChipGroup, value: string): Promise<CustomEvent | undefined> {
  const chip = chips(group).find((candidate) => candidate.value === value)!;
  const button = chip.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!;
  let detail: CustomEvent | undefined;
  group.addEventListener('lr-change', (event) => { detail = event as CustomEvent; }, { once: true });
  button.click();
  await group.updateComplete;
  await Promise.all(chips(group).map((candidate) => candidate.updateComplete));
  return detail;
}
const template = (attrs = '') => html`<lr-chip-group aria-label="Filter" selection=${attrs.includes('multiple') ? 'multiple' : attrs.includes('single') ? 'single' : 'none'}
  all-value=${attrs.includes('all') ? 'all' : ''}>
  <lr-chip value="all">All</lr-chip><lr-chip value="a">A</lr-chip><lr-chip value="b">B</lr-chip><lr-chip value="c">C</lr-chip>
</lr-chip-group>`;

describe('lr-chip-group selection', () => {
  it('leaves chips untouched while selection is unset', async () => {
    const group = await fixture<LyraChipGroup>(html`<lr-chip-group><lr-chip value="a">A</lr-chip><lr-chip value="b" toggleable selected>B</lr-chip></lr-chip-group>`);
    expect(group.selection).to.equal('none');
    expect(group.hasAttribute('selection')).to.be.false;
    expect(chips(group).map((chip) => chip.toggleable)).to.deep.equal([false, true]);
    expect(pressed(group)).to.deep.equal(['b']);
  });

  it('single: presses the valued chip, swaps on press, releases on re-press, and emits lr-change', async () => {
    const group = await fixture<LyraChipGroup>(html`<lr-chip-group selection="single" value="a"><lr-chip value="a">A</lr-chip><lr-chip value="b">B</lr-chip><lr-chip>no value</lr-chip></lr-chip-group>`);
    await Promise.all(chips(group).map((chip) => chip.updateComplete));
    expect(chips(group).map((chip) => chip.toggleable)).to.deep.equal([true, true, false]);
    expect(pressed(group)).to.deep.equal(['a']);
    expect(group.value).to.equal('a');
    const swapped = await press(group, 'b');
    expect(swapped!.detail).to.deep.equal({ value: 'b' });
    expect(pressed(group)).to.deep.equal(['b']);
    const released = await press(group, 'b');
    expect(released!.detail).to.deep.equal({ value: '' });
    expect(pressed(group)).to.deep.equal([]);
  });

  it('multiple: accumulates, the attribute is comma separated, and the value is an array', async () => {
    const group = await fixture<LyraChipGroup>(html`<lr-chip-group value="a,b" selection="multiple"><lr-chip value="a">A</lr-chip><lr-chip value="b">B</lr-chip><lr-chip value="c">C</lr-chip></lr-chip-group>`);
    await Promise.all(chips(group).map((chip) => chip.updateComplete));
    expect(group.value).to.deep.equal(['a', 'b']);
    expect(pressed(group)).to.deep.equal(['a', 'b']);
    const added = await press(group, 'c');
    expect(added!.detail).to.deep.equal({ value: ['a', 'b', 'c'] });
    const removed = await press(group, 'a');
    expect(removed!.detail).to.deep.equal({ value: ['b', 'c'] });
  });

  it('assigning value is silent and re-presses chips; null clears', async () => {
    const group = await fixture<LyraChipGroup>(html`<lr-chip-group selection="multiple"><lr-chip value="a">A</lr-chip><lr-chip value="b">B</lr-chip></lr-chip-group>`);
    let fired = 0;
    group.addEventListener('lr-change', () => { fired += 1; });
    group.value = ['b'];
    await group.updateComplete;
    await Promise.all(chips(group).map((chip) => chip.updateComplete));
    expect(pressed(group)).to.deep.equal(['b']);
    group.value = null as never;
    await group.updateComplete;
    await Promise.all(chips(group).map((chip) => chip.updateComplete));
    expect(pressed(group)).to.deep.equal([]);
    expect(fired).to.equal(0);
  });

  it('the all chip is pressed while empty, clears the selection, and cannot be un-pressed', async () => {
    const group = await fixture<LyraChipGroup>(template('multiple all'));
    await Promise.all(chips(group).map((chip) => chip.updateComplete));
    expect(pressed(group), 'empty selection presses all').to.deep.equal(['all']);
    await press(group, 'a');
    await press(group, 'b');
    expect(pressed(group)).to.deep.equal(['a', 'b']);
    const cleared = await press(group, 'all');
    expect(cleared!.detail).to.deep.equal({ value: [] });
    expect(pressed(group)).to.deep.equal(['all']);
    const again = await press(group, 'all');
    expect(again, 'pressing the pressed all chip is a no-op').to.be.undefined;
    expect(pressed(group)).to.deep.equal(['all']);
    await press(group, 'a');
    const back = await press(group, 'a');
    expect(back!.detail, 'releasing the last chip returns to all').to.deep.equal({ value: [] });
    expect(pressed(group)).to.deep.equal(['all']);
    expect(group.value, 'all is never part of value').to.deep.equal([]);
  });

  it('a late-added chip joins the model', async () => {
    const group = await fixture<LyraChipGroup>(html`<lr-chip-group selection="single" value="z"><lr-chip value="a">A</lr-chip></lr-chip-group>`);
    const late = document.createElement('lr-chip') as LyraChip;
    late.value = 'z';
    group.append(late);
    await oneEvent(group.shadowRoot!.querySelector('slot')!, 'slotchange');
    await group.updateComplete;
    await late.updateComplete;
    expect(late.selected).to.be.true;
    expect(late.toggleable).to.be.true;
  });
});

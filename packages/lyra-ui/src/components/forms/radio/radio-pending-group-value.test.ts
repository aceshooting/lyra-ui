// A group value assigned before its radios carry their own values is applied once they arrive.
import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-radio.js';
import '../../lr-radio-group.js';
import type { LyraRadio } from '../../lr-radio.js';
import type { LyraRadioGroup } from '../../lr-radio-group.js';

const settle = async (group: LyraRadioGroup): Promise<void> => {
  await group.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await group.updateComplete;
};

const checkedValues = (group: LyraRadioGroup): string[] =>
  ([...group.querySelectorAll('lr-radio')] as LyraRadio[])
    .filter((radio) => radio.checked)
    .map((radio) => radio.value);

async function valuelessGroup(count = 3, markup = html`<lr-radio-group name="plan"></lr-radio-group>`) {
  const host = await fixture<HTMLElement>(html`<form>${markup}</form>`);
  const group = host.querySelector('lr-radio-group') as LyraRadioGroup;
  const radios = Array.from({ length: count }, () => document.createElement('lr-radio') as LyraRadio);
  group.append(...radios);
  await settle(group);
  return { form: host as HTMLFormElement, group, radios };
}

describe('lr-radio-group value assigned before its radios have values', () => {
  it('selects the matching radio once radio values arrive after the group value', async () => {
    const { group, radios } = await valuelessGroup();
    group.value = 'b';
    ['a', 'b', 'c'].forEach((value, index) => { radios[index]!.value = value; });
    await settle(group);
    expect(group.value).to.equal('b');
    expect(checkedValues(group)).to.deep.equal(['b']);
    expect(new FormData(group.closest('form')!).get('plan')).to.equal('b');
  });

  it('applies a value assigned before any radio connects once valueless radios gain values', async () => {
    const host = await fixture<HTMLElement>(html`<div><lr-radio-group></lr-radio-group></div>`);
    const group = host.querySelector('lr-radio-group') as LyraRadioGroup;
    group.value = 'c';
    const radios = Array.from({ length: 3 }, () => document.createElement('lr-radio') as LyraRadio);
    group.append(...radios);
    await settle(group);
    ['a', 'b', 'c'].forEach((value, index) => { radios[index]!.value = value; });
    await settle(group);
    expect(group.value).to.equal('c');
    expect(checkedValues(group)).to.deep.equal(['c']);
  });

  it('lets a user selection made while the value is pending win over the late match', async () => {
    const { group, radios } = await valuelessGroup();
    group.value = 'b';
    radios[0]!.click();
    ['a', 'b', 'c'].forEach((value, index) => { radios[index]!.value = value; });
    await settle(group);
    expect(group.value).to.equal('a');
    expect(checkedValues(group)).to.deep.equal(['a']);
  });

  it('lets a newer host value replace the pending one', async () => {
    const { group, radios } = await valuelessGroup();
    group.value = 'b';
    group.value = 'c';
    ['a', 'b', 'c'].forEach((value, index) => { radios[index]!.value = value; });
    await settle(group);
    expect(group.value).to.equal('c');
    expect(checkedValues(group)).to.deep.equal(['c']);
  });

  it('drops a pending live value on form reset in favour of the default', async () => {
    const { form, group, radios } = await valuelessGroup();
    group.value = 'b';
    form.reset();
    ['a', 'b', 'c'].forEach((value, index) => { radios[index]!.value = value; });
    await settle(group);
    expect(group.value).to.equal('');
    expect(checkedValues(group)).to.deep.equal([]);
  });

  it('keeps reporting no value while the pending selection matches no radio', async () => {
    const { group } = await valuelessGroup();
    group.value = 'b';
    await settle(group);
    expect(group.value).to.equal('');
    expect(checkedValues(group)).to.deep.equal([]);
  });

  it('still selects an existing matching radio synchronously', async () => {
    const group = await fixture<LyraRadioGroup>(html`
      <lr-radio-group><lr-radio value="a">A</lr-radio><lr-radio value="b">B</lr-radio></lr-radio-group>
    `);
    group.value = 'b';
    expect(group.value).to.equal('b');
    expect(checkedValues(group)).to.deep.equal(['b']);
    group.value = '';
    expect(group.value).to.equal('');
    expect(checkedValues(group)).to.deep.equal([]);
  });
});

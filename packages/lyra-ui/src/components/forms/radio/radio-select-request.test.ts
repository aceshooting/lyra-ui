import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-radio.js';
import '../../lr-radio-group.js';
import type { LyraRadio } from '../../lr-radio.js';
import type { LyraRadioGroup, LyraRadioGroupSelectRequestDetail } from '../../lr-radio-group.js';

const radiosOf = (group: LyraRadioGroup): LyraRadio[] => Array.from(group.querySelectorAll('lr-radio'));

describe('radio selection request', () => {
  it('lets a group listener veto or resolve a selection before anything commits', async () => {
    const group = await fixture<LyraRadioGroup>(html`<lr-radio-group label="Plan" value="free">
      <lr-radio value="free">Free</lr-radio><lr-radio value="pro">Pro</lr-radio><lr-radio value="team">Team</lr-radio>
    </lr-radio-group>`);
    const [free, pro, team] = radiosOf(group);
    const log: string[] = [];
    const requests: Array<Omit<LyraRadioGroupSelectRequestDetail, 'option' | 'radio'> & { same: boolean }> = [];
    let mode: 'veto' | 'resolve' | 'allow' = 'veto';
    group.addEventListener('lr-change-request', (event) => {
      const { value, previousValue, option, radio } = event.detail;
      requests.push({ value, previousValue, same: option === radio && option.value === value });
      log.push(`request:${String(group.value)}`);
      if (mode === 'veto') event.preventDefault();
      if (mode === 'resolve') group.value = 'team';
    });
    for (const name of ['input', 'change', 'lr-change', 'lr-activate']) group.addEventListener(name, () => log.push(name));

    pro!.click();
    await group.updateComplete;
    expect(group.value).to.equal('free');
    expect([free!.checked, pro!.checked]).to.deep.equal([true, false]);
    expect(log, 'a refused request activates nothing').to.deep.equal(['request:free']);
    expect(requests).to.deep.equal([{ value: 'pro', previousValue: 'free', same: true }]);

    log.length = 0;
    await focusByKeyboard(free!);
    await sendKeys({ press: 'ArrowDown' });
    await group.updateComplete;
    expect(document.activeElement === free, 'a refused arrow key leaves focus in place').to.equal(true);
    expect(group.value).to.equal('free');
    expect(pro!.checked).to.equal(false);
    expect(log).to.deep.equal(['request:free']);

    log.length = 0;
    mode = 'resolve';
    await sendKeys({ press: 'ArrowDown' });
    await group.updateComplete;
    expect(group.value, 'a listener write wins over the proposal').to.equal('team');
    expect(team!.checked).to.equal(true);
    expect(log).to.deep.equal(['request:free']);

    log.length = 0;
    mode = 'allow';
    pro!.click();
    await group.updateComplete;
    expect(group.value).to.equal('pro');
    expect(log).to.deep.equal(['request:team', 'input', 'change', 'lr-change', 'lr-activate']);
  });

  it('lets a standalone radio listener veto the check', async () => {
    const radio = await fixture<LyraRadio>(html`<lr-radio name="solo" value="yes">Yes</lr-radio>`);
    const log: string[] = [];
    radio.addEventListener('lr-radio-select-request', (event) => {
      log.push(`request:${String(event.detail.checked)}:${event.detail.value}:${String(radio.checked)}`);
      event.preventDefault();
    });
    for (const name of ['input', 'change', 'lr-change', 'lr-activate']) radio.addEventListener(name, () => log.push(name));
    radio.click();
    await radio.updateComplete;
    expect(radio.checked).to.equal(false);
    expect(log).to.deep.equal(['request:true:yes:false']);
  });
});

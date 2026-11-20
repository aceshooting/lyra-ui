import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-tab-group.js';
import '../../lr-tab.js';
import '../../lr-tab-panel.js';
import type { LyraTabGroup, LyraTabGroupSelectRequestDetail } from '../../lr-tab-group.js';

const tabButton = (group: LyraTabGroup, name: string): HTMLElement =>
  group.shadowRoot!.querySelector<HTMLElement>(`[part~="tab"][data-slot="${name}"]`)!;

describe('tab-group select request', () => {
  it('lets a listener veto or resolve a user tab switch before anything commits', async () => {
    const group = await fixture<LyraTabGroup>(html`<lr-tab-group active="a">
      <lr-tab panel="a">A</lr-tab><lr-tab panel="b">B</lr-tab><lr-tab panel="c">C</lr-tab>
      <lr-tab-panel name="a">A body</lr-tab-panel>
      <lr-tab-panel name="b">B body</lr-tab-panel>
      <lr-tab-panel name="c">C body</lr-tab-panel>
    </lr-tab-group>`);
    const log: string[] = [];
    const requests: LyraTabGroupSelectRequestDetail[] = [];
    let mode: 'veto' | 'resolve' | 'allow' = 'veto';
    group.addEventListener('lr-tab-group-select-request', (event) => {
      requests.push({ ...event.detail });
      log.push(`request:${group.active}:${String(event.cancelable)}`);
      if (mode === 'veto') event.preventDefault();
      if (mode === 'resolve') group.active = 'c';
    });
    for (const name of ['lr-tab-hide', 'lr-tab-show', 'lr-activate'])
      group.addEventListener(name, () => log.push(name));

    tabButton(group, 'b').click();
    await group.updateComplete;
    expect(group.active).to.equal('a');
    expect(tabButton(group, 'a').getAttribute('aria-selected')).to.equal('true');
    expect(log).to.deep.equal(['request:a:true']);
    expect(requests).to.deep.equal([{ value: 'b', previousValue: 'a' }]);

    log.length = 0;
    mode = 'resolve';
    await focusByKeyboard(tabButton(group, 'a'));
    await sendKeys({ press: 'ArrowRight' });
    await group.updateComplete;
    expect(group.active, 'a listener write wins over the proposal').to.equal('c');
    expect(log).to.deep.equal(['request:a:true']);

    log.length = 0;
    mode = 'allow';
    tabButton(group, 'b').click();
    await group.updateComplete;
    expect(group.active).to.equal('b');
    expect(log).to.deep.equal(['request:c:true', 'lr-tab-hide', 'lr-tab-show', 'lr-activate']);

    log.length = 0;
    tabButton(group, 'b').click();
    group.show('a');
    await group.updateComplete;
    expect(log, 're-picking the active tab and show() never ask').to.deep.equal(['lr-activate', 'lr-tab-hide', 'lr-tab-show']);
  });
});

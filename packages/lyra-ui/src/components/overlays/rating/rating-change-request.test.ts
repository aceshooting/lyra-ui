import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-rating.js';
import type { LyraRating } from '../../lr-rating.js';

describe('lr-rating change request', () => {
  it('lets a listener veto or resolve a rating before anything commits', async () => {
    const el = await fixture<LyraRating>(html`<lr-rating label="Score" value="2"></lr-rating>`);
    const log: string[] = [];
    let mode: 'veto' | 'resolve' | 'same' | 'allow' = 'veto';
    el.addEventListener('lr-change-request', (event) => {
      const { value, previousValue } = event.detail;
      log.push(`request:${value}:${previousValue}:${el.value}:${String(event.cancelable)}`);
      if (mode === 'veto') event.preventDefault();
      if (mode === 'resolve') el.value = 5;
      if (mode === 'same') el.value = 2;
    });
    for (const name of ['input', 'lr-input', 'change', 'lr-change', 'lr-activate']) {
      el.addEventListener(name, () => log.push(name));
    }
    await focusByKeyboard(el);

    await sendKeys({ press: 'ArrowRight' });
    await el.updateComplete;
    expect(el.value).to.equal(2);
    expect(el.getAttribute('aria-valuenow')).to.equal('2');
    expect(log, 'a refused or redirected request activates nothing').to.deep.equal(['request:3:2:2:true']);

    log.length = 0;
    mode = 'resolve';
    await sendKeys({ press: 'ArrowRight' });
    await el.updateComplete;
    expect(el.value, 'a listener write wins over the proposal').to.equal(5);
    expect(log, 'a refused or redirected request activates nothing').to.deep.equal(['request:3:2:2:true']);

    log.length = 0;
    mode = 'same';
    el.value = 2;
    await sendKeys({ press: 'ArrowRight' });
    await el.updateComplete;
    expect(el.value, 'writing back the held value still suppresses the commit').to.equal(2);
    expect(log, 'a refused or redirected request activates nothing').to.deep.equal(['request:3:2:2:true']);

    log.length = 0;
    mode = 'allow';
    await sendKeys({ press: 'ArrowRight' });
    await el.updateComplete;
    expect(el.value).to.equal(3);
    expect(log).to.deep.equal(['request:3:2:2:true', 'input', 'lr-input', 'change', 'lr-change', 'lr-activate']);

    log.length = 0;
    el.value = 5;
    await sendKeys({ press: 'End' });
    expect(log, 're-committing the current rating requests nothing').to.deep.equal(['lr-activate']);
  });
});

import { expect, fixture, html } from '@open-wc/testing';
import type { LyraComparePanel } from './compare-panel.class.js';
import './compare-panel.js';

for (const [index, choice] of ['a', 'b', 'tie', 'both-bad'].entries()) {
  it(`suppresses the ${choice} vote when disabled during click capture and recovers`, async () => {
    const host = await fixture<LyraComparePanel>(html`<lr-compare-panel item-id="pair"></lr-compare-panel>`);
    const button = host.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="vote-button"]')[index]!;
    const requests: unknown[] = [];
    host.addEventListener('lr-vote-request', event => requests.push((event as CustomEvent).detail));
    host.addEventListener('click', () => { host.disabled = true; }, { capture: true, once: true });
    button.click();
    expect(requests).to.deep.equal([]);
    expect(host.vote).to.equal(null);
    await host.updateComplete;
    expect(button.disabled).to.equal(true);
    host.disabled = false;
    await host.updateComplete;
    button.click();
    expect(requests).to.deep.equal([{ choice, itemId: 'pair' }]);
    expect(host.vote).to.equal(choice);
    await host.updateComplete;
    expect(button.getAttribute('aria-pressed')).to.equal('true');
  });
}

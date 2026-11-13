import { expect, fixture, html } from '@open-wc/testing';
import type { LyraToggle } from './toggle.class.js';
import './toggle.js';

for (const pressed of [false, true]) {
  it(`keeps a ${pressed ? 'pressed' : 'released'} toggle unchanged when disabled during click capture`, async () => {
    const host = await fixture<LyraToggle>(html`<lr-toggle .pressed=${pressed}>Bold</lr-toggle>`);
    const button = host.shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
    const requests: unknown[] = [];
    const changes: unknown[] = [];
    host.addEventListener('lr-toggle-toggle-request', event => { requests.push((event as CustomEvent).detail); });
    host.addEventListener('lr-change', event => { changes.push((event as CustomEvent).detail); });
    host.addEventListener('click', () => { host.disabled = true; }, { capture: true, once: true });
    expect(button.disabled).to.equal(false);
    button.click();
    await host.updateComplete;
    expect(host.pressed).to.equal(pressed);
    expect(button.getAttribute('aria-pressed')).to.equal(String(pressed));
    expect(requests).to.deep.equal([]);
    expect(changes).to.deep.equal([]);
    host.disabled = false;
    await host.updateComplete;
    button.click();
    await host.updateComplete;
    expect(host.pressed).to.equal(!pressed);
    expect(button.getAttribute('aria-pressed')).to.equal(String(!pressed));
    expect(requests).to.deep.equal([{ pressed: !pressed, value: host.value }]);
    expect(changes).to.deep.equal(requests);
  });
}

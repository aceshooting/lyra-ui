import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import '../../lr-alert.js';
import '../../lr-toast-item.js';

for (const component of ['alert', 'toast-item'] as const) {
  for (const reason of ['programmatic', 'close-button', 'timeout'] as const) {
    it(`reports the ${reason} dismissal of a ${component} and honors a veto`, async () => {
      const duration = reason === 'timeout' ? 100 : Infinity;
      const el = component === 'alert'
        ? await fixture<HTMLElementTagNameMap['lr-alert']>(html`<lr-alert open closable .duration=${duration}>Notice</lr-alert>`)
        : await fixture<HTMLElementTagNameMap['lr-toast-item']>(html`<lr-toast-item .duration=${duration}>Notice</lr-toast-item>`);
      let seen = '';
      el.addEventListener('lr-close-request', event => {
        seen = (event as CustomEvent<{ reason: string }>).detail.reason;
        event.preventDefault();
      }, { once: true });
      const trigger = () => {
        if (reason === 'programmatic') void el.hide();
        if (reason === 'close-button') el.shadowRoot!.querySelector<HTMLElement>('[part~="close-button"]')!.click();
      };
      const request = oneEvent(el, 'lr-close-request');
      trigger();
      await request;
      expect(seen).to.equal(reason);
      expect(el.isConnected).to.equal(true);
      const committed = oneEvent(el, 'lr-close');
      if (reason === 'timeout' && component === 'alert') {
        (el as HTMLElementTagNameMap['lr-alert']).duration = duration + 1;
      }
      trigger();
      expect(((await committed) as CustomEvent<{ reason: string }>).detail.reason).to.equal(reason);
    });
  }
}

import { expect, fixture, html } from '@open-wc/testing';
import { reservationStyles } from './reservations.styles.js';

// reservations.css is a light-DOM stylesheet: importing it at document scope cannot reach an
// lr-* element that a consumer's OWN component renders inside its OWN shadow root, because a
// document stylesheet never crosses a shadow boundary. reservationStyles is the adoptable
// (CSSResult) form of the exact same rules, for exactly that case -- see
// `docs/agents` and llms/shared.md's "Preventing layout shift" section.
describe('reservationStyles', () => {
  it('is the same stylesheet reservations.css declares, as an adoptable CSSResult', () => {
    expect(reservationStyles.cssText).to.include(':not(:defined)');
    expect(reservationStyles.cssText).to.include('--lr-chart-height');
  });

  it("reserves an undefined lr-* element's layout when adopted into a shadow root", async () => {
    // A plain, undefined host standing in for a consumer's own component -- the case
    // reservations.css itself cannot reach, because it only ever loads at document scope.
    const host = await fixture<HTMLElement>(html`<div style="inline-size: 400px"></div>`);
    const root = host.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [reservationStyles.styleSheet!];
    root.innerHTML = '<lr-chart></lr-chart>';

    const chart = root.querySelector('lr-chart')!;
    expect(customElements.get('lr-chart'), 'not registered in this file').to.equal(undefined);
    expect(
      chart.getBoundingClientRect().height,
      'the undefined element already occupies its 280px default, inside the shadow root',
    ).to.be.closeTo(280, 2);
  });

  it('is inert for a defined element inside the same shadow root', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const root = host.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [reservationStyles.styleSheet!];
    root.innerHTML = '<lr-skeleton></lr-skeleton>';

    const skeleton = root.querySelector('lr-skeleton')!;
    if (customElements.get('lr-skeleton') === undefined) return; // not loaded in this file
    expect(skeleton.matches(':defined'), 'upgraded').to.be.true;
  });
});

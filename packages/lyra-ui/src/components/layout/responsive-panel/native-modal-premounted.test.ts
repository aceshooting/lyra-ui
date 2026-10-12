import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import type { LyraResponsivePanel } from './responsive-panel.class.js';
import './responsive-panel.js';

it('opens a pre-mounted sibling above a modal without inheriting the lower overlay inert lease', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div data-lr-theme-scope>
    <dialog><button>Original action</button></dialog>
    <lr-responsive-panel mode="overlay" label="Lower" style="--lr-transition-base:0ms"><button>Lower action</button></lr-responsive-panel>
    <lr-responsive-panel mode="overlay" label="Upper" style="--lr-transition-base:0ms"><button>Upper action</button></lr-responsive-panel>
  </div>`);
  const outer = wrapper.querySelector<HTMLDialogElement>('dialog')!;
  const [lower, upper] = Array.from(wrapper.querySelectorAll<LyraResponsivePanel>('lr-responsive-panel'));
  try {
    await Promise.all([lower!.updateComplete, upper!.updateComplete]);
    outer.showModal();
    lower!.open = true;
    await lower!.updateComplete;
    await waitUntil(() => upper!.inert, 'the lower overlay temporarily inerts its pre-mounted sibling');
    upper!.open = true;
    await upper!.updateComplete;
    const carrier = upper!.shadowRoot!.querySelector<HTMLDialogElement>('[data-native-modal-carrier]')!;
    await waitUntil(() => carrier.matches(':modal'));
    let clicks = 0;
    const action = upper!.querySelector<HTMLButtonElement>('button')!;
    action.addEventListener('click', () => clicks += 1);
    const rect = action.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    expect(clicks, 'the upper action escapes manager-owned background inertness').to.equal(1);
    expect(carrier.inert, 'the carrier has no authored inert restriction').to.equal(false);
    upper!.open = false;
    await upper!.updateComplete;
    lower!.open = false;
    await lower!.updateComplete;
    await waitUntil(() => !upper!.inert && !lower!.inert, 'closing the stack restores both authored inert states');
  } finally {
    upper!.remove();
    lower!.remove();
    outer.close();
  }
});

for (const authoredWhen of ['before activation', 'while leased'] as const) {
  it(`preserves authored inertness written ${authoredWhen} when a sibling carrier opens`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<div data-lr-theme-scope>
      <dialog><button>Original action</button></dialog>
      <lr-responsive-panel mode="overlay" label="Lower" style="--lr-transition-base:0ms"><button>Lower action</button></lr-responsive-panel>
      <lr-responsive-panel mode="overlay" label="Upper" ?inert=${authoredWhen === 'before activation'} style="--lr-transition-base:0ms"><button>Upper action</button></lr-responsive-panel>
    </div>`);
    const outer = wrapper.querySelector<HTMLDialogElement>('dialog')!;
    const [lower, upper] = Array.from(wrapper.querySelectorAll<LyraResponsivePanel>('lr-responsive-panel'));
    try {
      outer.showModal();
      lower!.open = true;
      await lower!.updateComplete;
      await waitUntil(() => upper!.inert);
      if (authoredWhen === 'while leased') upper!.inert = true;
      upper!.open = true;
      await upper!.updateComplete;
      const carrier = upper!.shadowRoot!.querySelector<HTMLDialogElement>('[data-native-modal-carrier]')!;
      await waitUntil(() => carrier.matches(':modal'));
      expect(carrier.inert, 'authored inertness also restricts native presentation').to.equal(true);
      let clicks = 0;
      const action = upper!.querySelector<HTMLButtonElement>('button')!;
      action.addEventListener('click', () => clicks += 1);
      const rect = action.getBoundingClientRect();
      await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
      expect(clicks, 'an authored inert action remains unavailable').to.equal(0);
      upper!.open = false;
      await upper!.updateComplete;
      lower!.open = false;
      await lower!.updateComplete;
      await waitUntil(() => !lower!.inert);
      expect(upper!.inert, 'releasing overlay leases preserves the author write').to.equal(true);
    } finally {
      upper!.remove();
      lower!.remove();
      outer.close();
    }
  });
}

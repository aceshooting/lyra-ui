import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './multi-split.js';
import type { LyraMultiSplit } from './multi-split.js';

describe('floating multi-split drawer native carrier dismissal', () => {
  it('restores a floating drawer carrier when an external native close hides its overlay surface', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>
      <dialog><button>Existing modal</button></dialog>
      <lr-multi-split collapse="start" style="inline-size:300px;block-size:200px">
        <div><button>Drawer action</button></div><div>Content</div>
      </lr-multi-split>
    </div>`);
    const outer = wrapper.querySelector<HTMLDialogElement>('dialog')!;
    const split = wrapper.querySelector<LyraMultiSplit>('lr-multi-split')!;
    await waitUntil(() => split.collapseState === 'floating');
    outer.showModal();
    try {
      split.open = true;
      await split.updateComplete;
      const carrier = split.shadowRoot!.querySelector<HTMLDialogElement>('dialog[data-native-modal-carrier]')!;
      await waitUntil(() => carrier.matches(':modal'));
      carrier.close();
      await waitUntil(() => carrier.matches(':modal'), 'the still-open drawer restores its native modal presentation');
      expect(split.open).to.equal(true);
      expect(outer.open).to.equal(true);
    } finally {
      split.remove();
      outer.close();
    }
  });
});

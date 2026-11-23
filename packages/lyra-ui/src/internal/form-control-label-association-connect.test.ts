import { expect, waitUntil } from '@open-wc/testing';
import {
  __setExternalLabelAssociationLoaderForTesting,
  isExternalLabelAssociationIndexed,
} from './form-control-labels.js';
import { tag } from './prefix.js';
import '../components/lr-checkbox.js';

// Module state is per page: this file starts with the lean observer and no indexed one loaded.

interface CheckboxControl extends HTMLElement {
  readonly updateComplete: Promise<boolean>;
  checked: boolean;
}

describe('external labels associated before the indexed observer loads', () => {
  it('names the control in its first update and replays changes made while the observer loads', async () => {
    expect(isExternalLabelAssociationIndexed()).to.equal(false);
    // The first load fails (an offline chunk): the lean root keeps buffering and the next mutation
    // retries, replaying everything seen since the control connected.
    let failedLoads = 0;
    __setExternalLabelAssociationLoaderForTesting(() => {
      failedLoads++;
      return Promise.reject(new Error('chunk unavailable'));
    });
    const container = document.createElement('div');
    const label = document.createElement('label');
    const control = document.createElement(tag('checkbox')) as CheckboxControl;
    control.id = 'connect-label-control';
    label.htmlFor = control.id;
    label.textContent = 'Initial name';
    container.append(label, control);
    document.body.append(container);
    try {
      await control.updateComplete;
      const semantic = control.shadowRoot!.querySelector<HTMLElement>('[role="checkbox"],input')!;
      // Applied by the control's own refresh, independent of the observer chunk.
      expect(semantic.getAttribute('aria-label')).to.equal('Initial name');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(failedLoads).to.be.greaterThan(0);
      expect(isExternalLabelAssociationIndexed()).to.equal(false);
      __setExternalLabelAssociationLoaderForTesting();

      // Changes before the indexed observer arrives are seen by the lean observer and replayed.
      label.textContent = 'Retitled';
      const second = document.createElement('label');
      second.htmlFor = control.id;
      second.textContent = 'second';
      container.append(second);
      await waitUntil(() => semantic.getAttribute('aria-label') === 'Retitled second',
        'both label changes reach the semantic control');
      expect(isExternalLabelAssociationIndexed()).to.equal(true);

      label.click();
      await waitUntil(() => control.checked, 'the label still activates the control');
      await expect(container).to.be.accessible();
    } finally {
      __setExternalLabelAssociationLoaderForTesting();
      container.remove();
    }
  });
});

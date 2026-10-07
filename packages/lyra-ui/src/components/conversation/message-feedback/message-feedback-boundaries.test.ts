import { expect, fixture, html } from '@open-wc/testing';
import './message-feedback.js';
import type { LyraMessageFeedback } from './message-feedback.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';

describe('feedback toolbar ownership', () => {
  it('lets a provider be queried before its first render without creating a focusable action', () => {
    const element = document.createElement('lr-message-feedback') as LyraMessageFeedback;
    const actions = element.getToolbarActions();
    expect(actions.map(action => action.id)).to.deep.equal(['up', 'down']);
    for (const action of actions) {
      expect(action.disabled).to.equal(true);
      action.setTabIndex(-1);
      expect(action.matchesEventPath([])).to.equal(false);
      action.releaseTabIndex?.();
    }
  });

  it('preserves a consumer tabindex edit through subsequent toolbar updates and releases', async () => {
    const element = await fixture<LyraMessageFeedback>(html`<lr-message-feedback></lr-message-feedback>`);
    const button = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="up-button"]')!;
    const action = element.getToolbarActions()[0]!;
    action.setTabIndex(-1);
    button.setAttribute('tabindex', '3');
    action.setTabIndex(0);
    expect(button.tabIndex).to.equal(3);
    action.setTabIndex(-1);
    expect(button.tabIndex).to.equal(3);
    action.releaseTabIndex?.();
    expect(button.tabIndex).to.equal(3);
  });

  it('drops an uninspectable detail collection without rendering a partial editor', async () => {
    expectDevWarning(collectionTruncationWarningKey('lr-message-feedback', 'detail'));
    const reasons = new Proxy([], { getOwnPropertyDescriptor() { throw new Error('opaque collection'); } });
    for (const commentable of [false, true]) {
      const element = await fixture<LyraMessageFeedback>(html`<lr-message-feedback
        rating="down" .detail=${{ reasons, commentable }}
      ></lr-message-feedback>`);
      expect(element.shadowRoot!.querySelectorAll('lr-chip').length).to.equal(0);
      expect(element.shadowRoot!.querySelectorAll('[part="comment"]').length).to.equal(0);
    }
  });

  it('forwards an explicitly enabled native autocorrect attribute to its comment editor', async () => {
    const element = await fixture<LyraMessageFeedback>(html`<lr-message-feedback
      rating="down" autocorrect="on" .detail=${{ commentable: true }}
    ></lr-message-feedback>`);
    expect(element.shadowRoot!.querySelector('[part="comment"]')!.getAttribute('autocorrect')).to.equal('on');
  });
});

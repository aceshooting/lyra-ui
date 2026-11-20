import { expect, fixture, html } from '@open-wc/testing';
import type { MessagePart } from '../../../ai/types.js';
import type { LyraToolResultView } from '../../agent-tools/tool-result-view/tool-result-view.class.js';
import '../../lr-tool-result-view.js';
import type { LyraMessageParts } from './message-parts.class.js';
import '../../lr-message-parts.js';

it('masks a nameless partial failure using the invocation outside the rendered window', async () => {
  const partial = { token: 'private-token', retained: 2 };
  const parts: MessagePart[] = [
    { id: 'call', type: 'tool-call', invocation: { id: 'invocation', name: 'search', args: {},
      status: 'error', redactedFields: ['error', 'result.token'] } },
    { id: 'failure', type: 'tool-result', invocationId: 'invocation', error: 'private-error', result: partial },
  ];
  const element = await fixture<LyraMessageParts>(html`<lr-message-parts content-mode="plain" max-rendered-parts="1"
    .strings=${{ envListValueHidden: 'Hidden data' }} .parts=${parts}></lr-message-parts>`);
  const error = element.shadowRoot!.querySelector<HTMLElement>('[part="tool-result-error"]')!;
  const view = error.querySelector<LyraToolResultView>('lr-tool-result-view')!;
  expect(element.shadowRoot!.querySelectorAll('[data-type="tool-call"]').length).to.equal(0);
  expect(error.querySelector('span')!.textContent).to.equal('Hidden data');
  expect(error.textContent).not.to.include('private-error');
  expect(view.toolName).to.equal('');
  expect(view.result).to.deep.equal({ token: 'Hidden data', retained: 2 });
  expect(view.result === partial).to.equal(false);
  expect(partial).to.deep.equal({ token: 'private-token', retained: 2 });
});

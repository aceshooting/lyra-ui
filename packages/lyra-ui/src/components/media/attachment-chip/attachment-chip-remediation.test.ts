import { expect, fixture, html } from '@open-wc/testing';
import './attachment-chip.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

it('keeps a detached failure silent on immediate reconnect and announces later connected failures once', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-attachment-chip']>(html`<lr-attachment-chip status="uploading" .strings=${{ attachmentUploadFailed: 'Failed upload' }}></lr-attachment-chip>`);
  const parent = el.parentElement!;
  const messages = (): string[] => Array.from(document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)?.children ?? []).map((child) => child.textContent ?? '');
  el.remove();
  el.status = 'error';
  parent.append(el);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Failed upload');
  expect(messages()).to.deep.equal([]);
  el.remove();
  parent.append(el);
  await el.updateComplete;
  expect(messages()).to.deep.equal([]);
  el.status = 'uploading';
  await el.updateComplete;
  el.status = 'error';
  await el.updateComplete;
  expect(messages()).to.deep.equal(['Failed upload']);
  el.remove();
  el.status = 'uploading';
  parent.append(el);
  // A failure written after reconnection is new, even before the first reconnect update.
  el.status = 'error';
  await el.updateComplete;
  expect(messages()).to.deep.equal(['Failed upload']);
});

it('announces one new connected failure when a retry coalesces uploading and error in one update', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-attachment-chip']>(html`<lr-attachment-chip status="uploading" .strings=${{ attachmentUploadFailed: 'Retry failed' }}></lr-attachment-chip>`);
  const parent = el.parentElement!;
  const messages = (): string[] => Array.from(document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)?.children ?? []).map((child) => child.textContent ?? '');
  el.status = 'error';
  await el.updateComplete;
  expect(messages()).to.deep.equal(['Retry failed']);
  el.status = 'uploading';
  el.status = 'error';
  await el.updateComplete;
  expect(messages()).to.deep.equal(['Retry failed', 'Retry failed']);
  el.remove();
  parent.append(el);
  // A coalesced retry remains new when it occurs before the first reconnect update.
  el.status = 'uploading';
  el.status = 'error';
  await el.updateComplete;
  expect(messages()).to.deep.equal(['Retry failed']);
  el.remove();
  el.status = 'uploading';
  el.status = 'error';
  parent.append(el);
  await el.updateComplete;
  expect(messages()).to.deep.equal([]);
});

import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './attachment-chip.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import type { LyraAttachmentChip } from './attachment-chip.js';

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

it('falls back to the localized remove name when remove-label is whitespace only', async () => {
  const el = await fixture<LyraAttachmentChip>(html`<lr-attachment-chip name="report.pdf" remove-label="   "></lr-attachment-chip>`);
  const button = el.shadowRoot!.querySelector<HTMLElement>('[part="remove-button"]')!;
  const inner = button.shadowRoot?.querySelector('button') ?? button;
  const name = button.getAttribute('aria-label') ?? inner.getAttribute('aria-label');
  expect(name).to.equal('Remove report.pdf');
});

it('paints action hover and press and sizes the thumbnail from public tokens', async () => {
  const el = await fixture<LyraAttachmentChip>(html`<lr-attachment-chip name="a.txt" style="--lr-transition-interactive: none; --lr-attachment-chip-action-hover-bg: rgb(1, 2, 3); --lr-attachment-chip-action-active-bg: rgb(4, 5, 6); --lr-attachment-chip-thumbnail-size: 31px; --lr-attachment-chip-thumbnail-radius: 3px"></lr-attachment-chip>`);
  const thumbnail = el.shadowRoot!.querySelector<HTMLElement>('[part="thumbnail"]')!;
  expect(getComputedStyle(thumbnail).inlineSize).to.equal('31px');
  expect(getComputedStyle(thumbnail).borderTopLeftRadius).to.equal('3px');
  const remove = el.shadowRoot!.querySelector<HTMLElement>('[part="remove-button"]')!;
  await resetMouse();
  try {
    await hoverUntilMatched(remove, 'remove hover');
    await waitUntil(() => getComputedStyle(remove).backgroundColor === 'rgb(1, 2, 3)', 'hover token');
    await sendMouse({ type: 'down' });
    await waitUntil(() => remove.matches(':active'), 'pressed state');
    expect(getComputedStyle(remove).backgroundColor).to.equal('rgb(4, 5, 6)');
  } finally {
    await sendMouse({ type: 'move', position: [0, 0] });
    await resetMouse();
  }
});

import { fixture, expect, html } from '@open-wc/testing';
import './chat-message.js';
import '../live-region/live-region.js';
import type { LyraChatMessage } from './chat-message.js';
import type { LyraLiveRegion } from '../live-region/live-region.js';
import { styles } from './chat-message.styles.js';

function liveRegionText(el: LyraChatMessage): string {
  const region = el.shadowRoot!.querySelector('lyra-live-region') as LyraLiveRegion;
  return region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
}

it('defaults to role="assistant" and status="sent", reflecting role to data-role (never the bare role attribute)', async () => {
  const el = (await fixture(html`<lyra-chat-message>hi</lyra-chat-message>`)) as LyraChatMessage;
  expect(el.role).to.equal('assistant');
  expect(el.status).to.equal('sent');
  expect(el.getAttribute('data-role')).to.equal('assistant');
  expect(el.getAttribute('status')).to.equal('sent');
  // `role="user"`/`"assistant"`/`"system"` are not valid ARIA role tokens --
  // reflecting there would collide with the element's real ARIA role and
  // fail an automated accessibility check, so this must never be set.
  expect(el.hasAttribute('role')).to.be.false;
});

it('reflects an explicit data-role attribute back to the role property', async () => {
  const el = (await fixture(html`<lyra-chat-message data-role="user">hi</lyra-chat-message>`)) as LyraChatMessage;
  expect(el.role).to.equal('user');
  expect(el.getAttribute('data-role')).to.equal('user');
});

it('ignores a plain role="..." attribute entirely (it is not the attribute this component watches)', async () => {
  const el = (await fixture(html`<lyra-chat-message role="user">hi</lyra-chat-message>`)) as LyraChatMessage;
  expect(el.role).to.equal('assistant');
});

it('normalizes a Date, an ISO string, and an invalid string for timestamp', async () => {
  const el = (await fixture(html`<lyra-chat-message>hi</lyra-chat-message>`)) as LyraChatMessage;
  expect(el.shadowRoot!.querySelector('[part="timestamp"]')).to.not.exist;

  const date = new Date('2024-03-01T10:30:00Z');
  el.timestamp = date;
  await el.updateComplete;
  let time = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
  expect(time).to.exist;
  expect(time.getAttribute('datetime')).to.equal(date.toISOString());

  el.timestamp = '2024-03-01T10:30:00Z';
  await el.updateComplete;
  time = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
  expect(time.getAttribute('datetime')).to.equal(date.toISOString());

  el.timestamp = 'not a date';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="timestamp"]'), 'invalid input renders nothing, like unset').to.not
    .exist;
});

it('uses the default hour:minute formatter, overridable via formatTimestamp', async () => {
  const date = new Date('2024-03-01T10:30:00Z');
  const el = (await fixture(html`<lyra-chat-message .timestamp=${date}>hi</lyra-chat-message>`)) as LyraChatMessage;
  const time = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
  expect(time.textContent!.trim().length).to.be.greaterThan(0);

  el.formatTimestamp = (d) => `custom:${d.getUTCFullYear()}`;
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement).textContent).to.equal('custom:2024');
});

it('formats the default timestamp with the effective locale', async () => {
  const date = new Date('2024-03-01T10:30:00Z');
  const el = (await fixture(
    html`<lyra-chat-message locale="ar-EG" .timestamp=${date}>hi</lyra-chat-message>`,
  )) as LyraChatMessage;
  const expected = new Intl.DateTimeFormat('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  expect((el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement).textContent).to.equal(
    expected,
  );
});

it('does not render the collapse button unless collapsible, and hides the body only while collapsed', async () => {
  const el = (await fixture(html`<lyra-chat-message>hi</lyra-chat-message>`)) as LyraChatMessage;
  expect(el.shadowRoot!.querySelector('[part="collapse-button"]')).to.not.exist;
  expect((el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).hasAttribute('hidden')).to.be.false;

  el.collapsible = true;
  el.collapsed = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="collapse-button"]')).to.exist;
  expect((el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
});

it('toggles collapsed and emits lyra-collapse-toggle with the new value on collapse-button click', async () => {
  const el = (await fixture(
    html`<lyra-chat-message collapsible>hi</lyra-chat-message>`,
  )) as LyraChatMessage;
  let detail: unknown;
  el.addEventListener('lyra-collapse-toggle', (e) => (detail = (e as CustomEvent).detail));

  const button = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  button.click();
  await el.updateComplete;

  expect(el.collapsed).to.be.true;
  expect(detail).to.equal(true);
  expect(button.getAttribute('aria-expanded')).to.equal('false');

  button.click();
  await el.updateComplete;
  expect(el.collapsed).to.be.false;
  expect(detail).to.equal(false);
});

it('only renders the built-in retry button when status="failed", and it emits lyra-retry', async () => {
  const el = (await fixture(html`<lyra-chat-message status="sent">hi</lyra-chat-message>`)) as LyraChatMessage;
  expect(el.shadowRoot!.querySelector('[part="retry-button"]')).to.not.exist;

  el.status = 'failed';
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;
  expect(button).to.exist;

  let fired = false;
  el.addEventListener('lyra-retry', () => (fired = true));
  button.click();
  expect(fired).to.be.true;
});

it('keeps focus inside the message when a lyra-retry listener flips status away from failed', async () => {
  const el = (await fixture(html`<lyra-chat-message status="failed">hi</lyra-chat-message>`)) as LyraChatMessage;
  // The documented, expected response to `lyra-retry`.
  el.addEventListener('lyra-retry', () => {
    el.status = 'sent';
  });

  const button = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;
  button.focus();
  button.click();
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="retry-button"]'), 'the retry button is gone once status flips').to.not
    .exist;
  expect(el.shadowRoot!.activeElement, 'focus must not have silently reverted to <body>').to.not.be.null;
  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="bubble"]'));
});

it('shows visible status text (not color alone) for sending/streaming/failed, and none for sent', async () => {
  const el = (await fixture(html`<lyra-chat-message status="sending">hi</lyra-chat-message>`)) as LyraChatMessage;
  expect((el.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement).textContent).to.equal('Sending…');

  el.status = 'streaming';
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement).textContent).to.equal('Responding…');

  el.status = 'failed';
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement).textContent).to.equal(
    'Failed to send',
  );

  el.status = 'sent';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status-text"]')).to.not.exist;
});

it('does not announce whatever status a message happens to mount with', async () => {
  const el = (await fixture(html`<lyra-chat-message status="failed">hi</lyra-chat-message>`)) as LyraChatMessage;
  expect(liveRegionText(el)).to.equal('');
});

it('announces a transition to status="failed" assertively via the internal live-region', async () => {
  const el = (await fixture(html`<lyra-chat-message status="streaming">hi</lyra-chat-message>`)) as LyraChatMessage;
  el.status = 'failed';
  await el.updateComplete;

  expect(liveRegionText(el)).to.equal('Message failed to send.');
  const region = el.shadowRoot!.querySelector('lyra-live-region') as LyraLiveRegion;
  expect(region.mode).to.equal('assertive');
});

it('announces a streaming -> sent transition politely, but not other transitions into "sent"', async () => {
  const el = (await fixture(html`<lyra-chat-message status="streaming">hi</lyra-chat-message>`)) as LyraChatMessage;

  el.status = 'sending';
  await el.updateComplete;
  expect(liveRegionText(el), 'streaming -> sending is not an announced transition').to.equal('');

  el.status = 'sent';
  await el.updateComplete;
  expect(liveRegionText(el), 'sending -> sent (not streaming -> sent) is not announced').to.equal('');
});

it('announces streaming -> sent directly', async () => {
  const el = (await fixture(html`<lyra-chat-message status="streaming">hi</lyra-chat-message>`)) as LyraChatMessage;
  el.status = 'sent';
  await el.updateComplete;

  expect(liveRegionText(el)).to.equal('Message complete.');
  const region = el.shadowRoot!.querySelector('lyra-live-region') as LyraLiveRegion;
  expect(region.mode).to.equal('polite');
});

it('still announces streaming -> sent when both are set within the same task, with no render in between', async () => {
  const el = (await fixture(html`<lyra-chat-message status="sending">hi</lyra-chat-message>`)) as LyraChatMessage;

  // No `await` between these two assignments -- both land in the same
  // update batch, so Lit's own coalesced `changedProperties` would only
  // ever remember "sending" (the value before the first of the two sets)
  // as `status`'s old value, losing the "streaming" transition entirely.
  el.status = 'streaming';
  el.status = 'sent';
  await el.updateComplete;

  expect(liveRegionText(el)).to.equal('Message complete.');
});

it('hides the header/footer/avatar/badges/attachments/actions wrappers until something is slotted', async () => {
  const el = (await fixture(html`<lyra-chat-message>hi</lyra-chat-message>`)) as LyraChatMessage;
  expect((el.shadowRoot!.querySelector('[part="header"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="avatar"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="attachments"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
});

it('shows the header once an avatar is slotted, detected on first paint (not just via slotchange)', async () => {
  const el = (await fixture(
    html`<lyra-chat-message><span slot="avatar">A</span>hi</lyra-chat-message>`,
  )) as LyraChatMessage;
  expect((el.shadowRoot!.querySelector('[part="header"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="avatar"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
});

it('hides the badges wrapper by default', async () => {
  const el = (await fixture(html`<lyra-chat-message>hi</lyra-chat-message>`)) as LyraChatMessage;
  expect((el.shadowRoot!.querySelector('[part="badges"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
});

it('shows the header and badges once a badge is slotted, detected on first paint (not just via slotchange)', async () => {
  const el = (await fixture(
    html`<lyra-chat-message><span slot="badges">gpt-5.4</span>hi</lyra-chat-message>`,
  )) as LyraChatMessage;
  expect((el.shadowRoot!.querySelector('[part="header"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="badges"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
});

it('shows/hides the badges wrapper as badges content is added/removed via slotchange', async () => {
  const el = (await fixture(html`<lyra-chat-message>hi</lyra-chat-message>`)) as LyraChatMessage;
  const badgesWrapper = el.shadowRoot!.querySelector('[part="badges"]') as HTMLElement;
  const badgesSlot = el.shadowRoot!.querySelector('slot[name="badges"]') as HTMLSlotElement;
  expect(badgesWrapper.hasAttribute('hidden')).to.be.true;

  const badge = document.createElement('span');
  badge.slot = 'badges';
  el.appendChild(badge);
  badgesSlot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(badgesWrapper.hasAttribute('hidden')).to.be.false;
  // The header itself must also now be visible, purely because of the badges content.
  expect((el.shadowRoot!.querySelector('[part="header"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
});

it('shows/hides the footer actions wrapper as actions content is added/removed via slotchange', async () => {
  const el = (await fixture(html`<lyra-chat-message>hi</lyra-chat-message>`)) as LyraChatMessage;
  const actionsWrapper = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  const actionsSlot = el.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement;
  expect(actionsWrapper.hasAttribute('hidden')).to.be.true;

  const button = document.createElement('button');
  button.slot = 'actions';
  el.appendChild(button);
  actionsSlot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(actionsWrapper.hasAttribute('hidden')).to.be.false;
  // The footer itself must also now be visible, purely because of the actions content.
  expect((el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
});

it('shows attachments once slotted', async () => {
  const el = (await fixture(
    html`<lyra-chat-message><span slot="attachments">file.png</span>hi</lyra-chat-message>`,
  )) as LyraChatMessage;
  expect((el.shadowRoot!.querySelector('[part="attachments"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
});

it('localizes the visible status text via this.localize(), not a hardcoded English map', async () => {
  const el = (await fixture(
    html`<lyra-chat-message
      .strings=${{ chatSending: 'Envoi…', chatResponding: 'Réponse…', chatFailedToSend: "Échec de l'envoi" }}
      >hi</lyra-chat-message
    >`,
  )) as LyraChatMessage;
  el.status = 'sending';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Envoi…');
  el.status = 'streaming';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Réponse…');
  el.status = 'failed';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal("Échec de l'envoi");
});

it('defaults to English status text when no strings override is set', async () => {
  const el = (await fixture(html`<lyra-chat-message>hi</lyra-chat-message>`)) as LyraChatMessage;
  el.status = 'sending';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Sending…');
});

it('uses themeable ambient motion for streaming and wraps crowded footer content', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(
    "animation: lyra-chat-message-pulse var(--lyra-transition-ambient) infinite;",
  );
  expect(css).to.match(/\[part='footer'\]\s*\{[^}]*flex-wrap:\s*wrap;/);
});

it('allows the ambient motion token to retime the streaming indicator', async () => {
  const el = (await fixture(html`
    <lyra-chat-message
      status="streaming"
      style="--lyra-transition-ambient: 3s linear"
    >hi</lyra-chat-message>
  `)) as LyraChatMessage;
  const indicator = el.shadowRoot!.querySelector('[part="status-indicator"]')!;

  expect(getComputedStyle(indicator).animationDuration).to.equal('3s');
  expect(getComputedStyle(indicator).animationTimingFunction).to.equal('linear');
});

it('localizes the live-region status-change announcements via this.localize()', async () => {
  const el = (await fixture(
    html`<lyra-chat-message .strings=${{ chatFailedAnnounce: 'Échec.', chatCompleteAnnounce: 'Terminé.' }}
      >hi</lyra-chat-message
    >`,
  )) as LyraChatMessage;
  el.status = 'streaming';
  await el.updateComplete;
  el.status = 'sent';
  await el.updateComplete;
  expect(liveRegionText(el)).to.equal('Terminé.');
  el.status = 'failed';
  await el.updateComplete;
  expect(liveRegionText(el)).to.equal('Échec.');
});

it('is accessible in the default, empty state', async () => {
  const el = (await fixture(html`<lyra-chat-message>A plain message.</lyra-chat-message>`)) as LyraChatMessage;
  await expect(el).to.be.accessible();
});

it('is accessible fully populated: avatar, badges, attachments, actions, timestamp, and status="failed"', async () => {
  const el = (await fixture(html`
    <lyra-chat-message data-role="user" status="failed" .timestamp=${new Date()} collapsible>
      <span slot="avatar">A</span>
      <span slot="badges">gpt-5.4</span>
      Something went wrong.
      <span slot="attachments">file.png</span>
      <button slot="actions">Copy</button>
    </lyra-chat-message>
  `)) as LyraChatMessage;
  await expect(el).to.be.accessible();
});

describe('attachments-position', () => {
  it('defaults to "after" -- attachments render after the body in DOM order', async () => {
    const el = (await fixture(html`
      <lyra-chat-message><span slot="attachments">file.png</span>Hello</lyra-chat-message>
    `)) as LyraChatMessage;
    const bubble = el.shadowRoot!.querySelector('[part="bubble"]')!;
    const parts = Array.from(bubble.children).map((c) => c.getAttribute('part'));
    expect(parts.indexOf('body')).to.be.lessThan(parts.indexOf('attachments'));
  });

  it('renders attachments before the body when attachments-position="before"', async () => {
    const el = (await fixture(html`
      <lyra-chat-message attachments-position="before"
        ><span slot="attachments">file.png</span>Hello</lyra-chat-message
      >
    `)) as LyraChatMessage;
    const bubble = el.shadowRoot!.querySelector('[part="bubble"]')!;
    const parts = Array.from(bubble.children).map((c) => c.getAttribute('part'));
    expect(parts.indexOf('attachments')).to.be.lessThan(parts.indexOf('body'));
  });

  it('reflects attachments-position onto the property', async () => {
    const el = (await fixture(html`<lyra-chat-message attachments-position="before"></lyra-chat-message>`)) as LyraChatMessage;
    expect(el.attachmentsPosition).to.equal('before');
  });
});

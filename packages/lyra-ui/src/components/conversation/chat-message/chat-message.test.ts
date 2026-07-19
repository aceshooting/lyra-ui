import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './chat-message.js';
import '../../utility/live-region/live-region.js';
import '../markdown/markdown-core.js';
import type { LyraChatMessage } from './chat-message.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.js';
import { styles } from './chat-message.styles.js';

function liveRegionText(el: LyraChatMessage): string {
  const region = el.shadowRoot!.querySelector('lr-live-region') as LyraLiveRegion;
  return region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
}

it('defaults to role="assistant" and status="sent", reflecting role to data-role (never the bare role attribute)', async () => {
  const el = (await fixture(html`<lr-chat-message>hi</lr-chat-message>`)) as LyraChatMessage;
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
  const el = (await fixture(html`<lr-chat-message data-role="user">hi</lr-chat-message>`)) as LyraChatMessage;
  expect(el.role).to.equal('user');
  expect(el.getAttribute('data-role')).to.equal('user');
});

it('ignores a plain role="..." attribute entirely (it is not the attribute this component watches)', async () => {
  const el = (await fixture(html`<lr-chat-message role="user">hi</lr-chat-message>`)) as LyraChatMessage;
  expect(el.role).to.equal('assistant');
});

it('normalizes a Date, an ISO string, and an invalid string for timestamp', async () => {
  const el = (await fixture(html`<lr-chat-message>hi</lr-chat-message>`)) as LyraChatMessage;
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
  const el = (await fixture(html`<lr-chat-message .timestamp=${date}>hi</lr-chat-message>`)) as LyraChatMessage;
  const time = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
  expect(time.textContent!.trim().length).to.be.greaterThan(0);

  el.formatTimestamp = (d) => `custom:${d.getUTCFullYear()}`;
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement).textContent).to.equal('custom:2024');
});

it('formats the default timestamp with the effective locale', async () => {
  const date = new Date('2024-03-01T10:30:00Z');
  const el = (await fixture(
    html`<lr-chat-message locale="ar-EG" .timestamp=${date}>hi</lr-chat-message>`,
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
  const el = (await fixture(html`<lr-chat-message>hi</lr-chat-message>`)) as LyraChatMessage;
  expect(el.shadowRoot!.querySelector('[part="collapse-button"]')).to.not.exist;
  expect((el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).hasAttribute('hidden')).to.be.false;

  el.collapsible = true;
  el.collapsed = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="collapse-button"]')).to.exist;
  expect((el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
});

it('toggles collapsed and emits lr-collapse-toggle with the new value on collapse-button click', async () => {
  const el = (await fixture(
    html`<lr-chat-message collapsible>hi</lr-chat-message>`,
  )) as LyraChatMessage;
  let detail: unknown;
  el.addEventListener('lr-collapse-toggle', (e) => (detail = (e as CustomEvent).detail));

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

it('only renders the built-in retry button when status="failed", and it emits lr-retry', async () => {
  const el = (await fixture(html`<lr-chat-message status="sent">hi</lr-chat-message>`)) as LyraChatMessage;
  expect(el.shadowRoot!.querySelector('[part="retry-button"]')).to.not.exist;

  el.status = 'failed';
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;
  expect(button).to.exist;

  let fired = false;
  el.addEventListener('lr-retry', () => (fired = true));
  button.click();
  expect(fired).to.be.true;
});

it('includes the optional stable message id in lr-retry detail', async () => {
  const el = (await fixture(html`<lr-chat-message message-id="message-42" status="failed">hi</lr-chat-message>`)) as LyraChatMessage;
  const event = oneEvent(el, 'lr-retry');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!.click();
  expect((await event).detail).to.deep.equal({ messageId: 'message-42' });
});

it('keeps focus inside the message when a lr-retry listener flips status away from failed', async () => {
  const el = (await fixture(html`<lr-chat-message status="failed">hi</lr-chat-message>`)) as LyraChatMessage;
  // The documented, expected response to `lr-retry`.
  el.addEventListener('lr-retry', () => {
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
  const el = (await fixture(html`<lr-chat-message status="sending">hi</lr-chat-message>`)) as LyraChatMessage;
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
  const el = (await fixture(html`<lr-chat-message status="failed">hi</lr-chat-message>`)) as LyraChatMessage;
  expect(liveRegionText(el)).to.equal('');
});

it('announces a transition to status="failed" assertively via the internal live-region', async () => {
  const el = (await fixture(html`<lr-chat-message status="streaming">hi</lr-chat-message>`)) as LyraChatMessage;
  el.status = 'failed';
  await el.updateComplete;

  expect(liveRegionText(el)).to.equal('Message failed to send.');
  const region = el.shadowRoot!.querySelector('lr-live-region') as LyraLiveRegion;
  expect(region.mode).to.equal('assertive');
});

it('announces a streaming -> sent transition politely, but not other transitions into "sent"', async () => {
  const el = (await fixture(html`<lr-chat-message status="streaming">hi</lr-chat-message>`)) as LyraChatMessage;

  el.status = 'sending';
  await el.updateComplete;
  expect(liveRegionText(el), 'streaming -> sending is not an announced transition').to.equal('');

  el.status = 'sent';
  await el.updateComplete;
  expect(liveRegionText(el), 'sending -> sent (not streaming -> sent) is not announced').to.equal('');
});

it('announces streaming -> sent directly', async () => {
  const el = (await fixture(html`<lr-chat-message status="streaming">hi</lr-chat-message>`)) as LyraChatMessage;
  el.status = 'sent';
  await el.updateComplete;

  expect(liveRegionText(el)).to.equal('Message complete.');
  const region = el.shadowRoot!.querySelector('lr-live-region') as LyraLiveRegion;
  expect(region.mode).to.equal('polite');
});

it('still announces streaming -> sent when both are set within the same task, with no render in between', async () => {
  const el = (await fixture(html`<lr-chat-message status="sending">hi</lr-chat-message>`)) as LyraChatMessage;

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
  const el = (await fixture(html`<lr-chat-message>hi</lr-chat-message>`)) as LyraChatMessage;
  expect((el.shadowRoot!.querySelector('[part="header"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="avatar"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="attachments"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
});

it('shows the header once an avatar is slotted, detected on first paint (not just via slotchange)', async () => {
  const el = (await fixture(
    html`<lr-chat-message><span slot="avatar">A</span>hi</lr-chat-message>`,
  )) as LyraChatMessage;
  expect((el.shadowRoot!.querySelector('[part="header"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="avatar"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
});

it('hides the badges wrapper by default', async () => {
  const el = (await fixture(html`<lr-chat-message>hi</lr-chat-message>`)) as LyraChatMessage;
  expect((el.shadowRoot!.querySelector('[part="badges"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
});

it('shows the header and badges once a badge is slotted, detected on first paint (not just via slotchange)', async () => {
  const el = (await fixture(
    html`<lr-chat-message><span slot="badges">gpt-5.4</span>hi</lr-chat-message>`,
  )) as LyraChatMessage;
  expect((el.shadowRoot!.querySelector('[part="header"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="badges"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
});

it('shows/hides the badges wrapper as badges content is added/removed via slotchange', async () => {
  const el = (await fixture(html`<lr-chat-message>hi</lr-chat-message>`)) as LyraChatMessage;
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
  const el = (await fixture(html`<lr-chat-message>hi</lr-chat-message>`)) as LyraChatMessage;
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

it('renders actions inside the footer, inside the bubble, by default (actionsOutsideBubble unset)', async () => {
  const el = (await fixture(
    html`<lr-chat-message><button slot="actions">Copy</button>hi</lr-chat-message>`,
  )) as LyraChatMessage;
  expect(el.actionsOutsideBubble).to.equal(false);
  const bubble = el.shadowRoot!.querySelector('[part="bubble"]') as HTMLElement;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(bubble.contains(actions)).to.be.true;
  expect(actions.closest('[part="footer"]')).to.exist;
});

it('renders actions as a sibling after the bubble when actionsOutsideBubble is set', async () => {
  const el = (await fixture(
    html`<lr-chat-message actions-outside-bubble
      ><button slot="actions">Copy</button>hi</lr-chat-message
    >`,
  )) as LyraChatMessage;
  expect(el.getAttribute('actions-outside-bubble')).to.equal('');
  const bubble = el.shadowRoot!.querySelector('[part="bubble"]') as HTMLElement;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(bubble.contains(actions)).to.be.false;
  expect(actions.previousElementSibling === bubble || bubble.nextElementSibling === actions).to.be.true;
});

it('keeps the footer hidden when actionsOutsideBubble is set and there is no status/timestamp, even with actions slotted', async () => {
  const el = (await fixture(
    html`<lr-chat-message actions-outside-bubble
      ><button slot="actions">Copy</button>hi</lr-chat-message
    >`,
  )) as LyraChatMessage;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  expect(footer.hasAttribute('hidden')).to.be.true;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(actions.hasAttribute('hidden')).to.be.false;
});

it('shows attachments once slotted', async () => {
  const el = (await fixture(
    html`<lr-chat-message><span slot="attachments">file.png</span>hi</lr-chat-message>`,
  )) as LyraChatMessage;
  expect((el.shadowRoot!.querySelector('[part="attachments"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
});

it('localizes the visible status text via this.localize(), not a hardcoded English map', async () => {
  const el = (await fixture(
    html`<lr-chat-message
      .strings=${{ chatSending: 'Envoi…', chatResponding: 'Réponse…', chatFailedToSend: "Échec de l'envoi" }}
      >hi</lr-chat-message
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
  const el = (await fixture(html`<lr-chat-message>hi</lr-chat-message>`)) as LyraChatMessage;
  el.status = 'sending';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Sending…');
});

it('uses themeable ambient motion for streaming and wraps crowded footer content', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(
    "animation: lr-chat-message-pulse var(--lr-transition-ambient) infinite;",
  );
  expect(css).to.match(/\[part='footer'\]\s*\{[^}]*flex-wrap:\s*wrap;/);
});

it('allows the ambient motion token to retime the streaming indicator', async () => {
  const el = (await fixture(html`
    <lr-chat-message
      status="streaming"
      style="--lr-transition-ambient: 3s linear"
    >hi</lr-chat-message>
  `)) as LyraChatMessage;
  const indicator = el.shadowRoot!.querySelector('[part="status-indicator"]')!;

  expect(getComputedStyle(indicator).animationDuration).to.equal('3s');
  expect(getComputedStyle(indicator).animationTimingFunction).to.equal('linear');
});

it('routes the bubble fill/text through the new role-scoped cssprops, leaving [part="collapse-button"]:hover keyed directly to --lr-color-brand-quiet', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include('--lr-chat-message-bubble-bg: var(--lr-color-surface);');
  expect(css).to.include('--lr-chat-message-bubble-color: var(--lr-color-text);');
  expect(css).to.include('--lr-chat-message-user-bubble-bg: var(--lr-color-brand-quiet);');
  expect(css).to.include('--lr-chat-message-user-bubble-color: var(--lr-color-text);');
  expect(css).to.match(/\[part='bubble'\] \{[^}]*background: var\(--lr-chat-message-bubble-bg\);/);
  expect(css).to.match(/\[part='bubble'\] \{[^}]*color: var\(--lr-chat-message-bubble-color\);/);
  expect(css).to.match(
    /data-role='user'\]\) \[part='bubble'\] \{[^}]*background: var\(--lr-chat-message-user-bubble-bg\);[^}]*color: var\(--lr-chat-message-user-bubble-color\);/,
  );
  // Unrelated consumer of the same shared token this component used to
  // wire the user bubble to directly -- must stay untouched by this change.
  expect(css).to.include(
    "[part='collapse-button']:hover { background: var(--lr-color-brand-quiet); color: var(--lr-color-brand); }",
  );
});

it('defaults the generic bubble fill/text to --lr-color-surface/--lr-color-text, unchanged now that they route through cssprops', async () => {
  const el = (await fixture(html`<lr-chat-message>hi</lr-chat-message>`)) as LyraChatMessage;
  const bubble = el.shadowRoot!.querySelector('[part="bubble"]') as HTMLElement;
  const probe = document.createElement('div');
  probe.style.cssText = 'background: var(--lr-color-surface); color: var(--lr-color-text);';
  el.shadowRoot!.appendChild(probe);

  expect(getComputedStyle(bubble).backgroundColor).to.equal(getComputedStyle(probe).backgroundColor);
  expect(getComputedStyle(bubble).color).to.equal(getComputedStyle(probe).color);
});

it('defaults the user-role bubble fill/text to --lr-color-brand-quiet/--lr-color-text, unchanged now that they route through cssprops', async () => {
  const el = (await fixture(html`<lr-chat-message data-role="user">hi</lr-chat-message>`)) as LyraChatMessage;
  const bubble = el.shadowRoot!.querySelector('[part="bubble"]') as HTMLElement;
  const probe = document.createElement('div');
  probe.style.cssText = 'background: var(--lr-color-brand-quiet); color: var(--lr-color-text);';
  el.shadowRoot!.appendChild(probe);

  expect(getComputedStyle(bubble).backgroundColor).to.equal(getComputedStyle(probe).backgroundColor);
  expect(getComputedStyle(bubble).color).to.equal(getComputedStyle(probe).color);
});

it('retints the generic bubble fill/text via --lr-chat-message-bubble-bg/-color', async () => {
  const el = (await fixture(html`
    <lr-chat-message
      style="--lr-chat-message-bubble-bg: rgb(1, 2, 3); --lr-chat-message-bubble-color: rgb(4, 5, 6);"
    >hi</lr-chat-message>
  `)) as LyraChatMessage;
  const bubble = el.shadowRoot!.querySelector('[part="bubble"]') as HTMLElement;

  expect(getComputedStyle(bubble).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(bubble).color).to.equal('rgb(4, 5, 6)');
});

it('retints the user-role bubble fill/text via --lr-chat-message-user-bubble-bg/-color, independent of the generic pair', async () => {
  const el = (await fixture(html`
    <lr-chat-message
      data-role="user"
      style="
        --lr-chat-message-user-bubble-bg: rgb(7, 8, 9);
        --lr-chat-message-user-bubble-color: rgb(10, 11, 12);
        --lr-chat-message-bubble-bg: rgb(1, 2, 3);
        --lr-chat-message-bubble-color: rgb(4, 5, 6);
      "
    >hi</lr-chat-message>
  `)) as LyraChatMessage;
  const bubble = el.shadowRoot!.querySelector('[part="bubble"]') as HTMLElement;

  expect(getComputedStyle(bubble).backgroundColor).to.equal('rgb(7, 8, 9)');
  expect(getComputedStyle(bubble).color).to.equal('rgb(10, 11, 12)');
});

it('localizes the live-region status-change announcements via this.localize()', async () => {
  const el = (await fixture(
    html`<lr-chat-message .strings=${{ chatFailedAnnounce: 'Échec.', chatCompleteAnnounce: 'Terminé.' }}
      >hi</lr-chat-message
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
  const el = (await fixture(html`<lr-chat-message>A plain message.</lr-chat-message>`)) as LyraChatMessage;
  await expect(el).to.be.accessible();
});

it('is accessible fully populated: avatar, badges, attachments, actions, timestamp, and status="failed"', async () => {
  const el = (await fixture(html`
    <lr-chat-message data-role="user" status="failed" .timestamp=${new Date()} collapsible>
      <span slot="avatar">A</span>
      <span slot="badges">gpt-5.4</span>
      Something went wrong.
      <span slot="attachments">file.png</span>
      <button slot="actions">Copy</button>
    </lr-chat-message>
  `)) as LyraChatMessage;
  await expect(el).to.be.accessible();
});

it('is accessible with actionsOutsideBubble set and actions populated', async () => {
  const el = (await fixture(
    html`<lr-chat-message actions-outside-bubble
      ><button slot="actions">Copy</button>hi</lr-chat-message
    >`,
  )) as LyraChatMessage;
  await expect(el).to.be.accessible();
});

describe('attachments-position', () => {
  it('defaults to "after" -- attachments render after the body in DOM order', async () => {
    const el = (await fixture(html`
      <lr-chat-message><span slot="attachments">file.png</span>Hello</lr-chat-message>
    `)) as LyraChatMessage;
    const bubble = el.shadowRoot!.querySelector('[part="bubble"]')!;
    const parts = Array.from(bubble.children).map((c) => c.getAttribute('part'));
    expect(parts.indexOf('body')).to.be.lessThan(parts.indexOf('attachments'));
  });

  it('renders attachments before the body when attachments-position="before"', async () => {
    const el = (await fixture(html`
      <lr-chat-message attachments-position="before"
        ><span slot="attachments">file.png</span>Hello</lr-chat-message
      >
    `)) as LyraChatMessage;
    const bubble = el.shadowRoot!.querySelector('[part="bubble"]')!;
    const parts = Array.from(bubble.children).map((c) => c.getAttribute('part'));
    expect(parts.indexOf('attachments')).to.be.lessThan(parts.indexOf('body'));
  });

  it('reflects attachments-position onto the property', async () => {
    const el = (await fixture(html`<lr-chat-message attachments-position="before"></lr-chat-message>`)) as LyraChatMessage;
    expect(el.attachmentsPosition).to.equal('before');
  });
});

describe('failure slot', () => {
  it('renders exactly the consumer failure presentation -- not the built-in one -- once populated', async () => {
    const el = (await fixture(html`
      <lr-chat-message status="failed">
        <lr-markdown-core>Message body</lr-markdown-core>
        <div slot="failure" role="alert">
          Send failed
          <button type="button">Retry</button>
        </div>
      </lr-chat-message>
    `)) as LyraChatMessage;

    // Built-in failed UI is suppressed -- there is exactly one failure presentation, the consumer's.
    expect(el.shadowRoot!.querySelector('[part="status-text"]'), 'built-in status text is suppressed').to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="status-indicator"]'), 'built-in status dot is suppressed').to.not
      .exist;
    expect(el.shadowRoot!.querySelector('[part="retry-button"]'), 'built-in retry button is suppressed').to.not
      .exist;

    const slot = el.shadowRoot!.querySelector('slot[name="failure"]') as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    expect(assigned).to.have.lengthOf(1);
    expect(assigned[0].getAttribute('role')).to.equal('alert');
    expect(assigned[0].textContent).to.contain('Send failed');
    expect(assigned[0].querySelector('button')).to.exist;
  });

  it('lets the consumer failure content lay out exactly as authored, without any ::part(failure) override', async () => {
    const el = (await fixture(html`
      <lr-chat-message status="failed">
        <div slot="failure" role="alert" style="display: flex; gap: 4px;">
          Send failed
          <button type="button">Retry</button>
        </div>
      </lr-chat-message>
    `)) as LyraChatMessage;

    const failureContent = el.querySelector('[slot="failure"]') as HTMLElement;
    expect(getComputedStyle(failureContent).display).to.equal('flex');
    // [part="failure"] itself contributes no box (display: contents), so it never constrains or
    // wraps the consumer's own element -- no ::part(failure) reach-through is needed to get there.
    const slotPart = el.shadowRoot!.querySelector('[part="failure"]') as HTMLElement;
    expect(getComputedStyle(slotPart).display).to.equal('contents');
  });

  it('is not present in the DOM at all unless status="failed", regardless of pre-existing slot="failure" content', async () => {
    const el = (await fixture(html`
      <lr-chat-message><div slot="failure" role="alert">Send failed</div>hi</lr-chat-message>
    `)) as LyraChatMessage;
    expect(el.shadowRoot!.querySelector('slot[name="failure"]')).to.not.exist;
    // The status is "sent" -- the content sits inert in the light DOM, unslotted, exactly like any
    // other slot="..." content this component doesn't currently have a matching <slot> for.
    expect((el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement).hasAttribute('hidden')).to.be.true;

    el.status = 'sent';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('slot[name="failure"]')).to.not.exist;
  });

  it('detects pre-existing failure-slot content on first paint when mounting directly into status="failed", not just via slotchange', async () => {
    const el = (await fixture(html`
      <lr-chat-message status="failed"><div slot="failure" role="alert">Send failed</div>hi</lr-chat-message>
    `)) as LyraChatMessage;
    expect(el.shadowRoot!.querySelector('[part="status-text"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="retry-button"]')).to.not.exist;
    const slot = el.shadowRoot!.querySelector('slot[name="failure"]') as HTMLSlotElement;
    expect(slot.assignedElements({ flatten: true })).to.have.lengthOf(1);
  });

  it('detects pre-existing failure-slot content when entering "failed" after mount (not just via slotchange)', async () => {
    const el = (await fixture(html`
      <lr-chat-message><div slot="failure" role="alert">Send failed</div>hi</lr-chat-message>
    `)) as LyraChatMessage;

    el.status = 'failed';
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="status-text"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="retry-button"]')).to.not.exist;
    const slot = el.shadowRoot!.querySelector('slot[name="failure"]') as HTMLSlotElement;
    expect(slot.assignedElements({ flatten: true })).to.have.lengthOf(1);
  });

  it('restores the built-in failed UI via slotchange once failure-slot content is removed', async () => {
    const el = (await fixture(html`
      <lr-chat-message status="failed"><div slot="failure" role="alert">Send failed</div>hi</lr-chat-message>
    `)) as LyraChatMessage;
    expect(el.shadowRoot!.querySelector('[part="status-text"]')).to.not.exist;

    const failureContent = el.querySelector('[slot="failure"]')!;
    el.removeChild(failureContent);
    const slot = el.shadowRoot!.querySelector('slot[name="failure"]') as HTMLSlotElement;
    slot.dispatchEvent(new Event('slotchange'));
    await el.updateComplete;

    expect((el.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement).textContent).to.equal(
      'Failed to send',
    );
    expect(el.shadowRoot!.querySelector('[part="retry-button"]')).to.exist;
  });

  it('suppresses the built-in chatFailedAnnounce live-region announcement once the failure slot is used', async () => {
    const el = (await fixture(html`<lr-chat-message status="streaming">hi</lr-chat-message>`)) as LyraChatMessage;
    const failureContent = document.createElement('div');
    failureContent.slot = 'failure';
    failureContent.setAttribute('role', 'alert');
    failureContent.textContent = 'Send failed';
    el.appendChild(failureContent);

    el.status = 'failed';
    await el.updateComplete;

    expect(liveRegionText(el), 'the host owns announcing its own alert content').to.equal('');
  });

  it('fires lr-retry when a custom failure-slot control dispatches it, same event contract as the built-in retry button', async () => {
    const el = (await fixture(html`
      <lr-chat-message status="failed">
        <div slot="failure" role="alert">
          Send failed
          <button type="button" id="custom-retry">Retry</button>
        </div>
      </lr-chat-message>
    `)) as LyraChatMessage;
    let fired = false;
    el.addEventListener('lr-retry', () => (fired = true));
    const button = el.querySelector('#custom-retry') as HTMLButtonElement;
    button.addEventListener('click', () => {
      button.dispatchEvent(new CustomEvent('lr-retry', { bubbles: true, composed: true }));
    });
    button.click();
    expect(fired).to.be.true;
  });

  it('keeps focus inside the message (never document.body) when a custom failure-slot control clears the failed state', async () => {
    const el = (await fixture(html`
      <lr-chat-message status="failed">
        <div slot="failure" role="alert">
          Send failed
          <button type="button" id="custom-retry">Retry</button>
        </div>
      </lr-chat-message>
    `)) as LyraChatMessage;
    const button = el.querySelector('#custom-retry') as HTMLButtonElement;
    // The documented, expected response to a retry action.
    button.addEventListener('click', () => {
      el.status = 'sent';
    });

    button.focus();
    expect(document.activeElement).to.equal(button);
    button.click();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('slot[name="failure"]'), 'the failure slot is gone once status flips').to
      .not.exist;
    expect(document.activeElement, 'focus must not have silently reverted to <body>').to.not.equal(document.body);
    expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="bubble"]'));
  });

  it('leaves the default (no failure slot) status text, retry button, and live-region announcement byte-identical', async () => {
    const el = (await fixture(html`<lr-chat-message status="streaming">hi</lr-chat-message>`)) as LyraChatMessage;
    el.status = 'failed';
    await el.updateComplete;

    expect((el.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement).textContent).to.equal(
      'Failed to send',
    );
    expect(el.shadowRoot!.querySelector('[part="status-indicator"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="retry-button"]')).to.exist;
    expect(liveRegionText(el)).to.equal('Message failed to send.');
    const region = el.shadowRoot!.querySelector('lr-live-region') as LyraLiveRegion;
    expect(region.mode).to.equal('assertive');
  });

  it('leaves actionsOutsideBubble behavior unaffected when the failure slot is also in use', async () => {
    const el = (await fixture(html`
      <lr-chat-message status="failed" actions-outside-bubble>
        <div slot="failure" role="alert">Send failed</div>
        <button slot="actions">Copy</button>
      </lr-chat-message>
    `)) as LyraChatMessage;
    const bubble = el.shadowRoot!.querySelector('[part="bubble"]') as HTMLElement;
    const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
    expect(bubble.contains(actions)).to.be.false;
    expect(actions.previousElementSibling === bubble || bubble.nextElementSibling === actions).to.be.true;
  });

  it('is accessible with a custom failure-slot alert banner', async () => {
    const el = (await fixture(html`
      <lr-chat-message status="failed">
        Message body
        <div slot="failure" role="alert">
          Send failed
          <button type="button">Retry</button>
        </div>
      </lr-chat-message>
    `)) as LyraChatMessage;
    await expect(el).to.be.accessible();
  });
});

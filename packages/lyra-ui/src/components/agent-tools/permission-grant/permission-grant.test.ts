import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './permission-grant.js';
import type { LyraPermissionGrant } from './permission-grant.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const request = {
  requestId: 'request-7',
  label: 'Read project files',
  description: 'The assistant wants to inspect project files.',
  scope: 'filesystem:project/read',
  status: 'pending' as const,
};

describe('lr-permission-grant', () => {
  it('shows the requested action, caller-supplied scope and pending status', async () => {
    const el = await fixture<LyraPermissionGrant>(html`<lr-permission-grant .requestId=${request.requestId} .label=${request.label} .description=${request.description} .scope=${request.scope} .status=${request.status}></lr-permission-grant>`);
    expect(el.shadowRoot!.querySelector('[part="legend"]')?.textContent).to.equal(request.label);
    expect(el.shadowRoot!.querySelector('[part="scope"]')?.textContent).to.contain(request.scope);
    expect(el.shadowRoot!.querySelector('[part="status"]')?.textContent).to.contain('Pending');
    expect(el.shadowRoot!.querySelectorAll('[part="decision"]')).to.have.lengthOf(3);
  });

  it('emits each explicit decision correlated to the request without changing controlled status', async () => {
    const el = await fixture<LyraPermissionGrant>(html`<lr-permission-grant .requestId=${request.requestId} .label=${request.label} .description=${request.description} .scope=${request.scope} .status=${request.status}></lr-permission-grant>`);
    for (const [index, decision] of ['allow-once', 'allow-session', 'deny'].entries()) {
      el.requestId = `${request.requestId}-${index}`;
      await el.updateComplete;
      const button = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="decision"]')[index]!;
      const emitted = oneEvent(el, 'lr-permission-decision');
      button.click();
      expect((await emitted as CustomEvent).detail).to.deep.equal({ requestId: `${request.requestId}-${index}`, decision });
      expect(el.status).to.equal('pending');
    }
  });

  it('gates actions when disabled and after the host supplies a terminal status', async () => {
    const disabled = await fixture<LyraPermissionGrant>(html`<lr-permission-grant disabled .requestId=${request.requestId} .label=${request.label} .description=${request.description} .scope=${request.scope} .status=${request.status}></lr-permission-grant>`);
    expect([...disabled.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="decision"]')].every((button) => button.disabled)).to.be.true;
    const resolved = await fixture<LyraPermissionGrant>(html`<lr-permission-grant .requestId=${request.requestId} .label=${request.label} .description=${request.description} .scope=${request.scope} .status=${'granted'}></lr-permission-grant>`);
    expect(resolved.shadowRoot!.querySelectorAll('[part="decision"]')).to.have.lengthOf(0);
    expect(resolved.shadowRoot!.querySelector('[part="status"]')?.textContent).to.contain('Approved');
  });

  it('ignores a rendered action if the host changes request identity before the next render', async () => {
    const el = await fixture<LyraPermissionGrant>(html`<lr-permission-grant .requestId=${request.requestId}></lr-permission-grant>`);
    let requests = 0;
    el.addEventListener('lr-permission-decision', () => requests++);
    const stale = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-decision="allow-session"]')!;
    el.requestId = 'request-8';
    stale.click();
    expect(requests).to.equal(0);
    await el.updateComplete;
    const current = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-decision="allow-session"]')!;
    const emitted = oneEvent(el, 'lr-permission-decision');
    current.click();
    expect((await emitted as CustomEvent).detail).to.deep.equal({ requestId: 'request-8', decision: 'allow-session' });
  });

  it('ignores a rendered action if the host replaces the scope before the next render', async () => {
    const el = await fixture<LyraPermissionGrant>(html`<lr-permission-grant .requestId=${request.requestId} .scope=${request.scope}></lr-permission-grant>`);
    let requests = 0;
    el.addEventListener('lr-permission-decision', () => requests++);
    const stale = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-decision="allow-once"]')!;
    el.scope = 'filesystem:other/read';
    stale.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(requests).to.equal(0);
    await el.updateComplete;
    const current = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-decision="allow-once"]')!;
    const emitted = oneEvent(el, 'lr-permission-decision');
    current.click();
    expect((await emitted as CustomEvent).detail).to.deep.equal({ requestId: request.requestId, decision: 'allow-once' });
  });

  it('fails closed for null and non-string runtime request identities', async () => {
    const el = await fixture<LyraPermissionGrant>(html`<lr-permission-grant .requestId=${request.requestId}></lr-permission-grant>`);
    el.requestId = null as unknown as string;
    await el.updateComplete;
    expect([...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="decision"]')].every((button) => button.disabled)).to.be.true;
    el.requestId = 17 as unknown as string;
    await el.updateComplete;
    expect([...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="decision"]')].every((button) => button.disabled)).to.be.true;
  });

  it('blocks synchronous reentrant decisions while allowing a later pending request', async () => {
    const el = await fixture<LyraPermissionGrant>(html`<lr-permission-grant .requestId=${request.requestId}></lr-permission-grant>`);
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-decision="allow-once"]')!;
    let requests = 0;
    el.addEventListener('lr-permission-decision', () => {
      requests++;
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    button.click();
    expect(requests).to.equal(1);
    button.click();
    expect(requests).to.equal(2);
    el.status = 'granted';
    await el.updateComplete;
    el.status = 'pending';
    await el.updateComplete;
    const freshButton = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-decision="allow-once"]')!;
    freshButton.click();
    expect(requests).to.equal(3);
  });

  it('accepts the shared approved spelling, keeps granted as its alias, and reads unknown values as pending', async () => {
    const approved = await fixture<LyraPermissionGrant>(html`<lr-permission-grant request-id="r1" status="approved"></lr-permission-grant>`);
    expect(approved.shadowRoot!.querySelector('[part="status"]')?.textContent).to.equal('Approved');
    expect(approved.shadowRoot!.querySelectorAll('[part="decision"]')).to.have.lengthOf(0);
    const granted = await fixture<LyraPermissionGrant>(html`<lr-permission-grant request-id="r1" status="granted"></lr-permission-grant>`);
    expect(granted.status).to.equal('granted');
    expect(granted.shadowRoot!.querySelector('[part="status"]')?.textContent).to.equal('Approved');
    const unknown = await fixture<LyraPermissionGrant>(html`<lr-permission-grant request-id="r1" status="approvd"></lr-permission-grant>`);
    expect(unknown.status).to.equal('pending');
    expect(unknown.shadowRoot!.querySelector('[part="status"]')?.textContent).to.equal('Pending');
    expect(unknown.shadowRoot!.querySelectorAll('[part="decision"]')).to.have.lengthOf(3);
  });

  it('moves focus to the settled status text when the host settles the request', async () => {
    const el = await fixture<LyraPermissionGrant>(html`<lr-permission-grant .requestId=${request.requestId} .scope=${request.scope}></lr-permission-grant>`);
    const button = el.shadowRoot!.querySelector<HTMLElement>('[data-decision="allow-once"]')!;
    await focusByKeyboard(button);
    el.addEventListener('lr-permission-decision', () => { el.status = 'approved'; }, { once: true });
    button.click();
    await el.updateComplete;
    const status = el.shadowRoot!.querySelector('[part="status"]')!;
    expect(el.shadowRoot!.activeElement === status).to.be.true;
    expect(status.textContent).to.equal('Approved');
  });

  it('themes its decision buttons through the shared button tokens', async () => {
    const el = await fixture<LyraPermissionGrant>(html`<lr-permission-grant style="--lr-button-radius: 7px" .requestId=${request.requestId}></lr-permission-grant>`);
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="decision"]')!.shadowRoot!.querySelector('[part~="base"]')!).borderTopLeftRadius).to.equal('7px');
  });

  it('restores the localized visible label when the label attribute is removed', async () => {
    const el = await fixture<LyraPermissionGrant>(html`<lr-permission-grant label="Custom request"></lr-permission-grant>`);
    expect(el.shadowRoot!.querySelector('[part="legend"]')?.textContent).to.equal('Custom request');
    el.removeAttribute('label');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="legend"]')?.textContent).to.equal('Permission request');
  });

  it('uses host aria-label on the semantic group and localizes action labels', async () => {
    const el = await fixture<LyraPermissionGrant>(html`
      <lr-permission-grant aria-label="Read files permission" .strings=${{ permissionGrantAllowOnce: 'Allow this time' }} .requestId=${request.requestId} .label=${request.label} .description=${request.description} .scope=${request.scope} .status=${request.status}></lr-permission-grant>
    `);
    expect(el.shadowRoot!.querySelector('fieldset')?.getAttribute('aria-label')).to.equal('Read files permission');
    expect(el.shadowRoot!.querySelector('[part="decision"]')?.textContent).to.equal('Allow this time');
  });

  it('is accessible with long content at a narrow allocation', async () => {
    const el = await fixture<LyraPermissionGrant>(html`
      <lr-permission-grant style="inline-size: 320px" .requestId=${request.requestId} .label=${'Long permission label '.repeat(8)} .description=${'A long explanation of the requested operation. '.repeat(12)} .scope=${'remote-resource:'.repeat(14)} .status=${request.status}></lr-permission-grant>
    `);
    await expect(el).to.be.accessible();
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="scope"]')!).overflowWrap).to.equal('anywhere');
    const hostWidth = el.getBoundingClientRect().width;
    const fieldset = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(fieldset.getBoundingClientRect().width).to.be.at.most(hostWidth);
    expect(fieldset.scrollWidth).to.be.at.most(fieldset.clientWidth);
  });
});

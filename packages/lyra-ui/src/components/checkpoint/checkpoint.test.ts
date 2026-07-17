import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './checkpoint.js';
import type { LyraCheckpoint } from './checkpoint.js';

it('defaults to checkpointId="", label="", restorable=true, confirmRestore=true, restoring=false', async () => {
  const el = (await fixture(html`<lyra-checkpoint></lyra-checkpoint>`)) as LyraCheckpoint;
  expect(el.checkpointId).to.equal('');
  expect(el.label).to.equal('');
  expect(el.restorable).to.be.true;
  expect(el.confirmRestore).to.be.true;
  expect(el.restoring).to.be.false;
});

it('falls back to the generic "Checkpoint" label when unset', async () => {
  const el = (await fixture(html`<lyra-checkpoint></lyra-checkpoint>`)) as LyraCheckpoint;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Checkpoint');
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute('aria-label')).to.equal(
    'Checkpoint',
  );
});

it('renders a given label, and root role="group" is named by it', async () => {
  const el = (await fixture(html`<lyra-checkpoint label="Before refactor"></lyra-checkpoint>`)) as LyraCheckpoint;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Before refactor');
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('group');
  expect(base.getAttribute('aria-label')).to.equal('Before refactor');
});

it('renders a formatted timestamp, overridable via formatTimestamp, unset for an invalid string', async () => {
  const ts = new Date('2024-01-01T10:30:00Z');
  const withTs = (await fixture(html`<lyra-checkpoint .timestamp=${ts}></lyra-checkpoint>`)) as LyraCheckpoint;
  const time = withTs.shadowRoot!.querySelector('[part="timestamp"]') as HTMLTimeElement;
  expect(time).to.exist;
  expect(time.getAttribute('datetime')).to.equal(ts.toISOString());

  const custom = (await fixture(html`<lyra-checkpoint></lyra-checkpoint>`)) as LyraCheckpoint;
  custom.formatTimestamp = () => 'CUSTOM';
  custom.timestamp = ts;
  await custom.updateComplete;
  expect(custom.shadowRoot!.querySelector('[part="timestamp"]')!.textContent!.trim()).to.equal('CUSTOM');

  const invalid = (await fixture(html`<lyra-checkpoint></lyra-checkpoint>`)) as LyraCheckpoint;
  invalid.timestamp = 'not-a-date';
  await invalid.updateComplete;
  expect(invalid.shadowRoot!.querySelector('[part="timestamp"]')).to.not.exist;
});

it('renders no restore button when restorable=false, as a plain marker', async () => {
  const el = (await fixture(html`<lyra-checkpoint restorable="false"></lyra-checkpoint>`)) as LyraCheckpoint;
  expect(el.restorable).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="restore-button"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="confirm-group"]')).to.not.exist;
});

it('accepts confirm-restore="false" as a plain-HTML attribute string', async () => {
  const el = (await fixture(html`<lyra-checkpoint confirm-restore="false"></lyra-checkpoint>`)) as LyraCheckpoint;
  expect(el.confirmRestore).to.be.false;
});

it('has an accessible name with context distinct from its visible text', async () => {
  const el = (await fixture(html`<lyra-checkpoint label="Before refactor"></lyra-checkpoint>`)) as LyraCheckpoint;
  const button = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
  expect(button.textContent!.trim()).to.equal('Restore');
  expect(button.getAttribute('aria-label')).to.equal('Restore conversation to Before refactor');
});

describe('restoring state', () => {
  it('shows a spinner and "Restoring…" text, and aria-disabled="true", while restoring', async () => {
    const el = (await fixture(html`<lyra-checkpoint restoring></lyra-checkpoint>`)) as LyraCheckpoint;
    const button = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-disabled')).to.equal('true');
    expect(button.textContent!.trim()).to.equal('Restoring…');
    expect(button.querySelector('svg')).to.exist;
  });

  it('ignores a click while restoring', async () => {
    const el = (await fixture(html`<lyra-checkpoint restoring></lyra-checkpoint>`)) as LyraCheckpoint;
    const button = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
    let fired = false;
    el.addEventListener('lyra-restore', () => (fired = true));
    button.click();
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="confirm-group"]')).to.not.exist;
  });
});

describe('confirm flow (confirmRestore=true, the default)', () => {
  it('swaps to a confirm prompt on Restore click, instead of immediately firing lyra-restore', async () => {
    const el = (await fixture(html`<lyra-checkpoint checkpoint-id="ck_1" label="Before refactor"></lyra-checkpoint>`)) as LyraCheckpoint;
    let fired = false;
    el.addEventListener('lyra-restore', () => (fired = true));
    const button = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
    button.click();
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="restore-button"]')).to.not.exist;
    const group = el.shadowRoot!.querySelector('[part="confirm-group"]') as HTMLElement;
    expect(group).to.exist;
    expect(group.querySelector('[part="confirm-prompt"]')!.textContent!.trim()).to.equal(
      'Restore the conversation to this point?',
    );
    expect(group.querySelector('[part="confirm-button"]')!.textContent!.trim()).to.equal('Confirm');
    expect(group.querySelector('[part="cancel-button"]')!.textContent!.trim()).to.equal('Cancel');
  });

  it('moves focus to the confirm button when the prompt appears', async () => {
    const el = (await fixture(html`<lyra-checkpoint></lyra-checkpoint>`)) as LyraCheckpoint;
    (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    const confirmButton = el.shadowRoot!.querySelector('[part="confirm-button"]') as HTMLButtonElement;
    expect(el.shadowRoot!.activeElement).to.equal(confirmButton);
  });

  it('fires lyra-restore with checkpointId/label on confirm, and reverts the group', async () => {
    const el = (await fixture(html`<lyra-checkpoint checkpoint-id="ck_1" label="Before refactor"></lyra-checkpoint>`)) as LyraCheckpoint;
    (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const firing = oneEvent(el, 'lyra-restore');
    (el.shadowRoot!.querySelector('[part="confirm-button"]') as HTMLButtonElement).click();
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ checkpointId: 'ck_1', label: 'Before refactor' });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="confirm-group"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="restore-button"]')).to.exist;
  });

  it('reverts to the restore button and refocuses it on Cancel click', async () => {
    const el = (await fixture(html`<lyra-checkpoint></lyra-checkpoint>`)) as LyraCheckpoint;
    const restoreButton = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
    restoreButton.click();
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lyra-restore', () => (fired = true));
    (el.shadowRoot!.querySelector('[part="cancel-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="confirm-group"]')).to.not.exist;
    expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="restore-button"]'));
  });

  it('reverts to the restore button and refocuses it on Escape', async () => {
    const el = (await fixture(html`<lyra-checkpoint></lyra-checkpoint>`)) as LyraCheckpoint;
    (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[part="confirm-group"]') as HTMLElement;
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.shadowRoot!.querySelector('[part="confirm-group"]')).to.not.exist;
    expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="restore-button"]'));
  });

  it('reverts silently (no refocus) when focus leaves the confirm group entirely', async () => {
    const el = (await fixture(html`
      <div>
        <lyra-checkpoint></lyra-checkpoint>
        <button id="outside">Outside</button>
      </div>
    `)) as HTMLElement;
    const checkpoint = el.querySelector('lyra-checkpoint') as LyraCheckpoint;
    (checkpoint.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    await checkpoint.updateComplete;
    const group = checkpoint.shadowRoot!.querySelector('[part="confirm-group"]') as HTMLElement;
    const outside = el.querySelector('#outside') as HTMLButtonElement;
    group.dispatchEvent(new FocusEvent('focusout', { relatedTarget: outside }));
    await checkpoint.updateComplete;
    expect(checkpoint.shadowRoot!.querySelector('[part="confirm-group"]')).to.not.exist;
    // No forced refocus -- the browser's natural focus target (outside) is left alone.
    expect(checkpoint.shadowRoot!.activeElement).to.not.equal(checkpoint.shadowRoot!.querySelector('[part="restore-button"]'));
  });
});

describe('confirmRestore=false', () => {
  it('fires lyra-restore immediately on Restore click, with no confirm swap at all', async () => {
    const el = (await fixture(
      html`<lyra-checkpoint checkpoint-id="ck_2" label="Snapshot" confirm-restore="false"></lyra-checkpoint>`,
    )) as LyraCheckpoint;
    const firing = oneEvent(el, 'lyra-restore');
    (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ checkpointId: 'ck_2', label: 'Snapshot' });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="confirm-group"]')).to.not.exist;
  });
});

it('renders default-slotted supplemental content under the marker row', async () => {
  const el = (await fixture(
    html`<lyra-checkpoint>Two files changed since this point.</lyra-checkpoint>`,
  )) as LyraCheckpoint;
  expect(el.shadowRoot!.querySelector('slot:not([name])')).to.exist;
});

it('is accessible in the resting state', async () => {
  const el = (await fixture(html`<lyra-checkpoint label="Before refactor"></lyra-checkpoint>`)) as LyraCheckpoint;
  await expect(el).to.be.accessible();
});

it('is accessible mid-confirm', async () => {
  const el = (await fixture(html`<lyra-checkpoint label="Before refactor"></lyra-checkpoint>`)) as LyraCheckpoint;
  (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible non-restorable', async () => {
  const el = (await fixture(html`<lyra-checkpoint label="Before refactor" restorable="false"></lyra-checkpoint>`)) as LyraCheckpoint;
  await expect(el).to.be.accessible();
});

import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './checkpoint.js';
import type { LyraCheckpoint } from './checkpoint.js';

it('defaults to checkpointId="", label="", restorable=true, confirmRestore=true, restoring=false', async () => {
  const el = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
  expect(el.checkpointId).to.equal('');
  expect(el.label).to.equal('');
  expect(el.restorable).to.be.true;
  expect(el.confirmRestore).to.be.true;
  expect(el.restoring).to.be.false;
});

it('falls back to the generic "Checkpoint" label when unset', async () => {
  const el = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Checkpoint');
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute('aria-label')).to.equal(
    'Checkpoint',
  );
});

it('renders a given label, and root role="group" is named by it', async () => {
  const el = (await fixture(html`<lr-checkpoint label="Before refactor"></lr-checkpoint>`)) as LyraCheckpoint;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Before refactor');
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('group');
  expect(base.getAttribute('aria-label')).to.equal('Before refactor');
});

it('renders a formatted timestamp, overridable via formatTimestamp, unset for an invalid string', async () => {
  const ts = new Date('2024-01-01T10:30:00Z');
  const withTs = (await fixture(html`<lr-checkpoint .timestamp=${ts}></lr-checkpoint>`)) as LyraCheckpoint;
  const time = withTs.shadowRoot!.querySelector('[part="timestamp"]') as HTMLTimeElement;
  expect((time) != null).to.equal(true);
  expect(time.getAttribute('datetime')).to.equal(ts.toISOString());

  const custom = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
  custom.formatTimestamp = () => 'CUSTOM';
  custom.timestamp = ts;
  await custom.updateComplete;
  expect(custom.shadowRoot!.querySelector('[part="timestamp"]')!.textContent!.trim()).to.equal('CUSTOM');

  const invalid = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
  invalid.timestamp = 'not-a-date';
  await invalid.updateComplete;
  expect((invalid.shadowRoot!.querySelector('[part="timestamp"]')) == null).to.be.true;
});

it('renders no restore button when restorable=false, as a plain marker', async () => {
  const el = (await fixture(html`<lr-checkpoint restorable="false"></lr-checkpoint>`)) as LyraCheckpoint;
  expect(el.restorable).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="restore-button"]')) == null).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="confirm-group"]')) == null).to.be.true;
});

it('accepts confirm-restore="false" as a plain-HTML attribute string', async () => {
  const el = (await fixture(html`<lr-checkpoint confirm-restore="false"></lr-checkpoint>`)) as LyraCheckpoint;
  expect(el.confirmRestore).to.be.false;
});

it('has an accessible name with context distinct from its visible text', async () => {
  const el = (await fixture(html`<lr-checkpoint label="Before refactor"></lr-checkpoint>`)) as LyraCheckpoint;
  const button = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
  expect(button.textContent!.trim()).to.equal('Restore');
  expect(button.getAttribute('aria-label')).to.equal('Restore conversation to Before refactor');
});

it('preserves an explicitly empty host aria-label on the semantic group', async () => {
  const el = (await fixture(html`<lr-checkpoint aria-label="" label="Visible checkpoint"></lr-checkpoint>`)) as LyraCheckpoint;
  const group = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(group.getAttribute('aria-label')).to.equal('');
});

describe('restoring state', () => {
  it('shows a spinner and "Restoring…" text, and aria-disabled="true", while restoring', async () => {
    const el = (await fixture(html`<lr-checkpoint restoring></lr-checkpoint>`)) as LyraCheckpoint;
    const button = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-disabled')).to.equal('true');
    expect(button.textContent!.trim()).to.equal('Restoring…');
    expect((button.querySelector('svg')) != null).to.equal(true);
  });

  it('renders aria-disabled="false" (not omitted) on the restore button when not restoring', async () => {
    const el = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
    const button = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-disabled')).to.equal('false');
  });

  it('ignores a click while restoring', async () => {
    const el = (await fixture(html`<lr-checkpoint restoring></lr-checkpoint>`)) as LyraCheckpoint;
    const button = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
    let fired = false;
    el.addEventListener('lr-restore', () => (fired = true));
    button.click();
    await el.updateComplete;
    expect(fired).to.be.false;
    expect((el.shadowRoot!.querySelector('[part="confirm-group"]')) == null).to.be.true;
  });

  it('dims the restore button with the shared disabled-opacity token', async () => {
    const el = (await fixture(html`<lr-checkpoint restoring></lr-checkpoint>`)) as LyraCheckpoint;
    const button = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
    const expected = getComputedStyle(el).getPropertyValue('--lr-opacity-disabled').trim();
    expect(expected).to.not.equal('');
    expect(getComputedStyle(button).opacity).to.equal(expected);
  });

  it('exposes --lr-checkpoint-spin-duration to retheme the spinner rotation period', async () => {
    const el = (await fixture(
      html`<lr-checkpoint restoring style="--lr-checkpoint-spin-duration: 3s"></lr-checkpoint>`,
    )) as LyraCheckpoint;
    const svg = el.shadowRoot!.querySelector('.restore-spinner svg') as SVGElement;
    expect(getComputedStyle(svg).animationDuration).to.equal('3s');
  });

  it('inherits the shared ambient timing token when its spinner duration is not overridden', async () => {
    const el = (await fixture(
      html`<lr-checkpoint restoring style="--lr-transition-ambient: 2.4s linear"></lr-checkpoint>`,
    )) as LyraCheckpoint;
    const svg = el.shadowRoot!.querySelector('.restore-spinner svg') as SVGElement;
    const style = getComputedStyle(svg);
    expect(style.animationDuration).to.equal('2.4s');
    expect(style.animationTimingFunction).to.equal('linear');
  });
});

describe('confirm flow (confirmRestore=true, the default)', () => {
  it('swaps to a confirm prompt on Restore click, instead of immediately firing lr-restore', async () => {
    const el = (await fixture(html`<lr-checkpoint checkpoint-id="ck_1" label="Before refactor"></lr-checkpoint>`)) as LyraCheckpoint;
    let fired = false;
    el.addEventListener('lr-restore', () => (fired = true));
    const button = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
    button.click();
    await el.updateComplete;
    expect(fired).to.be.false;
    expect((el.shadowRoot!.querySelector('[part="restore-button"]')) == null).to.be.true;
    const group = el.shadowRoot!.querySelector('[part="confirm-group"]') as HTMLElement;
    expect((group) != null).to.equal(true);
    expect(group.querySelector('[part="confirm-prompt"]')!.textContent!.trim()).to.equal(
      'Restore the conversation to this point?',
    );
    expect(group.querySelector('[part="confirm-button"]')!.textContent!.trim()).to.equal('Confirm');
    expect(group.querySelector('[part="cancel-button"]')!.textContent!.trim()).to.equal('Cancel');
  });

  it('moves focus to the confirm button when the prompt appears', async () => {
    const el = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
    (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    const confirmButton = el.shadowRoot!.querySelector('[part="confirm-button"]') as HTMLButtonElement;
    expect((el.shadowRoot!.activeElement) === (confirmButton)).to.equal(true);
    const prompt = el.shadowRoot!.querySelector('[part="confirm-prompt"]') as HTMLElement;
    expect(confirmButton.getAttribute('aria-describedby')).to.equal(prompt.id);
    expect(
      (el.shadowRoot!.querySelector('[part="cancel-button"]') as HTMLButtonElement).getAttribute(
        'aria-describedby',
      ),
    ).to.equal(prompt.id);
  });

  it('abandons confirmation when configuration becomes incompatible', async () => {
    const cases: Array<(element: LyraCheckpoint) => void> = [
      (element) => {
        element.restorable = false;
      },
      (element) => {
        element.confirmRestore = false;
      },
      (element) => {
        element.restoring = true;
      },
    ];

    for (const mutate of cases) {
      const el = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
      (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
      await el.updateComplete;
      mutate(el);
      await el.updateComplete;
      expect((el.shadowRoot!.querySelector('[part="confirm-group"]')) == null).to.equal(true);
    }
  });

  it('resets confirmation across disconnect/reconnect and cancels deferred focus', async () => {
    const wrapper = (await fixture(html`<div><lr-checkpoint></lr-checkpoint></div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-checkpoint') as LyraCheckpoint;
    (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    wrapper.removeChild(el);
    wrapper.appendChild(el);
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect((el.shadowRoot!.querySelector('[part="confirm-group"]')) == null).to.equal(true);
    expect((el.shadowRoot!.activeElement) == null).to.equal(true);
  });

  it('does not emit a second restore when restoring becomes true before the confirm handler', async () => {
    const el = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
    (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    let count = 0;
    el.addEventListener('lr-restore', () => count++);
    const confirm = el.shadowRoot!.querySelector('[part="confirm-button"]') as HTMLButtonElement;
    confirm.addEventListener('click', () => {
      el.restoring = true;
    }, { capture: true });
    confirm.click();
    await el.updateComplete;
    expect(count).to.equal(0);
    expect((el.shadowRoot!.querySelector('[part="confirm-group"]')) == null).to.equal(true);
  });

  it('fires lr-restore with checkpointId/label on confirm, and reverts the group', async () => {
    const el = (await fixture(html`<lr-checkpoint checkpoint-id="ck_1" label="Before refactor"></lr-checkpoint>`)) as LyraCheckpoint;
    (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const firing = oneEvent(el, 'lr-restore');
    (el.shadowRoot!.querySelector('[part="confirm-button"]') as HTMLButtonElement).click();
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ checkpointId: 'ck_1', label: 'Before refactor' });
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="confirm-group"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="restore-button"]')).to.exist;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part')).to.equal('restore-button');
  });

  it('reverts to the restore button and refocuses it on Cancel click', async () => {
    const el = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
    const restoreButton = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
    restoreButton.click();
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-restore', () => (fired = true));
    (el.shadowRoot!.querySelector('[part="cancel-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    expect(fired).to.be.false;
    expect((el.shadowRoot!.querySelector('[part="confirm-group"]')) == null).to.be.true;
    expect((el.shadowRoot!.activeElement) === (el.shadowRoot!.querySelector('[part="restore-button"]'))).to.equal(true);
  });

  it('reverts to the restore button and refocuses it on Escape', async () => {
    const el = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
    (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[part="confirm-group"]') as HTMLElement;
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    expect((el.shadowRoot!.querySelector('[part="confirm-group"]')) == null).to.be.true;
    expect((el.shadowRoot!.activeElement) === (el.shadowRoot!.querySelector('[part="restore-button"]'))).to.equal(true);
  });

  it('reverts silently (no refocus) when focus leaves the confirm group entirely', async () => {
    const el = (await fixture(html`
      <div>
        <lr-checkpoint></lr-checkpoint>
        <button id="outside">Outside</button>
      </div>
    `)) as HTMLElement;
    const checkpoint = el.querySelector('lr-checkpoint') as LyraCheckpoint;
    (checkpoint.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    await checkpoint.updateComplete;
    const group = checkpoint.shadowRoot!.querySelector('[part="confirm-group"]') as HTMLElement;
    const outside = el.querySelector('#outside') as HTMLButtonElement;
    group.dispatchEvent(new FocusEvent('focusout', { relatedTarget: outside }));
    await checkpoint.updateComplete;
    expect((checkpoint.shadowRoot!.querySelector('[part="confirm-group"]')) == null).to.be.true;
    // No forced refocus -- the browser's natural focus target (outside) is left alone.
    expect((checkpoint.shadowRoot!.activeElement) !== (checkpoint.shadowRoot!.querySelector('[part="restore-button"]'))).to.equal(true);
  });

  it('gives confirm-button and cancel-button a visible hover treatment', async () => {
    const el = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
    (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const buttons = [
      el.shadowRoot!.querySelector('[part="confirm-button"]') as HTMLButtonElement,
      el.shadowRoot!.querySelector('[part="cancel-button"]') as HTMLButtonElement,
    ];

    try {
      for (const button of buttons) {
        await resetMouse();
        const resting = getComputedStyle(button).backgroundColor;
        const rect = button.getBoundingClientRect();
        expect(rect.width, `${button.textContent!.trim()} has real geometry to point at`).to.be.greaterThan(0);
        await sendMouse({
          type: 'move',
          position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
        });
        expect(getComputedStyle(button).backgroundColor, `${button.textContent!.trim()} hover changes its fill`).to.not.equal(resting);
      }
    } finally {
      await resetMouse();
    }
  });
});

it('forwards host click to Restore only while the primary action is available', async () => {
  const immediate = (await fixture(
    html`<lr-checkpoint confirm-restore="false"></lr-checkpoint>`,
  )) as LyraCheckpoint;
  let count = 0;
  immediate.addEventListener('lr-restore', () => count++);
  immediate.click();
  expect(count).to.equal(1);

  immediate.restoring = true;
  immediate.click();
  immediate.restoring = false;
  immediate.restorable = false;
  immediate.click();
  expect(count).to.equal(1);

  const confirming = (await fixture(html`<lr-checkpoint></lr-checkpoint>`)) as LyraCheckpoint;
  confirming.click();
  await confirming.updateComplete;
  expect((confirming.shadowRoot!.querySelector('[part="confirm-group"]')) != null).to.equal(true);
  confirming.click();
  expect(count).to.equal(1);
});

describe('confirmRestore=false', () => {
  it('fires lr-restore immediately on Restore click, with no confirm swap at all', async () => {
    const el = (await fixture(
      html`<lr-checkpoint checkpoint-id="ck_2" label="Snapshot" confirm-restore="false"></lr-checkpoint>`,
    )) as LyraCheckpoint;
    const firing = oneEvent(el, 'lr-restore');
    (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ checkpointId: 'ck_2', label: 'Snapshot' });
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="confirm-group"]')) == null).to.be.true;
  });
});

it('renders default-slotted supplemental content under the marker row', async () => {
  const el = (await fixture(
    html`<lr-checkpoint>Two files changed since this point.</lr-checkpoint>`,
  )) as LyraCheckpoint;
  expect(el.shadowRoot!.querySelector('slot:not([name])')).to.exist;
});

it('honors strings overrides in the visible label and restore controls', async () => {
  const el = (await fixture(html`
    <lr-checkpoint
      .strings=${{
        checkpointLabel: 'Point de reprise',
        checkpointRestore: 'Restaurer',
        checkpointRestoreWithContext: 'Restaurer vers {label}',
      }}
    ></lr-checkpoint>
  `)) as LyraCheckpoint;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Point de reprise');
  const button = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
  expect(button.textContent!.trim()).to.equal('Restaurer');
  expect(button.getAttribute('aria-label')).to.equal('Restaurer vers Point de reprise');
});

it('is accessible in the resting state', async () => {
  const el = (await fixture(html`<lr-checkpoint label="Before refactor"></lr-checkpoint>`)) as LyraCheckpoint;
  await expect(el).to.be.accessible();
});

it('is accessible mid-confirm', async () => {
  const el = (await fixture(html`<lr-checkpoint label="Before refactor"></lr-checkpoint>`)) as LyraCheckpoint;
  (el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible non-restorable', async () => {
  const el = (await fixture(html`<lr-checkpoint label="Before refactor" restorable="false"></lr-checkpoint>`)) as LyraCheckpoint;
  await expect(el).to.be.accessible();
});

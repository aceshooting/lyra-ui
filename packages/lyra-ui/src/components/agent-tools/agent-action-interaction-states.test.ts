import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../test/wtr-mouse.js';
import '../lr-permission-grant.js';
import '../lr-connector-manager.js';
import '../lr-background-runs.js';
import '../lr-message-parts.js';
import '../lr-stream-status.js';
import type { MessagePart } from '../../ai/types.js';
import { setForcedColors } from '../../../test/wtr-media.js';
import { agentActionButtonStyles } from './agent-action-button.styles.js';

async function assertHoverAndPress(
  button: HTMLButtonElement,
  hoverVariable: string,
  activeVariable: string,
  styleHost: HTMLElement = button,
): Promise<void> {
  // Deterministic fills make this assertion independent of the test runner's active color scheme.
  styleHost.style.setProperty(hoverVariable, 'rgb(220 230 240)');
  styleHost.style.setProperty(activeVariable, 'rgb(200 210 220)');
  const resting = getComputedStyle(button).backgroundColor;
  try {
    await hoverUntilMatched(button, `${button.getAttribute('part')} button receives hover`);
    await waitUntil(() => getComputedStyle(button).backgroundColor !== resting,
      'the hover background is rendered');
    const hovered = getComputedStyle(button).backgroundColor;

    await sendMouse({ type: 'down' });
    await waitUntil(() => button.matches(':active') && getComputedStyle(button).backgroundColor !== hovered,
      'the pressed background is rendered');
  } finally {
    await resetMouse();
  }
}

/** A composed `<lr-button>`: the rendered control is its inner base, themed through `--lr-button-*`. */
async function assertComposedButtonHoverAndPress(host: HTMLElement): Promise<void> {
  await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  const base = host.shadowRoot!.querySelector<HTMLButtonElement>('[part~="base"]')!;
  await assertHoverAndPress(base, '--lr-button-hover-bg', '--lr-button-active-bg', host);
}

describe('agent action interaction states', () => {
  it('renders hover and pressed states for permission, connector, and run actions', async () => {
    const permission = await fixture<HTMLElement>(html`<lr-permission-grant request-id="permission"></lr-permission-grant>`);
    const connector = await fixture<HTMLElement>(html`<lr-connector-manager .connectors=${[
      { id: 'files', name: 'Files', kind: 'mcp', status: 'disconnected' },
    ]}></lr-connector-manager>`);
    const runs = await fixture<HTMLElement>(html`<lr-background-runs .runs=${[
      { id: 'build', label: 'Build', status: 'running' },
    ]}></lr-background-runs>`);

    await assertComposedButtonHoverAndPress(permission.shadowRoot!.querySelector<HTMLElement>('[part="decision"]')!);
    await assertComposedButtonHoverAndPress(connector.shadowRoot!.querySelector<HTMLElement>('[part="action"]')!);
    await assertHoverAndPress(runs.shadowRoot!.querySelector<HTMLButtonElement>('[part="open"]')!, '--_lr-background-runs-action-hover-bg', '--_lr-background-runs-action-active-bg');
  });

  it('renders hover and pressed states for resumable conversation actions', async () => {
    const part: MessagePart = {
      id: 'partial', type: 'text', text: 'Partial answer', state: 'interrupted',
      interruption: { resumable: true, reason: 'Connection interrupted' },
    };
    const message = await fixture<HTMLElement>(html`<lr-message-parts .parts=${[part]}></lr-message-parts>`);
    const stream = await fixture<HTMLElement>(html`<lr-stream-status connection-state="interrupted" resumable></lr-stream-status>`);

    await assertComposedButtonHoverAndPress(message.shadowRoot!.querySelector<HTMLElement>('[part~="resume"]')!);
    await assertComposedButtonHoverAndPress(stream.shadowRoot!.querySelector<HTMLElement>('[part="resume"]')!);
  });
});

it('gives a pressed shared action a system-colour state under forced colors', async () => {
  const root = await fixture<HTMLDivElement>(html`<div>
    <style>${agentActionButtonStyles.cssText}</style>
    <button data-agent-action="filter" aria-pressed="true" id="on">On</button>
    <button data-agent-action="filter" aria-pressed="false" id="off">Off</button>
  </div>`);
  try {
    await setForcedColors('active');
  } catch {
    return;
  }
  try {
    if (!matchMedia('(forced-colors: active)').matches) return;
    const on = getComputedStyle(root.querySelector('#on')!);
    const off = getComputedStyle(root.querySelector('#off')!);
    // The fill eases into the system colour, so wait for the transition to land.
    await waitUntil(() => on.backgroundColor !== off.backgroundColor, 'the pressed action takes a system fill');
    expect(on.outlineStyle).to.equal('solid');
  } finally {
    await setForcedColors('none');
  }
});

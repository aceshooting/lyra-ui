import { fixture, expect, html } from '@open-wc/testing';
import './handoff-divider.js';
import type { LyraHandoffDivider } from './handoff-divider.js';

async function getLiveRegionText(el: LyraHandoffDivider): Promise<string> {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return el.shadowRoot!.querySelector('lyra-live-region')!.shadowRoot!.querySelector('[part="region"]')!
    .textContent!;
}

it('defaults to agent="", fromAgent="", label=""', async () => {
  const el = (await fixture(html`<lyra-handoff-divider></lyra-handoff-divider>`)) as LyraHandoffDivider;
  expect(el.agent).to.equal('');
  expect(el.fromAgent).to.equal('');
  expect(el.label).to.equal('');
});

it('falls back to the generic "Agent handoff" label when nothing is set', async () => {
  const el = (await fixture(html`<lyra-handoff-divider></lyra-handoff-divider>`)) as LyraHandoffDivider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Agent handoff');
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Agent handoff');
});

it('renders "Transferred to {agent}" when only agent is set', async () => {
  const el = (await fixture(html`<lyra-handoff-divider agent="Research Agent"></lyra-handoff-divider>`)) as LyraHandoffDivider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Transferred to Research Agent');
});

it('renders "Transferred from {from} to {to}" when both from-agent and agent are set', async () => {
  const el = (await fixture(
    html`<lyra-handoff-divider from-agent="Planner" agent="Research Agent"></lyra-handoff-divider>`,
  )) as LyraHandoffDivider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Transferred from Planner to Research Agent');
});

it('lets an explicit label override win over the computed agent-based text', async () => {
  const el = (await fixture(
    html`<lyra-handoff-divider agent="Research Agent" label="Custom handoff text"></lyra-handoff-divider>`,
  )) as LyraHandoffDivider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Custom handoff text');
});

it('is role="separator" with aria-orientation="horizontal", and the visual chip is aria-hidden', async () => {
  const el = (await fixture(html`<lyra-handoff-divider agent="Research Agent"></lyra-handoff-divider>`)) as LyraHandoffDivider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('separator');
  expect(base.getAttribute('aria-orientation')).to.equal('horizontal');
  expect(el.shadowRoot!.querySelector('[part="chip"]')!.getAttribute('aria-hidden')).to.equal('true');
});

it('carries the full label on the chip title attribute for a truncated-text tooltip', async () => {
  const el = (await fixture(html`<lyra-handoff-divider agent="Research Agent"></lyra-handoff-divider>`)) as LyraHandoffDivider;
  expect(el.shadowRoot!.querySelector('[part="chip"]')!.getAttribute('title')).to.equal('Transferred to Research Agent');
});

describe('avatar slot', () => {
  it('hides the avatar wrapper until something is slotted', async () => {
    const el = (await fixture(html`<lyra-handoff-divider agent="Research Agent"></lyra-handoff-divider>`)) as LyraHandoffDivider;
    expect((el.shadowRoot!.querySelector('[part="avatar"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  });

  it('shows the avatar wrapper once content is slotted', async () => {
    const el = (await fixture(
      html`<lyra-handoff-divider agent="Research Agent"><span slot="avatar">RA</span></lyra-handoff-divider>`,
    )) as LyraHandoffDivider;
    expect((el.shadowRoot!.querySelector('[part="avatar"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
  });
});

describe('mount-time announcement', () => {
  it('announces the computed label once on first connect', async () => {
    const el = (await fixture(html`<lyra-handoff-divider agent="Research Agent"></lyra-handoff-divider>`)) as LyraHandoffDivider;
    expect(await getLiveRegionText(el)).to.equal('Transferred to Research Agent');
  });

  it('never re-announces on a later property change', async () => {
    const el = (await fixture(html`<lyra-handoff-divider agent="Research Agent"></lyra-handoff-divider>`)) as LyraHandoffDivider;
    await getLiveRegionText(el);
    el.agent = 'Planner Agent';
    await el.updateComplete;
    // The live region's own text should still reflect the FIRST (mount-time) announcement, not
    // the later property change.
    expect(await getLiveRegionText(el)).to.equal('Transferred to Research Agent');
  });
});

it('is accessible with no agent set', async () => {
  const el = (await fixture(html`<lyra-handoff-divider></lyra-handoff-divider>`)) as LyraHandoffDivider;
  await expect(el).to.be.accessible();
});

it('is accessible with a full from/to handoff and a slotted avatar', async () => {
  const el = (await fixture(html`
    <lyra-handoff-divider from-agent="Planner" agent="Research Agent">
      <span slot="avatar" aria-hidden="true">RA</span>
    </lyra-handoff-divider>
  `)) as LyraHandoffDivider;
  await expect(el).to.be.accessible();
});

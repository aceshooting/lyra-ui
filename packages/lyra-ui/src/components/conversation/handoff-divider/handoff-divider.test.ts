import { fixture, expect, html } from '@open-wc/testing';
import './handoff-divider.js';
import type { LyraHandoffDivider } from './handoff-divider.js';

it('defaults to toAgent="", fromAgent="", label=""', async () => {
  const el = (await fixture(html`<lr-handoff-divider></lr-handoff-divider>`)) as LyraHandoffDivider;
  expect(el.toAgent).to.equal('');
  expect(el.fromAgent).to.equal('');
  expect(el.label).to.equal('');
});

it('falls back to the generic "Agent handoff" label when nothing is set', async () => {
  const el = (await fixture(html`<lr-handoff-divider></lr-handoff-divider>`)) as LyraHandoffDivider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Agent handoff');
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Agent handoff');
});

it('renders "Transferred to {agent}" when only to-agent is set', async () => {
  const el = (await fixture(html`<lr-handoff-divider to-agent="Research Agent"></lr-handoff-divider>`)) as LyraHandoffDivider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Transferred to Research Agent');
});

it('renders "Transferred from {from} to {to}" when both from-agent and to-agent are set', async () => {
  const el = (await fixture(
    html`<lr-handoff-divider from-agent="Planner" to-agent="Research Agent"></lr-handoff-divider>`,
  )) as LyraHandoffDivider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Transferred from Planner to Research Agent');
});

it('lets an explicit label override win over the computed agent-based text', async () => {
  const el = (await fixture(
    html`<lr-handoff-divider to-agent="Research Agent" label="Custom handoff text"></lr-handoff-divider>`,
  )) as LyraHandoffDivider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Custom handoff text');
});

it('is role="separator" with aria-orientation="horizontal", and the visual chip is aria-hidden', async () => {
  const el = (await fixture(html`<lr-handoff-divider to-agent="Research Agent"></lr-handoff-divider>`)) as LyraHandoffDivider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('separator');
  expect(base.getAttribute('aria-orientation')).to.equal('horizontal');
  expect(el.shadowRoot!.querySelector('[part="chip"]')!.getAttribute('aria-hidden')).to.equal('true');
});

it('carries the full label on the chip title attribute for a truncated-text tooltip', async () => {
  const el = (await fixture(html`<lr-handoff-divider to-agent="Research Agent"></lr-handoff-divider>`)) as LyraHandoffDivider;
  expect(el.shadowRoot!.querySelector('[part="chip"]')!.getAttribute('title')).to.equal('Transferred to Research Agent');
});

describe('avatar slot', () => {
  it('hides the avatar wrapper until something is slotted', async () => {
    const el = (await fixture(html`<lr-handoff-divider to-agent="Research Agent"></lr-handoff-divider>`)) as LyraHandoffDivider;
    expect((el.shadowRoot!.querySelector('[part="avatar"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  });

  it('shows the avatar wrapper once content is slotted', async () => {
    const el = (await fixture(
      html`<lr-handoff-divider to-agent="Research Agent"><span slot="avatar">RA</span></lr-handoff-divider>`,
    )) as LyraHandoffDivider;
    expect((el.shadowRoot!.querySelector('[part="avatar"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
  });
});

it('stays silent on mount, like the transcript around it', async () => {
  const el = (await fixture(html`<lr-handoff-divider to-agent="Research Agent"></lr-handoff-divider>`)) as LyraHandoffDivider;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const region = el.shadowRoot!.querySelector('lr-live-region')?.shadowRoot?.querySelector('[part="region"]');
  expect(region?.textContent ?? '').to.equal('');
});

it('names the separator with a host aria-label, including an empty one', async () => {
  const el = (await fixture(html`
    <lr-handoff-divider aria-label="Control passed to the escalation team" to-agent="Research Agent"></lr-handoff-divider>
  `)) as LyraHandoffDivider;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('aria-label')).to.equal('Control passed to the escalation team');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('');
});

describe('localization', () => {
  it('localizes the agent-only computed label (handoffToAgent) via .strings', async () => {
    const el = (await fixture(html`
      <lr-handoff-divider to-agent="Research Agent" .strings=${{ handoffToAgent: 'Transféré à {agent}' }}></lr-handoff-divider>
    `)) as LyraHandoffDivider;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Transféré à Research Agent');
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Transféré à Research Agent');
  });

  it('localizes the from/to computed label (handoffFromToAgent) via .strings', async () => {
    const el = (await fixture(html`
      <lr-handoff-divider
        from-agent="Planner"
        to-agent="Research Agent"
        .strings=${{ handoffFromToAgent: 'Transféré de {from} à {to}' }}
      ></lr-handoff-divider>
    `)) as LyraHandoffDivider;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Transféré de Planner à Research Agent');
  });

  it('localizes the generic fallback label (handoffLabel) via .strings', async () => {
    const el = (await fixture(html`
      <lr-handoff-divider .strings=${{ handoffLabel: 'Transfert de contrôle' }}></lr-handoff-divider>
    `)) as LyraHandoffDivider;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Transfert de contrôle');
  });
});

it('is accessible with no agent set', async () => {
  const el = (await fixture(html`<lr-handoff-divider></lr-handoff-divider>`)) as LyraHandoffDivider;
  await expect(el).to.be.accessible();
});

it('is accessible with a full from/to handoff and a slotted avatar', async () => {
  const el = (await fixture(html`
    <lr-handoff-divider from-agent="Planner" to-agent="Research Agent">
      <span slot="avatar" aria-hidden="true">RA</span>
    </lr-handoff-divider>
  `)) as LyraHandoffDivider;
  await expect(el).to.be.accessible();
});

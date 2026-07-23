import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './agent-run.js';
import type { LyraAgentRun } from './agent-run.js';
import type { LyraGenerationStatus } from '../../conversation/generation-status/generation-status.js';
import type { LyraTaskList } from '../task-list/task-list.js';
import type { AgentRun, AgentStep, AgentStatusKind, CancelEventDetail, RetryEventDetail } from '../../../ai/types.js';
import { styles } from './agent-run.styles.js';

function makeRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 'run-1',
    status: { kind: 'running' },
    startedAt: Date.now() - 5000,
    steps: [],
    ...overrides,
  };
}

const steps: AgentStep[] = [
  { id: 'step-1', kind: 'tool', label: 'Search the web', status: { kind: 'done' } },
  { id: 'step-2', kind: 'tool', label: 'Read repository', status: { kind: 'running' } },
  { id: 'step-3', kind: 'tool', label: 'Write summary', status: { kind: 'idle' } },
];

async function getLiveRegionText(el: LyraAgentRun): Promise<string> {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!.textContent!;
}

it('defaults to run=null, showCancel=true, showRetry=true, and renders the shared empty state', async () => {
  const el = (await fixture(html`<lr-agent-run></lr-agent-run>`)) as LyraAgentRun;
  expect(el.run).to.be.null;
  expect(el.showCancel).to.be.true;
  expect(el.showRetry).to.be.true;
  const empty = el.shadowRoot!.querySelector('[part="empty"]');
  expect(empty).to.exist;
  expect(empty!.getAttribute('heading')).to.equal('No data');
  expect(el.shadowRoot!.querySelector('[part="header"]')).to.not.exist;
});

it('renders a lifecycle-status badge with the built-in generic labels for running/error', async () => {
  const running = (await fixture(
    html`<lr-agent-run .run=${makeRun({ status: { kind: 'running' } })}></lr-agent-run>`,
  )) as LyraAgentRun;
  expect(running.shadowRoot!.querySelector('[part="status-badge"]')!.textContent!.trim()).to.equal('Running');

  const failed = (await fixture(
    html`<lr-agent-run .run=${makeRun({ status: { kind: 'error' } })}></lr-agent-run>`,
  )) as LyraAgentRun;
  expect(failed.shadowRoot!.querySelector('[part="status-badge"]')!.textContent!.trim()).to.equal('Error');
});

it('renders English fallback labels for the seven agent-run-specific statuses', async () => {
  const cases: [AgentStatusKind, string][] = [
    ['idle', 'Idle'],
    ['queued', 'Queued'],
    ['collecting', 'Collecting context'],
    ['waiting-input', 'Waiting for input'],
    ['waiting-approval', 'Waiting for approval'],
    ['done', 'Done'],
    ['cancelled', 'Cancelled'],
  ];
  for (const [kind, label] of cases) {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ status: { kind } })}></lr-agent-run>`,
    )) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('[part="status-badge"]')!.textContent!.trim(), kind).to.equal(label);
  }
});

it('renders the optional status message', async () => {
  const el = (await fixture(
    html`<lr-agent-run
      .run=${makeRun({ status: { kind: 'error', message: 'Rate limited' } })}
    ></lr-agent-run>`,
  )) as LyraAgentRun;
  expect(el.shadowRoot!.querySelector('[part="status-message"]')!.textContent!.trim()).to.equal('Rate limited');
});

it('omits the status message entirely when unset', async () => {
  const el = (await fixture(html`<lr-agent-run .run=${makeRun()}></lr-agent-run>`)) as LyraAgentRun;
  expect(el.shadowRoot!.querySelector('[part="status-message"]')).to.not.exist;
});

describe('elapsed time', () => {
  it('composes a live-ticking lr-generation-status while running, with its own stop button hidden', async () => {
    const startedAt = Date.now() - 4000;
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ status: { kind: 'running' }, startedAt })}></lr-agent-run>`,
    )) as LyraAgentRun;
    const status = el.shadowRoot!.querySelector('lr-generation-status') as LyraGenerationStatus;
    expect(status).to.exist;
    expect(status.active).to.be.true;
    expect(status.startedAt).to.equal(startedAt);
    expect(status.showStop).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="elapsed-static"]')).to.not.exist;
  });

  it('also ticks while collecting/waiting-input/waiting-approval, not just running', async () => {
    for (const kind of ['collecting', 'waiting-input', 'waiting-approval'] as const) {
      const el = (await fixture(
        html`<lr-agent-run .run=${makeRun({ status: { kind } })}></lr-agent-run>`,
      )) as LyraAgentRun;
      const status = el.shadowRoot!.querySelector('lr-generation-status') as LyraGenerationStatus;
      expect(status.active, kind).to.be.true;
    }
  });

  it('renders a static formatted duration for a terminal run with both startedAt and endedAt', async () => {
    const el = (await fixture(
      html`<lr-agent-run
        .run=${makeRun({ status: { kind: 'done' }, startedAt: 1000, endedAt: 6000 })}
      ></lr-agent-run>`,
    )) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('lr-generation-status')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="elapsed-static"]')!.textContent!.trim()).to.equal('5s');
  });

  it('formats a sub-second terminal duration in milliseconds', async () => {
    const el = (await fixture(
      html`<lr-agent-run
        .run=${makeRun({ status: { kind: 'error' }, startedAt: 1000, endedAt: 1500 })}
      ></lr-agent-run>`,
    )) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('[part="elapsed-static"]')!.textContent!.trim()).to.equal('500ms');
  });

  it('renders neither the ticker nor a static duration for a terminal run missing endedAt', async () => {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ status: { kind: 'done' }, endedAt: undefined })}></lr-agent-run>`,
    )) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('lr-generation-status')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="elapsed-static"]')).to.not.exist;
  });

  it('renders nothing for an idle run with no startedAt', async () => {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ status: { kind: 'idle' }, startedAt: undefined })}></lr-agent-run>`,
    )) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('lr-generation-status')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="elapsed-static"]')).to.not.exist;
  });
});

describe('current step', () => {
  it('shows the last step whose status is running, with a visually-hidden prefix', async () => {
    const el = (await fixture(html`<lr-agent-run .run=${makeRun({ steps })}></lr-agent-run>`)) as LyraAgentRun;
    const currentStep = el.shadowRoot!.querySelector('[part="current-step"]')!;
    expect(currentStep.querySelector('[part="current-step-label"]')!.textContent!.trim()).to.equal(
      'Read repository',
    );
    expect(currentStep.querySelector('.sr-only')!.textContent!.trim()).to.equal('Current step');
  });

  it('omits the current-step row when no step is running', async () => {
    const noneRunning = steps.map((s) => ({ ...s, status: { kind: 'done' as const } }));
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ steps: noneRunning })}></lr-agent-run>`,
    )) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('[part="current-step"]')).to.not.exist;
  });
});

describe('model + cost summary', () => {
  it('renders the model text and a cost-text-bearing lr-usage-badge', async () => {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ model: 'gpt-4o', costEstimate: 12.5 })}></lr-agent-run>`,
    )) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('[part="model"]')!.textContent!.trim()).to.equal('gpt-4o');
    const usage = el.shadowRoot!.querySelector('lr-usage-badge')!;
    expect(usage.getAttribute('cost-text')).to.equal('12.5');
  });

  it('formats cost via a host-supplied formatCost function', async () => {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ costEstimate: 0.012 })} .formatCost=${(c: number) => `$${c.toFixed(3)}`}></lr-agent-run>`,
    )) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('lr-usage-badge')!.getAttribute('cost-text')).to.equal('$0.012');
  });

  it('keeps an empty summary section hidden while preserving its late-slot observer', async () => {
    const el = (await fixture(html`<lr-agent-run .run=${makeRun()}></lr-agent-run>`)) as LyraAgentRun;
    const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
    expect(summary.hidden).to.be.true;
    expect(summary.querySelector('slot[name="summary"]')).to.exist;
  });
});

describe('cancel/retry controls', () => {
  const cancelableKinds: AgentStatusKind[] = ['running', 'collecting', 'waiting-input', 'waiting-approval'];
  const nonCancelableKinds: AgentStatusKind[] = ['idle', 'queued', 'done', 'error', 'cancelled'];
  const retryableKinds: AgentStatusKind[] = ['error', 'cancelled'];
  const nonRetryableKinds: AgentStatusKind[] = ['idle', 'queued', 'running', 'collecting', 'waiting-input', 'waiting-approval', 'done'];

  for (const kind of cancelableKinds) {
    it(`shows Cancel while status is "${kind}"`, async () => {
      const el = (await fixture(
        html`<lr-agent-run .run=${makeRun({ status: { kind } })}></lr-agent-run>`,
      )) as LyraAgentRun;
      expect(el.shadowRoot!.querySelector('[part="cancel-button"]')).to.exist;
    });
  }
  for (const kind of nonCancelableKinds) {
    it(`hides Cancel while status is "${kind}"`, async () => {
      const el = (await fixture(
        html`<lr-agent-run .run=${makeRun({ status: { kind } })}></lr-agent-run>`,
      )) as LyraAgentRun;
      expect(el.shadowRoot!.querySelector('[part="cancel-button"]')).to.not.exist;
    });
  }
  for (const kind of retryableKinds) {
    it(`shows Retry while status is "${kind}"`, async () => {
      const el = (await fixture(
        html`<lr-agent-run .run=${makeRun({ status: { kind } })}></lr-agent-run>`,
      )) as LyraAgentRun;
      expect(el.shadowRoot!.querySelector('[part="retry-button"]')).to.exist;
    });
  }
  for (const kind of nonRetryableKinds) {
    it(`hides Retry while status is "${kind}"`, async () => {
      const el = (await fixture(
        html`<lr-agent-run .run=${makeRun({ status: { kind } })}></lr-agent-run>`,
      )) as LyraAgentRun;
      expect(el.shadowRoot!.querySelector('[part="retry-button"]')).to.not.exist;
    });
  }

  it('hides Cancel/Retry entirely when show-cancel/show-retry are false, regardless of status', async () => {
    const el = (await fixture(html`
      <lr-agent-run
        .run=${makeRun({ status: { kind: 'error' } })}
        show-cancel="false"
        show-retry="false"
      ></lr-agent-run>
    `)) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('[part="cancel-button"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="retry-button"]')).to.not.exist;
  });

  it('emits lr-cancel with an empty-reason CancelEventDetail when Cancel is clicked', async () => {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ status: { kind: 'running' } })}></lr-agent-run>`,
    )) as LyraAgentRun;
    const listener = oneEvent(el, 'lr-cancel');
    (el.shadowRoot!.querySelector('[part="cancel-button"]') as HTMLButtonElement).click();
    const event = await listener;
    expect((event.detail as CancelEventDetail).reason).to.be.undefined;
  });

  it('emits lr-retry with a 1-based attempt counter, incrementing per click', async () => {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ status: { kind: 'error' } })}></lr-agent-run>`,
    )) as LyraAgentRun;
    const button = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;

    let listener = oneEvent(el, 'lr-retry');
    button.click();
    let event = await listener;
    expect((event.detail as RetryEventDetail).attempt).to.equal(1);

    listener = oneEvent(el, 'lr-retry');
    button.click();
    event = await listener;
    expect((event.detail as RetryEventDetail).attempt).to.equal(2);
  });

  it('resets the retry-attempt counter when run.id changes to a different run', async () => {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ id: 'run-a', status: { kind: 'error' } })}></lr-agent-run>`,
    )) as LyraAgentRun;
    let button = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;
    let listener = oneEvent(el, 'lr-retry');
    button.click();
    await listener;

    el.run = makeRun({ id: 'run-b', status: { kind: 'error' } });
    await el.updateComplete;
    button = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;
    listener = oneEvent(el, 'lr-retry');
    button.click();
    const event = await listener;
    expect((event.detail as RetryEventDetail).attempt).to.equal(1);
  });
});

describe('tasks slot default content', () => {
  it('renders a lr-task-list built from run.steps when nothing is slotted', async () => {
    const el = (await fixture(html`<lr-agent-run .run=${makeRun({ steps })}></lr-agent-run>`)) as LyraAgentRun;
    const taskList = el.shadowRoot!.querySelector('lr-task-list') as LyraTaskList;
    expect(taskList).to.exist;
    expect(taskList.items).to.deep.equal([
      { id: 'step-1', label: 'Search the web', status: 'success', detail: undefined },
      { id: 'step-2', label: 'Read repository', status: 'running', detail: undefined },
      { id: 'step-3', label: 'Write summary', status: 'pending', detail: undefined },
    ]);
  });

  it('maps every AgentStatusKind to its TaskStatus counterpart', async () => {
    const mapped: AgentStep[] = [
      { id: 'a', kind: 'x', label: 'a', status: { kind: 'idle' } },
      { id: 'b', kind: 'x', label: 'b', status: { kind: 'running' } },
      { id: 'c', kind: 'x', label: 'c', status: { kind: 'waiting-input' } },
      { id: 'd', kind: 'x', label: 'd', status: { kind: 'waiting-approval' } },
      { id: 'e', kind: 'x', label: 'e', status: { kind: 'done' } },
      { id: 'f', kind: 'x', label: 'f', status: { kind: 'error' } },
      { id: 'g', kind: 'x', label: 'g', status: { kind: 'cancelled' } },
      { id: 'h', kind: 'x', label: 'h', status: { kind: 'collecting' } },
    ];
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ steps: mapped })}></lr-agent-run>`,
    )) as LyraAgentRun;
    const items = (el.shadowRoot!.querySelector('lr-task-list') as LyraTaskList).items;
    expect(items.map((i) => i.status)).to.deep.equal([
      'pending',
      'running',
      'running',
      'running',
      'success',
      'error',
      'error',
      'running',
    ]);
  });

  it('does not route non-finite timestamps into elapsed-time rendering', async () => {
    const el = (await fixture(html`
      <lr-agent-run
        .run=${makeRun({ status: { kind: 'running' }, startedAt: Number.POSITIVE_INFINITY })}
      ></lr-agent-run>
    `)) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('lr-generation-status')).to.not.exist;
    expect(el.shadowRoot!.textContent).to.not.include('Infinity');
    expect(el.shadowRoot!.textContent).to.not.include('NaN');
  });

  it('formats a terminal duration number with the effective locale', async () => {
    const el = (await fixture(html`
      <lr-agent-run
        lang="de-DE"
        .run=${makeRun({ status: { kind: 'done' }, startedAt: 0, endedAt: 2500 })}
      ></lr-agent-run>
    `)) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('[part="elapsed-static"]')!.textContent!.trim()).to.equal('2,5s');
  });

  it('observes a summary slotted after the initially summary-free render', async () => {
    const el = (await fixture(html`
      <lr-agent-run .run=${makeRun({ model: undefined, costEstimate: undefined })}></lr-agent-run>
    `)) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('slot[name="summary"]')).to.exist;
    const summary = document.createElement('span');
    summary.slot = 'summary';
    summary.textContent = 'Late summary';
    el.append(summary);
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('slot[name="summary"]') as HTMLSlotElement).assignedElements().length).to.equal(1);
  });

  it('renders no fallback content when run.steps is empty', async () => {
    const el = (await fixture(html`<lr-agent-run .run=${makeRun({ steps: [] })}></lr-agent-run>`)) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('lr-task-list')).to.not.exist;
  });

  it('lets the host override the tasks slot entirely', async () => {
    const el = (await fixture(html`
      <lr-agent-run .run=${makeRun({ steps })}>
        <div slot="tasks" id="custom-tasks">custom</div>
      </lr-agent-run>
    `)) as LyraAgentRun;
    const slot = el.shadowRoot!.querySelector('slot[name="tasks"]') as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    expect(assigned.length).to.equal(1);
    expect(assigned[0]!.id).to.equal('custom-tasks');
  });
});

describe('tools/reasoning/output slots', () => {
  it('pass host content straight through with no default content', async () => {
    const el = (await fixture(html`
      <lr-agent-run .run=${makeRun()}>
        <div slot="tools" id="a-tool">tool</div>
        <div slot="reasoning" id="a-reasoning">reasoning</div>
        <div slot="output" id="an-output">output</div>
      </lr-agent-run>
    `)) as LyraAgentRun;
    for (const [name, id] of [
      ['tools', 'a-tool'],
      ['reasoning', 'a-reasoning'],
      ['output', 'an-output'],
    ] as const) {
      const slot = el.shadowRoot!.querySelector(`slot[name="${name}"]`) as HTMLSlotElement;
      expect(slot.assignedElements({ flatten: true })[0]!.id, name).to.equal(id);
    }
  });

  it('renders nothing for an empty tools/reasoning/output slot', async () => {
    const el = (await fixture(html`<lr-agent-run .run=${makeRun()}></lr-agent-run>`)) as LyraAgentRun;
    for (const name of ['tools', 'reasoning', 'output']) {
      const slot = el.shadowRoot!.querySelector(`slot[name="${name}"]`) as HTMLSlotElement;
      expect(slot.assignedElements({ flatten: true }).length, name).to.equal(0);
      expect(slot.childNodes.length, name).to.equal(0);
    }
  });
});

it('lets the host add extra header actions via the actions slot', async () => {
  const el = (await fixture(html`
    <lr-agent-run .run=${makeRun()}>
      <button slot="actions" id="extra-action">Export</button>
    </lr-agent-run>
  `)) as LyraAgentRun;
  const slot = el.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement;
  expect(slot.assignedElements({ flatten: true })[0]!.id).to.equal('extra-action');
});

describe('status-change announcements', () => {
  it('never announces on first mount, even when the run already carries an attention-needing status', async () => {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ status: { kind: 'waiting-input' } })}></lr-agent-run>`,
    )) as LyraAgentRun;
    expect(await getLiveRegionText(el)).to.equal('');
  });

  it('announces an in-place transition into waiting-input, assertively', async () => {
    const run = makeRun({ status: { kind: 'running' } });
    const el = (await fixture(html`<lr-agent-run .run=${run}></lr-agent-run>`)) as LyraAgentRun;
    el.run = { ...run, status: { kind: 'waiting-input' } };
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Status: Waiting for input.');
    const region = el.shadowRoot!.querySelector('lr-live-region')!;
    expect(region.mode).to.equal('assertive');
  });

  it('announces an in-place transition into done, politely', async () => {
    const run = makeRun({ status: { kind: 'running' } });
    const el = (await fixture(html`<lr-agent-run .run=${run}></lr-agent-run>`)) as LyraAgentRun;
    el.run = { ...run, status: { kind: 'done' } };
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Status: Done.');
    const region = el.shadowRoot!.querySelector('lr-live-region')!;
    expect(region.mode).to.equal('polite');
  });

  it('does not announce a running/idle transition', async () => {
    const run = makeRun({ status: { kind: 'idle' } });
    const el = (await fixture(html`<lr-agent-run .run=${run}></lr-agent-run>`)) as LyraAgentRun;
    el.run = { ...run, status: { kind: 'running' } };
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('');
  });

  it('does not announce when a brand-new run (different id) mounts already in an attention state', async () => {
    const run = makeRun({ id: 'run-a', status: { kind: 'running' } });
    const el = (await fixture(html`<lr-agent-run .run=${run}></lr-agent-run>`)) as LyraAgentRun;
    el.run = makeRun({ id: 'run-b', status: { kind: 'error' } });
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('');
  });
});

describe('localization', () => {
  it('localizes the reused cancel/retry button text via .strings', async () => {
    const el = (await fixture(html`
      <lr-agent-run
        .run=${makeRun({ status: { kind: 'running' } })}
        .strings=${{ cancel: 'Annuler' }}
      ></lr-agent-run>
    `)) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('[part="cancel-button"]')!.textContent!.trim()).to.equal('Annuler');
  });

  it('localizes an agent-run-specific status label via .strings', async () => {
    const el = (await fixture(html`
      <lr-agent-run
        .run=${makeRun({ status: { kind: 'waiting-approval' } })}
        .strings=${{ agentRunStatusWaitingApproval: "En attente d'approbation" }}
      ></lr-agent-run>
    `)) as LyraAgentRun;
    expect(el.shadowRoot!.querySelector('[part="status-badge"]')!.textContent!.trim()).to.equal(
      "En attente d'approbation",
    );
  });
});

it('transitions the current-step icon spin animation, disabled under reduced motion', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include('animation: lr-agent-run-spin var(--lr-agent-run-spin) infinite;');
  expect(css).to.include(
    "@media (prefers-reduced-motion: reduce) { [part='cancel-button'], [part='retry-button'] { transition: none !important; } [part='current-step-icon'] svg { animation: none !important; } }",
  );
});

it('is accessible with no run', async () => {
  const el = (await fixture(html`<lr-agent-run></lr-agent-run>`)) as LyraAgentRun;
  await expect(el).to.be.accessible();
});

it('is accessible with a fully populated running state (status, elapsed, current step, summary, cancel button, tasks)', async () => {
  const el = (await fixture(
    html`<lr-agent-run
      .run=${makeRun({
        status: { kind: 'running', message: 'Working on it' },
        model: 'gpt-4o',
        costEstimate: 0.05,
        steps,
      })}
    ></lr-agent-run>`,
  )) as LyraAgentRun;
  expect(el.shadowRoot!.querySelector('[part="current-step"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="cancel-button"]')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-task-list')).to.exist;
  await expect(el).to.be.accessible();
});

it('is accessible with a terminal error state (retry button, static elapsed)', async () => {
  const el = (await fixture(
    html`<lr-agent-run
      .run=${makeRun({ status: { kind: 'error', message: 'Rate limited' }, startedAt: 1000, endedAt: 4000 })}
    ></lr-agent-run>`,
  )) as LyraAgentRun;
  expect(el.shadowRoot!.querySelector('[part="retry-button"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="elapsed-static"]')).to.exist;
  await expect(el).to.be.accessible();
});

it('renders and distinguishes queued and collecting lifecycle states', async () => {
  const root = await fixture(html`
    <div>
      <lr-agent-run
        id="queued"
        .run=${makeRun({ status: { kind: 'queued' } })}
        .statusLabels=${{ queued: 'Waiting in queue' }}
        .statusVariants=${{ queued: 'warning' }}
      ></lr-agent-run>
      <lr-agent-run
        id="collecting"
        .run=${makeRun({ status: { kind: 'collecting' } })}
        .metrics=${[
          { id: 'input', label: 'Input tokens', value: 123 },
          { id: 'output', label: 'Output tokens', value: 45 },
        ]}
      ></lr-agent-run>
    </div>
  `);
  const queued = root.querySelector('#queued') as LyraAgentRun;
  expect(queued.shadowRoot!.querySelector('[part="status-badge"]')!.textContent!.trim()).to.equal('Waiting in queue');
  expect(queued.shadowRoot!.querySelector('[part="status-badge"]')!.getAttribute('variant')).to.equal('warning');
  expect(queued.shadowRoot!.querySelector('lr-generation-status')).to.not.exist;
  expect(queued.shadowRoot!.querySelector('[part="cancel-button"]')).to.not.exist;

  const collecting = root.querySelector('#collecting') as LyraAgentRun;
  expect(collecting.shadowRoot!.querySelector('[part="status-badge"]')!.textContent!.trim()).to.equal('Collecting context');
  expect(collecting.shadowRoot!.querySelector('lr-generation-status')).to.exist;
  expect(collecting.shadowRoot!.querySelector('[part="cancel-button"]')).to.exist;
  expect(collecting.shadowRoot!.querySelectorAll('[part="metric"]')).to.have.length(2);
});

it('lets header and summary slots replace the built-in chrome', async () => {
  const el = (await fixture(html`
    <lr-agent-run .run=${makeRun({ model: 'hidden-model', costEstimate: 2 })}>
      <span slot="header" id="custom-header">Custom header</span>
      <span slot="summary" id="custom-summary">Custom summary</span>
    </lr-agent-run>
  `)) as LyraAgentRun;
  expect(el.querySelector('#custom-header')).to.exist;
  expect(el.querySelector('#custom-summary')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="status-badge"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="usage"]')).to.not.exist;
});

const baseChrome = (el: LyraAgentRun) => {
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const s = getComputedStyle(base);
  return {
    paddingTop: s.paddingTop,
    paddingLeft: s.paddingLeft,
    borderTopWidth: s.borderTopWidth,
    borderTopStyle: s.borderTopStyle,
    borderTopLeftRadius: s.borderTopLeftRadius,
    backgroundColor: s.backgroundColor,
    rowGap: s.rowGap,
    columnGap: s.columnGap,
  };
};

it('defaults to compact=false and appearance="card", rendering identically to those values restated', async () => {
  const implicit = (await fixture(html`<lr-agent-run .run=${makeRun({ steps })}></lr-agent-run>`)) as LyraAgentRun;
  const explicit = (await fixture(
    html`<lr-agent-run appearance="card" .compact=${false} .run=${makeRun({ steps })}></lr-agent-run>`,
  )) as LyraAgentRun;

  expect(implicit.compact).to.be.false;
  expect(implicit.appearance).to.equal('card');
  expect(implicit.hasAttribute('compact')).to.be.false;
  expect(implicit.getAttribute('appearance')).to.equal('card');

  // Restating the defaults must not move a single chrome declaration...
  expect(baseChrome(explicit)).to.deep.equal(baseChrome(implicit));
  // ...and those defaults are still exactly the card chrome that shipped before these axes existed.
  const chrome = baseChrome(implicit);
  expect(chrome.paddingTop).to.equal('12px'); // --lr-space-m
  expect(chrome.paddingLeft).to.equal('12px');
  expect(chrome.rowGap).to.equal('12px');
  expect(chrome.borderTopWidth).to.equal('1px'); // --lr-border-width-thin
  expect(chrome.borderTopStyle).to.equal('solid');
  expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('reflects compact and tightens the base padding/gap, keeping the card border', async () => {
  const el = (await fixture(html`<lr-agent-run compact .run=${makeRun({ steps })}></lr-agent-run>`)) as LyraAgentRun;
  expect(el.hasAttribute('compact')).to.be.true;
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('8px'); // --lr-space-s
  expect(chrome.paddingLeft).to.equal('8px');
  expect(chrome.rowGap).to.equal('8px');
  // compact is a density escape, not a chrome escape -- the border and background stay.
  expect(chrome.borderTopWidth).to.equal('1px');
  expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('lets a consumer retune the compact values through --lr-agent-run-compact-* without re-declaring the rule', async () => {
  const el = (await fixture(html`<lr-agent-run compact .run=${makeRun({ steps })}></lr-agent-run>`)) as LyraAgentRun;
  el.style.setProperty('--lr-agent-run-compact-padding', '3px');
  el.style.setProperty('--lr-agent-run-compact-gap', '5px');
  await el.updateComplete;
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('3px');
  expect(chrome.rowGap).to.equal('5px');
});

it('drops border, background, padding and radius under appearance="plain"', async () => {
  const el = (await fixture(
    html`<lr-agent-run appearance="plain" .run=${makeRun({ steps })}></lr-agent-run>`,
  )) as LyraAgentRun;
  expect(el.getAttribute('appearance')).to.equal('plain');
  const chrome = baseChrome(el);
  expect(chrome.borderTopWidth).to.equal('0px');
  expect(chrome.borderTopLeftRadius).to.equal('0px');
  expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(chrome.paddingTop).to.equal('0px');
  expect(chrome.paddingLeft).to.equal('0px');
});

it('orders :host([appearance="plain"]) after :host([compact]) so the equal-specificity reset wins', () => {
  const css = styles.cssText;
  const compactAt = css.indexOf(':host([compact])');
  const plainAt = css.indexOf(":host([appearance='plain'])");
  expect(compactAt).to.be.greaterThan(-1);
  expect(plainAt).to.be.greaterThan(-1);
  expect(plainAt).to.be.greaterThan(compactAt);
});

it('lets plain win over compact when both are set', async () => {
  const el = (await fixture(
    html`<lr-agent-run compact appearance="plain" .run=${makeRun({ steps })}></lr-agent-run>`,
  )) as LyraAgentRun;
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('0px');
  expect(chrome.paddingLeft).to.equal('0px');
  expect(chrome.borderTopWidth).to.equal('0px');
});

it('keeps the Cancel/Retry buttons visibly interactive under plain (their chrome is their own, not the card)', async () => {
  const el = (await fixture(
    html`<lr-agent-run appearance="plain" .run=${makeRun({ steps })}></lr-agent-run>`,
  )) as LyraAgentRun;
  const cancel = el.shadowRoot!.querySelector('[part="cancel-button"]') as HTMLElement;
  expect(cancel).to.exist;
  const s = getComputedStyle(cancel);
  expect(s.borderTopWidth).to.equal('1px');
  expect(s.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('is accessible in the populated compact + plain states', async () => {
  const compactEl = (await fixture(
    html`<lr-agent-run compact .run=${makeRun({ steps, model: 'gpt-4o', costEstimate: 0.42 })}></lr-agent-run>`,
  )) as LyraAgentRun;
  await expect(compactEl).to.be.accessible();

  const plainEl = (await fixture(
    html`<lr-agent-run
      appearance="plain"
      .run=${makeRun({ steps, model: 'gpt-4o', costEstimate: 0.42 })}
    ></lr-agent-run>`,
  )) as LyraAgentRun;
  await expect(plainEl).to.be.accessible();
});

it('allows semantic metric colors to be rethemed without changing shared status tokens', async () => {
  const el = (await fixture(html`
    <lr-agent-run
      style="--lr-agent-run-metric-danger-color: rgb(1, 2, 3)"
      .run=${makeRun()}
      .metrics=${[{ id: 'failures', label: 'Failures', value: 2, variant: 'danger' }]}
    ></lr-agent-run>
  `)) as LyraAgentRun;
  const value = el.shadowRoot!.querySelector('[part="metric-value"]') as HTMLElement;
  expect(getComputedStyle(value).color).to.equal('rgb(1, 2, 3)');
});

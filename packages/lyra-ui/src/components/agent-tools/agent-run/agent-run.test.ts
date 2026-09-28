import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './agent-run.js';
import type { LyraAgentRun } from './agent-run.js';
import type { LyraGenerationMetrics } from '../../conversation/generation-metrics/generation-metrics.js';
import type { LyraTaskList } from '../task-list/task-list.js';
import type { AgentRun, AgentStep, AgentStatusKind, CancelEventDetail, RetryEventDetail } from '../../../ai/types.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import { captureDeprecationWarnings, type DeprecatedUsage } from '../../../../test/expected-deprecations.js';

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

it('defaults to run=null, withoutCancel=false, withoutRetry=false, and renders the shared empty state', async () => {
  const el = (await fixture(html`<lr-agent-run></lr-agent-run>`)) as LyraAgentRun;
  expect(el.run).to.be.null;
  expect(el.withoutCancel).to.be.false;
  expect(el.withoutRetry).to.be.false;
  const empty = el.shadowRoot!.querySelector('[part="empty"]');
  expect((empty) != null).to.equal(true);
  expect(empty!.getAttribute('heading')).to.equal('No data');
  expect((el.shadowRoot!.querySelector('[part="header"]')) == null).to.be.true;
});

it('renders summary run records without steps and defaults a step with no status to pending', async () => {
  const withoutSteps = await fixture<LyraAgentRun>(html`
    <lr-agent-run .run=${{ id: 'summary', status: { kind: 'done' } } as unknown as AgentRun}></lr-agent-run>
  `);
  expect(withoutSteps.shadowRoot!.querySelector('[part="status-badge"]')!.textContent!.trim()).to.equal('Done');
  expect(withoutSteps.shadowRoot!.querySelectorAll('lr-task-list')).to.have.lengthOf(0);

  const missingStepStatus = await fixture<LyraAgentRun>(html`
    <lr-agent-run
      .run=${makeRun({ steps: [{ id: 'step', kind: 'tool', label: 'Queued step' } as unknown as AgentStep] })}
    ></lr-agent-run>
  `);
  const list = missingStepStatus.shadowRoot!.querySelector('lr-task-list') as LyraTaskList;
  expect(list.items).to.have.lengthOf(1);
  expect(list.items[0]!.status).to.equal('pending');
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
  expect((el.shadowRoot!.querySelector('[part="status-message"]')) == null).to.be.true;
});

describe('elapsed time', () => {
  it('composes live-ticking lr-generation-metrics while running, with its own stop button hidden', async () => {
    const startedAt = Date.now() - 4000;
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ status: { kind: 'running' }, startedAt })}></lr-agent-run>`,
    )) as LyraAgentRun;
    const status = el.shadowRoot!.querySelector('lr-generation-metrics') as LyraGenerationMetrics;
    expect(status).to.exist;
    expect(status.status).to.equal('running');
    expect(status.startedAt).to.equal(startedAt);
    expect(status.withoutStop).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="elapsed-static"]')) == null).to.be.true;
  });

  it('also ticks while collecting/waiting-input/waiting-approval, not just running', async () => {
    for (const kind of ['collecting', 'waiting-input', 'waiting-approval'] as const) {
      const el = (await fixture(
        html`<lr-agent-run .run=${makeRun({ status: { kind } })}></lr-agent-run>`,
      )) as LyraAgentRun;
      const status = el.shadowRoot!.querySelector('lr-generation-metrics') as LyraGenerationMetrics;
      expect(status.status, kind).to.equal('running');
    }
  });

  it('renders a static formatted duration for a terminal run with both startedAt and endedAt', async () => {
    const el = (await fixture(
      html`<lr-agent-run
        .run=${makeRun({ status: { kind: 'done' }, startedAt: 1000, endedAt: 6000 })}
      ></lr-agent-run>`,
    )) as LyraAgentRun;
    expect((el.shadowRoot!.querySelector('lr-generation-metrics')) == null).to.be.true;
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
    expect((el.shadowRoot!.querySelector('lr-generation-metrics')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="elapsed-static"]')) == null).to.be.true;
  });

  it('renders nothing for an idle run with no startedAt', async () => {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ status: { kind: 'idle' }, startedAt: undefined })}></lr-agent-run>`,
    )) as LyraAgentRun;
    expect((el.shadowRoot!.querySelector('lr-generation-metrics')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="elapsed-static"]')) == null).to.be.true;
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
    expect((el.shadowRoot!.querySelector('[part="current-step"]')) == null).to.be.true;
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

  it('contains long public model and metric data inside a 320px allocation', async () => {
    const long = `identifier-${'unbroken'.repeat(40)}`;
    const wrapper = await fixture(html`
      <div style="inline-size:320px">
        <lr-agent-run
          .run=${makeRun({ status: { kind: 'done' }, startedAt: 0, endedAt: 1000, model: long })}
          .metrics=${[
            { id: 'long-label', label: long, value: long },
            { id: 'long-value', label: 'Output', value: long },
          ]}
        ></lr-agent-run>
      </div>
    `);
    const el = wrapper.querySelector('lr-agent-run') as LyraAgentRun;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
    expect(el.getBoundingClientRect().width).to.be.at.most(321);
    for (const part of [base, header, summary]) {
      expect(part.scrollWidth, part.getAttribute('part') ?? '').to.be.at.most(Math.ceil(part.getBoundingClientRect().width) + 1);
    }
    for (const partName of ['model', 'metric', 'metric-label', 'metric-value']) {
      const parts = [...el.shadowRoot!.querySelectorAll(`[part="${partName}"]`)] as HTMLElement[];
      expect(parts.length, partName).to.be.greaterThan(0);
      for (const part of parts) {
        expect(part.scrollWidth, partName).to.be.at.most(Math.ceil(part.getBoundingClientRect().width) + 1);
      }
    }
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
      expect((el.shadowRoot!.querySelector('[part="cancel-button"]')) == null).to.be.true;
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
      expect((el.shadowRoot!.querySelector('[part="retry-button"]')) == null).to.be.true;
    });
  }

  it('hides Cancel/Retry entirely when without-cancel/without-retry are set, regardless of status', async () => {
    const el = (await fixture(html`
      <lr-agent-run
        .run=${makeRun({ status: { kind: 'error' } })}
        without-cancel
        without-retry
      ></lr-agent-run>
    `)) as LyraAgentRun;
    expect((el.shadowRoot!.querySelector('[part="cancel-button"]')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="retry-button"]')) == null).to.be.true;
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

  it('emits lr-run-retry with a 1-based attempt counter, incrementing per click', async () => {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ status: { kind: 'error' } })}></lr-agent-run>`,
    )) as LyraAgentRun;
    const button = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;

    let listener = oneEvent(el, 'lr-run-retry');
    button.click();
    let event = await listener;
    expect((event.detail as RetryEventDetail).attempt).to.equal(1);

    listener = oneEvent(el, 'lr-run-retry');
    button.click();
    event = await listener;
    expect((event.detail as RetryEventDetail).attempt).to.equal(2);
  });

  it('resets the retry-attempt counter when run.id changes to a different run', async () => {
    const el = (await fixture(
      html`<lr-agent-run .run=${makeRun({ id: 'run-a', status: { kind: 'error' } })}></lr-agent-run>`,
    )) as LyraAgentRun;
    let button = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;
    let listener = oneEvent(el, 'lr-run-retry');
    button.click();
    await listener;

    el.run = makeRun({ id: 'run-b', status: { kind: 'error' } });
    await el.updateComplete;
    button = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;
    listener = oneEvent(el, 'lr-run-retry');
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
    expect((el.shadowRoot!.querySelector('lr-generation-metrics')) == null).to.be.true;
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
    expect((el.shadowRoot!.querySelector('lr-task-list')) == null).to.be.true;
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

it('renders the current-step spin and stops it under reduced motion', async () => {
  try {
    await setReducedMotion('no-preference');
    const el = (await fixture(html`
      <lr-agent-run .run=${makeRun({ status: { kind: 'running' }, steps })}></lr-agent-run>
    `)) as LyraAgentRun;
    const spinner = el.shadowRoot!.querySelector('[part="current-step-icon"] svg') as SVGElement;

    const fullMotion = getComputedStyle(spinner);
    expect(fullMotion.animationName).to.equal('lr-agent-run-spin');
    expect(fullMotion.animationIterationCount).to.equal('infinite');

    await setReducedMotion('reduce');
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(matchMedia('(prefers-reduced-motion: reduce)').matches).to.equal(true);
    expect(getComputedStyle(spinner).animationName).to.equal('none');
  } finally {
    await setReducedMotion('no-preference');
  }
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
  expect((queued.shadowRoot!.querySelector('lr-generation-metrics')) == null).to.be.true;
  expect((queued.shadowRoot!.querySelector('[part="cancel-button"]')) == null).to.be.true;

  const collecting = root.querySelector('#collecting') as LyraAgentRun;
  expect(collecting.shadowRoot!.querySelector('[part="status-badge"]')!.textContent!.trim()).to.equal('Collecting context');
  expect(collecting.shadowRoot!.querySelector('lr-generation-metrics')).to.exist;
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
  expect((el.shadowRoot!.querySelector('[part="status-badge"]')) == null).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="usage"]')) == null).to.be.true;
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

it('defaults to size="m" and frame="card", rendering identically to those values restated', async () => {
  const implicit = (await fixture(html`<lr-agent-run .run=${makeRun({ steps })}></lr-agent-run>`)) as LyraAgentRun;
  const explicit = (await fixture(
    html`<lr-agent-run frame="card" size="m" .run=${makeRun({ steps })}></lr-agent-run>`,
  )) as LyraAgentRun;

  expect(implicit.size).to.equal('m');
  expect(implicit.frame).to.equal('card');
  expect(implicit.hasAttribute('compact')).to.be.false;
  expect(implicit.getAttribute('frame')).to.equal('card');

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

it('reflects size="s" and tightens the base padding/gap, keeping the card border', async () => {
  const el = (await fixture(html`<lr-agent-run size="s" .run=${makeRun({ steps })}></lr-agent-run>`)) as LyraAgentRun;
  expect(el.getAttribute('size')).to.equal('s');
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('8px'); // --lr-space-s
  expect(chrome.paddingLeft).to.equal('8px');
  expect(chrome.rowGap).to.equal('8px');
  // The dense size tier is a density escape, not a chrome escape -- the border and background stay.
  expect(chrome.borderTopWidth).to.equal('1px');
  expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('lets a consumer retune the dense-tier values through --lr-agent-run-compact-* without re-declaring the rule', async () => {
  const el = (await fixture(html`<lr-agent-run size="s" .run=${makeRun({ steps })}></lr-agent-run>`)) as LyraAgentRun;
  el.style.setProperty('--lr-agent-run-compact-padding', '3px');
  el.style.setProperty('--lr-agent-run-compact-gap', '5px');
  await el.updateComplete;
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('3px');
  expect(chrome.rowGap).to.equal('5px');
});

it('drops border, background, padding and radius under frame="plain"', async () => {
  const el = (await fixture(
    html`<lr-agent-run frame="plain" .run=${makeRun({ steps })}></lr-agent-run>`,
  )) as LyraAgentRun;
  expect(el.getAttribute('frame')).to.equal('plain');
  const chrome = baseChrome(el);
  expect(chrome.borderTopWidth).to.equal('0px');
  expect(chrome.borderTopLeftRadius).to.equal('0px');
  expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(chrome.paddingTop).to.equal('0px');
  expect(chrome.paddingLeft).to.equal('0px');
});

it('lets plain win over size="s" when both are set', async () => {
  const el = (await fixture(
    html`<lr-agent-run size="s" frame="plain" .run=${makeRun({ steps })}></lr-agent-run>`,
  )) as LyraAgentRun;
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('0px');
  expect(chrome.paddingLeft).to.equal('0px');
  expect(chrome.borderTopWidth).to.equal('0px');
});

it('keeps the Cancel/Retry buttons visibly interactive under plain (their chrome is their own, not the card)', async () => {
  const el = (await fixture(
    html`<lr-agent-run frame="plain" .run=${makeRun({ steps })}></lr-agent-run>`,
  )) as LyraAgentRun;
  const cancel = el.shadowRoot!.querySelector('[part="cancel-button"]') as HTMLElement;
  expect((cancel) != null).to.equal(true);
  const s = getComputedStyle(cancel);
  expect(s.borderTopWidth).to.equal('1px');
  expect(s.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('is accessible in the populated dense + plain states', async () => {
  const compactEl = (await fixture(
    html`<lr-agent-run size="s" .run=${makeRun({ steps, model: 'gpt-4o', costEstimate: 0.42 })}></lr-agent-run>`,
  )) as LyraAgentRun;
  await expect(compactEl).to.be.accessible();

  const plainEl = (await fixture(
    html`<lr-agent-run
      frame="plain"
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

it('maps the public brand metric variant to its themeable brand color', async () => {
  const el = await fixture<LyraAgentRun>(html`
    <lr-agent-run
      style="--lr-agent-run-metric-brand-color: rgb(4, 5, 6)"
      .run=${makeRun()}
      .metrics=${[{ id: 'quality', label: 'Quality', value: '98%', variant: 'brand' }]}
    ></lr-agent-run>
  `);
  const value = el.shadowRoot!.querySelector('[part="metric-value"]') as HTMLElement;
  expect(value.dataset['variant']).to.equal('brand');
  expect(getComputedStyle(value).color).to.equal('rgb(4, 5, 6)');
});

it('normalizes duplicate metric ids first-wins', async () => {
  const el = await fixture<LyraAgentRun>(html`
    <lr-agent-run
      .run=${makeRun()}
      .metrics=${[
        { id: 'tokens', label: 'First metric', value: 10 },
        { id: 'tokens', label: 'Later metric', value: 99 },
      ]}
    ></lr-agent-run>
  `);
  const metrics = el.shadowRoot!.querySelectorAll('[part="metric"]');
  expect(metrics).to.have.length(1);
  expect(metrics[0]!.textContent).to.contain('First metric');
  expect(metrics[0]!.textContent).not.to.contain('Later metric');
});

describe('card chrome theming hooks', () => {
  const base = (el: LyraAgentRun) => el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  it('repaints the card through --lr-agent-run-bg/-border-color/-radius', async () => {
    const el = (await fixture(html`
      <lr-agent-run
        style="--lr-agent-run-bg: rgb(1, 2, 3); --lr-agent-run-border-color: rgb(4, 5, 6); --lr-agent-run-radius: 11px"
        .run=${makeRun({ steps })}
      ></lr-agent-run>
    `)) as LyraAgentRun;
    const chrome = getComputedStyle(base(el));
    expect(chrome.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(chrome.borderTopColor).to.equal('rgb(4, 5, 6)');
    expect(chrome.borderTopLeftRadius).to.equal('11px');
  });

  it('leaves the card paint byte-identical when the hooks are unset', async () => {
    const control = (await fixture(
      html`<lr-agent-run .run=${makeRun({ steps })}></lr-agent-run>`,
    )) as LyraAgentRun;
    const tokened = (await fixture(html`
      <lr-agent-run
        style="--lr-agent-run-bg: var(--lr-color-surface); --lr-agent-run-border-color: var(--lr-color-border-subtle); --lr-agent-run-radius: var(--lr-radius)"
        .run=${makeRun({ steps })}
      ></lr-agent-run>
    `)) as LyraAgentRun;
    const unset = getComputedStyle(base(control));
    const explicit = getComputedStyle(base(tokened));
    expect(unset.backgroundColor).to.equal(explicit.backgroundColor);
    expect(unset.borderTopColor).to.equal(explicit.borderTopColor);
    expect(unset.borderTopLeftRadius).to.equal(explicit.borderTopLeftRadius);
    expect(unset.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('draws the card edge on the decorative --lr-color-border-subtle tier', async () => {
    const el = (await fixture(html`
      <lr-agent-run
        style="--lr-theme-color-surface-border: rgb(10, 20, 30); --lr-theme-color-surface-border-subtle: rgb(7, 8, 9)"
        .run=${makeRun({ steps })}
      ></lr-agent-run>
    `)) as LyraAgentRun;
    expect(getComputedStyle(base(el)).borderTopColor).to.equal('rgb(7, 8, 9)');
  });
});

describe('lr-agent-run size and its deprecated compact alias', () => {
  const COMPACT: readonly DeprecatedUsage[] = [{ tag: 'lr-agent-run', kind: 'property', name: 'compact' }];
  const density = (el: LyraAgentRun): string => JSON.stringify({ padding: getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).padding, gap: getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).rowGap });

  it('defaults size to m, reflects it, and leaves the regular density unchanged', async () => {
    const el = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${makeRun({ steps })}></lr-agent-run>`);
    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
    expect(el.hasAttribute('compact')).to.equal(false);
    expect(el.compact).to.equal(false);
  });

  it('tightens through the canonical size="s" without a deprecation warning', async () => {
    let regular = '';
    let dense = '';
    const warnings = await captureDeprecationWarnings(COMPACT, async () => {
      regular = density(await fixture<LyraAgentRun>(html`<lr-agent-run .run=${makeRun({ steps })}></lr-agent-run>`));
      dense = density(await fixture<LyraAgentRun>(html`<lr-agent-run size="s" .run=${makeRun({ steps })}></lr-agent-run>`));
    });
    expect(dense).to.not.equal(regular);
    expect(warnings).to.have.length(0);
  });

  it('keeps compact working as size="s", warning once', async () => {
    let canonical = '';
    let alias = '';
    let property = '';
    let reads: unknown[] = [];
    const warnings = await captureDeprecationWarnings(COMPACT, async () => {
      canonical = density(await fixture<LyraAgentRun>(html`<lr-agent-run size="s" .run=${makeRun({ steps })}></lr-agent-run>`));
      const aliased = await fixture<LyraAgentRun>(html`<lr-agent-run compact .run=${makeRun({ steps })}></lr-agent-run>`);
      alias = density(aliased);
      const el = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${makeRun({ steps })}></lr-agent-run>`);
      el.compact = true;
      await el.updateComplete;
      property = density(el);
      el.compact = false;
      await el.updateComplete;
      reads = [aliased.size, aliased.compact, el.size, el.compact];
    });
    expect(alias).to.equal(canonical);
    expect(property).to.equal(canonical);
    expect(reads).to.deep.equal(['s', true, 'm', false]);
    expect(warnings.map(({ key }) => key)).to.deep.equal(['lyra-deprecated:lr-agent-run:property:compact']);
  });

  it('applies the last write when compact and size are both authored or set', async () => {
    let reads: unknown[] = [];
    await captureDeprecationWarnings(COMPACT, async () => {
      const sizeLast = await fixture<LyraAgentRun>(html`<lr-agent-run compact size="l" .run=${makeRun({ steps })}></lr-agent-run>`);
      const compactLast = await fixture<LyraAgentRun>(html`<lr-agent-run size="l" compact .run=${makeRun({ steps })}></lr-agent-run>`);
      reads = [sizeLast.size, sizeLast.compact, compactLast.size, compactLast.compact];
    });
    expect(reads).to.deep.equal(['l', false, 's', true]);
  });

  it('syncs and reflects compact back from the canonical size without warning', async () => {
    let reads: unknown[] = [];
    const warnings = await captureDeprecationWarnings(COMPACT, async () => {
      const el = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${makeRun({ steps })}></lr-agent-run>`);
      el.size = 'xs';
      await el.updateComplete;
      reads.push(el.compact, el.hasAttribute('compact'));
      el.size = 'l';
      await el.updateComplete;
      reads.push(el.compact, el.hasAttribute('compact'));
    });
    expect(reads).to.deep.equal([true, true, false, false]);
    expect(warnings).to.have.length(0);
  });
});

describe('lr-agent-run deprecated --lr-agent-run-background alias', () => {
  const fill = (el: LyraAgentRun): string =>
    getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).backgroundColor;

  it('paints from --lr-agent-run-bg, keeps honouring --lr-agent-run-background as its fallback, and lets --lr-agent-run-bg win', async () => {
    const canonical = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${makeRun({ steps })} style="--lr-agent-run-bg: rgb(1, 2, 3)"></lr-agent-run>`);
    const alias = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${makeRun({ steps })} style="--lr-agent-run-background: rgb(1, 2, 3)"></lr-agent-run>`);
    const both = await fixture<LyraAgentRun>(
      html`<lr-agent-run .run=${makeRun({ steps })} style="--lr-agent-run-bg: rgb(4, 5, 6); --lr-agent-run-background: rgb(1, 2, 3)"></lr-agent-run>`,
    );
    expect(fill(canonical)).to.equal('rgb(1, 2, 3)');
    expect(fill(alias)).to.equal('rgb(1, 2, 3)');
    expect(fill(both)).to.equal('rgb(4, 5, 6)');
  });
});

describe('lr-agent-run deprecated show-cancel/show-retry aliases', () => {
  const ALIASES: readonly DeprecatedUsage[] = [
    { tag: 'lr-agent-run', kind: 'property', name: 'showCancel' },
    { tag: 'lr-agent-run', kind: 'property', name: 'showRetry' },
  ];
  const buttons = (el: LyraAgentRun): boolean[] => [
    el.shadowRoot!.querySelector('[part="cancel-button"]') !== null,
    el.shadowRoot!.querySelector('[part="retry-button"]') !== null,
  ];

  it('treats show-cancel="false"/show-retry="false" exactly like without-cancel/without-retry, warning once each', async () => {
    let canonical: boolean[][] = [];
    let alias: boolean[][] = [];
    let property: boolean[][] = [];
    let reads: boolean[] = [];
    const warnings = await captureDeprecationWarnings(ALIASES, async () => {
      for (const kind of ['running', 'error'] as const) {
        const run = makeRun({ status: { kind } });
        canonical.push(buttons(await fixture<LyraAgentRun>(html`<lr-agent-run .run=${run} without-cancel without-retry></lr-agent-run>`)));
        const aliased = await fixture<LyraAgentRun>(
          html`<lr-agent-run .run=${run} show-cancel="false" show-retry="false"></lr-agent-run>`,
        );
        alias.push(buttons(aliased));
        reads = [aliased.showCancel, aliased.showRetry, aliased.withoutCancel, aliased.withoutRetry];
        const el = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${run}></lr-agent-run>`);
        el.showCancel = false;
        el.showRetry = false;
        await el.updateComplete;
        property.push(buttons(el));
      }
    });
    expect(canonical).to.deep.equal([[false, false], [false, false]]);
    expect(alias).to.deep.equal(canonical);
    expect(property).to.deep.equal(canonical);
    expect(reads).to.deep.equal([false, false, true, true]);
    expect(warnings.map(({ key }) => key)).to.deep.equal([
      'lyra-deprecated:lr-agent-run:property:showCancel',
      'lyra-deprecated:lr-agent-run:property:showRetry',
    ]);
  });

  it('keeps a bare show-cancel/show-retry meaning the default, and applies the last write when both spellings are authored', async () => {
    let bare: boolean[] = [];
    let canonicalLast: boolean[] = [];
    let aliasLast: boolean[] = [];
    await captureDeprecationWarnings(ALIASES, async () => {
      const run = makeRun({ status: { kind: 'running' } });
      bare = buttons(await fixture<LyraAgentRun>(html`<lr-agent-run .run=${run} show-cancel show-retry></lr-agent-run>`));
      canonicalLast = buttons(await fixture<LyraAgentRun>(html`<lr-agent-run .run=${run} show-cancel="false" without-cancel></lr-agent-run>`));
      const el = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${run} without-cancel></lr-agent-run>`);
      el.showCancel = true;
      await el.updateComplete;
      aliasLast = buttons(el);
    });
    expect(bare).to.deep.equal([true, false]);
    expect(canonicalLast).to.deep.equal([false, false]);
    expect(aliasLast).to.deep.equal([true, false]);
  });

  it('syncs show-cancel/show-retry back from the canonical properties without warning', async () => {
    let reads: boolean[] = [];
    const warnings = await captureDeprecationWarnings(ALIASES, async () => {
      const el = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${makeRun({ status: { kind: 'running' } })}></lr-agent-run>`);
      el.withoutCancel = true;
      el.withoutRetry = true;
      await el.updateComplete;
      reads = [el.showCancel, el.showRetry];
      el.withoutCancel = false;
      await el.updateComplete;
      reads.push(el.showCancel);
    });
    expect(reads).to.deep.equal([false, false, true]);
    expect(warnings).to.have.length(0);
  });
});

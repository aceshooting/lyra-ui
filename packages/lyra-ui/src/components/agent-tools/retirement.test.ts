import { expect } from '@open-wc/testing';
import { expectDevWarning } from '../../../test/expected-dev-warnings.js';
import './index.js';

const RETIRED_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  'lr-activity-feed': ['compact', 'showTimestamps'],
  'lr-agent-eval-dashboard': ['showChart'],
  'lr-agent-run': ['compact', 'showCancel', 'showRetry'],
  'lr-agent-trace': ['showBars', 'showCost', 'showTokens'],
  'lr-approval-queue': ['editable'],
  'lr-browser-frame': ['controls'],
  'lr-commit-card': ['compact', 'copyable'],
  'lr-confirm-bar': ['compact', 'pending'],
  'lr-json-schema-viewer': [],
  'lr-result-card': ['compact'],
  'lr-span-waterfall': ['hideAxis'],
  'lr-stack-trace': ['collapseInternal', 'compact', 'copyable'],
  'lr-subagent-panel': ['compact'],
  'lr-task-list': ['collapsible', 'compact', 'expanded', 'label'],
  'lr-terminal': ['compact', 'copyable', 'wrap'],
  'lr-test-results': ['autoExpandFailures'],
  'lr-thinking-panel': ['compact'],
  'lr-tool-approval-dialog': ['editable', 'pending'],
  'lr-tool-call-block': ['error'],
  'lr-tool-timeline': ['approvalEditable'],
  'lr-trace-tree': ['hideBars', 'showCost', 'showTokens'],
};

const RETIRED_PROPERTY_BEHAVIOR = [
  ['lr-activity-feed', 'compact', '', 'size', 's', 'm'],
  ['lr-activity-feed', 'showTimestamps', '', 'withTimestamps', true, false],
  ['lr-agent-eval-dashboard', 'showChart', 'false', 'withoutChart', false, false],
  ['lr-agent-run', 'compact', '', 'size', 's', 'm'],
  ['lr-agent-run', 'showCancel', 'false', 'withoutCancel', true, false],
  ['lr-agent-run', 'showRetry', 'false', 'withoutRetry', true, false],
  ['lr-agent-trace', 'showBars', 'false', 'withoutBars', true, false],
  ['lr-agent-trace', 'showCost', '', 'withCost', true, false],
  ['lr-agent-trace', 'showTokens', '', 'withTokens', true, false],
  ['lr-approval-queue', 'editable', 'false', 'readonly', true, false],
  ['lr-browser-frame', 'controls', 'false', 'withoutControls', true, false],
  ['lr-commit-card', 'compact', '', 'size', 's', 'm'],
  ['lr-commit-card', 'copyable', 'false', 'withoutCopyButton', true, false],
  ['lr-confirm-bar', 'compact', '', 'size', 's', 'm'],
  ['lr-confirm-bar', 'pending', 'approve', 'pendingAction', 'approve', null],
  ['lr-result-card', 'compact', '', 'size', 's', 'm'],
  ['lr-span-waterfall', 'hideAxis', '', 'withoutAxis', true, false],
  ['lr-stack-trace', 'collapseInternal', 'false', 'expandInternal', false, false],
  ['lr-stack-trace', 'compact', '', 'size', 's', 'm'],
  ['lr-stack-trace', 'copyable', 'false', 'withoutCopyButton', true, false],
  ['lr-subagent-panel', 'compact', '', 'size', 's', 'm'],
  ['lr-task-list', 'collapsible', 'false', 'withoutCollapse', true, false],
  ['lr-task-list', 'compact', '', 'size', 's', 'm'],
  ['lr-task-list', 'expanded', 'false', 'collapsed', true, false],
  ['lr-task-list', 'label', 'Legacy heading', 'heading', 'Legacy heading', undefined],
  ['lr-terminal', 'compact', '', 'size', 's', 'm'],
  ['lr-terminal', 'copyable', 'false', 'withoutCopyButton', true, false],
  ['lr-terminal', 'wrap', 'false', 'withoutWrap', true, false],
  ['lr-test-results', 'autoExpandFailures', 'false', 'withoutAutoExpandFailures', true, false],
  ['lr-thinking-panel', 'compact', '', 'size', 's', 'm'],
  ['lr-tool-approval-dialog', 'editable', 'false', 'readonly', true, false],
  ['lr-tool-approval-dialog', 'pending', 'deny', 'pendingAction', 'deny', null],
  ['lr-tool-call-block', 'error', 'Legacy error', 'errorText', 'Legacy error', undefined],
  ['lr-tool-timeline', 'approvalEditable', 'false', 'approvalReadonly', true, false],
  ['lr-trace-tree', 'hideBars', '', 'withoutBars', true, false],
  ['lr-trace-tree', 'showCost', '', 'withCost', true, false],
  ['lr-trace-tree', 'showTokens', '', 'withTokens', true, false],
] as const;

it('leaves every retired agent-tools property outside the registered Lit API', () => {
  for (const [tag, names] of Object.entries(RETIRED_PROPERTIES)) {
    const constructor = customElements.get(tag) as (CustomElementConstructor & {
      elementProperties?: Map<string, unknown>;
    }) | undefined;
    expect(constructor, `${tag} is registered`).to.exist;
    const properties = constructor!.elementProperties;
    expect(properties, `${tag} publishes its Lit property metadata`).to.exist;
    for (const name of names) {
      expect(properties!.has(name), `${tag}.${name} is retired`).to.equal(false);
    }
  }
});

it('ignores retired attributes and expando writes while canonical properties stay at their defaults', async () => {
  const inverted = new Set([
    'showChart', 'showCancel', 'showRetry', 'showBars', 'editable', 'controls', 'copyable',
    'collapseInternal', 'expanded', 'collapsible', 'wrap', 'autoExpandFailures', 'approvalEditable',
  ]);
  for (const [tag, alias, value, canonical, aliasValue, defaultValue] of RETIRED_PROPERTY_BEHAVIOR) {
    const attribute = alias.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
    const fromAttribute = document.createElement(tag) as HTMLElement & { updateComplete: Promise<unknown> };
    expectDevWarning(`lyra-unknown-attribute:${tag}:${attribute}`);
    fromAttribute.setAttribute(attribute, value);
    document.body.append(fromAttribute);
    try {
      await fromAttribute.updateComplete;
      expect((fromAttribute as unknown as Record<string, unknown>)[canonical], `${tag}.${attribute} is inert`).to.equal(defaultValue);
    } finally {
      fromAttribute.remove();
    }

    const fromProperty = document.createElement(tag) as HTMLElement & { updateComplete: Promise<unknown> };
    document.body.append(fromProperty);
    try {
      await fromProperty.updateComplete;
      const oldValue = inverted.has(alias) ? false : alias === 'compact' ? true : aliasValue;
      (fromProperty as unknown as Record<string, unknown>)[alias] = oldValue;
      await fromProperty.updateComplete;
      expect((fromProperty as unknown as Record<string, unknown>)[canonical], `${tag}.${alias} writes are inert`).to.equal(defaultValue);
    } finally {
      fromProperty.remove();
    }

    const canonicalElement = document.createElement(tag) as HTMLElement & { updateComplete: Promise<unknown> };
    document.body.append(canonicalElement);
    try {
      await canonicalElement.updateComplete;
      const canonicalValue = alias === 'compact' ? 's' : typeof defaultValue === 'boolean' ? !defaultValue : aliasValue;
      (canonicalElement as unknown as Record<string, unknown>)[canonical] = canonicalValue;
      await canonicalElement.updateComplete;
      expect((canonicalElement as unknown as Record<string, unknown>)[canonical], `${tag}.${canonical} remains writable`).to.equal(canonicalValue);
    } finally {
      canonicalElement.remove();
    }
  }
});

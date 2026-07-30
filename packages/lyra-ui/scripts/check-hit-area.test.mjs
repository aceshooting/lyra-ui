#!/usr/bin/env node

// Fixture-level companion to check-hit-area.mjs. It freezes the intentionally
// narrow 40px compact-control and WCAG 2.5.8 24px/spacing boundaries so future
// changes cannot turn the static icon heuristic into a blanket rule for text,
// full-row, native, or data-geometry controls.

import assert from 'node:assert/strict';
import {
  checkStaticHitAreaFixture,
  findMeasuredHitAreaViolations,
  targetHitAreaContract,
} from './check-hit-area.mjs';

function target(overrides) {
  return {
    component: 'lr-fixture',
    part: 'target',
    widthPx: 8,
    heightPx: 8,
    nearestTargetCenterDistancePx: 8,
    ...overrides,
  };
}

const included = [
  target({ component: 'lr-avatar-group', part: 'overflow-badge', size: 'sm' }),
  target({ component: 'lr-avatar-group', part: 'overflow-badge', size: 'md' }),
  target({ component: 'lr-avatar-group', part: 'overflow-badge' }),
  target({ component: 'lr-rating', part: 'base', max: 0 }),
  target({ component: 'lr-rating', part: 'base', max: 1 }),
  target({ component: 'lr-calendar', part: 'event' }),
  target({ component: 'lr-segmented', part: 'segment', size: '2xs' }),
  target({ component: 'lr-segmented', part: 'segment', size: 'xs' }),
  target({ component: 'lr-embedding-explorer', part: 'point', allocationPx: 383 }),
  target({ component: 'lr-graph', part: 'node', renderer: 'svg', cameraScale: 0.25 }),
  target({ component: 'lr-graph', part: 'node', renderer: 'canvas', cameraScale: 0.25 }),
  target({ component: 'lr-graph', part: 'link', renderer: 'svg', cameraScale: 0.25 }),
  target({ component: 'lr-graph', part: 'link', renderer: 'canvas', cameraScale: 0.25 }),
  target({
    component: 'lr-graph',
    part: 'hull',
    renderer: 'svg',
    cameraScale: 0.25,
    needsExpandedHullPick: true,
  }),
  target({
    component: 'lr-graph',
    part: 'hull',
    renderer: 'canvas',
    cameraScale: 0.25,
    needsExpandedHullPick: true,
  }),
];

assert.deepEqual(
  included.map((fixture) => targetHitAreaContract(fixture)?.minimumPx),
  [40, 40, 40, 40, 40, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
  'the approved compact and physical-target states participate at their exact floors',
);

const violations = findMeasuredHitAreaViolations(included);
assert.equal(violations.length, included.length, 'every undersized approved target is rejected');
assert.match(violations[0], /lr-avatar-group::part\(overflow-badge\).*40px/);
assert.match(violations.at(-1), /lr-graph::part\(hull\).*24px/);

const repaired = included.map((fixture) => {
  const minimumPx = targetHitAreaContract(fixture).minimumPx;
  return {
    ...fixture,
    widthPx: minimumPx,
    heightPx: minimumPx,
  };
});
assert.deepEqual(
  findMeasuredHitAreaViolations(repaired),
  [],
  'targets meeting their applicable 40px or 24px floor pass',
);

assert.deepEqual(
  findMeasuredHitAreaViolations([
    target({
      component: 'lr-calendar',
      part: 'event',
      widthPx: 18,
      heightPx: 20,
      nearestTargetCenterDistancePx: 24,
    }),
    target({
      component: 'lr-graph',
      part: 'link',
      renderer: 'canvas',
      widthPx: 80,
      heightPx: 8,
      nearestTargetCenterDistancePx: 30,
    }),
  ]),
  [],
  'the WCAG 24px contract accepts an undersized target with sufficient target spacing',
);

const excluded = [
  target({ component: 'lr-document-library', part: 'action', controlKind: 'text' }),
  target({ component: 'lr-breadcrumb', part: 'item', controlKind: 'text' }),
  target({ component: 'lr-drilldown', part: 'item', controlKind: 'full-row' }),
  target({ component: 'lr-menu', part: 'item', controlKind: 'full-row' }),
  target({ component: 'lr-dropdown', part: 'item', controlKind: 'full-row' }),
  target({ component: 'lr-stepper', part: 'step', controlKind: 'text' }),
  target({ component: 'lr-segmented', part: 'segment', size: 's' }),
  target({ component: 'lr-segmented', part: 'segment', size: 'm' }),
  target({ component: 'lr-segmented', part: 'segment', size: 'l' }),
  target({ component: 'lr-segmented', part: 'segment', size: 'xl' }),
  target({ component: 'lr-av-player', part: 'rate', controlKind: 'text' }),
  target({ component: 'lr-av-player', part: 'cue', controlKind: 'text' }),
  target({ component: 'lr-av-player', part: 'seek', controlKind: 'native-range' }),
  target({ component: 'lr-chip-group', part: 'overflow-indicator', controlKind: 'text' }),
  target({ component: 'lr-rating', part: 'base', max: 2 }),
  target({ component: 'lr-rating', part: 'base', max: 5 }),
  target({ component: 'lr-embedding-explorer', part: 'point', allocationPx: 384 }),
  target({
    component: 'lr-graph',
    part: 'hull',
    renderer: 'canvas',
    needsExpandedHullPick: false,
  }),
  target({
    component: 'lr-graph',
    part: 'hull',
    renderer: 'svg',
    needsExpandedHullPick: false,
  }),
  target({ component: 'lr-notebook-viewer', part: 'action', controlKind: 'text' }),
  target({ component: 'lr-xml-viewer', part: 'action', controlKind: 'full-row' }),
  target({ component: 'lr-email-viewer', part: 'action', controlKind: 'text' }),
  target({ component: 'lr-document-preview', part: 'action', controlKind: 'text' }),
  target({ component: 'lr-document-viewer', part: 'action', controlKind: 'full-row' }),
  target({ component: 'lr-pdf-viewer', part: 'action', controlKind: 'text' }),
];

assert.ok(
  excluded.every((fixture) => targetHitAreaContract(fixture) === null),
  'ordinary text/full-row/native controls and the approved size/state exclusions stay outside the policy',
);
assert.deepEqual(
  findMeasuredHitAreaViolations(excluded),
  [],
  'excluded controls never become blanket hit-area false positives',
);

const compactIconClass = `
  class Fixture {
    render() {
      return html\`<button part="toggle" aria-label="Toggle">\${closeIcon()}</button>\`;
    }
  }
`;
const compactIconTooSmall = `
  [part='toggle'] {
    min-inline-size: 24px;
    min-block-size: 24px;
  }
`;
const compactIconCompliant = `
  [part='toggle'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
`;

const tooSmall = checkStaticHitAreaFixture(compactIconClass, [compactIconTooSmall]);
assert.equal(tooSmall.candidateCount, 1, 'a compact icon button reaches the static checker');
assert.equal(tooSmall.errors.length, 2, 'both undersized axes are actionable findings');
assert.match(tooSmall.errors[0], /resolves to 24px.*below the 40px floor/);

assert.deepEqual(
  checkStaticHitAreaFixture(compactIconClass, [compactIconCompliant]).errors,
  [],
  'a compact icon button using the shared floor passes',
);

for (const [name, classSource] of [
  [
    'localized text action',
    `class Fixture { render() { return html\`<button part="action">\${this.localize('download')}</button>\`; } }`,
  ],
  [
    'full-row composite action',
    `class Fixture { render() { return html\`<button part="row"><span part="label">Row label</span></button>\`; } }`,
  ],
  [
    'native range',
    `class Fixture { render() { return html\`<input part="seek" type="range" />\`; } }`,
  ],
  [
    'SVG data geometry',
    `class Fixture { render() { return svg\`<circle part="point" role="button" tabindex="0" r="8"></circle>\`; } }`,
  ],
]) {
  const result = checkStaticHitAreaFixture(classSource, [
    `[part='action'], [part='row'], [part='seek'], [part='point'] {
      min-inline-size: 8px;
      min-block-size: 8px;
    }`,
  ]);
  assert.deepEqual(result.errors, [], `${name} is not a blanket 40px false positive`);
}

console.log('Hit-area checker self-tests passed.');

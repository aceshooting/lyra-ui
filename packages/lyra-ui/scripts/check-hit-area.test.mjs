#!/usr/bin/env node

// Fixture-level companion to check-hit-area.mjs. It freezes the intentionally
// narrow 40px compact-control and WCAG 2.5.8 24px/spacing boundaries so future
// changes cannot turn the static icon heuristic into a blanket rule for text,
// full-row, native, or data-geometry controls.

import assert from 'node:assert/strict';
import {
  checkStaticHitAreaFixture,
  resolveStylesSources,
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
  target({ component: 'lr-media-card', part: 'base', mediaKind: 'image' }),
  target({ component: 'lr-graph', part: 'node', renderer: 'svg', cameraScale: 0.25 }),
  target({ component: 'lr-graph', part: 'node', renderer: 'canvas', cameraScale: 0.25 }),
  target({ component: 'lr-graph', part: 'link', renderer: 'svg', cameraScale: 0.25 }),
  target({ component: 'lr-graph', part: 'link', renderer: 'canvas', cameraScale: 0.25 }),
  target({ component: 'lr-span-waterfall', part: 'bar' }),
  target({ component: 'lr-radio-button', part: 'base' }),
  target({ component: 'lr-breadcrumb-item', part: 'base' }),
  target({ component: 'lr-map', part: 'marker' }),
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
  [40, 40, 40, 40, 40, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
  'the approved compact and physical-target states participate at their exact floors',
);

const violations = findMeasuredHitAreaViolations(included);
assert.equal(violations.length, included.length, 'every undersized approved target is rejected');
assert.match(violations[0], /lr-avatar-group::part\(overflow-badge\).*40px/);
assert.ok(violations.some((finding) => /lr-graph::part\(hull\).*24px/.test(finding)));
assert.ok(violations.some((finding) => /lr-map::part\(marker\).*24px/.test(finding)));

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

assert.equal(
  findMeasuredHitAreaViolations([
    target({
      component: 'lr-span-waterfall',
      part: 'bar',
      widthPx: 24,
      heightPx: 8,
      nearestTargetCenterDistancePx: Number.POSITIVE_INFINITY,
    }),
  ]).length,
  1,
  'an explicitly physical floor must pass in both axes and cannot rely on target spacing',
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
  target({ component: 'lr-media-card', part: 'base', mediaKind: 'file' }),
  target({ component: 'lr-media-card', part: 'base', mediaKind: 'video' }),
  target({ component: 'lr-media-card', part: 'base' }),
  target({ component: 'lr-media-card', part: 'open-button', mediaKind: 'video' }),
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
assert.match(tooSmall.errors[0], /resolves to 24px.*below the 36px floor/);

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


// --- multi-token part names and nested conditionals ---------------------------------------------
// State belongs in the part name (`part="base base-error"`) because `::part(base)[state]` never
// matches. The checker used to demand a separately-sized rule for EVERY token of such a name, and
// to read a nested conditional's CONDITION literals as part names -- so a component doing exactly
// what the contract requires was reported for a `[part='error']` rule that must never exist.

const statePartClass = `
  render() {
    const part =
      this.status === 'success' ? 'base base-success' : this.status === 'error' ? 'base base-error' : 'base';
    return html\`<button part=\${part} type="button"></button>\`;
  }
`;
const sizedBaseOnly = `
  [part='base'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
`;

assert.deepEqual(
  checkStaticHitAreaFixture(statePartClass, [sizedBaseOnly]).errors,
  [],
  'a multi-token part name is one element: the floor met by `base` covers `base base-error` too',
);

const unsizedBase = `
  [part='base'] { display: inline-flex; }
`;
const unsizedErrors = checkStaticHitAreaFixture(statePartClass, [unsizedBase]).errors;
assert.ok(
  unsizedErrors.length > 0,
  'a multi-token part name whose tokens are all unsized is still reported',
);
assert.ok(
  unsizedErrors.every((error) => !/part='error'/.test(error)),
  "a nested conditional's condition literals are never treated as part names",
);


const sharedHitTarget = `
import { iconHitTarget } from '../../../internal/interactive-control.styles.js';
export const styles = css\`
  [part='toggle'] { \${iconHitTarget} }
\`;
`;
assert.equal(checkStaticHitAreaFixture(compactIconClass, [sharedHitTarget]).errors.length, 0,
  'the imported shared target floor satisfies both axes');
assert.ok(checkStaticHitAreaFixture(compactIconClass, [sharedHitTarget + `
  [part='toggle']:where([data-small]) { min-inline-size: 1px; }
`]).errors.length > 0, 'a later undersized override still fails the shared floor');
assert.ok(checkStaticHitAreaFixture(compactIconClass, [sharedHitTarget.replace('internal/interactive-control.styles.js', 'unrelated.styles.js')]).errors.length > 0,
  'an unrelated declaration with the same identifier does not satisfy the floor');
assert.ok(checkStaticHitAreaFixture(compactIconClass, [sharedHitTarget.replace('import { iconHitTarget }', '// import { iconHitTarget }')]).errors.length > 0,
  'a commented import cannot authorize a shared floor');
assert.ok(checkStaticHitAreaFixture(compactIconClass, [sharedHitTarget.replace('import { iconHitTarget }', 'import { iconHitTarget as other }')]).errors.length > 0,
  'an alias does not bind the original local identifier');
assert.equal(checkStaticHitAreaFixture(compactIconClass, [sharedHitTarget.replace('import { iconHitTarget }', 'import { iconHitTarget as floor }').replace('${iconHitTarget}', '${floor}')]).errors.length, 0,
  'an imported alias is recognized at its real interpolation');
assert.ok(checkStaticHitAreaFixture(compactIconClass, [sharedHitTarget.replace('export const styles = css`', 'function nested(iconHitTarget) { return css`') + '}']).errors.length > 0,
  'a shadowed parameter does not inherit the top-level import binding');
assert.ok(checkStaticHitAreaFixture(compactIconClass, [
  `const note = "import { iconHitTarget } from '../../../internal/interactive-control.styles.js';";\n` +
  sharedHitTarget.slice(sharedHitTarget.indexOf('export const styles')),
]).errors.length > 0, 'a string-literal fake import cannot authorize the floor');
assert.ok(checkStaticHitAreaFixture(compactIconClass, [
  sharedHitTarget.replace('${iconHitTarget}', '${iconHitTarget} min-inline-size: 1px;'),
]).errors.length > 0, 'an undersized override inside the same rule still fails the shared floor');
assert.ok(checkStaticHitAreaFixture(compactIconClass, [
  sharedHitTarget.replace('${iconHitTarget}', '${iconHitTarget} min-inline-size: 1px'),
]).errors.length > 0, 'a final semicolonless override still fails the shared floor');

assert.equal(checkStaticHitAreaFixture(compactIconClass, [sharedHitTarget.replace('../../../internal/interactive-control.styles.js', './interactive-control.styles.js')]).errors.length, 0,
  'internal styles resolve the same imported hit-target declaration');


const adoptedActionClass = `
  import { actionStyles as actions } from '../shared/action.styles.js';
  import { unrelated } from '../shared/unrelated.styles.js';
  class Fixture {
    static styles = [actions];
    render() { return html\`<button part="toggle" data-action="neutral">\${closeIcon()}</button>\`; }
  }
`;
const actionSheet = `export const actionStyles = css\`
  button[data-action] { min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); }
\`;`;
const fixtureSources = new Map([
  ['/fixture/shared/action.styles.ts', actionSheet],
  ['/fixture/shared/unrelated.styles.ts', `export const unrelated = css\`[part='toggle'] { min-inline-size: 100px; min-block-size: 100px; }\`;`],
]);
const resolveActionStyles = (source = adoptedActionClass, files = fixtureSources) =>
  resolveStylesSources('/fixture/component/example.class.ts', source, (file) => files.get(file));
assert.equal(resolveActionStyles().length, 1, 'only adopted stylesheet bindings count, not unrelated imports');
assert.deepEqual(checkStaticHitAreaFixture(adoptedActionClass, resolveActionStyles()).errors, [],
  'an adopted shared rule guards the matching data-attribute target');
for (const [name, css] of [
  ['undersized override', actionSheet.replace('min-block-size: var(--lr-icon-button-size); }', 'min-block-size: var(--lr-icon-button-size); } button[data-action]:hover { min-inline-size: 1px; }')],
  ['conditional undersized override', actionSheet.replace('min-block-size: var(--lr-icon-button-size); }', 'min-block-size: var(--lr-icon-button-size); } button[data-action]:where(:not(:disabled)):hover { min-inline-size: 1px; }')],
  ['wrong attribute value', actionSheet.replace('button[data-action]', "button[data-action='brand']")],
  ['wrong element', actionSheet.replace('button[data-action]', 'a[data-action]')],
  ['descendant target', actionSheet.replace('button[data-action]', 'button[data-action] span')],
  ['pseudo-element', actionSheet.replace('button[data-action]', 'button[data-action]::before')],
  ['one missing axis', actionSheet.replace('min-block-size: var(--lr-icon-button-size);', '')],
]) {
  assert.ok(checkStaticHitAreaFixture(adoptedActionClass, [css]).errors.length > 0, name);
}
assert.ok(checkStaticHitAreaFixture(adoptedActionClass.replace('data-action="neutral"', ''), [actionSheet]).errors.length > 0,
  'the shared data attribute cannot guard a target that does not carry it');
assert.ok(checkStaticHitAreaFixture(adoptedActionClass.replace('static styles = [actions]', 'static styles = []'),
  resolveActionStyles(adoptedActionClass.replace('static styles = [actions]', 'static styles = []'))).errors.length > 0,
  'importing without adopting a shared stylesheet cannot establish a floor');
const mixedExports = new Map([['/fixture/shared/action.styles.ts',
  `export const actionStyles = css\`button[data-action] { display: inline-flex; }\`;
${actionSheet.replace('actionStyles', 'unusedStyles')}`]]);
assert.ok(checkStaticHitAreaFixture(adoptedActionClass, resolveActionStyles(adoptedActionClass, mixedExports)).errors.length > 0,
  'an unused export in an adopted module cannot supply the missing floor');
assert.throws(() => resolveActionStyles(adoptedActionClass, new Map()), /Cannot read adopted stylesheet/,
  'missing adopted sources fail closed');
assert.throws(() => resolveActionStyles(adoptedActionClass, new Map([['/fixture/shared/action.styles.ts', 'export const wrong = 1;']])), /Cannot resolve adopted stylesheet/,
  'unresolved adopted exports fail closed');
assert.deepEqual(resolveStylesSources('/fixture/internal/native-search.ts', 'export function render() {}',
  (file) => file === '/fixture/internal/native-search.styles.ts' ? actionSheet : undefined), [actionSheet],
  'internal render helpers resolve the adjacent stylesheet without duplicating the .ts suffix');



for (const qualifier of [':hover', ':where(:not(:disabled)):hover', ':focus-visible']) {
  const stateOnly = actionSheet.replace('button[data-action]', `button[data-action]${qualifier}`);
  assert.ok(checkStaticHitAreaFixture(adoptedActionClass, [stateOnly]).errors.length > 0,
    `${qualifier} alone cannot establish the resting floor`);
}
const unrelatedSibling = new Map(fixtureSources);
unrelatedSibling.set('/fixture/component/example.styles.ts', actionSheet);
const explicitlyEmptyStyles = adoptedActionClass.replace('static styles = [actions]', 'static styles = []');
assert.deepEqual(resolveActionStyles(explicitlyEmptyStyles, unrelatedSibling), [],
  'an explicit empty styles array cannot fall back to an unrelated adjacent stylesheet');
assert.ok(checkStaticHitAreaFixture(explicitlyEmptyStyles, resolveActionStyles(explicitlyEmptyStyles, unrelatedSibling)).errors.length > 0,
  'a sibling floor cannot authorize an explicitly unstyled target');
console.log('Hit-area checker self-tests passed.');

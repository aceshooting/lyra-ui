import assert from 'node:assert/strict';
import { compatibilityKey } from '../packages/lyra-ui/scripts/published-compatibility.mjs';

const templateHandlerExpression = '${handler}';

/** A retirement cohort remains applicable in every later stable package release. */
export function assertMigrationPackageVersion(version, minimumMajor = 24) {
  const match = typeof version === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(version);
  assert.ok(match && match.slice(1).every(part => Number.isSafeInteger(Number(part))), 'Installed migration package version must be a stable semantic version');
  const major = Number(match[1]);
  assert.ok(major >= minimumMajor, `Migration cohort requires an installed v${minimumMajor} or later package`);
  return major;
}
// These target events are also dispatched by nested components. The migration scanner
// requires an owner/target review before moving a listener, even though the ledger names
// the replacement event.
const sharedTargetEventReviews = new Set([
  'lr-graph\u0000lr-node-click',
  'lr-knowledge-graph-explorer\u0000lr-node-click',
  'lr-markdown\u0000lr-link-click',
  'lr-markdown-core\u0000lr-link-click',
  'lr-message-parts\u0000lr-link-click',
]);

const manualProperties = {
  compact: ['size', "'s'"], emptyCompact: ['emptySize', "'s'"],
  hideColumnsLabel: ['columnsHideLabel', "'Consumer value'"],
  noColumnsDescription: ['emptyColumnsDescription', "'Consumer value'"],
  noColumnsHeading: ['emptyColumnsHeading', "'Consumer value'"],
  observeAttributes: ['attr', "'*'"],
};

const propertyValues = {
  'boolean': 'true', 'boolean | undefined': 'true',
  'number': '240', 'number | undefined': '2',
  'string': "'Consumer value'", 'string | undefined': "'Consumer value'",
  'ChatMessageActionsPosition': "'outside'", "'before' | 'after'": "'before'",
  'ApprovalAction | null': "'approve'", 'ToolApprovalDialogPending': "'approve'",
  'LyraDockPanelEdge': "'start'", 'readonly string[]': "['ab']",
  'readonly LyraGraphLink[]': "[{ id: 'ab', source: 'a', target: 'b' }]",
};

/** Concrete syntax recipes, with policy identities supplied by the existing compatibility authority. */
export function createMemberMigrationCases(context, ledger) {
  const profile = ledger.profiles.find(profile => profile.origin === 'lyra-v21');
  assert.ok(profile, 'Missing published v21 migration profile');
  const records = Object.values(context.records).filter(record => record.key.scope === 'member' &&
    record.key.kind !== 'component' && record.policy.removalNotBefore === '23.0.0');
  assert.equal(records.length, 390, 'Member cohort must contain exactly390 reviewed identities');
  const keys = records.map(record => compatibilityKey(record.key));
  assert.equal(new Set(keys).size, keys.length, 'Duplicate member identity');
  return records.map(record => {
    const { tag, kind, name } = record.key;
    const rule = profile.renames.find(item => item.tag === tag && item.kind === kind && item.from === name);
    const review = profile.reviews.find(item => item.tag === tag && item.kind === kind && item.name === name);
    const slotContent = kind === 'slot-content' && profile.slotContent.find(item => item.tag === tag && item.slot === name);
    assert.ok(Boolean(rule) !== Boolean(review || slotContent), `Missing or conflicting recipe: ${compatibilityKey(record.key)}`);
    if (rule) assert.equal(rule.to, record.policy.replacement.name, 'Ledger and policy target differ');
    const target = rule?.to ?? record.policy.replacement.name;
    // Events and CSS declarations reach nested components. Bind expectations to independently checked
    // exposure rather than assuming a published rename stays global as new components adopt it.
    const exposureKind = kind === 'event' ? 'event' : 'css-property';
    const surface = kind === 'event' ? 'events' : 'cssProperties';
    const exposedBy = (name) => context.exposure?.[exposureKind]?.[name] ??
      Object.values(context.sourceComponents ?? {}).filter(component =>
        component.surface?.[surface]?.some(member => member.name === name)).map(component => component.tag);
    const sharedRenames = ['css-property', 'event'].includes(kind) && rule
      ? profile.renames.filter(entry => entry.kind === kind && entry.from === name) : [];
    const movingOwners = new Set(sharedRenames.filter(entry => entry.to === target && !entry.polarity).map(entry => entry.tag));
    const targetKeepers = sharedRenames.length ? exposedBy(target).filter(owner => !movingOwners.has(owner)).sort() : [];
    const sharedTargetReview = targetKeepers.length > 0;
    if (sharedTargetReview && kind === 'css-property') {
      assert.ok(sharedRenames.every(entry => entry.to === target && !entry.polarity), 'Shared CSS target must have one uninverted replacement');
      assert.ok(exposedBy(name).every(owner => movingOwners.has(owner)), 'Shared CSS source ownership needs a separate reviewed recipe');
    }
    const anchor = `document.querySelector('${tag}')!`;
    let input; let resolved; let extension = 'ts'; let column;
    if (kind === 'property') {
      const sourceMember = record.sourceMember ?? context.sourceComponents?.[tag]?.surface.properties.find(property => property.name === name);
      assert.ok(sourceMember, `Missing source property type: ${tag}.${name}`);
      const value = propertyValues[sourceMember.type];
      assert.ok(value, `No reviewed typed value for ${tag}.${name}: ${sourceMember.type}`);
      input = `${anchor}.${name} = ${value};\n`;
      column = anchor.length + 2;
      if (rule) resolved = `${anchor}.${target} = ${rule.polarity === 'inverted' ? 'false' : value};\n`;
      else if (name === 'fixedWidth') resolved = `${anchor}.style.inlineSize = '1.5em';\n`;
      else {
        assert.ok(manualProperties[name], `Unknown property resolution: ${name}`);
        const [property, value] = manualProperties[name];
        assert.equal(property, target);
        resolved = `${anchor}.${property} = ${value};\n`;
      }
    } else if (kind === 'attribute') {
      assert.equal(name, 'accessible-label'); assert.equal(target, 'aria-label');
      extension = 'html'; input = `<${tag} ${name}="Consumer name"${tag === 'lr-attachment-trigger' ? ' multiple' : ''}></${tag}>\n`;
      resolved = `<${tag} aria-label="Consumer name"${tag === 'lr-attachment-trigger' ? ' multiple' : ''}></${tag}>\n`; column = tag.length + 3;
    } else if (kind === 'event') {
      input = `${anchor}.addEventListener('${name}', event => console.log(event));\n`;
      resolved = `${anchor}.addEventListener('${target}', event => console.log(event));\n`;
      if (sharedTargetReview) {
        resolved = `${anchor}.addEventListener('${target}', event => { if (event.target !== event.currentTarget) return; console.log(event); });\n`;
      }
      if (tag === 'lr-avatar-group') {
        input = `const view = html\`<${tag} size="medium" @${name}=${templateHandlerExpression}></${tag}>\`;\n`;
        resolved = input.replace(name, target);
      }
      if (tag === 'lr-graph' && review) {
        input = input.replace('console.log(event)', 'console.log(event.detail.linkId)');
        resolved = resolved.replace('console.log(event)', 'console.log(event.detail.edgeId)');
      }
      column = input.lastIndexOf(name) + 1;
    } else if (kind === 'css-property') {
      const value = /(?:duration|stagger-[12])$/u.test(name) ? '120ms' : /(?:size|width|indent|gap)$/u.test(name) ? '3px' : 'rgb(12, 34, 56)';
      extension = 'css'; input = `${tag} { ${name}: ${value}; }\n`;
      resolved = `${tag} { ${target}: ${value}; }\n`; column = input.indexOf(name) + 1;
    } else if (kind === 'part') {
      extension = 'css'; input = `${tag}::part(${name}) { opacity: 0.75; }\n`;
      resolved = `${tag}::part(${target}) { opacity: 0.75; }\n`; column = input.indexOf(name, tag.length) + 1;
    } else if (kind === 'slot' || kind === 'slot-content') {
      assert.equal(name, ''); extension = 'html';
      input = `<${tag}><span>Consumer heading</span></${tag}>\n`;
      resolved = `<${tag}><span slot="${target}">Consumer heading</span></${tag}>\n`;
      column = tag.length + 4;
    } else assert.fail(`Unsupported member recipe: ${kind}`);
    return { id: [tag, kind, name || 'default'].join('_').replaceAll(/[^a-zA-Z0-9_-]/gu, '_'),
      key: record.key, record, input, resolved, extension, column, rule, review, slotContent, sharedTargetReview, targetKeepers,
      reportedTag: kind === 'css-property' && rule && new Set(profile.renames.filter(entry => entry.kind === kind && entry.from === name).map(entry => entry.tag)).size > 1 ? null : tag,
      resolvedByOrigin: sharedTargetReview && kind === 'css-property' ? {
        'lyra-v21': `/* lyra-migrate-reviewed: NAME_GAINED_OWNER_REVIEW:${target} */\n${resolved}`,
        'lyra-v22': resolved,
      } : tag === 'lr-graph' && kind === 'event' && review ? {
        'lyra-v21': `// lyra-migrate-reviewed: DETAIL_SHAPE_REVIEW:${target}\n${resolved}`,
        'lyra-v22': resolved,
      } : undefined,
      resolvedAcknowledgementsByOrigin: {
        'lyra-v21': Number((sharedTargetReview && kind === 'css-property') || (tag === 'lr-graph' && kind === 'event' && Boolean(review))),
        'lyra-v22': 0,
      },
      automatic: Boolean(rule && rule.polarity !== 'inverted' && !sharedTargetReview) };
  });
}

/** Exact primary witnesses; no extra rewrite or diagnostic can be hidden by a successful exit. */
export function assertMemberMigrationReport(report, cases, origin) {
  assert.equal(report.schemaVersion, 1); assert.equal(report.origin, origin);
  assert.ok(Array.isArray(cases) && cases.every(item => item?.record?.policy && typeof item.record.policy.removalNotBefore === 'string'),
    'Member migration witnesses must retain their source policy');
  const active = cases.filter(item => item.record.policy.removalNotBefore === (origin === 'lyra-v21' ? '23.0.0' : '24.0.0'));
  const rewritten = active.filter(item => item.automatic);
  const reviewed = active.filter(item => !item.automatic);
  assert.equal(report.changes.length, rewritten.length);
  assert.equal(report.warnings.length, reviewed.length);
  assert.equal(report.summary.rewrites, rewritten.length);
  assert.equal(report.summary.warnings, reviewed.length);
  assert.equal(report.summary.acknowledged, 0);
  assert.equal(report.filesChanged, rewritten.length);
  for (const [items, actual] of [[rewritten, report.changes], [reviewed, report.warnings]]) {
    const remaining = [...actual];
    for (const item of items) {
      const index = remaining.findIndex(site => site.file === item.file && site.line === 1 && site.column === item.column);
      assert.notEqual(index, -1, `Missing exact witness for ${item.id}: ${JSON.stringify(actual)}`);
      const [site] = remaining.splice(index, 1);
      assert.equal(site.origin, origin); assert.equal(site.upstreamTag, item.reportedTag);
      assert.equal(site.upstreamMember, item.slotContent ? 'span' : item.key.name);
      if (item.automatic) {
        assert.equal(site.action, `rewrite-${item.key.kind}`);
        assert.equal(site.warningCode, null); assert.equal(site.target, item.rule.to);
      } else {
        assert.equal(site.action, 'manual-review');
        assert.equal(site.warningCode, item.sharedTargetReview ? 'RENAME_TARGET_SHARED_REVIEW' : item.slotContent ? 'DEPRECATED_CONTENT_REVIEW' : item.rule?.polarity === 'inverted' ? 'POLARITY_REVIEW' : 'DEPRECATED_MEMBER_REVIEW');
        assert.equal(site.target, item.slotContent ? null : item.rule?.to ?? item.record.policy.replacement.usage ?? item.record.policy.replacement.name);
        if (item.sharedTargetReview) {
          assert.match(site.message, item.key.kind === 'event'
            ? /ignore events whose target is not this/ : /Custom properties inherit into nested components/);
          for (const owner of item.targetKeepers) assert.ok(site.message.includes(owner), `Shared target warning omitted ${owner}`);
        }
        if (item.review && item.record.state === 'retired') assert.ok(site.message.includes('was removed in 23.0.0'), site.message);
      }
    }
  }
}

/** Build executable, source-bound diagnostics for the historical v24 member cohort. */
export function createV24MemberMigrationCases(context, ledger) {
  assertMigrationPackageVersion(context.packageVersion);
  const profile = ledger?.profiles?.find(item => item.origin === 'lyra-v22');
  assert.ok(profile, 'Missing authored v22 migration profile');
  const records = Object.values(context.records).filter(record => record.key.scope === 'member' && record.policy.removalNotBefore === '24.0.0');
  assert.equal(records.length, 44, 'The v24 member cohort must contain exactly44 identities');
  return records.sort((left, right) => {
    const a = compatibilityKey(left.key); const b = compatibilityKey(right.key);
    return a < b ? -1 : a > b ? 1 : 0;
  }).map((record, index) => {
    assert.equal(record.state, 'retired', `v24 candidate did not retire ${compatibilityKey(record.key)}`);
    assert.equal(record.removedIn, '24.0.0', `Unexpected v24 retirement for ${compatibilityKey(record.key)}`);
    const { tag, kind, name } = record.key;
    const rule = profile.renames.find(item => item.tag === tag && item.kind === kind && item.from === name);
    const review = profile.reviews.find(item => item.tag === tag && item.kind === kind && item.name === name);
    assert.ok(Boolean(rule) !== Boolean(review), `Missing or conflicting v24 migration recipe: ${compatibilityKey(record.key)}`);
    if (rule) assert.equal(rule.to, record.policy.replacement.name, `V24 ledger and policy target differ: ${compatibilityKey(record.key)}`);
    let extension = 'ts';
    let input;
    let resolved;
    if (kind === 'property') {
      const oldValue = name === 'arrow' || name === 'compact' ? 'true' : "'Consumer value'";
      input = `document.querySelector('${tag}')!.${name} = ${oldValue};\n`;
      if (name === 'accessibleLabel') resolved = `document.querySelector('${tag}')!.setAttribute('aria-label', 'Consumer value');\n`;
      else if (name === 'arrow') resolved = `document.querySelector('${tag}')!.withoutArrow = false;\n`;
      else if (name === 'compact') resolved = `document.querySelector('${tag}')!.size = 's';\n`;
      else assert.fail(`Unknown v24 property resolution: ${tag}.${name}`);
    } else if (kind === 'attribute') {
      extension = 'html';
      input = `<${tag} ${name}="Consumer name"></${tag}>\n`;
      resolved = `const resolved = html\`<${tag} aria-label="Consumer name"></${tag}>\`;\n`;
    } else if (kind === 'event') {
      assert.equal(typeof record.policy.replacement.name, 'string', `Event has no reviewed replacement name: ${compatibilityKey(record.key)}`);
      input = `document.querySelector('${tag}')!.addEventListener('${name}', handler);\n`;
      resolved = `document.querySelector('${tag}')!.addEventListener('${record.policy.replacement.name}', handler);\n`;
    } else assert.fail(`Unsupported v24 member recipe: ${kind}`);
    const sharedTargetReview = kind === 'event' && sharedTargetEventReviews.has(`${tag}\u0000${name}`);
    const automatic = Boolean(rule && rule.polarity !== 'inverted' && !sharedTargetReview);
    const column = kind === 'event' ? input.indexOf(`'${name}'`, input.indexOf('.addEventListener')) + 2
      : kind === 'property' ? input.indexOf(`.${name} =`) + 2
        : input.indexOf(` ${name}=`) + 2;
    assert.ok(column > 1, `Missing exact v24 member input site: ${compatibilityKey(record.key)}`);
    return { id: `p22-member-${String(index + 1).padStart(2, '0')}`, key: record.key, record, input, resolved,
      extension, column, reportedTag: tag, rule, review, sharedTargetReview, automatic,
      applied: automatic ? `${input.slice(0, column - 1)}${rule.to}${input.slice(column - 1 + name.length)}` : input };
  });
}

export function selectMemberMigrationStage(context, cases) {
  assert.equal(cases.length, 390, 'Missing member cases');
  assert.equal(new Set(cases.map(item => compatibilityKey(item.key))).size, 390, 'Duplicate member cases');
  const eligible = Object.values(context.records).filter(record => record.policy.removalNotBefore === '23.0.0');
  assert.equal(eligible.length, 399, 'Full eligible cohort changed');
  for (const item of cases) {
    assert.equal(context.records[compatibilityKey(item.key)], item.record, 'Case is not bound to this context');
    assert.ok(['current', 'retired'].includes(item.record.state), 'Unknown retirement state');
    if (item.record.state === 'retired') assert.equal(item.record.removedIn, '23.0.0');
  }
  return cases.every(item => item.record.state === 'retired') ? 'all-retirements' : 'exports-and-geojson';
}

/** Derive the historical v24 module cohort from the verified installed-package context. */
export function createV24ExportMigrationCases(context) {
  assertMigrationPackageVersion(context.packageVersion);
  const records = Object.values(context.records).filter(record => record.policy.removalNotBefore === '24.0.0');
  assert.equal(records.length, 654, 'The v24 cohort must contain exactly654 published identities');
  const members = records.filter(record => record.key.scope === 'member');
  const exports = records.filter(record => record.key.scope === 'export');
  assert.equal(members.length, 44, 'The v24 member cohort changed');
  assert.equal(exports.length, 610, 'The v24 export cohort changed');
  for (const record of records) {
    assert.equal(record.state, 'retired', `v24 candidate did not retire ${compatibilityKey(record.key)}`);
    assert.equal(record.removedIn, '24.0.0', `Unexpected v24 retirement for ${compatibilityKey(record.key)}`);
  }

  return exports.sort((left, right) => {
    const a = compatibilityKey(left.key); const b = compatibilityKey(right.key);
    return a < b ? -1 : a > b ? 1 : 0;
  }).map((record, index) => {
    const { kind, module, name } = record.key;
    let extension = 'ts';
    let input;
    if (['class', 'constant', 'function', 'type'].includes(kind)) {
      assert.equal(typeof module, 'string', `Named export has no module: ${compatibilityKey(record.key)}`);
      const specifier = `@aceshooting/lyra-ui${module === '.' ? '' : module.slice(1)}`;
      input = `import { ${name} } from '${specifier}';\n`;
    } else if (kind === 'entry-point' || kind === 'stylesheet') {
      extension = kind === 'stylesheet' ? 'css' : 'ts';
      const specifier = `@aceshooting/lyra-ui${name.slice(1)}`;
      input = kind === 'stylesheet' ? `@import '${specifier}';\n` : `import '${specifier}';\n`;
    } else if (kind === 'root-attribute') {
      extension = 'html';
      input = `<html ${name}="legacy-value"></html>\n`;
    } else if (kind === 'window-event') {
      input = `window.addEventListener('${name}', handler);\n`;
    } else assert.fail(`Unsupported v24 export recipe: ${kind}`);
    const site = kind === 'class' || kind === 'constant' || kind === 'function' || kind === 'type'
      ? name
      : kind === 'root-attribute' || kind === 'window-event'
        ? name
        : `@aceshooting/lyra-ui${name.slice(1)}`;
    const routeKey = ['class', 'constant', 'function', 'type'].includes(kind) && module && module !== '.'
      ? { scope: 'export', kind: 'entry-point', name: module } : null;
    const routeRecord = routeKey ? context.records[compatibilityKey(routeKey)] : null;
    const routeColumn = routeKey ? input.indexOf(`@aceshooting/lyra-ui${module.slice(1)}`) + 1 : 0;
    if (routeRecord?.state === 'retired' && routeRecord.removedIn === '24.0.0') assert.ok(routeColumn > 0, 'Nested route witness has no import site');
    const additionalReviews = routeColumn > 0 && routeRecord?.state === 'retired' && routeRecord.removedIn === '24.0.0'
      ? [{ key: routeKey, record: routeRecord, column: routeColumn }] : [];
    return {
      id: `p22-${String(index + 1).padStart(3, '0')}`,
      key: record.key,
      record,
      input,
      extension,
      column: input.indexOf(site) + 1,
      additionalReviews,
    };
  });
}

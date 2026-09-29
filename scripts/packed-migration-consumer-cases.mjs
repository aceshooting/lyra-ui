import assert from 'node:assert/strict';
import { compatibilityKey } from '../packages/lyra-ui/scripts/published-compatibility.mjs';

const templateHandlerExpression = '${handler}';

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
      key: record.key, record, input, resolved, extension, column, rule, review, slotContent,
      reportedTag: kind === 'css-property' && rule && new Set(profile.renames.filter(entry => entry.kind === kind && entry.from === name).map(entry => entry.tag)).size > 1 ? null : tag,
      resolvedByOrigin: tag === 'lr-graph' && kind === 'event' && review ? {
        'lyra-v21': `// lyra-migrate-reviewed: DETAIL_SHAPE_REVIEW:${target}\n${resolved}`,
        'lyra-v22': resolved,
      } : undefined,
      automatic: Boolean(rule && rule.polarity !== 'inverted') };
  });
}

/** Exact primary witnesses; no extra rewrite or diagnostic can be hidden by a successful exit. */
export function assertMemberMigrationReport(report, cases, origin) {
  assert.equal(report.schemaVersion, 1); assert.equal(report.origin, origin);
  const active = origin === 'lyra-v21' ? cases : [];
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
        assert.equal(site.warningCode, item.slotContent ? 'DEPRECATED_CONTENT_REVIEW' : item.rule?.polarity === 'inverted' ? 'POLARITY_REVIEW' : 'DEPRECATED_MEMBER_REVIEW');
        assert.equal(site.target, item.slotContent ? null : item.rule?.to ?? item.record.policy.replacement.usage ?? item.record.policy.replacement.name);
        if (item.review && item.record.state === 'retired') assert.ok(site.message.includes('was removed in 23.0.0'), site.message);
      }
    }
  }
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

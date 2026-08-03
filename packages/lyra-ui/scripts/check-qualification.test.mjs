import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { evaluateQualification } from './check-qualification.mjs';
import {
  AXE_ASSERTION,
  axeEvidenceForTag,
  extractTestCases,
  matchingDelimiter,
  mountsTag,
  normalizeExemptions,
} from './qualification-core.mjs';

const component = (tag, status = 'stable') => ({
  tag,
  maturity: { status },
  classModule: `src/components/x/${tag}/${tag}.class.ts`,
});
const exemption = (tag, overrides = {}) => ({
  tag,
  dimension: 'accessibility',
  scope: 'populated/open-state evidence',
  reason: 'This component has no separate data-bearing or open state to exercise.',
  reviewer: { kind: 'automated-agent', name: 'Qualification test fixture' },
  recordedAt: '2026-08-02',
  evidence: [`src/components/x/${tag}/${tag}.test.ts#default state`],
  humanReview: 'not-claimed',
  ...overrides,
});

const evaluate = (components, exemptions, source) =>
  evaluateQualification({
    components,
    exemptions: { schemaVersion: 2, exemptions },
    loadTests: () => source,
  });

test('balanced extraction keeps nested templates and interpolation inside one test case', () => {
  const source = `it('nested', async () => {
    const el = await fixture(html\`<lr-a>\${ok ? html\`<span>(x)</span>\` : nothing}</lr-a>\`);
    await expect(el).to.be.accessible();
  });`;
  const open = source.indexOf('(');
  assert.equal(source[matchingDelimiter(source, open)], ')');
  assert.equal(extractTestCases(source).length, 1);
});

test('test extraction ignores it/test call shapes inside comments and string literals', () => {
  const source = `
    // reflects it (mirrors another control) without starting a test
    const prose = "test('not a test', () => {})";
    it('the real case', async () => {
      const el = await fixture(html\`<lr-a>Content</lr-a>\`);
      await expect(el).to.be.accessible();
    });
  `;
  const cases = extractTestCases(source);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].title, 'the real case');
});

test('test extraction preserves UTF-16 source offsets after non-BMP fixture text', () => {
  const source = `
    const priorFixture = html\`<span>🤖</span>\`;
    it('the indexed case', async () => {
      const el = await fixture(html\`<lr-a>Content</lr-a>\`);
      await expect(el).to.be.accessible();
    });
  `;
  const cases = extractTestCases(source);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].title, 'the indexed case');
  assert.equal(cases[0].line, 3);
});

test('an accessibility assertion shown only in test prose is not executable evidence', () => {
  const source = `it('documents the assertion', async () => {
    const el = await fixture(html\`<lr-a>Content</lr-a>\`);
    const example = "expect(el).to.be.accessible()";
    expect(example).to.include('accessible');
  });`;
  const result = evaluate([component('lr-a')], [], source);
  assert.equal(result.failures.length, 1);
  assert.deepEqual(result.evidenceByTag.get('lr-a'), []);
});

test('a commented-out initializer cannot retarget a real sibling axe assertion', () => {
  const source = `it('checks only b', async () => {
    // const el = await fixture(html\`<lr-a>Content</lr-a>\`);
    const el = await fixture(html\`<lr-b>Content</lr-b>\`);
    await expect(el).to.be.accessible();
  });`;
  const result = evaluate([component('lr-a')], [], source);
  assert.equal(result.failures.length, 1);
  assert.deepEqual(result.evidenceByTag.get('lr-a'), []);
});

test('mountsTag matches exact literals and rejects prefix collisions', () => {
  assert.ok(mountsTag('<lr-button>', 'lr-button'));
  assert.ok(mountsTag("['lr-button', 'button']", 'lr-button'));
  assert.equal(mountsTag('<lr-button-group>', 'lr-button'), false);
});

test("the library's positive axe idioms are recognized, including shadowDom", () => {
  assert.ok(AXE_ASSERTION.test('await expect(el).to.be.accessible();'));
  assert.ok(AXE_ASSERTION.test('await expect(el).shadowDom.to.be.accessible();'));
  assert.equal(AXE_ASSERTION.test('await expect(el).to.not.be.accessible();'), false);
});

test('a populated fixture axe-checking that exact instance qualifies', () => {
  const source = `it('is accessible when populated', async () => {
    const el = await fixture(html\`<lr-a><span>Content</span></lr-a>\`);
    await expect(el).to.be.accessible();
  });`;
  const result = evaluate([component('lr-a')], [], source);
  assert.deepEqual(result.failures, []);
  assert.equal(result.evidenceByTag.get('lr-a')[0].state, 'populated');
});

test('an open fixture is accepted as the meaningful state', () => {
  const source = `it('is accessible while open', async () => {
    const el = await fixture(html\`<lr-a open></lr-a>\`);
    await expect(el).to.be.accessible();
  });`;
  const result = evaluate([component('lr-a')], [], source);
  assert.deepEqual(result.failures, []);
  assert.equal(result.evidenceByTag.get('lr-a')[0].state, 'open');
});

test('an empty/default axe assertion is recorded but does not qualify', () => {
  const source = `it('is accessible', async () => {
    const el = await fixture(html\`<lr-a></lr-a>\`);
    await expect(el).to.be.accessible();
  });`;
  const result = evaluate([component('lr-a')], [], source);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /only the empty\/default state/);
});

test('a misleading populated/open title cannot qualify an unchanged empty fixture', () => {
  const source = `it('is accessible while open and populated', async () => {
    const el = await fixture(html\`<lr-a></lr-a>\`);
    await expect(el).to.be.accessible();
  });`;
  const result = evaluate([component('lr-a')], [], source);
  assert.equal(result.failures.length, 1);
  assert.equal(result.evidenceByTag.get('lr-a')[0].state, 'default');
});

test('an explicitly empty/default title cannot be promoted by form chrome alone', () => {
  const source = `it('is accessible in the default, empty state', async () => {
    const el = await fixture(html\`<lr-a label="Name" placeholder="Enter a name"></lr-a>\`);
    await expect(el).to.be.accessible();
  });`;
  const result = evaluate([component('lr-a')], [], source);
  assert.equal(result.failures.length, 1);
  assert.equal(result.evidenceByTag.get('lr-a')[0].state, 'default');
});

test('an explicitly empty data binding remains an empty/default state', () => {
  const source = `it('is accessible with items', async () => {
    const el = await fixture(html\`<lr-a .items=\${[]}></lr-a>\`);
    await expect(el).to.be.accessible();
  });`;
  const result = evaluate([component('lr-a')], [], source);
  assert.equal(result.failures.length, 1);
  assert.equal(result.evidenceByTag.get('lr-a')[0].state, 'default');
});

test('an explicitly empty slotted interpolation remains an empty/default state', () => {
  for (const empty of ['nothing', 'null', 'undefined', 'false', "''", '[]']) {
    const source = `it('is accessible', async () => {
      const el = await fixture(html\`<lr-a>\${${empty}}</lr-a>\`);
      await expect(el).to.be.accessible();
    });`;
    const result = evaluate([component('lr-a')], [], source);
    assert.equal(result.failures.length, 1, empty);
    assert.equal(result.evidenceByTag.get('lr-a')[0].state, 'default', empty);
  }
});

test('mounting this tag in one test while axe checks a sibling in another does not qualify', () => {
  const source = `
    it('mentions a', async () => { await fixture(html\`<lr-a>Content</lr-a>\`); });
    it('axes b', async () => {
      const other = await fixture(html\`<lr-b>Content</lr-b>\`);
      await expect(other).to.be.accessible();
    });`;
  const result = evaluate([component('lr-a')], [], source);
  assert.equal(result.failures.length, 1);
  assert.deepEqual(result.evidenceByTag.get('lr-a'), []);
});

test('a sibling axe assertion in the same test is not attributed to this tag', () => {
  const source = `it('mixed siblings', async () => {
    const wanted = await fixture(html\`<lr-a>Content</lr-a>\`);
    const other = await fixture(html\`<lr-b>Content</lr-b>\`);
    expect(wanted).to.exist;
    await expect(other).to.be.accessible();
  });`;
  const result = evaluate([component('lr-a')], [], source);
  assert.equal(result.failures.length, 1);
  assert.deepEqual(result.evidenceByTag.get('lr-a'), []);
});

test('shadowDom axe remains tied to its exact populated instance', () => {
  const source = `it('populated', async () => {
    const el = await fixture(html\`<lr-a .items=\${[1]}></lr-a>\`);
    await expect(el).shadowDom.to.be.accessible();
  });`;
  assert.deepEqual(evaluate([component('lr-a')], [], source).failures, []);
});

test('a wrapper query proves the exact child instance instead of qualifying the wrapper', () => {
  const source = `it('is accessible with content', async () => {
    const wrapper = await fixture(html\`<div><lr-a>Content</lr-a></div>\`);
    const el = wrapper.querySelector('lr-a');
    await expect(el).to.be.accessible();
  });`;
  assert.deepEqual(evaluate([component('lr-a')], [], source).failures, []);
});

test('a named fixture helper is followed to its exact populated tag', () => {
  const source = `
    const populated = () => html\`<lr-a><span>Content</span></lr-a>\`;
    it('is accessible with content', async () => {
      const el = await fixture(populated());
      await expect(el).to.be.accessible();
    });`;
  assert.deepEqual(evaluate([component('lr-a')], [], source).failures, []);
});

test('a tag mentioned only in a fixture-helper comment cannot qualify that helper', () => {
  const source = `
    const populated = () => {
      // A future version may render <lr-a> here.
      return html\`<lr-b>Content</lr-b>\`;
    };
    it('checks b', async () => {
      const el = await fixture(populated());
      await expect(el).to.be.accessible();
    });`;
  const result = evaluate([component('lr-a')], [], source);
  assert.equal(result.failures.length, 1);
  assert.deepEqual(result.evidenceByTag.get('lr-a'), []);
});

test('the reviewed parameterized subclass pattern qualifies every literal table member', () => {
  const source = `
    const TAGS = [['lr-a', 'a'], ['lr-b', 'b']];
    for (const [tag] of TAGS) {
      it(\`\${tag} is accessible with data\`, async () => {
        const el = await fixture(\`<\${tag}></\${tag}>\`);
        el.datasets = [{ data: [1] }];
        await expect(el).to.be.accessible();
      });
    }`;
  assert.deepEqual(evaluate([component('lr-a'), component('lr-b')], [], source).failures, []);
});

test('a parameterized test does not qualify a tag merely mentioned elsewhere in the file', () => {
  const source = `
    const TAGS = [['lr-a', 'a']];
    const unrelatedExample = 'lr-b';
    for (const [tag] of TAGS) {
      it(\`\${tag} is accessible with data\`, async () => {
        const el = await fixture(\`<\${tag}></\${tag}>\`);
        el.datasets = [{ data: [1] }];
        await expect(el).to.be.accessible();
      });
    }`;
  const result = evaluate([component('lr-a'), component('lr-b')], [], source);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /lr-b/);
  assert.deepEqual(result.evidenceByTag.get('lr-b'), []);
});

test('experimental tags are gated too; maturity is orthogonal to qualification', () => {
  const result = evaluate([component('lr-experimental', 'experimental')], [], 'no evidence');
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /lr-experimental/);
});

test('a complete narrow exemption suppresses only its exact missing dimension', () => {
  const result = evaluate([component('lr-a')], [exemption('lr-a')], `it('default', async () => {
    const el = await fixture(html\`<lr-a></lr-a>\`);
    await expect(el).to.be.accessible();
  });`);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.stale, []);
});

test('a state-model exemption cannot replace baseline same-instance axe evidence', () => {
  const result = evaluate([component('lr-a')], [exemption('lr-a')], 'no evidence');
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /does not replace baseline/);
});

test('an exemption becomes stale when populated evidence lands', () => {
  const source = `it('populated', async () => {
    const el = await fixture(html\`<lr-a>Content</lr-a>\`);
    await expect(el).to.be.accessible();
  });`;
  const result = evaluate([component('lr-a')], [exemption('lr-a')], source);
  assert.equal(result.stale.length, 1);
  assert.match(result.stale[0], /evidence has landed/);
});

test('malformed exemptions fail closed on scope, reason, reviewer, date, and evidence', () => {
  const malformed = exemption('lr-a', {
    scope: 'wide',
    reason: 'short',
    reviewer: { kind: 'robot', name: '' },
    recordedAt: 'today',
    evidence: [],
  });
  const { problems } = normalizeExemptions({ schemaVersion: 2, exemptions: [malformed] });
  assert.equal(problems.length, 5, problems.join('\n'));
});

test('an automated exemption cannot claim human review provenance', () => {
  const { problems } = normalizeExemptions({
    schemaVersion: 2,
    exemptions: [exemption('lr-a', { humanReview: 'complete' })],
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /must explicitly disclaim human review/);
});

test('unknown dimensions and duplicate exemptions are rejected', () => {
  const { problems } = normalizeExemptions({
    schemaVersion: 2,
    exemptions: [exemption('lr-a'), exemption('lr-a'), exemption('lr-b', { dimension: 'telepathy' })],
  });
  assert.equal(problems.length, 2, problems.join('\n'));
  assert.ok(problems.some((problem) => problem.includes('duplicate')));
  assert.ok(problems.some((problem) => problem.includes('unknown dimension')));
});

test('the exemption schema version is fail-closed', () => {
  const { problems } = normalizeExemptions({ schemaVersion: 1, exemptions: [] });
  assert.deepEqual(problems, ['qualification exemptions must use schemaVersion 2']);
});

test('an impossible calendar date is not accepted as review provenance', () => {
  const { problems } = normalizeExemptions({
    schemaVersion: 2,
    exemptions: [exemption('lr-a', { recordedAt: '2026-02-31' })],
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /ISO recordedAt date/);
});

test('an exemption for a removed tag is stale', () => {
  const result = evaluate([component('lr-a')], [exemption('lr-gone')], `it('populated', async () => {
    const el = await fixture(html\`<lr-a>Content</lr-a>\`);
    await expect(el).to.be.accessible();
  });`);
  assert.ok(result.stale.some((entry) => /lr-gone.*no such component/.test(entry)));
});

test('the shipped exemption ledger is schema-valid and explicitly disclaims human review', () => {
  const shipped = JSON.parse(fs.readFileSync(new URL('./qualification-exemptions.json', import.meta.url), 'utf8'));
  assert.equal(shipped.schemaVersion, 2);
  const { problems } = normalizeExemptions(shipped);
  assert.deepEqual(problems, []);
  assert.ok(shipped.exemptions.every((entry) => entry.humanReview === 'not-claimed'));
});

test('real chart-style same-instance evidence reports the populated state', () => {
  const source = `it('lr-chart is accessible', async () => {
    const el = await fixture(html\`<lr-chart></lr-chart>\`);
    el.datasets = [{ label: 'x', data: [1, 2] }];
    await expect(el).to.be.accessible();
  });`;
  assert.deepEqual(axeEvidenceForTag({ source, file: 'chart.test.ts', tag: 'lr-chart' }), [{
    file: 'chart.test.ts',
    line: 1,
    test: 'lr-chart is accessible',
    target: 'el',
    state: 'populated',
  }]);
});

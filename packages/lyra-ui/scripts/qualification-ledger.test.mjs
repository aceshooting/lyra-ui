import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { QUALIFICATION_DIMENSIONS } from './qualification-core.mjs';
import {
  buildQualificationLedger,
  parseSsrSource,
  renderQualificationDashboard,
  validateQualificationLedger,
  validateVisualQualificationManifest,
} from './qualification-ledger.mjs';

function write(file, source) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
}

function component(tag, maturity, optionalPeers = []) {
  const name = tag.replace(/^lr-/, '');
  return {
    tag,
    family: 'utility',
    classModule: `src/components/utility/${name}/${name}.class.ts`,
    registrationModule: `src/components/utility/${name}/${name}.ts`,
    optionalPeers,
    maturity: { status: maturity },
  };
}

function componentSources(packageDir, tag) {
  const name = tag.replace(/^lr-/, '');
  const directory = path.join(packageDir, 'src', 'components', 'utility', name);
  write(path.join(directory, `${name}.class.ts`), `
    export class Fixture {
      render() { return html\`<button @click=\${this.activate}>Go</button>\`; }
      async load() { return safeFetchUrl(this.src); }
    }
  `);
  write(path.join(directory, `${name}.styles.ts`), `
    export const styles = css\`:host { transition: opacity var(--lr-transition-fast); }\`;
  `);
  write(path.join(directory, `${name}.test.ts`), `
    it('is accessible when populated in RTL at a narrow allocation', async () => {
      const el = await fixture(html\`<${tag} dir="rtl" .items=\${[1]}></${tag}>\`);
      el.style.inlineSize = '320px';
      new KeyboardEvent('keydown', { key: 'Enter' });
      matchMedia('(prefers-reduced-motion: reduce)');
      await expect(el).to.be.accessible();
    });
    it('fails closed when the peer loader rejects', async () => {
      await expect(loadPeer()).to.be.rejected;
    });
  `);
}

function fixture() {
  const packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-qualification-'));
  const components = [
    component('lr-stable', 'stable', ['fixture-peer']),
    component('lr-experimental', 'experimental'),
  ];
  for (const entry of components) componentSources(packageDir, entry.tag);
  const inventory = { schemaVersion: 1, components };
  const visualManifest = {
    schemaVersion: 1,
    coverageProfiles: {
      standard: { axes: ['light', 'dark', 'rtl'] },
      forced: { axes: ['light', 'forced-colors'] },
    },
    stories: [
      { id: 'stable--default', profile: 'forced' },
      { id: 'experimental--default', profile: 'standard' },
    ],
    tagCoverage: {
      'lr-stable': ['stable--default'],
      'lr-experimental': ['experimental--default'],
    },
    provenance: {
      generator: 'scripts/visual-regression.mjs',
      generatedBy: 'automated-coding-agent',
      generatedOn: '2026-08-02',
      sourceTree: { baseCommit: 'abc123', dirty: true },
      browser: { name: 'chromium', version: '1' },
      platform: { os: 'linux', arch: 'x64' },
      humanVisualReview: false,
    },
    baselineReview: {
      status: 'pending-human-review',
      reviewer: null,
      reviewedAt: null,
      knownLimitations: ['Fixture captures have no human review.'],
    },
  };
  const ledger = buildQualificationLedger({
    packageDir,
    inventory,
    exemptions: { schemaVersion: 2, exemptions: [] },
    visualManifest,
    ssrSource: `
      export const matrix = {
        [tag('experimental')]: reason('browser-constructor', 'fixture limitation'),
      };
    `,
  });
  return { packageDir, inventory, ledger };
}

test('SSR classification distinguishes declared client rendering from render-and-hydrate', () => {
  const result = parseSsrSource(
    `[tag('client')]: reason('browser-constructor', 'requires a browser'),`,
    ['lr-client', 'lr-server'],
  );
  assert.deepEqual(result.get('lr-client'), { mode: 'client-render', reason: 'browser-constructor' });
  assert.deepEqual(result.get('lr-server'), { mode: 'render-and-hydrate', reason: null });
});

test('SSR classification accepts reviewed multiline/double-quoted reason declarations', () => {
  const result = parseSsrSource(
    `[ tag("client") ]: reason(\n      "browser-constructor",\n      "requires a browser",\n    ),`,
    ['lr-client', 'lr-server'],
  );
  assert.deepEqual(result.get('lr-client'), { mode: 'client-render', reason: 'browser-constructor' });
});

test('SSR classification fails closed on unparsed, duplicate, and unknown declarations', () => {
  assert.throws(
    () => parseSsrSource(`[tag('client')]: unsupported('browser-constructor'),`, ['lr-client']),
    /could not parse every client-render declaration/,
  );
  assert.throws(
    () => parseSsrSource(`
      [tag('client')]: reason('browser-constructor', 'one'),
      [tag('client')]: reason('browser-global', 'two'),
    `, ['lr-client']),
    /duplicate client-render declaration/,
  );
  assert.throws(
    () => parseSsrSource(`[tag('unknown')]: reason('browser-global', 'unknown'),`, ['lr-client']),
    /unknown client-render tag lr-unknown/,
  );
});

test('builds all dimensions for stable and experimental tags without conflating maturity', (t) => {
  const { packageDir, inventory, ledger } = fixture();
  t.after(() => fs.rmSync(packageDir, { recursive: true, force: true }));
  assert.equal(ledger.components.length, 2);
  assert.deepEqual(validateQualificationLedger(ledger, inventory), []);
  for (const record of ledger.components) {
    assert.deepEqual(Object.keys(record.dimensions).sort(), [...QUALIFICATION_DIMENSIONS].sort());
    assert.equal(record.dimensions.accessibility.status, 'automated');
    assert.equal(record.qualification.humanReview, 'pending');
    assert.ok(record.qualification.evidenceGaps.includes('assistiveTechnology'));
  }
  assert.equal(ledger.components.find(({ tag }) => tag === 'lr-stable').maturity, 'stable');
  assert.equal(ledger.components.find(({ tag }) => tag === 'lr-experimental').maturity, 'experimental');
  assert.equal(
    ledger.components.find(({ tag }) => tag === 'lr-experimental').dimensions.ssrHydration.mode,
    'client-render',
  );
  assert.equal(ledger.baselineProvenance.sourceCommit, 'abc123');
  assert.equal(ledger.baselineProvenance.sourceTreeDirty, true);
  assert.equal(ledger.baselineProvenance.humanVisualReview, false);
  assert.equal(ledger.summary.forcedColorsEnrolled, 1);
  assert.ok(ledger.components[0].knownLimitations.some((limitation) => /screen reader/i.test(limitation)));
});

test('visual qualification schema rejects dangling enrollment and invented pending review provenance', () => {
  const inventory = { components: [component('lr-stable', 'stable')] };
  const findings = validateVisualQualificationManifest({
    schemaVersion: 1,
    coverageProfiles: { standard: { axes: ['light'] } },
    stories: [{ id: 'known--default', profile: 'missing' }],
    tagCoverage: {
      'lr-unknown': ['known--default'],
      'lr-stable': ['missing--story'],
    },
    baselineReview: {
      status: 'pending-human-review',
      reviewer: 'Invented reviewer',
      reviewedAt: '2026-08-02',
    },
    provenance: { humanVisualReview: true },
  }, inventory);
  assert.ok(findings.some((finding) => finding.includes('unknown visual coverage profile')));
  assert.ok(findings.some((finding) => finding.includes('not in the public inventory')));
  assert.ok(findings.some((finding) => finding.includes('unknown story')));
  assert.ok(findings.some((finding) => finding.includes('must not invent')));
  assert.ok(findings.some((finding) => finding.includes('humanVisualReview=false')));
});

test('validation rejects stale maturity, incomplete dimensions, and invented human or AT review', (t) => {
  const { packageDir, inventory, ledger } = fixture();
  t.after(() => fs.rmSync(packageDir, { recursive: true, force: true }));
  const invalid = structuredClone(ledger);
  invalid.components[0].maturity = 'stable' === invalid.components[0].maturity ? 'experimental' : 'stable';
  delete invalid.components[0].dimensions.rtl;
  invalid.components[0].dimensions.assistiveTechnology.status = 'verified';
  invalid.components[0].qualification.humanReview = 'complete';
  invalid.humanReview = { status: 'complete', reviewer: 'Someone', reviewedAt: '2026-08-02' };
  const findings = validateQualificationLedger(invalid, inventory);
  assert.ok(findings.some((finding) => finding.includes('maturity presentation is stale')));
  assert.ok(findings.some((finding) => finding.includes('dimensions are incomplete')));
  assert.ok(findings.some((finding) => finding.includes('assistive-technology')));
  assert.ok(findings.some((finding) => finding.includes('human-review')));
  assert.ok(findings.some((finding) => finding.includes('library-wide human review')));
});

test('dashboard exposes evidence gaps, provenance, and per-tag integration links', (t) => {
  const { packageDir, ledger } = fixture();
  t.after(() => fs.rmSync(packageDir, { recursive: true, force: true }));
  const markdown = renderQualificationDashboard(ledger);
  assert.match(markdown, /Human review status: \*\*pending\*\*/);
  assert.match(markdown, /Reviewer: \*\*none recorded\*\*/);
  assert.match(markdown, /Capture source commit: abc123/);
  assert.match(markdown, /Capture source tree dirty: yes/);
  assert.match(markdown, /component-integration\.md#lr-stable/);
  assert.match(markdown, /not verified/);
});

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { API } from 'typescript/unstable/sync';

import {
  allRelatedTypes,
  collectStructuralAssertionProxies,
  collectUnsafeAssertions,
  isDomTypeDescription,
  policyAccountingFailures,
} from './check-test-assertions.mjs';

test('recognizes direct, nullable, collection, and inherited DOM assertion payloads', () => {
  assert.equal(isDomTypeDescription('HTMLButtonElement | null'), true);
  assert.equal(isDomTypeDescription('NodeListOf<Element>'), true);
  assert.equal(isDomTypeDescription('HTMLElement[]'), true);
  assert.equal(isDomTypeDescription('CustomControl', ['CustomControl', 'HTMLElement']), true);
});

test('accepts primitive projections and ordinary data payloads', () => {
  assert.equal(isDomTypeDescription('string'), false);
  assert.equal(isDomTypeDescription('boolean'), false);
  assert.equal(isDomTypeDescription('{ id: string; label: string }'), false);
  assert.equal(isDomTypeDescription('string | null', ['String']), false);
});

test('retains a usable top-level type when unstable relationship accessors throw', () => {
  const topLevelType = {
    isUnionType: () => true,
    isIntersectionType: () => false,
    getTypes: () => {
      throw new Error('synthetic tuple relationship failure');
    },
    getBaseTypes: () => {
      throw new Error('synthetic base relationship failure');
    },
  };

  assert.deepEqual(allRelatedTypes(topLevelType), [topLevelType]);
});

function withProject(source, callback) {
  const fixture = mkdtempSync(path.join(tmpdir(), 'lyra-test-assertions-'));
  const sourceDir = path.join(fixture, 'src', 'components', 'fixture');
  mkdirSync(sourceDir, { recursive: true });
  const configFile = path.join(fixture, 'tsconfig.json');
  writeFileSync(
    configFile,
    `${JSON.stringify({
      compilerOptions: { lib: ['DOM', 'ES2022'], noEmit: true, strict: true, target: 'ES2022' },
      include: ['src/**/*.ts'],
    })}\n`
  );
  writeFileSync(path.join(sourceDir, 'fixture.test.ts'), source);

  const api = new API({ cwd: fixture });
  const snapshot = api.updateSnapshot({ openProject: configFile });
  try {
    const project = snapshot.getProject(configFile) ?? snapshot.getProjects()[0];
    assert.ok(project, 'the real TypeScript project fixture loads');
    callback(collectUnsafeAssertions(project), project);
  } finally {
    snapshot.dispose();
    api.close();
    rmSync(fixture, { recursive: true, force: true });
  }
}

test('real TypeScript project classifies DOM payloads, selector any fallback, polarity, and identity', () => {
  withProject(
    `
      declare function expect(value: unknown): any;
      declare const typed: HTMLButtonElement | null;
      declare const expected: HTMLButtonElement;
      declare const loose: any;
      const selected = loose.querySelector('button');
      const selectedList = loose.querySelectorAll('button');
      const broken = missingReceiver.querySelector('button');

      expect(typed).to.exist;
      expect(typed).to.not.be.null;
      expect(typed).to.not.exist;
      expect(typed).to.be.null;
      expect(typed).to.equal(expected);
      expect(typed).to.not.equal(expected);
      expect(typed).to.not.equal(null);
      expect(typed).to.equal('.not. appears only in the expected payload');
      expect(selected).to.not.exist;
      expect(selectedList[0]).to.equal(expected);
      expect(broken).to.be.null;
      expect(selected.textContent).to.equal('text');
      expect(loose.querySelector('button')?.id).to.equal('button-id');
      expect(loose.querySelectorAll('button').length).to.equal(1);
      expect(selected === null).to.equal(true);
      expect(typed?.id ?? null).to.equal(null);
    `,
    (result) => {
      assert.equal(result.scannedFileCount, 1);
      assert.equal(result.candidateCount, 16);
      assert.ok(result.classifiedCount >= 7, 'real DOM types reach the assignability classifier');
      assert.equal(result.fallbackCount, 3, 'selector initializers and collection access reach the syntax fallback');
      assert.equal(result.errorCount, 0);
      assert.deepEqual(
        result.findings.map(({ kind, via }) => ({ kind, via })),
        [
          { kind: 'not.exist', via: 'assignable' },
          { kind: 'null', via: 'assignable' },
          { kind: 'equal', via: 'assignable' },
          { kind: 'not.equal', via: 'assignable' },
          { kind: 'equal', via: 'assignable' },
          { kind: 'not.exist', via: 'syntax-fallback' },
          { kind: 'equal', via: 'syntax-fallback' },
          { kind: 'null', via: 'syntax-fallback' },
        ]
      );
    }
  );
});

test('accounting fails closed on classifier errors, vacuous classification, and enrollment drift', () => {
  assert.deepEqual(
    policyAccountingFailures(
      {
        candidateCount: 3,
        classifiedCount: 0,
        fallbackCount: 0,
        errorCount: 2,
        scannedFileCount: 1,
      },
      2
    ),
    [
      'TypeScript classification produced 2 error payload(s)',
      'zero DOM classifications for 3 Chai assertion candidate(s)',
      'scanned 1 component test file(s), expected 2',
    ]
  );
  assert.deepEqual(
    policyAccountingFailures(
      {
        candidateCount: 0,
        classifiedCount: 0,
        fallbackCount: 0,
        errorCount: 0,
        scannedFileCount: 1,
      },
      1
    ),
    ['zero Chai assertion candidates across 1 component test file(s)']
  );
});

test('a syntax fallback cannot mask an operational checker failure', () => {
  withProject(
    `
      declare function expect(value: unknown): any;
      declare const loose: any;
      expect(loose.querySelector('button')).to.not.exist;
    `,
    (_result, project) => {
      const checker = new Proxy(project.checker, {
        get(target, property) {
          if (property === 'getTypeAtLocation') {
            return () => {
              throw new Error('synthetic checker failure');
            };
          }
          const value = Reflect.get(target, property);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      const result = collectUnsafeAssertions({ checker, program: project.program });
      assert.equal(result.candidateCount, 1);
      assert.equal(result.fallbackCount, 1, 'syntax diagnostics remain available');
      assert.equal(result.errorCount, 1, 'the operational checker failure remains fatal');
      assert.deepEqual(result.findings.map(({ kind, via }) => ({ kind, via })), [
        { kind: 'not.exist', via: 'syntax-fallback' },
      ]);
    }
  );
});

test('rejects Chai length comparisons that are tautological for collections', () => {
  withProject(
    `
      declare function expect(value: unknown): any;
      declare const items: string[];

      expect(items.length >= 0).to.equal(true);
      expect(0 <= items.length).to.equal(true);
      expect(items.length > 0).to.equal(true);
      expect(items.length).to.equal(0);
    `,
    (_result, project) => {
      assert.deepEqual(
        collectStructuralAssertionProxies(project).map(({ kind }) => kind),
        ['chai-tautological-length', 'chai-tautological-length'],
      );
    },
  );
});

test('rejects CSSOM declarations copied to a synthetic probe before measurement', () => {
  withProject(
    `
      declare function expect(value: unknown): any;
      declare const root: ShadowRoot;
      const sheet = root.adoptedStyleSheets[0]!;
      const rule = sheet.cssRules[0] as CSSStyleRule;
      const declaration = rule.style.maxInlineSize;
      const probe = document.createElement('span');
      probe.style.maxInlineSize = declaration;
      expect(getComputedStyle(probe).maxInlineSize).to.equal('10px');
    `,
    (_result, project) => {
      assert.deepEqual(
        collectStructuralAssertionProxies(project).map(({ kind }) => kind),
        ['cssom-proxy-surface'],
      );
    },
  );
});

test('accepts selector/media CSSOM inspection and computed styles on real or literal probe surfaces', () => {
  withProject(
    `
      declare function expect(value: unknown): any;
      declare const root: ShadowRoot;
      const sheet = root.adoptedStyleSheets[0]!;
      const rule = sheet.cssRules[0] as CSSStyleRule;
      const media = sheet.cssRules[1] as CSSMediaRule;
      const realSurface = root.querySelector<HTMLElement>('[part="surface"]')!;
      const literalProbe = document.createElement('span');
      literalProbe.style.maxInlineSize = '10px';

      expect(rule.selectorText).to.include('[part="surface"]');
      expect(media.conditionText).to.equal('(prefers-reduced-motion: reduce)');
      expect(getComputedStyle(realSurface).display).to.equal('block');
      expect(getComputedStyle(literalProbe).maxInlineSize).to.equal('10px');
    `,
    (_result, project) => {
      assert.deepEqual(collectStructuralAssertionProxies(project), []);
    },
  );
});

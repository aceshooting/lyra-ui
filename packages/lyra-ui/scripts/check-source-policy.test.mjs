import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findOpaqueReviewTokens,
  findUnboundAnnouncerTimerHosts,
  findNulByteLines,
  findUnboundAnnouncementSinks,
  findImplicitShadowLiveComponents,
  findShadowLiveRegionMarkup,
  isSafeIntlLocaleExpression,
} from './check-source-policy.mjs';

test('shipped-source hygiene rejects opaque review IDs without flagging public standards', () => {
  const source = [
    '// C-012 and O-318 are private review bookkeeping.',
    'const prose = "Resolved under C-789.";',
    '// WCAG 2.5.8, ISO-8601, SHA-256, and v9.0.0 are public identifiers.',
  ].join('\n');

  assert.deepEqual(findOpaqueReviewTokens(source), [
    { line: 1, token: 'C-012' },
    { line: 1, token: 'O-318' },
    { line: 2, token: 'C-789' },
  ]);
  assert.deepEqual(findOpaqueReviewTokens('WCAG 2.5.8; ISO-8601; SHA-256; issue 123'), []);
});

test('Announcer timer policy requires an owner-window binding', () => {
  const unsafe = `
    class Consumer {
      private announcer = new Announcer({ onFlush() {} });
    }
  `;
  assert.deepEqual(findUnboundAnnouncerTimerHosts(unsafe), [{ line: 3 }]);

  const safe = `
    class Consumer {
      private announcer = new Announcer({ onFlush() {} });
      connectedCallback() {
        const ownerWindow = this.ownerDocument.defaultView;
        if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
      }
    }
  `;
  assert.deepEqual(findUnboundAnnouncerTimerHosts(safe), []);
});

test('NUL-byte policy distinguishes a literal byte from an escaped source spelling', () => {
  assert.deepEqual(findNulByteLines("const safe = '\\u0000';\nconst unsafe = '\0\0';\n"), [2]);
});

test('announcement source policy requires a statically bound producer element', () => {
  const source = `
    acquireAnnouncementSink('polite');
    acquireAnnouncementSink('assertive', { document: this.ownerDocument });
    acquireAnnouncementSink('polite', options);
    acquireAnnouncementSink('polite', { document, metadata: { source: this } });
    acquireAnnouncementSink('polite', { document, note: 'source: this' });
    acquireAnnouncementSink('polite', { source: this });
    // acquireAnnouncementSink('polite', { document });
  `;

  assert.deepEqual(findUnboundAnnouncementSinks(source), [
    { line: 2, reason: 'missing inline document and source options' },
    { line: 3, reason: 'missing inline source option' },
    { line: 4, reason: 'missing inline document and source options' },
    { line: 5, reason: 'missing inline source option' },
    { line: 6, reason: 'missing inline source option' },
    { line: 7, reason: 'missing inline document option' },
  ]);
});

test('announcement source policy accepts explicit and shorthand top-level source options', () => {
  const source = `
    acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    acquireAnnouncementSink(resolveMode(value), { document, source });
  `;

  assert.deepEqual(findUnboundAnnouncementSinks(source), []);
});

test('shadow live-region policy detects unreliable status, alert, and aria-live markup', () => {
  const source = `
    // role="alert" in prose is not markup.
    const status = html\`<span role="status">Loading</span>\`;
    const alert = html\`<p role = 'alert'>Failed</p>\`;
    const polite = html\`<div aria-live="polite">Updated</div>\`;
    const assertive = html\`<div aria-live = 'assertive'>Failed</div>\`;
    this.setAttribute('role', 'status');
  `;

  assert.deepEqual(findShadowLiveRegionMarkup(source), [
    { attribute: 'role', line: 3, value: 'status' },
    { attribute: 'role', line: 4, value: 'alert' },
    { attribute: 'aria-live', line: 5, value: 'polite' },
    { attribute: 'aria-live', line: 6, value: 'assertive' },
  ]);
});

test('shadow live-region policy permits disabled nested regions and light-DOM host semantics', () => {
  const source = `
    const nested = html\`<div aria-live="off">Not independently announced</div>\`;
    this.setAttribute('role', 'status');
    this.setAttribute('aria-live', 'polite');
  `;

  assert.deepEqual(findShadowLiveRegionMarkup(source), []);
});

test('shadow live-region policy requires nested skeletons to disable their host announcement', () => {
  const source = `
    const unsafe = html\`<lr-skeleton variant="rect"></lr-skeleton>\`;
    const hiddenButLive = html\`<lr-skeleton aria-hidden="true"></lr-skeleton>\`;
    const safe = html\`<lr-skeleton variant="rect" .announce=\${false}></lr-skeleton>\`;
    // <lr-skeleton> in prose is not rendered.
  `;

  assert.deepEqual(findImplicitShadowLiveComponents(source), [
    { line: 2, tag: 'lr-skeleton' },
    { line: 3, tag: 'lr-skeleton' },
  ]);
});

test('unsafe Intl locale policy accepts only a proven safe boundary', () => {
  for (const expression of [
    'this.effectiveLocale',
    'this.effectiveIntlLocale',
    'resolveIntlLocale(authorLocale)',
    '(this.effectiveLocale)',
    'this.effectiveLocale || undefined',
  ]) {
    assert.equal(isSafeIntlLocaleExpression(expression), true, expression);
  }

  for (const expression of [
    undefined,
    '',
    'undefined',
    'null',
    "'en-US'",
    'this.locale',
    'resolveLyraLocale(this)',
    'getLyraLocale()',
    'rawLocale',
    'effectiveLocale',
  ]) {
    assert.equal(
      isSafeIntlLocaleExpression(expression),
      false,
      `${String(expression)} has no syntactic proof`,
    );
  }
});

test('unsafe Intl locale policy follows safe const aliases without trusting their names', () => {
  const source = `
    const whatever = this.effectiveLocale;
    const canonical = resolveIntlLocale(rawLocale);
    const rawLocale = getLyraLocale();
    const effectiveLocale = document.documentElement.lang;
  `;
  const options = { source, beforeIndex: source.length };
  assert.equal(isSafeIntlLocaleExpression('whatever', options), true);
  assert.equal(isSafeIntlLocaleExpression('canonical', options), true);
  assert.equal(isSafeIntlLocaleExpression('rawLocale', options), false);
  assert.equal(
    isSafeIntlLocaleExpression('effectiveLocale', options),
    false,
    'a reassuring arbitrary variable name cannot evade the rule',
  );
});

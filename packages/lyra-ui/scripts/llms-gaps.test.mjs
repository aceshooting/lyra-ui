#!/usr/bin/env node
// Standalone tests for scripts/llms-gaps.mjs -- plain `node:assert`, not wired into
// the wtr suite (this checker reads markdown text, it does not render components). Run directly:
// `node scripts/llms-gaps.test.mjs`.
//
// `mentionsName` replaced a plain `section.text.includes(n)` substring check that produced a
// confirmed false pass: `lr-graph-query-builder`'s `label`/`hint`/`error` CSS *parts* were reported
// as "documented" purely because those exact words already occurred elsewhere in the section as
// *property* names ("the `label` property") -- a coincidental substring, not real documentation of
// the parts. The same substring bug independently false-passed a `change` *event* (a real, undocu-
// mented member) because `change` is a literal substring of the unrelated `lr-change` event name and
// of ordinary prose ("since changed"), and a `click()` *method* because `click` is a substring of
// `click-to-start`/`click-to-stop`. Both cases are reproduced below as regression fixtures.

import assert from 'node:assert/strict';
import { collectGaps, inheritsAllPublicSurface, mentionsName, ownsToken } from './llms-gaps.mjs';

// Quiet by default (it runs inside the `pnpm lint` contract-policy chain); `--verbose` prints the
// per-case lines.
const verbose = process.argv.includes('--verbose');
let failures = 0;
let passes = 0;
function test(name, fn) {
  try {
    fn();
    passes += 1;
    if (verbose) console.log(`ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(err instanceof Error ? err.stack : err);
  }
}

// --- the bug: a name that is only a substring of unrelated prose or a different identifier --------
// (these must still count as a GAP -- i.e. mentionsName must return false, so `miss()` keeps them)

test('a name that is only a substring of a different, longer hyphenated identifier is NOT a mention', () => {
  // The real `change` event vs. the unrelated `lr-change` event -- the pre-fix regression.
  const text = 'Fired alongside `lr-change` for native form bindings.';
  assert.equal(mentionsName(text, 'change'), false);
});

test('a name that only occurs inside a hyphenated compound word is NOT a mention', () => {
  // The real `click()` method vs. prose describing UX behavior with compound words.
  const text = '`mode="toggle"` is click-to-start/click-to-stop with `aria-pressed`.';
  assert.equal(mentionsName(text, 'click'), false);
});

test('a name that only occurs as a substring inside a plain (non-hyphenated) word is NOT a mention', () => {
  const text = 'A mislabeled entry is dropped from the catalog.';
  assert.equal(mentionsName(text, 'label'), false);
});

test('a shorter token name is not satisfied by a longer hyphenated identifier that starts with it', () => {
  // `--lr-push-to-talk-size` must not count as a mention of `--lr-push-to-talk-size-large`, and
  // (the direction that actually matters here) the reverse: a shorter name is not satisfied merely
  // because a longer identifier sharing its prefix appears in the text.
  const text = 'See `--lr-push-to-talk-size-large` for the oversized variant.';
  assert.equal(mentionsName(text, '--lr-push-to-talk-size'), false);
});

// --- the correct shapes: a name that genuinely appears as itself must still be a mention -----------
// (mentionsName must return true, so `miss()` does NOT flag these as gaps)

test('a name surrounded by backticks (inline code) is a mention', () => {
  const text = '**Events:** `change` (`Event`, no detail) -- fired alongside `lr-change`.';
  assert.equal(mentionsName(text, 'change'), true);
});

test('a name immediately followed by `()` (a documented method call) is a mention', () => {
  const text = '- `click()` -- Programmatically starts or stops a take.';
  assert.equal(mentionsName(text, 'click'), true);
});

test('a name that is itself hyphenated is a mention only when it appears whole', () => {
  const text = '**CSS parts:** `base`, `label`, `hint`, `error`, `min-hops`, `max-hops`.';
  assert.equal(mentionsName(text, 'min-hops'), true);
  assert.equal(mentionsName(text, 'label'), true);
});

test('a name at the very start or end of the text is still a mention (no boundary character needed)', () => {
  assert.equal(mentionsName('label is the first word', 'label'), true);
  assert.equal(mentionsName('the last word is label', 'label'), true);
});

test('a `--lr-*` custom property name matches only its exact identifier, not a longer relative', () => {
  const text = 'Themeable: `--lr-push-to-talk-size` (default `var(--lr-size-3rem)`).';
  assert.equal(mentionsName(text, '--lr-push-to-talk-size'), true);
  assert.equal(mentionsName(text, '--lr-push-to-talk-size-large'), false);
});

test('a name containing a regex metacharacter is matched literally, not as a pattern', () => {
  // Defensive: no current manifest name contains one, but mentionsName must not throw or silently
  // over-match if a future name did (e.g. treating a literal `.` as "any character").
  assert.equal(mentionsName('aXb should not satisfy the literal dot', 'a.b'), false);
  assert.equal(mentionsName('the literal `a.b` appears here', 'a.b'), true);
});

test('a component-scoped token belongs to the longest matching tag, not every tag that prefixes it', () => {
  // `lr-tab`, `lr-tab-group` and `lr-tab-panel` share one directory, so they share one stylesheet
  // scan. A plain prefix match would bill every `--lr-tab-group-*` token to `lr-tab` as well and
  // demand it be documented in a section it has nothing to do with.
  const tags = ['lr-tab', 'lr-tab-group', 'lr-tab-panel'];
  assert.equal(ownsToken('lr-tab-group', '--lr-tab-group-hover-color', tags), true);
  assert.equal(ownsToken('lr-tab', '--lr-tab-group-hover-color', tags), false);
  assert.equal(ownsToken('lr-tab', '--lr-tab-indicator-size', tags), true);
  // An unrelated token belongs to nobody.
  assert.equal(ownsToken('lr-tab', '--lr-color-brand', tags), false);
});

test('an exact inheritance declaration documents a base component surface without copying every name', () => {
  const text = '**Inherits:** all public surface from `lr-input`.\n\nNative-time differences follow.';
  assert.equal(inheritsAllPublicSurface(text, 'lr-input'), true);
});

test('ordinary inheritance prose is not mistaken for the explicit whole-surface contract', () => {
  const text = 'This component inherits useful behavior from `lr-input`.';
  assert.equal(inheritsAllPublicSurface(text, 'lr-input'), false);
});

test('an inheritance declaration only covers the exact named base tag', () => {
  const text = '**Inherits:** all public surface from `lr-input`.';
  assert.equal(inheritsAllPublicSurface(text, 'lr-select'), false);
});

test('gap collection honors the exact Native Time inheritance declaration for inherited entries', () => {
  const manifest = {
    modules: [
      {
        path: 'src/components/forms/input/input.class.ts',
        declarations: [
          { kind: 'class', name: 'LyraInput', customElement: true, tagName: 'lr-input' },
        ],
      },
      {
        path: 'src/components/forms/input/native-time-input.class.ts',
        declarations: [
          {
            kind: 'class',
            name: 'LyraNativeTimeInput',
            customElement: true,
            tagName: 'lr-native-time-input',
            attributes: [
              {
                name: 'inherited-only-fixture',
                inheritedFrom: { name: 'LyraInput', module: 'src/components/forms/input/input.class.ts' },
              },
            ],
          },
        ],
      },
    ],
  };
  assert.equal(
    collectGaps(['forms'], manifest).some(({ tag, names }) =>
      tag === 'lr-native-time-input' && names.includes('inherited-only-fixture')),
    false,
  );

  manifest.modules[1].declarations[0].attributes[0].inheritedFrom.name = 'DifferentBase';
  assert.equal(
    collectGaps(['forms'], manifest).some(({ tag, names }) =>
      tag === 'lr-native-time-input' && names.includes('inherited-only-fixture')),
    true,
    'an unresolvable or different base is not hidden by the lr-input declaration',
  );
});

if (failures > 0) {
  console.error(`${failures} llms-gaps test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`llms-gaps self-test passed (${passes} cases).`);
}

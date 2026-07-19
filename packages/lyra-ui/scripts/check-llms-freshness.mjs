#!/usr/bin/env node
// Fails when the authored `llms/<family>.md` sources have drifted from custom-elements.json: any
// public property, attribute, event, slot, CSS part, or themeable custom property that exists but
// is never mentioned in its component's own section.
//
// Historically this only checked properties, only against `llms-full.txt`, and used last-wins
// lookup on duplicate headings — so a duplicated, prose-only section could satisfy it while events,
// slots and CSS parts went undocumented library-wide. It now shares its gap computation with
// `scripts/llms-gap-report.mjs` (run that for the same list in worklist form). The structural
// invariants it can't express — no duplicate sections, every tag documented exactly once, each
// section filed under the family its tag is declared in — are enforced by `scripts/build-llms.mjs`
// through `scripts/check-llms-artifacts.mjs`.
import { collectGaps } from './llms-gaps.mjs';

const gaps = collectGaps();

if (gaps.length > 0) {
  const byTag = new Map();
  for (const gap of gaps) {
    const key = `${gap.family}.md :: ${gap.tag}`;
    if (!byTag.has(key)) byTag.set(key, []);
    byTag.get(key).push(`${gap.kind}: ${gap.names.join(', ')}`);
  }
  console.error('llms/<family>.md is stale relative to custom-elements.json:\n');
  for (const [tag, lines] of byTag) {
    console.error(`  ${tag}`);
    for (const line of lines) console.error(`      ${line}`);
  }
  console.error(
    `\n${gaps.length} gap(s) across ${byTag.size} component(s). Document them in the component's` +
      ' section (or correct custom-elements.json, if the drift runs the other way), then re-run.',
  );
  process.exit(1);
}

console.log(
  'llms/ is fresh: every public property, attribute, event, slot, CSS part and themeable custom' +
    ' property of every custom element is documented.',
);

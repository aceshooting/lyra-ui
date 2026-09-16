#!/usr/bin/env node
// Reports, per family, every documentable name that custom-elements.json (or a component's own
// stylesheet) knows about but the component's llms/<family>.md section never mentions.
// This is the authoring aid behind `check-llms-freshness.mjs`: both consume `collectGaps()`, so the
// worklist printed here is exactly the set CI enforces. Run `node scripts/llms-gap-report.mjs
// [family...]`.
import { collectGaps, groupGapsForReport, FAMILIES } from './llms-gaps.mjs';

const wanted = process.argv.slice(2);
const familyNames = new Set(FAMILIES.map(([family]) => family));
const families = [...familyNames].filter(
  (family) => wanted.length === 0 || wanted.includes(family),
);
const gaps = collectGaps(families);

// Grouped from the gaps themselves, not from FAMILIES: cross-cutting findings carry a pseudo-family
// (`shared`) that owns no src/components/<family>/ directory, and printing only the known families
// silently hid them behind a total they still counted toward.
for (const [family, familyGaps] of groupGapsForReport(gaps, families)) {
  const byTag = new Map();
  for (const gap of familyGaps) {
    const entries = byTag.get(gap.tag) ?? [];
    entries.push(gap);
    byTag.set(gap.tag, entries);
  }

  const heading = familyNames.has(family) ? `${family}.md` : `${family} (cross-cutting)`;
  const unit = byTag.size === 1 ? 'entry' : 'entries';
  console.log(`\n### ${heading} — ${byTag.size} ${unit} with gaps`);
  for (const [tag, entries] of byTag) {
    console.log(`  ${tag} (${entries[0].lines} lines)`);
    for (const { kind, names } of entries) console.log(`      ${kind}: ${names.join(', ')}`);
  }
}

console.log(`\n${gaps.length} gap lines total.`);

#!/usr/bin/env node
// Reports, per family, every documentable name that custom-elements.json (or a component's own
// stylesheet) knows about but the component's llms/<family>.md section never mentions.
//
// This is the authoring aid behind `check-llms-freshness.mjs`: both consume `collectGaps()`, so the
// worklist printed here is exactly the set CI enforces. Run `node scripts/llms-gap-report.mjs
// [family...]`.
import { collectGaps, FAMILIES } from './llms-gaps.mjs';

const wanted = process.argv.slice(2);
const families = FAMILIES.map(([family]) => family).filter(
  (family) => wanted.length === 0 || wanted.includes(family),
);
const gaps = collectGaps(families);

for (const family of families) {
  const familyGaps = gaps.filter((gap) => gap.family === family);
  if (familyGaps.length === 0) continue;

  const byTag = new Map();
  for (const gap of familyGaps) {
    const entries = byTag.get(gap.tag) ?? [];
    entries.push(gap);
    byTag.set(gap.tag, entries);
  }

  console.log(`\n### ${family}.md — ${byTag.size} components with gaps`);
  for (const [tag, entries] of byTag) {
    console.log(`  ${tag} (${entries[0].lines} lines)`);
    for (const { kind, names } of entries) console.log(`      ${kind}: ${names.join(', ')}`);
  }
}

console.log(`\n${gaps.length} gap lines total.`);

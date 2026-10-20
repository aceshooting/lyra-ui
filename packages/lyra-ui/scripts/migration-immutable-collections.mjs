// The `immutable-collections` review rule (Lyra 30). Every item-identity collection keeps the
// caller's item objects and treats assigning the same array again as a no-op, so a change is
// published by assigning a NEW array. Code written for earlier releases mutated the array (or an
// item) and assigned it back; that no longer updates the view.
//
// The rule only reports. A mechanical rewrite would have to prove that the array is not shared and
// that a copy is cheap enough, which a text scan cannot know:
//
//  - `<receiver>.<property>.push|splice|pop|shift|unshift|sort|reverse|fill|copyWithin(` for a
//    property of the table below, when the file mentions a component that owns the property;
//  - `<receiver>.<property> = <receiver>.<property>`, which is now ignored;
//  - `const rows = <receiver>.<property>; rows.push(…); <receiver>.<property> = rows`, the same
//    mutation through a local alias.
//
// Report a site as reviewed with `lyra-migrate-reviewed: IMMUTABLE_COLLECTION_REVIEW:<property>` on
// the reported line or alone on the line above it. Dependency-free and filesystem-free: this module
// is copied beside migrate-wa.mjs into dist/cli.

export const IMMUTABLE_COLLECTION_RULE = 'immutable-collections';
export const IMMUTABLE_COLLECTION_CODE = 'IMMUTABLE_COLLECTION_REVIEW';

/** Every component property whose same-array assignment is ignored since Lyra 30. */
export const IMMUTABLE_COLLECTION_PAIRS = Object.freeze([
  { tag: 'lr-activity-feed', className: 'LyraActivityFeed', properties: ['entries'] },
  { tag: 'lr-agent-trace', className: 'LyraAgentTrace', properties: ['spans'] },
  { tag: 'lr-calendar', className: 'LyraCalendar', properties: ['events'] },
  { tag: 'lr-claim-evidence', className: 'LyraClaimEvidence', properties: ['citations', 'claims'] },
  { tag: 'lr-command-palette', className: 'LyraCommandPalette', properties: ['commands'] },
  { tag: 'lr-date-picker', className: 'LyraDatePicker', properties: ['presets'] },
  { tag: 'lr-eval-dataset', className: 'LyraEvalDataset', properties: ['examples'] },
  { tag: 'lr-eval-run', className: 'LyraEvalRun', properties: ['examples'] },
  { tag: 'lr-grounding-summary', className: 'LyraGroundingSummary', properties: ['citations'] },
  { tag: 'lr-ingestion-queue', className: 'LyraIngestionQueue', properties: ['items'] },
  { tag: 'lr-map', className: 'LyraMap', properties: ['dataLayers', 'markers'] },
  { tag: 'lr-memory-panel', className: 'LyraMemoryPanel', properties: ['longTerm', 'shortTerm'] },
  { tag: 'lr-mention-popover', className: 'LyraMentionPopover', properties: ['items'] },
  { tag: 'lr-node-palette', className: 'LyraNodePalette', properties: ['items'] },
  { tag: 'lr-prompt-queue', className: 'LyraPromptQueue', properties: ['items'] },
  { tag: 'lr-retrieval-results', className: 'LyraRetrievalResults', properties: ['chunks'] },
  { tag: 'lr-span-waterfall', className: 'LyraSpanWaterfall', properties: ['spans'] },
  { tag: 'lr-swatch-picker', className: 'LyraSwatchPicker', properties: ['items'] },
  { tag: 'lr-task-list', className: 'LyraTaskList', properties: ['items'] },
  { tag: 'lr-test-results', className: 'LyraTestResults', properties: ['suites'] },
  { tag: 'lr-thread-list', className: 'LyraThreadList', properties: ['threads'] },
  { tag: 'lr-tool-timeline', className: 'LyraToolTimeline', properties: ['entries'] },
  { tag: 'lr-trace-tree', className: 'LyraTraceTree', properties: ['spans'] },
  { tag: 'lr-virtual-list', className: 'LyraVirtualList', properties: ['items'] },
]);

const MUTATORS = ['push', 'splice', 'pop', 'shift', 'unshift', 'sort', 'reverse', 'fill', 'copyWithin'];
const MUTATOR_PATTERN = MUTATORS.join('|');
const SKIPPED_EXTENSIONS = new Set(['css', 'scss', 'less', 'pcss', 'postcss', 'json']);
const PROPERTIES = [...new Set(IMMUTABLE_COLLECTION_PAIRS.flatMap((pair) => pair.properties))].sort();
const PROPERTY_PATTERN = PROPERTIES.join('|');
const RECEIVER = String.raw`[A-Za-z_$][\w$]*(?:(?:\?\.|\.)[A-Za-z_$][\w$]*)*`;
const ACKNOWLEDGEMENT = /lyra-migrate-reviewed:\s*([^\n]*)/g;

const extensionOf = (file) => /\.([a-z0-9]+)$/i.exec(file)?.[1]?.toLowerCase() ?? '';
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function lineColumn(text, offset) {
  let line = 1;
  let lineStart = 0;
  for (let index = text.indexOf('\n'); index !== -1 && index < offset; index = text.indexOf('\n', index + 1)) {
    line += 1;
    lineStart = index + 1;
  }
  return { line, column: offset - lineStart + 1 };
}

/** The components of the table that own `property` and are mentioned by `text`. */
function owners(text, property, mentioned) {
  return IMMUTABLE_COLLECTION_PAIRS.filter((pair) => {
    if (!pair.properties.includes(property)) return false;
    let found = mentioned.get(pair.tag);
    if (found === undefined) {
      found = new RegExp(`(?<![\\w-])${pair.tag}(?![\\w-])|\\b${pair.className}\\b`).test(text);
      mentioned.set(pair.tag, found);
    }
    return found;
  });
}

function acknowledged(text, offset, property) {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const lineEnd = text.indexOf('\n', offset);
  const previousStart = lineStart > 0 ? text.lastIndexOf('\n', lineStart - 2) + 1 : lineStart;
  const nearby = text.slice(previousStart, lineEnd === -1 ? text.length : lineEnd);
  for (const match of nearby.matchAll(ACKNOWLEDGEMENT)) {
    if (new RegExp(`${IMMUTABLE_COLLECTION_CODE}:\\s*(?:lr-[a-z-]+\\.)?${property}(?![\\w$])`).test(match[1])) return true;
  }
  return false;
}

/**
 * Analyzes one file's text without editing it. Returns `{ warnings }` in the migration report
 * schema (`file`, `line`, `column`, `action`, ...).
 */
export function analyzeImmutableCollections(text, { file = 'input' } = {}) {
  const warnings = [];
  if (SKIPPED_EXTENSIONS.has(extensionOf(file))) return { warnings };
  const mentioned = new Map();
  const reported = new Set();
  const warn = (offset, property, tags, message) => {
    const key = `${offset}:${property}`;
    if (reported.has(key) || acknowledged(text, offset, property)) return;
    reported.add(key);
    warnings.push({
      file, ...lineColumn(text, offset), rule: IMMUTABLE_COLLECTION_RULE,
      upstreamTag: tags.map((pair) => pair.tag).join(' '), upstreamMember: property,
      action: 'manual-review', target: 'new array', warningCode: IMMUTABLE_COLLECTION_CODE, message,
    });
  };
  const describe = (tags, property) => `${tags.map((pair) => `${pair.tag}.${property}`).join(' / ')}`;
  const acknowledgement = (property) => `Acknowledge a reviewed site with lyra-migrate-reviewed: ${IMMUTABLE_COLLECTION_CODE}:${property}.`;

  for (const match of text.matchAll(new RegExp(String.raw`(?:\.|\?\.)(${PROPERTY_PATTERN})\s*(?:\?\.|\.)\s*(${MUTATOR_PATTERN})\s*\(`, 'g'))) {
    const tags = owners(text, match[1], mentioned);
    if (!tags.length) continue;
    warn(match.index, match[1], tags,
      `${match[1]}.${match[2]}() changes ${describe(tags, match[1])} in place; assigning the same array again is ignored since Lyra 30, so the view does not update. Assign a new array (for example [...${match[1]}, item]) instead. ${acknowledgement(match[1])}`);
  }

  for (const match of text.matchAll(new RegExp(String.raw`(${RECEIVER})\.(${PROPERTY_PATTERN})\s*=(?!=)\s*\1\.\2(?![\w$.(\[?])`, 'g'))) {
    const tags = owners(text, match[2], mentioned);
    if (!tags.length) continue;
    warn(match.index, match[2], tags,
      `${match[1]}.${match[2]} = ${match[1]}.${match[2]} assigns the array the property already holds, which is ignored since Lyra 30 (${describe(tags, match[2])}). Assign a new array. ${acknowledgement(match[2])}`);
  }

  const alias = new RegExp(String.raw`(${RECEIVER})\.(${PROPERTY_PATTERN})\s*=(?!=)\s*([A-Za-z_$][\w$]*)\s*(?:as\s+[^;\n]+)?(?=[;\n,)]|$)`, 'g');
  for (const match of text.matchAll(alias)) {
    const [, receiver, property, name] = match;
    const tags = owners(text, property, mentioned);
    if (!tags.length) continue;
    const before = text.slice(0, match.index);
    const declaration = new RegExp(String.raw`(?:const|let|var)\s+${escapeRegExp(name)}\b[^=\n]*=\s*${escapeRegExp(receiver)}\.${property}\s*(?:as\s+[^;\n]+)?\s*[;\n]`, 'g');
    let declared = null;
    for (const found of before.matchAll(declaration)) declared = found;
    if (!declared) continue;
    const between = before.slice(declared.index + declared[0].length);
    if (!new RegExp(String.raw`\b${escapeRegExp(name)}\s*\.\s*(?:${MUTATOR_PATTERN})\s*\(|\b${escapeRegExp(name)}\s*\[[^\]\n]+\]\s*=(?!=)`).test(between)) continue;
    warn(match.index, property, tags,
      `${name} is the array ${receiver}.${property} already holds and is changed in place before being assigned back; that assignment is ignored since Lyra 30 (${describe(tags, property)}). Copy it first (const ${name} = [...${receiver}.${property}]). ${acknowledgement(property)}`);
  }

  warnings.sort((left, right) => left.line - right.line || left.column - right.column);
  return { warnings };
}

/** Applies the rule to one file's text. The rule never edits: `content` is the input. */
export function migrateImmutableCollections(text, { file = 'input' } = {}) {
  return { content: text, changes: [], warnings: analyzeImmutableCollections(text, { file }).warnings };
}

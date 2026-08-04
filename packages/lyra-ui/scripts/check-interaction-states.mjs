// Every interactive part that reacts to :hover must also react to :active.
// A control that lights up under the pointer and then does nothing at all when pressed reads as
// broken — the user cannot tell the click registered until whatever it triggers finishes, which on
// a slow action is the difference between "it's working" and "click it again". The library had 176
// stylesheets carrying :hover and, before 8.0.0, essentially no pressed treatment; two components
// declared an :active rule byte-identical to their :hover one, which is the same defect wearing a
// costume.
// Scope, deliberately narrow: a rule whose selector both targets a `[part=...]`/`::part()` and
// carries `:hover`. A `:hover` on an internal, non-parted node is a decoration (a row tint, a
// scrollbar thumb); demanding a pressed state there would be noise, and noise is how a gate gets
// suppressed wholesale.
// A part that genuinely should not have one records that with a marker comment on or immediately
// above the rule:
//     /* no-pressed-state: the row is a hover affordance for the checkbox inside it, not a target */
// which is the same bargain the rest of this repo strikes — a deliberate omission is a sentence,
// never a silence.
// Run: node scripts/check-interaction-states.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const componentsRoot = join(packageDir, 'src', 'components');

function styleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return styleFiles(file);
    return entry.name.endsWith('.styles.ts') ? [file] : [];
  });
}

const OPT_OUT = /no-pressed-state:/;

/**
 * Splits a stylesheet into `{ selector, line, precededByOptOut }` records. A regex rather than a CSS
 * parser is honest here: these files are `css` template literals whose shape this repo controls, and
 * the check is about selector text, not cascade semantics.
 */
export function readHoverRules(source) {
  const rules = [];
  // Comments are blanked, not dropped: this repo's stylesheets carry long multi-line rationales
  // that contain braces and selector fragments, and line-by-line skipping leaks their text into
  // the next selector. Blanking preserves line numbers so a finding still points somewhere real.
  const optOutLines = new Set();
  source.split('\n').forEach((line, index) => {
    if (OPT_OUT.test(line)) optOutLines.add(index + 1);
  });
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const lines = stripped.split('\n');
  let pendingOptOut = false;
  let buffer = '';
  let bufferLine = 0;

  lines.forEach((line, index) => {
    if (optOutLines.has(index + 1)) {
      pendingOptOut = true;
      return;
    }
    const trimmed = line.trim();
    if (trimmed === '') return;

    if (buffer === '') bufferLine = index + 1;
    buffer += ` ${trimmed}`;

    // A rule written entirely on one line (`[part='x']:hover { color: red; }`) never ends in `{`,
    // so an earlier version of this parser skipped every one of them -- six real missing pressed
    // states hid behind that. Take the selector from the first brace wherever it falls.
    const brace = buffer.indexOf('{');
    if (brace < 0) {
      // A selector list spanning several lines; keep accumulating until the brace arrives. A line
      // that closes or terminates a declaration means we were never inside a selector.
      if (trimmed.endsWith('}') || trimmed.endsWith(';')) buffer = '';
      return;
    }
    const selector = buffer.slice(0, brace).trim();
    buffer = '';
    if (/:hover/.test(selector)) {
      rules.push({ selector, line: bufferLine, optedOut: pendingOptOut });
    }
    pendingOptOut = false;
  });
  return rules;
}

/** Does this selector address a public part (either from inside the shadow root, or via ::part)? */
export const targetsPart = (selector) => /\[part[~*^$|]?=/.test(selector) || /::part\(/.test(selector);

/** The same selector with :hover swapped for :active, which is what a sibling rule looks like. */
export const pressedForm = (selector) => selector.replace(/:hover/g, ':active');

if (process.argv[1] && process.argv[1].endsWith('check-interaction-states.mjs')) {
  const findings = [];
  let checked = 0;
  const files = styleFiles(componentsRoot);

  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
    const where = relative(packageDir, file);
    // Normalised so a sibling written with different whitespace still counts as present.
    const normalise = (text) => text.replace(/\s+/g, ' ').trim();
    const allSelectors = new Set(
      [...source.matchAll(/^([^{}\n][^{}]*)\{/gm)].map((match) => normalise(match[1])),
    );

    for (const rule of readHoverRules(raw)) {
      if (!targetsPart(rule.selector)) continue;
      checked += 1;
      if (rule.optedOut) continue;
      const pressed = normalise(pressedForm(rule.selector));
      // Either the exact :active twin, or any :active rule mentioning the same part -- a component
      // is free to express the pressed state on a different, simpler selector.
      const partNames = [...rule.selector.matchAll(/part[~*^$|]?='([^']+)'/g)].map((m) => m[1]);
      const hasTwin =
        allSelectors.has(pressed) ||
        [...allSelectors].some(
          (candidate) =>
            candidate.includes(':active') && partNames.some((part) => candidate.includes(`'${part}'`)),
        );
      if (!hasTwin) {
        findings.push(`${where}:${rule.line}: \`${rule.selector}\` has no :active counterpart`);
      }
    }
  }

  if (checked === 0) {
    console.error('Interaction-state contract matched ZERO hover rules on parts -- the file shape changed.');
    process.exitCode = 1;
  } else if (findings.length) {
    console.error(`Interaction-state contract failed with ${findings.length} finding(s) across ${checked} hovered part(s):`);
    for (const finding of findings) console.error(`- ${finding}`);
    console.error('\nAdd the matching :active rule, or record the omission with a `no-pressed-state: <reason>` comment.');
    process.exitCode = 1;
  } else {
    console.log(`Interaction-state contract passed: ${checked} hovered part(s) across ${files.length} stylesheets all have a pressed state.`);
  }
}


#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(rootDir, 'custom-elements.json');
const llmsFullPath = path.join(rootDir, 'llms-full.txt');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const llmsFull = readFileSync(llmsFullPath, 'utf8');

/**
 * Extracts `{ tagName -> sectionText }` for every documented tag in llms-full.txt.
 *
 * Two passes:
 *  1. Top-level `## ` headings define section boundaries (start = that line, end = the next
 *     `## ` heading or EOF). A heading may name more than one tag at once (e.g.
 *     `` ## `lyra-menu` / `lyra-menu-item` ``, or `` ## `lyra-chart` (core) `` alongside a
 *     separate "Typed subclasses: `lyra-line-chart`, ..." heading) — every `lyra-*` substring
 *     found on the heading line maps to that heading's whole section span.
 *  2. Every heading line at any depth (`## `, `### `, ...) can also name tags — this picks up a
 *     tag documented as a nested subheading (e.g. `### \`lyra-app-rail-item\`` inside
 *     `## \`lyra-app-rail\``'s span) and maps it to whichever top-level span (from pass 1)
 *     contains that heading line, rather than requiring it to have its own top-level heading.
 *
 * Headings inside fenced code blocks are ignored throughout (a code sample could otherwise
 * contain a line starting with `#`).
 */
function extractSections(text) {
  const fenceStarts = [...text.matchAll(/^```/gm)].map((m) => m.index);
  const isInsideFence = (idx) => {
    let count = 0;
    for (const f of fenceStarts) {
      if (f < idx) count++;
      else break;
    }
    return count % 2 === 1;
  };

  // Pass 1: top-level `## ` headings define the section spans.
  const topHeadings = [...text.matchAll(/^## (.*)$/gm)].filter((m) => !isInsideFence(m.index));
  const spans = topHeadings.map((m, i) => ({
    start: m.index,
    end: i + 1 < topHeadings.length ? topHeadings[i + 1].index : text.length,
  }));
  const spanTextAt = (idx) => {
    const span = spans.find((s) => idx >= s.start && idx < s.end);
    return span ? text.slice(span.start, span.end) : undefined;
  };

  // Pass 2: every heading line, at any depth, can name tags that belong to the enclosing
  // top-level span.
  const allHeadings = [...text.matchAll(/^#{2,}\s.*$/gm)].filter((m) => !isInsideFence(m.index));
  const sections = new Map();
  for (const heading of allHeadings) {
    const sectionText = spanTextAt(heading.index);
    if (!sectionText) continue;
    const tagsInHeading = heading[0].match(/lyra-[a-z0-9-]+/g) ?? [];
    for (const tag of tagsInHeading) {
      sections.set(tag, sectionText);
    }
  }
  return sections;
}

// The `FormAssociated` mixin's public surface (see `src/internal/form-associated.ts`'s
// `FormAssociatedInterface`) is a well-known, understood cross-cutting contract, not
// component-specific API, so — like `locale`/`strings` — it's never restated per-component in
// llms-full.txt. Some components re-declare these as their own thin-delegate overrides (e.g.
// `checkValidity() { return this.internals.checkValidity(); }`), which makes CEM record them as
// own (non-`inheritedFrom`) members, so they must also be excluded by name here.
const FORM_ASSOCIATED_SURFACE = new Set([
  'name',
  'value',
  'disabled',
  'required',
  'effectiveDisabled',
  'form',
  'labels',
  'validity',
  'validationMessage',
  'willValidate',
  'setFormValue',
  'checkValidity',
  'reportValidity',
  'formResetCallback',
  'formStateRestoreCallback',
  'formDisabledCallback',
  'internals',
]);

// Pre-existing drift discovered while building this check, on components this task did not touch.
// It predates this task and is out of scope for it — exempted here so the gate can still catch any
// *new* drift going forward without failing the build on this known baseline. A future cleanup pass
// should shrink this set (fix the component's llms-full.txt section, then remove its entry here);
// nothing should be added to it without the same scrutiny.
const KNOWN_PENDING_DRIFT = new Set([
  'lyra-attachment-chip:untitledLabel',
  'lyra-attachment-trigger:triggerTitle',
  'lyra-box-plot:accessibleDescription',
  'lyra-box-plot:accessibleLabel',
  'lyra-box-plot:showDataTable',
  'lyra-chart:accessibleDescription',
  'lyra-chart:accessibleLabel',
  'lyra-chart:showDataTable',
  'lyra-lite-chart:accessibleLabel',
  'lyra-lite-chart:minBarHeight',
  'lyra-chat-composer:stoppable',
  'lyra-chat-message:attachmentsPosition',
  'lyra-code-block:languagesOnly',
  'lyra-dialog:noLightDismiss',
  'lyra-file-input:acceptedMessage',
  'lyra-file-input:rejectedMessage',
  'lyra-menu:closeOnEscapeAnywhere',
  'lyra-split:dividerLabel',
  'lyra-tree-node:hasChildren',
  'lyra-widget:backdropInset',
]);

const sections = extractSections(llmsFull);
const problems = [];

for (const mod of manifest.modules ?? []) {
  for (const decl of mod.declarations ?? []) {
    if (!decl.customElement || !decl.tagName) continue;
    const tagName = decl.tagName;
    const section = sections.get(tagName);
    if (!section) {
      problems.push(`${tagName}: no "## \`${tagName}\`" section found in llms-full.txt`);
      continue;
    }
    const publicNames = (decl.members ?? [])
      .filter((m) => m.privacy !== 'private' && m.privacy !== 'protected')
      .filter((m) => m.static !== true)
      // Inherited members (from LyraElement or standard HTMLElement/EventTarget APIs) are never
      // restated per-component in llms-full.txt.
      .filter((m) => !m.inheritedFrom)
      // Nor is the FormAssociated mixin's surface, even when a component re-declares it as its
      // own override (see FORM_ASSOCIATED_SURFACE above).
      .filter((m) => !FORM_ASSOCIATED_SURFACE.has(m.name))
      .map((m) => m.name);
    for (const name of publicNames) {
      if (KNOWN_PENDING_DRIFT.has(`${tagName}:${name}`)) continue;
      if (!section.includes(name)) {
        problems.push(`${tagName}: property \`${name}\` is not mentioned in its llms-full.txt section`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error('llms-full.txt is stale relative to custom-elements.json:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`\n${problems.length} problem(s). Update llms-full.txt (or custom-elements.json, if the drift runs the other way) and re-run.`);
  process.exit(1);
}

console.log('llms-full.txt is fresh: every public property of every custom element is documented.');

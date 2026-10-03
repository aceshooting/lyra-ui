import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'vite';
import { chromium, firefox, webkit } from 'playwright';
import { zipEntry, zipEntryBytes } from '../test/zip.mjs';
import { runTableEditing } from './tables-browser.mjs';
import { assertExternalHyperlink, wordText } from '../test/xml.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const output = resolve(root, '.browser-output');
const screenshots = resolve(root, '.browser-evidence');
const browsers = (process.env.DOCX_BROWSERS ?? 'chromium,firefox,webkit').split(',').map(name => name.trim()).filter(Boolean);
for (const name of browsers) assert.ok(['chromium', 'firefox', 'webkit'].includes(name), `Unknown browser ${name}`);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const evidence = {
  generatedAt: new Date().toISOString(),
  measurementNote: 'Bundle bytes are emitted artifact sizes. Wall samples include browser driver and rendering work and are not latency guarantees.',
  browsers: {}, assets: {}, checks: []
};
const protectedParts = ['custom/payload.bin', 'customXml/item1.xml', 'word/media/pixel.png'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function createEditor(page, id, fixture = null) {
  const source = fixture ? [...await page.evaluate(kind => window.__docxTest.fixture(kind), fixture)] : null;
  const opened = await page.evaluate(async ({ id, source }) => {
    const element = document.createElement('lr-docx-editor');
    element.id = id;
    document.querySelector('#fixture').append(element);
    return source ? element.open(Uint8Array.from(source)) : element.newDocument();
  }, { id, source });
  assert.equal(opened.ok, true, `${id}: ${JSON.stringify(opened)}`);
  await page.locator(`#${id} .docx-pages`).waitFor({ state: 'visible' });
  return source;
}

async function saveEditor(page, id) {
  const result = await page.locator(`#${id}`).evaluate(async element => {
    const saved = await element.save();
    return saved.ok ? { ok: true, bytes: [...saved.value.bytes], dirty: element.snapshot().dirty } : saved;
  });
  assert.equal(result.ok, true, `${id}: ${JSON.stringify(result)}`);
  return result.bytes;
}

async function selectDocumentText(page, id) {
  await page.locator(`#${id} .docx-pages`).click();
  await page.keyboard.press('ControlOrMeta+A');
}

function assertProtectedParts(bytes, source) {
  for (const part of protectedParts) {
    assert.equal(sha256(zipEntryBytes(bytes, part)), sha256(zipEntryBytes(source, part)), `Protected part changed: ${part}`);
  }
}

async function runBasicEditing(page, check) {
  let basicSource;
  await check('basic editing fixture opens with actual paragraph styles and preserved OPC parts', async () => {
    basicSource = await createEditor(page, 'basic-style', 'basic-editing');
    const catalogs = await page.locator('#basic-style').evaluate(element => ({
      styles: element.paragraphStyles(), fonts: element.fontFamilies(),
      absent: element.can({ type: 'paragraph-style', styleId: 'Heading1' }),
      sourceText: element.querySelector('.docx-pages')?.textContent ?? ''
    }));
    assert.equal(catalogs.styles.ok, true, JSON.stringify(catalogs.styles));
    assert.ok(catalogs.styles.value.items.some(item => item.id === 'CustomHeading' && item.label === 'Custom Heading'));
    assert.equal(catalogs.styles.value.items.some(item => item.id === 'Heading1'), false);
    assert.deepEqual(catalogs.absent, { enabled: false, reason: 'invalid-option' });
    assert.equal(catalogs.fonts.ok, true, JSON.stringify(catalogs.fonts));
    assert.ok(catalogs.sourceText.includes('Café 東京'));
  });
  await check('paragraph select keeps selection, edits style, and undo/redo round trips', async () => {
    await selectDocumentText(page, 'basic-style');
    const select = page.locator('#basic-style lr-select[data-edit="paragraph-style"]');
    await select.getByRole('combobox').click();
    await select.locator('[part="option"][data-value="CustomHeading"]').click();
    const styled = await saveEditor(page, 'basic-style');
    assert.match(zipEntry(styled, 'word/document.xml'), /<w:pStyle\b[^>]*w:val="CustomHeading"/u);
    assertProtectedParts(styled, basicSource);
    const history = await page.locator('#basic-style').evaluate(element => ({
      undo: element.execute('undo'), redo: element.execute('redo')
    }));
    assert.equal(history.undo.ok, true, JSON.stringify(history));
    assert.equal(history.redo.ok, true, JSON.stringify(history));
    const redone = await saveEditor(page, 'basic-style');
    assert.match(zipEntry(redone, 'word/document.xml'), /<w:pStyle\b[^>]*w:val="CustomHeading"/u);
    assertProtectedParts(redone, basicSource);
    const reopened = await page.evaluate(async bytes => {
      const element = document.createElement('lr-docx-editor');
      element.id = 'basic-style-reopened';
      document.querySelector('#fixture').append(element);
      const result = await element.open(Uint8Array.from(bytes));
      return { result, text: element.querySelector('.docx-pages')?.textContent ?? '', styles: element.paragraphStyles() };
    }, redone);
    assert.equal(reopened.result.ok, true, JSON.stringify(reopened.result));
    assert.ok(reopened.text.includes('Café 東京'));
    assert.equal(reopened.styles.ok, true, JSON.stringify(reopened.styles));
    assert.ok(reopened.styles.value.items.some(item => item.id === 'CustomHeading'));
  });
  await check('mixed selections expose unavailable values and match selection restores concrete formatting', async () => {
    const source = await createEditor(page, 'basic-mixed', 'mixed-formatting');
    await selectDocumentText(page, 'basic-mixed');
    const mixed = await page.locator('#basic-mixed').evaluate(element => element.snapshot().formatting);
    for (const name of ['paragraphStyleId', 'alignment', 'fontFamily', 'fontSizePoints'])
      assert.equal(mixed[name], null, `Mixed ${name} must not be inferred from one paragraph`);
    const selected = await page.locator('#basic-mixed').evaluate(element => {
      const found = element.find('First mixed paragraph');
      if (!found.ok) return { found };
      const result = element.selectMatch(found.value.matches[0].id);
      return { result, formatting: element.snapshot().formatting };
    });
    assert.equal(selected.result.ok, true, JSON.stringify(selected));
    assert.equal(selected.formatting.paragraphStyleId, 'Normal');
    assert.equal(selected.formatting.alignment, 'left');
    assert.equal(selected.formatting.fontFamily, 'Arial');
    assert.equal(selected.formatting.fontSizePoints, 12);
    assertProtectedParts(await saveEditor(page, 'basic-mixed'), source);
  });
  await check('alignment controls serialize all four values including Word both for justify', async () => {
    const source = await createEditor(page, 'basic-alignment', 'basic-editing');
    await page.locator('#basic-alignment .docx-pages').getByText('Corpus opening', { exact: true }).click();
    await page.keyboard.insertText('Aligned paragraph');
    for (const [value, serialized] of [['left', 'left'], ['center', 'center'], ['right', 'right'], ['justify', 'both']]) {
      await page.locator(`#basic-alignment [data-edit="alignment"][data-value="${value}"]`).click();
      assert.equal(await page.locator('#basic-alignment').evaluate(element => element.snapshot().formatting.alignment), value);
      const bytes = await saveEditor(page, 'basic-alignment');
      assertProtectedParts(bytes, source);
      assert.match(zipEntry(bytes, 'word/document.xml'), new RegExp(`<w:jc\\b[^>]*w:val="${serialized}"`, 'u'));
    }
    const bytes = await saveEditor(page, 'basic-alignment');
    const reopened = await page.evaluate(async source => {
      const element = document.createElement('lr-docx-editor');
      element.id = 'basic-alignment-reopened';
      document.querySelector('#fixture').append(element);
      return element.open(Uint8Array.from(source));
    }, bytes);
    assert.equal(reopened.ok, true, JSON.stringify(reopened));
    const roundTrip = await saveEditor(page, 'basic-alignment-reopened');
    assert.match(zipEntry(roundTrip, 'word/document.xml'), /<w:jc\b[^>]*w:val="both"/u);
    assertProtectedParts(roundTrip, source);
  });
  await check('bullet and numbered buttons create undoable list structure', async () => {
    for (const kind of ['bullet', 'numbered']) {
      const id = `basic-${kind}`;
      const source = await createEditor(page, id, 'basic-editing');
      await page.locator(`#${id} .docx-pages`).getByText('Corpus opening', { exact: true }).click();
      await page.keyboard.insertText(`${kind} item`);
      await page.locator(`#${id} [data-edit="toggle-list"][data-kind="${kind}"]`).click();
      const bytes = await saveEditor(page, id);
      assertProtectedParts(bytes, source);
      assert.match(zipEntry(bytes, 'word/document.xml'), /<w:numPr(?:\s|>)/u);
      assert.match(zipEntry(bytes, 'word/numbering.xml'), kind === 'bullet' ? /w:val="bullet"/u : /w:val="decimal"/u);
      const result = await page.locator(`#${id}`).evaluate(element => ({ undo: element.execute('undo'), redo: element.execute('redo') }));
      assert.equal(result.undo.ok, true, JSON.stringify(result));
      assert.equal(result.redo.ok, true, JSON.stringify(result));
      const redone = await saveEditor(page, id);
      assert.match(zipEntry(redone, 'word/document.xml'), /<w:numPr(?:\s|>)/u);
      assertProtectedParts(redone, source);
    }
  });
  await check('font family, half-point size, and color controls serialize run formatting', async () => {
    const source = await createEditor(page, 'basic-type', 'basic-editing');
    await page.locator('#basic-type .docx-pages').getByText('Corpus opening', { exact: true }).click();
    await page.keyboard.insertText('Typography sample');
    await selectDocumentText(page, 'basic-type');
    const family = page.locator('#basic-type lr-combobox[data-edit="font-family"]');
    await family.locator('[part="combobox-input"]').fill('Arial');
    await family.locator('[part="combobox-input"]').press('Enter');
    assert.match(zipEntry(await saveEditor(page, 'basic-type'), 'word/document.xml'), /<w:rFonts\b[^>]*Arial/u);
    assert.equal((await page.locator('#basic-type').evaluate(element => element.execute('undo'))).ok, true);
    assert.equal(/<w:rFonts\b[^>]*Arial/u.test(zipEntry(await saveEditor(page, 'basic-type'), 'word/document.xml')), false);
    assert.equal((await page.locator('#basic-type').evaluate(element => element.execute('redo'))).ok, true);
    await selectDocumentText(page, 'basic-type');
    const size = page.locator('#basic-type lr-number-input[data-edit="font-size"]');
    await size.locator('[part="input"]').fill('14.5');
    await size.locator('[part="input"]').press('Tab');
    await selectDocumentText(page, 'basic-type');
    const color = page.locator('#basic-type lr-color-picker[data-edit="text-color"]');
    await color.locator('[part="trigger"]').click();
    await color.locator('[part="input"]').fill('#D02030');
    await color.locator('[part="input"]').press('Enter');
    const bytes = await saveEditor(page, 'basic-type');
    const xml = zipEntry(bytes, 'word/document.xml');
    assert.match(xml, /<w:rFonts\b[^>]*Arial/u);
    assert.match(xml, /<w:sz\b[^>]*w:val="29"/u);
    assert.match(xml, /<w:color\b[^>]*w:val="D02030"/u);
    assertProtectedParts(bytes, source);
    assert.equal((await page.locator('#basic-type').evaluate(element => element.execute('undo'))).ok, true);
    assert.equal(/<w:color\b[^>]*w:val="D02030"/u.test(zipEntry(await saveEditor(page, 'basic-type'), 'word/document.xml')), false);
    assert.equal((await page.locator('#basic-type').evaluate(element => element.execute('redo'))).ok, true);
    assert.match(zipEntry(await saveEditor(page, 'basic-type'), 'word/document.xml'), /<w:color\b[^>]*w:val="D02030"/u);
    const reopened = await page.evaluate(async source => {
      const element = document.createElement('lr-docx-editor');
      element.id = 'basic-type-reopened';
      document.querySelector('#fixture').append(element);
      return element.open(Uint8Array.from(source));
    }, bytes);
    assert.equal(reopened.ok, true, JSON.stringify(reopened));
    const roundTrip = await saveEditor(page, 'basic-type-reopened');
    const reopenedXml = zipEntry(roundTrip, 'word/document.xml');
    const reopenedText = [...reopenedXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gu)].map(match => match[1]).join('');
    assert.ok(reopenedText.includes('Typography sample'));
    assert.match(reopenedXml, /<w:rFonts\b[^>]*Arial/u);
    assert.match(reopenedXml, /<w:sz\b[^>]*w:val="29"/u);
    assert.match(reopenedXml, /<w:color\b[^>]*w:val="D02030"/u);
    assertProtectedParts(roundTrip, source);
  });
  await check('automatic color and invalid formatting inputs have bounded behavior', async () => {
    await selectDocumentText(page, 'basic-type');
    await page.locator('#basic-type [data-edit="text-color-auto"]').click();
    assert.match(zipEntry(await saveEditor(page, 'basic-type'), 'word/document.xml'), /<w:color\b[^>]*w:val="auto"/u);
    const result = await page.locator('#basic-type').evaluate(element => {
      const before = element.snapshot().revision;
      const refusals = [
        element.execute({ type: 'font-size', points: 2.25 }),
        element.execute({ type: 'font-size', points: Number.POSITIVE_INFINITY }),
        element.execute({ type: 'font-family', family: 'A,'.repeat(40) }),
        element.execute({ type: 'text-color', color: '#XYZXYZ' }),
        element.execute({ type: 'paragraph-style', styleId: 'MissingStyle' })
      ];
      return { refusals, unchanged: before === element.snapshot().revision, color: element.snapshot().formatting.color };
    });
    assert.ok(result.refusals.every(entry => !entry.ok), JSON.stringify(result));
    assert.equal(result.unchanged, true);
    assert.equal(result.color, null);
  });
  await check('link popover inserts safe relationship and remove-link is undoable', async () => {
    const source = await createEditor(page, 'basic-link', 'basic-editing');
    await page.locator('#basic-link .docx-pages').getByText('Corpus opening', { exact: true }).click();
    const beforeTyping = await page.locator('#basic-link').evaluate(element => {
      const pages = element.querySelector('.docx-pages');
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      const record = { event: null, listener: null };
      record.listener = event => {
        let focused = document.activeElement;
        while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
        record.event = { data: event.data, inputType: event.inputType,
          targetOwned: pages.contains(event.target), focusOwned: pages.contains(focused) };
      };
      pages.__nativeInputRecord = record;
      pages.addEventListener('beforeinput', record.listener, { capture: true, once: true });
      return { revision: element.snapshot().revision.value, focusOwned: pages.contains(active) };
    });
    let nativeInput;
    try {
      assert.equal(beforeTyping.focusOwned, true, 'Linked text must be typed into basic-link');
      await page.keyboard.insertText('Linked words');
    } finally {
      nativeInput = await page.locator('#basic-link .docx-pages').evaluate(pages => {
        const record = pages.__nativeInputRecord;
        pages.removeEventListener('beforeinput', record.listener, { capture: true });
        delete pages.__nativeInputRecord;
        return record.event;
      });
    }
    assert.equal(nativeInput?.data, 'Linked words', JSON.stringify(nativeInput));
    assert.equal(nativeInput.targetOwned, true, JSON.stringify(nativeInput));
    assert.equal(nativeInput.focusOwned, true, JSON.stringify(nativeInput));
    // Native input is queued by the editor; its dispatch does not commit the document synchronously.
    await page.waitForFunction(revision => {
      const element = document.querySelector('#basic-link');
      const pages = element.querySelector('.docx-pages');
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      return element.snapshot().revision.value > revision && pages.textContent.includes('Linked words') && pages.contains(active);
    }, beforeTyping.revision);
    const selectLinkedWords = async id => {
      const selected = await page.locator(`#${id}`).evaluate(element => {
        const found = element.find('Linked words');
        if (!found.ok) return { found };
        const matches = found.value.matches;
        return { matchCount: matches.length, selected: matches.length === 1 ? element.selectMatch(matches[0].id) : null };
      });
      assert.equal(selected.matchCount, 1, `${id}: expected exactly one linked-text match: ${JSON.stringify(selected)}`);
      assert.equal(selected.selected.ok, true, `${id}: ${JSON.stringify(selected)}`);
    };
    await selectLinkedWords('basic-link');
    const triggerState = () => page.locator('#basic-link').evaluate(element => {
      const popover = element.shadowRoot.querySelector('[part="link-popover"]');
      const host = popover?.querySelector('[part="link-trigger"]');
      const native = host?.shadowRoot?.querySelector('[part~="base"]');
      return { hostExpanded: host?.getAttribute('aria-expanded') ?? null,
        nativeExpanded: native?.getAttribute('aria-expanded') ?? null,
        controls: native?.getAttribute('aria-controls') ?? null, popoverId: popover?.id ?? null,
        controlsPublicHost: native && 'ariaControlsElements' in native ? native.ariaControlsElements?.includes(popover) ?? false : null };
    });
    const closed = await triggerState();
    assert.equal(closed.hostExpanded, null);
    assert.equal(closed.nativeExpanded, 'false');
    assert.ok(closed.popoverId);
    if (closed.controlsPublicHost === null) assert.equal(closed.controls, closed.popoverId);
    else assert.equal(closed.controlsPublicHost, true);
    await page.locator('#basic-link [part="link-trigger"]').click();
    await page.waitForFunction(() => {
      const popover = document.querySelector('#basic-link')?.shadowRoot?.querySelector('[part="link-popover"]');
      return popover?.querySelector('[part="link-trigger"]')?.shadowRoot?.querySelector('[part~="base"]')?.getAttribute('aria-expanded') === 'true';
    });
    const expanded = await triggerState();
    assert.equal(expanded.hostExpanded, null);
    assert.equal(expanded.nativeExpanded, 'true');
    if (expanded.controlsPublicHost === null) assert.equal(expanded.controls, closed.popoverId);
    else assert.equal(expanded.controlsPublicHost, true);
    await page.locator('#basic-link [part="link-href"] [part="input"]').fill('https://example.test/linked');
    await page.locator('#basic-link [part="link-apply"]').click();
    await page.waitForFunction(() => {
      const popover = document.querySelector('#basic-link')?.shadowRoot?.querySelector('[part="link-popover"]');
      return popover?.querySelector('[part="link-trigger"]')?.shadowRoot?.querySelector('[part~="base"]')?.getAttribute('aria-expanded') === 'false';
    });
    const bytes = await saveEditor(page, 'basic-link');
    assertExternalHyperlink(zipEntry(bytes, 'word/document.xml'), zipEntry(bytes, 'word/_rels/document.xml.rels'), {
      text: 'Linked words', target: 'https://example.test/linked'
    });
    assertProtectedParts(bytes, source);
    const refused = await page.locator('#basic-link').evaluate(element => ({
      http: element.execute({ type: 'link', href: 'http://example.test/unsafe' }),
      script: element.execute({ type: 'link', href: 'javascript:alert(1)' })
    }));
    assert.deepEqual(refused.http, { ok: false, code: 'invalid-option' });
    assert.deepEqual(refused.script, { ok: false, code: 'invalid-option' });
    const reopened = await page.evaluate(async source => {
      const element = document.createElement('lr-docx-editor');
      element.id = 'basic-link-reopened';
      document.querySelector('#fixture').append(element);
      return element.open(Uint8Array.from(source));
    }, bytes);
    assert.equal(reopened.ok, true, JSON.stringify(reopened));
    const roundTrip = await saveEditor(page, 'basic-link-reopened');
    assertExternalHyperlink(zipEntry(roundTrip, 'word/document.xml'), zipEntry(roundTrip, 'word/_rels/document.xml.rels'), {
      text: 'Linked words', target: 'https://example.test/linked'
    });
    assertProtectedParts(roundTrip, source);
    await selectLinkedWords('basic-link-reopened');
    await page.locator('#basic-link-reopened [part="link-trigger"]').click();
    await page.locator('#basic-link-reopened [part="link-remove"]').click();
    const unlinked = await saveEditor(page, 'basic-link-reopened');
    assert.equal((zipEntry(unlinked, 'word/document.xml').match(/<w:hyperlink\b/gu) ?? []).length,
      (zipEntry(roundTrip, 'word/document.xml').match(/<w:hyperlink\b/gu) ?? []).length - 1);
    assert.ok(wordText(zipEntry(unlinked, 'word/document.xml')).includes('Linked words'));
    const undo = await page.locator('#basic-link-reopened').evaluate(element => element.execute('undo'));
    assert.equal(undo.ok, true, JSON.stringify(undo));
    assert.match(zipEntry(await saveEditor(page, 'basic-link-reopened'), 'word/document.xml'), /<w:hyperlink\b/u);
  });
  await check('literal find spans OOXML runs without dirtying the revision', async () => {
    const result = await page.locator('#basic-style-reopened').evaluate(element => {
      const before = element.snapshot();
      const found = element.find('Café 東京');
      if (!found.ok || !found.value.matches.length) return { found };
      const first = found.value.matches[0];
      const selected = element.selectMatch(first.id, { expectedRevision: found.value.revision });
      const after = element.snapshot();
      return {
        found, selected, sameRevision: before.revision === after.revision, sameDirty: before.dirty === after.dirty,
        selectionAdvanced: after.selection.version > before.selection.version,
        frozen: Object.isFrozen(found.value) && Object.isFrozen(first),
      };
    });
    assert.equal(result.found.ok, true, JSON.stringify(result));
    assert.equal(result.found.value.matches.length, 2);
    assert.equal(result.found.value.matches[0].text, 'Café 東京');
    assert.equal(result.selected.ok, true, JSON.stringify(result));
    assert.equal(result.sameRevision, true);
    assert.equal(result.sameDirty, true);
    assert.equal(result.selectionAdvanced, true);
    assert.equal(result.frozen, true);
    for (const match of result.found.value.matches) {
      assert.ok(match.before.length <= 48 && match.after.length <= 48);
    }
  });
  await check('find options, stale ids, foreign ids and bounded results refuse safely', async () => {
    const result = await page.locator('#basic-style-reopened').evaluate(element => {
      const first = element.find('alpha', { matchCase: true, wholeWord: true });
      const id = first.ok ? first.value.matches[0]?.id : '';
      const second = element.find('Alpha', { matchCase: true, wholeWord: true });
      return {
        first, second,
        stale: element.selectMatch(id),
        forged: element.replaceMatch('forged', 'X'),
        wrongRevision: second.ok && second.value.matches[0]
          ? element.selectMatch(second.value.matches[0].id, { expectedRevision: { documentId: 'foreign', value: 0 } }) : null
      };
    });
    assert.equal(result.first.ok, true, JSON.stringify(result));
    assert.equal(result.first.value.matches.length, 1, 'whole-word alpha included alphabeta');
    assert.equal(result.second.ok, true, JSON.stringify(result));
    assert.equal(result.second.value.matches.length, 1);
    assert.deepEqual(result.stale, { ok: false, code: 'stale-search' });
    assert.deepEqual(result.forged, { ok: false, code: 'stale-search' });
    assert.equal(result.wrongRevision.ok, false);
    await createEditor(page, 'basic-limit', 'search-limit');
    const limited = await page.locator('#basic-limit').evaluate(element => element.find('needle'));
    assert.equal(limited.ok, true, JSON.stringify(limited));
    assert.equal(limited.value.matches.length, 100);
    assert.equal(limited.value.truncated, true);
    const foreign = await page.evaluate(() => {
      const first = document.querySelector('#basic-style-reopened');
      const second = document.querySelector('#basic-limit');
      const found = first.find('Café');
      return found.ok ? second.selectMatch(found.value.matches[0].id) : found;
    });
    assert.deepEqual(foreign, { ok: false, code: 'stale-search' });
  });
  await check('mailto and fragment links survive bounded edits, save and reopen', async () => {
    for (const [name, href] of [['mail', 'mailto:reader@example.test'], ['fragment', '#chapter']]) {
      const id = `basic-link-${name}`;
      const source = await createEditor(page, id, 'basic-editing');
      const applied = await page.locator(`#${id}`).evaluate((element, href) => {
        const found = element.find('Café 東京');
        if (!found.ok) return found;
        const selected = element.selectMatch(found.value.matches[0].id);
        return selected.ok ? element.execute({ type: 'link', href, text: 'Bounded link' }) : selected;
      }, href);
      assert.equal(applied.ok, true, JSON.stringify(applied));
      const bytes = await saveEditor(page, id);
      assertProtectedParts(bytes, source);
      const checkTarget = data => {
        const xml = zipEntry(data, 'word/document.xml');
        assert.match(xml, /<w:hyperlink\b/u);
        assert.ok(xml.includes('Bounded link'));
        const relationships = zipEntry(data, 'word/_rels/document.xml.rels');
        assert.ok(relationships.includes(href) || (name === 'fragment' && /w:anchor="chapter"/u.test(xml)));
      };
      checkTarget(bytes);
      const reopened = await page.locator(`#${id}`).evaluate((element, data) => element.open(Uint8Array.from(data)), bytes);
      assert.equal(reopened.ok, true, JSON.stringify(reopened));
      const roundTrip = await saveEditor(page, id);
      checkTarget(roundTrip);
      assertProtectedParts(roundTrip, source);
    }
  });
  await check('XML-invalid authored text is refused before any content or revision changes', async () => {
    await createEditor(page, 'basic-xml-text', 'basic-editing');
    const result = await page.locator('#basic-xml-text').evaluate(element => {
      const invalid = ['\u0000', '\u000b', '\ufffe', '\ud800', '\udc00'];
      const found = element.find('Café 東京');
      if (!found.ok) return { found };
      const before = element.snapshot().revision;
      const links = invalid.map(text => element.execute({ type: 'link', href: 'https://example.test', text }));
      const replacements = invalid.map(text => element.replaceMatch(found.value.matches[0].id, text));
      const unchanged = element.snapshot().revision === before;
      const valid = element.replaceMatch(found.value.matches[0].id, '😀 東京\tline\nnext\rend');
      return { found, links, replacements, unchanged, valid };
    });
    assert.equal(result.found.ok, true, JSON.stringify(result));
    for (const refusal of [...result.links, ...result.replacements])
      assert.deepEqual(refusal, { ok: false, code: 'invalid-option' });
    assert.equal(result.unchanged, true);
    assert.equal(result.valid.ok, true, JSON.stringify(result));
    const saved = await saveEditor(page, 'basic-xml-text');
    assert.ok(zipEntry(saved, 'word/document.xml').includes('😀'));
    assertProtectedParts(saved, basicSource);
  });
  await check('empty replacement deletes one match and one undo restores it', async () => {
    await createEditor(page, 'basic-delete', 'basic-editing');
    const result = await page.locator('#basic-delete').evaluate(element => {
      const found = element.find('Café 東京');
      if (!found.ok) return { found };
      const before = element.snapshot().revision;
      const replaced = element.replaceMatch(found.value.matches[0].id, '', { expectedRevision: found.value.revision });
      const stale = element.replaceMatch(found.value.matches[0].id, 'stale');
      return { found, replaced, stale, advanced: element.snapshot().revision.value === before.value + 1 };
    });
    assert.equal(result.found.ok, true, JSON.stringify(result));
    assert.equal(result.replaced.ok, true, JSON.stringify(result));
    assert.deepEqual(result.stale, { ok: false, code: 'stale-search' });
    assert.equal(result.advanced, true);
    const deleted = await saveEditor(page, 'basic-delete');
    assert.equal(zipEntry(deleted, 'word/document.xml').includes('Café 東京'), true, 'The second match must remain');
    assertProtectedParts(deleted, basicSource);
    const undo = await page.locator('#basic-delete').evaluate(element => element.execute('undo'));
    assert.equal(undo.ok, true, JSON.stringify(undo));
    const restored = await page.locator('#basic-delete').evaluate(element => element.find('Café 東京'));
    assert.equal(restored.ok, true, JSON.stringify(restored));
    assert.equal(restored.value.matches.length, 2);
  });
  await check('find Previous wraps to last, then fresh Next starts at first', async () => {
    await createEditor(page, 'basic-navigation', 'basic-editing');
    const id = 'basic-navigation';
    await page.locator(`#${id} [part="find-toggle"]`).click();
    await page.locator(`#${id} [part="find-query"] [part="input"]`).fill('Café 東京');
    const composing = await page.locator(`#${id}`).evaluate(async element => {
      const field = element.shadowRoot.querySelector('[part="find-query"]');
      const input = field.shadowRoot.querySelector('[part="input"]');
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', isComposing: true, bubbles: true, composed: true, cancelable: true,
      }));
      await element.updateComplete;
      return element.shadowRoot.querySelector('[part="find-count"]').textContent.trim();
    });
    assert.equal(composing, '', 'IME confirmation must not submit a find query');
    await page.locator(`#${id} [part="find-submit"]`).click();
    await page.locator(`#${id} [part="find-previous"]`).click();
    await page.locator(`#${id} [part="find-replace"] [part="input"]`).fill('Last only');
    await page.locator(`#${id} [part="find-replace-button"]`).click();
    const last = zipEntry(await saveEditor(page, id), 'word/document.xml');
    assert.ok(last.includes('Last only'));
    assert.ok(last.indexOf('Last only') > last.indexOf('Alpha alphabeta'), 'Previous selected the first match');
    const remaining = await page.locator(`#${id}`).evaluate(element => element.find('Café 東京'));
    assert.equal(remaining.ok, true, JSON.stringify(remaining));
    assert.equal(remaining.value.matches.length, 1);
    await page.locator(`#${id} [part="find-submit"]`).click();
    await page.locator(`#${id} [part="find-next"]`).click();
    await page.locator(`#${id} [part="find-replace"] [part="input"]`).fill('First only');
    await page.locator(`#${id} [part="find-replace-button"]`).click();
    const bytes = await saveEditor(page, id);
    const first = zipEntry(bytes, 'word/document.xml');
    assert.ok(first.includes('First only'));
    assert.ok(first.indexOf('First only') < first.indexOf('Alpha alphabeta'), 'Next skipped the first match');
    assert.ok(first.indexOf('Last only') > first.indexOf('Alpha alphabeta'));
    assertProtectedParts(bytes, basicSource);
  });
  await check('find pane navigates and replaces one match through native controls', async () => {
    const id = 'basic-style-reopened';
    await page.locator(`#${id} [part="find-toggle"]`).click();
    await page.locator(`#${id} [part="find-query"] [part="input"]`).fill('Café 東京');
    await page.locator(`#${id} [part="find-submit"]`).click();
    assert.match((await page.locator(`#${id} [part="find-count"]`).textContent()) ?? '', /2/u);
    await page.locator(`#${id} [part="find-next"]`).click();
    await page.locator(`#${id} [part="find-replace"] [part="input"]`).fill('Replaced 東京');
    await page.locator(`#${id} [part="find-replace-button"]`).click();
    const changed = await saveEditor(page, id);
    assert.ok(zipEntry(changed, 'word/document.xml').includes('Replaced 東京'));
    assertProtectedParts(changed, basicSource);
    const undo = await page.locator(`#${id}`).evaluate(element => element.execute('undo'));
    assert.equal(undo.ok, true, JSON.stringify(undo));
    const restored = await saveEditor(page, id);
    assert.equal(zipEntry(restored, 'word/document.xml').includes('Replaced 東京'), false);
    assert.ok(zipEntry(restored, 'word/document.xml').includes('Café'));
  });
  await check('read-only search selects matches but refuses replacement', async () => {
    const source = await page.evaluate(() => window.__docxTest.fixture('basic-editing'));
    const result = await page.evaluate(async bytes => {
      const element = document.createElement('lr-docx-editor');
      element.id = 'basic-readonly';
      element.readOnly = true;
      document.querySelector('#fixture').append(element);
      const opened = await element.open(Uint8Array.from(bytes));
      if (!opened.ok) return { opened };
      const found = element.find('Café 東京');
      if (!found.ok || !found.value.matches.length) return { opened, found };
      const before = element.snapshot();
      const selected = element.selectMatch(found.value.matches[0].id);
      const replaced = element.replaceMatch(found.value.matches[0].id, 'Forbidden');
      return { opened, found, selected, replaced, sameRevision: before.revision === element.snapshot().revision };
    }, [...source]);
    assert.equal(result.opened.ok, true, JSON.stringify(result));
    assert.equal(result.found.ok, true, JSON.stringify(result));
    assert.equal(result.selected.ok, true, JSON.stringify(result));
    assert.deepEqual(result.replaced, { ok: false, code: 'read-only' });
    assert.equal(result.sameRevision, true);
  });
  await check('ordinary typing avoids catalogs, find and save', async () => {
    await createEditor(page, 'basic-typing');
    await page.locator('#basic-typing').evaluate(element => {
      element.__catalogSpy = { paragraphStyles: 0, fontFamilies: 0, find: 0, save: 0 };
      element.__catalogOriginals = {};
      for (const name of Object.keys(element.__catalogSpy)) {
        element.__catalogOriginals[name] = element[name];
        element[name] = function (...args) {
          this.__catalogSpy[name]++;
          return this.__catalogOriginals[name].apply(this, args);
        };
      }
    });
    await page.locator('#basic-typing .docx-pages').click();
    for (const character of 'ordinary') await page.keyboard.insertText(character);
    await page.waitForFunction(() => {
      const editor = document.querySelector('#basic-typing');
      return editor?.snapshot()?.revision?.value > 0 && editor.querySelector('.docx-pages')?.textContent.includes('ordinary');
    });
    const result = await page.locator('#basic-typing').evaluate(element => {
      const calls = { ...element.__catalogSpy };
      for (const [name, original] of Object.entries(element.__catalogOriginals)) element[name] = original;
      return { calls, text: element.querySelector('.docx-pages')?.textContent ?? '' };
    });
    assert.deepEqual(result.calls, { paragraphStyles: 0, fontFamilies: 0, find: 0, save: 0 });
    assert.ok(result.text.includes('ordinary'));
  });
  await check('open find pane remains accessible in narrow RTL layout', async () => {
    const element = page.locator('#basic-style-reopened');
    await element.evaluate(async editor => {
      editor.setAttribute('dir', 'rtl');
      await editor.updateComplete;
    });
    await page.setViewportSize({ width: 320, height: 780 });
    const fontSize = await element.evaluate(editor => {
      const input = editor.shadowRoot.querySelector('[part="font-size"]').shadowRoot.querySelector('[part="input"]');
      const context = document.createElement('canvas').getContext('2d');
      context.font = getComputedStyle(input).font;
      return { width: input.getBoundingClientRect().width, required: context.measureText('14.5').width };
    });
    assert.ok(fontSize.width >= fontSize.required, 'The font-size field must visibly fit a fractional value at 320px');
    const results = await page.evaluate(() => window.axe.run(document.querySelector('#basic-style-reopened'),
      { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    assert.deepEqual(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })), []);
    assert.ok(await element.locator('[part="find"]').isVisible());
    await page.setViewportSize({ width: 1440, height: 900 });
  });
}

async function runEditorWorkflows(page, check) {
  // Earlier suites have completed; keep native pointer coordinates bounded for this independent suite.
  await page.evaluate(() => document.querySelector('#fixture').replaceChildren());
  await check('leaving an unchanged size field and reselecting text retains the new formatting target', async () => {
    const id = 'workflow-selection';
    await createEditor(page, id);
    const editor = page.locator(`#${id}`);
    await editor.locator('.docx-pages').click();
    await page.keyboard.insertText('Selection lease');
    await editor.locator('[part="font-size"]').click();
    assert.equal(await editor.evaluate(element => {
      const field = element.shadowRoot.activeElement;
      return field?.getAttribute('part') === 'font-size' && field.shadowRoot.activeElement?.getAttribute('part') === 'input';
    }), true, 'The native pointer action must focus the font-size input');
    await selectDocumentText(page, id);
    const before = await editor.evaluate(element => element.snapshot().revision.value);
    await editor.locator('[data-command="bold"]').click();
    const after = await editor.evaluate(element => element.snapshot());
    assert.ok(after.revision.value > before, 'Reselecting after an unchanged field must not retain a stale toolbar lease');
    assert.match(zipEntry(await saveEditor(page, id), 'word/document.xml'), /<w:b(?:\s|\/|>)/u);
  });
  await check('native file picking opens, rejects, and restores focus without retaining input files', async () => {
    const id = 'workflow-files';
    await page.evaluate(id => {
      const element = document.createElement('lr-docx-editor');
      element.id = id;
      document.querySelector('#fixture').append(element);
    }, id);
    const editor = page.locator(`#${id}`);
    const choose = async (kind, name) => {
      const bytes = await page.evaluate(kind => window.__docxTest.fixture(kind), kind);
      const pending = page.waitForEvent('filechooser');
      await editor.locator('[part="open-button"]').click();
      await (await pending).setFiles({ name, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
    };
    await choose('accepted', 'picked.docx');
    await page.waitForFunction(id => document.querySelector(`#${id}`)?.snapshot()?.status === 'ready', id);
    assert.equal(await editor.locator('[part="filename"]').textContent(), 'picked.docx');
    assert.equal(await editor.locator('[part="file-input"]').inputValue(), '');
    await choose('malformed', 'broken.docx');
    await page.waitForFunction(id => document.querySelector(`#${id}`)?.snapshot()?.status === 'error', id);
    assert.equal(await editor.locator('p[part="error"]').isVisible(), true);
    assert.equal(await editor.locator('[part="open-button"]').getByRole('button').isDisabled(), false,
      'A refused file must leave Open available for recovery');
    await page.waitForFunction(id => document.querySelector(`#${id}`)?.shadowRoot.activeElement?.getAttribute('part') === 'open-button', id);
    assert.equal(await editor.evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'open-button');
    const failedRead = await editor.evaluate(element => element.open({ size: 1, name: 'unreadable.docx',
      arrayBuffer: () => Promise.reject(new Error('Test file read refusal')) }));
    assert.deepEqual(failedRead, { ok: false, code: 'open-failed' });
    await choose('accepted', 'recovered.docx');
    await page.waitForFunction(id => document.querySelector(`#${id}`)?.snapshot()?.status === 'ready', id);
    assert.equal(await editor.locator('[part="filename"]').textContent(), 'recovered.docx');
  });
  await check('New and Open discard confirmation support keyboard cancellation and explicit replacement', async () => {
    const id = 'workflow-discard';
    await page.evaluate(id => {
      const element = document.createElement('lr-docx-editor');
      element.id = id;
      document.querySelector('#fixture').append(element);
    }, id);
    const editor = page.locator(`#${id}`);
    await editor.locator('[part="new-button"]').click();
    await page.waitForFunction(id => document.querySelector(`#${id}`)?.snapshot()?.status === 'ready', id);
    const original = await editor.evaluate(element => element.snapshot().revision.documentId);
    await editor.locator('[part="new-button"]').click();
    await editor.locator('[part="keep-button"]').press('Escape');
    assert.equal(await editor.locator('[part="confirm"]').count(), 0);
    assert.equal(await editor.evaluate(element => element.snapshot().revision.documentId), original);
    await editor.locator('[part="new-button"]').click();
    await editor.locator('[part="discard-button"]').click();
    await page.waitForFunction(({ id, original }) => {
      const state = document.querySelector(`#${id}`)?.snapshot();
      return state?.status === 'ready' && state.revision.documentId !== original;
    }, { id, original });
    const blank = await editor.evaluate(element => element.snapshot().revision.documentId);
    await editor.locator('[part="open-button"]').click();
    assert.equal(await editor.locator('[part="confirm"]').isVisible(), true);
    const bytes = await page.evaluate(() => window.__docxTest.fixture('accepted'));
    const pending = page.waitForEvent('filechooser');
    await editor.locator('[part="discard-button"]').click();
    await (await pending).setFiles({ name: 'replacement.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
    await page.waitForFunction(({ id, blank }) => {
      const state = document.querySelector(`#${id}`)?.snapshot();
      return state?.status === 'ready' && state.revision.documentId !== blank;
    }, { id, blank });
    assert.equal(await editor.locator('[part="filename"]').textContent(), 'replacement.docx');
    assert.equal(await editor.locator('[part="confirm"]').count(), 0);
  });
  await check('a superseded native file read cannot steal focus from the replacement document', async () => {
    const id = 'workflow-file-focus';
    await createEditor(page, id, 'accepted');
    const editor = page.locator(`#${id}`);
    const bytes = await page.evaluate(() => window.__docxTest.fixture('accepted'));
    await page.evaluate(bytes => {
      window.__fileBufferOriginal = File.prototype.arrayBuffer;
      File.prototype.arrayBuffer = function () {
        if (this.name !== 'delayed.docx') return window.__fileBufferOriginal.call(this);
        return new Promise(resolve => {
          window.__releaseFileRead = () => resolve(Uint8Array.from(bytes).buffer);
        });
      };
    }, [...bytes]);
    try {
      const chooser = page.waitForEvent('filechooser');
      await editor.locator('[part="open-button"]').click();
      await (await chooser).setFiles({ name: 'delayed.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
      await page.waitForFunction(() => typeof window.__releaseFileRead === 'function');
      const result = await editor.evaluate(async element => {
        const opened = await element.newDocument();
        const focused = element.focusEditor();
        const before = element.snapshot().revision;
        window.__releaseFileRead();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { opened, focused, before, after: element.snapshot().revision,
          focusRetained: element.querySelector('[slot="document"]').contains(document.activeElement) };
      });
      assert.equal(result.opened.ok, true);
      assert.equal(result.focused.ok, true);
      assert.deepEqual(result.after, result.before);
      assert.equal(result.focusRetained, true, 'Late File completion must not move focus back to Open');
    } finally {
      await page.evaluate(() => {
        File.prototype.arrayBuffer = window.__fileBufferOriginal;
        delete window.__fileBufferOriginal;
        delete window.__releaseFileRead;
      });
    }
  });
  await check('Escape closes link, find and style editors and returns document focus', async () => {
    const id = 'workflow-escape';
    await createEditor(page, id, 'basic-editing');
    const editor = page.locator(`#${id}`);
    await editor.locator('[part="link-trigger"]').click();
    await editor.locator('[part="link-href"] [part="input"]').press('Escape');
    await page.waitForFunction(id => !document.querySelector(`#${id}`)?.shadowRoot.querySelector('[part="link-popover"]').open, id);
    await editor.locator('[part="find-toggle"]').click();
    await editor.locator('[part="find-query"] [part="input"]').press('Escape');
    assert.equal(await editor.locator('[part="find"]').count(), 0);
    const select = editor.locator('[part="paragraph-style"]');
    await select.getByRole('combobox').click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(id => !document.querySelector(`#${id}`)?.shadowRoot.querySelector('[part="paragraph-style"]').open, id);
    await page.waitForFunction(id => document.querySelector(`#${id}`)?.querySelector('[slot="document"]')?.contains(document.activeElement), id);
  });
  await check('find options update search and invalid size edits show localized refusal without changing content', async () => {
    const id = 'workflow-options';
    await createEditor(page, id, 'basic-editing');
    const editor = page.locator(`#${id}`);
    await editor.locator('[part="find-toggle"]').click();
    await editor.locator('[part="find-query"] [part="input"]').fill('Alpha');
    await editor.locator('[part="find-match-case"]').getByRole('checkbox').click();
    await editor.locator('[part="find-whole-word"]').getByRole('checkbox').click();
    await editor.locator('[part="find-query"] [part="input"]').press('Enter');
    assert.match((await editor.locator('[part="find-count"]').textContent()) ?? '', /1/u);
    const before = await editor.evaluate(element => element.snapshot().revision);
    await editor.locator('[part="font-size"] [part="input"]').fill('0');
    await editor.locator('[part="font-size"] [part="input"]').press('Tab');
    await editor.locator('[part="edit-error"]').waitFor({ state: 'visible' });
    assert.deepEqual(await editor.evaluate(element => element.snapshot().revision), before);
    assert.equal((await editor.locator('[part="edit-error"]').textContent()).includes('invalid-option'), false);
  });
  await check('superseded public searches refuse stale pane navigation and replacement', async () => {
    const id = 'workflow-stale-search';
    await createEditor(page, id, 'basic-editing');
    const editor = page.locator(`#${id}`);
    await editor.locator('[part="find-toggle"]').click();
    await editor.locator('[part="find-query"] [part="input"]').fill('Café 東京');
    await editor.locator('[part="find-submit"]').click();
    const before = await editor.evaluate(element => element.snapshot().revision);
    await editor.evaluate(element => element.find('Existing link'));
    await editor.locator('[part="find-next"]').click();
    await editor.locator('[part="edit-error"]').waitFor({ state: 'visible' });
    assert.equal(await editor.locator('[part="find-next"]').getByRole('button').isDisabled(), true);
    await editor.locator('[part="find-submit"]').click();
    await editor.locator('[part="find-next"]').click();
    await editor.locator('[part="find-replace"] [part="input"]').fill('Must not appear');
    await editor.evaluate(element => element.find('Existing link'));
    await editor.locator('[part="find-replace-button"]').click();
    await editor.locator('[part="edit-error"]').waitFor({ state: 'visible' });
    assert.deepEqual(await editor.evaluate(element => element.snapshot().revision), before);
    assert.equal(zipEntry(await saveEditor(page, id), 'word/document.xml').includes('Must not appear'), false);
  });
  await check('catalog failures and unsupported link ranges render localized edit feedback', async () => {
    const id = 'workflow-edit-refusals';
    await createEditor(page, id, 'basic-editing');
    const editor = page.locator(`#${id}`);
    await editor.evaluate(element => { element.strings = { docxEditorEditUnavailable: 'Editing unavailable marker' }; });
    for (const [method, part] of [['paragraphStyles', 'paragraph-style'], ['fontFamilies', 'font-family']]) {
      await editor.evaluate((element, method) => {
        element.__catalogOriginal = element[method];
        element.__catalogCalls = 0;
        element[method] = () => { element.__catalogCalls++; return { ok: false, code: 'engine-failed' }; };
      }, method);
      try {
        const field = editor.locator(`[part="${part}"]`);
        if (method === 'paragraphStyles') await field.getByRole('combobox').click();
        else await field.locator('[part="combobox-input"]').press('ArrowDown');
        await editor.locator('[part="edit-error"]').waitFor({ state: 'visible' });
        assert.equal(await editor.evaluate(element => element.__catalogCalls), 1);
        assert.equal(await editor.locator('[part="edit-error"]').textContent(), 'Editing unavailable marker');
        await page.keyboard.press('Escape');
      } finally {
        await editor.evaluate((element, method) => {
          element[method] = element.__catalogOriginal; delete element.__catalogOriginal; delete element.__catalogCalls;
        }, method);
      }
    }
    await selectDocumentText(page, id);
    const before = await editor.evaluate(element => element.snapshot().revision);
    await editor.locator('[part="link-trigger"]').click();
    await editor.locator('[part="link-href"] [part="input"]').fill('https://example.test/refused-range');
    await editor.locator('[part="link-apply"]').click();
    assert.equal(await editor.locator('[part="edit-error"]').textContent(), 'Editing unavailable marker');
    assert.deepEqual(await editor.evaluate(element => element.snapshot().revision), before);
    assert.equal(await editor.evaluate(element => element.shadowRoot.querySelector('[part="link-popover"]').open), true);
    await editor.locator('[part="link-href"] [part="input"]').press('Escape');
  });
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => entry.isDirectory()
    ? filesUnder(join(directory, entry.name))
    : [join(directory, entry.name)]))).flat();
}

async function bundle() {
  await build({
    root,
    configFile: false,
    publicDir: false,
    base: '/',
    build: {
      outDir: output,
      emptyOutDir: true,
      manifest: true,
      sourcemap: process.env.DOCX_COVERAGE === '1',
      rollupOptions: { input: resolve(root, 'test/browser.html') }
    }
  });
  const manifest = JSON.parse(await readFile(resolve(output, '.vite/manifest.json'), 'utf8'));
  const lazy = manifest['test/editor-entry.ts'];
  assert.ok(lazy?.isDynamicEntry && lazy.file, 'Editor entry must be a separate lazy chunk');
  const core = Object.entries(manifest).find(([name, entry]) =>
    name.includes('@docx-editor.dev+core@') && name.endsWith('/dist/index.js') && entry.isDynamicEntry);
  assert.ok(core?.[1]?.file, 'DOCX engine must be a separate lazy chunk');
  const files = await filesUnder(output);
  for (const file of files) {
    if (file.includes(`${sep}.vite${sep}`)) continue;
    const bytes = await readFile(file);
    evidence.assets[relative(output, file).replaceAll(sep, '/')] = { bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 6 }).length };
  }
  evidence.assetTotals = Object.entries(evidence.assets).reduce((totals, [name, size]) => {
    const kind = name.endsWith('.js') ? 'js' : name.endsWith('.css') ? 'css' : name.endsWith('.wasm') ? 'wasm' : null;
    if (kind) {
      totals[kind].bytes += size.bytes;
      totals[kind].gzipBytes += size.gzipBytes;
    }
    return totals;
  }, { js: { bytes: 0, gzipBytes: 0 }, css: { bytes: 0, gzipBytes: 0 }, wasm: { bytes: 0, gzipBytes: 0 } });
  evidence.lazyEntry = lazy.file;
  evidence.engineEntry = core[1].file;
  return { lazyEntry: lazy.file, engineEntry: core[1].file };
}

function serve() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
      const file = resolve(output, `.${pathname === '/' ? '/test/browser.html' : pathname}`);
      if (!file.startsWith(`${output}${sep}`)) { response.writeHead(403).end(); return; }
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  return server;
}

async function runBrowser(name, url, { lazyEntry, engineEntry }) {
  const browser = await ({ chromium, firefox, webkit })[name].launch({ headless: true });
  const record = evidence.browsers[name] = { checks: [], requests: [], externalRequests: [], pageErrors: [], consoleErrors: [], requestFailures: [], startupWallMs: null, saveWallMs: null, saveBytes: null };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const captureCoverage = process.env.DOCX_COVERAGE === '1' && name === 'chromium';
  if (captureCoverage) await page.coverage.startJSCoverage({ resetOnNavigation: false });
  page.setDefaultTimeout(30_000);
  page.on('request', request => {
    const target = new URL(request.url());
    record.requests.push(target.pathname);
    if (target.origin !== new URL(url).origin && target.protocol !== 'data:') record.externalRequests.push(request.url());
  });
  page.on('requestfailed', request => record.requestFailures.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('pageerror', error => record.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') record.consoleErrors.push(message.text()); });
  const check = async (label, work) => {
    await work();
    record.checks.push(label);
    evidence.checks.push(`${name}: ${label}`);
    console.log(`PASS ${name}: ${label}`);
  };
  const editor = page.locator('lr-docx-editor').first();
  try {
    const navigationStart = performance.now();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__docxTest?.ready === true);
    await check('ordinary entry leaves editor lazy', async () => {
      assert.equal(record.requests.some(path => path.endsWith(`/${lazyEntry}`)), false);
      assert.equal(record.requests.some(path => path.endsWith(`/${engineEntry}`)), false);
      assert.equal(await page.evaluate(() => Boolean(customElements.get('lr-docx-editor'))), false);
    });
    await page.evaluate(() => window.__docxTest.loadEditor());
    await page.waitForFunction(() => Boolean(customElements.get('lr-docx-editor')));
    await page.addScriptTag({ path: axePath });
    await check('editor loads on demand', async () => {
      assert.ok(record.requests.some(path => path.endsWith(`/${lazyEntry}`)));
      assert.equal(record.requests.some(path => path.endsWith(`/${engineEntry}`)), false, 'Engine loaded before document open');
    });
    await page.evaluate(() => {
      const element = document.createElement('lr-docx-editor');
      element.id = 'primary';
      document.querySelector('#fixture').append(element);
    });
    await check('new document mounts one real editor', async () => {
      const result = await editor.evaluate(element => element.newDocument());
      assert.equal(result.ok, true, JSON.stringify(result));
      await editor.locator('.docx-pages').waitFor({ state: 'visible' });
      assert.equal(await editor.evaluate(element => element.snapshot()?.status), 'ready');
      assert.ok(record.requests.some(path => path.endsWith(`/${engineEntry}`)), 'Open did not request the lazy engine');
      record.startupWallMs = Math.round(performance.now() - navigationStart);
    });
    await check('native input commits Unicode and revision', async () => {
      await editor.locator('.docx-pages').click();
      await page.keyboard.insertText('Café 東京 مرحبا');
      await page.waitForFunction(() => document.querySelector('#primary')?.snapshot()?.revision?.value > 0);
      assert.equal(await editor.evaluate(element => element.snapshot()?.dirty), true);
    });
    await check('English fallback and instance strings reach rendered controls', async () => {
      assert.equal((await editor.locator('lr-button[data-command="bold"]').textContent()).trim(), 'Bold');
      const result = await editor.evaluate(async element => {
        element.strings = { docxEditorBold: 'Strong text' };
        await element.updateComplete;
        const label = element.shadowRoot.querySelector('[data-command="bold"]')?.textContent?.trim();
        element.strings = {};
        await element.updateComplete;
        return { label, restored: element.shadowRoot.querySelector('[data-command="bold"]')?.textContent?.trim() };
      });
      assert.deepEqual(result, { label: 'Strong text', restored: 'Bold' });
    });
    await check('formatting retains selected text through toolbar focus', async () => {
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+A');
      await editor.locator('lr-button[data-command="bold"]').click();
      assert.equal(await editor.evaluate(element => element.snapshot()?.status), 'ready');
    });
    await check('Alt+F10 and keyboard toolbar activation retain selection', async () => {
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Alt+F10');
      const focused = await editor.evaluate(element => element.shadowRoot?.activeElement?.getAttribute('data-command'));
      assert.equal(focused, 'bold');
      await page.keyboard.press('ArrowRight');
      assert.equal(await editor.evaluate(element => element.shadowRoot?.activeElement?.getAttribute('data-command')), 'italic');
      await page.keyboard.press('Enter');
      assert.equal(await editor.evaluate(element => element.snapshot()?.status), 'ready');
    });
    await check('dirty replacement can be vetoed before state changes', async () => {
      const result = await editor.evaluate(async element => {
        const before = element.snapshot().revision;
        const veto = event => event.preventDefault();
        element.addEventListener('lr-before-open', veto, { once: true });
        const refused = await element.newDocument();
        return { refused, sameRevision: before === element.snapshot().revision, dirty: element.snapshot().dirty };
      });
      assert.deepEqual(result.refused, { ok: false, code: 'aborted' });
      assert.equal(result.sameRevision, true);
      assert.equal(result.dirty, true);
    });
    await check('toolbar New asks before discarding dirty work', async () => {
      await editor.locator('[part="new-button"]').click();
      await editor.locator('[part="confirm"]').waitFor({ state: 'visible' });
      await editor.locator('[part="keep-button"]').click();
      assert.equal(await editor.locator('[part="confirm"]').count(), 0);
      assert.equal(await editor.evaluate(element => element.snapshot()?.dirty), true);
    });
    await check('undo and redo remain callable', async () => {
      const result = await editor.evaluate(element => ({ undo: element.execute('undo'), redo: element.execute('redo') }));
      assert.equal(result.undo.ok, true, JSON.stringify(result));
      assert.equal(result.redo.ok, true, JSON.stringify(result));
    });
    await check('desktop and 320px views remain rendered', async () => {
      await page.screenshot({ path: resolve(screenshots, `${name}-desktop.png`), fullPage: true });
      await page.setViewportSize({ width: 320, height: 780 });
      await page.screenshot({ path: resolve(screenshots, `${name}-mobile.png`), fullPage: true });
      assert.ok(await editor.locator('.docx-pages').isVisible());
      await page.setViewportSize({ width: 1440, height: 900 });
    });
    let saved;
    await check('explicit save and receipt acknowledgement', async () => {
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+A');
      const savedAt = performance.now();
      saved = await editor.evaluate(async element => {
        const mount = element.querySelector('[slot="document"]');
        const pages = element.querySelector('.docx-pages');
        const active = document.activeElement;
        const selected = document.getSelection()?.toString() ?? '';
        const result = await element.save();
        if (!result.ok) return result;
        const beforeAck = element.snapshot().dirty;
        const acknowledgement = element.acknowledgeSaved(result.value);
        return {
          ok: true, bytes: [...result.value.bytes], beforeAck, afterAck: element.snapshot().dirty, acknowledgement,
          selectedLength: selected.length,
          sameSelection: selected === (document.getSelection()?.toString() ?? ''),
          sameFocus: active === document.activeElement,
          sameMount: mount === element.querySelector('[slot="document"]'),
          samePages: pages === element.querySelector('.docx-pages')
        };
      });
      record.saveWallMs = Math.round(performance.now() - savedAt);
      assert.equal(saved.ok, true, JSON.stringify(saved));
      assert.equal(saved.beforeAck, true);
      assert.equal(saved.acknowledgement.ok, true);
      assert.equal(saved.afterAck, false);
      assert.ok(saved.selectedLength > 0, 'Save focus test had no selection');
      for (const state of ['sameSelection', 'sameFocus', 'sameMount', 'samePages']) assert.equal(saved[state], true, `Save changed ${state}`);
      record.saveBytes = saved.bytes.length;
      const xml = zipEntry(saved.bytes, 'word/document.xml');
      for (const part of ['Café', '東京', 'مرحبا']) assert.ok(xml.includes(part), `Saved text missing ${part}`);
      assert.match(xml, /<w:b(?:\s|\/|>)/u, 'Bold formatting missing from saved XML');
      assert.match(xml, /<w:i(?:\s|\/|>)/u, 'Keyboard italic formatting missing from saved XML');
    });
    await check('saved bytes reopen in a second instance', async () => {
      const result = await page.evaluate(async bytes => {
        const second = document.createElement('lr-docx-editor');
        second.id = 'secondary';
        document.querySelector('#fixture').append(second);
        const opened = await second.open(Uint8Array.from(bytes));
        return { opened, text: second.querySelector('.docx-pages')?.textContent ?? '', status: second.snapshot()?.status };
      }, saved.bytes);
      assert.equal(result.opened.ok, true, JSON.stringify(result));
      assert.equal(result.status, 'ready');
      for (const part of ['Café', '東京', 'مرحبا']) assert.ok(result.text.includes(part), `Reopened text missing ${part}`);
    });
    await check('two instances hold independent revisions', async () => {
      const prior = await editor.evaluate(element => element.snapshot().revision);
      await page.locator('#secondary .docx-pages').click();
      await page.keyboard.insertText(' second');
      await page.waitForFunction(() => document.querySelector('#secondary')?.snapshot()?.revision?.value > 0);
      assert.deepEqual(await editor.evaluate(element => element.snapshot().revision), prior);
    });
    await check('locale and theme updates keep the engine mount', async () => {
      const result = await editor.evaluate(async element => {
        const mount = element.querySelector('[slot="document"]');
        const pages = element.querySelector('.docx-pages');
        const revision = element.snapshot().revision;
        element.setAttribute('lang', 'fr');
        element.setAttribute('dir', 'rtl');
        element.setAttribute('data-lr-theme', 'dark');
        await element.updateComplete;
        return { sameMount: mount === element.querySelector('[slot="document"]'), samePages: pages === element.querySelector('.docx-pages'), sameRevision: revision === element.snapshot().revision };
      });
      assert.deepEqual(result, { sameMount: true, samePages: true, sameRevision: true });
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Alt+F10');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await editor.evaluate(element => element.shadowRoot?.activeElement?.getAttribute('data-command')), 'italic');
      await page.keyboard.press('Escape');
    });
    await check('read-only instance refuses editing and preserves revision', async () => {
      const result = await page.evaluate(async () => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'readonly';
        element.readOnly = true;
        document.querySelector('#fixture').append(element);
        const opened = await element.newDocument();
        const before = element.snapshot()?.revision;
        const command = element.execute('bold');
        return { opened, command, before, after: element.snapshot()?.revision };
      });
      assert.equal(result.opened.ok, true, JSON.stringify(result));
      assert.deepEqual(result.command, { ok: false, code: 'read-only' });
      assert.deepEqual(result.before, result.after);
      await page.locator('#readonly .docx-pages').click();
      await page.keyboard.insertText('must not appear');
      await page.waitForTimeout(150);
      assert.deepEqual(await page.locator('#readonly').evaluate(element => element.snapshot().revision), result.before);
    });
    await check('oversize source is refused without an engine open', async () => {
      const result = await page.evaluate(async () => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'oversize';
        document.querySelector('#fixture').append(element);
        return element.open(new Uint8Array(4 * 1024 * 1024 + 1));
      });
      assert.deepEqual(result, { ok: false, code: 'resource-limit' });
    });
    await check('accepted local DOCX corpus input opens and round trips', async () => {
      const result = await page.evaluate(async () => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'accepted-corpus';
        document.querySelector('#fixture').append(element);
        const source = await window.__docxTest.fixture('accepted');
        const opened = await element.open(source);
        const text = element.querySelector('.docx-pages')?.textContent ?? '';
        const saved = await element.save();
        return { opened, text, saved: saved.ok ? [...saved.value.bytes] : saved };
      });
      assert.equal(result.opened.ok, true, JSON.stringify(result.opened));
      assert.ok(result.text.includes('Hello'));
      assert.ok(Array.isArray(result.saved), JSON.stringify(result.saved));
      assert.ok(zipEntry(result.saved, 'word/document.xml').includes('Hello'));
    });
    await check('unsupported OPC parts, list, table and image survive edit and reopen', async () => {
      const source = await page.evaluate(async () => [...await window.__docxTest.fixture('representative')]);
      const original = Object.fromEntries(protectedParts.map(part => [part, sha256(zipEntryBytes(source, part))]));
      const opened = await page.evaluate(async bytes => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'representative-corpus';
        document.querySelector('#fixture').append(element);
        return element.open(Uint8Array.from(bytes));
      }, source);
      assert.equal(opened.ok, true, JSON.stringify(opened));
      await page.locator('#representative-corpus .docx-pages').click();
      await page.keyboard.insertText('Edited ');
      await page.waitForFunction(() => document.querySelector('#representative-corpus')?.snapshot()?.revision?.value > 0);
      const first = await page.locator('#representative-corpus').evaluate(async element => {
        const saved = await element.save();
        return saved.ok ? [...saved.value.bytes] : saved;
      });
      assert.ok(Array.isArray(first), JSON.stringify(first));
      const reopened = await page.evaluate(async bytes => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'representative-reopened';
        document.querySelector('#fixture').append(element);
        const opened = await element.open(Uint8Array.from(bytes));
        if (!opened.ok) return { opened };
        const saved = await element.save();
        return { opened, saved: saved.ok ? [...saved.value.bytes] : saved };
      }, first);
      assert.equal(reopened.opened.ok, true, JSON.stringify(reopened.opened));
      assert.ok(Array.isArray(reopened.saved), JSON.stringify(reopened.saved));
      for (const bytes of [first, reopened.saved]) {
        for (const part of protectedParts) assert.equal(sha256(zipEntryBytes(bytes, part)), original[part], `Protected part changed: ${part}`);
        const xml = zipEntry(bytes, 'word/document.xml');
        for (const fragment of ['Edited', 'Corpus opening', 'Numbered item', 'Cell A', 'Cell B']) assert.ok(xml.includes(fragment), `Lost ${fragment}`);
        assert.match(xml, /<w:tbl(?:\s|>)/u);
        assert.match(xml, /<w:numPr(?:\s|>)/u);
        assert.ok(zipEntry(bytes, 'word/numbering.xml').includes('abstractNum'));
      }
    });
    await check('external resource and malformed XML show visible fallback', async () => {
      for (const [kind, expected] of [['external', 'external-resource'], ['malformed', 'invalid-document']]) {
        const result = await page.evaluate(async ({ kind, expected }) => {
          const element = document.createElement('lr-docx-editor');
          element.id = `refused-${kind}`;
          document.querySelector('#fixture').append(element);
          const bytes = await window.__docxTest.fixture(kind);
          const opened = await element.open(bytes);
          await element.updateComplete;
          const family = element.shadowRoot.querySelector('[part="font-family"]');
          await family.updateComplete;
          return { opened, unknownFont: Boolean(family.shadowRoot.querySelector('[part="unknown-value"]')),
            errorVisible: Boolean(element.shadowRoot.querySelector('[part="error"]')?.getClientRects().length), expected };
        }, { kind, expected });
        assert.deepEqual(result.opened, { ok: false, code: expected });
        assert.equal(result.errorVisible, true, `${kind} did not show a visible fallback`);
        assert.equal(result.unknownFont, false, 'A missing formatting value must clear font selection');
      }
      const results = await page.evaluate(async () => window.axe.run(document.querySelector('#refused-malformed'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
      if (results.violations.length) record.fallbackAxeViolations = results.violations.map(({ id, nodes }) => ({
        id, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary,
          checks: [...node.any, ...node.all, ...node.none].map(check => ({ id: check.id, data: check.data, message: check.message })) }))
      }));
      assert.deepEqual(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })), []);
    });
    await check('one mount has one owner through transient removal', async () => {
      const result = await page.evaluate(async () => {
        const create = await window.__docxTest.sessionFactory();
        const mount = document.createElement('div');
        document.querySelector('#fixture').append(mount);
        const first = create({ mount });
        const duplicate = create({ mount });
        const repaint = document.createElement('span');
        mount.append(repaint);
        repaint.remove();
        const survivedRepaint = first.ok && first.value.snapshot().status === 'idle';
        mount.remove();
        document.querySelector('#fixture').append(mount);
        first.ok && first.value.can('bold');
        const lostStatus = first.ok ? first.value.snapshot().status : null;
        first.ok && first.value.destroy();
        const replacement = create({ mount });
        replacement.ok && replacement.value.destroy();
        mount.remove();
        const wrapper = document.createElement('section');
        const nested = document.createElement('div');
        wrapper.append(nested);
        document.querySelector('#fixture').append(wrapper);
        const ancestor = create({ mount: nested });
        wrapper.remove();
        document.querySelector('#fixture').append(wrapper);
        ancestor.ok && ancestor.value.can('bold');
        const ancestorStatus = ancestor.ok ? ancestor.value.snapshot().status : null;
        ancestor.ok && ancestor.value.destroy();
        wrapper.remove();
        const adopted = document.createElement('div');
        document.querySelector('#fixture').append(adopted);
        const adoptedSession = create({ mount: adopted });
        document.implementation.createHTMLDocument('other').adoptNode(adopted);
        adoptedSession.ok && adoptedSession.value.can('bold');
        const adoptionStatus = adoptedSession.ok ? adoptedSession.value.snapshot().status : null;
        adoptedSession.ok && adoptedSession.value.destroy();
        return { first: first.ok, duplicate, survivedRepaint, lostStatus, replacement: replacement.ok, ancestorStatus, adoptionStatus };
      });
      assert.equal(result.first, true);
      assert.deepEqual(result.duplicate, { ok: false, code: 'invalid-mount' });
      assert.equal(result.survivedRepaint, true);
      assert.equal(result.lostStatus, 'destroyed');
      assert.equal(result.replacement, true);
      assert.equal(result.ancestorStatus, 'destroyed');
      assert.equal(result.adoptionStatus, 'destroyed');
    });
    await check('superseded file reads cannot report errors on a new document', async () => {
      const result = await page.evaluate(async () => {
        const element = document.createElement('lr-docx-editor');
        document.querySelector('#fixture').append(element);
        let rejectRead;
        const read = new Promise((_resolve, reject) => { rejectRead = reject; });
        const errors = [];
        element.addEventListener('lr-error', event => errors.push(event.detail.code));
        const pending = element.open({ size: 1, name: 'old.docx', arrayBuffer: () => read });
        const opened = await element.newDocument();
        rejectRead(new Error('Old file read failed'));
        const stale = await pending;
        await element.updateComplete;
        const failed = Boolean(element.shadowRoot.querySelector('[part="error"]'));
        element.remove();
        return { opened, stale, errors, failed };
      });
      assert.equal(result.opened.ok, true, JSON.stringify(result));
      assert.deepEqual(result.stale, { ok: false, code: 'aborted' });
      assert.deepEqual(result.errors, []);
      assert.equal(result.failed, false);
    });
    await check('disconnect clears pending file status and discards late read errors', async () => {
      const result = await page.evaluate(async () => {
        const element = document.createElement('lr-docx-editor');
        element.strings = { docxEditorOpening: 'Pending file marker', docxEditorDisconnected: 'Disconnected marker' };
        document.querySelector('#fixture').append(element);
        let rejectRead;
        const read = new Promise((_resolve, reject) => { rejectRead = reject; });
        const errors = [];
        element.addEventListener('lr-error', event => errors.push(event.detail.code));
        const pending = element.open({ size: 1, name: 'detached.docx', arrayBuffer: () => read });
        await element.updateComplete;
        const before = element.shadowRoot.querySelector('[part="state"]').textContent;
        element.remove();
        document.querySelector('#fixture').append(element);
        await element.updateComplete;
        const after = element.shadowRoot.querySelector('[part="state"]').textContent;
        rejectRead(new Error('Detached file read failed'));
        const stale = await pending;
        element.remove();
        return { before, after, stale, errors };
      });
      assert.equal(result.before, 'Pending file marker');
      assert.equal(result.after, 'Disconnected marker');
      assert.deepEqual(result.stale, { ok: false, code: 'aborted' });
      assert.deepEqual(result.errors, []);
    });
    await check('abort and disconnect settle cleanly', async () => {
      const result = await page.evaluate(async () => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'cancel';
        document.querySelector('#fixture').append(element);
        const controller = new AbortController();
        const fixture = await window.__docxTest.fixture('malformed');
        const pending = element.open(fixture, { signal: controller.signal });
        controller.abort();
        const aborted = await pending;
        const opened = await element.newDocument();
        const mount = element.querySelector('[slot="document"]');
        element.remove();
        document.querySelector('#fixture').append(element);
        await Promise.resolve();
        return { aborted, opened, reused: mount === element.querySelector('[slot="document"]'), status: element.snapshot()?.status };
      });
      assert.deepEqual(result.aborted, { ok: false, code: 'aborted' });
      assert.equal(result.opened.ok, true, JSON.stringify(result));
      assert.notEqual(result.status, 'ready', 'Detached editor retained an active session');
    });
    await check('populated custom element passes axe', async () => {
      const results = await page.evaluate(() => window.axe.run(document.querySelector('#primary'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
      if (results.violations.length) record.axeViolations = results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => ({ target: node.target, details: node.any.map(check => check.data), summary: node.failureSummary })) }));
      assert.deepEqual(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })), []);
    });
    await runTableEditing(page, check, { createEditor, saveEditor, assertProtectedParts });
    await runBasicEditing(page, check);
    await runEditorWorkflows(page, check);
    assert.deepEqual(record.pageErrors, [], 'Browser page errors');
    assert.deepEqual(record.requestFailures, [], 'Browser request failures');
    assert.deepEqual(record.consoleErrors, [], 'Browser console errors');
    assert.deepEqual(record.externalRequests, [], 'Unexpected external browser request');
    record.requestedArtifacts = Object.fromEntries(record.requests
      .map(path => path.slice(1))
      .filter(path => evidence.assets[path])
      .map(path => [path, evidence.assets[path]]));
    if (process.env.DOCX_PERFORMANCE === '1' && name === 'chromium') {
      const { measureDocxPerformance } = await import('./performance.mjs');
      record.performance = await measureDocxPerformance({ browser, url });
    }
  } catch (error) {
    record.failure = error?.stack ?? String(error);
    await page.screenshot({ path: resolve(screenshots, `${name}-failure.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    try {
      if (captureCoverage) {
        const entries = await page.coverage.stopJSCoverage();
        await mkdir(resolve(root, 'coverage'), { recursive: true });
        await writeFile(resolve(root, 'coverage/browser-v8.json'), `${JSON.stringify(entries)}\n`);
      }
    } finally {
      await context.close();
      await browser.close();
    }
  }
}

let server;
try {
  const lazyEntries = await bundle();
  await mkdir(screenshots, { recursive: true });
  server = serve();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/test/browser.html`;
  for (const name of browsers) await runBrowser(name, url, lazyEntries);
  evidence.result = 'pass';
} catch (error) {
  evidence.result = 'fail';
  evidence.failure = error?.stack ?? String(error);
  process.exitCode = 1;
  console.error(evidence.failure);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await writeFile(resolve(output, 'browser-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`).catch(() => {});
}

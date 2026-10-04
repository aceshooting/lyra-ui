import assert from 'node:assert/strict';
import { zipEntry } from '../test/zip.mjs';

/** Toolbar formatting, color and paragraph tools against the real engine. */
export async function runFormattingTools(page, check, { saveEditor }) {
  const id = 'formatting';
  const host = page.locator(`#${id}`);
  const part = name => host.locator(`[part="${name}"]`);
  const documentXml = async () => zipEntry(await saveEditor(page, id), 'word/document.xml');
  const revision = () => host.evaluate(element => element.snapshot().revision.value);
  const settled = async before => page.waitForFunction(({ id, before }) => document.getElementById(id).snapshot()?.revision?.value > before, { id, before });
  const selectLine = async () => {
    await host.locator('.docx-pages').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Home');
    await page.waitForFunction(id => document.getElementById(id).snapshot()?.selection?.kind === 'text', id);
  };
  const fresh = async text => {
    await page.evaluate(id => {
      document.getElementById(id)?.remove();
      const element = document.createElement('lr-docx-editor');
      element.id = id;
      document.querySelector('#fixture').append(element);
      return element.newDocument();
    }, id);
    await page.waitForFunction(id => document.getElementById(id)?.snapshot()?.status === 'ready', id);
    await host.locator('.docx-pages').click();
    await page.keyboard.insertText(text);
    await page.waitForFunction(id => document.getElementById(id).snapshot()?.revision?.value > 0, id);
    await selectLine();
  };

  await check('strikethrough, superscript and clear formatting edit the selection from the toolbar', async () => {
    await fresh('Alpha beta gamma');
    let before = await revision();
    await host.locator('[data-command="strikethrough"]').click();
    await settled(before);
    assert.match(await documentXml(), /<w:strike\/>|<w:strike w:val="(?:1|true)"\/>/u);
    await selectLine(); before = await revision();
    await host.locator('[data-command="superscript"]').click();
    await settled(before);
    assert.match(await documentXml(), /<w:vertAlign w:val="superscript"\/>/u);
    await selectLine(); before = await revision();
    await host.locator('#tool-clear-formatting').click();
    await settled(before);
    const xml = await documentXml();
    assert.doesNotMatch(xml, /<w:strike|<w:vertAlign/u);
  });

  await check('a text color swatch applies once, closes the panel, returns focus and updates the trigger bar', async () => {
    await fresh('Colored words');
    const before = await revision();
    await part('text-color').click();
    await part('text-color-popover').locator('[part~="popup"]').waitFor({ state: 'visible' }).catch(() => {});
    await part('text-color-swatches').getByRole('radio', { name: 'Blue', exact: true }).click();
    await settled(before);
    assert.match(await documentXml(), /<w:color w:val="0070C0"\/>/u);
    await page.waitForFunction(id => !document.getElementById(id).shadowRoot.querySelector('[part="text-color-popover"]').open, id);
    assert.equal(await host.evaluate(element => element.shadowRoot.querySelector('#tool-text-color .tool-glyph').style.getPropertyValue('--_tool-swatch')), '#0070C0');
    await page.waitForFunction(id => {
      const element = document.getElementById(id);
      return element.contains(document.activeElement) && document.activeElement !== element && !element.shadowRoot.activeElement;
    }, id);
  });

  await check('Automatic color writes auto over an explicit color and closes the panel', async () => {
    await selectLine();
    const before = await revision();
    await part('text-color').click();
    await part('color-auto').click();
    await settled(before);
    assert.match(await documentXml(), /<w:color w:val="auto"\/>/u);
    await page.waitForFunction(id => !document.getElementById(id).shadowRoot.querySelector('[part="text-color-popover"]').open, id);
  });

  await check('a custom color applies on commit and keeps the panel open; Escape closes without another edit', async () => {
    await fresh('Custom words');
    await part('text-color').click();
    const before = await revision();
    await part('text-color-custom').evaluate(picker => {
      picker.value = '#123456';
      picker.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail: { value: '#123456' } }));
    });
    await settled(before);
    assert.match(await documentXml(), /<w:color w:val="123456"\/>/u);
    assert.equal(await part('text-color-popover').evaluate(popover => popover.open), true);
    const after = await revision();
    await page.keyboard.press('Escape');
    await page.waitForFunction(id => !document.getElementById(id).shadowRoot.querySelector('[part="text-color-popover"]').open, id);
    assert.equal(await revision(), after);
  });

  await check('highlight swatches write Word highlight names and No highlight removes them', async () => {
    await fresh('Highlighted words');
    let before = await revision();
    await part('highlight').click();
    await part('highlight-swatches').getByRole('radio', { name: 'Turquoise', exact: true }).click();
    await settled(before);
    assert.match(await documentXml(), /<w:highlight w:val="cyan"\/>/u);
    await selectLine(); before = await revision();
    await part('highlight').click();
    await part('highlight-none').click();
    await settled(before);
    assert.doesNotMatch(await documentXml(), /<w:highlight w:val="cyan"/u);
  });

  await check('line spacing, indent and page break edit paragraphs as single undoable steps', async () => {
    await fresh('Paragraph text');
    let before = await revision();
    await part('line-spacing').click();
    await part('line-spacing-option').and(host.locator('[data-value="1.5"]')).click();
    await settled(before);
    assert.match(await documentXml(), /<w:spacing [^>]*w:line="360"[^>]*w:lineRule="auto"|<w:spacing [^>]*w:lineRule="auto"[^>]*w:line="360"/u);
    before = await revision();
    await host.locator('#tool-indent-increase').click();
    await settled(before);
    assert.match(await documentXml(), /<w:ind [^>]*w:(?:left|start)="\d+"/u);
    before = await revision();
    await host.locator('#tool-indent-decrease').click();
    await settled(before);
    await host.locator('.docx-pages').click();
    await page.keyboard.press('End');
    before = await revision();
    await host.locator('#tool-page-break').click();
    await settled(before);
    assert.match(await documentXml(), /<w:br w:type="page"\/>/u);
    before = await revision();
    assert.equal((await host.evaluate(element => element.execute('undo'))).ok, true);
    await settled(before);
    assert.doesNotMatch(await documentXml(), /<w:br w:type="page"\/>/u);
  });


  await page.evaluate(id => document.getElementById(id)?.remove(), id);
}

import assert from 'node:assert/strict';

export async function runToolStyles(page, check, { createEditor }) {
  const id = 'tool-styles';
  await createEditor(page, id, 'basic-editing');
  const host = page.locator(`#${id}`);
  const colors = () => host.evaluate(element => {
    const root = element.shadowRoot;
    const border = button => getComputedStyle(button.shadowRoot.querySelector('[part~="base"]')).borderTopColor;
    return {
      tools: [...root.querySelectorAll('lr-button[id^="tool-"]')].map(button => ({ id: button.id, appearance: button.appearance, border: border(button) })),
      panels: [...root.querySelectorAll('[part="line-spacing-option"], [part="color-auto"], [part="highlight-none"], [part="link-cancel"]')]
        .map(button => ({ part: button.getAttribute('part'), border: border(button) }))
    };
  });

  await check('one host border hook styles all icon tools without changing panel action borders', async () => {
    const original = await colors();
    assert.ok(original.tools.length > 25, JSON.stringify(original));
    assert.ok(original.panels.length > 4, JSON.stringify(original));
    await host.evaluate(element => element.style.setProperty('--lr-docx-editor-tool-border', 'transparent'));
    const borderless = await colors();
    assert.deepEqual(borderless.tools.filter(tool => tool.appearance !== 'filled-outlined' && tool.border !== 'rgba(0, 0, 0, 0)'), [], 'Every quiet or filled icon tool uses the host hook');
    assert.deepEqual(borderless.panels, original.panels, 'Panel text actions keep their original chrome');
    await host.evaluate(element => element.style.setProperty('--lr-docx-editor-tool-border', 'rgb(17, 109, 191)'));
    assert.deepEqual((await colors()).tools.filter(tool => tool.appearance !== 'filled-outlined' && tool.border !== 'rgb(17, 109, 191)'), [], 'A visible custom border reaches every quiet or filled tool');
    await host.evaluate(element => element.style.removeProperty('--lr-docx-editor-tool-border'));
    assert.deepEqual(await colors(), original, 'Removing the hook restores the default theme');
    await host.evaluate(element => element.style.setProperty('--lr-button-quiet-border', 'rgb(129, 27, 63)'));
    assert.deepEqual((await colors()).tools.filter(tool => tool.appearance === 'quiet' && tool.border !== 'rgb(129, 27, 63)'), [], 'Unset hook preserves inherited button chrome');
    await host.evaluate(element => element.style.removeProperty('--lr-button-quiet-border'));
  });

  await check('an unset tool border hook preserves each button variant and appearance', async () => {
    const variants = await host.evaluate(async element => {
      const tool = element.shadowRoot.querySelector('#tool-new');
      const reference = document.createElement(tool.localName);
      reference.size = 's';
      reference.textContent = 'Reference';
      const fixture = document.querySelector('#fixture');
      fixture.append(reference);
      const rows = [];
      for (const inheritedSemanticColor of ['', 'rgb(19, 31, 47)']) {
        if (inheritedSemanticColor) fixture.style.setProperty('--lr-color-border-normal', inheritedSemanticColor);
        else fixture.style.removeProperty('--lr-color-border-normal');
        for (const variant of ['neutral', 'brand', 'danger']) {
          for (const appearance of ['quiet', 'filled']) {
            tool.variant = reference.variant = variant;
            tool.appearance = reference.appearance = appearance;
            await Promise.all([tool.updateComplete, reference.updateComplete]);
            const border = button => getComputedStyle(button.shadowRoot.querySelector('[part~="base"]')).borderTopColor;
            rows.push({ inheritedSemanticColor, variant, appearance, tool: border(tool), reference: border(reference) });
          }
        }
      }
      fixture.style.removeProperty('--lr-color-border-normal');
      tool.variant = 'neutral';
      tool.appearance = 'quiet';
      await tool.updateComplete;
      reference.remove();
      return rows;
    });
    assert.ok(new Set(variants.filter(row => row.appearance === 'filled').map(row => row.reference)).size > 1, 'Reference semantic variants paint distinct borders');
    assert.deepEqual(variants.filter(row => row.tool !== row.reference), [], 'Tools preserve their variant border when the hook is unset');
  });

  await check('document and editing icon tools share the same height across control-size settings', async () => {
    for (const customized of [false, true]) {
      await host.evaluate((element, customized) => {
        for (const [name, value] of [['--lr-icon-button-size', '44px'], ['--lr-theme-form-control-height-s', '46px']]) {
          if (customized) element.style.setProperty(name, value);
          else element.style.removeProperty(name);
        }
      }, customized);
      const heights = await host.evaluate(element => [...element.shadowRoot.querySelectorAll('lr-button[id^="tool-"]')]
        .map(button => ({ id: button.id, height: button.shadowRoot.querySelector('[part~="base"]').getBoundingClientRect().height })));
      const reference = heights.find(tool => tool.id === 'tool-new').height;
      assert.ok(reference >= (customized ? 46 : 30), JSON.stringify(heights));
      assert.deepEqual(heights.filter(tool => Math.abs(tool.height - reference) > 0.75), [], 'All icon tools match the file-action height');
    }
    await host.evaluate(element => {
      element.style.removeProperty('--lr-icon-button-size');
      element.style.removeProperty('--lr-theme-form-control-height-s');
    });
  });

  await check('borderless tools retain hover, keyboard focus, pressed fill and mixed outline feedback', async () => {
    await host.evaluate(element => element.style.setProperty('--lr-docx-editor-tool-border', 'transparent'));
    const tool = host.locator('#tool-new');
    const paint = () => tool.evaluate(button => {
      const base = button.shadowRoot.querySelector('[part~="base"]');
      const style = getComputedStyle(base);
      return { background: style.backgroundColor, border: style.borderTopColor,
        focusVisible: base.matches(':focus-visible'), outline: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth) };
    });
    await page.mouse.move(0, 0);
    const resting = await paint();
    await tool.hover();
    await page.waitForFunction(id => {
      const button = document.getElementById(id).shadowRoot.querySelector('#tool-new');
      return button.shadowRoot.querySelector('[part~="base"]').matches(':hover');
    }, id);
    assert.notEqual((await paint()).background, resting.background, 'Hover still paints feedback');
    await tool.getByRole('button').press('Tab');
    await page.keyboard.press('Shift+Tab');
    const focused = await paint();
    assert.equal(focused.focusVisible, true);
    assert.notEqual(focused.outline, 'none');
    assert.ok(focused.outlineWidth > 0);
    await page.mouse.move(0, 0);
    await tool.evaluate(async button => { button.appearance = 'filled'; button.pressed = true; await button.updateComplete; });
    assert.equal(await tool.getByRole('button').getAttribute('aria-pressed'), 'true');
    const pressed = await paint();
    assert.notEqual(pressed.background, resting.background, 'Pressed appearance retains its fill');
    assert.equal(pressed.border, 'rgba(0, 0, 0, 0)');
    await tool.evaluate(async button => { button.appearance = 'filled-outlined'; button.pressed = 'mixed'; await button.updateComplete; });
    assert.equal(await tool.getByRole('button').getAttribute('aria-pressed'), 'mixed');
    assert.notEqual((await paint()).border, 'rgba(0, 0, 0, 0)', 'Mixed state retains its distinguishing outline');
  });
  await host.evaluate(element => element.remove());
}

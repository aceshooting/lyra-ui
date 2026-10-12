import { expect, fixture, html } from '@open-wc/testing';
import './prompt-studio.js';
import type { LyraPromptStudio } from './prompt-studio.js';

it('renders each supported native toolbar heading level', async () => {
  const studio = await fixture<LyraPromptStudio>(html`<lr-prompt-studio heading="Prompt studio"></lr-prompt-studio>`);
  const heading = (): Element => studio.shadowRoot!.querySelector('[part="toolbar"]')!.firstElementChild!;

  for (const level of ['1', '2', '3', '5', '6'] as const) {
    studio.headingLevel = level;
    await studio.updateComplete;
    expect(heading().localName).to.equal(`h${level}`);
    expect(heading().textContent).to.equal('Prompt studio');
  }
  await expect(studio).to.be.accessible();
});

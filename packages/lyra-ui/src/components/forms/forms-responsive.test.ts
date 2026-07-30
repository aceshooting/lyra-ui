import { expect, fixture, html } from '@open-wc/testing';
import './checkbox-group/checkbox-group.js';
import './checkbox/checkbox.js';
import './code-editor/code-editor.js';
import './color-picker/color-picker.js';
import './combobox/combobox.js';
import './date-picker/date-input.js';
import './emoji-picker/emoji-picker.js';
import './input/input.js';
import './locale-picker/locale-picker.js';
import './phone-input/phone-input.js';
import './radio/radio-group.js';
import './radio/radio.js';
import './rubric-form/rubric-form.js';
import './switch/switch.js';
import './textarea/textarea.js';
import './time-range/time-range.js';
import './token-input/token-input.js';
import type { RubricKey } from './rubric-form/rubric-form.js';
import type { TimeRangePreset } from './time-range/time-range.js';

const LONG = `generated-${'identifier'.repeat(24)}`;
const WIDTH = 320;

type ReactiveHost = HTMLElement & { updateComplete: Promise<unknown> };

function overflowFailures(host: ReactiveHost, selectors: string): string[] {
  const failures: string[] = [];
  const hostWidth = host.getBoundingClientRect().width;
  if (hostWidth > WIDTH + 1 || host.scrollWidth > WIDTH + 1) {
    failures.push(`${host.localName}: host ${hostWidth}/${host.scrollWidth}`);
  }
  for (const part of host.shadowRoot?.querySelectorAll<HTMLElement>(selectors) ?? []) {
    if (part.hidden) continue;
    const width = part.getBoundingClientRect().width;
    if (part.scrollWidth > Math.ceil(width) + 1 || width > WIDTH + 1) {
      failures.push(
        `${host.localName}::part(${part.getAttribute('part')}): ${width}/${part.scrollWidth}`,
      );
    }
  }
  return failures;
}

it('contains public form chrome, rubric text, and preset labels at 320px with unbroken content', async () => {
  const rubricKeys: RubricKey[] = [
    { key: 'notes', type: 'comment', label: LONG, description: LONG },
  ];
  const presets: TimeRangePreset[] = [{ label: LONG, start: 0, end: 100 }];
  const root = await fixture(html`
    <div>
      <lr-checkbox-group data-case style="inline-size:${WIDTH}px" .label=${LONG} .hint=${LONG} .errorText=${LONG}>
        <lr-checkbox>Option</lr-checkbox>
      </lr-checkbox-group>
      <lr-code-editor data-case style="inline-size:${WIDTH}px" .label=${LONG} .hint=${LONG} .errorText=${LONG}></lr-code-editor>
      <lr-color-picker data-case style="inline-size:${WIDTH}px" .label=${LONG} .hint=${LONG} .errorText=${LONG}></lr-color-picker>
      <lr-combobox data-case style="inline-size:${WIDTH}px" .label=${LONG} .hint=${LONG} .errorText=${LONG}></lr-combobox>
      <lr-date-input data-case style="inline-size:${WIDTH}px" .label=${LONG} .hint=${LONG} .errorText=${LONG}></lr-date-input>
      <lr-emoji-picker data-case style="inline-size:${WIDTH}px" .groups=${[]} .label=${LONG} .hint=${LONG} .errorText=${LONG}></lr-emoji-picker>
      <lr-input data-case style="inline-size:${WIDTH}px" .hint=${LONG} .errorText=${LONG}>
        <span slot="label">${LONG}</span>
      </lr-input>
      <lr-locale-picker data-case style="inline-size:${WIDTH}px" .label=${LONG} .hint=${LONG} .errorText=${LONG}></lr-locale-picker>
      <lr-phone-input data-case style="inline-size:${WIDTH}px" .label=${LONG} .hint=${LONG} .errorText=${LONG}></lr-phone-input>
      <lr-radio-group data-case style="inline-size:${WIDTH}px" .label=${LONG} .hint=${LONG} .errorText=${LONG}>
        <lr-radio>Option</lr-radio>
      </lr-radio-group>
      <lr-switch data-case style="inline-size:${WIDTH}px" .hint=${LONG} .errorText=${LONG}>${LONG}</lr-switch>
      <lr-textarea data-case style="inline-size:${WIDTH}px" .label=${LONG} .hint=${LONG} .errorText=${LONG}></lr-textarea>
      <lr-token-input data-case style="inline-size:${WIDTH}px" .label=${LONG} .hint=${LONG} .errorText=${LONG}></lr-token-input>
      <lr-rubric-form data-rubric style="inline-size:${WIDTH}px" .keys=${rubricKeys}></lr-rubric-form>
      <lr-time-range data-range style="inline-size:${WIDTH}px" .presets=${presets}></lr-time-range>
    </div>
  `);
  const hosts = [...root.querySelectorAll<ReactiveHost>('[data-case], [data-rubric], [data-range]')];
  await Promise.all(hosts.map((host) => host.updateComplete));

  const failures = hosts.flatMap((host) => {
    if (host.hasAttribute('data-rubric')) {
      return overflowFailures(host, '[part="label"], [part="description"], [part="error"]');
    }
    if (host.hasAttribute('data-range')) {
      return overflowFailures(host, '[part="presets"], [part="preset-button"]');
    }
    return overflowFailures(
      host,
      '[part~="form-control-label"], [part="label"], [part="hint"], [part="error"]',
    );
  });

  expect(failures, failures.join('\n')).to.deep.equal([]);
});

import type { LyraCheckboxGroupEventMap } from '../src/components/lr-checkbox-group.js';
import type { LyraRadio } from '../src/components/lr-radio.js';
import type { LyraRadioGroupEventMap } from '../src/components/lr-radio-group.js';
import type { LyraToggleGroupEventMap } from '../src/components/lr-toggle-group.js';

declare const radio: LyraRadio;

const radioChange: LyraRadioGroupEventMap['lr-change'] =
  new CustomEvent('lr-change', { detail: { value: 'a', option: radio, radio } });
const checkboxChange: LyraCheckboxGroupEventMap['lr-change'] =
  new CustomEvent('lr-change', { detail: { value: ['a'] } });
const toggleChange: LyraToggleGroupEventMap['lr-change'] =
  new CustomEvent('lr-change', { detail: { value: ['a'] } });

void [radioChange, checkboxChange, toggleChange];

// @ts-expect-error A radio change identifies the selected option by both published names.
const missingRadio: LyraRadioGroupEventMap['lr-change']['detail'] = { value: 'a', option: radio };
// @ts-expect-error A radio change requires the option as well as its radio alias.
const missingOption: LyraRadioGroupEventMap['lr-change']['detail'] = { value: 'a', radio };
// @ts-expect-error A change always carries the selected values.
const missingCheckboxValue: LyraCheckboxGroupEventMap['lr-change']['detail'] = {};
// @ts-expect-error A change always carries the selected values.
const missingToggleValue: LyraToggleGroupEventMap['lr-change']['detail'] = {};
// @ts-expect-error A checkbox proposal also requires previousValue and option.
const incompleteCheckboxRequest: LyraCheckboxGroupEventMap['lr-checkbox-group-toggle-request']['detail'] = { value: [] };
// @ts-expect-error A toggle proposal also requires previousValue and option.
const incompleteToggleRequest: LyraToggleGroupEventMap['lr-toggle-group-toggle-request']['detail'] = { value: [] };

void [missingRadio, missingOption, missingCheckboxValue, missingToggleValue, incompleteCheckboxRequest, incompleteToggleRequest];

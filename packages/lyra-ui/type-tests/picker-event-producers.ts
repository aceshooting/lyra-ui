import type { LyraColorPickerEventMap } from '../src/components/forms/color-picker/color-picker.class.js';
import type { LyraDateInputEventMap } from '../src/components/forms/date-picker/date-input.class.js';
import type { LyraDatePickerEventMap } from '../src/components/forms/date-picker/date-picker.class.js';
import type { LyraSwatchPickerEventMap } from '../src/components/forms/swatch-picker/swatch-picker.class.js';

type Edit = 'lr-input' | 'lr-change';
type PickerEvents = Pick<LyraColorPickerEventMap, Edit> &
  Pick<LyraDateInputEventMap, Edit> &
  Pick<LyraDatePickerEventMap, Edit> &
  Pick<LyraSwatchPickerEventMap, 'lr-change'>;

const detail = { value: 'selected' };
export const pickerEvents = {
  'lr-input': new CustomEvent('lr-input', { detail }),
  'lr-change': new CustomEvent('lr-change', { detail }),
} satisfies PickerEvents;

type PickerDetail = LyraColorPickerEventMap[Edit]['detail'] |
  LyraDateInputEventMap[Edit]['detail'] |
  LyraDatePickerEventMap[Edit]['detail'] |
  LyraSwatchPickerEventMap['lr-change']['detail'];
type RequireValue<Detail extends { value: string }> = Detail;
export type PickerValueDetail = RequireValue<PickerDetail>;

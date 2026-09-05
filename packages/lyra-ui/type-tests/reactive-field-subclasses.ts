import { LyraDateInput } from '../src/components/forms/date-picker/date-input.class.js';
import { LyraDatePicker } from '../src/components/forms/date-picker/date-picker.class.js';
import { LyraPhoneInput } from '../src/components/forms/phone-input/phone-input.class.js';
import { LyraSlider } from '../src/components/forms/slider/slider.class.js';
import { LyraDocumentViewer } from '../src/components/viewers/document-viewer/document-viewer.class.js';

// Consumer subclasses can retain ordinary field defaults for the published reactive properties.
export class ConfiguredDateInput extends LyraDateInput {
  override clearLabel = 'Clear date';
  override dialogLabel = 'Choose date';
  override openLabel = 'Open date';
}
export class ConfiguredDatePicker extends LyraDatePicker {
  override nextLabel = 'Next date';
  override previousLabel = 'Previous date';
}
export class ConfiguredPhoneInput extends LyraPhoneInput {
  override countryLabel = 'Country';
  override incompleteText = 'Incomplete phone';
  override invalidText = 'Invalid phone';
}
export class ConfiguredSlider extends LyraSlider {
  override readonly = true;
}
export class ConfiguredDocumentViewer extends LyraDocumentViewer {
  override registry = undefined;
}

// An unset registry remains an optional property as well as accepting explicit undefined.
export const omittedRegistry: Pick<LyraDocumentViewer, 'registry'> = {};
export const undefinedRegistry: Pick<LyraDocumentViewer, 'registry'> = { registry: undefined };
// @ts-expect-error Registry assignments retain their existing registry type.
export const invalidRegistry: Pick<LyraDocumentViewer, 'registry'> = { registry: 42 };
// @ts-expect-error Readonly remains a boolean property.
export const invalidReadonly: Pick<LyraSlider, 'readonly'> = { readonly: 'yes' };

// Side-effect imports register every component…
import './components/sparkline/sparkline.js';
import './components/toast/toast.js';
import './components/toast/toast-item.js';
import './components/combobox/combobox.js';
import './components/combobox/option.js';
import './components/date-picker/date-picker.js';
import './components/date-picker/date-input.js';
import './components/flag/flag.js';

// …and the barrel re-exports classes, helpers, and types.
export { LyraSparkline } from './components/sparkline/sparkline.js';
export { LyraToast } from './components/toast/toast.js';
export type { ToastPlacement, ToastCreateOptions } from './components/toast/toast.js';
export { LyraToastItem } from './components/toast/toast-item.js';
export type { ToastVariant, ToastSize } from './components/toast/toast-item.js';
export { toast } from './components/toast/toaster.js';
export type { ToastOptions, ToastHandle } from './components/toast/toaster.js';
export { LyraCombobox } from './components/combobox/combobox.js';
export type { OptionFilter } from './components/combobox/combobox.js';
export { LyraOption } from './components/combobox/option.js';
export { LyraDatePicker } from './components/date-picker/date-picker.js';
export type { DateRange } from './components/date-picker/date-picker.js';
export { LyraDateInput } from './components/date-picker/date-input.js';
export { LyraFlag } from './components/flag/flag.js';
export { LANGUAGE_TO_COUNTRY, languageToCountry } from './components/flag/language-map.js';

export { LyraElement } from './internal/lyra-element.js';
export { FormAssociated } from './internal/form-associated.js';
export { LYRA_PREFIX, tag, defineElement } from './internal/prefix.js';

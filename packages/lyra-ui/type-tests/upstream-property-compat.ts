import type { ButtonVariant, LyraButton } from '../src/components/forms/button/button.js';
import type { LyraCombobox } from '../src/components/forms/combobox/combobox.js';
import type { LyraInput } from '../src/components/forms/input/input.js';
import type { LyraTextarea } from '../src/components/forms/textarea/textarea.js';
import type { LyraDropdownItem } from '../src/components/layout/menu/dropdown-item.js';
import type { LyraDialog } from '../src/components/overlays/dialog/dialog.js';
import type { LyraDrawer } from '../src/components/overlays/drawer/drawer.js';

declare const button: LyraButton;
const shoelaceButtonVariant: ButtonVariant = 'primary';
void shoelaceButtonVariant;
button.variant = 'default';
button.variant = 'primary';
button.variant = 'text';
button.formAction = '/save';
button.formEnctype = 'multipart/form-data';
button.formMethod = 'post';
button.formMethod = 'dialog';
button.formNoValidate = true;
button.formTarget = '_blank';

declare const dialog: LyraDialog;
declare const drawer: LyraDrawer;
dialog.modal = dialog.modal;
drawer.modal = drawer.modal;

declare const item: LyraDropdownItem;
item.submenuOpen = true;

declare const input: LyraInput;
declare const textarea: LyraTextarea;
declare const combobox: LyraCombobox;
input.autocorrect = false;
textarea.autocorrect = false;
combobox.autocorrect = false;

// Reads retain Web Awesome's boolean IDL while writes also accept each Shoelace contract.
input.autocorrect = 'off';
input.autocorrect = 'on';
textarea.autocorrect = 'off';
textarea.autocorrect = 'sentences';
const inputAutocorrect: boolean = input.autocorrect;
const textareaAutocorrect: boolean = textarea.autocorrect;
void inputAutocorrect;
void textareaAutocorrect;
// @ts-expect-error Shoelace input publishes only the closed on/off string vocabulary.
input.autocorrect = 'sentences';
// @ts-expect-error `autoCorrect` is not a second public property.
input.autoCorrect = 'off';
// @ts-expect-error `autoCorrect` is not a second public property.
textarea.autoCorrect = 'off';
// @ts-expect-error `autoCorrect` is not a second public property.
combobox.autoCorrect = 'off';

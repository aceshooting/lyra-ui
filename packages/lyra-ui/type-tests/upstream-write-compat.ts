import {
  LyraAnimation,
  LyraBadge,
  LyraBreadcrumbItem,
  LyraButton,
  LyraCheckbox,
  LyraColorPicker,
  LyraCombobox,
  LyraDateInput,
  LyraFileInput,
  LyraIcon,
  LyraIconButton,
  LyraInput,
  LyraKnownDate,
  LyraNumberInput,
  LyraOption,
  LyraOtpInput,
  LyraPopover,
  LyraPopup,
  LyraRadio,
  LyraRadioGroup,
  LyraRating,
  LyraSelect,
  LyraSplitPanel,
  LyraSwitch,
  LyraTag,
  LyraTextarea,
  LyraTimeInput,
  LyraToastItem,
  LyraToast,
  LyraTooltip,
} from '../src/lyra.js';
import type {
  BadgeSize,
  BadgeVariant,
  LyraDateInputValidator,
  LyraRatingSize,
  SnapFunction,
  TagVariant,
  ToastSize,
  ToastCreateOptions,
  ToastOptions,
} from '../src/lyra.js';

// These assignments are the public TypeScript spellings exposed by the pinned Shoelace 2.20.1
// and Web Awesome 3.11.0 manifests. Valid mirrored token spellings stay observable on read and
// reflection while resolving through Lyra's private rendering vocabulary.
declare const breadcrumbItem: LyraBreadcrumbItem;
breadcrumbItem.href = undefined;
const breadcrumbHref: string = breadcrumbItem.href;

declare const icon: LyraIcon;
icon.name = undefined;
icon.src = undefined;
const iconName: string = icon.name;
const iconSrc: string = icon.src;

declare const iconButton: LyraIconButton;
iconButton.name = undefined;
const iconButtonName: string = iconButton.name;

declare const animation: LyraAnimation;
animation.name = 'consumer-registered-animation';
animation.iterations = 2;
const animationName: string = animation.name;
const iterations: number = animation.iterations;

declare const badge: LyraBadge;
badge.variant = 'primary';
const badgeVariant: BadgeVariant = badge.variant;

declare const tag: LyraTag;
tag.size = 'small';
tag.size = 'medium';
tag.size = 'large';
tag.variant = 'primary';
tag.variant = 'text';
const tagSize: BadgeSize = tag.size;
const tagVariant: TagVariant = tag.variant;

declare const rating: LyraRating;
rating.size = 'small';
rating.size = 'medium';
rating.size = 'large';
const ratingSize: LyraRatingSize = rating.size;

declare const toastItem: LyraToastItem;
toastItem.size = 'small';
toastItem.size = 'medium';
toastItem.size = 'large';
const toastSize: ToastSize = toastItem.size;

declare const toastRegion: LyraToast;
void toastRegion.create('Small toast', { size: 'small' });
const toastCreateOptions: ToastCreateOptions = { size: 'medium' };
const toastOptions: ToastOptions = { message: 'Large toast', size: 'large' };

declare const splitPanel: LyraSplitPanel;
splitPanel.snap = undefined;
const splitSnap: string | SnapFunction = splitPanel.snap;

// Web Awesome's public `Validator` object contract is intentionally represented structurally so
// this test does not add an upstream package dependency to Lyra's type-test graph.
interface WebAwesomeValidator {
  observedAttributes?: string[];
  checkValidity: (element: { value: unknown }) => {
    message: string;
    isValid: boolean;
    invalidKeys: Exclude<keyof ValidityState, 'valid'>[];
  };
  message?: string | ((element: { value: unknown }) => string);
}

declare const dateInput: LyraDateInput;
declare const webAwesomeValidators: WebAwesomeValidator[];
dateInput.validators = webAwesomeValidators;
const dateInputValidators: LyraDateInputValidator[] = dateInput.validators;

// The pinned upstream declarations accept null writes for these string-valued IDLs. Reads stay
// string-valued in Lyra: a null write restores each control's existing empty/default semantics.
declare const button: LyraButton;
button.name = null;
const buttonName: string = button.name;

declare const checkbox: LyraCheckbox;
checkbox.name = null;
checkbox.value = null;
const checkboxName: string = checkbox.name;
const checkboxValue: string = checkbox.value;

declare const colorPicker: LyraColorPicker;
colorPicker.name = null;
colorPicker.value = null;
const colorPickerName: string = colorPicker.name;
const colorPickerValue: string = colorPicker.value;

declare const combobox: LyraCombobox;
combobox.name = null;
const comboboxName: string = combobox.name;

dateInput.name = null;
const dateInputName: string = dateInput.name;

declare const input: LyraInput;
input.name = null;
input.value = null;
const inputName: string = input.name;
const inputValue: string = input.value;

declare const knownDate: LyraKnownDate;
knownDate.name = null;
const knownDateName: string = knownDate.name;

declare const numberInput: LyraNumberInput;
numberInput.name = null;
numberInput.value = null;
const numberInputName: string = numberInput.name;
const numberInputValue: string = numberInput.value;

declare const otpInput: LyraOtpInput;
otpInput.name = null;
otpInput.value = null;
const otpInputName: string = otpInput.name;
const otpInputValue: string = otpInput.value;

declare const popover: LyraPopover;
popover.for = null;
const popoverFor: string = popover.for;

declare const radio: LyraRadio;
radio.name = null;
const radioName: string = radio.name;

declare const radioGroup: LyraRadioGroup;
radioGroup.name = null;
radioGroup.value = null;
const radioGroupName: string = radioGroup.name;
const radioGroupValue: string = radioGroup.value;

declare const ratingWithName: LyraRating;
ratingWithName.name = null;
const ratingName: string = ratingWithName.name;

declare const selectWithName: LyraSelect;
selectWithName.name = null;
const selectName: string = selectWithName.name;

declare const switchControl: LyraSwitch;
switchControl.name = null;
switchControl.value = null;
const switchName: string = switchControl.name;
const switchValue: string = switchControl.value;

declare const textarea: LyraTextarea;
textarea.name = null;
const textareaName: string = textarea.name;

declare const timeInput: LyraTimeInput;
timeInput.name = null;
const timeInputName: string = timeInput.name;

declare const tooltip: LyraTooltip;
tooltip.for = null;
const tooltipFor: string = tooltip.for;

declare const arbitraryValidationTarget: HTMLElement | undefined;
combobox.validationTarget = arbitraryValidationTarget;
dateInput.validationTarget = arbitraryValidationTarget;
const comboboxValidationTarget: HTMLElement | undefined = combobox.validationTarget;
const dateInputValidationTarget: HTMLElement | undefined = dateInput.validationTarget;

declare const select: LyraSelect;
declare const selectedOptions: LyraOption[];
select.selectedOptions = selectedOptions;
const selectedOptionSnapshot: LyraOption[] = select.selectedOptions;
declare const option: LyraOption;
option.defaultSelected = true;
const optionDefaultSelected: boolean = option.defaultSelected;
const optionLiveSelected: boolean = option.selected;
void optionDefaultSelected;
void optionLiveSelected;

declare const fileInput: LyraFileInput;
declare const validationTarget: HTMLElement;
fileInput.validationTarget = validationTarget;
fileInput.validationTarget = undefined;
const currentValidationTarget: HTMLElement | undefined = fileInput.validationTarget;

declare const popup: LyraPopup;
declare const positionedElement: HTMLElement;
popup.popup = positionedElement;
const currentPopup: HTMLElement = popup.popup;

void [
  breadcrumbHref,
  iconName,
  iconSrc,
  iconButtonName,
  animationName,
  iterations,
  badgeVariant,
  tagSize,
  tagVariant,
  ratingSize,
  toastSize,
  toastCreateOptions,
  toastOptions,
  splitSnap,
  dateInputValidators,
  buttonName,
  checkboxName,
  checkboxValue,
  colorPickerName,
  colorPickerValue,
  comboboxName,
  dateInputName,
  inputName,
  inputValue,
  knownDateName,
  numberInputName,
  numberInputValue,
  otpInputName,
  otpInputValue,
  popoverFor,
  radioName,
  radioGroupName,
  radioGroupValue,
  ratingName,
  selectName,
  switchName,
  switchValue,
  textareaName,
  timeInputName,
  tooltipFor,
  comboboxValidationTarget,
  dateInputValidationTarget,
  selectedOptionSnapshot,
  currentValidationTarget,
  currentPopup,
];

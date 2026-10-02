import type { LyraCountryPicker, LyraCountryCatalog } from '../src/components/forms/country-picker/country-picker.class.js';
import type { LyraTimeZonePicker, LyraTimeZoneCatalog } from '../src/components/forms/time-zone-picker/time-zone-picker.class.js';
import type { LyraUnitPicker, LyraUnitCatalog } from '../src/components/forms/unit-picker/unit-picker.class.js';
import type { LyraComponentTypeMap } from '../src/framework-types.js';
import type { LyraReactIntrinsicElements } from '../src/custom-elements-jsx.js';
import type { LyraVueGlobalComponents } from '../src/vue.js';
import type { LyraSvelteElements } from '../src/svelte.js';

type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;
type Assert<Value extends true> = Value;

declare const country: LyraCountryPicker;
declare const timeZone: LyraTimeZonePicker;
declare const unit: LyraUnitPicker;

country.countries = null;
country.countries = undefined;
timeZone.timeZones = null;
timeZone.timeZones = undefined;
unit.units = null;
unit.units = undefined;
country.defaultValue = null;
timeZone.defaultValue = null;
unit.defaultValue = null;

export type CatalogReads = [
  Assert<Equal<LyraCountryPicker['countries'], LyraCountryCatalog | undefined>>,
  Assert<Equal<LyraTimeZonePicker['timeZones'], LyraTimeZoneCatalog | undefined>>,
  Assert<Equal<LyraUnitPicker['units'], LyraUnitCatalog | undefined>>,
  Assert<Equal<LyraCountryPicker['defaultValue'], string>>,
  Assert<Equal<LyraTimeZonePicker['defaultValue'], string>>,
  Assert<Equal<LyraUnitPicker['defaultValue'], string>>,
];

type PickerWrites = {
  'lr-country-picker': Pick<LyraComponentTypeMap['lr-country-picker']['properties'], 'countries' | 'defaultValue'>;
  'lr-time-zone-picker': Pick<LyraComponentTypeMap['lr-time-zone-picker']['properties'], 'timeZones' | 'defaultValue'>;
  'lr-unit-picker': Pick<LyraComponentTypeMap['lr-unit-picker']['properties'], 'units' | 'defaultValue'>;
};
type ReactWrites = {
  'lr-country-picker': Pick<LyraReactIntrinsicElements['lr-country-picker'], 'countries' | 'defaultValue'>;
  'lr-time-zone-picker': Pick<LyraReactIntrinsicElements['lr-time-zone-picker'], 'timeZones' | 'defaultValue'>;
  'lr-unit-picker': Pick<LyraReactIntrinsicElements['lr-unit-picker'], 'units' | 'defaultValue'>;
};
type VueWrites = {
  'lr-country-picker': Pick<InstanceType<LyraVueGlobalComponents['lr-country-picker']>['$props'], 'countries' | 'defaultValue'>;
  'lr-time-zone-picker': Pick<InstanceType<LyraVueGlobalComponents['lr-time-zone-picker']>['$props'], 'timeZones' | 'defaultValue'>;
  'lr-unit-picker': Pick<InstanceType<LyraVueGlobalComponents['lr-unit-picker']>['$props'], 'units' | 'defaultValue'>;
};
type SvelteWrites = {
  'lr-country-picker': Pick<LyraSvelteElements['lr-country-picker'], 'countries' | 'defaultValue'>;
  'lr-time-zone-picker': Pick<LyraSvelteElements['lr-time-zone-picker'], 'timeZones' | 'defaultValue'>;
  'lr-unit-picker': Pick<LyraSvelteElements['lr-unit-picker'], 'units' | 'defaultValue'>;
};

const nullWrites = {
  'lr-country-picker': { countries: null, defaultValue: null },
  'lr-time-zone-picker': { timeZones: null, defaultValue: null },
  'lr-unit-picker': { units: null, defaultValue: null },
} as const;
export const pickerNullWrites: PickerWrites = nullWrites;
export const reactNullWrites: ReactWrites = nullWrites;
export const vueNullWrites: VueWrites = nullWrites;
export const svelteNullWrites: SvelteWrites = nullWrites;

export type CatalogWrites = [
  Assert<Equal<PickerWrites['lr-country-picker']['countries'], LyraCountryCatalog | null | undefined>>,
  Assert<Equal<PickerWrites['lr-time-zone-picker']['timeZones'], LyraTimeZoneCatalog | null | undefined>>,
  Assert<Equal<PickerWrites['lr-unit-picker']['units'], LyraUnitCatalog | null | undefined>>,
  Assert<Equal<PickerWrites['lr-country-picker']['defaultValue'], string | null | undefined>>,
  Assert<Equal<PickerWrites['lr-time-zone-picker']['defaultValue'], string | null | undefined>>,
  Assert<Equal<PickerWrites['lr-unit-picker']['defaultValue'], string | null | undefined>>,
];

// @ts-expect-error A catalog reset accepts null, not arbitrary scalar values.
country.countries = false;
// @ts-expect-error A catalog reset accepts null, not arbitrary scalar values.
timeZone.timeZones = false;
// @ts-expect-error A catalog reset accepts null, not arbitrary scalar values.
unit.units = false;
// @ts-expect-error Framework properties retain the catalog's item shape.
export const invalidReactCatalog: ReactWrites['lr-country-picker'] = { countries: [false] };
// @ts-expect-error Framework properties retain the catalog's item shape.
export const invalidVueCatalog: VueWrites['lr-time-zone-picker'] = { timeZones: [false] };
// @ts-expect-error Framework properties retain the catalog's item shape.
export const invalidSvelteCatalog: SvelteWrites['lr-unit-picker'] = { units: [false] };

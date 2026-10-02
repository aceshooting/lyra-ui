import type {
  LyraFilterBar,
  LyraFilterBarFilterDefinition,
  LyraFilterBarValue,
} from '../src/components/layout/filter-bar/filter-bar.class.js';
import type { FormAssociatedInterface } from '../src/internal/form-associated.js';

declare const filterBar: LyraFilterBar;

filterBar.filters = null;
filterBar.filters = undefined;
filterBar.value = null;
filterBar.value = undefined;

const filterDefinitions: readonly LyraFilterBarFilterDefinition[] = filterBar.filters;
const filterValue: LyraFilterBarValue = filterBar.value;
void filterDefinitions;
void filterValue;

declare const control: FormAssociatedInterface;
declare const owner: HTMLFormElement;

control.form = 'external-owner';
control.form = owner;
control.form = null;

const resolvedOwner: HTMLFormElement | null = control.form;
void resolvedOwner;

// @ts-expect-error reads remain element-valued even though string owner ids are accepted on write
const ownerId: string = control.form;
void ownerId;

control.defaultValue = null;
const resetDefault: string = control.defaultValue;
void resetDefault;
// @ts-expect-error clearing the reset default does not make its read value nullable
const nullDefault: null = control.defaultValue;
void nullDefault;

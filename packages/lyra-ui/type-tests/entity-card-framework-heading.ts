import type { LyraReactIntrinsicElements } from '../src/custom-elements-jsx.js';
import type { LyraVueGlobalComponents } from '../src/vue.js';
import type { LyraSvelteElements } from '../src/svelte.js';

type ReactHeading = Pick<LyraReactIntrinsicElements['lr-entity-card'], 'aria-level'>;
type VueHeading = Pick<
  InstanceType<LyraVueGlobalComponents['lr-entity-card']>['$props'],
  'aria-level'
>;
type SvelteHeading = Pick<LyraSvelteElements['lr-entity-card'], 'aria-level'>;

// Framework bindings retain numeric levels and nullable attribute removal.
const headingLevels = [
  {},
  { 'aria-level': 2 },
  { 'aria-level': '2' },
  { 'aria-level': null },
  { 'aria-level': undefined },
] as const;
export const reactHeadingLevels: readonly ReactHeading[] = headingLevels;
export const vueHeadingLevels: readonly VueHeading[] = headingLevels;
export const svelteHeadingLevels: readonly SvelteHeading[] = headingLevels;

// @ts-expect-error A heading level is not a boolean attribute.
export const invalidReactHeading: ReactHeading = { 'aria-level': true };
// @ts-expect-error A heading level is not a boolean attribute.
export const invalidVueHeading: VueHeading = { 'aria-level': true };
// @ts-expect-error A heading level is not a boolean attribute.
export const invalidSvelteHeading: SvelteHeading = { 'aria-level': true };
// @ts-expect-error A heading level cannot contain an object value.
export const objectReactHeading: ReactHeading = { 'aria-level': {} };
// @ts-expect-error A heading level cannot contain an object value.
export const objectVueHeading: VueHeading = { 'aria-level': {} };
// @ts-expect-error A heading level cannot contain an object value.
export const objectSvelteHeading: SvelteHeading = { 'aria-level': {} };

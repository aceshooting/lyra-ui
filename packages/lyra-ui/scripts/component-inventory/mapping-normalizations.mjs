import path from 'node:path';
import { readTypeAliases } from '../editor-type-values.mjs';
import { packageDir } from './paths.mjs';
import { CHART_REVIEW_EVIDENCE, DATA_GRID_OPTION_TYPE, DATA_GRID_CSV_OPTION_TYPE, DATA_GRID_GET_CSV_OPTION_TYPE, DATA_GRID_SCROLL_OPTION_TYPE } from './upstream-definitions.mjs';
import { emptyNormalizations } from '../component-inventory.mjs';

export function normalizedNormalizations(normalizations = {}) {
  const normalized = emptyNormalizations();
  for (const section of Object.keys(normalized)) {
    normalized[section] = Array.isArray(normalizations[section])
      ? structuredClone(normalizations[section])
      : [];
  }
  return normalized;
}

const reviewedDefaultEquivalence = (member, upstream, target) => ({
  memberKind: 'attribute',
  member,
  upstream,
  target,
});

const reviewedPropertyDefaultEquivalence = (member, upstream, target) => ({
  memberKind: 'property',
  member,
  upstream,
  target,
});

const reviewedTypeEquivalence = (memberKind, member, upstream, target) => ({
  memberKind,
  member,
  upstream,
  target,
});

const reviewedAttributePropertyEquivalence = (attribute, upstream, target) => ({
  attribute,
  upstream,
  target,
});

const reviewedReflectionEquivalence = (
  memberKind,
  member,
  upstream,
  target
) => ({
  memberKind,
  member,
  upstream,
  target,
});

// Catalog tuples use `null` for an absent manifest default. The generated normalization records
// presence separately so an explicitly authored `default: null` can never collapse into absence.
const reviewedCssDefaultEquivalence = (member, upstream, target) => ({
  member,
  upstreamHasDefault: upstream !== null,
  ...(upstream !== null ? { upstream } : {}),
  targetHasDefault: target !== null,
  ...(target !== null ? { target } : {}),
});

const reviewedDeprecationEquivalence = (
  section,
  member,
  upstreamDeprecated,
  upstreamReplacement,
  targetDeprecated,
  targetReplacement
) => ({
  section,
  member,
  upstreamDeprecated,
  upstreamReplacement,
  targetDeprecated,
  targetReplacement,
});

const reviewedMethodParameterTypeEquivalence = (
  method,
  parameter,
  upstream,
  target
) => ({
  method,
  parameter,
  upstream,
  target,
});

let structuralTypeAliasRegistry;
const reviewedStructuralTypeAlias = (name) => {
  structuralTypeAliasRegistry ??= readTypeAliases(
    path.join(packageDir, 'src')
  );
  if (structuralTypeAliasRegistry.structuralAmbiguous.has(name)) {
    throw new Error(`${name}: exported structural type alias is ambiguous`);
  }
  const target = structuralTypeAliasRegistry.structuralAliases.get(name);
  if (!target) {
    throw new Error(`${name}: exported structural type alias is missing`);
  }
  return { name, target };
};

// Widening an event's cancelability is a superset of the contract it replaces: `preventDefault()`
// on an event that was never cancelable is a silent no-op, and no shipped consumer writes code that
// depends on that no-op happening. A migrated listener that vetoes therefore cannot start behaving
// worse, only start working. Narrowing is the opposite and stays a blocking mismatch, so each rule
// below pins both observed labels per tag and per event rather than blanket-suppressing the code.
const reviewedCancelabilityEquivalence = (event, upstream, target) => ({
  event,
  upstream,
  target,
});

// The one reviewable narrowing: Lyra keeps the event cancelable on every path the upstream tag
// documents and adds a path of its own that announces itself non-cancelable, which drops the
// summary label from `always` to `conditional` without taking any documented veto away. `addedPath`
// records which Lyra-only path that is, so the claim survives in the generated inventory instead of
// living only in a reviewer's head.
const reviewedCancelabilityPathAddition = (event, addedPath) => ({
  event,
  upstream: 'always',
  target: 'conditional',
  addedPath,
});

// Both upstream and Lyra create one modal-coordination controller per instance. Their published
// manifests serialize the two original implementations differently (`new Modal(this)` versus the
// structurally equivalent object literal), so compare the exact reviewed runtime representations
// here instead of pretending either implementation spelling is a codemod rewrite.
const LYRA_MODAL_CONTROLLER_DEFAULT =
  '{ activateExternal: () => { this.externalModalDepth++; if (this.externalModalDepth === 1) ' +
  'this.overlay?.suspend(); }, deactivateExternal: () => { if (this.externalModalDepth === 0) return; ' +
  'this.externalModalDepth--; if (this.externalModalDepth === 0 && this.open && this.modalSurface) { ' +
  'this.overlay?.resume(); queueMicrotask(() => this.focusInitial()); } }, }';

// These are public-surface comparison normalizations, not executable source rewrites. The default
// pairs are semantic aliases/absence representations, and Shoelace's `get-tag` is an analyzer-
// inferred attribute for the documented property-only getTag callback. They affect comparison
// only and are never executable codemod rewrites.
// Type tuples are `[member kind, exact upstream members, exact upstream type, exact Lyra CEM
// type]`. They enumerate target aliases whose source declarations were reviewed to accept the
// complete upstream type. Keeping both strings and every member explicit makes analyzer or API
// changes fail validation instead of silently broadening a global alias rule.
const REVIEWED_TYPE_EQUIVALENCE_GROUPS = new Map([
  [
    'sl-alert',
    [
      [
        'attribute',
        ['countdown'],
        "'rtl' | 'ltr' | undefined",
        'AlertCountdown',
      ],
    ],
  ],
  [
    'sl-badge',
    [
      [
        'attribute',
        ['variant'],
        "'primary' | 'success' | 'neutral' | 'warning' | 'danger'",
        'BadgeVariant',
      ],
    ],
  ],
  [
    'sl-avatar',
    [
      ['attribute', ['loading'], "'eager' | 'lazy'", 'LyraAvatarLoading'],
      [
        'attribute',
        ['shape'],
        "'circle' | 'square' | 'rounded'",
        'LyraAvatarShape',
      ],
    ],
  ],
  [
    'sl-breadcrumb-item',
    [
      [
        'attribute',
        ['target'],
        "'_blank' | '_parent' | '_self' | '_top' | undefined",
        'LyraBreadcrumbItemTarget | undefined',
      ],
    ],
  ],
  [
    'sl-button',
    [
      [
        'attribute',
        ['formenctype'],
        "'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'",
        'ButtonFormEnctype | undefined',
      ],
      [
        'attribute',
        ['formmethod'],
        "'post' | 'get'",
        'ButtonFormMethod | undefined',
      ],
      ['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize'],
      ['attribute', ['type'], "'button' | 'submit' | 'reset'", 'ButtonType'],
      [
        'attribute',
        ['variant'],
        "'default' | 'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text'",
        'ButtonVariant',
      ],
    ],
  ],
  [
    'sl-checkbox',
    [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']],
  ],
  [
    'sl-color-picker',
    [
      [
        'attribute',
        ['format'],
        "'hex' | 'rgb' | 'hsl' | 'hsv'",
        'LyraColorPickerFormat',
      ],
      ['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'sl-copy-button',
    [
      [
        'attribute',
        ['tooltip-placement'],
        "'top' | 'right' | 'bottom' | 'left'",
        'LyraCopyButtonTooltipPlacement',
      ],
    ],
  ],
  [
    'sl-drawer',
    [
      [
        'attribute',
        ['placement'],
        "'top' | 'end' | 'bottom' | 'start'",
        'LyraDrawerPlacement',
      ],
    ],
  ],
  [
    'sl-dropdown',
    [
      [
        'attribute',
        ['sync'],
        "'width' | 'height' | 'both' | undefined",
        'PlaceSync | undefined',
      ],
    ],
  ],
  [
    'sl-format-bytes',
    [
      [
        'attribute',
        ['display'],
        "'long' | 'short' | 'narrow'",
        'LyraFormatDisplay',
      ],
      ['attribute', ['unit'], '\'byte\' | \'bit\'', 'LyraFormatBytesUnit'],
    ],
  ],
  [
    'sl-format-date',
    [
      [
        'attribute',
        ['day', 'hour', 'minute', 'second', 'year'],
        "'numeric' | '2-digit'",
        'LyraFormatDateNumeric | undefined',
      ],
      [
        'attribute',
        ['era', 'weekday'],
        "'narrow' | 'short' | 'long'",
        'LyraFormatDateText | undefined',
      ],
      ['attribute', ['hour-format'], '\'auto\' | \'12\' | \'24\'', 'LyraFormatDateHour'],
      [
        'attribute',
        ['month'],
        "'numeric' | '2-digit' | 'narrow' | 'short' | 'long'",
        'LyraFormatDateMonth | undefined',
      ],
      [
        'attribute',
        ['time-zone-name'],
        "'short' | 'long'",
        'LyraFormatDateTimeZoneName | undefined',
      ],
    ],
  ],
  [
    'sl-format-number',
    [
      [
        'attribute',
        ['currency-display'],
        "'symbol' | 'narrowSymbol' | 'code' | 'name'",
        'LyraFormatCurrencyDisplay',
      ],
      [
        'attribute',
        ['type'],
        "'currency' | 'decimal' | 'percent'",
        'LyraFormatNumberType',
      ],
    ],
  ],
  [
    'sl-include',
    [
      [
        'attribute',
        ['mode'],
        "'cors' | 'no-cors' | 'same-origin'",
        'LyraIncludeMode',
      ],
    ],
  ],
  [
    'sl-input',
    [
      ['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize'],
      [
        'attribute',
        ['type'],
        "| 'date' | 'datetime-local' | 'email' | 'number' | 'password' | 'search' | 'tel' | 'text' | 'time' | 'url'",
        'LyraInputType',
      ],
    ],
  ],
  [
    'sl-menu-item',
    [['attribute', ['type'], "'normal' | 'checkbox'", 'MenuItemType']],
  ],
  [
    'sl-popup',
    [
      [
        'attribute',
        ['arrow-placement'],
        "'start' | 'end' | 'center' | 'anchor'",
        'LyraArrowPlacement',
      ],
      [
        'attribute',
        ['auto-size'],
        "'horizontal' | 'vertical' | 'both'",
        'PlaceAutoSize | null',
      ],
      [
        'attribute',
        ['flip-fallback-strategy'],
        "'best-fit' | 'initial'",
        'LyraPopupFlipFallbackStrategy',
      ],
      ['attribute', ['strategy'], "'absolute' | 'fixed'", 'PlaceStrategy'],
      [
        'attribute',
        ['sync'],
        "'width' | 'height' | 'both'",
        'PlaceSync | null',
      ],
    ],
  ],
  [
    'sl-qr-code',
    [
      [
        'attribute',
        ['error-correction'],
        "'L' | 'M' | 'Q' | 'H'",
        'LyraQrCodeErrorCorrection',
      ],
    ],
  ],
  [
    'sl-radio',
    [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']],
  ],
  [
    'sl-radio-button',
    [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']],
  ],
  [
    'sl-radio-group',
    [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']],
  ],
  [
    'sl-relative-time',
    [
      ['attribute', ['format'], '\'long\' | \'short\' | \'narrow\'', 'LyraFormatDisplay'],
      ['attribute', ['numeric'], '\'always\' | \'auto\'', 'LyraRelativeTimeNumeric'],
    ],
  ],
  [
    'sl-select',
    [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']],
  ],
  [
    'sl-skeleton',
    [['attribute', ['effect'], '\'pulse\' | \'sheen\' | \'none\'', 'LyraSkeletonEffect']],
  ],
  [
    'sl-split-panel',
    [
      [
        'attribute',
        ['primary'],
        "'start' | 'end' | undefined",
        'LyraSplitPanelPrimary | undefined',
      ],
    ],
  ],
  [
    'sl-switch',
    [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']],
  ],
  [
    'sl-tab-group',
    [
      ['attribute', ['activation'], '\'auto\' | \'manual\'', 'LyraTabGroupActivation'],
      [
        'attribute',
        ['placement'],
        "'top' | 'bottom' | 'start' | 'end'",
        'LyraTabGroupPlacement',
      ],
    ],
  ],
  [
    'sl-tag',
    [
      ['attribute', ['size'], "'small' | 'medium' | 'large'", 'BadgeSize'],
      [
        'attribute',
        ['variant'],
        "'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text'",
        'TagVariant',
      ],
    ],
  ],
  [
    'sl-textarea',
    [
      [
        'attribute',
        ['resize'],
        "'none' | 'vertical' | 'auto'",
        'TextareaResize',
      ],
      ['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'sl-tree',
    [
      [
        'attribute',
        ['selection'],
        "'single' | 'multiple' | 'leaf'",
        'TreeSelection',
      ],
    ],
  ],
  [
    'wa-accordion',
    [
      ['attribute', ['heading-level'], 'string', 'LyraAccordionHeadingLevel'],
      [
        'attribute',
        ['icon-placement'],
        "'start' | 'end'",
        'LyraAccordionIconPlacement',
      ],
      [
        'attribute',
        ['mode'],
        "'single' | 'single-collapsible' | 'multiple'",
        'LyraAccordionMode',
      ],
    ],
  ],
  [
    'wa-avatar',
    [
      ['attribute', ['loading'], "'eager' | 'lazy'", 'LyraAvatarLoading'],
      [
        'attribute',
        ['shape'],
        "'circle' | 'square' | 'rounded'",
        'LyraAvatarShape',
      ],
    ],
  ],
  [
    'wa-badge',
    [
      [
        'attribute',
        ['appearance'],
        "'accent' | 'filled' | 'outlined' | 'filled-outlined'",
        'BadgeAppearance',
      ],
      [
        'attribute',
        ['attention'],
        "'none' | 'pulse' | 'bounce'",
        'BadgeAttention',
      ],
      [
        'attribute',
        ['variant'],
        "'brand' | 'neutral' | 'success' | 'warning' | 'danger'",
        'BadgeVariant',
      ],
    ],
  ],
  [
    'wa-bar-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      [
        'property',
        ['config'],
        "ChartJS['config']",
        'LyraChartConfiguration | undefined',
      ],
    ],
  ],
  [
    'wa-breadcrumb-item',
    [
      [
        'attribute',
        ['target'],
        "'_blank' | '_parent' | '_self' | '_top' | undefined",
        'LyraBreadcrumbItemTarget | undefined',
      ],
    ],
  ],
  [
    'wa-bubble-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      [
        'property',
        ['config'],
        "ChartJS['config']",
        'LyraChartConfiguration | undefined',
      ],
    ],
  ],
  [
    'wa-button',
    [
      [
        'attribute',
        ['appearance'],
        "'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain'",
        'ButtonAppearance',
      ],
      [
        'attribute',
        ['formenctype'],
        "'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'",
        'ButtonFormEnctype | undefined',
      ],
      [
        'attribute',
        ['formmethod'],
        "'post' | 'get'",
        'ButtonFormMethod | undefined',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
      ['attribute', ['type'], "'button' | 'submit' | 'reset'", 'ButtonType'],
      [
        'attribute',
        ['variant'],
        "'neutral' | 'brand' | 'success' | 'warning' | 'danger'",
        'ButtonVariant',
      ],
    ],
  ],
  [
    'wa-button-group',
    [
      [
        'attribute',
        ['orientation'],
        "'horizontal' | 'vertical'",
        'LyraOrientation',
      ],
    ],
  ],
  [
    'wa-callout',
    [
      [
        'attribute',
        ['appearance'],
        "'accent' | 'filled' | 'outlined' | 'plain' | 'filled-outlined'",
        'CalloutAppearance',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'CalloutSize',
      ],
      [
        'attribute',
        ['variant'],
        "'brand' | 'neutral' | 'success' | 'warning' | 'danger'",
        'CalloutVariant',
      ],
    ],
  ],
  [
    'wa-card',
    [
      [
        'attribute',
        ['appearance'],
        "'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain'",
        'LyraAppearance',
      ],
    ],
  ],
  [
    'wa-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      [
        'property',
        ['config'],
        "ChartJS['config']",
        'LyraChartConfiguration | undefined',
      ],
    ],
  ],
  [
    'wa-checkbox',
    [
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-checkbox-group',
    [
      [
        'attribute',
        ['orientation'],
        "'horizontal' | 'vertical'",
        'CheckboxGroupOrientation',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize | undefined',
      ],
    ],
  ],
  [
    'wa-color-picker',
    [
      [
        'attribute',
        ['format'],
        "'hex' | 'rgb' | 'hsl' | 'hsv'",
        'LyraColorPickerFormat',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-combobox',
    [
      ['attribute', ['placement'], "'top' | 'bottom'", 'LyraComboboxPlacement'],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-copy-button',
    [
      [
        'attribute',
        ['tooltip-placement'],
        "'top' | 'right' | 'bottom' | 'left'",
        'LyraCopyButtonTooltipPlacement',
      ],
      [
        'attribute',
        ['tooltip'],
        "'full' | 'copy' | 'none'",
        'LyraCopyButtonTooltip',
      ],
    ],
  ],
  [
    'wa-data-grid',
    [
      [
        'attribute',
        ['appearance'],
        "'outlined' | 'plain'",
        'DataGridAppearance',
      ],
      [
        'attribute',
        ['selectable'],
        "'' | 'single' | 'multiple' | 'none'",
        'DataGridSelectable',
      ],
    ],
  ],
  [
    'wa-date-input',
    [
      [
        'attribute',
        ['disabled-dates'],
        'string | string[] | Date[]',
        'LyraDatePickerDisabledDates',
      ],
      ['attribute', ['page-by'], "'months' | 'single'", 'LyraDatePickerPageBy'],
      [
        'attribute',
        ['size'],
        "WaDateInputSize | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
      [
        'attribute',
        ['weekday-format'],
        "'narrow' | 'short' | 'long'",
        'WeekdayFormat',
      ],
    ],
  ],
  [
    'wa-date-picker',
    [
      [
        'attribute',
        ['disabled-dates'],
        'string | string[] | Date[]',
        'LyraDatePickerDisabledDates',
      ],
      [
        'attribute',
        ['size'],
        "WaDatePickerSize | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-details',
    [
      [
        'attribute',
        ['icon-placement'],
        "'start' | 'end'",
        'LyraDetailsIconPlacement',
      ],
    ],
  ],
  [
    'wa-divider',
    [
      [
        'attribute',
        ['orientation'],
        "'horizontal' | 'vertical'",
        'LyraDividerOrientation',
      ],
    ],
  ],
  [
    'wa-doughnut-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      [
        'property',
        ['config'],
        "ChartJS['config']",
        'LyraChartConfiguration | undefined',
      ],
    ],
  ],
  [
    'wa-drawer',
    [
      [
        'attribute',
        ['placement'],
        "'top' | 'end' | 'bottom' | 'start'",
        'LyraDrawerPlacement',
      ],
    ],
  ],
  [
    'wa-dropdown',
    [
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-dropdown-item',
    [
      ['attribute', ['type'], "'normal' | 'checkbox'", 'MenuItemType'],
      ['attribute', ['variant'], "'danger' | 'default'", 'MenuItemVariant'],
    ],
  ],
  [
    'wa-file-input',
    [
      [
        'attribute',
        ['capture'],
        "'user' | 'environment'",
        'LyraFileInputCapture',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-format-bytes',
    [
      [
        'attribute',
        ['display'],
        "'long' | 'short' | 'narrow'",
        'LyraFormatDisplay',
      ],
      ['attribute', ['unit'], '\'byte\' | \'bit\'', 'LyraFormatBytesUnit'],
    ],
  ],
  [
    'wa-format-date',
    [
      [
        'attribute',
        ['day', 'hour', 'minute', 'second', 'year'],
        "'numeric' | '2-digit'",
        'LyraFormatDateNumeric | undefined',
      ],
      [
        'attribute',
        ['era', 'weekday'],
        "'narrow' | 'short' | 'long'",
        'LyraFormatDateText | undefined',
      ],
      ['attribute', ['hour-format'], '\'auto\' | \'12\' | \'24\'', 'LyraFormatDateHour'],
      [
        'attribute',
        ['month'],
        "'numeric' | '2-digit' | 'narrow' | 'short' | 'long'",
        'LyraFormatDateMonth | undefined',
      ],
      [
        'attribute',
        ['time-zone-name'],
        "'short' | 'long'",
        'LyraFormatDateTimeZoneName | undefined',
      ],
    ],
  ],
  [
    'wa-format-number',
    [
      [
        'attribute',
        ['currency-display'],
        "'symbol' | 'narrowSymbol' | 'code' | 'name'",
        'LyraFormatCurrencyDisplay',
      ],
      [
        'attribute',
        ['type'],
        "'currency' | 'decimal' | 'percent'",
        'LyraFormatNumberType',
      ],
    ],
  ],
  [
    'wa-icon',
    [
      [
        'attribute',
        ['animation'],
        "'beat' | 'fade' | 'beat-fade' | 'bounce' | 'flip' | 'flip-360' | 'shake' | 'spin' | 'spin-pulse' | 'spin-reverse' | 'spin-snap' | 'spin-snap-4' | 'spin-snap-8' | 'buzz' | 'wag' | 'float' | 'swing' | 'jello' | undefined",
        'LyraIconAnimation | undefined',
      ],
      [
        'attribute',
        ['canvas'],
        "'fixed' | 'auto' | 'square' | 'roomy' | undefined",
        'LyraIconCanvas | undefined',
      ],
      [
        'attribute',
        ['flip'],
        "'x' | 'y' | 'both' | undefined",
        'LyraIconFlip | undefined',
      ],
    ],
  ],
  [
    'wa-include',
    [
      [
        'attribute',
        ['mode'],
        "'cors' | 'no-cors' | 'same-origin'",
        'LyraIncludeMode',
      ],
    ],
  ],
  [
    'wa-input',
    [
      [
        'attribute',
        ['appearance'],
        "'filled' | 'outlined' | 'filled-outlined'",
        'LyraAppearance',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
      [
        'attribute',
        ['type'],
        "'date' | 'datetime-local' | 'email' | 'number' | 'password' | 'search' | 'tel' | 'text' | 'time' | 'url'",
        'LyraInputType',
      ],
    ],
  ],
  [
    'wa-known-date',
    [
      [
        'attribute',
        ['size'],
        "'s' | 'xs' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
      ['property', ['parts'], 'DateParts', 'LyraKnownDateParts'],
    ],
  ],
  [
    'wa-line-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      [
        'property',
        ['config'],
        "ChartJS['config']",
        'LyraChartConfiguration | undefined',
      ],
    ],
  ],
  [
    'wa-markdown',
    [['property', ['marked'], 'Marked', 'LyraMarkedParser | undefined']],
  ],
  [
    'wa-number-input',
    [
      [
        'attribute',
        ['appearance'],
        "'filled' | 'outlined' | 'filled-outlined'",
        'LyraAppearance',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-otp-input',
    [
      ['attribute', ['case'], "'preserve' | 'upper' | 'lower'", 'OtpInputCase'],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
      [
        'attribute',
        ['type'],
        "'numeric' | 'alpha' | 'alphanumeric'",
        'OtpInputType',
      ],
    ],
  ],
  [
    'wa-page',
    [
      [
        'attribute',
        ['navigation-placement'],
        "'start' | 'end'",
        'PageNavigationPlacement',
      ],
      ['attribute', ['view'], "'mobile' | 'desktop'", 'PageView'],
    ],
  ],
  [
    'wa-pagination',
    [
      [
        'attribute',
        ['appearance'],
        "'outlined' | 'filled' | 'plain'",
        'LyraAppearance',
      ],
      [
        'attribute',
        ['format'],
        "'standard' | 'compact'",
        'LyraPaginationFormat',
      ],
    ],
  ],
  [
    'wa-pie-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      [
        'property',
        ['config'],
        "ChartJS['config']",
        'LyraChartConfiguration | undefined',
      ],
    ],
  ],
  [
    'wa-polar-area-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      [
        'property',
        ['config'],
        "ChartJS['config']",
        'LyraChartConfiguration | undefined',
      ],
    ],
  ],
  [
    'wa-popup',
    [
      [
        'attribute',
        ['arrow-placement'],
        "'start' | 'end' | 'center' | 'anchor'",
        'LyraArrowPlacement',
      ],
      [
        'attribute',
        ['auto-size'],
        "'horizontal' | 'vertical' | 'both'",
        'PlaceAutoSize | null',
      ],
      ['attribute', ['boundary'], "'viewport' | 'scroll'", 'LyraPopupBoundary'],
      [
        'attribute',
        ['flip-fallback-strategy'],
        "'best-fit' | 'initial'",
        'LyraPopupFlipFallbackStrategy',
      ],
      [
        'attribute',
        ['sync'],
        "'width' | 'height' | 'both'",
        'PlaceSync | null',
      ],
    ],
  ],
  [
    'wa-qr-code',
    [
      [
        'attribute',
        ['error-correction'],
        "'L' | 'M' | 'Q' | 'H'",
        'LyraQrCodeErrorCorrection',
      ],
    ],
  ],
  [
    'wa-radar-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      [
        'property',
        ['config'],
        "ChartJS['config']",
        'LyraChartConfiguration | undefined',
      ],
    ],
  ],
  [
    'wa-radio',
    [
      ['attribute', ['appearance'], "'default' | 'button'", 'RadioAppearance'],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-radio-group',
    [
      [
        'attribute',
        ['orientation'],
        "'horizontal' | 'vertical'",
        'RadioGroupOrientation',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-random-content',
    [
      [
        'attribute',
        ['animation'],
        "'none' | 'fade' | 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right'",
        'LyraRandomContentAnimation',
      ],
      [
        'attribute',
        ['mode'],
        "'random' | 'unique' | 'sequence'",
        'LyraRandomContentMode',
      ],
    ],
  ],
  [
    'wa-relative-time',
    [
      ['attribute', ['format'], '\'long\' | \'short\' | \'narrow\'', 'LyraFormatDisplay'],
      ['attribute', ['numeric'], '\'always\' | \'auto\'', 'LyraRelativeTimeNumeric'],
    ],
  ],
  [
    'wa-scatter-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      [
        'property',
        ['config'],
        "ChartJS['config']",
        'LyraChartConfiguration | undefined',
      ],
    ],
  ],
  [
    'wa-select',
    [
      [
        'attribute',
        ['appearance'],
        "'filled' | 'outlined' | 'filled-outlined'",
        'LyraAppearance',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-rating',
    [
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraRatingSize',
      ],
    ],
  ],
  [
    'wa-skeleton',
    [['attribute', ['effect'], '\'pulse\' | \'sheen\' | \'none\'', 'LyraSkeletonEffect']],
  ],
  [
    'wa-slider',
    [
      [
        'attribute',
        ['orientation'],
        "'horizontal' | 'vertical'",
        'SliderOrientation',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
      [
        'attribute',
        ['tooltip-placement'],
        "'top' | 'right' | 'bottom' | 'left'",
        'SliderTooltipPlacement',
      ],
    ],
  ],
  [
    'wa-split-panel',
    [
      [
        'attribute',
        ['orientation'],
        "'horizontal' | 'vertical'",
        'LyraSplitPanelOrientation',
      ],
      [
        'attribute',
        ['primary'],
        "'start' | 'end' | undefined",
        'LyraSplitPanelPrimary | undefined',
      ],
    ],
  ],
  [
    'wa-switch',
    [
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-tab-group',
    [
      ['attribute', ['activation'], '\'auto\' | \'manual\'', 'LyraTabGroupActivation'],
      [
        'attribute',
        ['placement'],
        "'top' | 'bottom' | 'start' | 'end'",
        'LyraTabGroupPlacement',
      ],
    ],
  ],
  [
    'wa-tag',
    [
      [
        'attribute',
        ['appearance'],
        "'accent' | 'filled' | 'outlined' | 'filled-outlined'",
        'BadgeAppearance',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'BadgeSize',
      ],
      [
        'attribute',
        ['variant'],
        "'brand' | 'neutral' | 'success' | 'warning' | 'danger'",
        'TagVariant',
      ],
    ],
  ],
  [
    'wa-textarea',
    [
      [
        'attribute',
        ['appearance'],
        "'filled' | 'outlined' | 'filled-outlined'",
        'LyraAppearance',
      ],
      [
        'attribute',
        ['resize'],
        "'none' | 'vertical' | 'horizontal' | 'both' | 'auto'",
        'TextareaResize',
      ],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
    ],
  ],
  [
    'wa-time-input',
    [
      [
        'attribute',
        ['appearance'],
        "'filled' | 'outlined' | 'filled-outlined'",
        'LyraAppearance',
      ],
      [
        'attribute',
        ['hour-format'],
        "'auto' | '12' | '24'",
        'LyraTimeInputHourFormat',
      ],
      [
        'attribute',
        ['placement'],
        "'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end'",
        'LyraTimeInputPlacement',
      ],
      [
        'attribute',
        ['size'],
        "'s' | 'xs' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraSize',
      ],
      ['attribute', ['step'], "number | 'any'", 'LyraTimeInputStep'],
    ],
  ],
  [
    'wa-toast',
    [
      [
        'attribute',
        ['placement'],
        "'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end'",
        'LyraToastPlacement',
      ],
    ],
  ],
  [
    'wa-toast-item',
    [
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'LyraToastSize',
      ],
      [
        'attribute',
        ['variant'],
        "'brand' | 'success' | 'warning' | 'danger' | 'neutral'",
        'LyraToastVariant',
      ],
    ],
  ],
  [
    'wa-tree',
    [
      [
        'attribute',
        ['selection'],
        "'single' | 'multiple' | 'leaf' | 'leaf-multiple'",
        'TreeSelection',
      ],
    ],
  ],
  [
    'wa-video',
    [
      [
        'attribute',
        ['controls'],
        "'none' | 'standard' | 'full'",
        'LyraVideoControls',
      ],
      [
        'attribute',
        ['preload'],
        "'auto' | 'metadata' | 'none'",
        'LyraVideoPreload',
      ],
    ],
  ],
  [
    'wa-video-playlist',
    [
      [
        'attribute',
        ['controls'],
        "'none' | 'standard' | 'full'",
        'LyraVideoControls',
      ],
    ],
  ],
  [
    'wa-zoomable-frame',
    [
      [
        'attribute',
        ['loading'],
        "'eager' | 'lazy'",
        'LyraZoomableFrameLoading',
      ],
    ],
  ],
]);

// These pairs cannot be expanded as plain local aliases. They cover reviewed TypeScript utility
// types, dependency-owned names, generic/default projections, and CEM spellings that differ while
// preserving the upstream assignment shape. They remain exact per tag and member for the same
// stale-rule guarantees as the local-alias table above.
const REVIEWED_OPAQUE_TYPE_EQUIVALENCE_GROUPS = new Map([
  [
    'sl-alert',
    [
      [
        'attribute',
        ['variant'],
        "'primary' | 'success' | 'neutral' | 'warning' | 'danger'",
        'AlertVariant',
      ],
    ],
  ],
  [
    'sl-carousel',
    [
      [
        'attribute',
        ['orientation'],
        "'horizontal' | 'vertical'",
        'LyraCarouselOrientation',
      ],
    ],
  ],
  [
    'sl-dropdown',
    [
      [
        'attribute',
        ['placement'],
        "| 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'right' | 'right-start' | 'right-end' | 'left' | 'left-start' | 'left-end'",
        'Placement',
      ],
    ],
  ],
  [
    'sl-format-date',
    [
      [
        'attribute',
        ['time-zone'],
        'string',
        "Intl.DateTimeFormatOptions['timeZone'] | undefined",
      ],
    ],
  ],
  [
    'sl-popup',
    [
      [
        'attribute',
        ['anchor'],
        'Element | string | VirtualElement',
        'LyraPopupAnchor | null',
      ],
      [
        'attribute',
        ['placement'],
        "| 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'right' | 'right-start' | 'right-end' | 'left' | 'left-start' | 'left-end'",
        'Placement',
      ],
    ],
  ],
  [
    'sl-select',
    [['attribute', ['placement'], "'top' | 'bottom'", 'Placement']],
  ],
  [
    'sl-tooltip',
    [
      [
        'attribute',
        ['placement'],
        "| 'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end'",
        'Placement',
      ],
    ],
  ],
  [
    'wa-accordion',
    [
      [
        'attribute',
        ['appearance'],
        "'filled' | 'outlined' | 'filled-outlined' | 'plain'",
        'LyraAccordionAppearance',
      ],
    ],
  ],
  [
    'wa-bar-chart',
    [
      [
        'attribute',
        ['legend-position'],
        "LayoutPosition | 'start' | 'end'",
        'LyraChartLegendPosition',
      ],
    ],
  ],
  [
    'wa-card',
    [
      [
        'attribute',
        ['orientation'],
        "'horizontal' | 'vertical'",
        'LyraOrientation',
      ],
    ],
  ],
  [
    'wa-carousel',
    [
      [
        'attribute',
        ['orientation'],
        "'horizontal' | 'vertical'",
        'LyraCarouselOrientation',
      ],
    ],
  ],
  [
    'wa-bubble-chart',
    [
      [
        'attribute',
        ['legend-position'],
        "LayoutPosition | 'start' | 'end'",
        'LyraChartLegendPosition',
      ],
    ],
  ],
  [
    'wa-chart',
    [
      [
        'attribute',
        ['legend-position'],
        "LayoutPosition | 'start' | 'end'",
        'LyraChartLegendPosition',
      ],
    ],
  ],
  [
    'wa-color-picker',
    [
      [
        'attribute',
        ['placement'],
        "'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'right' | 'right-start' | 'right-end' | 'left' | 'left-start' | 'left-end'",
        'Placement',
      ],
    ],
  ],
  [
    'wa-combobox',
    [
      [
        'property',
        ['filter'],
        '((option: WaOption, query: string) => boolean) | null',
        'OptionFilter | null',
      ],
      [
        'property',
        ['getTag'],
        '(option: WaOption, index: number) => TemplateResult | string | HTMLElement',
        'LyraComboboxTagRenderer | undefined',
      ],
      ['property', ['validators'], 'Validator[]', 'LyraComboboxValidator[]'],
    ],
  ],
  [
    'wa-data-grid',
    [
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        'DataGridSize',
      ],
      [
        'property',
        ['dataSource'],
        '((request: DataGridRequest) => Promise<DataGridResponse>) | null',
        '| ((request: DataGridRequest) => Promise<DataGridResponse<Row>>) | null',
      ],
      [
        'property',
        ['searchFn'],
        '((value: unknown, searchTerm: string, row: Row) => boolean) | null',
        '| ((value: unknown, term: string, row: Row) => boolean) | null',
      ],
    ],
  ],
  [
    'wa-date-input',
    [
      ['attribute', ['mode'], 'WaDateInputMode', "'single' | 'range'"],
      [
        'property',
        ['dayContent'],
        'WaDateInputDayContent | undefined',
        'LyraDatePickerDayContent | undefined',
      ],
      ['property', ['validators'], 'Validator[]', 'LyraDateInputValidator[]'],
      [
        'property',
        ['valueAsRange'],
        '{ from: Date | null; to: Date | null }',
        'DateRange',
      ],
    ],
  ],
  [
    'wa-date-picker',
    [
      ['attribute', ['mode'], 'WaDatePickerMode', 'CalendarMode'],
      [
        'attribute',
        ['weekday-format'],
        'WaDatePickerWeekdayFormat',
        'WeekdayFormat',
      ],
      ['property', ['valueAsRange'], 'WaDatePickerRange', 'DateRange'],
    ],
  ],
  [
    'wa-details',
    [
      [
        'attribute',
        ['appearance'],
        "'filled' | 'outlined' | 'filled-outlined' | 'plain'",
        'LyraDetailsAppearance',
      ],
    ],
  ],
  [
    'wa-doughnut-chart',
    [
      [
        'attribute',
        ['legend-position'],
        "LayoutPosition | 'start' | 'end'",
        'LyraChartLegendPosition',
      ],
    ],
  ],
  [
    'wa-dropdown',
    [
      [
        'attribute',
        ['placement'],
        "'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'right' | 'right-start' | 'right-end' | 'left' | 'left-start' | 'left-end'",
        'Placement',
      ],
    ],
  ],
  [
    'wa-file-input',
    [['property', ['validators'], 'Validator[]', 'LyraFileInputValidator[]']],
  ],
  [
    'wa-format-date',
    [
      [
        'attribute',
        ['time-zone'],
        'string',
        "Intl.DateTimeFormatOptions['timeZone'] | undefined",
      ],
    ],
  ],
  [
    'wa-known-date',
    [
      [
        'attribute',
        ['appearance'],
        "'filled' | 'outlined' | 'filled-outlined'",
        'LyraKnownDateAppearance',
      ],
    ],
  ],
  [
    'wa-line-chart',
    [
      [
        'attribute',
        ['legend-position'],
        "LayoutPosition | 'start' | 'end'",
        'LyraChartLegendPosition',
      ],
    ],
  ],
  [
    'wa-otp-input',
    [
      [
        'attribute',
        ['appearance'],
        "'outlined' | 'filled' | 'filled-outlined' | 'contained'",
        'OtpInputAppearance',
      ],
    ],
  ],
  [
    'wa-pie-chart',
    [
      [
        'attribute',
        ['legend-position'],
        "LayoutPosition | 'start' | 'end'",
        'LyraChartLegendPosition',
      ],
    ],
  ],
  [
    'wa-polar-area-chart',
    [
      [
        'attribute',
        ['legend-position'],
        "LayoutPosition | 'start' | 'end'",
        'LyraChartLegendPosition',
      ],
    ],
  ],
  [
    'wa-popover',
    [
      [
        'attribute',
        ['placement'],
        "'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end'",
        'Placement',
      ],
    ],
  ],
  [
    'wa-popup',
    [
      [
        'attribute',
        ['anchor'],
        'Element | string | VirtualElement',
        'LyraPopupAnchor | null',
      ],
      [
        'attribute',
        ['placement'],
        "'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'right' | 'right-start' | 'right-end' | 'left' | 'left-start' | 'left-end'",
        'Placement',
      ],
    ],
  ],
  [
    'wa-radar-chart',
    [
      [
        'attribute',
        ['legend-position'],
        "LayoutPosition | 'start' | 'end'",
        'LyraChartLegendPosition',
      ],
    ],
  ],
  [
    'wa-scatter-chart',
    [
      [
        'attribute',
        ['legend-position'],
        "LayoutPosition | 'start' | 'end'",
        'LyraChartLegendPosition',
      ],
    ],
  ],
  [
    'wa-select',
    [
      ['attribute', ['placement'], "'top' | 'bottom'", 'Placement'],
      [
        'property',
        ['getTag'],
        '(option: WaOption, index: number) => TemplateResult | string | HTMLElement',
        'LyraSelectTagRenderer | undefined',
      ],
    ],
  ],
  [
    'wa-slider',
    [
      [
        'property',
        ['valueFormatter'],
        '(value: number) => string',
        'SliderValueFormatter | undefined',
      ],
    ],
  ],
  [
    'wa-sparkline',
    [
      [
        'attribute',
        ['appearance'],
        "'gradient' | 'line' | 'solid'",
        'LyraSparklineAppearance',
      ],
      [
        'attribute',
        ['curve'],
        "'linear' | 'natural' | 'step'",
        'LyraSparklineCurve',
      ],
      [
        'attribute',
        ['trend'],
        "'positive' | 'negative' | 'neutral'",
        'LyraSparklineTrend | undefined',
      ],
    ],
  ],
  [
    'wa-scroller',
    [
      [
        'attribute',
        ['orientation'],
        "'horizontal' | 'vertical'",
        'LyraOrientation',
      ],
    ],
  ],
  [
    'wa-tooltip',
    [
      [
        'attribute',
        ['placement'],
        "'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end'",
        'Placement',
      ],
    ],
  ],
]);

// EventMap projection intentionally publishes Lyra's concrete runtime event classes and detail
// aliases. Some pinned upstream manifests expose only a detail object, an unparameterized
// `Event`/`CustomEvent`, or a narrower public alias. These exact per-tag/member pairs are the
// review boundary: event types are otherwise compared literally after prefix normalization, so a
// changed alias, newly broad `unknown`, or unrelated event cannot inherit an exception.
const REVIEWED_EVENT_TYPE_EQUIVALENCE_GROUPS = new Map([
  [
    'sl-dialog',
    [
      [
        'event',
        ['sl-request-close'],
        "{ source: 'close-button' | 'keyboard' | 'overlay' }",
        'CustomEvent<LyraDialogRequestCloseDetail>',
      ],
    ],
  ],
  [
    'sl-drawer',
    [
      [
        'event',
        ['sl-request-close'],
        "{ source: 'close-button' | 'keyboard' | 'overlay' }",
        'CustomEvent<LyraDialogRequestCloseDetail>',
      ],
    ],
  ],
  [
    'sl-include',
    [
      [
        'event',
        ['sl-error'],
        '{ status: number }',
        'CustomEvent<LyraIncludeErrorDetail>',
      ],
    ],
  ],
  [
    'sl-menu',
    [
      [
        'event',
        ['sl-select'],
        '{ item: SlMenuItem }',
        'CustomEvent<LyraEventDetailSnapshot<MenuItemSelectDetail>>',
      ],
    ],
  ],
  [
    'sl-mutation-observer',
    [
      [
        'event',
        ['sl-mutation'],
        '{ mutationList: MutationRecord[] }',
        'CustomEvent< Readonly<{ records: readonly MutationRecord[]; mutationList: readonly MutationRecord[]; }> >',
      ],
    ],
  ],
  [
    'sl-rating',
    [
      [
        'event',
        ['sl-hover'],
        "{ phase: 'start' | 'move' | 'end', value: number }",
        'CustomEvent<{ phase: LyraRatingHoverPhase; value: number }>',
      ],
    ],
  ],
  [
    'sl-tab-group',
    [
      [
        'event',
        ['sl-tab-hide', 'sl-tab-show'],
        '{ name: String }',
        'CustomEvent<{ name: string }>',
      ],
    ],
  ],
  [
    'wa-color-picker',
    [
      [
        'event',
        ['wa-after-hide', 'wa-after-show', 'wa-hide', 'wa-show'],
        'CustomEvent',
        'CustomEvent<null>',
      ],
    ],
  ],
  [
    'wa-combobox',
    [
      [
        'event',
        [
          'wa-after-hide',
          'wa-after-show',
          'wa-clear',
          'wa-hide',
          'wa-invalid',
          'wa-show',
        ],
        'Event',
        'CustomEvent<null>',
      ],
    ],
  ],
  [
    'wa-data-grid',
    [
      [
        'event',
        ['wa-cell-click'],
        'Event',
        'CustomEvent<DataGridCellDetail<Row>>',
      ],
      [
        'event',
        ['wa-cell-contextmenu'],
        'CustomEvent',
        'CustomEvent<DataGridCellContextMenuDetail<Row>>',
      ],
      [
        'event',
        ['wa-column-pin'],
        'Event',
        'CustomEvent<DataGridColumnPinDetail>',
      ],
      [
        'event',
        ['wa-column-resize'],
        'Event',
        'CustomEvent<DataGridColumnResizeDetail>',
      ],
      [
        'event',
        ['wa-column-visibility-change'],
        'Event',
        'CustomEvent<DataGridColumnVisibilityDetail>',
      ],
      ['event', ['wa-page-change'], 'Event', 'CustomEvent<DataGridPageDetail>'],
      [
        'event',
        ['wa-row-collapse', 'wa-row-expand'],
        'Event',
        'CustomEvent<DataGridRowDetail<Row>>',
      ],
    ],
  ],
  [
    'wa-date-input',
    [
      [
        'event',
        ['wa-after-hide', 'wa-after-show', 'wa-clear', 'wa-invalid'],
        'Event',
        'CustomEvent<null>',
      ],
      [
        'event',
        ['wa-hide', 'wa-show'],
        'CustomEvent<void>',
        'CustomEvent<null>',
      ],
    ],
  ],
  [
    'wa-dialog',
    [
      [
        'event',
        ['wa-hide'],
        '{ source: Element }',
        'CustomEvent<LyraDialogHideDetail>',
      ],
    ],
  ],
  [
    'wa-drawer',
    [
      [
        'event',
        ['wa-hide'],
        '{ source: Element }',
        'CustomEvent<LyraDialogHideDetail>',
      ],
    ],
  ],
  [
    'wa-file-input',
    [['event', ['wa-invalid'], 'Event', 'CustomEvent<null>']],
  ],
  [
    'wa-include',
    [
      [
        'event',
        ['wa-include-error'],
        '{ status: number }',
        'CustomEvent<LyraIncludeErrorDetail>',
      ],
    ],
  ],
  [
    'wa-known-date',
    [
      [
        'event',
        ['change'],
        'Event',
        'Event & { readonly detail: LyraKnownDateEventDetail }',
      ],
      [
        'event',
        ['input'],
        'InputEvent',
        'InputEvent & { readonly detail: LyraKnownDateEventDetail }',
      ],
    ],
  ],
  [
    'wa-mutation-observer',
    [
      [
        'event',
        ['wa-mutation'],
        '{ mutationList: MutationRecord[] }',
        'CustomEvent< Readonly<{ records: readonly MutationRecord[]; mutationList: readonly MutationRecord[]; }> >',
      ],
    ],
  ],
  [
    'wa-rating',
    [
      [
        'event',
        ['wa-hover'],
        "{ phase: 'start' | 'move' | 'end', value: number }",
        'CustomEvent<{ phase: LyraRatingHoverPhase; value: number }>',
      ],
    ],
  ],
  [
    'wa-tab-group',
    [
      [
        'event',
        ['wa-tab-hide', 'wa-tab-show'],
        '{ name: String }',
        'CustomEvent<{ name: string }>',
      ],
    ],
  ],
  [
    'wa-video-playlist',
    [
      [
        'event',
        ['wa-video-change'],
        'CustomEvent<{ previousIndex: number; currentIndex: number; video: { title: string; poster: string; sources: unknown[]; tracks: unknown[] } }>',
        'CustomEvent<LyraEventDetailSnapshot<LyraVideoPlaylistChangeDetail>>',
      ],
    ],
  ],
]);

// Web Awesome publishes nullable write types for string-backed form attributes. Lyra accepts the
// same null writes as attribute removal while preserving a canonical string read type, so record
// each affected tag/member pair instead of widening editor read metadata or applying a global
// nullable-string rule.
const NULLABLE_STRING_ATTRIBUTE_TYPE_EQUIVALENCE_MEMBERS = new Map([
  ['wa-button', ['name']],
  ['wa-checkbox', ['name', 'value']],
  ['wa-color-picker', ['name', 'value']],
  ['wa-combobox', ['name']],
  ['wa-date-input', ['name']],
  ['wa-input', ['name', 'value']],
  ['wa-known-date', ['name']],
  ['wa-number-input', ['name', 'value']],
  ['wa-otp-input', ['name', 'value']],
  ['wa-popover', ['for']],
  ['wa-radio', ['name']],
  ['wa-radio-group', ['name', 'value']],
  ['wa-rating', ['name']],
  ['wa-select', ['name']],
  ['wa-switch', ['name', 'value']],
  ['wa-textarea', ['name']],
  ['wa-time-input', ['name']],
  ['wa-tooltip', ['for']],
]);

// Web Awesome's shared constructor catalog is published as `Validator[]`. Lyra's clean-room
// equivalent preserves that callable shape while naming the concrete element type in its public
// generic. Keep every mirrored constructor explicit: a newly static member or a changed control
// type must earn its own review instead of inheriting a blanket `Validator` spelling exception.
const STATIC_VALIDATOR_TYPE_EQUIVALENCE_TARGETS = new Map([
  ['wa-button', 'LyraFormValidator<LyraButton>[]'],
  ['wa-checkbox', 'LyraFormValidator<LyraCheckbox>[]'],
  ['wa-color-picker', 'LyraFormValidator<LyraColorPicker>[]'],
  ['wa-input', 'LyraFormValidator<LyraInput>[]'],
  ['wa-known-date', 'LyraFormValidator<LyraKnownDate>[]'],
  ['wa-number-input', 'LyraFormValidator<LyraInput>[]'],
  ['wa-otp-input', 'LyraFormValidator<LyraOtpInput>[]'],
  ['wa-radio', 'LyraFormValidator<LyraRadio>[]'],
  ['wa-radio-group', 'LyraFormValidator<LyraRadioGroup>[]'],
  ['wa-rating', 'LyraFormValidator<LyraRating>[]'],
  ['wa-select', 'LyraFormValidator<LyraSelect>[]'],
  ['wa-slider', 'LyraFormValidator<LyraSlider>[]'],
  ['wa-switch', 'LyraFormValidator<LyraSwitch>[]'],
  ['wa-textarea', 'LyraFormValidator<LyraTextarea>[]'],
  ['wa-time-input', 'LyraFormValidator<LyraTimeInput>[]'],
]);

// Chart.js 4.5.1's `ChartType = keyof ChartTypeRegistry` is the same eight built-in controller
// names exposed by `LyraChartType`. Mirrored typed wrappers keep that writable vocabulary while
// supplying a tag-specific default; only the Lyra-original histogram locks its controller, and it
// has no upstream mapping here. Keep every mirrored tag explicit so new chart families never
// inherit this review.
const CHART_TYPE_EQUIVALENCE_TARGETS = new Map([
  ['wa-bar-chart', 'LyraChartType'],
  ['wa-bubble-chart', 'LyraChartType'],
  ['wa-chart', 'LyraChartType'],
  ['wa-doughnut-chart', 'LyraChartType'],
  ['wa-line-chart', 'LyraChartType'],
  ['wa-pie-chart', 'LyraChartType'],
  ['wa-polar-area-chart', 'LyraChartType'],
  ['wa-radar-chart', 'LyraChartType'],
  ['wa-scatter-chart', 'LyraChartType'],
]);

export function reviewedTypeEquivalences(upstreamTag) {
  const groups = [
    ...(REVIEWED_TYPE_EQUIVALENCE_GROUPS.get(upstreamTag) ?? []),
    ...(REVIEWED_OPAQUE_TYPE_EQUIVALENCE_GROUPS.get(upstreamTag) ?? []),
    ...(REVIEWED_EVENT_TYPE_EQUIVALENCE_GROUPS.get(upstreamTag) ?? []),
  ];
  const nullableStringMembers =
    NULLABLE_STRING_ATTRIBUTE_TYPE_EQUIVALENCE_MEMBERS.get(upstreamTag);
  if (nullableStringMembers) {
    groups.push([
      'attribute',
      nullableStringMembers,
      'string | null',
      'string',
    ]);
  }
  const staticValidatorTarget =
    STATIC_VALIDATOR_TYPE_EQUIVALENCE_TARGETS.get(upstreamTag);
  if (staticValidatorTarget) {
    groups.push([
      'staticProperty',
      ['validators'],
      'Validator[]',
      staticValidatorTarget,
    ]);
  }
  const chartTypeTarget = CHART_TYPE_EQUIVALENCE_TARGETS.get(upstreamTag);
  if (chartTypeTarget) {
    groups.push(['attribute', ['type'], 'ChartType', chartTypeTarget]);
    groups.push([
      'property',
      ['chart'],
      'ChartJS | undefined',
      'LyraChartInstance | undefined',
    ]);
  }
  return groups.flatMap(([memberKind, members, upstream, target]) =>
    members.map((member) =>
      reviewedTypeEquivalence(memberKind, member, upstream, target)
    )
  );
}

// Attribute ownership is observable independently from the member names themselves. The casing
// pairs are analyzer spellings for the same platform IDL member; the live/default pairs preserve
// each form control's already-tested reset authority. Keeping every tag/member triple explicit
// makes a future analyzer or runtime change invalidate the review instead of broadening a rule.
const REVIEWED_ATTRIBUTE_PROPERTY_EQUIVALENCE_GROUPS = new Map([
  ['sl-checkbox', [['checked', 'checked', 'defaultChecked']]],
  ['sl-color-picker', [['value', 'value', 'defaultValue']]],
  [
    'sl-input',
    [
      ['enterkeyhint', 'enterkeyhint', 'enterKeyHint'],
      ['inputmode', 'inputmode', 'inputMode'],
      ['value', 'value', 'defaultValue'],
    ],
  ],
  ['sl-radio-group', [['value', 'value', 'defaultValue']]],
  ['sl-range', [['value', 'value', 'defaultValue']]],
  ['sl-select', [['value', 'defaultValue', 'value']]],
  ['sl-switch', [['checked', 'checked', 'defaultChecked']]],
  [
    'sl-textarea',
    [
      ['enterkeyhint', 'enterkeyhint', 'enterKeyHint'],
      ['inputmode', 'inputmode', 'inputMode'],
      ['value', 'value', 'defaultValue'],
    ],
  ],
  ...['wa-combobox', 'wa-input', 'wa-number-input', 'wa-textarea'].map(
    (tag) => [
      tag,
      [
        ['enterkeyhint', 'enterkeyhint', 'enterKeyHint'],
        ['inputmode', 'inputmode', 'inputMode'],
      ],
    ]
  ),
]);

// Reflection differences are serialized-DOM differences even when the target only adds a mirror.
// These entries are the exact reviewed compatibility set; popup, rating-max, and Shoelace
// skeleton-effect mismatches were fixed at runtime and therefore do not appear.
const REVIEWED_REFLECTION_EQUIVALENCE_GROUPS = new Map([
  [
    'sl-button',
    [
      ['attribute', ['href', 'name', 'value'], false, true],
      ['attribute', ['form'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  [
    'sl-checkbox',
    [
      ['attribute', ['name', 'value'], false, true],
      ['property', ['defaultChecked'], false, true],
    ],
  ],
  [
    'sl-color-picker',
    [
      [
        'attribute',
        ['hoist', 'name', 'no-format-toggle', 'value'],
        false,
        true,
      ],
      ['property', ['defaultValue'], false, true],
    ],
  ],
  [
    'sl-copy-button',
    [['attribute', ['hoist', 'tooltip-placement'], false, true]],
  ],
  ['sl-dropdown', [['attribute', ['hoist'], false, true]]],
  ['sl-include', [['attribute', ['mode', 'src'], false, true]]],
  [
    'sl-input',
    [
      [
        'attribute',
        ['clearable', 'name', 'password-toggle', 'value'],
        false,
        true,
      ],
      ['property', ['defaultValue'], false, true],
    ],
  ],
  ['sl-menu-item', [['attribute', ['type'], false, true]]],
  ['sl-radio', [['attribute', ['value'], false, true]]],
  ['sl-radio-button', [['attribute', ['value'], false, true]]],
  [
    'sl-radio-group',
    [
      ['attribute', ['name'], false, true],
      ['property', ['defaultValue'], false, true],
    ],
  ],
  [
    'sl-range',
    [
      ['attribute', ['name', 'value'], false, true],
      ['property', ['defaultValue'], false, true],
    ],
  ],
  ['sl-select', [['attribute', ['hoist', 'name'], false, true]]],
  ['sl-split-panel', [['attribute', ['primary'], false, true]]],
  [
    'sl-switch',
    [
      ['attribute', ['name', 'value'], false, true],
      ['property', ['defaultChecked'], false, true],
    ],
  ],
  [
    'sl-tab-group',
    [
      [
        'attribute',
        [
          'activation',
          'fixed-scroll-controls',
          'no-scroll-controls',
          'placement',
        ],
        false,
        true,
      ],
    ],
  ],
  ['sl-tag', [['attribute', ['removable'], false, true]]],
  [
    'sl-textarea',
    [
      ['attribute', ['name', 'resize', 'value'], false, true],
      ['property', ['defaultValue'], false, true],
    ],
  ],
  ['sl-tooltip', [['attribute', ['hoist', 'placement'], false, true]]],
  [
    'wa-button',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form', 'required'], false, true],
    ],
  ],
  [
    'wa-checkbox',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  [
    'wa-color-picker',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  [
    'wa-combobox',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  [
    'wa-date-input',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  ['wa-dialog', [['attribute', ['with-footer'], false, true]]],
  ['wa-drawer', [['attribute', ['with-footer'], false, true]]],
  ['wa-dropdown-item', [['attribute', ['checked'], false, true]]],
  [
    'wa-file-input',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  ['wa-include', [['attribute', ['mode', 'src'], false, true]]],
  [
    'wa-input',
    [
      ['attribute', ['disabled', 'password-toggle'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  [
    'wa-known-date',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  [
    'wa-number-input',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  ['wa-option', [['attribute', ['disabled'], false, true]]],
  [
    'wa-otp-input',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  [
    'wa-pagination',
    [
      [
        'attribute',
        ['hide-single-page', 'with-edges', 'with-summary', 'without-nav'],
        false,
        true,
      ],
    ],
  ],
  ['wa-popover', [['attribute', ['for', 'placement'], false, true]]],
  [
    'wa-radio',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form', 'required'], false, true],
    ],
  ],
  ['wa-radio-group', [['property', ['form'], false, true]]],
  [
    'wa-rating',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  [
    'wa-select',
    [
      ['attribute', ['disabled', 'with-clear'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  ['wa-skeleton', [['attribute', ['effect'], true, false]]],
  [
    'wa-slider',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form', 'required'], false, true],
    ],
  ],
  ['wa-split-panel', [['attribute', ['primary', 'snap'], false, true]]],
  [
    'wa-switch',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  [
    'wa-tab-group',
    [
      [
        'attribute',
        ['activation', 'placement', 'without-scroll-controls'],
        false,
        true,
      ],
    ],
  ],
  ['wa-tag', [['attribute', ['with-remove'], false, true]]],
  [
    'wa-textarea',
    [
      ['attribute', ['disabled'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  [
    'wa-time-input',
    [
      ['attribute', ['disabled', 'step'], false, true],
      ['property', ['form'], false, true],
    ],
  ],
  ['wa-tooltip', [['attribute', ['for', 'placement'], false, true]]],
]);

// Token names cannot be prefix-rewritten mechanically. These exact pairs record the reviewed
// Lyra token/fallback that supplies the same hook; `null` means the runtime stylesheet owns the
// effective fallback while the target manifest deliberately does not claim a literal default.
const REVIEWED_CSS_DEFAULT_EQUIVALENCE_GROUPS = new Map([
  [
    'sl-popup',
    [
      [
        '--arrow-color',
        'var(--sl-color-neutral-0)',
        'var(--lr-color-surface-raised)',
      ],
      [
        '--arrow-size',
        '6px',
        'var(--lr-popup-arrow-size,var(--lr-size-0-375rem))',
      ],
    ],
  ],
  [
    'sl-tree',
    [
      [
        '--indent-guide-color',
        'var(--sl-color-neutral-200)',
        'var(--lr-color-border-subtle)',
      ],
      ['--indent-size', 'var(--sl-spacing-medium)', 'var(--lr-space-l)'],
    ],
  ],
  [
    'wa-accordion-item',
    [
      ['--easing', 'var(--wa-transition-easing)', null],
      ['--spacing', 'var(--wa-space-m)', null],
      ['--hide-duration', 'var(--wa-transition-normal)', null],
      ['--show-duration', 'var(--wa-transition-normal)', null],
    ],
  ],
  ['wa-card', [['--spacing', 'var(--wa-space-l)', 'var(--lr-space-m)']]],
  ['wa-carousel', [['--slide-gap', 'var(--wa-space-m)', 'var(--lr-space-m)']]],
  [
    'wa-checkbox-group',
    [['--gap', '0.5em', 'var(--lr-checkbox-group-option-gap)']],
  ],
  [
    'wa-details',
    [
      [
        '--hide-duration',
        'var(--wa-transition-normal)',
        'var(--lr-duration-base)',
      ],
      [
        '--show-duration',
        'var(--wa-transition-normal)',
        'var(--lr-duration-base)',
      ],
    ],
  ],
  [
    'wa-dialog',
    [
      ['--backdrop-filter', 'none', 'var(--lr-dialog-backdrop-filter,none)'],
      ['--hide-duration', 'var(--wa-transition-normal)', null],
      ['--show-duration', 'var(--wa-transition-normal)', null],
    ],
  ],
  [
    'wa-drawer',
    [
      ['--backdrop-filter', 'none', 'var(--lr-dialog-backdrop-filter,none)'],
      ['--hide-duration', 'var(--wa-transition-normal)', null],
      ['--show-duration', 'var(--wa-transition-normal)', null],
    ],
  ],
  [
    'wa-icon',
    [
      ['--animation-delay', 0, '0s'],
      ['--animation-duration', '1s', 'var(--lr-duration-icon)'],
    ],
  ],
  [
    'wa-otp-input',
    [
      [
        '--segment-border-radius',
        'var(--wa-form-control-border-radius)',
        'var(--lr-form-control-radius,var(--lr-radius))',
      ],
      ['--segment-gap', 'var(--wa-space-xs)', 'var(--lr-space-xs)'],
    ],
  ],
  [
    'wa-page',
    [
      ['--aside-width', 'auto', null],
      ['--banner-height', '0px', null],
      ['--header-height', '0px', null],
      ['--main-width', '1fr', null],
      ['--menu-width', 'auto', null],
      ['--subheader-height', '0px', null],
    ],
  ],
  [
    'wa-popover',
    [
      [
        '--arrow-size',
        '0.375rem',
        'var(--lr-overlay-arrow-size,var(--lr-size-0-375rem))',
      ],
      [
        '--hide-duration',
        'var(--wa-transition-fast)',
        'var(--lr-duration-fast)',
      ],
      [
        '--max-width',
        '25rem',
        'var(--lr-overlay-max-inline-size,var(--lr-size-20rem))',
      ],
      [
        '--show-duration',
        'var(--wa-transition-fast)',
        'var(--lr-duration-fast)',
      ],
    ],
  ],
  [
    'wa-popup',
    [
      ['--arrow-color', 'black', 'var(--lr-color-surface-raised)'],
      [
        '--arrow-size',
        '6px',
        'var(--lr-popup-arrow-size,var(--lr-size-0-375rem))',
      ],
      [
        '--hide-duration',
        'var(--wa-transition-fast)',
        'var(--lr-duration-fast)',
      ],
      [
        '--show-duration',
        'var(--wa-transition-fast)',
        'var(--lr-duration-fast)',
      ],
    ],
  ],
  [
    'wa-progress-bar',
    [
      [
        '--indicator-color',
        'var(--wa-color-brand-fill-loud)',
        'var(--lr-progress-indicator-color)',
      ],
      [
        '--track-color',
        'var(--wa-color-neutral-fill-normal)',
        'var(--lr-progress-track-color)',
      ],
      ['--track-height', '1rem', 'var(--lr-progress-track-height)'],
    ],
  ],
  [
    'wa-scroller',
    [
      [
        '--shadow-color',
        'var(--wa-color-surface-default)',
        'var(--lr-color-surface)',
      ],
      ['--shadow-size', '2rem', 'var(--lr-size-2rem)'],
    ],
  ],
  [
    'wa-select',
    [
      [
        '--hide-duration',
        'var(--wa-transition-fast)',
        'var(--lr-transition-fast)',
      ],
      [
        '--show-duration',
        'var(--wa-transition-fast)',
        'var(--lr-transition-fast)',
      ],
      ['--tag-max-size', '10ch', 'var(--lr-size-12rem)'],
    ],
  ],
  [
    'wa-slider',
    [
      ['--marker-height', '0.1875em', null],
      ['--marker-width', '0.1875em', null],
      ['--thumb-height', '1.25em', null],
      ['--thumb-width', '1.25em', null],
      ['--track-size', '0.75em', null],
    ],
  ],
  [
    'wa-time-input',
    [
      [
        '--column-item-height',
        '2.25em',
        'calc(var(--lr-size-1em)*2.25)',
      ],
      ['--column-width', '3em', 'calc(var(--lr-size-1em)*3)'],
      [
        '--hide-duration',
        'var(--wa-transition-fast)',
        'var(--lr-duration-fast)',
      ],
      [
        '--show-duration',
        'var(--wa-transition-fast)',
        'var(--lr-duration-fast)',
      ],
    ],
  ],
  [
    'wa-toast',
    [
      ['--gap', 'var(--wa-space-s)', null],
      ['--width', '28rem', null],
    ],
  ],
  [
    'wa-toast-item',
    [
      ['--hide-duration', 'var(--wa-transition-normal)', null],
      ['--show-duration', 'var(--wa-transition-normal)', null],
    ],
  ],
  [
    'wa-tree',
    [
      [
        '--indent-guide-color',
        'var(--wa-color-surface-border)',
        'var(--lr-color-border-subtle)',
      ],
      ['--indent-size', 'var(--wa-space-m)', 'var(--lr-space-l)'],
    ],
  ],
  [
    'wa-tree-item',
    [
      [
        '--hide-duration',
        'var(--wa-transition-normal)',
        'var(--lr-duration-base)',
      ],
      [
        '--show-duration',
        'var(--wa-transition-normal)',
        'var(--lr-duration-base)',
      ],
    ],
  ],
]);

// Some pinned upstream manifests expose a CSS custom property without recording its effective
// default, while Lyra deliberately publishes the fallback in CEM/editor data. Presence is still
// observable metadata, so every target-only default is reviewed here by exact tag, member, and
// value instead of being treated as a generally additive difference.
const CHART_TARGET_CSS_DEFAULT_ADDITIONS = [
  ...Array.from({ length: 6 }, (_, index) => [
    `--border-color-${index + 1}`,
    `var(--lr-color-chart-${index + 1})`,
  ]),
  ['--border-radius', 'var(--lr-radius)'],
  ['--border-width', 'var(--lr-border-width-thin)'],
  ...Array.from({ length: 6 }, (_, index) => [
    `--fill-color-${index + 1}`,
    `var(--lr-color-chart-${index + 1})`,
  ]),
  ['--grid-border-width', 'var(--lr-border-width-thin)'],
  ['--grid-color', 'var(--lr-chart-grid-color)'],
  ['--line-border-width', 'var(--lr-border-width-medium)'],
  ['--point-radius', 'var(--lr-space-2xs)'],
];

const REVIEWED_TARGET_CSS_DEFAULT_ADDITION_GROUPS = [
  [['sl-avatar', 'wa-avatar'], [['--size', 'var(--lr-avatar-size)']]],
  [
    ['sl-card'],
    [
      ['--border-color', 'var(--lr-color-border-subtle)'],
      // The optional container hook falls back to the existing generic radius when unset.
      ['--border-radius', 'var(--lr-radius-container)'],
      ['--border-width', 'var(--lr-border-width-thin)'],
      ['--padding', 'var(--spacing,var(--lr-space-m))'],
    ],
  ],
  [['sl-carousel'], [['--slide-gap', 'var(--lr-space-m)']]],
  [
    ['sl-copy-button'],
    [
      ['--error-color', 'var(--lr-color-danger)'],
      ['--success-color', 'var(--lr-color-success)'],
    ],
  ],
  [['sl-dialog'], [['--width', 'var(--lr-dialog-width,auto)']]],
  [
    ['wa-dialog'],
    [
      ['--spacing', 'var(--lr-dialog-spacing,var(--lr-space-l))'],
      ['--width', 'var(--lr-dialog-width,auto)'],
    ],
  ],
  [
    ['sl-divider', 'wa-divider'],
    [
      ['--color', 'var(--lr-color-border-subtle)'],
      ['--spacing', 0],
      ['--width', 'var(--lr-border-width-thin)'],
    ],
  ],
  [
    ['sl-image-comparer', 'wa-comparison'],
    [
      ['--divider-width', 'var(--lr-size-1px)'],
      ['--handle-size', 'var(--lr-icon-button-size)'],
    ],
  ],
  [
    ['sl-progress-bar'],
    [
      ['--height', 'var(--lr-progress-track-height)'],
      ['--indicator-color', 'var(--lr-progress-indicator-color)'],
      ['--label-color', 'var(--lr-progress-label-color)'],
      ['--track-color', 'var(--lr-progress-track-color)'],
    ],
  ],
  [
    ['sl-progress-ring', 'wa-progress-ring'],
    [
      ['--indicator-color', 'var(--lr-progress-ring-indicator-color)'],
      [
        '--indicator-transition-duration',
        'var(--lr-progress-ring-indicator-transition-duration)',
      ],
      ['--indicator-width', 'var(--lr-progress-ring-indicator-width)'],
      ['--size', 'var(--lr-progress-ring-size)'],
      ['--track-color', 'var(--lr-progress-ring-track-color)'],
      ['--track-width', 'var(--lr-progress-ring-track-width)'],
    ],
  ],
  [
    ['sl-rating', 'wa-rating'],
    [
      [
        '--symbol-color-active',
        'var(--lr-rating-fill,var(--lr-color-warning))',
      ],
      ['--symbol-color', 'var(--lr-rating-empty-color,var(--lr-color-border))'],
      ['--symbol-spacing', 'var(--lr-space-xs)'],
    ],
  ],
  [['sl-skeleton'], [['--border-radius', 'var(--lr-skeleton-border-radius)']]],
  [
    ['sl-skeleton', 'wa-skeleton'],
    [
      ['--color', 'var(--lr-skeleton-color)'],
      ['--sheen-color', 'var(--lr-skeleton-sheen-color)'],
    ],
  ],
  [
    ['sl-spinner', 'wa-spinner'],
    [
      ['--indicator-color', 'var(--lr-color-brand)'],
      ['--speed', 'var(--lr-spinner-duration)'],
      ['--track-color', 'var(--lr-color-brand-quiet)'],
      ['--track-width', 'var(--lr-spinner-track-width)'],
    ],
  ],
  [
    ['sl-switch', 'wa-switch'],
    [
      ['--height', 'var(--lr-switch-track-block-size)'],
      [
        '--thumb-size',
        'calc(var(--height, var(--lr-switch-track-block-size)) - (var(--lr-switch-thumb-offset) * 2))',
      ],
      ['--width', 'var(--lr-switch-track-inline-size)'],
    ],
  ],
  [['sl-tab-panel', 'wa-tab-panel'], [['--padding', 0]]],
  [
    ['sl-tooltip'],
    [
      ['--hide-delay', '0ms'],
      ['--show-delay', '150ms'],
    ],
  ],
  [
    ['sl-tooltip', 'wa-tooltip'],
    [['--max-width', 'var(--lr-tooltip-max-inline-size,var(--lr-size-20rem))']],
  ],
  [['wa-badge'], [['--pulse-color', 'var(--lr-badge-pulse-color)']]],
  [[...CHART_REVIEW_EVIDENCE.keys()], CHART_TARGET_CSS_DEFAULT_ADDITIONS],
  [
    ['wa-checkbox'],
    [
      ['--checked-icon-color', 'currentColor'],
      ['--checked-icon-scale', 1],
    ],
  ],
  [
    ['wa-combobox'],
    [
      ['--hide-duration', 'var(--lr-transition-fast)'],
      ['--show-duration', 'var(--lr-transition-fast)'],
      ['--tag-max-size', 'var(--lr-size-5rem)'],
    ],
  ],
  [
    ['wa-data-grid'],
    [
      ['--accent-color', 'var(--lr-color-brand)'],
      ['--background-color', 'var(--lr-color-surface)'],
      ['--border-color', 'var(--lr-color-border)'],
      ['--border-radius', 'var(--lr-radius)'],
      ['--border-width', 'var(--lr-border-width-thin)'],
      ['--cell-padding', 'var(--lr-space-m)'],
      [
        '--focus-ring',
        'var(--lr-focus-ring-width) solid var(--lr-focus-ring-color)',
      ],
      ['--header-background', 'var(--lr-color-surface-raised)'],
      ['--header-row-height', 'var(--lr-size-3-5rem)'],
      ['--header-text-color', 'var(--lr-color-text)'],
      ['--indent-size', 'var(--lr-size-1-25rem)'],
      ['--max-height', 'var(--lr-size-30rem)'],
      ['--row-height', 'var(--lr-size-3-5rem)'],
      ['--selected-background', 'var(--lr-color-brand-quiet)'],
      ['--stripe-background', 'var(--lr-color-surface-raised)'],
      ['--text-color', 'var(--lr-color-text)'],
      ['--transition-duration', 'var(--lr-duration-fast)'],
    ],
  ],
  [
    ['wa-date-input', 'wa-dropdown'],
    [
      ['--hide-duration', 'var(--lr-transition-fast)'],
      ['--show-duration', 'var(--lr-transition-fast)'],
    ],
  ],
  [
    ['wa-drawer'],
    [['--spacing', 'var(--lr-dialog-spacing,var(--lr-space-l))']],
  ],
  [
    ['wa-icon'],
    [
      ['--animation-timing', 'var(--lr-easing-emphasized)'],
      ['--beat-fade-opacity', 0.4],
      ['--beat-fade-scale', 1.25],
      ['--beat-scale', 1.25],
      ['--bounce-anticipation', 0],
      ['--bounce-height', 'calc(var(--lr-size-0-5em)*-1)'],
      ['--bounce-jump-scale-x', 0.95],
      ['--bounce-jump-scale-y', 1.05],
      ['--bounce-land-scale-x', 1.08],
      ['--bounce-land-scale-y', 0.92],
      ['--bounce-rebound', 'calc(var(--lr-size-1em)*-0.1)'],
      ['--bounce-start-scale-x', 1],
      ['--bounce-start-scale-y', 1],
      ['--buzz-distance', 'calc(var(--lr-size-1em)*0.12)'],
      ['--fade-opacity', 0.4],
      ['--flip-angle', '180deg'],
      ['--flip-anticipation-scale', 0.9],
      ['--flip-overshoot', '0deg'],
      ['--flip-x', 0],
      ['--flip-y', 1],
      ['--flip-z', 0],
      ['--float-drift', 0],
      ['--float-height', 'calc(var(--lr-size-0-5em)*-1)'],
      ['--float-squash-x', 1.04],
      ['--float-squash-y', 0.96],
      ['--float-stretch-x', 0.96],
      ['--float-stretch-y', 1.04],
      ['--float-tilt', '4deg'],
      ['--jello-scale-x', 1.18],
      ['--jello-scale-y', 0.82],
      ['--swing-angle', '15deg'],
      ['--wag-angle', '12deg'],
    ],
  ],
  [['wa-option'], [['--current-text-color', 'var(--lr-color-text)']]],
  [['wa-popup'], [['--popup-border-width', 'var(--lr-border-width-thin)']]],
  [
    ['wa-radio'],
    [
      ['--checked-icon-color', 'var(--lr-radio-checked-dot-color)'],
      ['--checked-icon-scale', 1],
    ],
  ],
  [
    ['wa-random-content'],
    [
      ['--animation-duration', '300ms'],
      ['--animation-easing', 'ease'],
      ['--animation-translate', 'var(--lr-size-0-5em)'],
    ],
  ],
  [
    ['wa-sparkline'],
    [
      ['--fill-color', 'var(--lr-color-brand-quiet)'],
      ['--line-color', 'var(--lr-color-brand)'],
      ['--line-width', 'var(--lr-border-width-medium)'],
    ],
  ],
  [
    ['wa-video'],
    [
      ['--controls-background', 'var(--lr-color-overlay-strong)'],
      ['--controls-color', 'var(--lr-color-on-strong-overlay)'],
      ['--poster-play-button-background', 'var(--lr-color-surface-overlay)'],
    ],
  ],
];

const REVIEWED_TARGET_CSS_DEFAULT_ADDITIONS = new Map();
for (const [tags, defaults] of REVIEWED_TARGET_CSS_DEFAULT_ADDITION_GROUPS) {
  for (const tag of tags) {
    REVIEWED_TARGET_CSS_DEFAULT_ADDITIONS.set(tag, [
      ...(REVIEWED_TARGET_CSS_DEFAULT_ADDITIONS.get(tag) ?? []),
      ...defaults,
    ]);
  }
}

// The target-side records added for file-input and QR are centralized component-metadata policy.
// Other upstream-only compatibility notices remain explicit comparison reviews until the target
// adopts the same removal policy; generic "part named after the component" prose intentionally
// has no guessed replacement. Shoelace does not deprecate QR aliases, so its target additions are
// recorded separately from Web Awesome. Web Awesome's generic "part named after the component"
// prose intentionally does not guess a replacement, so the QR base-part replacement remains an
// exact reviewed equivalence even though both sides describe the same migration.
const REVIEWED_DEPRECATION_EQUIVALENCE_GROUPS = new Map([
  [
    'sl-qr-code',
    [
      ['parts', ['base'], false, null, true, 'qr-code'],
    ],
  ],
  [
    'wa-qr-code',
    [
      ['parts', ['base'], true, null, true, 'qr-code'],
      ['attributes', ['background'], true, 'background', false, null],
      ['attributes', ['fill'], true, 'color', false, null],
      ['properties', ['background'], true, 'background', false, null],
      ['properties', ['fill'], true, 'color', false, null],
    ],
  ],
  ...[
    'wa-badge',
    'wa-breadcrumb',
    'wa-button',
    'wa-button-group',
    'wa-carousel',
    'wa-checkbox',
    'wa-color-picker',
    'wa-comparison',
    'wa-details',
    'wa-dropdown',
    'wa-known-date',
    'wa-page',
    'wa-pagination',
    'wa-progress-bar',
    'wa-progress-ring',
    'wa-rating',
    'wa-spinner',
    'wa-switch',
    'wa-tab',
    'wa-tab-group',
    'wa-tab-panel',
    'wa-tag',
    'wa-tooltip',
    'wa-tree',
    'wa-tree-item',
  ].map((tag) => [tag, [['parts', ['base'], true, null, false, null]]]),
  ['wa-accordion-item', [['parts', ['base'], true, null, true, 'accordion-item']]],
  ...['wa-input', 'wa-number-input', 'wa-textarea', 'wa-time-input'].map(
    (tag) => [
      tag,
      [
        ['parts', ['base'], true, null, false, null],
        ['parts', ['label'], true, 'form-control-label', false, null],
      ],
    ]
  ),
  ...['wa-combobox', 'wa-select'].map((tag) => [
    tag,
    [['parts', ['label'], true, 'form-control-label', false, null]],
  ]),
  ['wa-video', [['parts', ['base'], true, 'video-wrapper', false, null]]],
  [
    'wa-date-input',
    [
      ['parts', ['base'], true, 'date-input', false, null],
      ['parts', ['label'], true, 'form-control-label', false, null],
    ],
  ],
  ['wa-date-picker', [['parts', ['base'], true, 'date-picker', false, null]]],
]);

const REVIEWED_MAPPING_NORMALIZATIONS = new Map([
  [
    'sl-copy-button',
    {
      defaultEquivalences: [reviewedPropertyDefaultEquivalence('feedbackDuration', 1000, 1500)],
      derivedDefaultEquivalences: [
        { memberKind: 'attribute', member: 'copy-label', upstream: '', target: 'localized copy label' },
        { memberKind: 'attribute', member: 'success-label', upstream: '', target: 'localized success label' },
        { memberKind: 'attribute', member: 'error-label', upstream: '', target: 'localized error label' },
        { memberKind: 'property', member: 'copyLabel', upstream: '', target: 'localized copy label' },
        { memberKind: 'property', member: 'successLabel', upstream: '', target: 'localized success label' },
        { memberKind: 'property', member: 'errorLabel', upstream: '', target: 'localized error label' },
      ],
    },
  ],
  [
    'sl-button',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('href', '', 'undefined'),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
        reviewedDefaultEquivalence('variant', 'default', 'neutral'),
      ],
      derivedDefaultEquivalences: [
        {
          memberKind: 'attribute',
          member: 'rel',
          upstream: 'noreferrer noopener',
          target: 'noopener noreferrer',
        },
      ],
    },
  ],
  [
    'sl-checkbox',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
    },
  ],
  [
    'sl-color-picker',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
      unknownMethodReturnTypes: [
        { method: 'blur' },
        { method: 'checkValidity' },
        { method: 'focus' },
        { method: 'getFormattedValue' },
        { method: 'reportValidity' },
        { method: 'setCustomValidity' },
      ],
    },
  ],
  [
    'sl-dialog',
    {
      defaultEquivalences: [
        reviewedPropertyDefaultEquivalence(
          'modal',
          'new Modal(this)',
          LYRA_MODAL_CONTROLLER_DEFAULT
        ),
      ],
    },
  ],
  [
    'sl-drawer',
    {
      defaultEquivalences: [
        reviewedPropertyDefaultEquivalence(
          'modal',
          'new Modal(this)',
          LYRA_MODAL_CONTROLLER_DEFAULT
        ),
      ],
    },
  ],
  [
    'sl-input',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
    },
  ],
  [
    'sl-radio',
    {
      defaultEquivalences: [reviewedDefaultEquivalence('size', 'medium', 'm')],
    },
  ],
  [
    'sl-radio-button',
    {
      defaultEquivalences: [reviewedDefaultEquivalence('size', 'medium', 'm')],
    },
  ],
  [
    'sl-radio-group',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
    },
  ],
  [
    'sl-popup',
    {
      inferredAttributeSuppressions: [
        {
          attribute: 'autoSizeBoundary',
          property: 'autoSizeBoundary',
          explicit: true,
        },
        { attribute: 'flipBoundary', property: 'flipBoundary', explicit: true },
        {
          attribute: 'shiftBoundary',
          property: 'shiftBoundary',
          explicit: true,
        },
      ],
    },
  ],
  [
    'sl-range',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('name', '', null),
      ],
    },
  ],
  [
    'sl-rating',
    {
      inferredAttributeSuppressions: [
        { attribute: 'getSymbol', property: 'getSymbol', explicit: true },
      ],
    },
  ],
  [
    'sl-select',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
      inferredAttributeSuppressions: [
        { attribute: 'getTag', property: 'getTag', explicit: true },
      ],
    },
  ],
  [
    'sl-switch',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
    },
  ],
  [
    'sl-tag',
    {
      defaultEquivalences: [reviewedDefaultEquivalence('size', 'medium', 'm')],
    },
  ],
  [
    'sl-textarea',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
    },
  ],
  [
    'wa-button',
    { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] },
  ],
  [
    'wa-checkbox',
    { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] },
  ],
  [
    'wa-color-picker',
    { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] },
  ],
  [
    'wa-combobox',
    {
      // `wa-invalid` is `preventDefault()`-able on `<lr-combobox>` because vetoing it also cancels
      // the native `invalid` event behind it, which is what suppresses the browser's own validation
      // bubble. `lr-show` is cancelable on every path. `lr-hide` is cancelable while connected, but
      // the disconnection cleanup path is not because the already-removed popup cannot stay open.
      cancelabilityEquivalences: [
        reviewedCancelabilityEquivalence('wa-hide', 'never', 'conditional'),
        reviewedCancelabilityEquivalence('wa-invalid', 'never', 'always'),
        reviewedCancelabilityEquivalence('wa-show', 'never', 'always'),
      ],
    },
  ],
  [
    'wa-copy-button',
    {
      defaultEquivalences: [reviewedPropertyDefaultEquivalence('feedbackDuration', 1000, 1500)],
      derivedDefaultEquivalences: [
        { memberKind: 'attribute', member: 'copy-label', upstream: '', target: 'localized copy label' },
        { memberKind: 'attribute', member: 'success-label', upstream: '', target: 'localized success label' },
        { memberKind: 'attribute', member: 'error-label', upstream: '', target: 'localized error label' },
        { memberKind: 'property', member: 'copyLabel', upstream: '', target: 'localized copy label' },
        { memberKind: 'property', member: 'successLabel', upstream: '', target: 'localized success label' },
        { memberKind: 'property', member: 'errorLabel', upstream: '', target: 'localized error label' },
      ],
    },
  ],
  [
    'wa-date-input',
    {
      cancelabilityEquivalences: [
        reviewedCancelabilityEquivalence('wa-invalid', 'never', 'always'),
      ],
    },
  ],
  [
    'wa-data-grid',
    {
      methodParameterTypeEquivalences: [
        // `DataGridPinSide` is `'left' | 'right' | 'start' | 'end' | false` -- a strict SUPERSET of
        // upstream's `'left' | 'right' | false`. `'start'`/`'end'` are additive spelling aliases for
        // the two directions `'left'`/`'right'` already name (the pinning CSS is logical, so both
        // spellings mirror identically under `dir="rtl"`), so every call a `wa-data-grid` consumer
        // can write today remains valid verbatim after the prefix substitution. Reviewed as
        // parameter widening, which is safe for callers; a narrowing would not be.
        reviewedMethodParameterTypeEquivalence(
          'pinColumn',
          'side',
          "'left' | 'right' | false",
          'DataGridPinSide'
        ),
        reviewedMethodParameterTypeEquivalence(
          'copySelectedRows',
          'options',
          DATA_GRID_OPTION_TYPE,
          'DataGridCopyOptions'
        ),
        reviewedMethodParameterTypeEquivalence(
          'exportDataAsCsv',
          'options',
          DATA_GRID_CSV_OPTION_TYPE,
          'DataGridExportOptions'
        ),
        reviewedMethodParameterTypeEquivalence(
          'getDataAsCsv',
          'options',
          DATA_GRID_GET_CSV_OPTION_TYPE,
          'DataGridCsvOptions'
        ),
        reviewedMethodParameterTypeEquivalence(
          'scrollToIndex',
          'options',
          DATA_GRID_SCROLL_OPTION_TYPE,
          'DataGridScrollOptions'
        ),
      ],
    },
  ],
  [
    'wa-dialog',
    {
      cancelabilityPathAdditions: [
        reviewedCancelabilityPathAddition(
          'wa-hide',
          'an open dialog removed from the document, where the close has already happened and no ' +
            'veto could undo it; every dismissal path the upstream tag documents stays cancelable'
        ),
      ],
    },
  ],
  [
    'wa-file-input',
    {
      derivedDefaultEquivalences: [
        {
          memberKind: 'attribute',
          member: 'label',
          upstream: '',
          target: 'unset: no form-control label, rendered identically to the empty upstream default',
        },
        {
          memberKind: 'property',
          member: 'label',
          upstream: '',
          target: 'unset: no form-control label, rendered identically to the empty upstream default',
        },
      ],
      cancelabilityEquivalences: [
        reviewedCancelabilityEquivalence('wa-invalid', 'never', 'always'),
      ],
    },
  ],
  [
    'wa-input',
    { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] },
  ],
  [
    'wa-number-input',
    { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] },
  ],
  [
    'wa-otp-input',
    { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] },
  ],
  [
    'wa-popover',
    { defaultEquivalences: [reviewedDefaultEquivalence('for', null, '')] },
  ],
  [
    'wa-popup',
    {
      inferredAttributeSuppressions: [
        {
          attribute: 'autoSizeBoundary',
          property: 'autoSizeBoundary',
          explicit: true,
        },
        { attribute: 'flipBoundary', property: 'flipBoundary', explicit: true },
        {
          attribute: 'shiftBoundary',
          property: 'shiftBoundary',
          explicit: true,
        },
      ],
    },
  ],
  [
    'wa-radio',
    { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] },
  ],
  [
    'wa-radio-group',
    { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] },
  ],
  [
    'wa-rating',
    {
      defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')],
      inferredAttributeSuppressions: [
        { attribute: 'getSymbol', property: 'getSymbol', explicit: true },
      ],
    },
  ],
  [
    'wa-switch',
    { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] },
  ],
  [
    'wa-textarea',
    { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] },
  ],
  [
    'wa-tooltip',
    { defaultEquivalences: [reviewedDefaultEquivalence('for', null, '')] },
  ],
]);

export function reviewedMappingNormalizations(upstreamTag) {
  const normalizations = normalizedNormalizations(
    REVIEWED_MAPPING_NORMALIZATIONS.get(upstreamTag)
  );
  normalizations.typeEquivalences.push(
    ...reviewedTypeEquivalences(upstreamTag)
  );
  normalizations.attributePropertyEquivalences.push(
    ...(
      REVIEWED_ATTRIBUTE_PROPERTY_EQUIVALENCE_GROUPS.get(upstreamTag) ?? []
    ).map(([attribute, upstream, target]) =>
      reviewedAttributePropertyEquivalence(attribute, upstream, target)
    )
  );
  normalizations.reflectionEquivalences.push(
    ...(REVIEWED_REFLECTION_EQUIVALENCE_GROUPS.get(upstreamTag) ?? []).flatMap(
      ([memberKind, members, upstream, target]) =>
        members.map((member) =>
          reviewedReflectionEquivalence(memberKind, member, upstream, target)
        )
    )
  );
  normalizations.cssDefaultEquivalences.push(
    ...(REVIEWED_CSS_DEFAULT_EQUIVALENCE_GROUPS.get(upstreamTag) ?? []).map(
      ([member, upstream, target]) =>
        reviewedCssDefaultEquivalence(member, upstream, target)
    ),
    ...(REVIEWED_TARGET_CSS_DEFAULT_ADDITIONS.get(upstreamTag) ?? []).map(
      ([member, target]) => reviewedCssDefaultEquivalence(member, null, target)
    )
  );
  normalizations.deprecationEquivalences.push(
    ...(REVIEWED_DEPRECATION_EQUIVALENCE_GROUPS.get(upstreamTag) ?? []).flatMap(
      ([
        section,
        members,
        upstreamDeprecated,
        upstreamReplacement,
        targetDeprecated,
        targetReplacement,
      ]) =>
        members.map((member) =>
          reviewedDeprecationEquivalence(
            section,
            member,
            upstreamDeprecated,
            upstreamReplacement,
            targetDeprecated,
            targetReplacement
          )
        )
    )
  );
  return normalizations;
}

export function hasReviewedMappingNormalizations(upstreamTag) {
  return (
    REVIEWED_MAPPING_NORMALIZATIONS.has(upstreamTag) ||
    REVIEWED_ATTRIBUTE_PROPERTY_EQUIVALENCE_GROUPS.has(upstreamTag) ||
    REVIEWED_REFLECTION_EQUIVALENCE_GROUPS.has(upstreamTag) ||
    REVIEWED_CSS_DEFAULT_EQUIVALENCE_GROUPS.has(upstreamTag) ||
    REVIEWED_TARGET_CSS_DEFAULT_ADDITIONS.has(upstreamTag) ||
    REVIEWED_DEPRECATION_EQUIVALENCE_GROUPS.has(upstreamTag)
  );
}

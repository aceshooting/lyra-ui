import { ACCESSIBILITY_PROFILE_SECTIONS, compareAccessibilityProfiles } from '../component-inventory.mjs';

function accessibilityProfile(description, behaviors = {}) {
  return Object.freeze({
    description,
    ...Object.fromEntries(
      ACCESSIBILITY_PROFILE_SECTIONS.map((section) => [
        section,
        [...(behaviors[section] ?? [])].sort(),
      ])
    ),
  });
}

const REVIEWED_ACCESSIBILITY_PROFILES = Object.freeze({
  'no-tag-owned-behavior': accessibilityProfile(
    'No tag-owned semantic, naming, keyboard, focus, state, announcement, or motion behavior.'
  ),
  'transparent-content': accessibilityProfile(
    'A transparent wrapper that preserves the semantics and focus behavior of authored descendants.',
    { semantics: ['transparent-content'] }
  ),
  'document-content': accessibilityProfile(
    'Rendered document content preserves authored headings, landmarks, links, and reading order.',
    { semantics: ['document', 'transparent-content'] }
  ),
  'text-content': accessibilityProfile(
    'The rendered value remains ordinary readable text.',
    {
      semantics: ['text-content'],
    }
  ),
  'animation-content': accessibilityProfile(
    'Animation leaves authored content semantics intact and suppresses nonessential motion when requested.',
    {
      semantics: ['transparent-content'],
      motion: ['respects-reduced-motion', 'suppresses-animation'],
    }
  ),
  alert: accessibilityProfile(
    'An assertive status message is named from its content.',
    {
      semantics: ['alert'],
      naming: ['content-derived'],
      announcements: ['live-alert'],
    }
  ),
  callout: accessibilityProfile(
    'A callout preserves the semantics and reading order of its authored content.',
    {
      semantics: ['transparent-content'],
    }
  ),
  'reactive-callout': accessibilityProfile(
    'Callout content remains readable, gains an optional authored group name, and announces only post-mount content changes.',
    {
      semantics: ['group', 'transparent-content'],
      naming: ['content-or-author-label'],
      announcements: ['content-change', 'live-alert', 'live-status'],
    }
  ),
  'animated-image': accessibilityProfile(
    'A named image exposes an operable playback control and reduced-motion behavior.',
    {
      semantics: ['button', 'img'],
      naming: ['alternative-text', 'control-labels-localized'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['paused'],
      motion: [
        'respects-reduced-motion',
        'stops-autoplay',
        'user-pause-control',
      ],
    }
  ),
  'named-image': accessibilityProfile(
    'Meaningful image content requires an authored accessible alternative.',
    {
      semantics: ['img'],
      naming: ['alternative-text', 'author-label-required'],
    }
  ),
  navigation: accessibilityProfile(
    'A named navigation landmark exposes the current destination.',
    {
      semantics: ['navigation'],
      naming: ['content-or-author-label', 'current-page'],
      states: ['current'],
    }
  ),
  link: accessibilityProfile(
    'A named link uses native keyboard activation and focus behavior.',
    {
      semantics: ['link'],
      naming: ['content-or-author-label'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['disabled'],
    }
  ),
  button: accessibilityProfile(
    'A named button uses native activation and exposes disabled and pressed state.',
    {
      semantics: ['button'],
      naming: ['content-or-author-label'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['disabled', 'pressed'],
    }
  ),
  'button-group': accessibilityProfile(
    'Related buttons share an author-provided group name.',
    {
      semantics: ['group'],
      naming: ['author-label-required'],
    }
  ),
  carousel: accessibilityProfile(
    'A named carousel provides one keyboard navigation stop, slide state, and change announcements.',
    {
      semantics: ['group'],
      naming: ['author-label-required', 'control-labels-localized'],
      keyboard: ['arrow-navigation', 'home-end-navigation'],
      focus: ['focus-preserved', 'roving-focus'],
      states: ['current', 'disabled', 'selected'],
      announcements: ['selection-change'],
      motion: ['respects-reduced-motion', 'stops-autoplay'],
    }
  ),
  'carousel-item': accessibilityProfile(
    'A carousel item exposes its selected position within the authored slide set.',
    {
      semantics: ['group'],
      naming: ['content-derived'],
      states: ['selected'],
    }
  ),
  checkbox: accessibilityProfile(
    'A labelled checkbox exposes checked, required, invalid, and disabled state.',
    {
      semantics: ['checkbox'],
      naming: ['visible-or-author-label'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['checked', 'disabled', 'invalid', 'required'],
      announcements: ['validation-message'],
    }
  ),
  'checkbox-group': accessibilityProfile(
    'Independent checkboxes share a labelled and described grouping.',
    {
      semantics: ['group'],
      naming: ['visible-or-author-label'],
      states: ['disabled', 'invalid', 'required'],
      announcements: ['validation-message'],
    }
  ),
  'color-picker': accessibilityProfile(
    'A labelled color field and palette expose editable value, swatch names, selection, and dismissal behavior.',
    {
      semantics: ['button', 'listbox', 'textbox'],
      naming: [
        'control-labels-localized',
        'value-text',
        'visible-or-author-label',
      ],
      keyboard: ['arrow-navigation', 'escape-dismiss', 'native-editing'],
      focus: ['focus-return', 'native-focus', 'roving-focus'],
      states: ['disabled', 'expanded', 'invalid', 'required', 'selected'],
      announcements: ['validation-message'],
    }
  ),
  'copy-button': accessibilityProfile(
    'A named copy action announces success or failure after activation.',
    {
      semantics: ['button'],
      naming: ['author-label-required', 'control-labels-localized'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['disabled'],
      announcements: ['copy-result'],
    }
  ),
  disclosure: accessibilityProfile(
    'A heading-aligned disclosure button exposes expanded and disabled state.',
    {
      semantics: ['button'],
      naming: ['content-derived', 'heading-level'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['disabled', 'expanded'],
    }
  ),
  accordion: accessibilityProfile(
    'An accordion coordinates disclosure headings with roving arrow-key navigation.',
    {
      semantics: ['group'],
      naming: ['heading-level'],
      keyboard: [
        'arrow-navigation',
        'home-end-navigation',
        'native-activation',
      ],
      focus: ['roving-focus'],
      states: ['disabled', 'expanded'],
    }
  ),
  modal: accessibilityProfile(
    'A named modal overlay traps initial focus, dismisses with Escape, and returns focus.',
    {
      semantics: ['dialog'],
      naming: ['visible-or-author-label'],
      keyboard: ['escape-dismiss', 'tab-cycle'],
      focus: ['focus-return', 'focus-trap', 'initial-focus'],
      states: ['modal'],
    }
  ),
  separator: accessibilityProfile(
    'A separator exposes its orientation without adding a keyboard stop.',
    {
      semantics: ['separator'],
      states: ['orientation'],
    }
  ),
  'menu-button': accessibilityProfile(
    'A named trigger exposes menu expansion and returns focus after dismissal.',
    {
      semantics: ['button', 'menu'],
      naming: ['content-or-author-label'],
      keyboard: ['arrow-navigation', 'escape-dismiss', 'native-activation'],
      focus: ['focus-return', 'native-focus'],
      states: ['disabled', 'expanded'],
    }
  ),
  icon: accessibilityProfile(
    'Unlabelled icons are presentational; meaningful icons use an authored alternative.',
    {
      semantics: ['img', 'presentation'],
      naming: ['alternative-text'],
      motion: ['respects-reduced-motion', 'suppresses-animation'],
    }
  ),
  'image-comparison': accessibilityProfile(
    'A named adjustable divider exposes its numeric position.',
    {
      semantics: ['slider'],
      naming: ['author-label-required', 'value-text'],
      keyboard: ['range-adjustment'],
      focus: ['native-focus'],
      states: ['disabled', 'orientation', 'value-range'],
    }
  ),
  'text-input': accessibilityProfile(
    'A labelled native-like text field exposes editing and form validity.',
    {
      semantics: ['textbox'],
      naming: ['visible-or-author-label'],
      keyboard: ['native-editing'],
      focus: ['native-focus'],
      states: ['disabled', 'invalid', 'readonly', 'required'],
      announcements: ['validation-message'],
    }
  ),
  textarea: accessibilityProfile(
    'A labelled multiline field exposes native editing, validity, and optional count updates.',
    {
      semantics: ['textbox'],
      naming: ['visible-or-author-label'],
      keyboard: ['native-editing'],
      focus: ['native-focus'],
      states: ['disabled', 'invalid', 'readonly', 'required'],
      announcements: ['character-count', 'validation-message'],
    }
  ),
  menu: accessibilityProfile(
    'A menu uses one roving tab stop with arrow, Home/End, and typeahead navigation.',
    {
      semantics: ['menu'],
      keyboard: [
        'arrow-navigation',
        'escape-dismiss',
        'home-end-navigation',
        'typeahead',
      ],
      focus: ['roving-focus'],
      states: ['orientation'],
    }
  ),
  menuitem: accessibilityProfile(
    'A named menu item exposes disabled, checked, selected, and submenu state.',
    {
      semantics: ['menuitem'],
      naming: ['content-derived'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['checked', 'disabled', 'expanded', 'selected'],
    }
  ),
  'group-label': accessibilityProfile(
    'Text labels an adjacent authored group without becoming a control.',
    {
      semantics: ['presentation', 'text-content'],
      naming: ['content-derived'],
    }
  ),
  option: accessibilityProfile(
    'A content-named option exposes disabled and selected state.',
    {
      semantics: ['option'],
      naming: ['content-derived'],
      states: ['disabled', 'selected'],
    }
  ),
  'positioning-primitive': accessibilityProfile(
    'A positioning primitive deliberately supplies no standalone widget semantics or interaction.',
    { semantics: ['composition-primitive'] }
  ),
  progress: accessibilityProfile(
    'A named progress indicator exposes determinate value or indeterminate busy state.',
    {
      semantics: ['progressbar'],
      naming: ['author-label-required', 'value-text'],
      states: ['busy', 'value-range'],
      announcements: ['progress-value'],
    }
  ),
  'qr-image': accessibilityProfile(
    'QR output is exposed as a named image rather than raw visual pixels alone.',
    {
      semantics: ['img'],
      naming: ['alternative-text', 'author-label-required'],
    }
  ),
  radio: accessibilityProfile(
    'A labelled radio exposes checked, disabled, required, and invalid state.',
    {
      semantics: ['radio'],
      naming: ['visible-or-author-label'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['checked', 'disabled', 'invalid', 'required'],
    }
  ),
  'radio-group': accessibilityProfile(
    'A labelled radio group owns one roving tab stop and arrow-key selection.',
    {
      semantics: ['radiogroup'],
      naming: ['visible-or-author-label'],
      keyboard: ['arrow-navigation', 'home-end-navigation'],
      focus: ['roving-focus'],
      states: ['disabled', 'invalid', 'orientation', 'required'],
      announcements: ['validation-message'],
    }
  ),
  slider: accessibilityProfile(
    'A labelled slider supports range keys and exposes value, orientation, and disabled state.',
    {
      semantics: ['slider'],
      naming: ['value-text', 'visible-or-author-label'],
      keyboard: ['range-adjustment'],
      focus: ['native-focus'],
      states: ['disabled', 'orientation', 'value-range'],
    }
  ),
  select: accessibilityProfile(
    'A labelled select coordinates a combobox, listbox, and selected options.',
    {
      semantics: ['combobox', 'listbox'],
      naming: ['visible-or-author-label'],
      keyboard: [
        'arrow-navigation',
        'escape-dismiss',
        'home-end-navigation',
        'typeahead',
      ],
      focus: ['focus-return', 'native-focus'],
      states: ['disabled', 'expanded', 'invalid', 'required', 'selected'],
      announcements: ['validation-message'],
    }
  ),
  'decorative-placeholder': accessibilityProfile(
    'A loading placeholder remains presentational and suppresses ambient motion.',
    {
      semantics: ['presentation'],
      motion: ['respects-reduced-motion', 'suppresses-animation'],
    }
  ),
  'loading-status': accessibilityProfile(
    'A loading placeholder can expose localized busy status and suppress ambient motion.',
    {
      semantics: ['presentation', 'status'],
      naming: ['control-labels-localized'],
      states: ['busy'],
      announcements: ['live-status'],
      motion: ['respects-reduced-motion', 'suppresses-animation'],
    }
  ),
  'indeterminate-progress': accessibilityProfile(
    'An indeterminate operation is exposed as progress without creating a live status announcement.',
    {
      semantics: ['progressbar'],
      states: ['busy'],
    }
  ),
  'localized-indeterminate-progress': accessibilityProfile(
    'A non-live indeterminate progressbar has a localized or authored name and suppresses ambient motion.',
    {
      semantics: ['progressbar'],
      naming: ['content-or-author-label', 'control-labels-localized'],
      states: ['busy'],
      motion: ['respects-reduced-motion', 'suppresses-animation'],
    }
  ),
  'split-panel': accessibilityProfile(
    'An adjustable separator supports range keys and exposes value and orientation.',
    {
      semantics: ['separator'],
      naming: ['author-label-required', 'value-text'],
      keyboard: ['range-adjustment'],
      focus: ['native-focus'],
      states: ['disabled', 'orientation', 'value-range'],
    }
  ),
  switch: accessibilityProfile(
    'A labelled switch supports native activation and exposes checked and disabled state.',
    {
      semantics: ['switch'],
      naming: ['visible-or-author-label'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['checked', 'disabled', 'invalid', 'required'],
    }
  ),
  tab: accessibilityProfile(
    'A content-named tab exposes selected and disabled state.',
    {
      semantics: ['tab'],
      naming: ['content-derived'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['disabled', 'selected'],
    }
  ),
  'tab-group': accessibilityProfile(
    'A tablist links tabs to panels with roving navigation and configurable activation.',
    {
      semantics: ['tablist', 'tabpanel'],
      keyboard: [
        'arrow-navigation',
        'home-end-navigation',
        'native-activation',
      ],
      focus: ['focus-follows-selection', 'roving-focus'],
      states: ['orientation', 'selected'],
    }
  ),
  'tab-panel': accessibilityProfile(
    'A tab panel is labelled by its owning tab and exposes hidden versus active state.',
    {
      semantics: ['tabpanel'],
      naming: ['content-derived'],
      states: ['selected'],
    }
  ),
  tag: accessibilityProfile(
    'A content-named tag exposes a localized optional remove action.',
    {
      semantics: ['button', 'group'],
      naming: ['content-derived', 'control-labels-localized'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['disabled'],
    }
  ),
  tooltip: accessibilityProfile(
    'Non-interactive descriptive content appears on pointer hover or keyboard focus.',
    {
      semantics: ['tooltip'],
      naming: ['content-derived'],
      keyboard: ['escape-dismiss'],
      focus: ['focus-return'],
    }
  ),
  tree: accessibilityProfile(
    'A tree uses roving hierarchical navigation and exposes selection and expansion.',
    {
      semantics: ['tree'],
      keyboard: ['arrow-navigation', 'home-end-navigation', 'typeahead'],
      focus: ['roving-focus'],
      states: ['disabled', 'expanded', 'multiselectable', 'selected'],
    }
  ),
  treeitem: accessibilityProfile(
    'A content-named tree item exposes level, expansion, selection, and disabled state.',
    {
      semantics: ['treeitem'],
      naming: ['content-derived'],
      states: ['disabled', 'expanded', 'selected'],
    }
  ),
  'visually-hidden': accessibilityProfile(
    'Visually hidden content remains in reading order and reveals focused descendants.',
    {
      semantics: ['transparent-content'],
      focus: ['focus-visible-on-reveal'],
    }
  ),
  chart: accessibilityProfile(
    'A named chart exposes a textual data representation alongside the visual rendering.',
    {
      semantics: ['img', 'table'],
      naming: ['author-label-required', 'value-text'],
      keyboard: ['data-point-navigation'],
      focus: ['roving-focus'],
      announcements: ['selection-change'],
      motion: ['respects-reduced-motion', 'suppresses-animation'],
    }
  ),
  combobox: accessibilityProfile(
    'A labelled editable combobox coordinates textbox, listbox, and selected options.',
    {
      semantics: ['combobox', 'listbox', 'textbox'],
      naming: ['visible-or-author-label'],
      keyboard: [
        'arrow-navigation',
        'escape-dismiss',
        'home-end-navigation',
        'native-editing',
        'typeahead',
      ],
      focus: ['focus-return', 'native-focus'],
      states: [
        'disabled',
        'expanded',
        'invalid',
        'multiselectable',
        'required',
        'selected',
      ],
      announcements: ['selection-change', 'validation-message'],
    }
  ),
  'data-grid': accessibilityProfile(
    'A labelled data grid uses roving cell navigation and exposes selection and sorting.',
    {
      semantics: ['grid'],
      naming: ['author-label-required'],
      keyboard: ['arrow-navigation', 'home-end-navigation', 'page-navigation'],
      focus: ['focus-preserved', 'roving-focus'],
      states: ['disabled', 'multiselectable', 'selected', 'sort'],
      announcements: ['selection-change'],
    }
  ),
  'segmented-field': accessibilityProfile(
    'A labelled segmented field exposes editable date or time groups and validation.',
    {
      semantics: ['group', 'spinbutton'],
      naming: ['control-labels-localized', 'visible-or-author-label'],
      keyboard: ['arrow-navigation', 'native-editing'],
      focus: ['native-focus'],
      states: ['disabled', 'invalid', 'readonly', 'required', 'value-range'],
      announcements: ['validation-message'],
    }
  ),
  'date-picker': accessibilityProfile(
    'A labelled calendar grid uses roving date navigation and exposes selected/current dates.',
    {
      semantics: ['grid'],
      naming: ['control-labels-localized', 'visible-or-author-label'],
      keyboard: ['arrow-navigation', 'home-end-navigation', 'page-navigation'],
      focus: ['focus-preserved', 'roving-focus'],
      states: ['current', 'disabled', 'selected'],
      announcements: ['selection-change'],
    }
  ),
  'file-input': accessibilityProfile(
    'A labelled native file control exposes selection, removal, and validation state.',
    {
      semantics: ['button', 'list'],
      naming: ['control-labels-localized', 'visible-or-author-label'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['disabled', 'invalid', 'required'],
      announcements: ['selection-change', 'validation-message'],
    }
  ),
  'number-input': accessibilityProfile(
    'A labelled spinbutton supports native editing, stepping, and range validity.',
    {
      semantics: ['spinbutton'],
      naming: ['control-labels-localized', 'visible-or-author-label'],
      keyboard: ['native-editing', 'range-adjustment'],
      focus: ['native-focus'],
      states: ['disabled', 'invalid', 'readonly', 'required', 'value-range'],
      announcements: ['validation-message'],
    }
  ),
  'otp-input': accessibilityProfile(
    'A labelled one-time-code field presents one editing and form target.',
    {
      semantics: ['textbox'],
      naming: ['author-label-required', 'visible-or-author-label'],
      keyboard: ['native-editing'],
      focus: ['native-focus'],
      states: ['disabled', 'invalid', 'required'],
      announcements: ['validation-message'],
    }
  ),
  'page-landmarks': accessibilityProfile(
    'An application page composes named header, navigation, main, and complementary regions.',
    {
      semantics: ['article', 'navigation', 'region'],
      naming: ['content-or-author-label'],
      focus: ['focus-preserved'],
    }
  ),
  pagination: accessibilityProfile(
    'A named pagination landmark marks the current page, preserves focus, and announces changes.',
    {
      semantics: ['navigation'],
      naming: [
        'author-label-required',
        'control-labels-localized',
        'current-page',
      ],
      keyboard: ['native-activation'],
      focus: ['focus-preserved', 'native-focus'],
      states: ['current', 'disabled'],
      announcements: ['page-change'],
    }
  ),
  popover: accessibilityProfile(
    'A named non-modal popover dismisses with Escape and returns focus to its trigger.',
    {
      semantics: ['dialog'],
      naming: ['content-or-author-label'],
      keyboard: ['escape-dismiss'],
      focus: ['focus-return', 'initial-focus'],
      states: ['expanded'],
    }
  ),
  'random-content-upstream': accessibilityProfile(
    'Rotating content pauses around pointer/focus interaction, suppresses motion, and announces every selection.',
    {
      semantics: ['region'],
      naming: ['content-derived'],
      focus: ['focus-preserved'],
      announcements: ['autoplay-content-change', 'content-change'],
      motion: ['respects-reduced-motion', 'suppresses-animation'],
    }
  ),
  'random-content-target': accessibilityProfile(
    'Rotating content preserves focused descendants, announces manual changes, and provides a visible pause control.',
    {
      semantics: ['button', 'region'],
      naming: ['content-derived', 'control-labels-localized'],
      keyboard: ['native-activation'],
      focus: ['focus-preserved', 'native-focus'],
      states: ['paused'],
      announcements: ['content-change'],
      motion: [
        'respects-reduced-motion',
        'stops-autoplay',
        'suppresses-animation',
        'user-pause-control',
      ],
    }
  ),
  scroller: accessibilityProfile(
    'A labelled overflow region exposes localized keyboard-operable scroll controls.',
    {
      semantics: ['button', 'region'],
      naming: ['control-labels-localized', 'content-or-author-label'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['disabled'],
    }
  ),
  sparkline: accessibilityProfile(
    'A compact chart exposes a textual value and accessible image name.',
    {
      semantics: ['img', 'text-content'],
      naming: ['author-label-required', 'value-text'],
    }
  ),
  'toast-region': accessibilityProfile(
    'A toast region queues status or alert items without moving focus.',
    {
      semantics: ['region', 'status'],
      announcements: ['live-alert', 'live-status'],
    }
  ),
  video: accessibilityProfile(
    'A named video exposes captions and keyboard-operable playback controls.',
    {
      semantics: ['video'],
      naming: ['author-label-required', 'control-labels-localized'],
      keyboard: ['media-controls', 'native-activation'],
      focus: ['native-focus'],
      states: ['disabled', 'paused'],
      announcements: ['playback-state'],
      motion: ['respects-reduced-motion', 'stops-autoplay'],
    }
  ),
  'video-playlist': accessibilityProfile(
    'A named video playlist exposes the active item and keyboard selection.',
    {
      semantics: ['listbox', 'option'],
      naming: ['content-or-author-label'],
      keyboard: [
        'arrow-navigation',
        'home-end-navigation',
        'native-activation',
      ],
      focus: ['focus-preserved', 'roving-focus'],
      states: ['current', 'disabled', 'selected'],
      announcements: ['selection-change'],
    }
  ),
  frame: accessibilityProfile(
    'An embedded frame requires a title and can deliberately gate keyboard entry.',
    {
      semantics: ['iframe'],
      naming: ['frame-title'],
      focus: ['frame-focus-gated', 'native-focus'],
    }
  ),
});

export function accessibilityProfileCatalog() {
  return structuredClone(REVIEWED_ACCESSIBILITY_PROFILES);
}

const ACCESSIBILITY_ASSIGNMENTS = new Map();

export function assertAccessibilityProfilesReferenced(profiles, assignments) {
  const referenced = new Set();
  for (const [tag, assignment] of assignments) {
    for (const field of ['upstreamProfile', 'targetProfile']) {
      const profile = assignment?.[field];
      if (typeof profile !== 'string' || !Object.hasOwn(profiles, profile)) {
        throw new Error(
          `${tag}: accessibility assignment references unknown ${field} ${String(
            profile
          )}`
        );
      }
      referenced.add(profile);
    }
  }

  const unreferenced = Object.keys(profiles)
    .filter((profile) => !referenced.has(profile))
    .sort();
  if (unreferenced.length > 0) {
    const noun = unreferenced.length === 1 ? 'profile' : 'profiles';
    throw new Error(
      `unreferenced accessibility ${noun} ${unreferenced.join(', ')}`
    );
  }
}

function assignAccessibility(
  upstreamProfile,
  tags,
  targetProfile = upstreamProfile
) {
  for (const tag of tags) {
    if (ACCESSIBILITY_ASSIGNMENTS.has(tag))
      throw new Error(`${tag}: duplicate accessibility review assignment`);
    ACCESSIBILITY_ASSIGNMENTS.set(tag, { upstreamProfile, targetProfile });
  }
}

assignAccessibility('alert', ['sl-alert', 'wa-toast-item']);
assignAccessibility('callout', ['wa-callout'], 'reactive-callout');
assignAccessibility('animated-image', [
  'sl-animated-image',
  'wa-animated-image',
]);
assignAccessibility('animation-content', ['sl-animation', 'wa-animation']);
assignAccessibility('named-image', ['sl-avatar', 'wa-avatar']);
assignAccessibility('text-content', [
  'sl-badge',
  'sl-format-bytes',
  'sl-format-date',
  'sl-format-number',
  'sl-relative-time',
  'wa-badge',
  'wa-format-bytes',
  'wa-format-date',
  'wa-format-number',
  'wa-relative-time',
]);
assignAccessibility('navigation', ['sl-breadcrumb', 'wa-breadcrumb']);
assignAccessibility('link', ['sl-breadcrumb-item', 'wa-breadcrumb-item']);
assignAccessibility('button', ['sl-button', 'sl-icon-button', 'wa-button']);
assignAccessibility('button-group', ['sl-button-group', 'wa-button-group']);
assignAccessibility('no-tag-owned-behavior', ['sl-card', 'wa-card']);
assignAccessibility('carousel', ['sl-carousel', 'wa-carousel']);
assignAccessibility('carousel-item', ['sl-carousel-item', 'wa-carousel-item']);
assignAccessibility('checkbox', ['sl-checkbox', 'wa-checkbox']);
assignAccessibility('checkbox-group', ['wa-checkbox-group']);
assignAccessibility('color-picker', ['sl-color-picker', 'wa-color-picker']);
assignAccessibility('copy-button', ['sl-copy-button', 'wa-copy-button']);
assignAccessibility('disclosure', [
  'sl-details',
  'wa-accordion-item',
  'wa-details',
]);
assignAccessibility('accordion', ['wa-accordion']);
assignAccessibility('modal', [
  'sl-dialog',
  'sl-drawer',
  'wa-dialog',
  'wa-drawer',
]);
assignAccessibility('separator', ['sl-divider', 'wa-divider']);
assignAccessibility('menu-button', ['sl-dropdown', 'wa-dropdown']);
assignAccessibility('icon', ['sl-icon', 'wa-icon']);
assignAccessibility('image-comparison', ['sl-image-comparer', 'wa-comparison']);
assignAccessibility('document-content', [
  'sl-include',
  'wa-include',
  'wa-markdown',
]);
assignAccessibility('text-input', ['sl-input', 'wa-input']);
assignAccessibility('textarea', ['sl-textarea', 'wa-textarea']);
assignAccessibility('menu', ['sl-menu']);
assignAccessibility('menuitem', ['sl-menu-item', 'wa-dropdown-item']);
assignAccessibility('group-label', ['sl-menu-label']);
assignAccessibility('transparent-content', [
  'sl-mutation-observer',
  'sl-resize-observer',
  'wa-intersection-observer',
  'wa-mutation-observer',
  'wa-resize-observer',
]);
assignAccessibility('option', ['sl-option', 'wa-option']);
assignAccessibility('positioning-primitive', ['sl-popup', 'wa-popup']);
assignAccessibility('progress', [
  'sl-progress-bar',
  'sl-progress-ring',
  'wa-progress-bar',
  'wa-progress-ring',
]);
assignAccessibility('qr-image', ['sl-qr-code', 'wa-qr-code']);
assignAccessibility('radio', ['sl-radio', 'sl-radio-button', 'wa-radio']);
assignAccessibility('radio-group', ['sl-radio-group', 'wa-radio-group']);
assignAccessibility('slider', [
  'sl-range',
  'sl-rating',
  'wa-rating',
  'wa-slider',
]);
assignAccessibility('select', ['sl-select', 'wa-select']);
assignAccessibility(
  'decorative-placeholder',
  ['sl-skeleton', 'wa-skeleton'],
  'loading-status'
);
assignAccessibility(
  'indeterminate-progress',
  ['sl-spinner', 'wa-spinner'],
  'localized-indeterminate-progress'
);
assignAccessibility('split-panel', ['sl-split-panel', 'wa-split-panel']);
assignAccessibility('switch', ['sl-switch', 'wa-switch']);
assignAccessibility('tab', ['sl-tab', 'wa-tab']);
assignAccessibility('tab-group', ['sl-tab-group', 'wa-tab-group']);
assignAccessibility('tab-panel', ['sl-tab-panel', 'wa-tab-panel']);
assignAccessibility('tag', ['sl-tag', 'wa-tag']);
assignAccessibility('tooltip', ['sl-tooltip', 'wa-tooltip']);
assignAccessibility('tree', ['sl-tree', 'wa-tree']);
assignAccessibility('treeitem', ['sl-tree-item', 'wa-tree-item']);
assignAccessibility('visually-hidden', ['sl-visually-hidden']);
assignAccessibility('chart', [
  'wa-bar-chart',
  'wa-bubble-chart',
  'wa-chart',
  'wa-doughnut-chart',
  'wa-line-chart',
  'wa-pie-chart',
  'wa-polar-area-chart',
  'wa-radar-chart',
  'wa-scatter-chart',
]);
assignAccessibility('combobox', ['wa-combobox']);
assignAccessibility('data-grid', ['wa-data-grid']);
assignAccessibility('segmented-field', [
  'wa-date-input',
  'wa-known-date',
  'wa-time-input',
]);
assignAccessibility('date-picker', ['wa-date-picker']);
assignAccessibility('file-input', ['wa-file-input']);
assignAccessibility('number-input', ['wa-number-input']);
assignAccessibility('otp-input', ['wa-otp-input']);
assignAccessibility('page-landmarks', ['wa-page']);
assignAccessibility('pagination', ['wa-pagination']);
assignAccessibility('popover', ['wa-popover']);
assignAccessibility(
  'random-content-upstream',
  ['wa-random-content'],
  'random-content-target'
);
assignAccessibility('scroller', ['wa-scroller']);
assignAccessibility('sparkline', ['wa-sparkline']);
assignAccessibility('toast-region', ['wa-toast']);
assignAccessibility('video', ['wa-video']);
assignAccessibility('video-playlist', ['wa-video-playlist']);
assignAccessibility('frame', ['wa-zoomable-frame']);

assertAccessibilityProfilesReferenced(
  REVIEWED_ACCESSIBILITY_PROFILES,
  ACCESSIBILITY_ASSIGNMENTS
);

export function reviewedAccessibilityMetadata(upstreamTag, targetTag) {
  const assignment = ACCESSIBILITY_ASSIGNMENTS.get(upstreamTag);
  if (!assignment)
    throw new Error(
      `${upstreamTag}: missing reviewed accessibility profile assignment`
    );
  const profiles = REVIEWED_ACCESSIBILITY_PROFILES;
  const comparison = compareAccessibilityProfiles(
    profiles,
    assignment.upstreamProfile,
    assignment.targetProfile
  );
  const sourceDescription = profiles[assignment.upstreamProfile].description;
  let rationale;
  if (comparison.status === 'not-applicable') {
    rationale = `${upstreamTag} and ${targetTag} assign no tag-owned accessibility behavior; authored descendants keep their own semantics.`;
  } else if (comparison.status === 'equivalent') {
    rationale = `${upstreamTag} and ${targetTag} share the reviewed behavior profile: ${sourceDescription}`;
  } else if (comparison.status === 'target-additive') {
    rationale = `${targetTag} retains the reviewed ${upstreamTag} behavior and adds ${comparison.additions.join(
      ', '
    )}.`;
  } else {
    rationale = `${targetTag} does not claim ${comparison.missing.join(
      ', '
    )} from ${upstreamTag}; the mapping requires manual accessibility review.`;
  }
  return {
    reviewStatus: 'complete',
    upstreamProfile: assignment.upstreamProfile,
    targetProfile: assignment.targetProfile,
    evidence: {
      upstream: 'pinned-public-contract',
      target: 'lyra-authored-contract-and-automated-tests',
    },
    comparison,
    rationale,
  };
}

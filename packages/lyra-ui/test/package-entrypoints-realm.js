// Keep package self-references in a server-served module so Web Test Runner's node-resolve plugin
// validates the published exports map before these import functions execute in the caller's realm.
export const importRoot = () => import('@aceshooting/lyra-ui');
export const importAll = () => import('@aceshooting/lyra-ui/all.js');
export const importLocalization = () => import('@aceshooting/lyra-ui/localization.js');
export const importPersianLocale = () => import('@aceshooting/lyra-ui/translations/fa.js');
export const importHebrewLocale = () => import('@aceshooting/lyra-ui/translations/he.js');
export const importEmpty = () =>
  import('@aceshooting/lyra-ui/components/overlays/empty/empty.js');
export const importEmptyClass = () =>
  import('@aceshooting/lyra-ui/components/overlays/empty/empty.class.js');
export const importCsv = () =>
  import('@aceshooting/lyra-ui/components/utility/export-button/csv.js');
export const importUtilities = () => import('@aceshooting/lyra-ui/utilities');
export const importPositioner = () =>
  import('@aceshooting/lyra-ui/utilities/positioner.js');

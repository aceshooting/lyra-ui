export { activateOverlay, suspendLyraModalsFor } from '@aceshooting/lyra-ui/utilities/overlay-manager.js';

// A fresh page loads registrations from exactly one feature's package context.
export async function loadPopover() {
  const { LyraPopover } = await import('@aceshooting/lyra-ui/components/lr-popover.js');
  return LyraPopover;
}
export async function loadDialog() {
  await import('@aceshooting/lyra-ui/components/lr-dialog.js');
}

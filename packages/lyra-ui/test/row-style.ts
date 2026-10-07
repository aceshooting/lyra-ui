import { resetMouse, sendMouse } from './wtr-mouse.js';

/** Waits for pointer feedback while allowing engines that suppress a cancelled press. */
export async function settlePointerStyle(holds: () => boolean): Promise<boolean> {
  for (let attempt = 0; attempt < 25; attempt++) {
    if (holds()) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  return holds();
}

/** Uses a fresh listbox because releasing a row can select it and close its popup. */
export async function measureListboxRow(
  open: () => Promise<HTMLElement>,
  pick: (rows: HTMLElement[]) => HTMLElement,
): Promise<{ hover: string; press: string } | null> {
  const host = await open();
  try {
    const row = pick([...host.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]')]);
    const view = host.ownerDocument.defaultView!;
    const background = (): string => view.getComputedStyle(row).backgroundColor;
    const resting = background();
    const rect = row.getBoundingClientRect();
    await sendMouse({ type: 'move', position: [
      Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2),
    ] });
    if (!(await settlePointerStyle(() => row.matches(':hover')))) return null;
    await settlePointerStyle(() => background() !== resting);
    const hover = background();
    await sendMouse({ type: 'down' });
    await settlePointerStyle(() => background() !== hover);
    return { hover, press: background() };
  } finally {
    try {
      await sendMouse({ type: 'up' });
    } finally {
      try { await resetMouse(); } finally { host.remove(); }
    }
  }
}

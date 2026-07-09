import '../packages/lyra-ui/src/lyra.js';
import { toast } from '../packages/lyra-ui/src/lyra.js';
import type { LyraSparkline } from '../packages/lyra-ui/src/lyra.js';

const data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
for (const id of ['spark-line', 'spark-area', 'spark-bar']) {
  const el = document.getElementById(id) as LyraSparkline | null;
  if (el) el.values = data;
}

document.getElementById('toast-info')?.addEventListener('click', () => toast('Just so you know'));
document
  .getElementById('toast-success')
  ?.addEventListener('click', () => toast({ message: 'Saved!', variant: 'success' }));
document.getElementById('toast-danger')?.addEventListener('click', () =>
  toast({
    message: 'Item deleted',
    variant: 'danger',
    duration: 0,
    action: { label: 'Undo', onClick: (item) => item.hide() },
  }),
);

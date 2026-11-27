import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-transfer-manager.js';
import type {
  LyraTransfer,
  LyraTransferActionDetail,
  LyraTransferManager,
  LyraTransferStatus,
} from '../../lr-transfer-manager.js';

const meta: Meta = {
  title: 'Utility/Transfer Manager',
  component: 'lr-transfer-manager',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

const archive: LyraTransfer = {
  id: 'photos',
  name: 'Travel photos.zip',
  status: 'active',
  bytesDone: 18_000_000,
  bytesTotal: 72_000_000,
};
const files: readonly LyraTransfer[] = [
  { id: 'cover', name: 'Cover photo.jpg', status: 'paused', bytesDone: 1_200_000, bytesTotal: 3_600_000 },
  { id: 'notes', name: 'Trip notes.pdf', status: 'error', bytesDone: 0, bytesTotal: 740_000 },
  { id: 'credits', name: 'Photo credits.txt', status: 'done', bytesDone: 8_400, bytesTotal: 8_400 },
];

const nextStatus = new Map<string, LyraTransferStatus>([
  ['lr-transfer-pause', 'paused'],
  ['lr-transfer-resume', 'active'],
  ['lr-transfer-cancel', 'cancelled'],
  ['lr-transfer-retry', 'queued'],
]);

function updateQueue(event: CustomEvent<LyraTransferActionDetail>): void {
  const manager = event.currentTarget as LyraTransferManager;
  const status = nextStatus.get(event.type);
  if (!status) return;
  const ids = new Set(event.detail.ids);
  manager.transfers = manager.transfers.map(transfer =>
    ids.has(transfer.id)
      ? { ...transfer, status, bytesDone: status === 'queued' ? 0 : transfer.bytesDone }
      : transfer,
  );
}

function simulateTransfer(event: Event): void {
  const trigger = event.currentTarget as HTMLButtonElement;
  const manager = trigger.nextElementSibling as LyraTransferManager;
  trigger.disabled = true;
  const timer = window.setInterval(() => {
    if (!manager.isConnected || !manager.transfers.some(transfer => transfer.status === 'active')) {
      window.clearInterval(timer);
      trigger.disabled = false;
      return;
    }
    manager.transfers = manager.transfers.map(transfer => {
      if (transfer.status !== 'active' || transfer.bytesTotal === undefined) return transfer;
      const bytesDone = Math.min(transfer.bytesDone + 2_000_000, transfer.bytesTotal);
      return { ...transfer, bytesDone, status: bytesDone === transfer.bytesTotal ? 'done' : 'active' };
    });
  }, 500);
}

export const Default: Story = {
  render: () => html`
    <header>
      <lr-transfer-manager
        .transfers=${[archive, ...files]}
        @lr-transfer-pause=${updateQueue}
        @lr-transfer-resume=${updateQueue}
        @lr-transfer-cancel=${updateQueue}
        @lr-transfer-retry=${updateQueue}
      ></lr-transfer-manager>
    </header>
  `,
};

export const LiveArchiveQueue: Story = {
  render: () => html`
    <button type="button" @click=${simulateTransfer}>Simulate transfer progress</button>
    <lr-transfer-manager
      .transfers=${[archive, ...files]}
      @lr-transfer-pause=${updateQueue}
      @lr-transfer-resume=${updateQueue}
      @lr-transfer-cancel=${updateQueue}
      @lr-transfer-retry=${updateQueue}
    ></lr-transfer-manager>
  `,
};

export const Floating: Story = {
  render: () => html`
    <div style="transform: translateZ(0); min-block-size: var(--lr-size-16rem); max-inline-size: var(--lr-size-20rem);">
      <lr-transfer-manager
        placement="floating"
        collapsed
        .transfers=${[{ ...archive, bytesTotal: undefined }, ...files]}
        @lr-transfer-pause=${updateQueue}
        @lr-transfer-resume=${updateQueue}
        @lr-transfer-cancel=${updateQueue}
        @lr-transfer-retry=${updateQueue}
      ></lr-transfer-manager>
    </div>
  `,
};

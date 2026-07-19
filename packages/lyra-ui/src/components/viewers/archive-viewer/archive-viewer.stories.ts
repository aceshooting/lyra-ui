import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './archive-viewer.js';

const meta: Meta = { title: 'ArchiveViewer', component: 'lr-archive-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
const source = 'data:application/zip;base64,UEsDBAoAAAAAAEyY71zIWnOsFAAAABQAAAAKAAAAUkVBRE1FLnR4dGhlbGxvIGZyb20gU3Rvcnlib29rUEsDBAoAAAAAAEyY71wAAAAAAAAAAAAAAAAEAAAAc3JjL1BLAQIUAAoAAAAAAEyY71zIWnOsFAAAABQAAAAKAAAAAAAAAAAAAAAAAAAAAABSRUFETUUudHh0UEsBAhQACgAAAAAATJjvXAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAQAAAAPAAAAHNyYy9QSwUGAAAAAAIAAgBqAAAAXgAAAAAA';
export const Default: Story = { render: () => html`<lr-archive-viewer style="max-inline-size: 28rem;" src=${source} name="archive.zip"></lr-archive-viewer>` };
export const NoSourceSet: Story = { render: () => html`<lr-archive-viewer style="max-inline-size: 28rem;"></lr-archive-viewer>` };

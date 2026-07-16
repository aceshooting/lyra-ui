import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './calendar.js';
const meta: Meta = { title: 'Calendar', component: 'lyra-calendar', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Month: Story = { render: () => html`<lyra-calendar view-date="2026-07-01" .events=${[{ date: '2026-07-15', title: 'Planning review' }, { date: '2026-07-22', title: 'Release' }]}></lyra-calendar>` };

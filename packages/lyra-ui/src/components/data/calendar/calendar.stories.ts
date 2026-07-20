import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './calendar.js';
const meta: Meta = { title: 'Calendar', component: 'lr-calendar', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Month: Story = { render: () => html`<lr-calendar view-date="2026-07-01" .events=${[{ date: '2026-07-15', title: 'Planning review' }, { date: '2026-07-22', title: 'Release' }]}></lr-calendar>` };
// Below the 28rem @container threshold that shrinks the day-cell min-block-size and the event
// marker font-size -- exercises the host's own inline-size containment (no ancestor needs to
// declare container-type itself) in a narrow sidebar/mobile-panel allocation.
export const NarrowAllocation: Story = { render: () => html`<div style="inline-size: 18rem"><lr-calendar view-date="2026-07-01" .events=${[{ date: '2026-07-15', title: 'Planning review' }, { date: '2026-07-22', title: 'Release' }]}></lr-calendar></div>` };

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tour.js';
import type { LyraTour, TourStep } from './tour.js';

const meta: Meta = {
  title: 'Tour',
  component: 'lr-tour',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A spotlight-and-step guided walkthrough for first-run onboarding: a sequence of steps, each anchored to a target element elsewhere in the page, shown against a dimmed backdrop with a cutout highlighting the current target, plus Next/Previous/Skip controls and a step-progress indicator. `steps` is fully controlled -- this component never mutates it.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const productTourSteps: TourStep[] = [
  {
    id: 'search',
    target: '#tour-demo-search',
    heading: 'Search anything',
    content: 'Start typing here to filter results across the whole workspace.',
  },
  {
    id: 'filters',
    target: '#tour-demo-filters',
    heading: 'Refine with filters',
    content: 'Narrow results down by type, date, or owner.',
  },
  {
    id: 'create',
    target: '#tour-demo-create',
    heading: 'Create something new',
    content: "When you're ready, this button starts a new item from scratch.",
    placement: 'left',
  },
];

function startDemoTour(e: Event): void {
  const trigger = e.currentTarget as HTMLElement;
  const tour = trigger.closest('.tour-demo')!.querySelector('lr-tour') as LyraTour;
  tour.start();
}

export const Default: Story = {
  render: () => html`
    <div class="tour-demo" style="display:flex; flex-direction:column; gap:1rem; max-width:32rem;">
      <button @click=${startDemoTour}>Start tour</button>
      <div style="display:flex; gap:0.75rem; align-items:center;">
        <input id="tour-demo-search" placeholder="Search…" style="flex:1;" />
        <button id="tour-demo-filters">Filters</button>
        <button id="tour-demo-create">Create</button>
      </div>
      <lr-tour .steps=${productTourSteps}></lr-tour>
    </div>
  `,
};

export const InteractiveTarget: Story = {
  render: () => html`
    <div class="tour-demo" style="display:flex; flex-direction:column; gap:1rem; max-width:32rem;">
      <button @click=${startDemoTour}>Start tour</button>
      <div style="display:flex; gap:0.75rem; align-items:center;">
        <button id="tour-demo-search">Try clicking me</button>
        <button id="tour-demo-filters">Filters</button>
        <button id="tour-demo-create">Create</button>
      </div>
      <lr-tour
        .steps=${[
          {
            id: 'clickable',
            target: '#tour-demo-search',
            heading: 'This one stays clickable',
            content: 'interactiveTarget restores real pointer/click reachability to the live target underneath.',
            interactiveTarget: true,
          },
          ...productTourSteps.slice(1),
        ]}
      ></lr-tour>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'Every other step spotlights a non-interactive target by default. Setting `interactiveTarget: true` makes the panel nonmodal, restores real pointer reachability, and adds an explicit Tab route between the panel and that target.',
      },
    },
  },
};

export const NoProgressAndLightDismiss: Story = {
  render: () => html`
    <div class="tour-demo" style="display:flex; flex-direction:column; gap:1rem; max-width:32rem;">
      <button @click=${startDemoTour}>Start tour</button>
      <div style="display:flex; gap:0.75rem; align-items:center;">
        <input id="tour-demo-search" placeholder="Search…" style="flex:1;" />
        <button id="tour-demo-filters">Filters</button>
        <button id="tour-demo-create">Create</button>
      </div>
      <lr-tour .steps=${productTourSteps} .showProgress=${false} light-dismiss></lr-tour>
    </div>
  `,
};

export const NarrowLongContent: Story = {
  render: () => html`
    <div class="tour-demo" style="display:flex; flex-direction:column; gap:1rem; max-width:20rem;">
      <button @click=${startDemoTour}>Start narrow tour</button>
      <button id="tour-narrow-target">Narrow target</button>
      <lr-tour
        .steps=${[
          {
            id: 'long-content',
            target: '#tour-narrow-target',
            heading: 'AnExceptionallyLongUnbrokenTourHeadingThatMustWrap',
            content:
              'A-long-unbroken-body-value-that-demonstrates-the-popover-stays-within-a-narrow-allocation',
          },
        ]}
      ></lr-tour>
    </div>
  `,
};

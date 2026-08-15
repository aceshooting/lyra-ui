import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tour.js';
import type { LyraTour, LyraTourStep } from './tour.js';

const meta: Meta = {
  title: 'Tour',
  component: 'lr-tour',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A spotlight-and-step guided walkthrough for first-run onboarding: a sequence of steps, each anchored to a target element elsewhere in the page, shown against a dimmed backdrop with a cutout highlighting the current target, plus Next/Previous/Skip controls and a step-progress indicator. Default steps are modal and trap focus in the panel; an `interactiveTarget` step is nonmodal and adds a two-way Tab route between the panel and the live target. `steps` is fully controlled -- this component never mutates it.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

interface TourDemoIds {
  create: string;
  filters: string;
  search: string;
}

let tourDemoInstance = 0;

function createTourDemoIds(story: string): TourDemoIds {
  tourDemoInstance += 1;
  const prefix = `tour-${story}-${tourDemoInstance}`;
  return {
    create: `${prefix}-create`,
    filters: `${prefix}-filters`,
    search: `${prefix}-search`,
  };
}

function productTourSteps(ids: TourDemoIds): LyraTourStep[] {
  return [
    {
      stepId: 'search',
      target: `#${ids.search}`,
      heading: 'Search anything',
      content: 'Start typing here to filter results across the whole workspace.',
    },
    {
      stepId: 'filters',
      target: `#${ids.filters}`,
      heading: 'Refine with filters',
      content: 'Narrow results down by type, date, or owner.',
    },
    {
      stepId: 'create',
      target: `#${ids.create}`,
      heading: 'Create something new',
      content: "When you're ready, this button starts a new item from scratch.",
      placement: 'left',
    },
  ];
}

function startDemoTour(e: Event): void {
  const trigger = e.currentTarget as HTMLElement;
  const tour = trigger.closest('.tour-demo')!.querySelector('lr-tour') as LyraTour;
  tour.start();
}

export const Default: Story = {
  render: () => {
    const ids = createTourDemoIds('default');
    return html`
      <div class="tour-demo" style="display:flex; flex-direction:column; gap:1rem; max-width:32rem;">
        <button @click=${startDemoTour}>Start tour</button>
        <div style="display:flex; gap:0.75rem; align-items:center;">
          <input id=${ids.search} placeholder="Search…" style="flex:1;" />
          <button id=${ids.filters}>Filters</button>
          <button id=${ids.create}>Create</button>
        </div>
        <lr-tour .steps=${productTourSteps(ids)}></lr-tour>
      </div>
    `;
  },
};

export const InteractiveTarget: Story = {
  render: () => {
    const ids = createTourDemoIds('interactive');
    const steps = productTourSteps(ids);
    return html`
      <div class="tour-demo" style="display:flex; flex-direction:column; gap:1rem; max-width:32rem;">
        <button @click=${startDemoTour}>Start tour</button>
        <div style="display:flex; gap:0.75rem; align-items:center;">
          <button id=${ids.search}>Try clicking me</button>
          <button id=${ids.filters}>Filters</button>
          <button id=${ids.create}>Create</button>
        </div>
        <lr-tour
          .steps=${[
            {
              ...steps[0]!,
              stepId: 'clickable',
              heading: 'This one stays clickable',
              content: 'interactiveTarget restores real pointer/click reachability to the live target underneath.',
              interactiveTarget: true,
            },
            ...steps.slice(1),
          ]}
        ></lr-tour>
      </div>
    `;
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every other step spotlights a non-interactive target by default. Setting `interactiveTarget: true` makes the panel nonmodal, restores real pointer reachability, and adds an explicit Tab route between the panel and that target.',
      },
    },
  },
};

export const NormalizedProviderSteps: Story = {
  render: () => {
    const targetId = createTourDemoIds('normalized').search;
    const providerSteps = [
      { stepId: 'malformed', target: `#${targetId}`, heading: 42 },
      {
        stepId: 'safe',
        target: `#${targetId}`,
        heading: 'Valid provider step',
        content: 'Malformed siblings are omitted without preventing this valid step from running.',
      },
    ] as unknown as LyraTourStep[];
    return html`
      <div class="tour-demo" style="display:flex; flex-direction:column; gap:1rem; max-width:32rem;">
        <button @click=${startDemoTour}>Start normalized tour</button>
        <button id=${targetId}>Provider-owned target</button>
        <lr-tour .steps=${providerSteps}></lr-tour>
      </div>
    `;
  },
  parameters: {
    docs: {
      description: {
        story:
          'The `steps` boundary clone-normalizes bounded provider data. This fixture includes one malformed row before a valid row; the valid sibling remains usable.',
      },
    },
  },
};

export const NoProgressAndLightDismiss: Story = {
  render: () => {
    const ids = createTourDemoIds('dismiss');
    return html`
      <div class="tour-demo" style="display:flex; flex-direction:column; gap:1rem; max-width:32rem;">
        <button @click=${startDemoTour}>Start tour</button>
        <div style="display:flex; gap:0.75rem; align-items:center;">
          <input id=${ids.search} placeholder="Search…" style="flex:1;" />
          <button id=${ids.filters}>Filters</button>
          <button id=${ids.create}>Create</button>
        </div>
        <lr-tour .steps=${productTourSteps(ids)} .showProgress=${false} light-dismiss></lr-tour>
      </div>
    `;
  },
};

export const NarrowLongContent: Story = {
  render: () => {
    const targetId = createTourDemoIds('narrow').search;
    return html`
      <div class="tour-demo" style="display:flex; flex-direction:column; gap:1rem; max-width:20rem;">
        <button @click=${startDemoTour}>Start narrow tour</button>
        <button id=${targetId}>Narrow target</button>
        <lr-tour
          .steps=${[
            {
              stepId: 'long-content',
              target: `#${targetId}`,
              heading: 'AnExceptionallyLongUnbrokenTourHeadingThatMustWrap',
              content: 'A-long-unbroken-body-value-that-demonstrates-the-popover-stays-within-a-narrow-allocation',
            },
          ]}
        ></lr-tour>
      </div>
    `;
  },
};

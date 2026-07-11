# Storybook Docs Site & Repo Professionalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled `docs/` playground with a themed, deployed Storybook site (one page per component, live canvas + copy-button source + CEM-generated prop tables), then professionalize the repo (README, Changesets-driven CHANGELOG wired into `scripts/publish.sh`, CONTRIBUTING.md, issue/PR templates, badges).

**Architecture:** Storybook (`@storybook/web-components-vite`) at the repo root, with one `*.stories.ts` file colocated per component directory under `packages/lyra-ui/src/components/`. `preview.ts` imports the library barrel once (registering every custom element) and wires the custom-elements manifest so autodocs prop tables are generated, not hand-written. Deployed via GitHub Actions to GitHub Pages.

**Tech Stack:** Storybook 8/9 (`storybook init` resolves the exact current version), `@storybook/web-components-vite`, Lit 3 (already a dependency), Vite 8 (already the workspace's bundler), `@changesets/cli` (Phase 2 only).

## Global Constraints

- Every story renders the actual custom element via Lit's `html` tagged template — never query the DOM imperatively the way the old `docs/main.ts` did (Storybook's declarative `args`/`render` model replaces that entirely).
- No new runtime dependency is needed for chart/graph/map stories: `chart.js`, `chartjs-plugin-zoom`, `@sgratzl/chartjs-chart-boxplot`, `d3-force`/`d3-drag`/`d3-zoom`/`d3-selection`, `maplibre-gl`, and `@aceshooting/lyra-flags` are already root-level devDependencies (verified in root `package.json`).
- Component API details (property names, attribute names, event names, types) for every story **must** match `packages/lyra-ui/llms-full.txt` — that file is the verified source of truth used throughout this plan.
- Follow the repo's existing commit style: no `--no-verify`, no amending, new commit per task.
- `packages/lyra-ui/custom-elements.json` is gitignored (a generated build artifact) — it must exist on disk (`pnpm --filter @aceshooting/lyra-ui run manifest`) before Storybook is started, in every task from Task 2 onward.

---

## Phase 1 — Docs site (Storybook)

### Task 1: Install Storybook and verify the default scaffold boots

**Files:**
- Create (via `storybook init`): `.storybook/main.ts`, `.storybook/preview.ts`, `packages/lyra-ui/src/stories/*` (Storybook's example stories — deleted in Task 2), root `package.json` gets `storybook`/`build-storybook` scripts and new devDependencies added automatically.

**Interfaces:**
- Produces: a working `pnpm storybook` command later tasks depend on.

- [ ] **Step 1: Run the Storybook installer from the repo root**

```bash
pnpm dlx storybook@latest init --type web-components --yes
```

This detects the existing Vite setup, installs `storybook`, `@storybook/web-components-vite`, and related devDependencies into root `package.json`, and scaffolds `.storybook/main.ts` + `.storybook/preview.ts` plus example stories.

- [ ] **Step 2: Verify the scaffolded site boots**

```bash
pnpm storybook
```

Expected: a dev server starts (default port 6006) and the terminal prints a `Storybook ... started` message with a `Local: http://localhost:6006/` URL. Stop it with Ctrl-C once confirmed — later tasks will restart it after reconfiguring.

- [ ] **Step 3: Commit the scaffold**

```bash
git add -A
git commit -m "chore(docs): install and scaffold Storybook"
```

---

### Task 2: Point Storybook at the real library, wire the manifest, add the first real story

**Files:**
- Modify: `.storybook/main.ts`
- Modify: `.storybook/preview.ts`
- Delete: whatever example-stories directory Task 1's `init` created (commonly `packages/lyra-ui/src/stories/` or a root `stories/` — confirm the actual path from Task 1's `git status` output before deleting)
- Create: `packages/lyra-ui/src/components/sparkline/sparkline.stories.ts`

**Interfaces:**
- Consumes: `LyraSparkline` custom element (`<lyra-sparkline values type>`), registered by importing `packages/lyra-ui/src/lyra.ts` (side-effect import).
- Produces: the `.storybook/main.ts` / `preview.ts` shape every subsequent story task in this plan relies on — read this task's final file contents before writing any later story file.

- [ ] **Step 1: Regenerate the custom-elements manifest**

```bash
pnpm --filter @aceshooting/lyra-ui run manifest
```

Expected: `packages/lyra-ui/custom-elements.json` exists (it's gitignored, so this must be re-run after every fresh clone/CI run — noted again in Task 25's CI wiring).

- [ ] **Step 2: Delete Storybook's example stories**

```bash
git status --short   # confirm the exact path init created before deleting
rm -rf packages/lyra-ui/src/stories   # adjust path if init put them elsewhere
```

- [ ] **Step 3: Replace `.storybook/main.ts` with the final config**

```ts
import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  stories: ['../packages/lyra-ui/src/components/**/*.stories.ts', '../.storybook/*.mdx'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
};

export default config;
```

- [ ] **Step 4: Replace `.storybook/preview.ts` with the final config**

```ts
import type { Preview } from '@storybook/web-components-vite';
import { setCustomElementsManifest } from '@storybook/web-components';
// Registers every lyra-* custom element once, for every story — no per-story imports needed.
import '../packages/lyra-ui/src/lyra.js';
// <lyra-map>'s optional peer `maplibre-gl` ships its own CSS as a side-effect import — same
// requirement as the old docs/ playground had.
import 'maplibre-gl/dist/maplibre-gl.css';
// Drives the autodocs prop/event/slot tables — regenerate via `pnpm --filter
// @aceshooting/lyra-ui run manifest` whenever a component's public API changes.
import customElements from '../packages/lyra-ui/custom-elements.json';

setCustomElementsManifest(customElements);

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a1a' },
      ],
    },
  },
};

export default preview;
```

- [ ] **Step 5: Write the Sparkline story**

Create `packages/lyra-ui/src/components/sparkline/sparkline.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const DATA = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];

const meta: Meta = {
  title: 'Sparkline',
  component: 'lyra-sparkline',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Line: Story = {
  render: () => html`<lyra-sparkline type="line" .values=${DATA}></lyra-sparkline>`,
};

export const Area: Story = {
  render: () => html`<lyra-sparkline type="area" .values=${DATA}></lyra-sparkline>`,
};

export const Bar: Story = {
  render: () => html`<lyra-sparkline type="bar" .values=${DATA}></lyra-sparkline>`,
};
```

- [ ] **Step 6: Verify end-to-end**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/docs/sparkline--docs`. Expected: three rendered sparklines (line/area/bar), a "Show code" panel per story with a copy-button, and a props table listing `values`, `type`, `min`, `max` (sourced from the manifest — confirms Step 4's wiring works). Check the browser console: zero errors. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add .storybook packages/lyra-ui/src/components/sparkline/sparkline.stories.ts
git status --short   # confirm the deleted example-stories path is also staged
git add -A
git commit -m "chore(docs): configure Storybook for the real library, add Sparkline story"
```

---

### Task 3: Combobox story

**Files:**
- Create: `packages/lyra-ui/src/components/combobox/combobox.stories.ts`

**Interfaces:**
- Consumes: `lyra-combobox` (`label`, `placeholder`, `with-clear` attrs; default slot of `lyra-option`), `lyra-option` (`value` attr, text content as label). Both registered via the Task 2 barrel import.

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Combobox',
  component: 'lyra-combobox',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-combobox label="Fruit" placeholder="Pick one…" with-clear style="max-width: 20rem">
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b">Banana</lyra-option>
      <lyra-option value="c">Cherry</lyra-option>
      <lyra-option value="d">Date</lyra-option>
    </lyra-combobox>
  `,
};

export const Multiple: Story = {
  render: () => html`
    <lyra-combobox label="Fruit" multiple with-clear style="max-width: 20rem">
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b">Banana</lyra-option>
      <lyra-option value="c">Cherry</lyra-option>
      <lyra-option value="d">Date</lyra-option>
    </lyra-combobox>
  `,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/docs/combobox--docs`. Expected: both stories render a working filterable dropdown (click it, type to filter, select an option); no console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/combobox/combobox.stories.ts
git commit -m "docs(storybook): add Combobox story"
```

---

### Task 4: Date picker & date input stories

**Files:**
- Create: `packages/lyra-ui/src/components/date-picker/date-picker.stories.ts`
- Create: `packages/lyra-ui/src/components/date-picker/date-input.stories.ts`

**Interfaces:**
- Consumes: `lyra-date-picker` (`mode`, `months` attrs), `lyra-date-input` (`label`, `with-clear` attrs).

- [ ] **Step 1: Write the date-picker story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'DatePicker/Inline',
  component: 'lyra-date-picker',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Single: Story = {
  render: () => html`<lyra-date-picker mode="single"></lyra-date-picker>`,
};

export const Range: Story = {
  render: () => html`<lyra-date-picker mode="range" months="2"></lyra-date-picker>`,
};
```

- [ ] **Step 2: Write the date-input story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'DatePicker/WithInput',
  component: 'lyra-date-input',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-date-input label="Start date" with-clear style="max-width: 16rem"></lyra-date-input>
  `,
};
```

- [ ] **Step 3: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/docs/datepicker-inline--docs` and `.../datepicker-withinput--docs`. Expected: the sidebar shows a "DatePicker" folder containing "Inline" and "With Input"; the inline calendar renders a month grid (Range shows two months side by side); the input renders a text field with a calendar-toggle button. No console errors. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add packages/lyra-ui/src/components/date-picker/date-picker.stories.ts packages/lyra-ui/src/components/date-picker/date-input.stories.ts
git commit -m "docs(storybook): add DatePicker stories"
```

---

### Task 5: Toast story

**Files:**
- Create: `packages/lyra-ui/src/components/toast/toast.stories.ts`

**Interfaces:**
- Consumes: the `toast()` helper (`import { toast } from '../../lyra.js'`), which mounts `lyra-toast`/`lyra-toast-item` on `document.body` — the story renders trigger buttons, not the toast elements directly.

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { toast } from '../../lyra.js';

const meta: Meta = {
  title: 'Toast',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Click a button to fire a toast via the `toast()` helper — the ergonomic entry point that lazily mounts a single `<lyra-toast>` region on `document.body`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Triggers: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem;">
      <button @click=${() => toast('Just so you know')}>Neutral</button>
      <button @click=${() => toast({ message: 'Saved!', variant: 'success' })}>Success</button>
      <button
        @click=${() =>
          toast({
            message: 'Item deleted',
            variant: 'danger',
            duration: 0,
            action: { label: 'Undo', onClick: (item) => item.hide() },
          })}
      >
        Danger + action
      </button>
    </div>
  `,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/toast--triggers`. Click each button; expected: a toast stacks in the top-end corner, the danger toast has a working "Undo" action and does not auto-dismiss. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/toast/toast.stories.ts
git commit -m "docs(storybook): add Toast story"
```

---

### Task 6: Flag story

**Files:**
- Create: `packages/lyra-ui/src/components/flag/flag.stories.ts`

**Interfaces:**
- Consumes: `lyra-flag` (`country`, `language`, `round` attrs). Requires the optional peer `@aceshooting/lyra-flags` (already a root devDependency) to render actual flag images.

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Flag',
  component: 'lyra-flag',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:center;">
      <lyra-flag country="fr" label="France" style="height: 1.5rem"></lyra-flag>
      <lyra-flag language="en" label="English" style="height: 1.5rem"></lyra-flag>
      <lyra-flag language="de" label="German" round style="height: 1.5rem"></lyra-flag>
      <lyra-flag country="jp" label="Japan" round style="height: 1.5rem"></lyra-flag>
    </div>
  `,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/flag--gallery`. Expected: four flag images (two square, two round); no `console.warn` about the missing `@aceshooting/lyra-flags` peer (it's already a root devDependency per this plan's Global Constraints). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/flag/flag.stories.ts
git commit -m "docs(storybook): add Flag story"
```

---

### Task 7: Stat story

**Files:**
- Create: `packages/lyra-ui/src/components/stat/stat.stories.ts`

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Stat',
  component: 'lyra-stat',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; flex-wrap:wrap;">
      <lyra-stat label="Revenue" value="12.4" unit="k€" trend="3.2" variant="success"></lyra-stat>
      <lyra-stat label="Errors" value="128" trend="-5.1" variant="danger"></lyra-stat>
      <lyra-stat label="Sessions" value="9,204"></lyra-stat>
    </div>
  `,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/stat--gallery`. Expected: three stat cards, the first two showing colored trend pills (green up-arrow, red down-arrow). No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/stat/stat.stories.ts
git commit -m "docs(storybook): add Stat story"
```

---

### Task 8: Table story

**Files:**
- Create: `packages/lyra-ui/src/components/table/table.stories.ts`

**Interfaces:**
- Consumes: `lyra-table` (`columns`, `rows` complex properties, `attribute: false` — must be set via property binding, not attributes). `TableColumn` type from `../../lyra.js`.

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { TableColumn } from '../../lyra.js';

interface DemoRow {
  id: string;
  name: string;
  score: number;
}

const rows: DemoRow[] = [
  { id: 'a', name: 'Alpha', score: 92 },
  { id: 'b', name: 'Beta', score: 81 },
  { id: 'c', name: 'Gamma', score: 76 },
];

const columns: TableColumn<DemoRow>[] = [
  { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
  { key: 'score', label: 'Score', sortable: true, align: 'end', cell: (r) => r.score },
];

const meta: Meta = {
  title: 'Table',
  component: 'lyra-table',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-table .columns=${columns} .rows=${rows}></lyra-table>`,
};

export const Empty: Story = {
  render: () => html`<lyra-table .columns=${columns} .rows=${[]}></lyra-table>`,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/docs/table--docs`. Expected: `Default` shows a 3-row sortable table (click "Name"/"Score" headers to re-sort); `Empty` shows the `<lyra-empty>` "No data" fallback state. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/table/table.stories.ts
git commit -m "docs(storybook): add Table story"
```

---

### Task 9: Gauge story

**Files:**
- Create: `packages/lyra-ui/src/components/gauge/gauge.stories.ts`

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Gauge',
  component: 'lyra-gauge',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Radial: Story = {
  render: () => html`<lyra-gauge value="72" max="100" label="CPU"></lyra-gauge>`,
};

export const Linear: Story = {
  render: () => html`<lyra-gauge type="linear" value="40" max="100" label="Disk"></lyra-gauge>`,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/docs/gauge--docs`. Expected: a radial arc gauge showing 72 and a linear bar gauge showing 40. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/gauge/gauge.stories.ts
git commit -m "docs(storybook): add Gauge story"
```

---

### Task 10: Export button story

**Files:**
- Create: `packages/lyra-ui/src/components/export-button/export-button.stories.ts`

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { CsvColumn } from '../../lyra.js';

const rows = [
  { id: 'a', name: 'Alpha', score: 92 },
  { id: 'b', name: 'Beta', score: 81 },
  { id: 'c', name: 'Gamma', score: 76 },
];

const columns: CsvColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'score', label: 'Score' },
];

const meta: Meta = {
  title: 'ExportButton',
  component: 'lyra-export-button',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const SingleFormat: Story = {
  render: () => html`
    <lyra-export-button filename="demo" .rows=${rows} .columns=${columns}></lyra-export-button>
  `,
};

export const MultiFormatMenu: Story = {
  render: () => html`
    <lyra-export-button
      filename="demo"
      .rows=${rows}
      .columns=${columns}
      .formats=${['csv', 'json']}
    ></lyra-export-button>
  `,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/docs/exportbutton--docs`. Expected: `SingleFormat` downloads a CSV immediately on click; `MultiFormatMenu` opens a small csv/json menu. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/export-button/export-button.stories.ts
git commit -m "docs(storybook): add ExportButton story"
```

---

### Task 11: Split story

**Files:**
- Create: `packages/lyra-ui/src/components/split/split.stories.ts`

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Split',
  component: 'lyra-split',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-split style="height: 8rem; border: 1px solid #ddd">
      <div style="padding: 0.5rem">Panel A</div>
      <div style="padding: 0.5rem">Panel B</div>
      <div style="padding: 0.5rem">Panel C</div>
    </lyra-split>
  `,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/split--default`. Expected: three resizable panels with draggable dividers between them. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/split/split.stories.ts
git commit -m "docs(storybook): add Split story"
```

---

### Task 12: Empty story

**Files:**
- Create: `packages/lyra-ui/src/components/empty/empty.stories.ts`

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Empty',
  component: 'lyra-empty',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-empty heading="No results" description="Try a different search.">
      <span slot="actions"><button>Reset</button></span>
    </lyra-empty>
  `,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/empty--default`. Expected: heading, description, and a "Reset" button rendered. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/empty/empty.stories.ts
git commit -m "docs(storybook): add Empty story"
```

---

### Task 13: Skeleton story

**Files:**
- Create: `packages/lyra-ui/src/components/skeleton/skeleton.stories.ts`

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Skeleton',
  component: 'lyra-skeleton',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:center;">
      <lyra-skeleton width="10rem" height="1rem"></lyra-skeleton>
      <lyra-skeleton variant="circle" width="3rem" height="3rem"></lyra-skeleton>
      <lyra-skeleton variant="rect" effect="sheen" width="6rem" height="3rem"></lyra-skeleton>
    </div>
  `,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/skeleton--gallery`. Expected: a pulsing text bar, a pulsing circle, and a sheen-animated rectangle. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/skeleton/skeleton.stories.ts
git commit -m "docs(storybook): add Skeleton story"
```

---

### Task 14: Time range story

**Files:**
- Create: `packages/lyra-ui/src/components/time-range/time-range.stories.ts`

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'TimeRange',
  component: 'lyra-time-range',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
};

export const Disabled: Story = {
  render: () =>
    html`<lyra-time-range min="0" max="100" start="20" end="80" disabled></lyra-time-range>`,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/docs/timerange--docs`. Expected: `Default` shows a draggable two-handle brush; `Disabled` shows the same brush non-interactive. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/time-range/time-range.stories.ts
git commit -m "docs(storybook): add TimeRange story"
```

---

### Task 15: Playback story

**Files:**
- Create: `packages/lyra-ui/src/components/playback/playback.stories.ts`

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Playback',
  component: 'lyra-playback',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-playback length="10" interval-ms="500" loop></lyra-playback>`,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/playback--default`. Click play; expected: the slider position steps every 500ms and loops back to 0 after reaching the end. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/playback/playback.stories.ts
git commit -m "docs(storybook): add Playback story"
```

---

### Task 16: Heatmap story

**Files:**
- Create: `packages/lyra-ui/src/components/heatmap/heatmap.stories.ts`

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Heatmap',
  component: 'lyra-heatmap',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-heatmap
      cell-size="24"
      value-label="events"
      .rowLabels=${['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
      .colLabels=${['0h', '6h', '12h', '18h']}
      .values=${[
        [1, 4, 9, 2],
        [0, 2, 6, 3],
        [5, 8, 3, 1],
        [-1, 1, 4, 7],
        [2, 3, 5, 6],
      ]}
    ></lyra-heatmap>
  `,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/heatmap--default`. Expected: a 5×4 canvas grid with a blue color ramp, `-1` cell rendered as "no data" (not colored). No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/heatmap/heatmap.stories.ts
git commit -m "docs(storybook): add Heatmap story"
```

---

### Task 17: Graph story

**Files:**
- Create: `packages/lyra-ui/src/components/graph/graph.stories.ts`

**Interfaces:**
- Consumes: `GraphNode`, `GraphLink` types from `../../lyra.js`.

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { GraphNode, GraphLink } from '../../lyra.js';

const nodes: GraphNode[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
];

const links: GraphLink[] = [
  { source: 'a', target: 'b' },
  { source: 'a', target: 'c' },
  { source: 'b', target: 'd' },
  { source: 'c', target: 'd' },
];

const meta: Meta = {
  title: 'Graph',
  component: 'lyra-graph',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-graph
      width="480"
      height="320"
      style="height: 20rem"
      .nodes=${nodes}
      .links=${links}
    ></lyra-graph>
  `,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/graph--default`. Expected: four force-directed nodes connected by links, draggable, pannable/zoomable. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/graph/graph.stories.ts
git commit -m "docs(storybook): add Graph story"
```

---

### Task 18: Tree story

**Files:**
- Create: `packages/lyra-ui/src/components/tree/tree.stories.ts`

**Interfaces:**
- Consumes: `TreeItem` type from `../../lyra.js`.

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { TreeItem } from '../../lyra.js';

const data: TreeItem[] = [
  {
    id: '1',
    label: 'Root',
    badge: 2,
    children: [
      { id: '1.1', label: 'Child A' },
      { id: '1.2', label: 'Child B' },
    ],
  },
  { id: '2', label: 'Leaf' },
];

const meta: Meta = {
  title: 'Tree',
  component: 'lyra-tree',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-tree style="max-width: 20rem" .data=${data}></lyra-tree>`,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/tree--default`. Expected: "Root" (badge "2") expandable to reveal "Child A"/"Child B", plus a sibling "Leaf" item. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/tree/tree.stories.ts
git commit -m "docs(storybook): add Tree story"
```

---

### Task 19: Chart family stories

**Files:**
- Create: `packages/lyra-ui/src/components/chart/line-chart.stories.ts`
- Create: `packages/lyra-ui/src/components/chart/bar-chart.stories.ts`
- Create: `packages/lyra-ui/src/components/chart/pie-chart.stories.ts`
- Create: `packages/lyra-ui/src/components/chart/doughnut-chart.stories.ts`
- Create: `packages/lyra-ui/src/components/chart/scatter-chart.stories.ts`
- Create: `packages/lyra-ui/src/components/chart/bubble-chart.stories.ts`
- Create: `packages/lyra-ui/src/components/chart/radar-chart.stories.ts`
- Create: `packages/lyra-ui/src/components/chart/polar-area-chart.stories.ts`
- Create: `packages/lyra-ui/src/components/chart/histogram.stories.ts`
- Create: `packages/lyra-ui/src/components/chart/box-plot.stories.ts`

This is one task covering the whole "Charts" sidebar folder — the ten chart tags share one optional-peer-dep story and are reviewed together as a single deliverable.

**Interfaces:**
- Consumes: `Series`, `BoxPlotSeries` types from `../../lyra.js`.

- [ ] **Step 1: Bar chart** — `bar-chart.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/Bar',
  component: 'lyra-bar-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lyra-bar-chart
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lyra-bar-chart>
    `;
  },
};
```

- [ ] **Step 2: Line chart** — `line-chart.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/Line',
  component: 'lyra-line-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [
      { label: 'Sessions', data: [4, 7, 6, 9, 12], fill: true },
      { label: 'Errors', data: [1, 2, 1, 0, 3], color: '#e5484d' },
    ];
    return html`
      <lyra-line-chart
        height="16rem"
        style="width: 22rem"
        legend
        .labels=${['Jan', 'Feb', 'Mar', 'Apr', 'May']}
        .datasets=${series}
      ></lyra-line-chart>
    `;
  },
};
```

- [ ] **Step 3: Pie chart** — `pie-chart.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/Pie',
  component: 'lyra-pie-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [
      {
        label: 'Browsers',
        data: [58, 18, 15, 9],
        color: ['#5b8def', '#f7b955', '#59c19a', '#b6b8c3'],
      },
    ];
    return html`
      <lyra-pie-chart
        height="16rem"
        style="width: 16rem"
        .labels=${['Chrome', 'Firefox', 'Safari', 'Other']}
        .datasets=${series}
      ></lyra-pie-chart>
    `;
  },
};
```

- [ ] **Step 4: Doughnut chart** — `doughnut-chart.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/Doughnut',
  component: 'lyra-doughnut-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [
      {
        label: 'Browsers',
        data: [58, 18, 15, 9],
        color: ['#5b8def', '#f7b955', '#59c19a', '#b6b8c3'],
      },
    ];
    return html`
      <lyra-doughnut-chart
        height="16rem"
        style="width: 16rem"
        .labels=${['Chrome', 'Firefox', 'Safari', 'Other']}
        .datasets=${series}
      ></lyra-doughnut-chart>
    `;
  },
};
```

- [ ] **Step 5: Radar chart** — `radar-chart.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/Radar',
  component: 'lyra-radar-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Model A', data: [80, 90, 70, 85, 75] }];
    return html`
      <lyra-radar-chart
        height="16rem"
        style="width: 22rem"
        .labels=${['Speed', 'Reliability', 'Comfort', 'Safety', 'Efficiency']}
        .datasets=${series}
      ></lyra-radar-chart>
    `;
  },
};
```

- [ ] **Step 6: Polar area chart** — `polar-area-chart.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/PolarArea',
  component: 'lyra-polar-area-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lyra-polar-area-chart
        height="16rem"
        style="width: 18rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lyra-polar-area-chart>
    `;
  },
};
```

- [ ] **Step 7: Scatter chart** — `scatter-chart.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/Scatter',
  component: 'lyra-scatter-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [
      {
        label: 'Samples',
        points: [
          { x: 10, y: 20 },
          { x: 15, y: 10 },
          { x: 20, y: 30 },
          { x: 25, y: 15 },
        ],
      },
    ];
    return html`
      <lyra-scatter-chart
        height="16rem"
        style="width: 22rem"
        x-label="X"
        y-label="Y"
        .datasets=${series}
      ></lyra-scatter-chart>
    `;
  },
};
```

- [ ] **Step 8: Bubble chart** — `bubble-chart.stories.ts`

`Series.points` is typed `{ x, y, label? }[]` with no `r` field, but `lyra-bubble-chart` needs an
`x`/`y`/`r` triple per the known gotcha in `llms-full.txt` — cast through `unknown`:

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

interface BubblePoint {
  x: number;
  y: number;
  r: number;
}

const meta: Meta = {
  title: 'Charts/Bubble',
  component: 'lyra-bubble-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const bubblePoints: BubblePoint[] = [
      { x: 10, y: 20, r: 8 },
      { x: 15, y: 10, r: 12 },
      { x: 20, y: 30, r: 6 },
    ];
    const series: Series[] = [
      { label: 'Clusters', points: bubblePoints as unknown as Series['points'] },
    ];
    return html`
      <lyra-bubble-chart
        height="16rem"
        style="width: 22rem"
        .datasets=${series}
      ></lyra-bubble-chart>
    `;
  },
};
```

- [ ] **Step 9: Histogram** — `histogram.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Charts/Histogram',
  component: 'lyra-histogram',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-histogram
      bins="6"
      height="16rem"
      style="width: 22rem"
      .values=${[2, 4, 4, 5, 6, 6, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13, 15]}
    ></lyra-histogram>
  `,
};
```

- [ ] **Step 10: Box plot** — `box-plot.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { BoxPlotSeries } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/BoxPlot',
  component: 'lyra-box-plot',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const boxes: BoxPlotSeries[] = [
      {
        label: 'Loss',
        data: [
          { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
          { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
          { min: 1.5, q1: 2.5, median: 3.5, q3: 4.5, max: 6.5 },
        ],
      },
    ];
    return html`
      <lyra-box-plot
        height="16rem"
        style="width: 22rem"
        .labels=${['K=2', 'K=3', 'K=4']}
        .boxes=${boxes}
      ></lyra-box-plot>
    `;
  },
};
```

- [ ] **Step 11: Verify all ten**

```bash
pnpm storybook
```

Open the "Charts" folder in the sidebar; click through all ten entries (Bar, Line, Pie, Doughnut, Radar, PolarArea, Scatter, Bubble, Histogram, BoxPlot). Expected: each renders its chart with no console errors, and each autodocs page shows a props table (confirming the manifest lookup resolves correctly per-tag, not just for `lyra-chart` itself). Stop the server.

- [ ] **Step 12: Commit**

```bash
git add packages/lyra-ui/src/components/chart/*.stories.ts
git commit -m "docs(storybook): add Chart family stories (bar/line/pie/doughnut/radar/polar-area/scatter/bubble/histogram/box-plot)"
```

---

### Task 20: Map story

**Files:**
- Create: `packages/lyra-ui/src/components/map/map.stories.ts`

**Interfaces:**
- Consumes: `LegendEntry` type from `../../lyra.js`. Requires `maplibre-gl` (root devDependency) and its CSS (already imported globally in `preview.ts` from Task 2).

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LegendEntry } from '../../lyra.js';

const legend: LegendEntry[] = [
  { color: '#5b8def', label: 'Low' },
  { color: '#e5484d', label: 'High' },
];

const meta: Meta = {
  title: 'Map',
  component: 'lyra-map',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Demoed with a raster OpenStreetMap tile style since a vector style needs an API key.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-map
      style="height: 20rem"
      center="[2.3522, 48.8566]"
      zoom="4"
      .legend=${legend}
      .mapStyle=${{
        version: 8,
        sources: {
          demo: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'demo', type: 'raster', source: 'demo' }],
      }}
    ></lyra-map>
  `,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/map--default`. Expected: a raster OSM map centered on Paris with a Low/High legend, pannable/zoomable. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/map/map.stories.ts
git commit -m "docs(storybook): add Map story"
```

---

### Task 21: File input story

**Files:**
- Create: `packages/lyra-ui/src/components/file-input/file-input.stories.ts`

- [ ] **Step 1: Write the story**

```ts
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'FileInput',
  component: 'lyra-file-input',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-file-input multiple accept=".csv,.xlsx"></lyra-file-input>`,
};
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Open `http://localhost:6006/?path=/story/fileinput--default`. Expected: a dropzone with "Drop files here or click to browse"; clicking opens the native file picker. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/src/components/file-input/file-input.stories.ts
git commit -m "docs(storybook): add FileInput story"
```

---

### Task 22: Manager theming (brand the Storybook chrome)

**Files:**
- Create: `.storybook/manager.ts`

**Interfaces:**
- Consumes: the literal color values from `packages/lyra-ui/src/internal/tokens.styles.ts`'s `--wa-*` fallbacks (`#0969da` brand, `#fff` surface, `#1a1a1a` text) — Storybook's manager theme API takes static values, not CSS custom properties, so this is a deliberate one-time copy.

- [ ] **Step 1: Write the manager theme**

```ts
import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

// Static color copies from packages/lyra-ui/src/internal/tokens.styles.ts's --wa-* fallbacks.
// If those fallbacks change, update this file too — Storybook's manager theme API takes literal
// values, not CSS custom properties, so this can't read tokens.styles.ts directly.
const lyraTheme = create({
  base: 'light',
  brandTitle: 'Lyra UI',
  brandUrl: 'https://github.com/aceshooting/lyra-ui',
  colorPrimary: '#0969da',
  colorSecondary: '#0969da',
  appBg: '#ffffff',
  appContentBg: '#ffffff',
  appBorderColor: '#8a8a90',
  textColor: '#1a1a1a',
  barTextColor: '#6b7280',
  barSelectedColor: '#0969da',
});

addons.setConfig({
  theme: lyraTheme,
});
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Expected: the Storybook top bar/sidebar shows "Lyra UI" as the brand title and uses the `#0969da` blue as the active/accent color instead of Storybook's default purple. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add .storybook/manager.ts
git commit -m "docs(storybook): brand the manager UI with Lyra UI colors"
```

---

### Task 23: Introduction overview page

**Files:**
- Create: `.storybook/Introduction.mdx`

- [ ] **Step 1: Write the overview page**

```mdx
import { Meta } from '@storybook/addon-docs/blocks';

<Meta title="Introduction" />

# Lyra UI

Free, clean-room [Lit](https://lit.dev) web components — a companion to
[Web Awesome](https://webawesome.com) that provides open-source equivalents of several
Web Awesome **Pro** components, plus a few extras. Token-compatible with Web Awesome, so
components look native inside a WA app, and are fully usable standalone.

> **Independent project.** Not affiliated with or endorsed by Web Awesome. Component APIs
> intentionally mirror Web Awesome's public API (attributes, slots, events, CSS parts) so
> migration is a prefix rename — but every implementation here is original (clean-room).

## Install

```bash
npm install @aceshooting/lyra-ui
```

## Usage

```js
import '@aceshooting/lyra-ui/components/combobox/combobox.js';
import '@aceshooting/lyra-ui/components/combobox/option.js';
```

```html
<lyra-combobox label="Fruit" with-clear>
  <lyra-option value="a">Apple</lyra-option>
  <lyra-option value="b">Banana</lyra-option>
</lyra-combobox>
```

## Links

- [GitHub](https://github.com/aceshooting/lyra-ui)
- [npm](https://www.npmjs.com/package/@aceshooting/lyra-ui)
- [llms.txt](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/llms.txt) — API
  reference index for coding assistants integrating this library.

## Theming

Components read Web Awesome's `--wa-*` design tokens (with `--lyra-*` fallbacks). Inside a
Web Awesome app they inherit your theme automatically; standalone, they use sensible defaults.
See the [package README](https://github.com/aceshooting/lyra-ui/tree/main/packages/lyra-ui#theming)
for the full token list.

Browse the sidebar for a live example and API reference of every component.
```

- [ ] **Step 2: Verify**

```bash
pnpm storybook
```

Expected: an "Introduction" entry pinned at the top of the sidebar, rendering the page above with working links. No console errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add .storybook/Introduction.mdx
git commit -m "docs(storybook): add Introduction overview page"
```

---

### Task 24: Remove the old docs/ playground, repoint scripts and references

**Files:**
- Delete: `docs/index.html`, `docs/main.ts`, `docs/vite.config.ts`
- Modify: root `package.json` (`dev`/`docs`/`docs:build` scripts)
- Modify: `README.md` (dev command table)
- Modify: `AGENTS.md` (monorepo layout section, dev commands section)

**Interfaces:**
- Consumes: nothing new — this task only removes/repoints, no new code.

- [ ] **Step 1: Delete the old playground**

```bash
git rm docs/index.html docs/main.ts docs/vite.config.ts
```

- [ ] **Step 2: Update root `package.json` scripts**

Open `package.json` and replace the `dev`/`docs`/`docs:build` lines:

```json
    "dev": "storybook dev -p 6006",
    "docs": "storybook dev -p 6006",
    "docs:build": "storybook build -o storybook-static"
```

(Leave `storybook`/`build-storybook`, if Task 1's `init` added them, as-is — they're equivalent aliases; do not remove them, since removing a script `init` added isn't necessary for this task's goal.)

- [ ] **Step 3: Update `README.md`'s dev command table**

Find:

```
pnpm docs         # Vite playground demoing every component
```

Replace with:

```
pnpm docs         # Storybook docs site demoing every component
```

- [ ] **Step 4: Update `AGENTS.md`'s monorepo layout and dev-commands sections**

Find the `docs/` line in the layout tree:

```
  docs/                           Vite playground demoing every component (this pkg + lyra-flags)
```

Replace with:

```
  .storybook/                     Storybook config — the docs site (this pkg + lyra-flags)
```

Find the dev-commands block's `pnpm docs` line:

```
pnpm docs                   # Vite playground (docs/vite.config.ts), demos every component live
```

Replace with:

```
pnpm docs                   # Storybook (.storybook/), demos every component live at localhost:6006
```

- [ ] **Step 5: Verify**

```bash
pnpm docs
```

Expected: Storybook boots (same as `pnpm storybook` in earlier tasks). Confirm `docs/` no longer contains `index.html`/`main.ts`/`vite.config.ts`:

```bash
ls docs/
```

Expected: only the `superpowers/` subdirectory remains (specs/plans — untouched by this task).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(docs): remove the old docs/ Vite playground, Storybook is now the docs site"
```

---

### Task 25: GitHub Pages deployment workflow

**Files:**
- Create: `.github/workflows/deploy-docs.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Deploy docs

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @aceshooting/lyra-ui run manifest
      - run: pnpm docs:build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: storybook-static

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify the build step locally**

```bash
pnpm --filter @aceshooting/lyra-ui run manifest
pnpm docs:build
```

Expected: a `storybook-static/` directory is created containing `index.html` and static assets, with no build errors.

```bash
ls storybook-static/index.html
```

Expected: file exists.

- [ ] **Step 3: Add `storybook-static/` to `.gitignore`**

Open `.gitignore` and add a line: `storybook-static/`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-docs.yml .gitignore
git commit -m "ci: deploy Storybook to GitHub Pages on push to main"
```

**Manual step for the user (cannot be done via git):** in the GitHub repo, go to Settings → Pages → Source, and select "GitHub Actions". Until that's set, this workflow's `deploy` job will fail with a Pages-not-enabled error even though `build` succeeds.

---

## Phase 2 — Repo professionalization

### Task 26: Root README overhaul

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the component tier grouping already established in `packages/lyra-ui/README.md`'s table (this task condenses it, it does not re-derive it).

- [ ] **Step 1: Replace `README.md`'s content**

Read the current file first (`README.md`), then rewrite it to:

```markdown
# Lyra UI (monorepo)

[![CI](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![license](https://img.shields.io/npm/l/%40aceshooting%2Flyra-ui)](./LICENSE)

A pnpm workspace hosting `lyra-ui` and its optional companion packages.

**[Browse the live docs site →](https://aceshooting.github.io/lyra-ui/)** — every component with
a live example, source code, and API reference.

| Package | Description |
|---|---|
| [`packages/lyra-ui`](./packages/lyra-ui) | Free, clean-room Lit web components — a companion to Web Awesome. |
| [`packages/lyra-flags`](./packages/lyra-flags) | Optional waving flag PNGs for `<lyra-flag>`, kept out of `lyra-ui`'s install by default. |

See each package's own README for install/usage. For local development:

```bash
pnpm install
pnpm build        # builds every package
pnpm test         # tests every package
pnpm lint         # typechecks every package
pnpm docs         # Storybook docs site demoing every component
```

Contributors and AI coding agents working on this repo: see [AGENTS.md](./AGENTS.md).
Human contributors: see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Components

34 tags across five component families — see the [live docs site](https://aceshooting.github.io/lyra-ui/)
for every example, or [`packages/lyra-ui/README.md`](./packages/lyra-ui/README.md#components) for
the full per-tag reference table.

- **v1 — form controls, toasts, sparkline:** combobox, date picker/input, toast, sparkline, flag
- **Dashboard atoms:** empty, skeleton, stat, table, gauge, export button, split
- **Temporal & graph:** time range, playback, heatmap, force-directed graph, tree
- **Charts:** line/bar/pie/doughnut/radar/polar-area/scatter/bubble chart, histogram, box plot
- **Map & file input:** maplibre-gl map with legend/choropleth, drag-drop file dropzone

## Documentation

- **Humans:** the [live docs site](https://aceshooting.github.io/lyra-ui/) (Storybook — every
  component's canvas, source, and props/events/slots reference).
- **AI agents integrating this library:** [`packages/lyra-ui/llms.txt`](./packages/lyra-ui/llms.txt)
  (short index) and [`llms-full.txt`](./packages/lyra-ui/llms-full.txt) (full API reference).
- **Contributors working on this repo itself:** [`AGENTS.md`](./AGENTS.md) (AI agents) and
  [`CONTRIBUTING.md`](./CONTRIBUTING.md) (humans).

## Status

Internally code-complete (322/322 tests) including the post-audit Tier 4 hardening and design-quality
hardening passes, but real-world adoption is not yet validated in any consumer project. See the
[post-audit roadmap addendum](./docs/superpowers/specs/2026-07-10-lyra-ui-post-audit-roadmap.md) for
the remaining Tier 5 priority features and adoption-validation tracking.

## License

[MIT](./LICENSE) for the code. `packages/lyra-flags` ships third-party flag artwork with
unverified provenance — see [its README](./packages/lyra-flags/README.md#%EF%B8%8F-asset-provenance--license)
before relying on it.
```

- [ ] **Step 2: Verify links resolve to real files**

```bash
ls CONTRIBUTING.md packages/lyra-ui/llms.txt packages/lyra-ui/llms-full.txt AGENTS.md LICENSE docs/superpowers/specs/2026-07-10-lyra-ui-post-audit-roadmap.md
```

Expected: every path exists except `CONTRIBUTING.md`, which Task 28 creates — if this task runs before Task 28, that's expected and fine (the link will resolve once Task 28 lands).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: overhaul root README with component list, docs site link, badges"
```

---

### Task 27: Changesets — CHANGELOG generation wired into `scripts/publish.sh`

**Files:**
- Create (via `changeset init`): `.changeset/config.json`, `.changeset/README.md`
- Modify: `package.json` (add `@changesets/cli` devDependency)
- Modify: `scripts/publish.sh`

**Interfaces:**
- Produces: `pnpm changeset` (contributor-facing, run in a PR) and `pnpm changeset version` (release-facing, called from `publish.sh`).

- [ ] **Step 1: Install and initialize Changesets**

```bash
pnpm add -D -w @changesets/cli
pnpm changeset init
```

Expected: `.changeset/config.json` and `.changeset/README.md` are created; `@changesets/cli` appears in root `package.json`'s `devDependencies`.

- [ ] **Step 2: Configure `.changeset/config.json` for this workspace**

Open the generated file and set:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

- [ ] **Step 3: Replace the version-prompt step in `scripts/publish.sh`**

Find this block in `scripts/publish.sh` (currently right after the `npm whoami` check):

```bash
current_version="$(node -p "require('$PKG_JSON').version")"
echo "Current $PKG_NAME version: $current_version"
echo "Releasing as gh account: $(gh api user --jq .login)"
read -rp "New version to publish: " new_version

if [[ -z "$new_version" ]]; then
  echo "Error: version cannot be empty." >&2
  exit 1
fi

if ! [[ "$new_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Error: '$new_version' does not look like a valid semver version." >&2
  exit 1
fi

if git rev-parse "$new_version" >/dev/null 2>&1; then
  echo "Error: git tag '$new_version' already exists." >&2
  exit 1
fi

echo
echo "==> Upgrading all workspace dependencies to latest"
pnpm -r up --latest

echo
echo "==> Setting $PKG_NAME version to $new_version"
node -e "
const fs = require('fs');
const path = '$PKG_JSON';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = '$new_version';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"
```

Replace it with:

```bash
current_version="$(node -p "require('$PKG_JSON').version")"
echo "Current $PKG_NAME version: $current_version"
echo "Releasing as gh account: $(gh api user --jq .login)"

if ! ls .changeset/*.md >/dev/null 2>&1; then
  echo "Error: no pending changesets found in .changeset/. Run 'pnpm changeset' first to describe this release's changes." >&2
  exit 1
fi

echo
echo "==> Upgrading all workspace dependencies to latest"
pnpm -r up --latest

echo
echo "==> Consuming changesets: bumping version(s) and generating CHANGELOG.md"
pnpm changeset version

new_version="$(node -p "require('$PKG_JSON').version")"
if [[ "$new_version" == "$current_version" ]]; then
  echo "Error: 'pnpm changeset version' did not change $PKG_NAME's version — check .changeset/ for a changeset targeting this package." >&2
  exit 1
fi

if git rev-parse "$new_version" >/dev/null 2>&1; then
  echo "Error: git tag '$new_version' already exists." >&2
  exit 1
fi
```

- [ ] **Step 4: Add `CHANGELOG.md` to the release artifacts**

Find this block near the end of `scripts/publish.sh`:

```bash
release_files=("$tarball_path" "$PKG_DIR/custom-elements.json" "$PKG_DIR/llms.txt" "$PKG_DIR/llms-full.txt")
```

Replace with:

```bash
release_files=("$tarball_path" "$PKG_DIR/custom-elements.json" "$PKG_DIR/llms.txt" "$PKG_DIR/llms-full.txt" "$PKG_DIR/CHANGELOG.md")
```

- [ ] **Step 5: Verify with a dry run (do not actually release)**

```bash
pnpm changeset
```

Follow the prompts: select `@aceshooting/lyra-ui`, choose `patch`, enter a throwaway summary like "test changeset, to be reverted". Expected: a new file appears under `.changeset/`.

```bash
pnpm changeset version
git diff packages/lyra-ui/package.json packages/lyra-ui/CHANGELOG.md
```

Expected: `packages/lyra-ui/package.json`'s version bumped by a patch, and `packages/lyra-ui/CHANGELOG.md` was created/prepended with the throwaway summary — confirming the mechanism `publish.sh` now depends on actually works.

```bash
git checkout -- packages/lyra-ui/package.json packages/lyra-ui/CHANGELOG.md pnpm-lock.yaml
rm .changeset/*.md 2>/dev/null; git status --short .changeset/
```

Expected: the dry-run changes are fully reverted (this was a verification-only run, not a real release) and `.changeset/` shows no pending changeset files (`.changeset/config.json`/`README.md` remain, untouched).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml .changeset/config.json .changeset/README.md scripts/publish.sh
git commit -m "chore(release): wire Changesets into publish.sh for CHANGELOG generation"
```

---

### Task 28: CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Write the file**

```markdown
# Contributing to Lyra UI

Thanks for considering a contribution. This is a short human-facing entry point — the full
coding conventions and architecture guide live in [`AGENTS.md`](./AGENTS.md); read that before
touching component internals.

## Setup

```bash
pnpm install
```

Node ≥ 20, `pnpm@11.10.0` (pinned via `packageManager` in `package.json`).

## Running things locally

```bash
pnpm test         # -r: @web/test-runner per package
pnpm lint         # -r: tsc --noEmit per package
pnpm build        # -r: tsc -p tsconfig.json per package -> dist/
pnpm docs         # Storybook docs site at localhost:6006, demos every component live
```

Reproduce CI locally with the same sequence CI runs: install --frozen-lockfile, Playwright
Chromium install, lint, test, build, manifest (see `.github/workflows/ci.yml`).

## Making a change

1. Follow the coding conventions in [`AGENTS.md`](./AGENTS.md#coding-conventions) — every
   component extends `LyraElement`, uses `--lyra-*` design tokens (no raw hex/px values), and
   registers its tag through `src/internal/prefix.ts`.
2. Add or update tests alongside the component you're changing (`@web/test-runner`, colocated
   `*.test.ts` files).
3. If you're adding a component or changing its public API (attributes/properties/events/slots/
   CSS parts), add or update its `*.stories.ts` file under the same component directory — the
   docs site (Storybook) is generated from these, not hand-maintained separately.
4. If your change is user-facing (affects anyone depending on `@aceshooting/lyra-ui`), run
   `pnpm changeset` and describe it — this is what generates the package's `CHANGELOG.md` on
   release. Skip this for internal-only changes (docs, tests, CI, tooling).

## Pull requests

- Keep PRs scoped to one change; large unrelated diffs are harder to review.
- CI must pass (lint, test, build, manifest) before merge.
- Use the PR template's checklist.

## Reporting bugs / requesting features

Use the GitHub issue templates — they ask for the information needed to reproduce or evaluate
the request.
```

- [ ] **Step 2: Verify**

```bash
cat CONTRIBUTING.md | head -5
```

Expected: file exists and starts with `# Contributing to Lyra UI`.

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING.md"
```

---

### Task 29: Issue and PR templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: Write the bug report template**

```markdown
---
name: Bug report
about: Something in @aceshooting/lyra-ui isn't working as documented
title: ''
labels: bug
---

**Component(s) affected** (e.g. `lyra-combobox`):

**@aceshooting/lyra-ui version:**

**What happened:**

**What you expected:**

**Minimal reproduction** (a small HTML/JS snippet, or a link to a reduced repro):

**Browser/environment:**
```

- [ ] **Step 2: Write the feature request template**

```markdown
---
name: Feature request
about: Propose a new component or a change to an existing one
title: ''
labels: enhancement
---

**Is this a new component, or a change to an existing one?**

**What's the use case?** (what are you building, what's missing today)

**Does a Web Awesome Pro component already cover this?** If so, name it — this library mirrors
Web Awesome's public API 1:1 where a counterpart exists (see `AGENTS.md`).

**Proposed API** (properties/attributes/events/slots, if you have a shape in mind — optional):
```

- [ ] **Step 3: Write the PR template**

```markdown
## What does this PR do?

## Checklist

- [ ] `pnpm lint` and `pnpm test` pass locally
- [ ] If this changes a component's public API, its `*.stories.ts` file is updated
- [ ] If this is user-facing, `pnpm changeset` was run to describe the change (skip for docs/tests/CI/tooling-only changes)
```

- [ ] **Step 4: Verify**

```bash
ls .github/ISSUE_TEMPLATE/bug_report.md .github/ISSUE_TEMPLATE/feature_request.md .github/pull_request_template.md
```

Expected: all three files exist.

- [ ] **Step 5: Commit**

```bash
git add .github/ISSUE_TEMPLATE/bug_report.md .github/ISSUE_TEMPLATE/feature_request.md .github/pull_request_template.md
git commit -m "chore: add issue and PR templates"
```

---

### Task 30: llms.txt — link the live docs site

**Files:**
- Modify: `packages/lyra-ui/llms.txt`

- [ ] **Step 1: Add a docs-site link to the `## Docs` section**

Open `packages/lyra-ui/llms.txt` and find:

```
## Docs

- [llms-full.txt](./llms-full.txt): Complete component-by-component API reference (properties,
```

Insert a new bullet immediately before it:

```
## Docs

- [Live docs site](https://aceshooting.github.io/lyra-ui/): Storybook site with a live, interactive
  example and copy-pasteable source for every component — useful for a human reviewing this
  library, less relevant for a coding assistant already reading this file.
- [llms-full.txt](./llms-full.txt): Complete component-by-component API reference (properties,
```

- [ ] **Step 2: Verify**

```bash
grep -A2 "^## Docs" packages/lyra-ui/llms.txt
```

Expected: the new bullet appears first under `## Docs`, followed by the existing `llms-full.txt` and `README.md` bullets.

- [ ] **Step 3: Commit**

```bash
git add packages/lyra-ui/llms.txt
git commit -m "docs: link the live docs site from llms.txt"
```

---

## Self-Review Notes

- **Spec coverage:** every numbered section of `2026-07-11-docs-site-and-repo-polish-design.md`
  maps to a task: §4 structure → Tasks 1–2, 24; §5 per-component pages → Tasks 3–21; §6 overview
  → Task 23; §7 branding → Task 22; §8 deployment → Task 25; §9 README → Task 26; §10
  Changesets/publish.sh → Task 27; §11 CONTRIBUTING/templates → Tasks 28–29; §12 badges → folded
  into Task 26 (README); §13 llms.txt → Task 30.
- **Manual steps called out, not silently skipped:** GitHub Pages source setting (end of Task 25)
  and repo description/topics (not automatable via git — the spec's §12 already flagged this; no
  task attempts it, and this note makes that omission explicit rather than silent).
- **Type consistency check:** `Series`, `BoxPlotSeries`, `TableColumn`, `CsvColumn`, `GraphNode`,
  `GraphLink`, `TreeItem`, `LegendEntry` are used in story tasks exactly as named/shaped in
  `packages/lyra-ui/llms-full.txt` and re-exported from `packages/lyra-ui/src/lyra.ts` (confirmed
  against the barrel file directly, not just the API doc).

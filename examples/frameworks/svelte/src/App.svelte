<script lang="ts">
  import type { LyraInput } from '@aceshooting/lyra-ui/components/lr-input.js';
  import type { TableColumn } from '@aceshooting/lyra-ui/components/lr-table.js';
  import type {} from '@aceshooting/lyra-ui/svelte';

  interface Person {
    id: number;
    name: string;
    role: string;
  }

  let input: LyraInput;
  let query = '';
  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace', role: 'Analyst' },
    { id: 2, name: 'Grace Hopper', role: 'Engineer' },
    { id: 3, name: 'Katherine Johnson', role: 'Mathematician' },
  ];
  function personFrom(row: unknown): Person {
    return row as Person;
  }
  const columns: TableColumn<unknown>[] = [
    { key: 'name', label: 'Name', cell: (row) => personFrom(row).name, sortable: true },
    { key: 'role', label: 'Role', cell: (row) => personFrom(row).role },
  ];
  const rowKey = (row: unknown) => personFrom(row).id;
  let rows: Person[];
  $: rows = people.filter((person) => person.name.toLowerCase().includes(query.toLowerCase()));

  function onChange(event: CustomEvent<{ value: string }>): void {
    query = event.detail.value;
  }
</script>

<main class="lr-native lr-stack lr-gap-l">
  <header class="lr-stack lr-gap-xs">
    <h1>People</h1>
    <p>Svelte binds arrays to known custom-element properties without stringifying them.</p>
  </header>

  <div class="lr-cluster lr-gap-s">
    <lr-input
      bind:this={input}
      label="Filter by name"
      value={query}
      with-clear
      onlr-change={onChange}
    ></lr-input>
    <button type="button" onclick={() => input.select()}>Select filter text</button>
  </div>

  <lr-table
    accessible-label="People matching the filter"
    {rowKey}
    {columns}
    {rows}
  ></lr-table>
</main>

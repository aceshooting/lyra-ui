import { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-ui/native.css';
import '@aceshooting/lyra-ui/utilities.css';
import '@aceshooting/lyra-ui/components/lr-input.js';
import '@aceshooting/lyra-ui/components/lr-table.js';
import type { LyraInput } from '@aceshooting/lyra-ui/components/lr-input.js';
import type { TableColumn } from '@aceshooting/lyra-ui/components/lr-table.js';
import type {} from '@aceshooting/lyra-ui/custom-elements-jsx';

import './styles.css';

interface Person {
  id: number;
  name: string;
  role: string;
}

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

function App() {
  const input = useRef<LyraInput>(null);
  const [query, setQuery] = useState('');
  const rows = useMemo(
    () => people.filter((person) => person.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  return (
    <main className="lr-native lr-stack lr-gap-l">
      <header className="lr-stack lr-gap-xs">
        <h1>People</h1>
        <p>React passes arrays and refs to Lyra custom-element properties without a wrapper.</p>
      </header>

      <div className="lr-cluster lr-gap-s">
        <lr-input
          ref={input}
          label="Filter by name"
          value={query}
          with-clear
          onlr-change={(event) => setQuery(event.detail.value)}
        />
        <button type="button" onClick={() => input.current?.select()}>
          Select filter text
        </button>
      </div>

      <lr-table
        accessibleLabel="People matching the filter"
        rowKey={rowKey}
        columns={columns}
        rows={rows}
      />
    </main>
  );
}

const target = document.querySelector('#root');
if (!(target instanceof HTMLElement)) throw new Error('Missing #root mount point');
createRoot(target).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

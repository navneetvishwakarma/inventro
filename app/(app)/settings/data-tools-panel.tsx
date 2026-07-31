'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { exportJsonAction, exportCsvAction, wipeDemoDataAction } from './actions';

// Server Actions return the file content as a plain string -- no new
// download infrastructure needed, the browser Blob URL does the rest.
function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataToolsPanel() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [wipeResult, setWipeResult] = useState<string | null>(null);

  function exportJson() {
    setError(null);
    startTransition(async () => {
      try {
        const content = await exportJsonAction();
        downloadText(`inventro-export-${Date.now()}.json`, content, 'application/json');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function exportCsv() {
    setError(null);
    startTransition(async () => {
      try {
        const content = await exportCsvAction();
        downloadText(`inventro-export-${Date.now()}.csv`, content, 'text/csv');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function wipeDemoData() {
    if (!window.confirm('Wipe all synthetic demo household data? This only affects the demo household used for prediction validation, never your real data. Re-seed with `npm run seed:history` afterward.')) return;
    setWipeResult(null);
    setError(null);
    startTransition(async () => {
      const result = await wipeDemoDataAction();
      if (result.ok) {
        setWipeResult('Demo data wiped.');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportJson} disabled={isPending}>
          Export JSON
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={isPending}>
          Export CSV
        </Button>
        <Button variant="destructive" onClick={wipeDemoData} disabled={isPending}>
          Wipe demo data
        </Button>
      </div>
      {wipeResult && <Alert tone="success">{wipeResult}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// S-28: a deliberately separate, explicit entry point from S-26's global
// image-paste listener -- pasting TEXT here never triggers navigation or the
// global listener (which only ever acts on image clipboard items). Submitting
// wraps the pasted body as a .txt File and hands it to the exact same
// handleFiles() pipeline capture.tsx already uses for every other format.
export function AddPasteText({ onSubmit, disabled }: { onSubmit: (files: File[]) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  function submit() {
    if (!text.trim()) return;
    const file = new File([new Blob([text], { type: 'text/plain' })], `pasted-${Date.now()}.txt`, { type: 'text/plain' });
    onSubmit([file]);
    setText('');
    setOpen(false);
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        Paste order text
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste an order-confirmation email body here…"
        rows={6}
      />
      <div className="flex gap-2">
        <Button onClick={submit} disabled={disabled || !text.trim()}>
          Submit
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)} disabled={disabled}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

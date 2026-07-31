'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

// No toast library in this repo -- matches every other screen's plain-
// controls convention. A 2-second label swap is the feedback.
export function CopyListButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick}>
      {copied ? 'Copied' : 'Copy as text'}
    </Button>
  );
}
